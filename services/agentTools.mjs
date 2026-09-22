/**
 * services/agentTools.mjs — fetch table over loopback to the connector routes (MPI-774).
 *
 * Each exported function calls one W1-owned connector route. The agent loop uses
 * this module so a CLI agent (MPI-593) gets the same surface for free — there is
 * deliberately NO second dispatch path (`routes/connector.js` header, MPI-677).
 *
 * Every function is intentionally thin: no retry, no caching, no error translation.
 * The loop caller inspects { ok, error } and decides what to tell the model.
 *
 * Standalone (no Electron, `npm run server`): attachment dir falls back to
 * os.tmpdir()/cubric-agent — the same convention as the logger's log-dir fallback.
 */

import os from 'os';
import http from 'node:http';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Loopback helpers
// ---------------------------------------------------------------------------

/** Base URL of this server's own HTTP surface. */
function loopbackBase() {
    // 3000 is the port a user's running app listens on. A unit test that reaches this line
    // with no port of its own is about to talk to it - one did, 2026-09-19, and created a
    // project in Fabio's Projects folder. `node --test` sets NODE_TEST_CONTEXT in every
    // test process, so the default is refused there rather than trusted to a stub.
    if (!process.env.CUBRIC_PORT && process.env.NODE_TEST_CONTEXT) {
        throw new Error('agentTools: CUBRIC_PORT is unset under the test runner. Point it at a server the test owns; the default port is the user`s live app.');
    }
    return `http://127.0.0.1:${process.env.CUBRIC_PORT || 3000}`;
}

async function _get(p, timeoutMs = 10_000) {
    const res = await fetch(`${loopbackBase()}${p}`, {
        signal: AbortSignal.timeout(timeoutMs),
    });
    return res.json();
}

/**
 * `node:http`, deliberately NOT `fetch`. Node's fetch gives up on any response whose HEADERS
 * take longer than 300 s, whatever `signal` says, and these routes answer only once the
 * work is done: `/connector/generate` holds its response for the whole render. So the
 * 30-minute budget below was never reachable, and every generation over five minutes came
 * back `fetch failed` while the clip landed in the gallery regardless.
 *
 * Live, 2026-09-19: a 6 s H3 clip took 337 s. The chat said "fetch failed", the agent was
 * told the run had failed, told the user "no clip was ever created", and RE-RAN the same
 * five-minute render over a file that was sitting on disk. `http.request` has no such
 * limit; `timeoutMs` is now the only clock.
 */
function _post(p, body, timeoutMs = 1_800_000) {
    return new Promise((resolve, reject) => {
        const req = http.request(`${loopbackBase()}${p}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(timeoutMs),
        }, (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { text += chunk; });
            res.on('error', reject);
            res.on('end', () => {
                try { resolve(JSON.parse(text)); } catch (err) { reject(err); }
            });
        });
        req.on('error', reject);
        req.end(JSON.stringify(body));
    });
}

// ---------------------------------------------------------------------------
// Connector routes (built by W1)
// ---------------------------------------------------------------------------

/** GET /connector/models — installed state, ops, hardware fit, download size. */
export async function listModels() {
    return _get('/connector/models');
}

/**
 * GET /connector/knowledge[/:id]
 * No id → the index `{ ok, entries: [...] }`.
 * With id → the entry `{ ok, id, title, text }`.
 */
export async function readKnowledge(id) {
    const p = id ? `/connector/knowledge/${encodeURIComponent(String(id))}` : '/connector/knowledge';
    return _get(p);
}

/**
 * POST /connector/install { modelId } — starts the download, returns size + started.
 * Gate lives in the loop: this function is only called after the user clicks Yes.
 */
export async function installModel(modelId) {
    return _post('/connector/install', { modelId });
}

/**
 * POST /connector/generate — resolves when the renderer reports back (up to 30 min).
 * The loop fires this without awaiting; callers attach .then()/.catch().
 */
export async function generate(body) {
    return _post('/connector/generate', body, 1_800_000);
}

/**
 * POST /connector/quote — what that same generate body would cost, before it runs (MPI-876).
 * A read: the renderer resolves the run and prices what it would send, and dispatches
 * nothing. `count` is the size of a fan-out about to send this op over N cards.
 */
export async function quoteGeneration(body) {
    return _post('/connector/quote', body);
}

/** POST /connector/cancel { requestId } — stop a generation submitted under that requestId. */
export async function cancelGeneration(requestId) {
    return _post('/connector/cancel', { requestId });
}

/**
 * POST /connector/describe { imagePath, question?, crop? }
 * imagePath must be absolute. Crops and attachment resolution are done by the loop
 * before calling here. No shorter budget than the route's own: a ComfyUI describe
 * queues behind a running generation, and the route answers TIMEOUT itself (30 min);
 * a 60 s client gave up on a describe that was still coming.
 */
export async function look(args) {
    return _post('/connector/describe', args);
}

/**
 * Where a card's kept description lives: `<project>/Media/.meta/<itemId>.json`, field `look`.
 * Null for a file that is not directly in a project's `Media/` (a crop, an attachment, a
 * preview asset), which has no card to die with.
 */
export function lookStore(imagePath, itemId) {
    const mediaDir = path.dirname(String(imagePath || ''));
    if (!itemId || path.basename(mediaDir) !== 'Media') return null;
    return { folderPath: path.dirname(mediaDir), metaPath: path.join(mediaDir, '.meta', `${itemId}.json`) };
}

/** The description kept for this card, or null. A read: straight off disk, no route. */
export async function storedLook(imagePath, itemId) {
    const store = lookStore(imagePath, itemId);
    if (!store) return null;
    try {
        return JSON.parse(await fs.readFile(store.metaPath, 'utf8')).look?.text || null;
    } catch { return null; }
}

/**
 * Keep a card's description. POST /project-media/agent/update-meta, because that route owns
 * the per-sidecar write queue (`updateItemMeta`): a second writer beside it could drop a trim
 * or a rename landing at the same moment. Never CREATES a sidecar: the route starts a missing
 * one from `{}`, and a file holding only `look` would read as a real item.
 * If the renderer later rewrites the sidecar without this field, the next look is a miss and
 * is described again: one extra vision call, nothing wrong on screen.
 */
export async function storeLook(imagePath, itemId, text) {
    const store = lookStore(imagePath, itemId);
    if (!store) return;
    try { await fs.access(store.metaPath); } catch { return; }
    await _post(`/project-media/agent/update-meta?folderPath=${encodeURIComponent(store.folderPath)}`,
        { itemId, updates: { look: { text, at: new Date().toISOString() } } }, 10_000);
}

/** GET /connector/projects — the user's projects, most recent first. */
export async function listProjects() {
    return _get('/connector/projects', 30_000);
}

/** POST /connector/create-project { name } — a new project in the default root, never over one. */
export async function createProject(name) {
    return _post('/connector/create-project', { name: String(name ?? '') }, 30_000);
}

/** POST /connector/open-project { folderPath } */
export async function openProject(folderPath) {
    return _post('/connector/open-project', { folderPath });
}

/** POST /connector/rename-card { groupId, name } — MPI-776's route; a name, never a clear. */
export async function renameCard(groupId, name) {
    return _post('/connector/rename-card', { groupId, name: String(name ?? '') }, 60_000);
}

/**
 * POST /connector/gif/{make,edit,cutout,to-video} — MPI-830's routes; bodies and error codes in
 * `.claude/skills/cubric-vision-gif/SKILL.md`. Awaited: the ffmpeg verbs are seconds, a cut-out
 * is a GPU run. Cards are named by ITEM id, which the loop looks up from the model's `ref`.
 */
export async function makeGif(body) {
    return _post('/connector/gif/make', body);
}

export async function editGif(body) {
    return _post('/connector/gif/edit', body);
}

export async function cutoutGif(body) {
    return _post('/connector/gif/cutout', body);
}

export async function gifToVideo(body) {
    return _post('/connector/gif/to-video', body);
}

/**
 * GET /connector/memory[/:file]?folderPath= — the project's agent notes: the index
 * `{ ok, notes }`, or one note `{ ok, file, text }`.
 */
export async function readMemory(folderPath, file) {
    const q = `?folderPath=${encodeURIComponent(String(folderPath ?? ''))}`;
    return _get(file ? `/connector/memory/${encodeURIComponent(String(file))}${q}` : `/connector/memory${q}`);
}

/**
 * GET /connector/cards[/:groupId]?folderPath= — what the project already holds: the newest
 * cards `{ ok, cards, total, files }`, or one card in full `{ ok, card, files }`.
 */
export async function listCards(folderPath, groupId, limit, mark) {
    const q = `?folderPath=${encodeURIComponent(String(folderPath ?? ''))}${limit ? `&limit=${encodeURIComponent(limit)}` : ''}${mark ? `&mark=${encodeURIComponent(mark)}` : ''}`;
    return _get(groupId ? `/connector/cards/${encodeURIComponent(String(groupId))}${q}` : `/connector/cards${q}`, 30_000);
}

/** GET /connector/visible-cards — the cards the gallery grid is SHOWING, in its order, with the filter in words. */
export async function visibleCards(limit) {
    return _get(`/connector/visible-cards${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`, 30_000);
}

/** POST /connector/card-mark { groupId, mark } — a CARD_MARKS id, or false to clear it. */
export async function markCard(groupId, mark) {
    return _post('/connector/card-mark', { groupId, mark: mark || false }, 60_000);
}

/** POST /connector/memory { folderPath, file, title, hook?, text } — create or replace one note. */
export async function writeMemory(folderPath, note) {
    return _post('/connector/memory', { ...note, folderPath }, 10_000);
}

// ---------------------------------------------------------------------------
// Attachment directory
// ---------------------------------------------------------------------------

/** Root dir for chat attachments. `APP_USER_DATA` set by Electron; os.tmpdir() for standalone. */
export function attachmentDir() {
    const base = process.env.APP_USER_DATA
        ? path.join(process.env.APP_USER_DATA, 'agent')
        : path.join(os.tmpdir(), 'cubric-agent');
    return path.join(base, 'attachments');
}

/** Root dir for describe crops. */
export function cropDir() {
    const base = process.env.APP_USER_DATA
        ? path.join(process.env.APP_USER_DATA, 'agent')
        : path.join(os.tmpdir(), 'cubric-agent');
    return path.join(base, 'crops');
}

/**
 * Create the attachment and crop dirs, then wipe any stale attachment files.
 * Called at server start and on /agent/reset.
 */
export async function initAttachmentDir() {
    const aDir = attachmentDir();
    const cDir = cropDir();
    await fs.mkdir(aDir, { recursive: true });
    await fs.mkdir(cDir, { recursive: true });
    // Wipe stale attachments (crops are derived from attachments, also wipe)
    await Promise.all(
        [aDir, cDir].map(async (dir) => {
            try {
                const entries = await fs.readdir(dir);
                await Promise.all(entries.map((e) => fs.rm(path.join(dir, e), { force: true })));
            } catch { /* non-fatal */ }
        }),
    );
}

/**
 * Drop one conversation's staged files on its reset (the other conversations keep theirs).
 * Only a file directly inside the attachment dir is touched, whatever path is passed.
 */
export async function discardAttachments(paths) {
    const dir = path.resolve(attachmentDir());
    await Promise.all((Array.isArray(paths) ? paths : []).map(async (p) => {
        const abs = path.resolve(String(p));
        if (path.dirname(abs) !== dir) return;
        try { await fs.rm(abs, { force: true }); } catch { /* already gone */ }
    }));
}

/** Generate a stable attachment id: `att_` + 8 hex chars. */
export function newAttachmentId() {
    return `att_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Save a base64 data URL to the attachment dir and return { id, filePath }.
 * Only JPEG, PNG and WebP are accepted; others are rejected.
 */
export async function saveAttachment(name, dataUrl) {
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s);
    if (!match) {
        throw Object.assign(new Error('Unsupported attachment type; only JPEG, PNG and WebP are accepted.'), { code: 'UNSUPPORTED_TYPE' });
    }
    const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
    const buf = Buffer.from(match[2], 'base64');
    const id = newAttachmentId();
    const filePath = path.join(attachmentDir(), `${id}.${ext}`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buf);
    return { id, filePath };
}

/**
 * Copy a staged attachment into the open project's content-addressed store
 * (`Media/.preview-assets/<sha256><ext>`) and return the `/project-file?path=…`
 * url a generation takes, per the contract § Tools.
 *
 * Media reaches a generation BY REFERENCE, never as bytes, and a raw path in the
 * agent's own scratch dir is not a project asset: it is wiped on the next server
 * start, so a Reuse of that card would resolve to nothing. The route's `dataUrl`
 * field takes a plain absolute path as well as a data URL (`copySnapshotSource`),
 * which is what lets the bytes stay on disk here.
 *
 * `:projectId` is not read by the route — the project is named by `folderPath`.
 */
export async function placeAsset(folderPath, absPath) {
    const ext = path.extname(absPath) || '.png';
    const p = `/project-media/agent/place-preview-asset?folderPath=${encodeURIComponent(folderPath)}`;
    return _post(p, { dataUrl: absPath, ext }, 60_000);
}
