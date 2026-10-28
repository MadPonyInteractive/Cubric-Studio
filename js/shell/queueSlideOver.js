/**
 * The Cue queue slide-over, one copy for every workspace: Q toggles it, `generation-queue:open`
 * (the status bar, a dispatch) opens it. Each workspace Block binds it on mount and calls the
 * returned unsubscribes on destroy, so the panel answers wherever the user is.
 * The 3D Scene passes `{ key: false }`: there Q flies down (`scene.fly.down`).
 * The gallery is the exception: it docks the Cue instead (bindQueueDock, MPI-1320).
 */

import { Events } from '../events.js';
import { Hotkeys } from '../managers/hotkeyManager.js';
import { navigate, PAGE_GALLERY } from '../router.js';
import { state } from '../state.js';
import { gid, qs } from '../utils/dom.js';
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

const DOCK_OPEN = 'queue-panel-mount--open';

/**
 * The gallery's Cue (MPI-1320): a docked right panel, the agent panel's mirror — under the
 * topbar, down to the status bar, pushing the gallery, prompt box and controls aside
 * (workspace.css). The gallery binds this instead of bindQueueSlideOver; `state.queueDocked`
 * keeps it open across visits, and the gallery toolbar's queue toggle writes it too.
 * The panel lives as long as the gallery does.
 * @returns {Function[]} the unsubscribes
 */
export function bindQueueDock() {
    const mountEl = gid('queue-panel-mount');
    const panel = MpiQueuePanel.mount(mountEl);
    const show = (open) => mountEl.classList.toggle(DOCK_OPEN, !!open);
    show(state.queueDocked);
    panel.on('close-request', () => { state.queueDocked = false; });
    // A Flow (any main-area MpiOverlay) stashes .main-area's children, the dock with them,
    // so over one the Cue is the slide-over again, which clears the overlay (MPI-822).
    const overlayUp = () => !!qs('.main-area--overlay');
    return [
        Events.onState('queueDocked', show),
        Events.on('generation-queue:open', () => {
            if (overlayUp()) Events.emit('slide-over:open', QUEUE_PANEL);
            else state.queueDocked = true;
        }),
        Hotkeys.bind('queue.toggle', () => {
            if (overlayUp()) Events.emit('slide-over:toggle', QUEUE_PANEL);
            else state.queueDocked = !state.queueDocked;
        }),
        () => {
            show(false);
            panel.destroy();
            panel.el.remove();
        },
    ];
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
