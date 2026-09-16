/**
 * agentPanel.js — MPI-774: Shell-level agent chat panel.
 *
 * Mounts one MpiAgentChat instance (standalone:false) into #agent-panel-mount
 * and shows/hides it by toggling `agent-panel-mount--open` from state.agentMode.
 *
 * Also initializes the shared SSE singleton (agentInitStream) so the event bus
 * is live before any MpiAgentChat subscribes.
 *
 * Called once at app start (initAgentPanel). js/shell.js must call it after
 * initAgentDispatch().
 */

import { MpiAgentChat }    from '../components/Compounds/MpiAgentChat/MpiAgentChat.js';
import { Events }          from '../events.js';
import { state }           from '../state.js';
import { agentInitStream } from '../services/agentService.js';
import { gid }             from '../utils/dom.js';
import { navigate, PAGE_GROUP_HISTORY } from '../router.js';

const OPEN = 'agent-panel-mount--open';

export function initAgentPanel() {
    // 1. Open the shared SSE → app-bus bridge.
    agentInitStream();

    // 2. Mount MpiAgentChat into the shell panel slot.
    const mountEl = gid('agent-panel-mount');
    if (!mountEl) return; // guard for landing-only shells

    // App-lifetime, like the shell itself: never destroyed.
    MpiAgentChat.mount(mountEl, { standalone: false });

    // 3. Reflect initial state immediately.
    if (state.agentMode) mountEl.classList.add(OPEN);

    // 4. React to state.agentMode changes (set by MpiPromptBox toggle).
    // App-lifetime listener, like the mount above.
    Events.onState('agentMode', (val) => {
        mountEl.classList.toggle(OPEN, !!val);
    });

    // 5. A result card in either chat opens that card's history, the way a gallery click
    // does (audio has no history view there either). Only a card the open project holds:
    // the landing chat has no project, and a card from an earlier project is not here.
    // eslint-disable-next-line mpi/require-destroy-on-events -- app-lifetime listener, like the one above
    Events.on('gallery:open-card', ({ groupId } = {}) => {
        const group = state.currentProject?.itemGroups?.find((g) => g.id === groupId);
        if (group && group.type !== 'audio') navigate(PAGE_GROUP_HISTORY, { groupId });
    });
}
