'use strict';

/**
 * routes/tiles.js — Use Tiles' "Describe each tile" pictures (MPI-1232 Phase 3).
 *
 *   POST /tiles/outlines   { imagePath, rects:[{x1,y1,x2,y2}] }   rects in FRACTIONS of the picture
 *     → { ok:true, images:[ '/project-file?path=…', … ] }   one outlined copy per rect, same order
 *
 * Errors always return { ok:false, error:{ code, message } }.
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs-extra');
const path    = require('path');
const logger  = require('./logger');
const { outlineTiles } = require('../services/tileOutlines');

const _fail = (res, code, message, status = 200) =>
    res.status(status).json({ ok: false, error: { code, message } });

const _isRect = (r) => r && ['x1', 'y1', 'x2', 'y2'].every((k) => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1)
    && r.x2 > r.x1 && r.y2 > r.y1;

router.post('/tiles/outlines', async (req, res) => {
    const { imagePath, rects } = req.body || {};
    if (typeof imagePath !== 'string' || !path.isAbsolute(imagePath))
        return _fail(res, 'BAD_REQUEST', 'imagePath must be an absolute path', 400);
    if (!Array.isArray(rects) || !rects.length || !rects.every(_isRect))
        return _fail(res, 'BAD_REQUEST', 'rects must be [{x1,y1,x2,y2}] in fractions of the picture', 400);
    if (!await fs.pathExists(imagePath))
        return _fail(res, 'NOT_FOUND', `Picture not found: ${path.basename(imagePath)}`, 404);

    try {
        const files = await outlineTiles(imagePath, rects);
        logger.info('project', `tile outlines ${path.basename(imagePath)} x${files.length}`);
        res.json({ ok: true, images: files.map((p) => `/project-file?path=${encodeURIComponent(p)}`) });
    } catch (err) {
        logger.error('project', 'tile outlines failed', err);
        _fail(res, 'TILE_OUTLINES_FAILED', err.message);
    }
});

module.exports = router;
