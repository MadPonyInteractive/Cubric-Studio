'use strict';

/**
 * routes/toolResize.js — the Resize tool on sharp + ffmpeg, no engine (MPI-1069).
 *
 * `js/services/toolExecutor.js` is the client head that calls this. Same shape as the
 * cloud route (`routes/deepinfra.js`): the bytes land in a scratch file and the answer is
 * a real http URL with a real extension, so the app's save path (`save-generation`, the
 * sidecar, the history entry) is exactly the one a ComfyUI result takes.
 *
 *   POST /tool/resize { operation: 'resize'|'resizeVideo', sourcePath, params, trimIn?, trimOut? }
 *     -> { ok:true, viewUrls:[…], width, height }
 *     -> { ok:false, error:{ code, message } }   BAD_REQUEST | NOT_FOUND | RESIZE_FAILED
 *        `sourcePath` is a DISK path (the head decodes `/project-file?path=`).
 *   GET  /tool/output/:name           the scratch file
 *   POST /tool/resize-preview { dataUrl, params } -> image/png
 *        The panel's live preview, on its small thumbnail: same renderer, no queue job.
 *
 * A request the client drops (Stop) kills its ffmpeg.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { resizeImage, resizeImageFile, resizeVideoFile } = require('../services/resizeOps');
const { sweepOlderThan } = require('../services/scratchSweep');

/** Scratch dir for a result on its way into a project. */
const OUTPUT_DIR = path.join(os.tmpdir(), 'cubric-tool');
// Free to remake, unlike a paid cloud result, but the save reads it AFTER this answers.
const OUTPUT_KEEP_MS = 60 * 60 * 1000;

const _fail = (res, code, message, status = 200) => res.status(status).json({ ok: false, error: { code, message } });

router.post('/tool/resize', async (req, res) => {
    const { operation, sourcePath, params, trimIn, trimOut } = req.body || {};
    const isVideo = operation === 'resizeVideo';
    if (!isVideo && operation !== 'resize') return _fail(res, 'BAD_REQUEST', `Not a resize operation: ${operation}`, 400);
    if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) return _fail(res, 'BAD_REQUEST', 'sourcePath must be an absolute path', 400);
    if (!await fs.pathExists(sourcePath)) return _fail(res, 'NOT_FOUND', `Source not found: ${path.basename(sourcePath)}`, 404);

    await fs.ensureDir(OUTPUT_DIR);
    sweepOlderThan(OUTPUT_DIR, OUTPUT_KEEP_MS, { only: 'file' });
    const id = uuidv4();
    const ext = isVideo ? 'mp4' : 'png';
    const out = path.join(OUTPUT_DIR, `${id}.${ext}`);
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });
    const started = Date.now();
    try {
        const { width, height } = isVideo
            ? await resizeVideoFile(sourcePath, out, params, { trimIn, trimOut, signal: abort.signal })
            : await resizeImageFile(sourcePath, out, params);
        logger.info('project', `tool resize ${operation} ${path.basename(sourcePath)} -> ${width}x${height} in ${Date.now() - started} ms`);
        const port = Number(process.env.CUBRIC_PORT) || 3000;
        res.json({ ok: true, viewUrls: [`http://127.0.0.1:${port}/tool/output/${id}.${ext}?filename=${id}.${ext}`], width, height });
    } catch (err) {
        await fs.remove(out).catch(() => {});
        if (abort.signal.aborted) return;   // the caller is gone (Stop); nobody reads an answer
        logger.error('project', `tool resize ${operation} failed`, err);
        _fail(res, 'RESIZE_FAILED', err.message);
    }
});

router.get('/tool/output/:name', async (req, res) => {
    // Basename only: a name is an id this route minted, never a path.
    const name = path.basename(String(req.params.name || ''));
    const file = path.join(OUTPUT_DIR, name);
    if (!name || !await fs.pathExists(file)) return res.status(404).end();
    res.sendFile(file, (err) => {
        if (err) logger.warn('project', `tool output ${name} could not be served`);
    });
});

router.post('/tool/resize-preview', async (req, res) => {
    const match = /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(String(req.body?.dataUrl || ''));
    if (!match) return _fail(res, 'BAD_REQUEST', 'dataUrl must be a base64 image', 400);
    try {
        const { image } = await resizeImage(Buffer.from(match[1], 'base64'), req.body.params);
        res.type('png').send(await image.toBuffer());
    } catch (err) {
        logger.warn('project', `tool resize preview failed: ${err.message}`);
        _fail(res, 'RESIZE_FAILED', err.message);
    }
});

module.exports = router;
