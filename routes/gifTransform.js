'use strict';

/**
 * routes/gifTransform.js — MPI-773 (server half): POST /gif/crop, POST /gif/resize.
 *
 * Own route file per the MPI-757 plan's E3 (every later GIF feature gets its
 * own file, batch workers never share one) — sibling of `routes/gifMake.js`
 * and `routes/gifCutout.js`, whose shape, validation and sidecar handling
 * this copies. Both routes: existing frame list -> ONE transform applied to
 * EVERY frame -> new full-colour frames written through
 * `services/gifFrames.js` -> a brand-new GIF card (mode 'new' — same
 * precedent as `routes/gifCutout.js`'s `/gif-cutout/apply`, NOT a proxy
 * through `routes/gif.js`'s `POST /gif/entry`, per docs/gif.md § What builds
 * on this). Delays and loop are carried through unchanged — cropping/
 * resizing touches pixels, never timing.
 *
 * Crop rectangle shape — read from docs/crop.md and `POST /project/crop-media`
 * (routes/projects.js:2483), the existing image crop tool's own route, so a
 * later UI half (`MpiToolOptionsCrop` reuse) can call this with NO translation
 * layer:
 *   x, y  — rect origin in image-space pixels (integers, MAY BE NEGATIVE —
 *           `CropManager.getCropRect()` lets the box drag off any edge)
 *   w, h  — rect size in image-space pixels (integers, > 0)
 *   fill  — optional '#rrggbb' for pixels the rect selects outside the
 *           frame; unparseable/omitted falls back to opaque black, the same
 *           default `services/imageCrop.js`'s `parseFill()` already uses.
 * The math itself is `services/imageCrop.js`'s `planExtendedCrop()` +
 * `parseFill()` (pad-then-extract, because Sharp's `.extract` throws on an
 * out-of-bounds rect) — reused here, not reimplemented, applied per frame
 * BUFFER instead of per file since frames live in the content-addressed
 * store, not as loose files a route can `.toFile()` over.
 *
 * Resize is NOT the crop tool's `resolution` family (which locks W/H and
 * never changes the crop rect) — it is its own tool (plan Decision 3): one
 * target size, every frame resampled to it exactly (`fit: 'fill'`, matching
 * `cropExtended`'s own resample step for the `resolution` crop family).
 *
 * Body (both routes): {
 *   folderPath, frames: [{hash, delay}] (current entry's frame list, order
 *     preserved), loop?, output? (current entry's loop/output — carried
 *     through unchanged into the new entry, this route does not know or
 *     touch them beyond that), sourceItemId?, sourceGroupId?,
 * }
 * POST /gif/crop adds:   x, y, w, h, fill?, outW?, outH? (both or neither: the
 *                        RESOLUTION family resamples the cut to exactly that
 *                        size, as `POST /project/crop-media` does — MPI-773 UI)
 * POST /gif/resize adds: width, height
 * Response (both): { success: true, item, group } — `item` is an image
 * sidecar carrying a `gif` field (docs/gif.md data model), `group` wraps it
 * as a single-item ItemGroup, same shape `routes/gifCutout.js` returns.
 *
 * Validation at the boundary (root-cause rule: fail loudly, never a silent
 * cap): every `frames[].hash` must already exist in the store (400
 * otherwise); a crop rect needs finite x/y and a positive w/h; a resize
 * needs a positive integer width/height. Neither route ever clamps a bad
 * value to a default — it rejects.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const {
    frameAbsPath,
    frameExists,
    writeFrame,
    buildGif,
} = require('../services/gifFrames');
const { planExtendedCrop, parseFill } = require('../services/imageCrop');
const { extractImageThumb, imageThumbPath, IMAGE_RENDITION_PX } = require('../services/ffmpegThumb');
const { nextSequence } = require('./projects');

function projectFileUrl(filePath) {
    return `/project-file?path=${encodeURIComponent(filePath)}`;
}

/**
 * Pad (if the rect leaves the frame) then extract, on a Buffer — the same
 * two-pass `services/imageCrop.js`'s `cropExtended()` runs on disk, adapted
 * to operate in memory since a GIF frame is content-addressed, not a loose
 * file this route owns the name of. `ensureAlpha()` on the way out keeps the
 * result a 4-channel RGBA PNG, matching every other frame in the store.
 */
async function _cropFrameBuffer(buffer, { x, y, w, h, fill, outW, outH }) {
    const meta = await sharp(buffer).metadata();
    const plan = planExtendedCrop({ srcW: meta.width, srcH: meta.height, x, y, w, h });

    let pipeline;
    if (plan.extends) {
        const padded = await sharp(buffer)
            .ensureAlpha()
            .extend({ ...plan.extend, background: parseFill(fill) })
            .toBuffer();
        pipeline = sharp(padded).extract(plan.extract);
    } else {
        pipeline = sharp(buffer).extract(plan.extract);
    }
    // RESOLUTION crop family (docs/crop.md): the only one that resamples,
    // chained the way `cropExtended()` does it.
    if (outW) pipeline = pipeline.resize(outW, outH, { fit: 'fill' });
    return pipeline.ensureAlpha().png().toBuffer();
}

/**
 * Build the new GIF's frame list from `frames` by running `transformOne` over
 * each stored frame buffer, preserving each frame's own `delay` 1:1 by index
 * — crop/resize never changes frame count or timing, only pixels.
 */
async function _transformFrames(mediaDir, frames, transformOne) {
    const out = [];
    for (const f of frames) {
        const buf = await fs.readFile(frameAbsPath(mediaDir, f.hash));
        const transformed = await transformOne(buf);
        const { hash } = await writeFrame(mediaDir, transformed);
        out.push({ hash, delay: Number(f.delay) || 10 });
    }
    return out;
}

/**
 * Build the .gif, write its sidecar and thumb, and shape the `{item, group}`
 * response — the part `POST /gif/crop` and `POST /gif/resize` share, mirrors
 * `routes/gifCutout.js`'s `/gif-cutout/apply` tail exactly (same precedent).
 */
async function _writeNewGifCard({ folderPath, mediaDir, metaDir, newFrames, loop, output, pixelDimensions, operation, sourceItemId, sourceGroupId }) {
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
    const outputPath = path.join(mediaDir, finalName);
    await buildGif(gifEntry, mediaDir, outputPath);

    const id = uuidv4();
    const meta = {
        id,
        type: 'image',
        filePath: projectFileUrl(outputPath),
        operation,
        displayName: finalName.replace(/\.[^.]+$/, ''),
        prompt: '',
        negativePrompt: '',
        seed: -1,
        modelId: null,
        createdAt: new Date().toISOString(),
        name: null,
        uploaded: false,
        pixelDimensions,
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
        operation,
        createdAt: new Date().toISOString(),
        items: [item],
    };
    return { item, group, outputPath };
}

router.post('/gif/crop', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, frames, loop, output, x, y, w, h, fill, outW, outH, sourceItemId, sourceGroupId } = req.body || {};
        if (!folderPath || typeof folderPath !== 'string') {
            return res.status(400).json({ success: false, error: 'folderPath required' });
        }
        if (!Array.isArray(frames) || !frames.length) {
            return res.status(400).json({ success: false, error: 'frames required (non-empty array)' });
        }
        const rectX = Math.round(Number(x));
        const rectY = Math.round(Number(y));
        const rectW = Math.round(Number(w));
        const rectH = Math.round(Number(h));
        if (!Number.isFinite(rectX) || !Number.isFinite(rectY) || !(rectW > 0) || !(rectH > 0)) {
            return res.status(400).json({ success: false, error: 'crop requires finite x, y and positive w, h' });
        }
        const resample = outW != null || outH != null;
        const targetW = Math.round(Number(outW));
        const targetH = Math.round(Number(outH));
        if (resample && !(targetW > 0 && targetH > 0)) {
            return res.status(400).json({ success: false, error: 'outW and outH must both be positive' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir = path.join(mediaDir, '.meta');
        await fs.ensureDir(metaDir);

        for (const f of frames) {
            if (!f?.hash || !(await frameExists(mediaDir, f.hash))) {
                return res.status(400).json({ success: false, error: `unknown frame hash: ${f?.hash}` });
            }
        }

        const newFrames = await _transformFrames(mediaDir, frames, (buf) =>
            _cropFrameBuffer(buf, {
                x: rectX, y: rectY, w: rectW, h: rectH, fill,
                outW: resample ? targetW : null, outH: resample ? targetH : null,
            }));

        const result = await _writeNewGifCard({
            folderPath, mediaDir, metaDir, newFrames, loop, output,
            pixelDimensions: resample ? { w: targetW, h: targetH } : { w: rectW, h: rectH },
            operation: 'gifCrop',
            sourceItemId, sourceGroupId,
        });
        outputPath = result.outputPath;
        res.json({ success: true, item: result.item, group: result.group });
    } catch (err) {
        logger.error('project', 'gif crop failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch { /* best-effort */ } }
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/gif/resize', async (req, res) => {
    let outputPath = '';
    try {
        const { folderPath, frames, loop, output, width, height, sourceItemId, sourceGroupId } = req.body || {};
        if (!folderPath || typeof folderPath !== 'string') {
            return res.status(400).json({ success: false, error: 'folderPath required' });
        }
        if (!Array.isArray(frames) || !frames.length) {
            return res.status(400).json({ success: false, error: 'frames required (non-empty array)' });
        }
        const targetW = Math.round(Number(width));
        const targetH = Math.round(Number(height));
        if (!(targetW > 0) || !(targetH > 0)) {
            return res.status(400).json({ success: false, error: 'resize requires positive width and height' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir = path.join(mediaDir, '.meta');
        await fs.ensureDir(metaDir);

        for (const f of frames) {
            if (!f?.hash || !(await frameExists(mediaDir, f.hash))) {
                return res.status(400).json({ success: false, error: `unknown frame hash: ${f?.hash}` });
            }
        }

        const newFrames = await _transformFrames(mediaDir, frames, (buf) =>
            sharp(buf).resize(targetW, targetH, { fit: 'fill' }).ensureAlpha().png().toBuffer());

        const result = await _writeNewGifCard({
            folderPath, mediaDir, metaDir, newFrames, loop, output,
            pixelDimensions: { w: targetW, h: targetH },
            operation: 'gifResize',
            sourceItemId, sourceGroupId,
        });
        outputPath = result.outputPath;
        res.json({ success: true, item: result.item, group: result.group });
    } catch (err) {
        logger.error('project', 'gif resize failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch { /* best-effort */ } }
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
