/**
 * screenClearService.js — one reusable signal: the app has booted and nothing covers the screen.
 *
 * `state.screenClear` stays false until `_bootApp` emits `shell:booted` (past the engine gate,
 * the 18+ notice and the changelog), then follows the screen: false while a blocking overlay
 * is up, true once it is gone. It is state rather than a one-shot event, so a consumer that
 * mounts late reads the current value and reacts via `Events.onState('screenClear', fn)`.
 *
 * Covered is either source:
 * - the Overlays stack is not empty (every MpiModal and MpiOverlay, main-area ones included);
 * - a backdrop sits directly on <body>. That is how MpiStartingComfy covers the screen: it
 *   portals its own backdrop and bypasses Overlays on purpose.
 *
 * First consumer: the landing crew's entrance (MPI-766).
 */

import { Events } from '../events.js';
import { state } from '../state.js';
import { Overlays } from '../managers/overlayManager.js';
import { qs } from '../utils/dom.js';

const BODY_BACKDROP = 'body > .mpi-modal-backdrop, body > .mpi-overlay-backdrop';

let _booted = false;
let _depth = 0;
let _queued = false;

/**
 * Recompute on the next animation frame, so a close-then-open handoff never reads as clear:
 * the 18+ notice's Continue hides it and opens the changelog one frame LATER (shell.js,
 * MPI-333, so the two backdrops never stack). That frame callback was queued before this
 * one, so it runs first and the changelog is already up when we look. A hidden window runs
 * no frames, so the signal also waits until the app can actually be seen.
 */
function _schedule() {
    if (_queued) return;
    _queued = true;
    requestAnimationFrame(() => {
        _queued = false;
        const clear = _booted && _depth === 0 && !qs(BODY_BACKDROP);
        if (state.screenClear !== clear) state.screenClear = clear;
    });
}

/** Called once from initShell, before `_bootApp`. App-lifetime: nothing to tear down. */
export function initScreenClearService() {
    Events.once('shell:booted', () => { _booted = true; _schedule(); });
    Overlays.onDepthChange((depth) => { _depth = depth; _schedule(); });
    new MutationObserver(_schedule).observe(document.body, { childList: true });
}
