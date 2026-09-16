'use strict';

/**
 * routes/agent.js — the in-app agent HTTP surface (MPI-774 slice A).
 *
 * Mounts the six routes the chat UI and the agent loop share:
 *   POST /agent/message   — send a user turn (returns immediately; reply via SSE)
 *   GET  /agent/stream    — SSE: agent:working, agent:message, agent:tool,
 *                           agent:confirm, agent:result, agent:compacting, agent:error
 *   GET  /agent/history   — full session history + current working / confirm state
 *   GET  /agent/attachment/:id — the staged image behind a history attachment id
 *   POST /agent/confirm   — respond to an install confirmation card
 *   POST /agent/reset     — clear the session and wipe the attachment dir
 *   POST /agent/probe     — can the agent's model call a tool on the connection?
 *
 * Every route answers { ok: true, ... } or { ok: false, error: { code, message } }.
 * Malformed bodies → HTTP 400 BAD_REQUEST.
 *
 * `services/agentLoop.mjs` is ESM; this CJS router loads it via dynamic import,
 * cached on the first call, following the same pattern as routes/llm.js.
 */

const express = require('express');
const crypto  = require('crypto');
const logger  = require('./logger');
const { ask } = require('./forkBridge');

const router = express.Router();

// ---------------------------------------------------------------------------
// ESM imports — cached after first call
// ---------------------------------------------------------------------------

let _loopPromise = null;

/** Returns the singleton AgentLoop; waits for the ESM import if needed. */
async function getLoop() {
    if (!_loopPromise) {
        _loopPromise = import('../services/agentLoop.mjs').then((m) => {
            const loop = m.defaultLoop;
            loop.setForkBridge(ask);
            return loop;
        });
    }
    return _loopPromise;
}

let _toolsPromise = null;
async function getTools() {
    if (!_toolsPromise) _toolsPromise = import('../services/agentTools.mjs');
    return _toolsPromise;
}

// Init the attachment dir at module load time (non-blocking, best-effort).
getTools().then((t) => t.initAttachmentDir()).catch(() => {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const _bad = (res, message) =>
    res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message } });

// ---------------------------------------------------------------------------
// POST /agent/message
// ---------------------------------------------------------------------------

router.post('/agent/message', async (req, res) => {
    const { text, attachments, project, mode, profileId, model } = req.body || {};

    if (!text && !(Array.isArray(attachments) && attachments.length)) {
        return _bad(res, 'body.text or body.attachments is required.');
    }
    if (!profileId) {
        return res.json({ ok: false, error: { code: 'NO_PROFILE', message: 'body.profileId is required.' } });
    }
    if (mode !== 'auto' && mode !== 'ask') {
        return _bad(res, "body.mode must be 'auto' or 'ask'.");
    }
    if (model !== undefined && typeof model !== 'string') {
        return _bad(res, 'body.model must be a string.');
    }

    let loop;
    try { loop = await getLoop(); } catch (err) {
        logger.error('agent', `getLoop failed: ${err.message}`);
        return res.json({ ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message } });
    }

    if (loop._working) {
        return res.json({ ok: false, error: { code: 'BUSY', message: 'A turn is already running. Wait for it to finish.' } });
    }

    const turnId = crypto.randomUUID();

    // Stage attachments eagerly so the response can report their ids
    let stagedAttachments = [];
    if (Array.isArray(attachments) && attachments.length) {
        let tools;
        try { tools = await getTools(); } catch { /* ignore */ }
        if (tools) {
            for (const att of attachments) {
                try {
                    const { id, filePath } = await tools.saveAttachment(att.name, att.dataUrl);
                    stagedAttachments.push({ id, name: att.name, filePath });
                } catch (err) {
                    stagedAttachments.push({ name: att.name, error: err.message });
                }
            }
        }
    }

    // Return the turnId immediately; the reply arrives on /agent/stream
    res.json({
        ok: true,
        turnId,
        attachments: stagedAttachments.filter((a) => a.id).map((a) => ({ id: a.id, name: a.name })),
    });

    // Run the turn asynchronously. The STAGED records go in, not the raw data URLs:
    // staging them a second time would give the chat and the model different ids for
    // the same picture, and the loop registers these ids as the images it may read.
    loop.runTurn(text || '', stagedAttachments, project || null, mode, profileId, turnId, { model })
        .catch((err) => logger.error('agent', `runTurn unhandled: ${err.message}`));
});

// ---------------------------------------------------------------------------
// GET /agent/stream  — SSE
// ---------------------------------------------------------------------------

router.get('/agent/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    let loop;
    try { loop = await getLoop(); } catch {
        res.write('event: agent:error\ndata: {"code":"ENDPOINT_ERROR","message":"Loop unavailable"}\n\n');
        res.end();
        return;
    }

    loop.addSubscriber(res);
    res.write('event: connected\ndata: {}\n\n');

    req.on('close', () => loop.removeSubscriber(res));
});

// ---------------------------------------------------------------------------
// GET /agent/history
// ---------------------------------------------------------------------------

router.get('/agent/history', async (_req, res) => {
    let loop;
    try { loop = await getLoop(); } catch (err) {
        return res.json({ ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message } });
    }
    res.json(loop.getHistory());
});

// ---------------------------------------------------------------------------
// GET /agent/attachment/:id
// ---------------------------------------------------------------------------

// History keeps an attachment as { id, name } only, so a remounted chat asks for
// the picture by id. Served only for this session's own attachment ids (the same
// allowlist `look` resolves through), never a path the caller names.
router.get('/agent/attachment/:id', async (req, res) => {
    let loop;
    try { loop = await getLoop(); } catch {
        return res.status(404).end();
    }
    const filePath = loop.attachmentPath(req.params.id);
    if (!filePath) return res.status(404).end();
    res.sendFile(filePath, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// ---------------------------------------------------------------------------
// POST /agent/confirm
// ---------------------------------------------------------------------------

router.post('/agent/confirm', async (req, res) => {
    const { confirmId, yes } = req.body || {};
    if (!confirmId) return _bad(res, 'body.confirmId is required.');
    if (typeof yes !== 'boolean') return _bad(res, 'body.yes must be a boolean.');

    let loop;
    try { loop = await getLoop(); } catch (err) {
        return res.json({ ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message } });
    }

    const result = await loop.confirm(confirmId, yes);
    res.json(result);
});

// ---------------------------------------------------------------------------
// POST /agent/reset
// ---------------------------------------------------------------------------

router.post('/agent/reset', async (_req, res) => {
    let loop;
    try { loop = await getLoop(); } catch (err) {
        return res.json({ ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message } });
    }
    await loop.reset();
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /agent/probe
// ---------------------------------------------------------------------------

router.post('/agent/probe', async (req, res) => {
    const { profileId, model } = req.body || {};
    if (!profileId) return _bad(res, 'body.profileId is required.');

    let loop;
    try { loop = await getLoop(); } catch (err) {
        return res.json({ ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message } });
    }

    const result = await loop.probe(profileId, typeof model === 'string' ? model : '');
    res.json(result);
});

module.exports = router;
