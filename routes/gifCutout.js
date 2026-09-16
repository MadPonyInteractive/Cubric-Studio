'use strict';

/**
 * routes/gifCutout.js — MPI-771 (engine half): GIF cut-out, the non-GPU side.
 *
 * The SAM3 video track itself runs in the RENDERER, through
 * `runGifCutoutTrack()` (js/services/commandExecutor.js, beside `runAutoMask`)
 * — both engines (local + remote) go through the same `getEngine()` path, no
 * local-only shortcut. That call returns one mask image PER FRAME (title
 * `Output_Mask` on `gif_cutout_sam3.json`'s `SAM3_TrackToMask` branch). This
 * route does everything AFTER that: apply the same Mask Adjust math the
 * preview uses (`distanceField.js`, dynamic-imported — pure, no DOM), Fill
 * Holes (`services/imageComposite.js`), Invert, then write the result into
 * the ALPHA of each full-resolution frame and land a new GIF entry — own
 * route file per the plan's E3 (`gifMake.js` / `gifMaker.js` precedent):
 * frames go through `services/gifFrames.js` and `buildGif()` directly, never
 * through `POST /gif/entry` (routes/gif.js, MPI-768, not owned here).
 *
 * `applyMaskAlpha()` is exported separately so the mask -> alpha math is
 * unit-testable with a synthetic mask batch and no engine (MPI-757 plan).
 *
 * POST /gif-cutout/source (E7 — feeds `runGifCutoutTrack`'s `videoPath`)
 * Body: `{ folderPath, frames: [{hash, delay}] }` (delay is carried for
 * shape-symmetry with `/gif-cutout/apply` but unused here: SAM3 needs ONE
 * MASK PER FRAME, not per-GIF-second timing, so the temp video is encoded at
 * a constant rate with no relation to playback speed).
 * -> `{ success: true, videoPath, frameCount, width, height }` on success, or
 * `{ success: false, error }` (400 on bad input / an unknown hash).
 *
 * Encodes exactly one video frame per list entry, IN ORDER — that 1:1 mapping
 * is what lets the mask batch `runGifCutoutTrack` returns be re-applied back
 * onto the SAME frame list by index. Two choices keep the round trip exact:
 *
 * - **Flatten transparency onto a fixed background FIRST.** A frame this
 *   route reads may already carry alpha from a PREVIOUS cut-out; handing
 *   SAM3 the untouched RGB underneath would let it track pixels the app
 *   already declared invisible (the write-side twin of
 *   `~/.claude/memory/tools/image-alpha-flatten.md`'s "flatten reveals, it
 *   does not fill" — that trap is about reading a flatten's OUTPUT, this is
 *   about never letting the hidden RGB reach a detector's input at all).
 * - **FFV1 (lossless) in an 4:4:4 pixel format (`bgr0`), not h264/yuv420p.**
 *   4:2:0 chroma subsampling is what forces even width/height; measured
 *   2026-09-16 that ffv1/bgr0 round-trips a REAL odd 101x77 source with zero
 *   silent resize (h264/yuv420p would have needed pad + a crop-back offset
 *   on every returned mask — this sidesteps that entirely, the "pick a
 *   codec with no even-dim requirement" half of the plan's E7 note).
 *
 * `encodeFramesToSourceVideo()` is exported separately (mirrors
 * `applyMaskAlpha`) so the encode is unit-testable without an engine.
 *
 * POST /gif-cutout/apply
 * Body: {
 *   folderPath, frames: [{hash, delay}] (the CURRENT gif's frame list, order
 *     matches `masks`), loop?, output?,
 *   masks: [ dataUrl | http(s) URL ]  — one per frame, same order as `frames`
 *     (a caller normally fetches each `Output_Mask` /view URL from the
 *     runner above and forwards it here, or inlines it as a data: URL),
 *   adjust?: { grow?, outward?, inward?, edge?, fillHoles? } — same shape
 *     `distanceField.js`'s `rangeFor()` takes, plus the boolean fill-holes
 *     opt-in; omit (or every numeric field 0/undefined) for a no-op that
 *     keeps the engine mask's own soft edge,
 *   invert?: boolean,
 *   sourceItemId?, sourceGroupId?,
 * } -> { success: true, item, group } (mode 'new' — precedent
 * `routes/videoReverse.js` / `routes/gif.js`'s own 'new' branch). A failure
 * mid-loop names the frame and stops rather than shipping a partial cut —
 * a large GIF that fails is a clear warning, never a silent cap (plan
 * "Memory" section).
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const {
    frameAbsPath,
    frameExists,
    writeFrame,
    buildGif,
} = require('../services/gifFrames');
const { fillMaskHoles } = require('../services/imageComposite');
const { extractImageThumb, imageThumbPath, IMAGE_RENDITION_PX } = require('../services/ffmpegThumb');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { nextSequence } = require('./projects');

const execFileP = promisify(execFile);

// Where /gif-cutout/source lands its temp track-source videos — inside the
// project so remote staging and any future manual inspection both find it
// where every other project media lives, never the OS temp dir directly.
const TEMP_SOURCE_DIRNAME = '.gif-cutout-tmp';
// Constant rate: SAM3 needs one mask per FRAME, not per second of playback,
// so the actual fps value is arbitrary — it only has to be uniform (the same
// "constant rate, patch delays later" principle `services/gifFrames.js`'s
// builder uses, applied here with no delay-patching step at all).
const SOURCE_ENCODE_FPS = 12;
// A cut-out frame may already carry alpha from a PREVIOUS pass; flatten it
// onto the SAME opaque background `services/gifFrames.js`'s builder now uses
// for an opaque `.gif` (coordinator note, 2026-09-16), so a re-cut round trip
// stays visually consistent end to end.
const SOURCE_BACKGROUND = { r: 0, g: 0, b: 0 };
// Self-cleaning instead of a second DELETE route: swept on every /source call
// rather than left to grow forever if a caller never follows up.
const TEMP_SOURCE_MAX_AGE_MS = 60 * 60 * 1000;

async function sweepTempSources(dir) {
    if (!(await fs.pathExists(dir))) return;
    const now = Date.now();
    for (const name of await fs.readdir(dir)) {
        const abs = path.join(dir, name);
        try {
            const st = await fs.stat(abs);
            if (now - st.mtimeMs > TEMP_SOURCE_MAX_AGE_MS) await fs.remove(abs);
        } catch { /* best-effort GC */ }
    }
}

/**
 * Encode `frames` (in order) into ONE lossless temp video, one video frame
 * per list entry, for `runGifCutoutTrack`'s `Input_Video`. See the module
 * doc for why FFV1/bgr0 and why transparency is flattened first.
 *
 * @param {{ mediaDir: string, frames: {hash:string}[], outDir: string }} o
 *   `outDir` is where the final file lands (the route passes the project's
 *   `.gif-cutout-tmp`; a test may pass its own scratch dir).
 * @returns {Promise<{ videoPath: string, frameCount: number, width: number, height: number }>}
 */
async function encodeFramesToSourceVideo({ mediaDir, frames, outDir }) {
    if (!Array.isArray(frames) || !frames.length) {
        throw new Error('encodeFramesToSourceVideo requires at least one frame');
    }
    await fs.ensureDir(outDir);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gif-cutout-source-'));
    try {
        let width = 0, height = 0;
        const listLines = [];
        for (let i = 0; i < frames.length; i++) {
            const buf = await fs.readFile(frameAbsPath(mediaDir, frames[i].hash));
            const meta = await sharp(buf).metadata();
            if (!width) { width = meta.width; height = meta.height; }
            // flatten() before writing to disk — never removeAlpha() (sharp.md):
            // flatten keeps the pipeline on a plain 3-channel image the encoder
            // below can take as-is, with no hidden RGB left for SAM3 to see.
            const flat = await sharp(buf).flatten({ background: SOURCE_BACKGROUND }).png().toBuffer();
            const name = `f_${String(i).padStart(5, '0')}.png`;
            await fs.writeFile(path.join(tmpDir, name), flat);
            listLines.push(`file '${name}'`);
        }
        await fs.writeFile(path.join(tmpDir, 'list.txt'), listLines.join('\n') + '\n');

        const outAbsPath = path.join(outDir, `${uuidv4()}.mkv`);
        await execFileP(ffmpegPath, [
            '-y', '-r', String(SOURCE_ENCODE_FPS), '-f', 'concat', '-safe', '0', '-i', 'list.txt',
            // bgr0: 4:4:4, no chroma subsampling, so ffv1 never rounds an odd
            // width/height to even — measured on a real 101x77 source.
            '-c:v', 'ffv1', '-pix_fmt', 'bgr0',
            outAbsPath,
        ], { cwd: tmpDir, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

        return { videoPath: outAbsPath, frameCount: frames.length, width, height };
    } finally {
        await fs.remove(tmpDir).catch(() => {});
    }
}

// Dynamic ESM import (distanceField.js is pure `export function`, no DOM, no
// imports — same precedent as tests/mask-distance-field.test.cjs). Cached
// after the first call so a many-frame cut-out pays the import cost once.
const DISTANCE_FIELD_MODULE = '../js/components/Primitives/MpiCanvas/managers/distanceField.js';
let _distanceFieldPromise = null;
function loadDistanceField() {
    if (!_distanceFieldPromise) _distanceFieldPromise = import(DISTANCE_FIELD_MODULE);
    return _distanceFieldPromise;
}

function projectFileUrl(filePath) {
    return `/project-file?path=${encodeURIComponent(filePath)}`;
}

/** A mask arrives as a data: URL (inlined) or an http(s) URL (an engine /view link). */
async function resolveMaskBufferInput(value) {
    if (typeof value !== 'string' || !value) throw new Error('mask value missing');
    if (value.startsWith('data:')) {
        const comma = value.indexOf(',');
        if (comma === -1) throw new Error('malformed data: URL');
        return Buffer.from(value.slice(comma + 1), 'base64');
    }
    if (/^https?:\/\//i.test(value)) {
        const res = await fetch(value);
        if (!res.ok) throw new Error(`failed to fetch mask (HTTP ${res.status}): ${value}`);
        return Buffer.from(await res.arrayBuffer());
    }
    throw new Error('mask must be a data: URL or an http(s) URL');
}

/**
 * Write `maskBuffer` into `frameBuffer`'s alpha channel, after the SAME
 * Mask Adjust math the preview runs (`distanceField.js`'s `rangeFor` +
 * `signedSquaredDistanceField` + `writeRange`) and an optional Fill Holes /
 * Invert pass. No `adjust` (or an all-zero one) is a no-op that keeps the
 * engine mask's own soft edge — `rangeFor()` itself returns null for that
 * case, so this never hard-thresholds unless the caller asked it to.
 *
 * @param {{ frameBuffer: Buffer, maskBuffer: Buffer, adjust?: {grow?:number, outward?:number, inward?:number, edge?:boolean, fillHoles?:boolean}, invert?: boolean }} o
 * @returns {Promise<Buffer>} an RGBA PNG at `frameBuffer`'s own resolution
 */
async function applyMaskAlpha({ frameBuffer, maskBuffer, adjust, invert }) {
    const { width, height } = await sharp(frameBuffer).metadata();
    if (!width || !height) throw new Error('could not read frame dimensions');

    // Mask -> one 8-bit channel at the frame's own resolution. `resize(fit:
    // 'fill')` is also what makes a mask size != frame size a non-issue (the
    // /gif-cutout/source encode never needs to pad, so this is normally an
    // identity resize, but nothing here assumes the two already match).
    // flatten() before greyscale(): the engine's PreviewImage mask may itself
    // carry alpha, and greyscale() would keep it as a second channel raw()
    // cannot flatten later.
    let alpha = await sharp(maskBuffer)
        .resize(width, height, { fit: 'fill' })
        .flatten({ background: '#000000' })
        .greyscale()
        .toColourspace('b-w')
        .raw()
        .toBuffer();
    alpha = Uint8Array.from(alpha);

    const range = adjust ? (await loadDistanceField()).rangeFor(adjust) : null;
    if (range) {
        const { signedSquaredDistanceField, writeRange } = await loadDistanceField();
        const n = width * height;
        const rgba = new Uint8ClampedArray(n * 4);
        for (let i = 0; i < n; i++) rgba[i * 4 + 3] = alpha[i];
        const field = signedSquaredDistanceField(rgba, width, height);
        const out32 = new Uint32Array(n);
        writeRange(field, out32, range.lo, range.hi);
        // Every byte of a written lane is equal (0xFFFFFFFF or 0), so the low
        // byte alone is the adjusted alpha value regardless of endianness.
        for (let i = 0; i < n; i++) alpha[i] = out32[i] & 0xff;
    }

    if (adjust?.fillHoles === true) fillMaskHoles(alpha, width, height);
    if (invert === true) {
        for (let i = 0; i < alpha.length; i++) alpha[i] = 255 - alpha[i];
    }

    // flatten() before extracting RGB, never removeAlpha() — a re-cut frame
    // may already carry alpha from a previous pass (memory/tools/sharp.md).
    const rgb = await sharp(frameBuffer)
        .flatten({ background: '#000000' })
        .toColourspace('srgb')
        .raw()
        .toBuffer();

    return sharp(rgb, { raw: { width, height, channels: 3 } })
        .joinChannel(Buffer.from(alpha), { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer();
}

router.post('/gif-cutout/source', async (req, res) => {
    try {
        const { folderPath, frames } = req.body || {};
        if (!folderPath || typeof folderPath !== 'string') {
            return res.status(400).json({ success: false, error: 'folderPath required' });
        }
        if (!Array.isArray(frames) || !frames.length) {
            return res.status(400).json({ success: false, error: 'frames required (non-empty array)' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        for (const f of frames) {
            if (!f?.hash || !(await frameExists(mediaDir, f.hash))) {
                return res.status(400).json({ success: false, error: `unknown frame hash: ${f?.hash}` });
            }
        }

        const outDir = path.join(mediaDir, TEMP_SOURCE_DIRNAME);
        await sweepTempSources(outDir);
        const { videoPath, frameCount, width, height } = await encodeFramesToSourceVideo({ mediaDir, frames, outDir });
        res.json({ success: true, videoPath, frameCount, width, height });
    } catch (err) {
        logger.error('project', 'gif cutout source encode failed', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/gif-cutout/apply', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, frames, loop, output, masks, adjust, invert, sourceItemId, sourceGroupId } = req.body || {};
        if (!folderPath || typeof folderPath !== 'string') {
            return res.status(400).json({ success: false, error: 'folderPath required' });
        }
        if (!Array.isArray(frames) || !frames.length) {
            return res.status(400).json({ success: false, error: 'frames required (non-empty array)' });
        }
        if (!Array.isArray(masks) || masks.length !== frames.length) {
            return res.status(400).json({ success: false, error: `masks must be an array of ${frames.length} entries (one per frame)` });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir = path.join(mediaDir, '.meta');
        await fs.ensureDir(metaDir);

        for (const f of frames) {
            if (!f?.hash || !(await frameExists(mediaDir, f.hash))) {
                return res.status(400).json({ success: false, error: `unknown frame hash: ${f?.hash}` });
            }
        }

        const newFrames = [];
        for (let i = 0; i < frames.length; i++) {
            let cutBuffer;
            try {
                const frameBuffer = await fs.readFile(frameAbsPath(mediaDir, frames[i].hash));
                const maskBuffer = await resolveMaskBufferInput(masks[i]);
                cutBuffer = await applyMaskAlpha({ frameBuffer, maskBuffer, adjust, invert });
            } catch (frameErr) {
                // Name the frame and stop — never ship a partially-cut entry, and
                // never silently cap the input (plan "Memory": a large GIF that
                // fails is a clear warning, not a truncation).
                throw new Error(`cut-out failed at frame ${i + 1}/${frames.length}: ${frameErr.message}`);
            }
            const { hash } = await writeFrame(mediaDir, cutBuffer);
            newFrames.push({ hash, delay: Number(frames[i].delay) || 10 });
        }

        const gifEntry = {
            frames: newFrames,
            loop: Number.isFinite(Number(loop)) ? Number(loop) : 0,
            output: {
                maxEdge: Number(output?.maxEdge) > 0 ? Number(output.maxEdge) : 1024,
                colours: Number.isFinite(Number(output?.colours)) ? Number(output.colours) : 256,
                edgeColour: output?.edgeColour || null,
            },
        };

        const finalName = await nextSequence(folderPath, mediaDir, 'gif', 'gif');
        outputPath = path.join(mediaDir, finalName);
        await buildGif(gifEntry, mediaDir, outputPath);

        const id = uuidv4();
        const meta = {
            id,
            type: 'image',
            filePath: projectFileUrl(outputPath),
            operation: 'gifCutout',
            displayName: finalName.replace(/\.[^.]+$/, ''),
            prompt: '',
            negativePrompt: '',
            seed: -1,
            modelId: null,
            createdAt: new Date().toISOString(),
            name: null,
            uploaded: false,
            pixelDimensions: { w: 0, h: 0 },
            generationMs: null,
            gif: gifEntry,
            sourceItemId: sourceItemId || null,
            sourceGroupId: sourceGroupId || null,
        };
        await extractImageThumb(outputPath, path.join(metaDir, `${id}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small });
        meta.thumbPath = projectFileUrl(imageThumbPath(path.join(metaDir, `${id}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small }));
        await fs.writeJson(path.join(metaDir, `${id}.json`), meta, { spaces: 2 });

        const item = { ...meta };
        const group = {
            id: uuidv4(),
            type: 'image',
            operation: 'gifCutout',
            createdAt: new Date().toISOString(),
            items: [item],
        };
        res.json({ success: true, item, group });
    } catch (err) {
        logger.error('project', 'gif cutout apply failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch { /* best-effort */ } }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
module.exports.applyMaskAlpha = applyMaskAlpha;
module.exports.resolveMaskBufferInput = resolveMaskBufferInput;
module.exports.encodeFramesToSourceVideo = encodeFramesToSourceVideo;
