'use strict';

/**
 * routes/videoConcat.js — server-side video concat endpoints.
 *
 * Routes:
 *   GET  /concat/events/stream — SSE channel; emits `concat:progress` +
 *                                 `concat:done` + `concat:error` events
 *   POST /combine-videos       — concat N items, writes combined_NNN.mp4
 *
 * `/extend-video` (Extend / New shot) was retired in MPI-1015: make the shot,
 * then Combine. Old `extended_NNN.mp4` cards keep their `extendedFrom` line.
 *
 * Sidecar IDs are resolved from `<projectFolder>/Media/.meta/<id>.json`.
 * Output sidecars follow the same shape as save-generation + videoCrop.
 *
 * Progress streams to the SSE channel keyed by `jobId` (client-supplied or
 * server-generated). The frontend bridge in js/services/concatProgress.js
 * forwards to StatusBar.progress.*.
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs-extra');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { concatVideos } = require('../services/videoConcat');
const { probeVideo }   = require('../services/ffprobeVideo');
const { writeVideoDerivatives } = require('../services/ffmpegThumb');
const { nextSequence } = require('./projects');

// ── SSE channel ──────────────────────────────────────────────────────────────
const _clients = new Set();

function _broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of _clients) {
        try { client.write(payload); } catch (_) { /* dropped */ }
    }
}

router.get('/concat/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();
    _clients.add(res);
    res.write(`event: connected\ndata: {}\n\n`);
    req.on('close', () => { _clients.delete(res); });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function _decodeProjectFilePath(value) {
    if (!value) return null;
    if (value.includes('project-file?path=')) {
        try {
            const u = new URL(value, 'http://localhost');
            return decodeURIComponent(u.searchParams.get('path') || '');
        } catch (_) { return null; }
    }
    return value;
}

async function _readSidecar(metaDir, itemId) {
    const p = path.join(metaDir, `${itemId}.json`);
    if (!(await fs.pathExists(p))) return null;
    try { return await fs.readJson(p); }
    catch (_) { return null; }
}

async function _resolveItemPath(metaDir, itemId) {
    const sidecar = await _readSidecar(metaDir, itemId);
    if (!sidecar) return { abs: null, sidecar: null };
    const abs = _decodeProjectFilePath(sidecar.filePath);
    return { abs, sidecar };
}

// Delegates to the monotonic allocator in routes/projects.js so combined_
// names never reuse a deleted number (avoids the overwrite/orphan bug).
async function _nextSequencedName(folderPath, mediaDir, prefix, ext = 'mp4') {
    return nextSequence(folderPath, mediaDir, prefix, ext);
}

function _makeProgressEmitter(jobId) {
    let last = -1;
    return ratio => {
        // Throttle: only emit when ratio changes by ≥ 0.01 (1%)
        if (ratio - last < 0.01 && ratio < 0.999) return;
        last = ratio;
        _broadcast('concat:progress', { jobId, ratio });
    };
}

async function _writeOutputSidecar({ mediaDir, metaDir, outputPath, finalName, operation, extraFields = {} }) {
    const outMeta = await probeVideo(outputPath) || {};
    const newId   = uuidv4();
    // Cache-bust on the output's mtime: a re-run that overwrites a reused
    // filename (e.g. combined_001.mp4 after an in-app delete) gets a fresh URL,
    // so Chromium can't replay stale cached bytes for the same /project-file path.
    const _mtime = (await fs.stat(outputPath).catch(() => null))?.mtimeMs || 0;
    const filePathUrl = `/project-file?path=${encodeURIComponent(outputPath)}&v=${Math.round(_mtime)}`;
    const sidecar = {
        id:         newId,
        type:       'video',
        filePath:   filePathUrl,
        operation,
        displayName: finalName.replace(/\.[^.]+$/, ''),
        prompt:     '',
        negativePrompt: '',
        seed:       -1,
        modelId:    null,
        createdAt:  new Date().toISOString(),
        name:       null,
        uploaded:   false,
        pixelDimensions: { w: outMeta.width || 0, h: outMeta.height || 0 },
        fps:        outMeta.fps        || 0,
        duration:   outMeta.duration   || 0,
        frameCount: outMeta.frameCount || 0,
        hasAudio:   !!outMeta.hasAudio,
        ...extraFields,
    };
    // Poster + 720p hover proxy + trim-bar waveform (MPI-633, MPI-829). Null proxyPath
    // just means the output is already at or under 720p, in which case the master IS the
    // proxy. The wave spans the JOINED clip, which is the whole point on a concat.
    const { thumbPath, thumbPathLg, proxyPath, wavePath } = await writeVideoDerivatives(outputPath, metaDir, newId, { sourceWidth: outMeta.width, sourceHeight: outMeta.height, hasAudio: !!outMeta.hasAudio });
    if (thumbPath) sidecar.thumbPath = thumbPath;
    if (thumbPathLg) sidecar.thumbPathLg = thumbPathLg;
    if (proxyPath) sidecar.proxyPath = proxyPath;
    if (wavePath) sidecar.wavePath = wavePath;
    await fs.writeJson(path.join(metaDir, `${newId}.json`), sidecar, { spaces: 2 });
    return sidecar;
}

// ── POST /combine-videos ─────────────────────────────────────────────────────
/**
 * Body: {
 *   folderPath: string,       // absolute project folder
 *   itemIds:    string[],     // ≥2 item UUIDs in chronological order
 *   jobId?:     string,       // optional client-supplied id (echoed in SSE)
 * }
 * Response: { success, item, group, method }
 */
router.post('/combine-videos', async (req, res) => {
    const { folderPath, itemIds, jobId: clientJobId } = req.body || {};
    const jobId = clientJobId || `combine-${Date.now()}`;
    let outputPath = '';

    try {
        if (!folderPath) {
            return res.status(400).json({ success: false, error: 'folderPath required' });
        }
        if (!Array.isArray(itemIds) || itemIds.length < 2) {
            return res.status(400).json({ success: false, error: 'itemIds[] with ≥2 entries required' });
        }

        const mediaDir = path.join(folderPath, 'Media');
        const metaDir  = path.join(mediaDir, '.meta');
        if (!(await fs.pathExists(metaDir))) {
            return res.status(404).json({ success: false, error: '.meta directory missing' });
        }

        // Resolve all source paths
        const inputs = [];
        for (const id of itemIds) {
            const { abs, sidecar } = await _resolveItemPath(metaDir, id);
            if (!abs || !(await fs.pathExists(abs))) {
                return res.status(404).json({ success: false, error: `source file missing for item ${id}` });
            }
            if (sidecar.type !== 'video') {
                return res.status(400).json({ success: false, error: `item ${id} is not a video` });
            }
            inputs.push(abs);
        }

        const finalName = await _nextSequencedName(folderPath, mediaDir, 'combined', 'mp4');
        outputPath = path.join(mediaDir, finalName);

        _broadcast('concat:progress', { jobId, ratio: 0 });
        const onProgress = _makeProgressEmitter(jobId);
        // forceReencode: demuxer `-c copy` concat drifts PTS on short generated
        // clips → non-integer output fps that breaks frame-accurate playback.
        // Re-encode via the filter path for guaranteed CFR output.
        const result = await concatVideos(inputs, outputPath, { onProgress, forceReencode: true });

        const sidecar = await _writeOutputSidecar({
            mediaDir, metaDir, outputPath, finalName, operation: 'combine',
        });

        const item = { ...sidecar };
        const group = {
            id:         uuidv4(),
            type:       'video',
            operation:  'combine',
            createdAt:  new Date().toISOString(),
            fps:        sidecar.fps,
            duration:   sidecar.duration,
            items:      [item],
        };

        _broadcast('concat:done', { jobId, item, group, method: result.method });
        res.json({ success: true, item, group, method: result.method, jobId });
    } catch (err) {
        logger.error('project', 'combine-videos failed', err);
        if (outputPath) { try { await fs.remove(outputPath); } catch {} }
        const _shortErr = String(err.message || 'unknown').split('\n')[0].slice(0, 200);
        _broadcast('concat:error', { jobId, error: _shortErr });
        res.status(500).json({ success: false, error: _shortErr, jobId });
    }
});

module.exports = router;
