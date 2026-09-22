/**
 * agentService.js — MPI-774: HTTP + SSE client for the in-app agent.
 *
 * Routes:
 *   POST /agent/message   { text, attachments, project, mode, model, profileId, pinned, workspace } → { ok, turnId, session }
 *   POST /agent/wake      { project, mode, model, profileId, pinned, workspace } → { ok, woke, session }
 *   GET  /agent/stream    SSE with named events (bridged to the app event bus)
 *   GET  /agent/history?project= → { ok, session, working, pendingConfirm, usage, entries }
 *   POST /agent/confirm   { confirmId, yes }
 *
 * One conversation per project, and one for the landing page (MPI-774 Phase 3c): every
 * event carries `session`, the key of the conversation it belongs to, and
 * `agent:session { from, to }` says a conversation moved into a project.
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
import { state } from '../state.js';
import { pinnedModel } from '../shell/agentDispatch.js';
import { PAGE_GROUP_HISTORY } from '../router.js';
import { isOperationInstalled } from '../data/modelRegistry.js';

export const AGENT_EVENT_NAMES = [
    'agent:working',
    'agent:message',
    'agent:tool',
    'agent:confirm',
    'agent:result',
    'agent:compacting',
    'agent:error',
    'agent:user',
    'agent:session',
    'agent:drained',
];

// ── Shared SSE singleton ──────────────────────────────────────────────────────
// One EventSource for the entire renderer lifetime. Opened lazily by
// agentInitStream() (called at shell init). All named events are re-emitted on
// the app Events bus so every subscriber — including multiple MpiAgentChat
// instances and future consumers — gets them without opening a second connection.

let _es = null;
// The bus subscriptions this module owns, kept beside the EventSource because they share its
// lifetime exactly: both are opened once at shell init and live until the window does. Nothing
// calls them today — a teardown for a singleton that is never torn down would be scaffolding.
const _streamUnsubs = [];

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

    // MPI-870 — the wake, owned by the renderer because only the renderer knows which
    // project is OPEN. A finished generation is otherwise silent until the user types.
    //
    // Both posts send the OPEN project, never the drained one: the connector's generate
    // route has no project targeting, so a wake turn that generated anything would land it
    // in whatever project is open. Project A drains while B is open -> this asks the server
    // to wake B, which has nothing pending and no-ops; A's notes wait in memory until A is
    // reopened, where `project:changed` posts again and A reports what landed.
    // That second post IS the "while you were away" report; it needs no condition here,
    // because an idle conversation with nothing pending answers `woke: false`.
    _streamUnsubs.push(Events.on('agent:drained', () => agentWake()));
    _streamUnsubs.push(Events.on('project:changed', () => agentWake()));
}

/**
 * POST /agent/wake — ask the server to run a turn for the OPEN project's conversation, if
 * its generations have landed and nothing has reported them yet. The server decides; this
 * only says which project the user is looking at. Never throws: a wake that cannot be sent
 * leaves the chat exactly as silent as it was before MPI-870.
 * @returns {Promise<{ok:boolean, woke?:boolean, session?:string}>}
 */
export async function agentWake() {
    try {
        const { model, mode } = Storage.getAgentPrefs();
        const { profileId } = Storage.getLlmConnection();
        if (!profileId) return { ok: false };
        const p = state.currentProject;
        const res = await window.fetch('/agent/wake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project: p?.folderPath ? { folderPath: p.folderPath, name: p.name } : null,
                mode,
                model,
                profileId,
                pinned: _pinnedForTurn(),
                workspace: _workspaceForTurn(),
            }),
        });
        return res.ok ? res.json() : { ok: false };
    } catch (err) {
        clientLogger.warn('agentService', 'wake failed', err);
        return { ok: false };
    }
}

/**
 * What the pinned settings panel is showing, or null while it is shut (MPI-774 Phase 7).
 *
 * The OPS matter as much as the id. Fabio's own case for this: "if the user asks for a
 * video and there is only an image model selected, the agent can tell the user, look, that
 * makes video, it doesn't make images, you need to select another model." The agent still
 * resolves task -> op; knowing what the pinned model can do is what lets it refuse in
 * words instead of discovering it through an OP_UNAVAILABLE.
 * @returns {{modelId:string, name:string, mediaType:string, ops:string[]}|null}
 */
function _pinnedForTurn() {
    if (state.agentSettingsPinned !== true) return null;
    const model = pinnedModel();
    if (!model) return null;
    return {
        modelId: model.id,
        name: model.name,
        mediaType: model.mediaType,
        ops: (model.supportedOps || []).filter((op) => isOperationInstalled(model, op)),
    };
}

/**
 * Which workspace the user is standing in, and the entry in front of them (MPI-890).
 *
 * The same shape of telling as `pinned` above, and for the same reason: renderer UI state
 * the agent cannot otherwise see. Fabio, 2026-09-22: "If the user is in the history
 * workspace, he shouldn't be forced to go into the gallery space to drag an image and send
 * it to the agent." He could not — the history view has no drag surface, so with a card
 * open the agent's only honest moves were list_cards or asking for an attachment.
 *
 * `activeEntry` carries the entry's PATH, not just its id: the App state line is the only
 * set of refs `look` and `generate` resolve, so an entry the agent is told about has to be
 * resolvable by that same path or it names a picture it cannot then open.
 *
 * The group's own `selectedIndex` is the live selection — MpiGroupHistoryBlock promotes and
 * persists it on every `entry-selected` — so nothing new has to be plumbed through the view.
 * @returns {{page:string, groupId:?string, card:?{name:string,type:string},
 *            activeEntry:?{itemId:string, filePath:string, modelId:?string}}}
 */
function _workspaceForTurn() {
    const page = state.currentPage;
    const groupId = state.currentParams?.groupId || null;
    const base = { page, groupId: null, card: null, activeEntry: null };
    if (page !== PAGE_GROUP_HISTORY || !groupId) return base;

    const group = (state.currentProject?.itemGroups || []).find((g) => g.id === groupId);
    if (!group) return base;

    const item = group.history?.[group.selectedIndex ?? 0] || null;
    return {
        page,
        groupId,
        card: { name: group.customName || group.name, type: group.type },
        activeEntry: item?.filePath
            ? { itemId: item.id, filePath: item.filePath, modelId: item.modelId || null }
            : null,
    };
}

/**
 * POST /agent/message
 * @param {string} text
 * @param {Array}  attachments  — array of { dataUrl, name } objects
 * @param {object|null} project — { folderPath, name }, or null for the landing page's conversation
 * @returns {Promise<{ok:boolean, turnId:string, session:string, attachments:Array}>}
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
        // MPI-774 Phase 7: with the settings panel open the USER owns the model, and the
        // agent still has to be told which one — it writes the prompt, and the Guide rule
        // adapts that prompt to the model's own structure. Sent per turn because the user
        // can change it between turns; null when the panel is shut and the model is the
        // agent's own to pick. agentDispatch is what ENFORCES it; this only informs.
        pinned: _pinnedForTurn(),
        // MPI-890: which workspace the user is standing in, and the entry in front of them.
        workspace: _workspaceForTurn(),
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
 * GET /agent/history — one conversation: a project's, or the landing page's when `folderPath` is empty.
 * @param {string|null} [folderPath]
 * @returns {Promise<{ok:boolean, session:string, working:boolean, pendingConfirm:object|null, usage:object, entries:Array}>}
 */
export async function agentGetHistory(folderPath) {
    try {
        const url = folderPath ? `/agent/history?project=${encodeURIComponent(folderPath)}` : '/agent/history';
        const res = await window.fetch(url);
        if (!res.ok) return { ok: false, entries: [], working: false, pendingConfirm: null };
        return res.json();
    } catch (err) {
        clientLogger.warn('agentService', 'history fetch failed', err);
        return { ok: false, entries: [], working: false, pendingConfirm: null };
    }
}

/**
 * POST /agent/reset — drop one conversation and its staged files.
 *
 * The route has existed since MPI-774 W1 and nothing ever called it, so the only way
 * to leave a conversation was to restart the app (the messages live in the server
 * fork, and `agentSessions.mjs` touches no disk). That bit: a transcript in which the
 * model has already refused something is the strongest instruction to refuse again,
 * and changing the model does not clear it — `runTurn` rebuilds only the system prompt.
 *
 * @param {string|null} [folderPath]  the project's conversation, or the landing one when empty
 * @returns {Promise<{ok:boolean}>}
 */
export async function agentReset(folderPath) {
    try {
        const url = folderPath ? `/agent/reset?project=${encodeURIComponent(folderPath)}` : '/agent/reset';
        const res = await window.fetch(url, { method: 'POST' });
        return res.ok ? res.json() : { ok: false };
    } catch (err) {
        clientLogger.warn('agentService', 'reset failed', err);
        return { ok: false };
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
