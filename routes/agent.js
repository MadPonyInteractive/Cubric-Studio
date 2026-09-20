'use strict';

/**
 * routes/agent.js — the in-app agent HTTP surface (MPI-774 slice A).
 *
 * Mounts the routes the chat UI and the agent loop share:
 *   POST /agent/message   — send a user turn (returns immediately; reply via SSE)
 *   GET  /agent/stream    — SSE for every conversation: agent:working, agent:message,
 *                           agent:tool, agent:confirm, agent:result, agent:compacting,
 *                           agent:error, agent:user (a carried request) (each with `session`),
 *                           and agent:session on a move
 *   GET  /agent/history?project= — one conversation's history + working / confirm state
 *   GET  /agent/attachment/:id — the staged image behind a history attachment id
 *   POST /agent/confirm   — respond to an install confirmation card
 *   POST /agent/reset?project= — clear one conversation and its staged files
 *   POST /agent/probe     — can the agent's model call a tool on the connection?
 *
 * One conversation per project, plus one for the landing page (Phase 3c, D4-D6):
 * `services/agentSessions.mjs` keeps them. A conversation is named by the project's
 * folder (`?project=` / `body.project.folderPath`); none means the landing page.
 *
 * Every route answers { ok: true, ... } or { ok: false, error: { code, message } }.
 * Malformed bodies → HTTP 400 BAD_REQUEST.
 *
 * The services are ESM; this CJS router loads them via dynamic import, cached on the
 * first call, following the same pattern as routes/llm.js.
 */

const express = require('express');
const crypto  = require('crypto');
const path    = require('path');
const logger  = require('./logger');
const { ask } = require('./forkBridge');

const router = express.Router();

// ---------------------------------------------------------------------------
// ESM imports — cached after first call
// ---------------------------------------------------------------------------

let _sessionsPromise = null;

/** The app's conversations; waits for the ESM import if needed. */
async function getSessions() {
    if (!_sessionsPromise) {
        _sessionsPromise = import('../services/agentSessions.mjs').then((m) =>
            new m.AgentSessions({ setupLoop: (loop) => loop.setForkBridge(ask) }));
    }
    return _sessionsPromise;
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

const _unavailable = (res, err) =>
    res.json({ ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message } });

// ---------------------------------------------------------------------------
// POST /agent/message
// ---------------------------------------------------------------------------

router.post('/agent/message', async (req, res) => {
    const { text, attachments, project, mode, profileId, model, pinned } = req.body || {};

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
    if (project != null && (typeof project !== 'object' || typeof project.folderPath !== 'string')) {
        return _bad(res, 'body.project must be null or { folderPath, name }.');
    }
    // MPI-774 Phase 7: what the pinned settings panel is showing, or null while it is shut.
    // Informational only — the renderer's agentDispatch is what ENFORCES the ownership, so
    // a turn that arrives without it loses the telling, never the gate.
    if (pinned != null && (typeof pinned !== 'object' || typeof pinned.modelId !== 'string')) {
        return _bad(res, 'body.pinned must be null or { modelId, name, mediaType, ops }.');
    }

    let sessions;
    try { sessions = await getSessions(); } catch (err) {
        logger.error('agent', `sessions unavailable: ${err.message}`);
        return _unavailable(res, err);
    }

    const turnId = crypto.randomUUID();

    // Stage attachments eagerly so the response can report their ids
    const stagedAttachments = [];
    if (Array.isArray(attachments) && attachments.length) {
        let tools;
        try { tools = await getTools(); } catch { /* ignore */ }
        if (tools) {
            for (const att of attachments) {
                try {
                    // A VIDEO arrives by reference (MpiPromptBox `_sendAgentTurn`): a clip as a
                    // data URL is hundreds of MB, and it is already a file of the open project.
                    // Nothing is copied; the path is only honoured inside that project's Media/,
                    // because the loop ships what it registers to the engine, maybe a remote Pod.
                    if (!att.dataUrl && att.url) {
                        const { ownedMedia } = await import('../services/agentCards.mjs');
                        const owned = project?.folderPath ? ownedMedia(project.folderPath, att.url) : null;
                        if (!owned) throw new Error('A video can be handed to the agent only from the open project.');
                        stagedAttachments.push({ id: path.basename(owned), name: att.name, filePath: owned,
                            reference: true, mediaType: 'video', itemId: typeof att.itemId === 'string' ? att.itemId : null });
                        continue;
                    }
                    const { id, filePath } = await tools.saveAttachment(att.name, att.dataUrl);
                    stagedAttachments.push({ id, name: att.name, filePath });
                } catch (err) {
                    stagedAttachments.push({ name: att.name, error: err.message });
                }
            }
        }
    }

    // D4: one turn at a time, whichever conversation it is in. A message sent while one is
    // running WAITS for it (MPI-840) — it used to be answered BUSY and the text was lost.
    // Decided HERE, after the staging awaits and with nothing async before the hand-off
    // below: a turn queued after the running one had already ended would never be drained.
    const queued = sessions.busy();

    // Return at once; the reply arrives on /agent/stream, tagged with this `session`.
    res.json({
        ok: true,
        turnId,
        queued,
        session: sessions.keyOf(project?.folderPath),
        attachments: stagedAttachments.filter((a) => a.id).map((a) => ({ id: a.id, name: a.name })),
    });

    // Run the turn asynchronously. The STAGED records go in, not the raw data URLs:
    // staging them a second time would give the chat and the model different ids for
    // the same picture, and the loop registers these ids as the images it may read.
    const turn = { text: text || '', attachments: stagedAttachments, project: project || null, mode, profileId, turnId, model, pinned: pinned || null };
    if (queued) return sessions.queue(turn);
    sessions.send(turn)
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

    let sessions;
    try { sessions = await getSessions(); } catch {
        res.write('event: agent:error\ndata: {"code":"ENDPOINT_ERROR","message":"Agent unavailable"}\n\n');
        res.end();
        return;
    }

    sessions.addSubscriber(res);
    res.write('event: connected\ndata: {}\n\n');

    req.on('close', () => sessions.removeSubscriber(res));
});

// ---------------------------------------------------------------------------
// GET /agent/history?project=<folderPath>
// ---------------------------------------------------------------------------

router.get('/agent/history', async (req, res) => {
    let sessions;
    try { sessions = await getSessions(); } catch (err) { return _unavailable(res, err); }
    res.json(sessions.history(typeof req.query.project === 'string' ? req.query.project : ''));
});

// ---------------------------------------------------------------------------
// GET /agent/attachment/:id
// ---------------------------------------------------------------------------

// History keeps an attachment as { id, name } only, so a remounted chat asks for
// the picture by id. Served only for a conversation's own attachment ids (the same
// allowlist `look` resolves through), never a path the caller names.
router.get('/agent/attachment/:id', async (req, res) => {
    let sessions;
    try { sessions = await getSessions(); } catch {
        return res.status(404).end();
    }
    const filePath = sessions.attachmentPath(req.params.id);
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

    let sessions;
    try { sessions = await getSessions(); } catch (err) { return _unavailable(res, err); }

    const loop = sessions.byConfirm(confirmId);
    if (!loop) {
        return res.json({ ok: false, error: { code: 'UNKNOWN_CONFIRM', message: 'Unknown or already-answered confirmId.' } });
    }
    res.json(await loop.confirm(confirmId, yes));
});

// ---------------------------------------------------------------------------
// POST /agent/reset?project=<folderPath>
// ---------------------------------------------------------------------------

router.post('/agent/reset', async (req, res) => {
    let sessions;
    try { sessions = await getSessions(); } catch (err) { return _unavailable(res, err); }
    await sessions.reset(typeof req.query.project === 'string' ? req.query.project : '');
    res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /agent/probe
// ---------------------------------------------------------------------------

router.post('/agent/probe', async (req, res) => {
    const { profileId, model } = req.body || {};
    if (!profileId) return _bad(res, 'body.profileId is required.');

    let sessions;
    try { sessions = await getSessions(); } catch (err) { return _unavailable(res, err); }

    res.json(await sessions.probe(profileId, typeof model === 'string' ? model : ''));
});

module.exports = router;
