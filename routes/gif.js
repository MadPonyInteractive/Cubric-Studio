'use strict';

/**
 * routes/gif.js — MPI-768: core GIF entry routes.
 *
 * The store, extraction, build and sweep logic all live in
 * services/gifFrames.js; this file is thin request/response plumbing, the same
 * split `routes/videoGif.js` / `routes/videoReverse.js` already use. Every LATER
 * GIF feature (Make GIF, cut-out, timing/output, transform, GIF Maker) gets its
 * OWN route file — see the MPI-757 plan's E3 — so batch workers never share one.
 *
 * Routes:
 *   POST /gif/ensure-frames  — lazily extract a legacy `.gif` item's frames
 *   POST /gif/entry          — write an entry from a frame list (mode: 'update' | 'new')
 *
 * Frame/thumbnail BYTES are served through the existing generic `/project-file`
 * route, exactly like every other media file in this app (`filePath`, `thumbPath`,
 * `splatPath`, …) — there is no second file-serving mechanism here. Both routes
 * below resolve each frame's ready `url`/`thumbUrl` in the response so a caller
 * never has to know the `.gif-frames` naming convention itself.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const {
    extractFramesFromGif,
    buildGif,
    frameExists,
    frameAbsPath,
    frameThumbAbsPath,
    sweepGifFrames,
} = require('../services/gifFrames');
const { extractImageThumb, imageThumbPath, IMAGE_RENDITION_PX } = require('../services/ffmpegThumb');
const { nextSequence } = require('./projects');

function projectFileUrl(filePath) {
    return `/project-file?path=${encodeURIComponent(filePath)}`;
}

function projectFileUrlBusted(filePath) {
    let mtime = 0;
    try { mtime = Math.round(fs.statSync(filePath).mtimeMs); } catch (_) { /* best-effort */ }
    return `/project-file?path=${encodeURIComponent(filePath)}&v=${mtime}`;
}

function pathFromProjectFileUrl(value) {
    const raw = String(value || '');
    if (!raw) return null;
    const match = raw.match(/[?&]path=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
    return path.isAbsolute(raw) ? raw : null;
}

/** Attach `url` / `thumbUrl` to every frame entry for the response only. */
function withFrameUrls(mediaDir, gifField) {
    if (!gifField) return gifField;
    return {
        ...gifField,
        frames: (gifField.frames || []).map(f => ({
            ...f,
            url: projectFileUrl(frameAbsPath(mediaDir, f.hash)),
            thumbUrl: projectFileUrl(frameThumbAbsPath(mediaDir, f.hash)),
        })),
    };
}

/**
 * POST /gif/ensure-frames
 * Body: { folderPath, itemId }
 * A legacy `.gif` item (imported before this feature, or before MPI-768 landed)
 * has no `gif` field yet. Extract now — first open in the workspace, or the
 * first tool that needs frames, calls this. A no-op (besides the URL mapping)
 * once the sidecar already carries `gif.frames`.
 */
router.post('/gif/ensure-frames', async (req, res) => {
    try {
        const { folderPath, itemId } = req.body || {};
        if (!folderPath || !itemId) {
            return res.status(400).json({ success: false, error: 'folderPath and itemId required' });
        }
        const mediaDir = path.join(folderPath, 'Media');
        const metaPath = path.join(mediaDir, '.meta', `${itemId}.json`);
        if (!(await fs.pathExists(metaPath))) {
            return res.status(404).json({ success: false, error: `sidecar not found: ${itemId}` });
        }
        const meta = await fs.readJson(metaPath);

        if (meta.gif && Array.isArray(meta.gif.frames) && meta.gif.frames.length) {
            return res.json({ success: true, gif: withFrameUrls(mediaDir, meta.gif) });
        }

        const gifAbsPath = pathFromProjectFileUrl(meta.filePath);
        if (!gifAbsPath || !(await fs.pathExists(gifAbsPath))) {
            return res.status(404).json({ success: false, error: `gif media file not found for ${itemId}` });
        }

        const gifField = await extractFramesFromGif(gifAbsPath, mediaDir);
        meta.gif = gifField;
        await fs.writeJson(metaPath, meta, { spaces: 2 });

        res.json({ success: true, gif: withFrameUrls(mediaDir, gifField) });
    } catch (err) {
        logger.error('project', 'gif ensure-frames failed', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /gif/entry
 * Body: {
 *   folderPath, mode: 'update' | 'new', itemId (required for 'update'),
 *   frames: [{ hash, delay }], loop, output: { maxEdge, colours, edgeColour },
 *   sourceItemId?, sourceGroupId?
 * }
 *
 * Builds the `.gif` from the given frame list (server-side — the body carries
 * only hashes + metadata, never bytes: a reorder/drop/retime touches zero frame
 * files, per plan Decision 7) and writes the sidecar.
 *
 * 'update' REWRITES the current item: same id, but E5 — Chromium caches decoded
 * image bytes per URL, so the `.gif` gets a NEW sequenced filename and the old
 * one is deleted once the new one lands. Runs the frame sweep afterward, since
 * an update can drop frames a rebuild no longer references.
 *
 * 'new' ADDS a fresh history item (a card's own "Apply") — new id, new file,
 * response shaped like `routes/videoReverse.js` ({ item, group }) so a caller
 * with no existing group can still use the response directly.
 */
router.post('/gif/entry', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, mode, itemId, frames, loop, output, sourceItemId, sourceGroupId } = req.body || {};
        if (!folderPath) return res.status(400).json({ success: false, error: 'folderPath required' });
        if (!['update', 'new'].includes(mode)) {
            return res.status(400).json({ success: false, error: "mode must be 'update' or 'new'" });
        }
        if (!Array.isArray(frames) || !frames.length) {
            return res.status(400).json({ success: false, error: 'frames required (non-empty array)' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir = path.join(mediaDir, '.meta');
        await fs.ensureDir(metaDir);

        for (const f of frames) {
            if (!f?.hash || !(await frameExists(mediaDir, f.hash))) {
                return res.status(400).json({ success: false, error: `unknown frame hash: ${f?.hash}` });
            }
        }

        const gifEntry = {
            frames: frames.map(f => ({ hash: f.hash, delay: Number(f.delay) || 10 })),
            loop: Number.isFinite(Number(loop)) ? Number(loop) : 0,
            output: {
                maxEdge: Number(output?.maxEdge) > 0 ? Number(output.maxEdge) : 1024,
                colours: Number.isFinite(Number(output?.colours)) ? Number(output.colours) : 256,
                edgeColour: output?.edgeColour || null,
            },
        };

        if (mode === 'update') {
            if (!itemId) return res.status(400).json({ success: false, error: 'itemId required for update' });
            const metaPath = path.join(metaDir, `${itemId}.json`);
            if (!(await fs.pathExists(metaPath))) {
                return res.status(404).json({ success: false, error: `sidecar not found: ${itemId}` });
            }
            const meta = await fs.readJson(metaPath);
            const prevAbsPath = pathFromProjectFileUrl(meta.filePath);

            const finalName = await nextSequence(folderPath, mediaDir, 'gif', 'gif');
            outputPath = path.join(mediaDir, finalName);
            await buildGif(gifEntry, mediaDir, outputPath);

            meta.filePath = projectFileUrlBusted(outputPath);
            meta.displayName = finalName.replace(/\.[^.]+$/, '');
            meta.gif = gifEntry;
            await extractImageThumb(outputPath, path.join(metaDir, `${itemId}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small });
            meta.thumbPath = projectFileUrl(imageThumbPath(path.join(metaDir, `${itemId}.thumb.jpg`), { width: IMAGE_RENDITION_PX.small }));
            await fs.writeJson(metaPath, meta, { spaces: 2 });

            // E5 — never leave the previous `.gif` under the old URL on disk.
            if (prevAbsPath && path.normalize(prevAbsPath) !== path.normalize(outputPath)) {
                await fs.remove(prevAbsPath).catch(() => {});
            }
            await sweepGifFrames(mediaDir);

            return res.json({ success: true, item: { ...meta } });
        }

        // mode === 'new'
        const finalName = await nextSequence(folderPath, mediaDir, 'gif', 'gif');
        outputPath = path.join(mediaDir, finalName);
        await buildGif(gifEntry, mediaDir, outputPath);

        const id = uuidv4();
        const meta = {
            id,
            type: 'image',
            filePath: projectFileUrlBusted(outputPath),
            operation: 'gif',
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
            operation: 'gif',
            createdAt: new Date().toISOString(),
            items: [item],
        };
        res.json({ success: true, item, group });
    } catch (err) {
        logger.error('project', 'gif entry failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
