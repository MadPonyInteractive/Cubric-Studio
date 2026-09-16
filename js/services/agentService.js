/**
 * agentService.js — MPI-774: HTTP + SSE client for the in-app agent.
 *
 * Routes:
 *   POST /agent/message   { text, attachments, project, mode, model, profileId }
 *   GET  /agent/stream    SSE with named events (bridged to the app event bus)
 *   GET  /agent/history   → { ok, working, pendingConfirm, usage, entries }
 *   POST /agent/confirm   { confirmId, yes }
 *
 * SSE: one shared EventSource opened lazily by agentInitStream().
 * Every named SSE event is re-emitted on Events (the app bus) so any subscriber
 * can react without opening a second connection. MpiAgentChat instances and any
 * future mascot service subscribe via Events.on('agent:*', ...).
 *
 * Never reads args.prompt — that stays server-side. Callers receive only what
 * the contract exposes (label, status, etc.).
 */

import { clientLogger } from './clientLogger.js';
import { Storage } from '../core/storage.js';
import { Events } from '../events.js';
import { on } from '../utils/dom.js';

export const AGENT_EVENT_NAMES = [
    'agent:working',
    'agent:message',
    'agent:tool',
    'agent:confirm',
    'agent:result',
    'agent:compacting',
    'agent:error',
];

// ── Shared SSE singleton ──────────────────────────────────────────────────────
// One EventSource for the entire renderer lifetime. Opened lazily by
// agentInitStream() (called at shell init). All named events are re-emitted on
// the app Events bus so every subscriber — including multiple MpiAgentChat
// instances and future consumers — gets them without opening a second connection.

let _es = null;

/**
 * Open the shared SSE connection (idempotent — safe to call multiple times).
 * Must be called before any MpiAgentChat mounts so history replay gets SSE events.
 */
export function agentInitStream() {
    if (_es) return;
    _es = new window.EventSource('/agent/stream');
    AGENT_EVENT_NAMES.forEach(name => {
        on(_es, name, (e) => {
            try {
                Events.emit(name, JSON.parse(e.data));
            } catch (err) {
                clientLogger.warn('agentService', `bad SSE payload for ${name}`, err);
            }
        });
    });
    on(_es, 'error', () => clientLogger.warn('agentService', 'SSE connection error'));
}

/**
 * POST /agent/message
 * @param {string} text
 * @param {Array}  attachments  — array of { dataUrl, name } objects
 * @param {object|null} project — { folderPath, name } or null
 * @returns {Promise<{ok:boolean, turnId:string, attachments:Array}>}
 */
export async function agentSendMessage(text, attachments, project) {
    const { model, mode } = Storage.getAgentPrefs();
    const { profileId } = Storage.getLlmConnection();
    const body = {
        text: text || '',
        attachments: attachments || [],
        project: project || null,
        mode,
        model,
        profileId,
    };
    const res = await window.fetch('/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { code: 'HTTP_ERROR' } }));
        throw Object.assign(
            new Error(err.error?.message || 'Agent request failed'),
            { code: err.error?.code || 'HTTP_ERROR' },
        );
    }
    return res.json();
}

/**
 * GET /agent/history
 * @returns {Promise<{ok:boolean, working:boolean, pendingConfirm:object|null, usage:object, entries:Array}>}
 */
export async function agentGetHistory() {
    try {
        const res = await window.fetch('/agent/history');
        if (!res.ok) return { ok: false, entries: [], working: false, pendingConfirm: null };
        return res.json();
    } catch (err) {
        clientLogger.warn('agentService', 'history fetch failed', err);
        return { ok: false, entries: [], working: false, pendingConfirm: null };
    }
}

/**
 * POST /agent/confirm
 * @param {string}  confirmId
 * @param {boolean} yes
 * @returns {Promise<{ok:boolean}>}
 */
export async function agentPostConfirm(confirmId, yes) {
    const res = await window.fetch('/agent/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmId, yes }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { code: 'HTTP_ERROR' } }));
        throw Object.assign(
            new Error(err.error?.message || 'Confirm failed'),
            { code: err.error?.code || 'HTTP_ERROR' },
        );
    }
    return res.json();
}
