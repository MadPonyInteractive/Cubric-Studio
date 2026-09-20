'use strict';

/**
 * services/gifFrames.js — MPI-768: the GIF frames store and builder.
 *
 * A GIF item's sidecar stays `type: 'image'`; the extra `gif` field is:
 *   { frames: [{ hash, delay }], loop, output: { maxEdge, colours, edgeColour } }
 * - frames[].hash  sha256 of a lossless full-colour RGBA PNG in the content-
 *                  addressed store `Media/.gif-frames/<hash>.png`
 *                  (+ `<hash>.thumb.<w>.webp` strip thumbnail, MPI-769).
 * - frames[].delay hundredths of a second (GIF's own unit); never written under
 *                  MIN_DELAY_HUNDREDTHS (Chromium plays 0 or 1 as 10).
 * - loop           TOTAL PLAYS (0 = forever, 1 = once, N = N plays) — the same
 *                  UI-facing unit `routes/videoGif.js`'s body field already uses,
 *                  not ffmpeg's raw `-loop` value (0=inf, -1=none, N=N+1 plays).
 * - output         the settings the CURRENT `filePath` .gif was built with, so a
 *                  later rebuild that does not override them reproduces it.
 *                  `edgeColour: null` = opaque build (default; transparency
 *                  is flattened onto OPAQUE_BACKGROUND); a hex string
 *                  means "this is a transparent build — blend any partial-alpha
 *                  edge into this colour before the alpha is cut to on/off"
 *                  (plan Decision 4). That single field carries both the on/off
 *                  toggle and the blend colour — no separate boolean needed.
 *
 * Frames are the source of truth (plan Decision 7): the store is content-
 * addressed and freed by `sweepGifFrames` the moment nothing references a hash —
 * UNLIKE `Media/.preview-assets/` (MPI-227), which is permanent forever and only
 * the manual "Cleanup assets..." command empties. Never touch `.preview-assets`
 * from here, and never let `.gif-frames` grow that same "nothing ever GCs this"
 * shape.
 *
 * GIF delays: ffmpeg's demuxer duration reporting drifts under a naive build —
 * proven in `.agents/mpi-kanban/tasks/MPI-757/research/2026-09-15-investigation.md`
 * (asked 10,50,3,2,7 hundredths, a concat-demuxer + per-file-duration build wrote
 * 12,48,4,1,7,4 — drift AND an extra frame). The fix proven there, and reproduced
 * while writing this file (scratchpad probe, ffmpeg-static 6.1.1 / sharp 0.34.5):
 * build at a CONSTANT frame rate — one GIF frame per list entry, uniform pacing —
 * then PATCH every frame's Graphic Control Extension delay (2 bytes LE) with a
 * real GIF block walker. A byte scan for `21 F9 04` is wrong: it false-matches
 * inside LZW-compressed image data (the research file measured a bogus "delay" of
 * 58178 that way). The walker here instead follows the format's own sub-block
 * length prefixes, so it never interprets compressed pixel bytes as structure.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { ffmpegPath } = require('./ffmpegBinary');
const { extractImageThumb, imageThumbPath } = require('./ffmpegThumb');

const execFileP = promisify(execFile);

const FRAMES_DIRNAME = '.gif-frames';
const FRAME_THUMB_PX = 160;          // strip thumbnail width (MPI-769)
const MIN_DELAY_HUNDREDTHS = 2;      // Chromium plays a delay of 0 or 1 as 10
const DEFAULT_MAX_EDGE = 1024;       // plan Decision 8 (Make GIF / builder default)
const BUILD_FPS = 10;                // constant-rate pass; delays are patched after
const OPAQUE_BACKGROUND = '#000000';  // what transparency becomes in an opaque build (matches GIF to Video)

function framesDir(mediaDir) {
    return path.join(mediaDir, FRAMES_DIRNAME);
}

function frameAbsPath(mediaDir, hash) {
    return path.join(framesDir(mediaDir), `${hash}.png`);
}

/**
 * `extractImageThumb`/`imageThumbPath` always turn the `.jpg` request into a
 * `.webp` (and append the width when it is not the 512 "small" default) — this
 * mirrors that exact rule so a caller can locate the file without re-deriving it.
 */
function frameThumbAbsPath(mediaDir, hash) {
    return imageThumbPath(path.join(framesDir(mediaDir), `${hash}.thumb.jpg`), { width: FRAME_THUMB_PX });
}

function hashBuffer(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * ffmpeg's `-loop` is the NETSCAPE "extra repeats" value (0=inf, -1=none,
 * N=N+1 plays — see routes/videoGif.js). Verified empirically (scratchpad probe,
 * ffmpeg-static 6.1.1 / sharp 0.34.5) that sharp's OWN `metadata().loop` already
 * reports TOTAL PLAYS, the same unit as our sidecar and as videoGif.js's body
 * field: raw -1 -> loop 1, raw 2 -> loop 3, raw 5 -> loop 6, raw 0 -> loop 0.
 * So extraction needs no conversion; only the builder needs this inverse, to
 * hand ffmpeg a raw value.
 */
function totalPlaysToRawLoop(totalPlays) {
    const n = Math.max(0, Math.round(Number(totalPlays) || 0));
    if (n === 0) return 0;
    if (n === 1) return -1;
    return n - 1;
}

function frameExists(mediaDir, hash) {
    return fs.pathExists(frameAbsPath(mediaDir, hash));
}

/**
 * Write one frame into the content-addressed store. A no-op (besides the hash)
 * when the content already exists — this is what makes "identical frames
 * written once" true for a reorder/retime edit that touches no pixels.
 */
async function writeFrame(mediaDir, buffer) {
    const dir = framesDir(mediaDir);
    await fs.ensureDir(dir);
    const hash = hashBuffer(buffer);
    const abs = frameAbsPath(mediaDir, hash);
    if (!(await fs.pathExists(abs))) {
        const tmp = `${abs}.${process.pid}.${uuidv4()}.tmp`;
        await fs.writeFile(tmp, buffer);
        await fs.rename(tmp, abs);
    }
    const thumbAbs = frameThumbAbsPath(mediaDir, hash);
    if (!(await fs.pathExists(thumbAbs))) {
        await extractImageThumb(abs, path.join(dir, `${hash}.thumb.jpg`), { width: FRAME_THUMB_PX });
    }
    return { hash, path: abs, thumbPath: thumbAbs };
}

/* ---------------------------------------------------------------------------
 * Extraction (E2) — legacy `.gif` lazy-open AND new-import eager extraction
 * share this; the caller decides WHEN to call it, this has no policy about that.
 * ------------------------------------------------------------------------ */

async function extractFramesFromGif(gifAbsPath, mediaDir) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gif-extract-'));
    try {
        const pattern = path.join(tmpDir, 'f_%05d.png');
        await execFileP(ffmpegPath,
            ['-y', '-i', gifAbsPath, '-fps_mode', 'passthrough', pattern],
            { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

        const files = (await fs.readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
        if (!files.length) throw new Error(`gif extract produced no frames: ${gifAbsPath}`);

        const meta = await sharp(gifAbsPath, { animated: true }).metadata();
        const pages = meta.pages || 1;
        if (files.length !== pages) {
            // Never trust a silent mismatch — assert loudly (root-cause rule):
            // a frame-count disagreement here means the delay array below would
            // misalign frame N with delay N+1 for every frame after the gap.
            throw new Error(`gif extract frame-count mismatch for ${gifAbsPath}: ffmpeg wrote ${files.length} frames, sharp reports ${pages} pages`);
        }
        const delaysMs = Array.isArray(meta.delay) && meta.delay.length === pages
            ? meta.delay
            : new Array(pages).fill(Number.isFinite(meta.delay) ? meta.delay : 100);

        const frames = [];
        for (let i = 0; i < files.length; i++) {
            const buf = await fs.readFile(path.join(tmpDir, files[i]));
            const { hash } = await writeFrame(mediaDir, buf);
            const delay = Math.max(MIN_DELAY_HUNDREDTHS, Math.round((delaysMs[i] ?? 100) / 10));
            frames.push({ hash, delay });
        }

        const first = await sharp(path.join(tmpDir, files[0])).metadata();
        const maxEdge = Math.max(first.width || 0, first.height || 0) || DEFAULT_MAX_EDGE;

        return {
            frames,
            loop: Number.isFinite(meta.loop) ? meta.loop : 0,
            output: { maxEdge, colours: null, edgeColour: null },
        };
    } finally {
        await fs.remove(tmpDir).catch(() => {});
    }
}

/* ---------------------------------------------------------------------------
 * Build (E1)
 * ------------------------------------------------------------------------ */

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Flatten a frame's RGB toward `edgeColour` wherever alpha is PARTIAL, while
 * leaving the ORIGINAL alpha channel untouched. A plain `.flatten()` (dropping
 * alpha) would hand back the untouched RGB the mask hid underneath the
 * transparency — the exact trap in memory/tools/image-alpha-flatten.md ("flatten
 * reveals, it does not fill"). `flatten()` before `joinChannel()`, never
 * `removeAlpha()`: the join is silently DROPPED after `removeAlpha()` on sharp
 * 0.34 / libvips 8.17 (memory/tools/sharp.md trap 1) — `flatten` keeps the same
 * channel count and joins correctly.
 */
async function blendEdgeColour(buffer, edgeColour) {
    const rgb = hexToRgb(edgeColour);
    if (!rgb) return buffer;
    const { width, height } = await sharp(buffer).metadata();
    const alpha = await sharp(buffer).ensureAlpha().extractChannel(3).toColourspace('b-w').raw().toBuffer();
    const flatRgb = await sharp(buffer)
        .flatten({ background: rgb })
        .toColourspace('srgb')
        .raw()
        .toBuffer();
    return sharp(flatRgb, { raw: { width, height, channels: 3 } })
        .joinChannel(alpha, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer();
}

/**
 * Patch a fully-formed GIF's per-frame delays in place: header, optional Global
 * Color Table, then Extension / Image blocks up to the trailer. See the module
 * doc for why this walks sub-block length prefixes instead of scanning bytes.
 *
 * @param {Buffer} buffer
 * @param {number[]} delaysHundredths — one per frame, in GIF frame order
 * @param {{disposal?: number}} [opts] — when set, also rewrites every GCE's
 *   disposal method (2 = restore to background, needed by transparent builds)
 * @returns {Buffer} a new buffer with every Graphic Control Extension delay patched
 */
function patchGifDelays(buffer, delaysHundredths, opts = {}) {
    const buf = Buffer.from(buffer);
    const sig = buf.slice(0, 6).toString('ascii');
    if (sig !== 'GIF89a' && sig !== 'GIF87a') throw new Error(`not a GIF (signature ${sig})`);

    let i = 6;
    const packed = buf[i + 4];
    i += 7; // logical screen descriptor (width,height,packed,bg index,pixel aspect)
    if (packed & 0x80) {
        i += 3 * Math.pow(2, (packed & 0x07) + 1); // global color table
    }

    const gceOffsets = [];
    while (i < buf.length) {
        const b = buf[i];
        if (b === 0x21) { // Extension Introducer
            const label = buf[i + 1];
            if (label === 0xF9) { // Graphic Control Extension — block size is spec-fixed at 4
                const blockSize = buf[i + 2];
                gceOffsets.push(i + 4); // introducer,label,size(3) + packed(1) -> delay LE at +4
                i = i + 2 + 1 + blockSize + 1; // introducer+label, size byte, data, terminator
            } else {
                // Generic extension (Application/Comment/Plain Text): label byte,
                // then length-prefixed sub-blocks until a zero-length terminator.
                i += 2;
                for (;;) {
                    const len = buf[i];
                    i += 1 + len;
                    if (len === 0) break;
                }
            }
        } else if (b === 0x2C) { // Image Descriptor
            const lp = buf[i + 9]; // packed byte, after introducer+left+top+w+h (1+8)
            let j = i + 10;
            if (lp & 0x80) j += 3 * Math.pow(2, (lp & 0x07) + 1); // local color table
            j += 1; // LZW minimum code size
            for (;;) { // length-prefixed image data sub-blocks
                const len = buf[j];
                j += 1 + len;
                if (len === 0) break;
            }
            i = j;
        } else if (b === 0x3B) { // Trailer
            break;
        } else {
            throw new Error(`unexpected GIF block byte 0x${b.toString(16)} at offset ${i}`);
        }
    }

    if (gceOffsets.length !== delaysHundredths.length) {
        throw new Error(`GIF patch frame-count mismatch: file has ${gceOffsets.length} frames, ${delaysHundredths.length} delays given`);
    }
    gceOffsets.forEach((off, idx) => {
        const d = Math.max(MIN_DELAY_HUNDREDTHS, Math.round(Number(delaysHundredths[idx]) || MIN_DELAY_HUNDREDTHS));
        buf.writeUInt16LE(Math.min(d, 0xFFFF), off);
        // GCE packed byte sits just before the delay; disposal is bits 2-4.
        if (opts.disposal != null) buf[off - 1] = (buf[off - 1] & ~0x1C) | ((opts.disposal & 0x07) << 2);
    });
    return buf;
}

/**
 * A GIF card's `pixelDimensions`: the size of the BUILT `.gif`, measured after
 * `buildGif()` wrote it — never the frame store's.
 *
 * The two differ more often than it looks. `buildGif`'s scale filter caps the
 * long edge at `output.maxEdge` and leaves the other at `-2`, so it is also
 * forced to an even number: 1536x640 frames with maxEdge 1024 build a 1024x426
 * file, and 405x723 frames with nothing capped build a 406x723 one. Stamping
 * the frames' size made a card advertise a file that does not exist — Fabio set
 * longest edge to 1024, got a 1024x426 `.gif`, and read `1536x640` on its card
 * (MPI-844). Every route that writes a GIF card measures through here.
 *
 * @param {string} absPath the built `.gif`
 * @returns {Promise<{w: number, h: number}>}
 */
async function builtGifDimensions(absPath) {
    const { width, height } = await sharp(absPath).metadata();
    return { w: width || 0, h: height || 0 };
}

/**
 * Build a `.gif` from a frame list: two-pass palette (as `routes/videoGif.js`),
 * one GIF frame per list entry at a constant rate, then patch every delay.
 *
 * @param {{frames: {hash:string, delay:number}[], loop?: number, output?: {maxEdge?: number, colours?: number, edgeColour?: string|null}}} entry
 * @param {string} mediaDir   project Media dir (frames resolve under `.gif-frames` here)
 * @param {string} outAbsPath destination `.gif` path (caller picks the sequenced name)
 */
async function buildGif(entry, mediaDir, outAbsPath) {
    const frames = entry?.frames;
    if (!Array.isArray(frames) || !frames.length) {
        throw new Error('gif build requires at least one frame');
    }
    for (const f of frames) {
        if (!f?.hash || !(await frameExists(mediaDir, f.hash))) {
            throw new Error(`gif build: frame ${f?.hash} not found in the store`);
        }
    }

    const maxEdge = entry.output?.maxEdge > 0 ? entry.output.maxEdge : DEFAULT_MAX_EDGE;
    const colours = Number.isFinite(entry.output?.colours) && entry.output.colours > 0 ? Math.round(entry.output.colours) : 256;
    const edgeColour = entry.output?.edgeColour || null;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gif-build-'));
    try {
        for (let i = 0; i < frames.length; i++) {
            const srcAbs = frameAbsPath(mediaDir, frames[i].hash);
            let buf = await fs.readFile(srcAbs);
            // Opaque build: composite onto a real background. Left in, the alpha
            // reaches palettegen (which reserves a transparent entry by default)
            // and every transparent pixel shows the PREVIOUS frame through it.
            buf = edgeColour
                ? await blendEdgeColour(buf, edgeColour)
                : await sharp(buf).flatten({ background: OPAQUE_BACKGROUND }).png().toBuffer();
            await fs.writeFile(path.join(tmpDir, `f_${String(i).padStart(5, '0')}.png`), buf);
        }
        const listPath = path.join(tmpDir, 'list.txt');
        const listLines = frames.map((_, i) => `file 'f_${String(i).padStart(5, '0')}.png'`);
        await fs.writeFile(listPath, listLines.join('\n') + '\n');

        const rawLoop = totalPlaysToRawLoop(entry.loop);
        // Fit within a maxEdge x maxEdge box, aspect preserved, never upscaled:
        // the longer side is capped at maxEdge (min(dim,maxEdge)); the other
        // side gets `-2` (auto, even) so ffmpeg derives it from the aspect ratio.
        const scaleFilter = `scale='if(gt(iw\\,ih),min(iw\\,${maxEdge}),-2)':'if(gt(iw\\,ih),-2,min(ih\\,${maxEdge}))':flags=lanczos`;
        const paletteFlags = `reserve_transparent=${edgeColour ? 1 : 0}:max_colors=${colours}`;
        const preFilter = edgeColour ? `format=rgba,${scaleFilter}` : scaleFilter;
        const filterComplex = `[0:v] ${preFilter},split [a][b];[a] palettegen=${paletteFlags} [p];[b][p] paletteuse`;

        const naivePath = path.join(tmpDir, 'naive.gif');
        await execFileP(ffmpegPath, [
            '-y', '-r', String(BUILD_FPS), '-f', 'concat', '-safe', '0', '-i', listPath,
            '-filter_complex', filterComplex,
            // Transparent build: every frame is a full, independent picture that
            // clears before the next (disposal 2, patched below). The encoder's
            // default offsetting+transdiff write only the changed pixels and lean
            // on the previous frame staying put, which disposal 2 wipes.
            ...(edgeColour ? ['-gifflags', '-offsetting-transdiff'] : []),
            '-loop', String(rawLoop),
            naivePath,
        ], { cwd: tmpDir, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

        const naiveBuf = await fs.readFile(naivePath);
        const delays = frames.map(f => Math.max(MIN_DELAY_HUNDREDTHS, Math.round(Number(f.delay) || MIN_DELAY_HUNDREDTHS)));
        const patched = patchGifDelays(naiveBuf, delays, edgeColour ? { disposal: 2 } : {});

        await fs.ensureDir(path.dirname(outAbsPath));
        await fs.writeFile(outAbsPath, patched);
    } finally {
        await fs.remove(tmpDir).catch(() => {});
    }
}

/* ---------------------------------------------------------------------------
 * Copy (E4 — add-from-cards)
 * ------------------------------------------------------------------------ */

/**
 * Copy every frame (+ thumbnail) a `gif` field references into ANOTHER
 * project's store. Content-addressed on both ends, so a hash already present at
 * the destination is left alone — this is the `splatPath`-copy precedent
 * (routes/projects.js add-from-cards) applied to a store instead of one file.
 */
async function copyGifFrames(srcMediaDir, destMediaDir, gifField) {
    const frames = gifField?.frames;
    if (!Array.isArray(frames) || !frames.length) return;
    await fs.ensureDir(framesDir(destMediaDir));
    const seen = new Set();
    for (const f of frames) {
        const hash = f?.hash;
        if (!hash || seen.has(hash)) continue;
        seen.add(hash);
        const srcPng = frameAbsPath(srcMediaDir, hash);
        const destPng = frameAbsPath(destMediaDir, hash);
        if (await fs.pathExists(srcPng) && !(await fs.pathExists(destPng))) {
            await fs.copy(srcPng, destPng);
        }
        const srcThumb = frameThumbAbsPath(srcMediaDir, hash);
        const destThumb = frameThumbAbsPath(destMediaDir, hash);
        if (await fs.pathExists(srcThumb) && !(await fs.pathExists(destThumb))) {
            await fs.copy(srcThumb, destThumb);
        }
    }
}

/* ---------------------------------------------------------------------------
 * Sweep (E4)
 * ------------------------------------------------------------------------ */

/**
 * Delete every stored frame no sidecar in this project references any more.
 * Reads EVERY sidecar under `Media/.meta/` — archived cards included, because
 * archiving is a `project.json` flag flip that never touches the sidecar file
 * on disk (docs/gallery.md § Retention), so an archived reference survives this
 * exactly like a visible one. Cheap no-op for a project that never had a GIF:
 * bails before listing a single sidecar.
 */
async function sweepGifFrames(mediaDir) {
    const dir = framesDir(mediaDir);
    if (!(await fs.pathExists(dir))) return { removed: 0 };

    const metaDir = path.join(mediaDir, '.meta');
    const referenced = new Set();
    if (await fs.pathExists(metaDir)) {
        const files = (await fs.readdir(metaDir)).filter(f => f.endsWith('.json'));
        for (const f of files) {
            let meta;
            try { meta = await fs.readJson(path.join(metaDir, f)); } catch { continue; }
            const frames = meta?.gif?.frames;
            if (Array.isArray(frames)) {
                for (const fr of frames) if (fr?.hash) referenced.add(fr.hash);
            }
        }
    }

    const entries = await fs.readdir(dir);
    let removed = 0;
    for (const name of entries) {
        const m = /^([0-9a-f]{64})\.(png|thumb\.jpg|thumb\.webp|thumb\.\d+\.webp)$/i.exec(name);
        if (!m) continue;
        if (referenced.has(m[1])) continue;
        try { await fs.remove(path.join(dir, name)); removed++; } catch (_) { /* best-effort GC */ }
    }
    return { removed };
}

module.exports = {
    FRAMES_DIRNAME,
    FRAME_THUMB_PX,
    MIN_DELAY_HUNDREDTHS,
    DEFAULT_MAX_EDGE,
    framesDir,
    frameAbsPath,
    frameThumbAbsPath,
    hashBuffer,
    totalPlaysToRawLoop,
    frameExists,
    builtGifDimensions,
    writeFrame,
    extractFramesFromGif,
    buildGif,
    patchGifDelays,
    blendEdgeColour,
    copyGifFrames,
    sweepGifFrames,
};
