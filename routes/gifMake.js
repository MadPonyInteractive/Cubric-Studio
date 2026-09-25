'use strict';

/**
 * routes/gifMake.js — MPI-770: POST /gif/make — build a GIF card from a gallery
 * selection of still images.
 *
 * Own route file per the MPI-757 plan's E3 (every later GIF feature gets its
 * own file, batch workers never share one). Writes frames via
 * `services/gifFrames.js` and calls `buildGif()` directly — it does NOT route
 * through `POST /gif/entry` (docs/gif.md § What builds on this).
 *
 * Body: { folderPath: string, itemIds: string[] }  — itemIds in FRAME ORDER
 *   (the gallery's click order, docs/gallery-selection.md), >= 2 entries.
 * Response: { success, item }
 *   `item` is a plain sidecar-shaped object ({ id, filePath, thumbPath,
 *   operation, displayName, pixelDimensions, gif }) — the SAME
 *   raw-descriptor shape `/combine-videos` returns. The caller
 *   (MpiGalleryBlock.js) builds the ItemGroup client-side via createImageItem
 *   + createItemGroup + appendToHistory + addGroup, exactly like the
 *   `grid.on('combine')` handler does for `/combine-videos`. This route
 *   writes the new item's OWN sidecar (`.meta/<id>.json`) to disk (same
 *   precedent as `routes/videoConcat.js`'s `_writeOutputSidecar`) but never
 *   touches `project.json` — the client's `addGroup()` owns that write.
 *
 * Sizing: the FIRST item's full-res pixel size is the canvas, shrunk to fit
 * FRAME_MAX_EDGE when bigger (a 16K photo, MPI-925). Every item
 * (including the first) is resized `fit: 'contain'` into that canvas with
 * PADDING PIXELS EXACTLY RGBA(0,0,0,0) — `background: { r:0, g:0, b:0,
 * alpha:0 }` guarantees this; no source pixel can leak into the padding
 * region under `contain` (unlike `cover`, which crops and can bleed the
 * wrong region in a bugged pipeline — memory/tools/sharp.md trap 3).
 * `.ensureAlpha()` after resize guarantees every stored frame is a 4-channel
 * RGBA PNG, matching the frames-store contract in docs/gif.md.
 *
 * The entry is built with `output.edgeColour: null` (plan Decision 8, Make GIF
 * asks no prompt), so `buildGif()` flattens the padding onto black in the
 * built `.gif`. The stored frames keep it transparent (docs/gif.md § Opaque
 * output).
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const logger = require('./logger');
const { writeFrame, buildGif, builtGifDimensions } = require('../services/gifFrames');
const { extractImageThumb, imageThumbPath, IMAGE_RENDITION_PX } = require('../services/ffmpegThumb');
const { nextSequence } = require('./projects');

// Make GIF's fixed default (no prompt, plan Decision 8): each still holds 1 s.
// 10 fps flashed a slideshow of unrelated images (Fabio, 2026-09-16).
const DELAY_HUNDREDTHS = 100;

// The largest .gif the builder makes (js/utils/gifTiming.js MAX_EDGE), so a frame
// past it buys nothing. A 16K still (268 MP) stored as-is also fails every later
// ffmpeg pass: "Picture size 16384x16384 is invalid" (MPI-925).
const FRAME_MAX_EDGE = 4096;

function _resolveAbsPath(rawFilePath) {
    const raw = String(rawFilePath || '');
    if (!raw) return null;
    if (raw.includes('project-file?path=')) {
        try {
            const u = new URL(raw, 'http://localhost');
            return decodeURIComponent(u.searchParams.get('path') || '');
        } catch { return null; }
    }
    return path.isAbsolute(raw) ? raw : null;
}

/** Still image, not a GIF, not a 3D Scene — the same eligibility the gallery
 * context menu enforces client-side (js/utils/assetKinds.js `kindOfItem`'s
 * `image` row), re-checked here at the trust boundary. */
function _isEligibleStillImage(sidecar) {
    if (!sidecar || sidecar.type !== 'image') return false;
    if (sidecar.splatPath) return false; // 3D Scene
    if (sidecar.gif) return false;
    if (/\.gif$/i.test(sidecar.filePath || '')) return false; // legacy .gif import
    return true;
}

router.post('/gif/make', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, itemIds } = req.body || {};
        if (!folderPath) return res.status(400).json({ success: false, error: 'folderPath required' });
        if (!Array.isArray(itemIds) || itemIds.length < 2) {
            return res.status(400).json({ success: false, error: 'itemIds[] with >=2 entries required' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir = path.join(mediaDir, '.meta');
        if (!(await fs.pathExists(metaDir))) {
            return res.status(404).json({ success: false, error: '.meta directory missing' });
        }

        // Resolve + validate every source in the given order — frame order IS
        // selection order, so this array must never be re-sorted.
        const sources = [];
        for (const id of itemIds) {
            const metaPath = path.join(metaDir, `${id}.json`);
            if (!(await fs.pathExists(metaPath))) {
                return res.status(404).json({ success: false, error: `sidecar not found: ${id}` });
            }
            const sidecar = await fs.readJson(metaPath);
            if (!_isEligibleStillImage(sidecar)) {
                return res.status(400).json({ success: false, error: `item ${id} is not an eligible still image` });
            }
            const abs = _resolveAbsPath(sidecar.filePath);
            if (!abs || !(await fs.pathExists(abs))) {
                return res.status(404).json({ success: false, error: `source file missing for item ${id}` });
            }
            sources.push(abs);
        }

        // limitInputPixels: false — photographers load 16K stills, past sharp's 268 MP default.
        const firstMeta = await sharp(sources[0], { limitInputPixels: false }).metadata();
        const scale = Math.min(1, FRAME_MAX_EDGE / Math.max(firstMeta.width || 0, firstMeta.height || 0));
        const targetW = Math.round(firstMeta.width * scale);
        const targetH = Math.round(firstMeta.height * scale);
        if (!targetW || !targetH) {
            return res.status(500).json({ success: false, error: 'could not read the first image\'s dimensions' });
        }

        const frames = [];
        for (const abs of sources) {
            const buf = await sharp(abs, { limitInputPixels: false })
                .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .ensureAlpha()
                .png()
                .toBuffer();
            const { hash } = await writeFrame(mediaDir, buf);
            frames.push({ hash, delay: DELAY_HUNDREDTHS });
        }

        const gifEntry = {
            frames,
            loop: 0, // plan Decision 8 — loop forever
            output: { maxEdge: 1024, colours: 256, edgeColour: null },
        };

        const finalName = await nextSequence(folderPath, mediaDir, 'gif', 'gif');
        outputPath = path.join(mediaDir, finalName);
        await buildGif(gifEntry, mediaDir, outputPath);

        const id = uuidv4();
        const _mtime = (await fs.stat(outputPath).catch(() => null))?.mtimeMs || 0;
        const filePathUrl = `/project-file?path=${encodeURIComponent(outputPath)}&v=${Math.round(_mtime)}`;
        const meta = {
            id,
            type: 'image',
            filePath: filePathUrl,
            operation: 'gif-make',
            displayName: finalName.replace(/\.[^.]+$/, ''),
            prompt: '',
            negativePrompt: '',
            seed: -1,
            modelId: null,
            createdAt: new Date().toISOString(),
            name: null,
            uploaded: false,
            pixelDimensions: await builtGifDimensions(outputPath),
            generationMs: null,
            gif: gifEntry,
        };
        await extractImageThumb(outputPath, path.join(metaDir, `${id}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small });
        meta.thumbPath = `/project-file?path=${encodeURIComponent(imageThumbPath(path.join(metaDir, `${id}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small }))}`;
        await fs.writeJson(path.join(metaDir, `${id}.json`), meta, { spaces: 2 });

        res.json({ success: true, item: { ...meta } });
    } catch (err) {
        logger.error('project', 'gif/make failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
