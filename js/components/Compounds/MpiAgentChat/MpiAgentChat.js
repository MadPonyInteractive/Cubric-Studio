/**
 * MpiAgentChat — MPI-774 in-app agent chat UI (Compound).
 *
 * Props:
 *   standalone {boolean}  — true → the landing chat: its own mascot above the transcript.
 *                           false/absent → the panel (agentPanel.js): a compact header
 *                           instead. BOTH render the composer (MPI-797 Phase 2); the
 *                           panel no longer borrows MpiPromptBox's agent mode for input.
 *                           MPI-797 Phase 3 deleted that route outright — the 'agent:send'
 *                           event, its only producer (the prompt box's toggle) and the
 *                           listener that stood in for this composer are all gone.
 *
 * Public API (on el):
 *   el.setWorking(bool)                — set the agent:working state externally.
 *   el.destroy()                       — teardown (unsub, no SSE to close — shared singleton).
 *
 * SSE events consumed: agent:working, agent:message, agent:tool, agent:confirm,
 *                       agent:result, agent:compacting, agent:error, agent:user, agent:session,
 *                       agent:spend.
 * These are bridged from SSE to the app bus by agentService.agentInitStream().
 * This component subscribes via Events.on — it never opens its own EventSource.
 *
 * One conversation per project (MPI-774 Phase 3c): the standalone (landing) chat shows
 * the landing page's conversation, the panel shows the open project's. Every event names
 * its conversation (`session`), and a chat renders only its own. It reloads from history
 * when the project changes and when `agent:session` says a conversation moved.
 *
 * Brief item 12: agent:tool.label is the only text shown — args.prompt is NEVER
 * rendered here.
 */

import { ComponentFactory }    from '../../factory.js';
import { MpiButton }           from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput }            from '../../Primitives/MpiInput/MpiInput.js';
import { qs, on, ce }          from '../../../utils/dom.js';
import { createMascotClipQueue } from '../../../utils/mascotClipQueue.js';
import { TRANSITIONS, TRANSITION_MS, handOverClip } from '../../../shell/heroCrew.js';
import { renderIcon }          from '../../../utils/icons.js';
import { renderMarkdownInto, wireMarkdownLinks } from '../../../utils/markdown.js';
import { resolveMediaUrl, cardAttachmentSource } from '../../../utils/mediaActions.js';
import { Events }              from '../../../events.js';
import { clientLogger }        from '../../../services/clientLogger.js';
import { state }               from '../../../state.js';
import { PAGE_LANDING }        from '../../../router.js';
import { getCommandAccent, getCommandProgressLabel } from '../../../data/commandRegistry.js';
import {
    agentSendMessage,
    agentGetHistory,
    agentPostConfirm,
    agentReset,
} from '../../../services/agentService.js';

/**
 * Cosmo's ledge, in both modes. On the landing he stands BEHIND the block's top rule, which
 * cuts him off at the shoulders, so only a peek clears it and the composer sits straight on
 * that line (Fabio, 2026-09-22; this replaced a 48px still and an "Ask me anything" label).
 * Landing only: the panel's crew ledge plays standing figures instead. Two stacked clips rather than
 * one with a swapped src: assigning src to the visible element blanks it until the first
 * frame decodes (MPI-777 Phase 3). Both loop, so nothing here needs a timer or the clip queue.
 */
const _COSMO_LEDGE = `
            <div class="mpi-agent-chat__ledge" aria-hidden="true">
                <video class="mpi-agent-chat__ledge-clip mpi-agent-chat__ledge-clip--live"
                       id="ac-ledge-rest" src="assets/mascot/studio/peek.webm"
                       muted playsinline loop preload="auto"></video>
                <video class="mpi-agent-chat__ledge-clip mpi-agent-chat__ledge-clip--standing"
                       id="ac-ledge-work" src="assets/mascot/studio/agent-thinking.webm"
                       muted playsinline loop preload="auto"></video>
            </div>`;

/**
 * The guest on the panel's crew ledge, keyed by `getCommandAccent` (what an op MAKES). The
 * names mirror heroCrew.js `CREW`; `studio` has no guest, because Cosmo is already there.
 */
const _GUESTS = Object.freeze({ vision: 'Prism', video: 'Reel', audio: 'Vinyl', prompt: 'Lingo' });

/**
 * The panel ledge plays STANDING figures with their feet on the composer's top rule
 * (Fabio, 2026-09-22 - the head peeks were "too boring" and belong over the prompt box).
 * The feet are not on the frame edge, and not on one row for every clip: measured as the
 * lowest alpha row of each 620x620 clip, constant across its frames. 557 for every idle,
 * greet, happy and agent-state clip; the working clips differ per mascot. Copied here
 * and nowhere else. ponytail: re-measure if a clip is re-staged.
 */
const _FEET_ROW = 557;
const _FEET = Object.freeze({
    'vision/working': 570, 'video/working': 528, 'audio/working': 584, 'prompt/working': 580,
    'studio/working': 582,
    'vision/getting-ready': 577, 'video/getting-ready': 580, 'audio/getting-ready': 546, 'prompt/getting-ready': 578,
});
const _feet = (key, clip) => _FEET[`${key}/${clip}`] ?? _FEET_ROW;

/**
 * Cosmo's pools on the panel ledge, driven by the shared clip queue as the landing crew
 * is. `ms` is each clip's real length (5.2s idles, 3.0s the rest, as heroCrew.js `POOLS`),
 * which the queue runs on until `_probe` reads the exact one off the metadata. A short guess
 * cut the first clips after the panel opened mid-motion, and that read as a flicker.
 */
const _COSMO_STATES = () => ({
    idle:     { clips: [...['idle-1', 'idle-2', 'idle-3'].map(id => ({ id, ms: 5200 })), { id: 'agent-listening', ms: 3000 }], loop: true },
    // Thinking is Cosmo AT THE KEYBOARD (picked by eye, Fabio 2026-09-22); hand-on-chin is
    // kept for while he looks at a picture.
    thinking: { clips: [{ id: 'working', ms: 3000 }], loop: true },
    looking:  { clips: [{ id: 'agent-thinking', ms: 3000 }], loop: true },
    answer:   { clips: [{ id: 'agent-answer-ready', ms: 3000 }] },
    greet:    { clips: ['greet-1', 'greet-2'].map(id => ({ id, ms: 3000 })) },
    happy:    { clips: [{ id: 'happy-1', ms: 3000 }] },
});
/**
 * What the agent is DOING, by tool, on the ledge (Fabio, 2026-09-22: "Lingo when it is
 * writing a prompt, Prism when it is looking at images"). `cosmo` is his state while the
 * tool runs; `guest` is who stands in, on which clip (each picked by eye: Prism focusing
 * his lens, Lingo unrolling a long scroll of text). No event marks the prompt being
 * WRITTEN - it is text before the `generate` call - so Lingo arrives with that call and
 * hands over to the job's own mascot when `generation:started` lands. Any tool not listed
 * keeps Cosmo at the keyboard with no guest.
 */
const _TOOL_CREW = Object.freeze({
    look:     { cosmo: 'looking', guest: { key: 'vision', clip: 'getting-ready', verb: 'looking closely' } },
    generate: { cosmo: 'thinking', guest: { key: 'prompt', clip: 'working', verb: 'writing the prompt' } },
});

/** Added to a measured length, so the queue's timer never cuts the rest frame the next clip opens on. */
const _CLIP_PAD_MS = 60;

/** Pause and drop the source: the only thing that frees a hidden video's decoder. */
function _releaseClip(v) {
    if (!v) return;
    v.pause();
    v.removeAttribute('src');
    v.load();
}

export const MpiAgentChat = ComponentFactory.create({
    name: 'MpiAgentChat',
    css: ['js/components/Compounds/MpiAgentChat/MpiAgentChat.css'],

    template: (props) => `
        <div class="mpi-agent-chat${props.standalone ? ' mpi-agent-chat--standalone' : ''}">

            <!-- Compact header: label + working indicator (panel mode) -->
            ${!props.standalone ? `
            <div class="mpi-agent-chat__header" id="ac-header">
                <!-- MPI-843: Cosmo as a persistent 20px identity beside the label. Never moves. -->
                <img class="mpi-agent-chat__header-face" src="assets/mascot/studio/logo.webp" alt="" draggable="false">
                <span class="mpi-agent-chat__header-label">Cosmo</span>
                <!-- MPI-855: what this conversation spent on the user's key, chat and generations apart -->
                <span class="mpi-agent-chat__spend hide" id="ac-spend" title="What this conversation has spent on your DeepInfra key: the chat itself, and the cloud generations it ran"></span>
                <span class="mpi-agent-chat__header-action" id="ac-reset-slot"></span>
                <span class="mpi-agent-chat__working-dot" id="ac-working-dot"></span>
            </div>
            ` : _COSMO_LEDGE}

            <!-- Transcript -->
            <div class="mpi-agent-chat__transcript" id="ac-transcript"></div>

            ${!props.standalone ? `
            <!-- The panel's crew ledge (MPI-843, MPI-777 Phase 4): Cosmo on the left, the
                 mascot of whatever job is running sliding in on the right, so there is one
                 place the eye checks for "who is working". Fixed height: nothing here may
                 reflow the transcript or move the composer. -->
            <div class="mpi-agent-chat__crew" aria-hidden="true">
                <!-- Clickable for the landing's party trick: a puff, and he re-forms cheering.
                     The body wraps both clips so the puff can take him and leave itself. -->
                <div class="mpi-agent-chat__crew-stand mpi-agent-chat__crew-stand--cosmo" id="ac-cosmo">
                    <div class="mpi-agent-chat__crew-body">
                        <video class="mpi-agent-chat__crew-clip mpi-agent-chat__crew-clip--live"
                               id="ac-cosmo-a" muted playsinline preload="auto"></video>
                        <video class="mpi-agent-chat__crew-clip"
                               id="ac-cosmo-b" muted playsinline preload="auto"></video>
                    </div>
                    <video class="mpi-agent-chat__crew-clip mpi-agent-chat__crew-fx"
                           id="ac-cosmo-fx" muted playsinline preload="auto"></video>
                </div>
                <span class="mpi-agent-chat__crew-txt">
                    <span class="mpi-agent-chat__crew-name">Cosmo</span>
                    <span class="mpi-agent-chat__crew-state" id="ac-crew-state">listening</span>
                </span>
                <div class="mpi-agent-chat__crew-guest" id="ac-guest">
                    <span class="mpi-agent-chat__crew-txt mpi-agent-chat__crew-txt--end">
                        <span class="mpi-agent-chat__crew-name" id="ac-guest-name"></span>
                        <span class="mpi-agent-chat__crew-state" id="ac-guest-state"></span>
                    </span>
                    <div class="mpi-agent-chat__crew-stand">
                        <video class="mpi-agent-chat__crew-clip mpi-agent-chat__crew-clip--live"
                               id="ac-guest-a" muted playsinline preload="auto"></video>
                        <video class="mpi-agent-chat__crew-clip"
                               id="ac-guest-b" muted playsinline preload="auto"></video>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Composer — both modes (MPI-797 Phase 2). The panel used to borrow
                 MpiPromptBox's agent mode for input; it has its own row now. -->
            <div class="mpi-agent-chat__input-row">
                <div class="mpi-agent-chat__attachments" id="ac-attachments" style="display:none"></div>
                <div class="mpi-agent-chat__input-wrap" id="ac-input-slot"></div>
                <div id="ac-send-slot"></div>
            </div>

        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];
        let _working = false;
        /** @type {Array<{dataUrl:string, name:string}>} */
        let _pendingAttachments = [];
        /** The conversation shown: '' = the landing page, else the server's key for the project; null = none yet. */
        let _session = props.standalone ? '' : null;
        let _loading = null;   // the history load in flight; events wait for it
        let _queued = [];      // [name, data] that arrived during that load
        const _buttons = [];   // confirm-card buttons, destroyed when the transcript is cleared

        const ledgeRest  = qs('#ac-ledge-rest',    el);
        const ledgeWork  = qs('#ac-ledge-work',    el);
        const workingDot = qs('#ac-working-dot',   el);
        const spendEl    = qs('#ac-spend',         el);
        const transcript = qs('#ac-transcript',    el);
        const crewState  = qs('#ac-crew-state',    el);
        const guest      = qs('#ac-guest',         el);
        const guestA     = qs('#ac-guest-a',       el);
        const guestB     = qs('#ac-guest-b',       el);
        const cosmoStand = qs('#ac-cosmo',         el);
        const cosmoA     = qs('#ac-cosmo-a',       el);
        const cosmoB     = qs('#ac-cosmo-b',       el);
        const cosmoFx    = qs('#ac-cosmo-fx',      el);
        const CREW_LIVE  = 'mpi-agent-chat__crew-clip--live';
        /** Cosmo, taken by a transition's puff. See `_paintCosmoFx`. */
        const CREW_GONE  = 'mpi-agent-chat__crew-stand--vanished';
        /** Reduced motion holds a first frame and never plays, exactly as the crew does. */
        const _still = matchMedia('(prefers-reduced-motion: reduce)').matches;

        // A link the agent writes (the docs site when it cannot answer something) is a bare
        // `<a href>` in rendered markdown, and clicking one inside Electron navigates the whole
        // app away with no way back. Delegated on the transcript, so it covers every message
        // without re-wiring per render.
        _unsubs.push(wireMarkdownLinks(transcript));

        // ── Working state helpers ─────────────────────────────────────────────
        const LIVE_CLIP = 'mpi-agent-chat__ledge-clip--live';
        let _ledgeLive = ledgeRest;
        let _ledgeSeq = 0;

        /**
         * Cross the two ledge clips. Both are already decoded and looping, so this is an
         * opacity swap with no blank frame and nothing to schedule — the label that used
         * to say "Thinking…" is gone, so Cosmo's own clip IS the working state now.
         */
        function _setLedge(working) {
            if (!ledgeRest || !ledgeWork) return;
            const [next, prev] = working ? [ledgeWork, ledgeRest] : [ledgeRest, ledgeWork];
            const seq = ++_ledgeSeq;
            const show = () => {
                // Working then idle at once (a BUSY reply) starts two plays; the older resolving
                // last must not flip him back to thinking while idle.
                if (seq !== _ledgeSeq) return;
                next.classList.add(LIVE_CLIP);
                prev.classList.remove(LIVE_CLIP);
                prev.pause();
                _ledgeLive = next;
            };
            // Hidden, it only swaps: `_syncPlay` starts the live clip when the chat is seen again.
            if (_still || !_seen()) show();
            else next.play().then(show, show);
        }

        // Both chats are mounted ONCE and never destroyed — the landing chat by projectUI.js
        // (the landing is only `.hide`d), the panel by agentPanel.js (it is only closed) — so
        // without this their clips would decode unseen for the app's lifetime. Play only
        // while the chat can be seen: the landing chat on the landing, the panel while it is
        // open away from it.
        const _seen = () => props.standalone
            ? state.currentPage === PAGE_LANDING
            : !!state.agentMode && state.currentPage !== PAGE_LANDING;
        function _syncPlay() {
            _syncCosmo();
            const live = [props.standalone && _ledgeLive, guest?.classList.contains(_GUEST_IN) && _guestShown].filter(Boolean);
            if (_seen() && !_still) live.forEach(v => v.play().catch(() => {}));
            else {
                [ledgeRest, ledgeWork, guestA, guestB].forEach(v => v?.pause());
                // A guest mid-farewell would wait for an `ended` that a paused clip never fires.
                if (guest) _guestOut();
            }
        }

        // ── Cosmo on the panel ledge ──────────────────────────────────────────
        // A clip queue, as each landing crew member has. He rests on his idles and plays
        // what the agent is DOING the rest of the time (`_cosmoWant`), not a rotation. The
        // queue exists only while the panel is seen: its timer chain re-arms for ever, and
        // the panel is never destroyed.
        const _cosmoStates = _COSMO_STATES();
        const _cosmoTransitions = Object.entries(TRANSITIONS.studio)
            .map(([name, swapAtMs]) => ({ id: `transition-${name}`, ms: TRANSITION_MS, swapAtMs }));
        let _cosmoQueue = null;
        let _cosmoShown = cosmoA;
        let _cosmoSeq = 0;
        let _probed = false;
        /** The agent tool running now, by name: what he is doing while he works. */
        let _tool = null;

        const _cosmoWant = () => (_working ? (_TOOL_CREW[_tool]?.cosmo || 'thinking') : 'idle');

        /** Cut to what the agent is doing now, unless he is already doing it. */
        function _cosmoFollow() {
            const want = _cosmoWant();
            if (want !== 'idle' && _cosmoQueue && _cosmoQueue.current().state !== want) {
                _cosmoQueue.request(want, { interrupt: true, transition: false });
            }
        }

        /** Write each clip's real length into the object the queue times against, then let go of it. */
        function _probe() {
            if (_probed) return;
            _probed = true;
            for (const def of Object.values(_cosmoStates)) for (const c of def.clips) {
                const v = ce('video', { preload: 'metadata', muted: true, src: `assets/mascot/studio/${c.id}.webm` });
                on(v, 'loadedmetadata', () => {
                    if (v.duration) c.ms = Math.round(v.duration * 1000) + _CLIP_PAD_MS;
                    _releaseClip(v);
                }, { once: true });
            }
        }

        /**
         * Two stacked clips: a src on the visible one blanks it. The hidden one takes over on its
         * first PRESENTED frame (play() resolving is earlier, before any frame is decoded to
         * screen), and the old one holds its last frame until the new one has drawn
         * (`handOverClip` - Fabio's "some swaps flicker"). heroCrew.js `_paintClip` is the twin.
         */
        function _paintCosmo(id) {
            const next = _cosmoShown === cosmoA ? cosmoB : cosmoA;
            const seq = ++_cosmoSeq;
            next.classList.remove(CREW_LIVE);   // still up from an unfinished handover
            next.style.setProperty('--feet', _feet('studio', id));
            next.src = `assets/mascot/studio/${id}.webm`;
            const show = () => {
                // A play() from a swap already overtaken, or from a queue since torn down, must not flip.
                if (seq !== _cosmoSeq || !_cosmoQueue || _cosmoShown === next) return;
                handOverClip(_cosmoShown, next, CREW_LIVE);
                _cosmoShown = next;
                // A puff took him (`_paintCosmoFx`): he re-forms here, under its densest moment.
                cosmoStand.classList.remove(CREW_GONE);
            };
            if (_still) on(next, 'loadeddata', show, { once: true });
            else next.play().then(() => next.requestVideoFrameCallback(show), () => {});
        }

        /** The click's overlay, as the landing crew's: he goes at once and comes back with the new clip. */
        function _paintCosmoFx(id) {
            if (!id) {
                cosmoStand.classList.remove(CREW_GONE);
                cosmoFx.classList.remove(CREW_LIVE);
                _releaseClip(cosmoFx);
                return;
            }
            cosmoStand.classList.add(CREW_GONE);
            cosmoFx.src = `assets/mascot/studio/${id}.webm`;
            cosmoFx.classList.add(CREW_LIVE);
            cosmoFx.play().catch(() => {});
        }

        function _syncCosmo() {
            if (!cosmoA) return;
            const seen = _seen();
            if (seen && !_cosmoQueue) {
                _probe();
                _cosmoQueue = createMascotClipQueue({
                    states: _cosmoStates, transitions: _cosmoTransitions, rest: 'idle',
                    paint: _paintCosmo, paintTransition: _paintCosmoFx, reducedMotion: _still,
                });
                if (_working) _cosmoFollow();
                else _cosmoQueue.request('greet');
            } else if (!seen && _cosmoQueue) {
                _cosmoQueue.destroy();
                _cosmoQueue = null;
                _paintCosmoFx(null);
                [cosmoA, cosmoB].forEach(_releaseClip);
            }
        }
        _unsubs.push(Events.onState('currentPage', _syncPlay));
        if (!props.standalone) _unsubs.push(Events.onState('agentMode', _syncPlay));

        // The landing's party trick, on a deliberate click only: a puff, a cheer, and back to
        // whatever he was doing. The queue holds the "back to" behind the cheer.
        if (cosmoStand) _unsubs.push(on(cosmoStand, 'click', () => {
            if (!_cosmoQueue) return;
            _cosmoQueue.request('happy', { interrupt: true });
            if (_working) _cosmoQueue.request(_cosmoWant());
        }));

        // ── The guest (panel only) ────────────────────────────────────────────
        // Whoever is doing the work: the NEWEST generation still in flight, whatever sent it,
        // else the specialist for the agent's own tool (`_TOOL_CREW`). A job's guest arrives
        // getting ready, works, and leaves on how it ended - a cheer, a shrug, a fall.
        // ponytail: generations carry no "the agent sent this" tag, so a job the user starts
        // from the prompt box shows here too — which is still the honest "who is working".
        // Tag `queueSource` at the connector if the ledge should ever show the agent's only.
        const _running = new Map();   // generation id → operation, in start order
        let _toolGuest = null;        // { id, key, clip, verb } while a `_TOOL_CREW` tool runs
        let _guestId = null;          // 'job:vision', 'tool:prompt' ... what the slot shows now
        let _guestShown = guestA;
        let _guestSeq = 0;
        let _guestSince = 0;
        let _guestTimer = null;
        const _GUEST_IN = 'mpi-agent-chat__crew-guest--in';
        const _GUEST_END = Object.freeze({
            complete:  { clip: 'happy-1',   label: 'done' },
            cancelled: { clip: 'cancelled', label: 'cancelled' },
            error:     { clip: 'failed',    label: 'failed' },
        });

        /**
         * Show one guest clip on the hidden twin and swap once it plays, as Cosmo does.
         * `then` runs when a play-once clip ends. Resolves when the clip is on screen.
         * Unseen, it only swaps: `_syncPlay` starts it when the panel opens again.
         */
        function _guestPlay(key, clip, { loop = true, then = null } = {}) {
            const next = _guestShown === guestA ? guestB : guestA;
            const seq = ++_guestSeq;
            next.classList.remove(CREW_LIVE);   // still up from an unfinished handover
            next.loop = loop;
            next.style.setProperty('--feet', _feet(key, clip));
            next.src = `assets/mascot/${key}/${clip}.webm`;
            if (then) on(next, 'ended', () => { if (seq === _guestSeq) then(); }, { once: true });
            const show = () => {
                if (seq !== _guestSeq || _guestShown === next) return;
                handOverClip(_guestShown, next, CREW_LIVE);
                _guestShown = next;
            };
            if (_still || !_seen()) { show(); return Promise.resolve(); }
            // On its first presented frame, as `_paintCosmo`: play() resolving is too early.
            return next.play().then(() => new Promise(r => next.requestVideoFrameCallback(() => { show(); r(); })), show);
        }

        function _guestWanted() {
            const last = [..._running.values()].pop();
            const key  = last && getCommandAccent(last);
            if (_GUESTS[key]) return { kind: 'job', key, verb: getCommandProgressLabel(last).toLowerCase() };
            return _toolGuest && { kind: 'tool', ..._toolGuest };
        }

        /** Slide out, then drop both sources: hiding a video keeps its decoder alive. */
        function _guestOut() {
            if (_guestId || !guest.classList.contains(_GUEST_IN)) return;
            guest.classList.remove(_GUEST_IN);
            // After the slide-out, or he would blank mid-exit. Skipped if a guest came back.
            setTimeout(() => { if (!_guestId) [guestA, guestB].forEach(_releaseClip); }, 400);
        }

        /** @param {'complete'|'cancelled'|'error'} [ended] - how the job that just left ended. */
        function _paintGuest(ended) {
            const want = _guestWanted();
            const stateEl = qs('#ac-guest-state', el);
            if (!want) {
                if (!_guestId) return;
                const leaving = _guestId.split(':')[1];
                _guestId = null;
                clearInterval(_guestTimer);
                const end = _GUEST_END[ended];
                // Seen, he plays how it went before he leaves; unseen there is nothing to watch.
                if (end && _seen() && !_still) {
                    stateEl.textContent = end.label;
                    _guestPlay(leaving, end.clip, { loop: false, then: _guestOut });
                } else _guestOut();
                return;
            }
            const id = `${want.kind}:${want.key}`;
            // A job taking over from a tool guest starts its clock too, or it counts from 1970.
            const arriving = !guest.classList.contains(_GUEST_IN) || !_guestId?.startsWith('job:');
            let shown = Promise.resolve();
            if (id !== _guestId) {
                _guestId = id;
                guest.dataset.accent = want.key;
                qs('#ac-guest-name', el).textContent = _GUESTS[want.key];
                shown = want.kind === 'job'
                    ? _guestPlay(want.key, 'getting-ready', { loop: false, then: () => _guestPlay(want.key, 'working') })
                    : _guestPlay(want.key, want.clip);
            }
            clearInterval(_guestTimer);
            if (want.kind === 'job') {
                if (arriving) _guestSince = Date.now();
                const tick = () => {
                    const s = Math.floor((Date.now() - _guestSince) / 1000);
                    stateEl.textContent = `${want.verb} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
                };
                tick();
                _guestTimer = setInterval(tick, 1000);
            } else stateEl.textContent = want.verb;
            shown.then(() => { if (_guestId === id) guest.classList.add(_GUEST_IN); });
        }

        if (guest) {
            _unsubs.push(Events.on('generation:started', ({ id, operation } = {}) => {
                _running.set(id, operation);
                _paintGuest();
            }));
            for (const [name, ended] of [['generation:complete', 'complete'], ['generation:cancelled', 'cancelled'], ['generation:error', 'error']]) {
                _unsubs.push(Events.on(name, ({ id } = {}) => {
                    if (!_running.delete(id)) return;
                    _paintGuest(ended);
                    // A finished job is worth a cheer, once his own work is done.
                    if (ended === 'complete' && !_working) _cosmoQueue?.request('happy');
                }));
            }
        }

        /** An agent tool started or finished: Cosmo and the guest follow what it is doing. */
        function _onTool({ id, tool, status } = {}) {
            if (!guest) return;
            const crew = _TOOL_CREW[tool];
            if (status === 'started') {
                _tool = tool;
                if (crew?.guest) _toolGuest = { id, ...crew.guest };
            } else {
                if (_tool === tool) _tool = null;
                if (_toolGuest?.id === id) _toolGuest = null;
            }
            _cosmoFollow();
            _paintGuest();
        }

        _syncPlay();

        /**
         * MPI-855 — the session's spend, chat and generations kept APART: a question costs
         * about half a cent and one 1080p clip $1.90, so one total would hide which is the
         * spend. Hidden while both are zero (a local-only conversation costs nothing).
         */
        function _setSpend(spend) {
            if (!spendEl) return;
            const chat = Number(spend?.chatUsd) || 0;
            const gen = Number(spend?.genUsd) || 0;
            const usd = v => `$${v > 0 && v < 0.01 ? Number(v.toPrecision(1)) : v.toFixed(2)}`;
            spendEl.classList.toggle('hide', !(chat > 0 || gen > 0));
            spendEl.textContent = `Chat ${usd(chat)} · Generations ${usd(gen)}`;
        }

        function _setWorking(working) {
            _working = working;
            // Panel mode: toggle working dot
            if (workingDot) workingDot.classList.toggle('mpi-agent-chat__working-dot--on', working);
            // Cosmo swaps to his working clip on the ledge, in both modes. The panel cuts
            // straight in (a thought cannot wait out an idle) and lets the answer wait its turn.
            _setLedge(working);
            if (working) _cosmoFollow();
            else {
                if (['thinking', 'looking'].includes(_cosmoQueue?.current().state)) _cosmoQueue.request('answer');
                // A turn that ended mid-tool (an error, a stop) leaves nobody standing in.
                _tool = null;
                if (_toolGuest) { _toolGuest = null; _paintGuest(); }
            }
            if (crewState) crewState.textContent = working ? 'holding the thread' : 'listening';
            emit('working', { working });
        }

        // ── Scroll helpers ────────────────────────────────────────────────────
        function _scrollBottom() {
            transcript.scrollTop = transcript.scrollHeight;
        }

        // ── Entry builders ────────────────────────────────────────────────────

        /**
         * One numbered attachment chip. The NUMBER is the name the user and the agent
         * share — a picture is "1", never "the start frame" or "picture 1" — so the
         * composer and the sent bubble draw the same thing from one place.
         */
        function _attachmentChip(dataUrl, name, n) {
            const chip = document.createElement('span');
            chip.className = 'mpi-agent-chat__attachment';
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = name || 'attachment';
            img.className = 'mpi-agent-chat__attachment-thumb';
            const num = document.createElement('span');
            num.className = 'mpi-agent-chat__attachment-num';
            num.textContent = String(n);
            chip.append(img, num);
            return chip;
        }

        /** User bubble (right-aligned). `id` (a history entry's) draws it once. */
        function _appendUser(text, attachments, id) {
            if (id && qs(`[data-entry-id="${CSS.escape(id)}"]`, transcript)) return;
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--user';
            if (id) div.dataset.entryId = id;
            const bubble = document.createElement('div');
            bubble.className = 'mpi-agent-chat__bubble';
            if (text) bubble.textContent = text;
            // The thumbs go in their own row UNDER the text, never appended straight to the
            // bubble: as inline siblings of a text node they wrapped into the middle of the
            // sentence (Fabio, round 2).
            if (attachments && attachments.length) {
                const row = document.createElement('div');
                row.className = 'mpi-agent-chat__attachments mpi-agent-chat__attachments--in-bubble';
                // Numbered here too (Fabio, 2026-09-20), so a follow-up can say "make 2
                // warmer" and point at something still on screen. Counted on what is
                // DRAWN, not on the array index — a history entry with no dataUrl is
                // skipped, and a gap in the numbering would name a picture nobody sees.
                let n = 0;
                attachments.forEach(({ dataUrl, url, name }) => {
                    // A card sent by reference (MPI-886) has a url and no dataUrl.
                    const src = dataUrl || url;
                    if (!src) return;
                    row.appendChild(_attachmentChip(src, name, ++n));
                });
                if (row.childElementCount) bubble.appendChild(row);
            }
            div.appendChild(bubble);
            transcript.appendChild(div);
            _scrollBottom();
        }

        /**
         * Agent message entry — returns the container so SSE can append to it
         * if the same turnId+id pair arrives multiple times (unlikely but safe).
         */
        function _appendMessage(text, id) {
            if (id && qs(`[data-entry-id="${CSS.escape(id)}"]`, transcript)) return null;
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--message';
            if (id) div.dataset.entryId = id;
            const md = document.createElement('div');
            md.className = 'mpi-md';
            renderMarkdownInto(md, text || '');
            div.appendChild(md);
            transcript.appendChild(div);
            _scrollBottom();
            return div;
        }

        /** Tool status line — label ONLY (never args.prompt). */
        function _appendTool(id, label, status) {
            // Re-use existing line for the same id (started → done/failed update)
            let div = qs(`[data-tool-id="${CSS.escape(id)}"]`, transcript);
            if (!div) {
                div = document.createElement('div');
                div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--tool';
                div.dataset.toolId = id;
                transcript.appendChild(div);
            }
            div.className = `mpi-agent-chat__entry mpi-agent-chat__entry--tool mpi-agent-chat__entry--tool--${status || 'started'}`;
            div.textContent = label || id;
            _scrollBottom();
            return div;
        }

        /**
         * Yes / No card. Three kinds share it: `install` names a model and its download,
         * `batch` names how many cards one ask is about to fan out over (MPI-870), and
         * `spend` names what a billed cloud run is about to cost (MPI-876).
         *
         * The price is never formatted here. `price` arrives as `estimateCost().display`
         * verbatim — it carries its own "about", and below a cent it is deliberately one
         * significant figure, so re-rendering it as a number would say "$0.00". A `spend`
         * card with no price is not a bug: some shapes cannot be priced before they run,
         * and the card still has to ask.
         *
         * @param {{confirmId:string, kind?:string, modelName?:string, downloadGb?:number,
         *          count?:number, what?:string, price?:string|null}} data
         */
        function _appendConfirm(data) {
            const { confirmId, kind, modelName, downloadGb, count, what, price } = data || {};
            if (!confirmId || qs(`[data-confirm-id="${CSS.escape(confirmId)}"]`, transcript)) return;
            const isBatch = kind === 'batch';
            const isSpend = kind === 'spend';
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--confirm';
            div.dataset.confirmId = confirmId;

            const card = document.createElement('div');
            card.className = 'mpi-agent-chat__confirm-card';

            const titleEl = document.createElement('div');
            titleEl.className = 'mpi-agent-chat__confirm-title';
            // A spend card keeps the model's name even in the batch wording: six billed runs
            // is the moment to be more specific about what is running, not less.
            titleEl.textContent = isSpend
                ? (count > 1
                    // "times", not "over N cards": a `count` batch (MPI-876) has no cards to go over.
                    ? `Run this ${count} times on ${modelName || 'this model'}?`
                    : `Run this on ${modelName || 'this model'}?`)
                : isBatch
                    ? `Run this ${count} times?`
                    : `Install ${modelName || 'model'}?`;
            card.appendChild(titleEl);

            // The same slot under the title carries the cost being agreed to: gigabytes for an
            // install, how many generations are about to queue for a batch, and for a spend
            // card the money. "your DeepInfra key" says WHOSE money it is — Vision ships
            // bring-your-own-key, not credits, and the user paying is the whole reason this
            // card exists.
            const spendLine = price
                ? (count > 1
                    ? `Runs on your DeepInfra key and costs ${price} for ${count} generations.`
                    : `Runs on your DeepInfra key and costs ${price}.`)
                // Names no cause: a price is missing far more often because the endpoint is
                // not in the price snapshot than because the model bills by GPU time, and
                // telling the user the wrong one of those is worse than telling them neither.
                : 'Runs on your DeepInfra key. The cost is not known until it finishes.';
            const subtitle = isSpend
                ? spendLine
                : isBatch
                    ? (what ? `${what} — ${count} generations` : `${count} generations`)
                    : (downloadGb != null ? `Download: ${Number(downloadGb).toFixed(1)} GB` : '');
            if (subtitle) {
                const sizeEl = document.createElement('div');
                sizeEl.className = 'mpi-agent-chat__confirm-size';
                sizeEl.textContent = subtitle;
                card.appendChild(sizeEl);
            }

            const actionsEl = document.createElement('div');
            actionsEl.className = 'mpi-agent-chat__confirm-actions';

            const yesBtn = MpiButton.mount(document.createElement('div'), {
                text: isSpend
                    ? (count > 1 ? `Yes, run all ${count}` : 'Yes, run it')
                    : isBatch ? `Yes, run all ${count}` : 'Yes, install',
                variant: 'primary',
                size: 'sm',
            });
            const noBtn = MpiButton.mount(document.createElement('div'), {
                text: 'No',
                variant: 'secondary',
                size: 'sm',
            });
            _buttons.push(yesBtn, noBtn);

            const _respond = async (yes) => {
                yesBtn.el.setDisabled?.(true);
                noBtn.el.setDisabled?.(true);
                try {
                    await agentPostConfirm(confirmId, yes);
                } catch (err) {
                    clientLogger.error('MpiAgentChat', 'confirm failed', err);
                    yesBtn.el.setDisabled?.(false);
                    noBtn.el.setDisabled?.(false);
                }
            };

            yesBtn.on('click', () => _respond(true));
            noBtn.on('click',  () => _respond(false));

            actionsEl.appendChild(yesBtn.el);
            actionsEl.appendChild(noBtn.el);
            card.appendChild(actionsEl);
            div.appendChild(card);
            transcript.appendChild(div);
            _scrollBottom();
        }

        /** The tile a result falls back to when its file will not load (stopped, or gone). */
        function _fallbackTile(card, type) {
            card.innerHTML = '';
            card.classList.add('mpi-agent-chat__result-card--unavailable');
            const label = document.createElement('span');
            label.className = 'mpi-agent-chat__result-fallback';
            label.innerHTML = renderIcon(type === 'video' ? 'video' : 'image', 'sm');
            label.appendChild(document.createTextNode('Did not finish'));
            card.appendChild(label);
        }

        /** Result card — thumbnail + click opens gallery card. */
        function _appendResult(output, toolCallId) {
            if (!output) return;
            if (toolCallId && qs(`[data-result-id="${CSS.escape(toolCallId)}"]`, transcript)) return;
            const { itemId, groupId, type, filePath } = output;

            // Find or create a result row for this turn
            let row = qs('.mpi-agent-chat__entry--result:last-child', transcript);
            if (!row) {
                row = document.createElement('div');
                row.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--result';
                transcript.appendChild(row);
            }

            const card = document.createElement('div');
            card.className = 'mpi-agent-chat__result-card';
            card.title = filePath || '';
            if (toolCallId) card.dataset.resultId = toolCallId;

            // A video result cannot paint in an <img> — it used to render as a broken
            // tile captioned "video". Same tile for a file that never arrived (a
            // generation the user Stopped): both swap to a readable fallback on `error`.
            const media = document.createElement(type === 'video' ? 'video' : 'img');
            if (type === 'video') {
                media.muted = true;
                media.playsInline = true;
                media.preload = 'metadata';
            } else {
                media.alt = type || 'result';
            }
            media.src = resolveMediaUrl(filePath);
            on(media, 'error', () => _fallbackTile(card, type));
            card.appendChild(media);

            on(card, 'click', () => {
                if (itemId) Events.emit('gallery:open-card', { itemId, groupId });
            });

            row.appendChild(card);
            _scrollBottom();
        }

        /** Compacting notice. */
        function _appendCompacting(on_) {
            if (on_) {
                const div = document.createElement('div');
                div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--compacting';
                div.textContent = 'Compacting conversation…';
                transcript.appendChild(div);
                _scrollBottom();
            }
        }

        /** Error line. */
        function _appendError(code, message) {
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--error';
            div.textContent = message || `Error: ${code || 'unknown'}`;
            transcript.appendChild(div);
            _scrollBottom();
        }

        // ── Bus event subscriptions ───────────────────────────────────────────
        // Every agent event names its conversation, and this chat renders only its own.
        // Events that arrive while a history load is in flight wait for it.
        function _apply(name, data) {
            if (!data || data.session !== _session) return;
            switch (name) {
                case 'agent:working':
                    _setWorking(data.working);
                    break;
                case 'agent:message':
                    _appendMessage(data.text, data.id);
                    break;
                case 'agent:tool':
                    // Brief item 12: only show label, never args.prompt
                    _appendTool(data.id, data.label, data.status);
                    _onTool(data);
                    break;
                case 'agent:confirm':
                    _appendConfirm(data);
                    break;
                case 'agent:result':
                    if (data.ok && data.output) _appendResult(data.output, data.toolCallId);
                    else if (!data.ok && data.error) _appendError(data.error.code, data.error.message);
                    break;
                case 'agent:compacting':
                    _appendCompacting(data.on);
                    break;
                case 'agent:error':
                    _appendError(data.code, data.message);
                    _setWorking(false);
                    break;
                case 'agent:user':
                    _appendUser(data.text, _stagedThumbs(data.attachments), data.id);
                    break;
                case 'agent:spend':
                    _setSpend(data);
                    break;
            }
        }
        /** Staged attachments are {id, name} with no dataUrl: shown through the attachment route. */
        function _stagedThumbs(attachments) {
            return (attachments || []).map((att) => ({
                // A card sent by reference (MPI-886) carries its own `/project-file` url.
                dataUrl: att.url || (att.id ? `/agent/attachment/${att.id}` : (att.dataUrl || '')),
                name: att.name || '',
            }));
        }
        ['agent:working', 'agent:message', 'agent:tool', 'agent:confirm', 'agent:result', 'agent:compacting', 'agent:error', 'agent:user', 'agent:spend']
            .forEach((name) => _unsubs.push(Events.on(name, (data) => {
                if (_loading) _queued.push([name, data]);
                else _apply(name, data);
            })));
        // A conversation moved (the landing chat opened a project): both sides reload.
        _unsubs.push(Events.on('agent:session', ({ from, to } = {}) => {
            if (_session !== null && (from === _session || to === _session)) _reload();
        }));
        // Another project, another conversation.
        _unsubs.push(Events.on('project:changed', () => _reload()));

        /** The project this chat's conversation belongs to: none for the landing chat. */
        function _projectRef() {
            const p = props.standalone ? null : state.currentProject;
            return p?.folderPath ? { folderPath: p.folderPath, name: p.name } : null;
        }

        function _clear() {
            _buttons.splice(0).forEach((b) => b.destroy());
            transcript.replaceChildren();
        }

        // ── Start over ─────────────────────────────────────────────────────────
        // `POST /agent/reset` shipped with the routes and nothing ever called it, so
        // the only way out of a conversation was to restart the app. It matters more
        // than it looks: a transcript where the model has already refused something is
        // the strongest instruction to refuse again, and picking a different model does
        // NOT clear it — the server rebuilds only the system prompt between turns.
        //
        // Arms on the first click rather than opening a modal: the transcript is the
        // one thing here that cannot be recovered (cards, media and notes all survive),
        // so a stray click should not take it, and a dialog for a header button is more
        // ceremony than the action deserves.
        const resetSlot = qs('#ac-reset-slot', el);
        if (resetSlot) {
            let armed = false;
            const resetBtn = MpiButton.mount(resetSlot, {
                text: 'Start over',
                info: 'Clear this conversation and begin a new one',
                size: 'sm',
                variant: 'ghost',
            });
            // The Primitive hangs setLabel/setActive/setDisabled off the ELEMENT; the
            // factory instance only carries {el, props, on, destroy}.
            const btn = resetBtn.el;
            const disarm = () => {
                armed = false;
                btn.setLabel('Start over');
                btn.setActive(false);
            };
            resetBtn.on('click', async () => {
                if (!armed) {
                    armed = true;
                    btn.setLabel('Sure?');
                    btn.setActive(true);
                    return;
                }
                disarm();
                btn.setDisabled(true);
                try {
                    await agentReset(_projectRef()?.folderPath || null);
                    await _reload();
                } finally {
                    btn.setDisabled(false);
                }
            });
            // Anything else the user does means they did not mean the second click.
            _unsubs.push(on(el, 'pointerdown', (e) => {
                if (armed && !btn.contains(e.target)) disarm();
            }));
            // NOT `_buttons` — that list is the confirm cards', and `_clear()` empties it
            // on every reload, which would destroy this button the first time it ran.
            _unsubs.push(() => resetBtn.destroy());
        }

        // ── Load history ───────────────────────────────────────────────────────
        // Kinds: 'user' | 'agent' | 'tool' | 'result' | 'confirm' | 'handoff'
        async function _reload() {
            const project = _projectRef();
            if (!props.standalone && !project) {
                _loading = null;
                _session = null;
                _clear();
                _setSpend(null);
                _setWorking(false);
                return;
            }
            const load = {};
            _loading = load;
            _queued = [];
            const history = await agentGetHistory(project?.folderPath || null);
            if (_loading !== load) return; // a newer load took over
            _clear();
            _setWorking(false);
            _setSpend(history.spend);
            _session = history.ok ? history.session : (props.standalone ? '' : null);

            if (history.entries) {
                for (const entry of history.entries) {
                    if (entry.kind === 'user') {
                        _appendUser(entry.text || '', _stagedThumbs(entry.attachments), entry.id);
                    } else if (entry.kind === 'agent') {
                        _appendMessage(entry.text || '', entry.id);
                    } else if (entry.kind === 'tool') {
                        _appendTool(entry.id || entry.tool, entry.label, entry.status);
                    } else if (entry.kind === 'result') {
                        if (entry.ok && entry.output) _appendResult(entry.output, entry.toolCallId);
                        else if (!entry.ok && entry.error) _appendError(entry.error.code, entry.error.message);
                    } else if (entry.kind === 'confirm') {
                        // Only render if this is the pending confirm (rendered below).
                        // Answered confirms are skipped — user already acted.
                    } else if (entry.kind === 'handoff') {
                        // Render as a small "conversation compacted" marker.
                        const div = document.createElement('div');
                        div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--compacting';
                        div.textContent = 'Conversation compacted';
                        transcript.appendChild(div);
                        _scrollBottom();
                    }
                }
            }

            // Restore working state
            if (history.working) _setWorking(true);

            // Restore pending confirm (only this one is still actionable)
            if (history.pendingConfirm) {
                const pc = history.pendingConfirm;
                _appendConfirm(pc);
            }

            _loading = null;
            _queued.splice(0).forEach(([name, data]) => _apply(name, data));
        }

        // ── Public sendMessage ─────────────────────────────────────────────────
        async function _sendMessage(text, attachments) {
            if (!text && (!attachments || !attachments.length)) return;
            _appendUser(text, attachments);
            _setWorking(true);
            try {
                // The landing chat is the landing page's conversation, whatever project is still loaded.
                const res = await agentSendMessage(text, attachments || [], _projectRef());
                if (!res?.ok) {
                    // NO_PROFILE and a bad body come back as a 200 with ok: false. A message
                    // sent mid-answer is NOT one of them any more: it queues (MPI-840).
                    _appendError(res?.error?.code, res?.error?.message || 'The agent could not take that message.');
                    _setWorking(false);
                } else if (_session === null) {
                    _session = res.session;
                }
            } catch (err) {
                clientLogger.error('MpiAgentChat', 'send failed', err);
                _appendError(err.code, err.message || 'Failed to send message');
                _setWorking(false);
            }
        }

        el.setWorking  = _setWorking;

        // ── The composer — both modes (MPI-797 Phase 2) ───────────────────────
        const inputSlot    = qs('#ac-input-slot',   el);
        const sendSlot     = qs('#ac-send-slot',    el);
        const attachSlot   = qs('#ac-attachments',  el);

        const mainInput = MpiInput.mount(inputSlot, {
            type: 'textarea',
            placeholder: 'Ask the agent…',
            autoHeight: true,
        });
        const textareaEl = qs('textarea', mainInput.el);
        // One line to start, level with Send (Fabio, round 2). MpiInput sets no `rows`,
        // so the browser default of 2 made autoHeight's first measurement two lines tall
        // and the box stood well above the button. Set here, not on the Primitive: every
        // other auto-height textarea in the app is sized for a paragraph.
        //
        // Then CLEAR the inline height rather than re-measuring (MPI-797 Phase 2). The
        // panel is CLOSED at boot — zero width, no layout — so MpiInput's own mount-time
        // resize() read `scrollHeight: 0` and wrote `height: 0px`, and a re-measure here
        // would only write it again. With no inline height, `rows="1"` sizes the field
        // intrinsically, which needs no layout and is right in both modes; autoHeight's
        // inline value takes over on the first real keystroke, by which point the panel
        // is open and the measurement means something.
        if (textareaEl) {
            textareaEl.rows = 1;
            textareaEl.style.height = '';
        }

        const sendBtn = MpiButton.mount(sendSlot, {
            icon: 'generate',
            info: 'Send (Enter)',
            size: 'sm',
            variant: 'primary',
        });

        // Enter = send, Shift+Enter = newline
        if (textareaEl) {
            _unsubs.push(on(textareaEl, 'keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    _doSend();
                }
            }));
        }

        sendBtn.on('click', () => _doSend());

        function _doSend() {
            const text = textareaEl ? textareaEl.value.trim() : '';
            if (!text && !_pendingAttachments.length) return;
            _sendMessage(text, _pendingAttachments.slice());
            // setValue, NOT `textareaEl.value = ''`. A plain assignment fires no `input`
            // event, and `input` is the only thing MpiInput's auto-height listens to — so
            // a field grown to four lines stayed four lines tall and empty after every
            // send (Fabio, 2026-09-20). The Primitive's own setter re-measures, which is
            // exactly why it exists; reaching past it for `.value` is the documented
            // mistake at MpiInput.js:107.
            mainInput.el.setValue('');
            _pendingAttachments = [];
            _renderAttachments();
        }

        // Drag-and-drop images → dataUrl attachments
        function _addImageFile(file) {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                _pendingAttachments.push({ dataUrl: ev.target.result, name: file.name });
                _renderAttachments();
            };
            reader.readAsDataURL(file);
        }

        /**
         * MPI-884 — a gallery card dropped on the chat attaches the CARD'S FILE, never what
         * the drag carries. Chromium builds `dataTransfer.files` out of the dragged `<img>`'s
         * own resource, and that element is the 512 `.thumb.webp` rendition, so the old
         * `files`-only drop staged a thumbnail: measured byte-identical to
         * `<itemId>.thumb.webp`, and the agent went on to edit it and report ok. The real path
         * rides the same drag in `application/mpi-media` — the payload MpiPromptBox's
         * `_handleMediaDrop` has always read first, and this one never did.
         * @returns {Promise<boolean>} false = nothing usable here; fall back to the files.
         */
        async function _addCardMedia(payload) {
            const source = cardAttachmentSource(payload);
            if (!source) return false;
            // MPI-886: with a project open the card goes BY REFERENCE, nothing copied, so the
            // agent holds the card itself (its prompt, its history, where an edit lands). The
            // landing chat has no project to hold a reference in, so it still copies.
            let card = null;
            try { card = JSON.parse(payload); } catch { /* cardAttachmentSource already vetted it */ }
            if (_projectRef() && card?.groupId) {
                _pendingAttachments.push({ url: source.url, name: source.name, mediaType: 'image',
                    itemId: card.itemId || null, groupId: card.groupId });
                _renderAttachments();
                return true;
            }
            try {
                const res = await window.fetch(source.url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                _addImageFile(new File([blob], source.name, { type: blob.type }));
                return true;
            } catch (err) {
                clientLogger.warn('MpiAgentChat', `card attachment fetch failed: ${source.name}`, err);
                return false;
            }
        }

        function _renderAttachments() {
            if (!attachSlot) return;
            attachSlot.style.display = _pendingAttachments.length ? '' : 'none';
            attachSlot.innerHTML = '';
            _pendingAttachments.forEach((a, i) => {
                const chip = _attachmentChip(a.dataUrl || a.url, a.name, i + 1);
                chip.title = `Click to remove ${a.name}`;
                on(chip, 'click', () => {
                    _pendingAttachments.splice(i, 1);
                    _renderAttachments();
                });
                attachSlot.appendChild(chip);
            });
        }

        // Drag-and-drop on root el
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
            _unsubs.push(on(el, ev, (e) => e.preventDefault()))
        );
        _unsubs.push(on(el, 'drop', async (e) => {
            // Both read BEFORE the first await: `dataTransfer` is emptied once the handler
            // yields, so a card that falls through would find no files left to fall back to.
            const card  = e.dataTransfer?.getData('application/mpi-media');
            const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
            if (card && await _addCardMedia(card)) return;
            files.forEach(_addImageFile);
        }));

        // ── Load history on mount ─────────────────────────────────────────────
        _reload().catch(err => clientLogger.warn('MpiAgentChat', 'history load failed', err));

        // ── Cleanup ────────────────────────────────────────────────────────────
        el.destroy = () => {
            _unsubs.forEach(fn => fn());
            _buttons.splice(0).forEach((b) => b.destroy());
            clearInterval(_guestTimer);
            _guestId = null;
            // Hiding a video keeps its decoder alive; only this releases it (MPI-777).
            _cosmoQueue?.destroy();
            _cosmoQueue = null;
            [ledgeRest, ledgeWork, guestA, guestB, cosmoA, cosmoB, cosmoFx].forEach(_releaseClip);
        };
    },
});
