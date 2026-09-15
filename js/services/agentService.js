/**
 * agentService.js — MPI-774: HTTP + SSE client for the in-app agent.
 *
 * Routes:
 *   POST /agent/message   { text, attachments, project, mode, profileId }
 *   GET  /agent/stream    SSE with named events
 *   GET  /agent/history   → { ok, working, pendingConfirm, usage, entries }
 *   POST /agent/confirm   { confirmId, yes }
 *
 * Never reads args.prompt — that stays server-side. Callers receive only what
 * the contract exposes (label, status, etc.).
 */

import { clientLogger } from './clientLogger.js';
import { Storage } from '../core/storage.js';
import { on } from '../utils/dom.js';

const AGENT_EVENT_NAMES = [
    'agent:working',
    'agent:message',
    'agent:tool',
    'agent:confirm',
    'agent:result',
    'agent:compacting',
    'agent:error',
];

/**
 * POST /agent/message
 * @param {string} text
 * @param {Array}  attachments  — array of { dataUrl, name } objects
 * @param {object|null} project — { folderPath, name } or null
 * @returns {Promise<{ok:boolean, turnId:string, attachments:Array}>}
 */
export async function agentSendMessage(text, attachments, project) {
    const { profileId, mode } = Storage.getAgentPrefs();
    const body = {
        text: text || '',
        attachments: attachments || [],
        project: project || null,
        mode,
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

/**
 * Open an SSE stream on /agent/stream.
 *
 * @param {(name: string, data: object) => void} onEvent
 * @returns {() => void} close function — call it in destroy()
 */
export function agentOpenStream(onEvent) {
    const es = new window.EventSource('/agent/stream');
    AGENT_EVENT_NAMES.forEach(name => {
        on(es, name, (e) => {
            try {
                onEvent(name, JSON.parse(e.data));
            } catch (err) {
                clientLogger.warn('agentService', `bad SSE payload for ${name}`, err);
            }
        });
    });
    on(es, 'error', () => clientLogger.warn('agentService', 'SSE connection error'));
    return () => es.close();
}
