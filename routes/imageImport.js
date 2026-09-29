'use strict';

/**
 * routes/imageImport.js — MPI-943: shrink a very large photo on its way in.
 *
 * A 16K photo imports fine and then breaks everything after it: ComfyUI loads an image
 * as float32, so 16384x16384 is a ~3.2 GB tensor before any model runs, and masking a
 * canvas that size crawls. The import dialog (`prepareImageImport` in
 * js/services/mediaUploadService.js) asks once per drop; these two routes do the pixel
 * work, because the renderer cannot hold a 16K image reliably and sharp can.
 *
 *   POST /image-import/probe   { paths: string[] }          → { success, sizes: [{w,h}|null] }
 *   POST /image-import/reduce  { sourcePath, maxPixels }    → { success, path, w, h }
 *
 * `probe` reads the file HEADER only (no decode), which is also why import got faster:
 * the renderer used to decode the whole 16K image just to learn its size.
 * `reduce` writes a copy to a temp dir and the caller imports THAT path through the
 * normal `/project-media/:id/upload` — the user's original is never touched.
 * Sizes are UPRIGHT (EXIF orientation applied), matching what the browser reports.
 */

const express = require('express');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const logger = require('./logger');

const router = express.Router();

const TMP_DIR = path.join(os.tmpdir(), 'cubric-image-import');
const TMP_MAX_AGE_MS = 60 * 60 * 1000;

// Everything else (TIFF, HEIC, BMP, AVIF...) lands as PNG: lossless, and TIFF/HEIC
// would not display in the app anyway.
const OUTPUT = {
    jpeg: { ext: '.jpg',  apply: s => s.jpeg({ quality: 95 }) },
    webp: { ext: '.webp', apply: s => s.webp({ quality: 95 }) },
    png:  { ext: '.png',  apply: s => s.png() },
};

/** Upright pixel size from the header. limitInputPixels off: a 16K photo is past sharp's 268 MP default. */
async function imageSize(file) {
    const m = await sharp(file, { limitInputPixels: false }).metadata();
    return (m.orientation || 1) >= 5 ? { w: m.height, h: m.width } : { w: m.width, h: m.height };
}

/** Write `src` scaled to at most `maxPixels` (aspect kept) into the temp dir. */
async function reduceImage(src, maxPixels) {
    const { w, h } = await imageSize(src);
    const scale = Math.sqrt(maxPixels / (w * h));
    if (!(scale < 1)) return { path: src, w, h };
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const { format } = await sharp(src, { limitInputPixels: false }).metadata();
    const out = OUTPUT[format] || OUTPUT.png;
    await fs.ensureDir(TMP_DIR);
    const dest = path.join(TMP_DIR, `${crypto.randomUUID()}${out.ext}`);
    const img = sharp(src, { limitInputPixels: false }).autoOrient().resize(tw, th, { fit: 'fill' });
    const info = await out.apply(img).toFile(dest);
    return { path: dest, w: info.width, h: info.height };
}

/**
 * Turn a file that just entered a project upright, in place (MPI-959). Chromium and the
 * engine's loader honour EXIF orientation and sharp reads the stored grid, so a tag left
 * on disk makes every server reader cut the wrong pixels. After this there is nothing
 * left to turn. Only formats written back as themselves; anything else, and a file with
 * nothing to turn, is left byte for byte. EXIF (orientation reset) and ICC are kept.
 * Chromium ignores a WebP's tag, so a renderer that measured one sent the stored size:
 * the caller takes the size from here for a file this turned.
 * @returns {Promise<{w:number,h:number}|null>} the new size, null when untouched
 */
async function bakeOrientation(file) {
    const m = await sharp(file, { limitInputPixels: false }).metadata().catch(() => null);
    const out = OUTPUT[m?.format];
    if (!out || !(m.orientation > 1)) return null;
    const img = sharp(file, { limitInputPixels: false }).autoOrient().keepExif().keepIccProfile();
    const { data, info } = await out.apply(img).toBuffer({ resolveWithObject: true });
    // Overwriting a file sharp just read needs `sharp.cache({ files: 0 })` (services/ffmpegThumb.js):
    // libvips otherwise keeps a WebP open on Windows and this write fails EBUSY.
    await fs.writeFile(file, data);
    return { w: info.width, h: info.height };
}

/** Temp copies are consumed by the upload that follows; sweep anything left behind. */
async function _sweepTmp() {
    const names = await fs.readdir(TMP_DIR).catch(() => []);
    const cutoff = Date.now() - TMP_MAX_AGE_MS;
    await Promise.all(names.map(async (n) => {
        const p = path.join(TMP_DIR, n);
        const st = await fs.stat(p).catch(() => null);
        if (st && st.mtimeMs < cutoff) await fs.remove(p).catch(() => {});
    }));
}

router.post('/image-import/probe', async (req, res) => {
    const paths = Array.isArray(req.body?.paths) ? req.body.paths : null;
    if (!paths) return res.status(400).json({ success: false, error: 'paths[] required' });
    // null per unreadable file: the caller then imports it untouched, as before.
    const sizes = await Promise.all(paths.map(p => imageSize(p).catch(() => null)));
    res.json({ success: true, sizes });
});

router.post('/image-import/reduce', async (req, res) => {
    const { sourcePath, maxPixels } = req.body || {};
    if (!sourcePath || !path.isAbsolute(sourcePath) || !(await fs.pathExists(sourcePath))) {
        return res.status(400).json({ success: false, error: `sourcePath is not an existing absolute path: ${sourcePath}` });
    }
    if (!(Number.isFinite(maxPixels) && maxPixels > 0)) {
        return res.status(400).json({ success: false, error: 'maxPixels must be a positive number' });
    }
    try {
        await _sweepTmp();
        const out = await reduceImage(sourcePath, maxPixels);
        logger.info('project', `image-import reduce ${path.basename(sourcePath)} -> ${out.w}x${out.h}`);
        res.json({ success: true, ...out });
    } catch (err) {
        logger.error('project', 'image-import reduce failed', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = { router, imageSize, reduceImage, bakeOrientation };
