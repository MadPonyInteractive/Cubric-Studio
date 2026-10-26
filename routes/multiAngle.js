'use strict';

/**
 * routes/multiAngle.js — the Multi-angle Flow's doll reference, sized to the pass it goes with (MPI-1039).
 *
 * Each turn / height pass sends a pre-rendered doll (`assets/flows/multi-angle/refs/<room|plain>/<stop>.png`,
 * square) as image 2. The bench padded it to image 1's size, the square fitted and its edge pixels
 * repeated (round 20), and that is the ref every passing cell ran with; Resize's own edge-pixel pad
 * (`services/resizeOps.js`) is the same pixels. The result lives in the PROJECT (`.flow-refs/`, beside
 * Media, out of the gallery), so a card that names it can be run again after a restart.
 *
 *   POST /flows/multi-angle/ref { ref: 'room/tq_fl', imagePath, folderPath }
 *     -> { ok: true, url: '/project-file?path=...', width, height }
 *     -> { ok: false, error: { code, message } }   BAD_REQUEST | NOT_FOUND | REF_FAILED
 *        `imagePath` = the pass's first image, a disk path or a `/project-file?path=` URL.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { diskPathOf } = require('../services/projectFileUrl');
const sharp = require('sharp');
const logger = require('./logger');
const { resizeImage } = require('../services/resizeOps');

const REFS = path.join(__dirname, '..', 'assets', 'flows', 'multi-angle', 'refs');
const REF_NAME = /^(room|plain)\/[a-z]+(?:_[a-z]+)*$/;

const _fail = (res, code, message, status = 200) => res.status(status).json({ ok: false, error: { code, message } });

router.post('/flows/multi-angle/ref', async (req, res) => {
    const { ref, imagePath, folderPath } = req.body || {};
    if (typeof ref !== 'string' || !REF_NAME.test(ref)) return _fail(res, 'BAD_REQUEST', `Not a doll ref: ${ref}`, 400);
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
        return _fail(res, 'BAD_REQUEST', 'folderPath must be an absolute path', 400);
    }
    const source = diskPathOf(imagePath);
    const asset = path.join(REFS, `${ref}.png`);
    if (!source || !await fs.pathExists(source)) return _fail(res, 'NOT_FOUND', 'The picture is gone.', 404);
    if (!await fs.pathExists(asset)) return _fail(res, 'NOT_FOUND', `The app is missing its ${ref} reference.`, 404);
    try {
        const meta = await sharp(source, { limitInputPixels: false, autoOrient: true }).metadata();
        const width = meta.autoOrient?.width || meta.width;
        const height = meta.autoOrient?.height || meta.height;
        const out = path.join(folderPath, '.flow-refs', 'multi-angle', `${ref.replace('/', '_')}_${width}x${height}.png`);
        if (!await fs.pathExists(out)) {
            await fs.ensureDir(path.dirname(out));
            // A Buffer, not the path: a packaged app's assets may sit in an archive libvips cannot open.
            const { image } = await resizeImage(await fs.readFile(asset),
                { width, height, keep_proportion: 'pad_edge_pixel', divisible_by: 1 });
            await image.toFile(out);
            logger.info('project', `multi-angle ref ${ref} padded to ${width}x${height}`);
        }
        res.json({ ok: true, url: `/project-file?path=${encodeURIComponent(out)}`, width, height });
    } catch (err) {
        logger.error('project', `multi-angle ref ${ref} failed`, err);
        _fail(res, 'REF_FAILED', err.message);
    }
});

module.exports = router;
