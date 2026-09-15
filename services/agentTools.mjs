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
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Loopback helpers
// ---------------------------------------------------------------------------

/** Base URL of this server's own HTTP surface. */
function loopbackBase() {
    return `http://127.0.0.1:${process.env.CUBRIC_PORT || 3000}`;
}

async function _get(p, timeoutMs = 10_000) {
    const res = await fetch(`${loopbackBase()}${p}`, {
        signal: AbortSignal.timeout(timeoutMs),
    });
    return res.json();
}

async function _post(p, body, timeoutMs = 1_800_000) {
    const res = await fetch(`${loopbackBase()}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
    });
    return res.json();
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
 * POST /connector/describe { imagePath, question?, crop? }
 * imagePath must be absolute. Crops and attachment resolution are done by the loop
 * before calling here.
 */
export async function look(args) {
    return _post('/connector/describe', args, 60_000);
}

/** POST /connector/open-project { folderPath } */
export async function openProject(folderPath) {
    return _post('/connector/open-project', { folderPath });
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
 * Resolve an image reference from a tool call to an absolute file path.
 * - `att_xxx` → file in attachment dir (any extension)
 * - anything else → treated as an already-absolute filePath
 * Returns null if the attachment is not found.
 */
export async function resolveImageRef(ref) {
    if (!ref) return null;
    if (ref.startsWith('att_')) {
        const dir = attachmentDir();
        try {
            const entries = await fs.readdir(dir);
            const match = entries.find((e) => e.startsWith(`${ref}.`));
            return match ? path.join(dir, match) : null;
        } catch { return null; }
    }
    return ref; // result filePath
}
