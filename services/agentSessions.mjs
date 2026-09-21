/**
 * services/agentSessions.mjs — one agent conversation per project (MPI-774 Phase 3c).
 *
 * Fabio, 2026-09-16: each project keeps its own conversation, so switching projects never
 * shows another project's; the landing page is a conversation of its own (key ''). His
 * decisions, all as recommended:
 * - D4: one turn at a time, app-wide. A turn started in project A finishes in A.
 * - D5: when a conversation opens another project, the LANDING conversation moves into it
 *   if that project has none yet (always true for a new one) and the landing page starts
 *   fresh. Otherwise the request is carried over and runs next in that project's own
 *   conversation.
 * - D6: memory only. The `<project>/Agent/` notes are what survives a restart.
 *
 * One SSE stream serves every conversation: each event carries `session` (the key of the
 * conversation it belongs to), and a move is announced as `agent:session { from, to }` so
 * the chats that show either side reload.
 * ponytail: conversations are never evicted; a cap (least recently used) if a long session
 * ever opens enough projects for their contexts to matter.
 */

import crypto from 'crypto';
import { AgentLoop, projectKey } from './agentLoop.mjs';

export { projectKey as sessionKey };

const EMPTY_HISTORY = { ok: true, working: false, pendingConfirm: null, usage: { promptTokens: 0, contextWindow: 0 }, entries: [] };

export class AgentSessions {
    /**
     * @param {object} [opts]
     * @param {object} [opts.loopOptions]  Handed to every AgentLoop (tests inject tools and the endpoint).
     * @param {function} [opts.setupLoop]  (loop) => void, run on each new loop (the fork bridge).
     */
    constructor({ loopOptions = {}, setupLoop = () => {} } = {}) {
        this._loopOptions = loopOptions;
        this._setupLoop = setupLoop;
        this._loops = new Map();       // session key -> AgentLoop
        this._subscribers = new Set(); // SSE responses, one stream for every conversation
        this._carry = null;            // a request on its way to another conversation (D5)
        this._queued = [];             // turns sent while another was running (MPI-840)
        this._probeLoop = null;
    }

    addSubscriber(res) { this._subscribers.add(res); }
    removeSubscriber(res) { this._subscribers.delete(res); }

    broadcast(event, data) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const sub of this._subscribers) {
            try { sub.write(payload); } catch { /* stale connection */ }
        }
    }

    _newLoop(key) {
        const loop = new AgentLoop({
            ...this._loopOptions,
            sessionKey: key,
            broadcast: (event, data) => this.broadcast(event, data),
            onProjectOpened: (source, project, turn) => this._projectOpened(source, project, turn),
        });
        this._setupLoop(loop);
        this._loops.set(key, loop);
        return loop;
    }

    /** The session key of a project's conversation ('' = the landing page). */
    keyOf(folderPath) {
        return projectKey(folderPath);
    }

    /** D4: one turn at a time across every conversation; a request being carried counts. */
    busy() {
        return !!this._carry || this._queued.length > 0 || [...this._loops.values()].some((l) => l._working);
    }

    /**
     * MPI-840: a turn sent while another is running waits its turn instead of being refused.
     * It used to come back BUSY and the text was gone — nothing stored it. It does NOT reach
     * the agent mid-thought: it runs after the current turn, so a correction to a generation
     * already dispatched arrives after the dispatch.
     */
    queue(turn) {
        this._queued.push(turn);
    }

    /**
     * MPI-870 — run a turn for a conversation whose generations have landed, so a finished
     * image is not silent until the user types. Called by the RENDERER, for THE PROJECT IT
     * HAS OPEN — never for the one that drained. The connector's generate route has no
     * project targeting, so a wake turn that generated anything would land it in whatever
     * project is open; the server cannot see which that is and the renderer can.
     *
     * That is also why this is safe to call on every project open: an idle conversation with
     * nothing pending answers `woke: false` and costs one function call. The post on open is
     * the "while you were away" report for work that finished in a project the user had left.
     *
     * @param {object} turn  the same shape `send` takes, minus the text
     * @returns {{ok: true, woke: boolean, session: string}}
     */
    wake(turn) {
        const key = projectKey(turn.project?.folderPath);
        const loop = this._loops.get(key);
        // Rule 1: only an IDLE conversation. A turn queued for this one, or being carried
        // into it, reads the same notes at its own start — waking would report them twice.
        const spokenFor = this._queued.some((t) => projectKey(t.project?.folderPath) === key)
            || projectKey(this._carry?.project?.folderPath) === key;
        if (!loop || spokenFor || !loop.canWake()) return { ok: true, woke: false, session: key };

        const wakeTurn = { ...turn, text: '', attachments: [], turnId: crypto.randomUUID(), wake: true };
        // D4 still holds: one turn at a time, app-wide. A wake does not jump the queue — it
        // joins it, so a wake raised while another project's turn runs is not simply lost.
        if (this.busy()) this.queue(wakeTurn);
        else this.send(wakeTurn).catch(() => { /* reported on the stream */ });
        return { ok: true, woke: true, session: key };
    }

    /** The history of a project's conversation ('' or no folder = the landing page), with its key. */
    history(folderPath) {
        const key = projectKey(folderPath);
        const loop = this._loops.get(key);
        return { ...(loop ? loop.getHistory() : EMPTY_HISTORY), session: key };
    }

    /** Clear one conversation; the others keep theirs. */
    async reset(folderPath) {
        const key = projectKey(folderPath);
        // A cleared conversation must not be answered by a turn typed before the clear.
        this._queued = this._queued.filter((t) => projectKey(t.project?.folderPath) !== key);
        const loop = this._loops.get(key);
        if (loop) await loop.reset();
    }

    /** The conversation whose install card this is, or null. */
    byConfirm(confirmId) {
        return [...this._loops.values()].find((l) => l._pendingConfirm?.confirmId === confirmId) || null;
    }

    attachmentPath(id) {
        for (const loop of this._loops.values()) {
            const p = loop.attachmentPath(id);
            if (p) return p;
        }
        return null;
    }

    /** Can the agent's model call a tool? Belongs to no conversation. */
    probe(profileId, model) {
        if (!this._probeLoop) {
            this._probeLoop = new AgentLoop(this._loopOptions);
            this._setupLoop(this._probeLoop);
        }
        return this._probeLoop.probe(profileId, model);
    }

    /**
     * Run one user turn in the conversation of `turn.project`, then the request it carried to
     * another project, if any. The caller does not wait for this.
     * @param {{text: string, attachments: Array, project: ?{folderPath: string, name: string},
     *          mode: string, profileId: string, turnId: string, model?: string, carried?: boolean,
     *          pinned?: ?{modelId: string, name: string, mediaType: string, ops: string[]}}} turn
     * @returns {Promise<string>} the key of the conversation the turn ran in
     */
    async send(turn) {
        const key = projectKey(turn.project?.folderPath);
        const loop = this._loops.get(key) || this._newLoop(key);
        try {
            await loop.runTurn(turn.text, turn.attachments, turn.project || null, turn.mode, turn.profileId, turn.turnId, { model: turn.model, carried: !!turn.carried, pinned: turn.pinned || null, wake: !!turn.wake });
        } finally {
            // The carry first: it is the second half of the request already running. Then what
            // the user typed meanwhile, oldest first (MPI-840) — that send drains the rest.
            // In a `finally` because `busy()` counts both: a turn that threw and handed on
            // nothing would hold every later message in the queue forever.
            const next = this._carry || this._queued.shift();
            this._carry = null;
            if (next) await this.send(next);
        }
        return key;
    }

    /**
     * D5, called by a loop right after its open_project succeeded.
     * 'moved': the conversation now belongs to the opened project, and its turn goes on there.
     * 'carry': its turn ends, and the request runs next in the opened project's own conversation.
     * null: the project it already belongs to.
     */
    _projectOpened(source, project, turn) {
        const key = projectKey(project?.folderPath);
        if (!key || key === source.sessionKey) return null;
        const target = this._loops.get(key);
        if (source.sessionKey === '' && (!target || target.isEmpty())) {
            this._loops.delete('');
            source.sessionKey = key;
            this._loops.set(key, source);
            this.broadcast('agent:session', { from: '', to: key });
            return 'moved';
        }
        const from = turn.fromName ? `From ${turn.fromName}` : 'From the landing page';
        this._carry = {
            text: `${from}: ${turn.text || '(see the attached image)'}`,
            attachments: turn.attachments,
            project,
            mode: turn.mode,
            profileId: turn.profileId,
            model: turn.model,
            // The panel does not change between the two halves of one carried request, so
            // the carried turn is told the same pinned model the original was (MPI-774 P7).
            pinned: turn.pinned || null,
            turnId: crypto.randomUUID(),
            carried: true,
        };
        return 'carry';
    }
}
