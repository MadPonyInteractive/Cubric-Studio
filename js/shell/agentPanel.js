/**
 * agentPanel.js — MPI-774: Shell-level agent chat panel.
 *
 * Mounts one MpiAgentChat instance (standalone:false) into #agent-panel-mount
 * and shows/hides it by toggling `agent-panel-mount--open` from state.agentMode.
 * MPI-797: its right edge is an MpiResizeHandle; the width lives in `--agent-panel-w`
 * on .main-area (workspace.css offsets the workspace, prompt box and controls by it)
 * and is stored on release.
 *
 * Also initializes the shared SSE singleton (agentInitStream) so the event bus
 * is live before any MpiAgentChat subscribes.
 *
 * Called once at app start (initAgentPanel). js/shell.js must call it after
 * initAgentDispatch().
 */

import { MpiAgentChat }    from '../components/Compounds/MpiAgentChat/MpiAgentChat.js';
import { MpiResizeHandle } from '../components/Primitives/MpiResizeHandle/MpiResizeHandle.js';
import { Events }          from '../events.js';
import { state }           from '../state.js';
import { Storage, clampAgentPanelWidth } from '../core/storage.js';
import { agentInitStream } from '../services/agentService.js';
import { Hotkeys }         from '../managers/hotkeyManager.js';
import { gid }             from '../utils/dom.js';
import { navigate, PAGE_GALLERY, PAGE_GROUP_HISTORY } from '../router.js';

const OPEN = 'agent-panel-mount--open';
const RESIZING = 'agent-panel-mount--resizing';

export function initAgentPanel() {
    // 1. Open the shared SSE → app-bus bridge.
    agentInitStream();

    // 2. Mount MpiAgentChat into the shell panel slot.
    const mountEl = gid('agent-panel-mount');
    if (!mountEl) return; // guard for landing-only shells

    // App-lifetime, like the shell itself: never destroyed.
    MpiAgentChat.mount(mountEl, { standalone: false });

    // 3. The draggable edge. Appended after the chat: mount() replaces the slot's children.
    const area = mountEl.parentElement;
    const setWidth = (px) => area.style.setProperty('--agent-panel-w', `${clampAgentPanelWidth(px)}px`);
    setWidth(Storage.getAgentPanelWidth());
    const handle = MpiResizeHandle.mount(document.createElement('div'), { axis: 'x' });
    mountEl.appendChild(handle.el);
    handle.on('resize-start', () => mountEl.classList.add(RESIZING));
    handle.on('resize', ({ x }) => setWidth(x - area.getBoundingClientRect().left));
    handle.on('resize-end', () => {
        mountEl.classList.remove(RESIZING);
        // What the layout shows (it caps at half the area), so a narrow window stores no wish.
        Storage.setAgentPanelWidth(mountEl.getBoundingClientRect().width);
    });

    // 4. Reflect initial state immediately.
    if (state.agentMode) mountEl.classList.add(OPEN);

    // 5. React to state.agentMode changes (set by MpiPromptBox toggle).
    // App-lifetime listener, like the mount above.
    Events.onState('agentMode', (val) => {
        mountEl.classList.toggle(OPEN, !!val);
    });

    // 6. `A` opens and closes the panel. Bound HERE, not in MpiPromptBox: the box is
    // remounted on every workspace switch and its toggle button goes with it, while this
    // service is app-lifetime. Both sides already meet at `state.agentMode` — the box's
    // own `onState` listener re-paints the button — so the hotkey writes the state and
    // nothing else needs wiring.
    Hotkeys.bind('agentMode.toggle', () => {
        state.agentMode = !state.agentMode;
    });

    // 7. A result card in either chat takes the user to where that result lives. Only a
    // card the open project holds: the landing chat has no project, and a card from an
    // earlier project is not here. Audio has no history view, so it is always the gallery.
    //
    // MPI-891 (D3, Fabio 2026-09-22): "pressing the card the agent hands back should bring
    // them to the gallery". A result that MADE the card (its first entry: every Flow, every
    // new picture) lives in the gallery; one that landed as a card's next entry lives in that
    // card's history. ponytail: no scroll-to-card, a new card sorts to the top by default.
    // eslint-disable-next-line mpi/require-destroy-on-events -- app-lifetime listener, like the one above
    Events.on('gallery:open-card', ({ itemId, groupId } = {}) => {
        const group = state.currentProject?.itemGroups?.find((g) => g.id === groupId);
        if (!group) return;
        const madeTheCard = group.history?.[0]?.id === itemId;
        if (madeTheCard || group.type === 'audio') navigate(PAGE_GALLERY);
        else navigate(PAGE_GROUP_HISTORY, { groupId });
    });
}
