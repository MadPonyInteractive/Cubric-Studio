'use strict';

/**
 * routes/gifMaker.js — MPI-760: POST /gif/maker — "GIF Maker" (formerly "Export
 * GIF"). Build a new GIF card from a video item's clip: full-resolution frames
 * at a chosen fps within an optional trim window, built into a `.gif` at a
 * size preset.
 *
 * Own route file per the MPI-757 plan's E3 (every later GIF feature gets its
 * own file, batch workers never share one). Writes frames via
 * `services/gifFrames.js` and calls `buildGif()` directly — it does NOT route
 * through `POST /gif/entry` (docs/gif.md § What builds on this, same
 * precedent as `routes/gifMake.js`).
 *
 * `routes/videoGif.js` (`POST /api/video/gif`) stays as the PREVIEW encoder
 * (temp file, no card, no frames store) — this route is the "Apply" path that
 * lands a real card, so it shares its body shape (`sourcePath`, `fps`,
 * `sizePreset`, `loop`, `trimIn`, `trimOut`) but adds `folderPath` because it
 * writes into the project.
 *
 * Body: {
 *   folderPath: string,
 *   sourcePath: string   (absolute file path OR /project-file?path=... URL —
 *                         a video item's `filePath`, already the full-res file),
 *   fps:        number   (1-60, same bound as MpiToolOptionsGif's fps input),
 *   sizePreset: string   (optional, default 'original' — one of 'original' |
 *                         '480xauto' | '320xauto' | 'autox480' | 'autox320',
 *                         the exact enum MpiToolOptionsGif / videoGif.js use),
 *   loop:       number   (optional, default 0 — TOTAL plays, 0 = forever,
 *                         same unit as gifFrames.js / videoGif.js's body field),
 *   trimIn:     number   (optional — clip-seconds; trimOut required with it),
 *   trimOut:    number   (optional — clip-seconds; trimIn required with it),
 * }
 * Response: { success, item } — `item` is a plain sidecar-shaped object
 *   ({ id, filePath, thumbPath, operation, displayName, pixelDimensions, gif}),
 *   the SAME raw-descriptor shape `routes/gifMake.js` / `/combine-videos`
 *   return (plan Decision 13 — a NEW GIF card, never a video-history entry).
 *   The caller builds the ItemGroup client-side via createImageItem +
 *   createItemGroup + appendToHistory + addGroup, the `_handleCropSnapshot`
 *   pattern in `MpiGroupHistoryBlock.js`. This route writes the new item's OWN
 *   sidecar (`.meta/<id>.json`) but never touches `project.json` — the
 *   client's `addGroup()` owns that write.
 *
 * Sizing: frames are extracted and stored at the SOURCE clip's full
 * resolution — no scale filter runs during extraction. Only the BUILT `.gif`
 * is resized, via `buildGif()`'s `output.maxEdge` (a single longest-edge BOX
 * fit, never upscales). The panel / `videoGif.js` presets instead name a
 * WIDTH or a HEIGHT ('480xauto' = width 480 regardless of orientation,
 * 'autox480' = height 480), so a preset's number cannot be handed to
 * `maxEdge` directly — see `_maxEdgeForPreset` for the derivation that makes
 * the box land on the NAMED axis. `'original'` maps to the extracted frame's
 * own longest edge, i.e. no cap — matching `videoGif.js`'s `'original'` (no
 * scale filter at all). Because `buildGif()` never upscales, a clip already
 * smaller than a preset's target on its named axis is left at its own size
 * (same "never upscale" behaviour `videoGif.js`'s scale filters have).
 *
 * Validation is a hard reject, never a silent clamp (unlike `videoGif.js`'s
 * own `Math.max(1, Math.min(60, ...))` fps handling) — a caller sending a bad
 * value gets a clear 400, not a quietly-adjusted result.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const logger = require('./logger');
const { writeFrame, buildGif, MIN_DELAY_HUNDREDTHS } = require('../services/gifFrames');
const { extractImageThumb, imageThumbPath, IMAGE_RENDITION_PX } = require('../services/ffmpegThumb');
const { ffmpegPath } = require('../services/ffmpegBinary');
const { nextSequence } = require('./projects');

const execFileP = promisify(execFile);

// Same enum MpiToolOptionsGif's dropdown and videoGif.js's SCALE_FILTERS use.
// Each entry names which axis the preset FIXES and to what value — 'NxAuto'
// fixes width, 'autoxN' fixes height — matching videoGif.js's
// `scale=480:-2` (width) vs `scale=-2:480` (height) exactly. 'original' is
// resolved per-request from the extracted frame's own dimensions (see
// _maxEdgeForPreset) so it means "no cap", not gifFrames' 1024 default.
const SIZE_PRESET_FIXED_AXIS = {
    '480xauto': { axis: 'width', value: 480 },
    '320xauto': { axis: 'width', value: 320 },
    'autox480': { axis: 'height', value: 480 },
    'autox320': { axis: 'height', value: 320 },
};
const VALID_SIZE_PRESETS = new Set(['original', ...Object.keys(SIZE_PRESET_FIXED_AXIS)]);

const MIN_FPS = 1;
const MAX_FPS = 60; // matches MpiToolOptionsGif's fps MpiInput bound
const MAX_LOOP = 999; // matches MpiToolOptionsGif's loop MpiInput bound

function _resolveSourcePath(raw) {
    const str = String(raw || '');
    if (!str) return '';
    if (str.includes('project-file?path=')) {
        try {
            const u = new URL(str, 'http://localhost');
            return decodeURIComponent(u.searchParams.get('path') || '');
        } catch { return ''; }
    }
    return str;
}

/**
 * `buildGif()` only takes one longest-edge box (`output.maxEdge`), but a
 * preset names a WIDTH or a HEIGHT, not a box. Reproduce the named-axis
 * result by deriving, from the frame's own aspect ratio, the box size that
 * makes the CONSTRAINED edge (whichever `buildGif`'s `if(gt(iw,ih),...)`
 * filter caps) land the OTHER edge exactly on the preset's value:
 *
 * - 'NxAuto' (fix width=N): if maxEdge caps height at round(H*N/W), width
 *   comes out to W*(round(H*N/W)/H) ≈ N regardless of which edge is longer.
 * - 'autoxN' (fix height=N): symmetric — cap width at round(W*N/H).
 *
 * `max(N, ...)` only ever raises the cap when the frame is oriented so its
 * OWN aspect would already put the named axis under N without constraining
 * the other edge at all (buildGif's `min(iw,maxEdge)` no-ops once maxEdge
 * exceeds the frame's own longer edge) — it never lowers the preset's value.
 */
function _maxEdgeForPreset(sizePreset, frameW, frameH) {
    if (sizePreset === 'original') return Math.max(frameW, frameH);
    const preset = SIZE_PRESET_FIXED_AXIS[sizePreset];
    return preset.axis === 'width'
        ? Math.max(preset.value, Math.round(frameH * preset.value / frameW))
        : Math.max(preset.value, Math.round(frameW * preset.value / frameH));
}

/**
 * Extract one full-resolution RGBA PNG per output frame at a constant `fps`,
 * optionally restricted to `[trim.in, trim.out)` (clip-seconds), and write
 * each straight into the content-addressed frame store. Trim is applied as an
 * INPUT-side `-ss`/`-to` (before `-i`) — the exact mechanism `videoGif.js`
 * already uses ("Trim BEFORE -i for fast input-seek (keyframe-accurate is
 * fine for GIF)"), so GIF Maker's trim behaves identically to the preview
 * encoder's.
 */
async function _extractFramesAtFps(mediaDir, sourceAbsPath, fps, trim) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gif-maker-extract-'));
    try {
        const pattern = path.join(tmpDir, 'f_%05d.png');
        const args = ['-y'];
        if (trim) args.push('-ss', String(trim.in), '-to', String(trim.out));
        args.push('-i', sourceAbsPath, '-vf', `fps=${fps}`, '-pix_fmt', 'rgba', pattern);
        await execFileP(ffmpegPath, args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

        const files = (await fs.readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
        if (!files.length) {
            throw new Error(`gif-maker: ffmpeg produced no frames from ${sourceAbsPath} at ${fps}fps`);
        }

        // fps -> delay is exact (100/fps hundredths); the floor only ever bites
        // above 50fps (100/50=2), so this is a real clamp, not dead code.
        const delay = Math.max(MIN_DELAY_HUNDREDTHS, Math.round(100 / fps));
        const frames = [];
        for (const f of files) {
            const buf = await fs.readFile(path.join(tmpDir, f));
            const { hash } = await writeFrame(mediaDir, buf);
            frames.push({ hash, delay });
        }
        const firstMeta = await sharp(path.join(tmpDir, files[0])).metadata();
        return { frames, width: firstMeta.width, height: firstMeta.height };
    } finally {
        await fs.remove(tmpDir).catch(() => {});
    }
}

router.post('/gif/maker', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, sourcePath, sizePreset: rawSizePreset, loop: rawLoop, trimIn: rawTrimIn, trimOut: rawTrimOut } = req.body || {};

        if (!folderPath) return res.status(400).json({ success: false, error: 'folderPath required' });
        if (!sourcePath) return res.status(400).json({ success: false, error: 'sourcePath required' });

        const fps = Number(req.body?.fps);
        if (!Number.isFinite(fps) || fps < MIN_FPS || fps > MAX_FPS) {
            return res.status(400).json({ success: false, error: `fps must be a number between ${MIN_FPS} and ${MAX_FPS}` });
        }

        const sizePreset = rawSizePreset === undefined || rawSizePreset === null ? 'original' : rawSizePreset;
        if (!VALID_SIZE_PRESETS.has(sizePreset)) {
            return res.status(400).json({ success: false, error: `sizePreset must be one of ${[...VALID_SIZE_PRESETS].join(', ')}` });
        }

        let loop = 0;
        if (rawLoop !== undefined && rawLoop !== null) {
            const n = Number(rawLoop);
            if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_LOOP) {
                return res.status(400).json({ success: false, error: `loop must be an integer between 0 and ${MAX_LOOP} (total plays; 0 = forever)` });
            }
            loop = n;
        }

        const hasTrimIn = rawTrimIn !== undefined && rawTrimIn !== null;
        const hasTrimOut = rawTrimOut !== undefined && rawTrimOut !== null;
        let trim = null;
        if (hasTrimIn || hasTrimOut) {
            const tIn = Number(rawTrimIn);
            const tOut = Number(rawTrimOut);
            if (!Number.isFinite(tIn) || !Number.isFinite(tOut) || tIn < 0 || tOut <= tIn) {
                return res.status(400).json({ success: false, error: 'trimIn/trimOut must both be given, finite, with trimOut > trimIn >= 0' });
            }
            trim = { in: tIn, out: tOut };
        }

        const inputPath = _resolveSourcePath(sourcePath);
        if (!inputPath || !(await fs.pathExists(inputPath))) {
            return res.status(404).json({ success: false, error: `source video not found: ${inputPath || sourcePath}` });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir = path.join(mediaDir, '.meta');
        if (!(await fs.pathExists(metaDir))) {
            return res.status(404).json({ success: false, error: '.meta directory missing' });
        }

        const { frames, width, height } = await _extractFramesAtFps(mediaDir, inputPath, fps, trim);

        const gifEntry = {
            frames,
            loop,
            output: { maxEdge: _maxEdgeForPreset(sizePreset, width, height), colours: 256, edgeColour: null },
        };

        const finalName = await nextSequence(folderPath, mediaDir, 'gif', 'gif');
        outputPath = path.join(mediaDir, finalName);
        await buildGif(gifEntry, mediaDir, outputPath);

        const builtMeta = await sharp(outputPath).metadata();
        const id = uuidv4();
        const _mtime = (await fs.stat(outputPath).catch(() => null))?.mtimeMs || 0;
        const filePathUrl = `/project-file?path=${encodeURIComponent(outputPath)}&v=${Math.round(_mtime)}`;
        const meta = {
            id,
            type: 'image',
            filePath: filePathUrl,
            operation: 'gif-maker',
            displayName: finalName.replace(/\.[^.]+$/, ''),
            prompt: '',
            negativePrompt: '',
            seed: -1,
            modelId: null,
            createdAt: new Date().toISOString(),
            name: null,
            uploaded: false,
            pixelDimensions: { w: builtMeta.width, h: builtMeta.height },
            generationMs: null,
            gif: gifEntry,
        };
        await extractImageThumb(outputPath, path.join(metaDir, `${id}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small });
        meta.thumbPath = `/project-file?path=${encodeURIComponent(imageThumbPath(path.join(metaDir, `${id}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small }))}`;
        await fs.writeJson(path.join(metaDir, `${id}.json`), meta, { spaces: 2 });

        res.json({ success: true, item: { ...meta } });
    } catch (err) {
        logger.error('project', 'gif/maker failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
