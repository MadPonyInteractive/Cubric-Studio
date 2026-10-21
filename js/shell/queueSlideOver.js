/**
 * The Cue queue slide-over, one copy for every workspace: Q toggles it, `generation-queue:open`
 * (the status bar, a dispatch) opens it. Each workspace Block binds it on mount and calls the
 * returned unsubscribes on destroy, so the panel answers wherever the user is.
 * The 3D Scene passes `{ key: false }`: there Q flies down (`scene.fly.down`).
 */

import { Events } from '../events.js';
import { Hotkeys } from '../managers/hotkeyManager.js';
import { navigate, PAGE_GALLERY } from '../router.js';
import { MpiQueuePanel } from '../components/Compounds/MpiQueuePanel/MpiQueuePanel.js';

/** The panel itself, for a caller that opens it outright (`slide-over:open`). */
export const QUEUE_PANEL = {
    title: 'Cue',
    component: MpiQueuePanel,
    extraClasses: 'mpi-slide-over--queue',
    panelId: 'generation-queue',
};

/** @returns {Function[]} the unsubscribes */
export function bindQueueSlideOver({ key = true } = {}) {
    const unsubs = [Events.on('generation-queue:open', () => Events.emit('slide-over:open', QUEUE_PANEL))];
    if (key) unsubs.push(Hotkeys.bind('queue.toggle', () => Events.emit('slide-over:toggle', QUEUE_PANEL)));
    return unsubs;
}

/**
 * Escape returns to the gallery from a workspace with no selection of its own (the Scene, the
 * 360 player; MPI-1238). It stands down for whatever Escape closes first — an overlay, a popup,
 * focus mode, a focused text field — the same guards as Group History's own binding.
 * @returns {Function} the unbind
 */
export function bindEscapeToGallery() {
    return Hotkeys.bind('history.return.gallery', (event) => {
        const ctx = event?.mpiEscapeContext || {};
        if (event?.mpiEscapeOverlayClosed || ctx.activeDismissableUi || ctx.focusModeActive || ctx.textEntryFocused) return;
        navigate(PAGE_GALLERY);
    });
}
