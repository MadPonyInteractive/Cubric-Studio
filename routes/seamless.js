'use strict';

/**
 * routes/seamless.js — Make Seamless Flow pixel service (MPI-1101).
 *
 * Thin Express wrappers over services/seamlessOps.js.  All pixel work is in the service.
 *
 *   POST /seamless/prepare   { sourcePath, handles:{left,right,top,bottom}, lightingFlatten? }
 *     → { ok:true, runId, width, height, bandX, bandY, windows }
 *         bandX/bandY: { start:number, end:number } | null
 *         windows: [{ i, rect:{left,top,width,height}, axis:'x'|'y' }, ...]
 *   POST /seamless/window    { runId, i }
 *     → { ok:true, image, mask }   `/project-file?path=` URLs, as /engine-mask returns its cut
 *   POST /seamless/paste     { runId, i, viewUrl }   the engine's output, fetched as /engine-stitch does
 *     → { ok:true }
 *   POST /seamless/finish    { runId }
 *     → { ok:true, url }   the whole picture as it stands, rolled back: an absolute
 *       /project-file URL save-generation streams (same shape as /engine-stitch). Every
 *       window finishes, so a run lands its first window and REPLACES that version after.
 *
 * Errors always return { ok:false, error:{ code, message } }.
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs-extra');
const path    = require('path');
const logger  = require('./logger');
const { streamDownload } = require('./shared');
const { prepare, windowCut, paste, finish, runDirOf } = require('../services/seamlessOps');

const _fileUrl = (p) => `/project-file?path=${encodeURIComponent(p)}`;

const _fail = (res, code, message, status = 200) =>
    res.status(status).json({ ok: false, error: { code, message } });

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/seamless/prepare', async (req, res) => {
    const { sourcePath, handles, lightingFlatten = 0 } = req.body || {};
    if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath))
        return _fail(res, 'BAD_REQUEST', 'sourcePath must be an absolute path', 400);
    if (!await fs.pathExists(sourcePath))
        return _fail(res, 'NOT_FOUND', `Source not found: ${path.basename(sourcePath)}`, 404);
    if (!handles || typeof handles !== 'object')
        return _fail(res, 'BAD_REQUEST', 'handles required: {left,right,top,bottom}', 400);

    try {
        const state = await prepare({ sourcePath, handles, lightingFlatten });
        logger.info('project',
            `seamless prepare ${path.basename(sourcePath)} ${state.width}x${state.height}`
            + ` runId=${state.runId} windows=${state.windows.length}`);
        res.json({
            ok: true,
            runId:   state.runId,
            width:   state.width,
            height:  state.height,
            bandX:   state.bandX,
            bandY:   state.bandY,
            windows: state.windows,
        });
    } catch (err) {
        logger.error('project', 'seamless prepare failed', err);
        _fail(res, 'SEAMLESS_FAILED', err.message);
    }
});

router.post('/seamless/window', async (req, res) => {
    const { runId, i } = req.body || {};
    if (typeof runId !== 'string') return _fail(res, 'BAD_REQUEST', 'runId required', 400);
    if (typeof i !== 'number')     return _fail(res, 'BAD_REQUEST', 'i (number) required', 400);

    try {
        const { imagePath, maskPath } = await windowCut(runId, i);
        res.json({ ok: true, image: _fileUrl(imagePath), mask: _fileUrl(maskPath) });
    } catch (err) {
        logger.error('project', `seamless window ${runId}:${i} failed`, err);
        _fail(res, 'SEAMLESS_FAILED', err.message);
    }
});

router.post('/seamless/paste', async (req, res) => {
    const { runId, i, viewUrl } = req.body || {};
    if (typeof runId !== 'string')    return _fail(res, 'BAD_REQUEST', 'runId required', 400);
    if (typeof i !== 'number')        return _fail(res, 'BAD_REQUEST', 'i (number) required', 400);
    if (typeof viewUrl !== 'string')  return _fail(res, 'BAD_REQUEST', 'viewUrl required', 400);

    try {
        const resultPath = path.join(runDirOf(runId), `win_${i}_result.png`);
        await streamDownload(viewUrl, resultPath);
        await paste(runId, i, resultPath);
        res.json({ ok: true });
    } catch (err) {
        logger.error('project', `seamless paste ${runId}:${i} failed`, err);
        _fail(res, 'SEAMLESS_FAILED', err.message);
    }
});

router.post('/seamless/finish', async (req, res) => {
    const { runId } = req.body || {};
    if (typeof runId !== 'string')   return _fail(res, 'BAD_REQUEST', 'runId required', 400);

    try {
        // A new name per finish: save-generation streams each one, and a later window's must
        // never overwrite the file an earlier save is still reading.
        const name = `result_${Date.now()}.png`;
        const outPath = await finish(runId, path.join(runDirOf(runId), name));
        logger.info('project', `seamless finish runId=${runId} -> ${name}`);
        res.json({ ok: true, url: `${req.protocol}://${req.get('host')}${_fileUrl(outPath)}&filename=${name}` });
    } catch (err) {
        logger.error('project', `seamless finish ${runId} failed`, err);
        _fail(res, 'SEAMLESS_FAILED', err.message);
    }
});

module.exports = router;
