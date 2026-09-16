/**
 * MpiAgentChat — MPI-774 in-app agent chat UI (Compound).
 *
 * Props:
 *   standalone {boolean}  — true → renders its own input row + send button.
 *                           false/absent → the host (agentPanel.js) provides input
 *                           via MpiPromptBox in agent mode, routed through the
 *                           'agent:send' event on the app bus.
 *
 * Public API (on el):
 *   el.setWorking(bool)                — set the agent:working state externally.
 *   el.destroy()                       — teardown (unsub, no SSE to close — shared singleton).
 *
 * SSE events consumed: agent:working, agent:message, agent:tool, agent:confirm,
 *                       agent:result, agent:compacting, agent:error.
 * These are bridged from SSE to the app bus by agentService.agentInitStream().
 * This component subscribes via Events.on — it never opens its own EventSource.
 *
 * Brief item 12: agent:tool.label is the only text shown — args.prompt is NEVER
 * rendered here.
 */

import { ComponentFactory }    from '../../factory.js';
import { MpiButton }           from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput }            from '../../Primitives/MpiInput/MpiInput.js';
import { qs, on }              from '../../../utils/dom.js';
import { renderIcon }          from '../../../utils/icons.js';
import { renderMarkdownInto }  from '../../../utils/markdown.js';
import { Events }              from '../../../events.js';
import { clientLogger }        from '../../../services/clientLogger.js';
import { state }               from '../../../state.js';
import {
    agentSendMessage,
    agentGetHistory,
    agentPostConfirm,
} from '../../../services/agentService.js';

export const MpiAgentChat = ComponentFactory.create({
    name: 'MpiAgentChat',
    css: ['js/components/Compounds/MpiAgentChat/MpiAgentChat.css'],

    template: (props) => `
        <div class="mpi-agent-chat${props.standalone ? ' mpi-agent-chat--standalone' : ''}">

            <!-- Compact header: label + working indicator (panel mode) -->
            ${!props.standalone ? `
            <div class="mpi-agent-chat__header" id="ac-header">
                <span class="mpi-agent-chat__header-label">Agent</span>
                <span class="mpi-agent-chat__working-dot" id="ac-working-dot"></span>
            </div>
            ` : `
            <!-- Mascot (standalone landing mode only) -->
            <div class="mpi-agent-chat__mascot-wrap">
                <img
                    class="mpi-agent-chat__mascot"
                    id="ac-mascot"
                    src="assets/mascot/idle.png"
                    alt="Agent mascot"
                    width="48" height="48"
                />
                <span class="mpi-agent-chat__mascot-label" id="ac-mascot-label">Ask me anything</span>
            </div>
            `}

            <!-- Transcript -->
            <div class="mpi-agent-chat__transcript" id="ac-transcript"></div>

            ${props.standalone ? `
            <!-- Standalone input row -->
            <div class="mpi-agent-chat__input-row">
                <div class="mpi-agent-chat__attachments" id="ac-attachments" style="display:none"></div>
                <div class="mpi-agent-chat__input-wrap" id="ac-input-slot"></div>
                <div id="ac-send-slot"></div>
            </div>
            ` : ''}

        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];
        let _working = false;
        /** @type {Array<{dataUrl:string, name:string}>} */
        let _pendingAttachments = [];

        const mascotEl   = qs('#ac-mascot',        el);
        const labelEl    = qs('#ac-mascot-label',  el);
        const workingDot = qs('#ac-working-dot',   el);
        const transcript = qs('#ac-transcript',    el);

        // ── Working state helpers ─────────────────────────────────────────────
        function _setWorking(working) {
            _working = working;
            // Panel mode: toggle working dot
            if (workingDot) workingDot.classList.toggle('mpi-agent-chat__working-dot--on', working);
            // Standalone mode: mascot flip
            if (mascotEl) {
                if (working) {
                    mascotEl.src = 'assets/mascot/waiting.png';
                    mascotEl.classList.add('mpi-agent-chat__mascot--waiting');
                    if (labelEl) labelEl.textContent = 'Thinking…';
                } else {
                    mascotEl.src = 'assets/mascot/idle.png';
                    mascotEl.classList.remove('mpi-agent-chat__mascot--waiting');
                    if (labelEl) labelEl.textContent = 'Ask me anything';
                }
            }
            emit('working', { working });
        }

        // ── Scroll helpers ────────────────────────────────────────────────────
        function _scrollBottom() {
            transcript.scrollTop = transcript.scrollHeight;
        }

        // ── Entry builders ────────────────────────────────────────────────────

        /** User bubble (right-aligned). */
        function _appendUser(text, attachments) {
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--user';
            const bubble = document.createElement('div');
            bubble.className = 'mpi-agent-chat__bubble';
            if (text) bubble.textContent = text;
            // Show image attachments in the bubble
            if (attachments && attachments.length) {
                attachments.forEach(({ dataUrl, name }) => {
                    if (!dataUrl) return;
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.alt = name || 'attachment';
                    img.className = 'mpi-agent-chat__attachment-thumb';
                    bubble.appendChild(img);
                });
            }
            div.appendChild(bubble);
            transcript.appendChild(div);
            _scrollBottom();
        }

        /**
         * Agent message entry — returns the container so SSE can append to it
         * if the same turnId+id pair arrives multiple times (unlikely but safe).
         */
        function _appendMessage(text) {
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--message';
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

        /** Install confirm card with Yes / No buttons. */
        function _appendConfirm(confirmId, modelName, downloadGb) {
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--confirm';

            const card = document.createElement('div');
            card.className = 'mpi-agent-chat__confirm-card';

            const titleEl = document.createElement('div');
            titleEl.className = 'mpi-agent-chat__confirm-title';
            titleEl.textContent = `Install ${modelName || 'model'}?`;
            card.appendChild(titleEl);

            if (downloadGb != null) {
                const sizeEl = document.createElement('div');
                sizeEl.className = 'mpi-agent-chat__confirm-size';
                sizeEl.textContent = `Download: ${Number(downloadGb).toFixed(1)} GB`;
                card.appendChild(sizeEl);
            }

            const actionsEl = document.createElement('div');
            actionsEl.className = 'mpi-agent-chat__confirm-actions';

            const yesBtn = MpiButton.mount(document.createElement('div'), {
                text: 'Yes, install',
                variant: 'primary',
                size: 'sm',
            });
            const noBtn = MpiButton.mount(document.createElement('div'), {
                text: 'No',
                variant: 'secondary',
                size: 'sm',
            });

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

        /** Result card — thumbnail + click opens gallery card. */
        function _appendResult(output) {
            if (!output) return;
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

            const img = document.createElement('img');
            img.src = filePath ? `/project-file?path=${encodeURIComponent(filePath)}` : '';
            img.alt = type || 'result';
            card.appendChild(img);

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
        // Consume all agent SSE events from the app bus (bridged by agentService).
        _unsubs.push(Events.on('agent:working', (data) => {
            _setWorking(data.working);
        }));
        _unsubs.push(Events.on('agent:message', (data) => {
            _appendMessage(data.text);
        }));
        _unsubs.push(Events.on('agent:tool', (data) => {
            // Brief item 12: only show label, never args.prompt
            _appendTool(data.id, data.label, data.status);
        }));
        _unsubs.push(Events.on('agent:confirm', (data) => {
            _appendConfirm(data.confirmId, data.modelName, data.downloadGb);
        }));
        _unsubs.push(Events.on('agent:result', (data) => {
            if (data.ok && data.output) _appendResult(data.output);
            else if (!data.ok && data.error) _appendError(null, data.error);
        }));
        _unsubs.push(Events.on('agent:compacting', (data) => {
            _appendCompacting(data.on);
        }));
        _unsubs.push(Events.on('agent:error', (data) => {
            _appendError(data.code, data.message);
            _setWorking(false);
        }));

        // ── Load history ───────────────────────────────────────────────────────
        // BUG FIX: server writes entry.kind, not entry.role.
        // Kinds: 'user' | 'agent' | 'tool' | 'result' | 'confirm' | 'handoff'
        async function _loadHistory() {
            const history = await agentGetHistory();
            if (!history.ok) return;

            if (history.entries) {
                for (const entry of history.entries) {
                    if (entry.kind === 'user') {
                        // Replayed user attachments have {id, name} without dataUrl.
                        // Render via the attachment endpoint.
                        const displayAttachments = (entry.attachments || []).map(att => ({
                            dataUrl: att.id ? `/agent/attachment/${att.id}` : (att.dataUrl || ''),
                            name: att.name || '',
                        }));
                        _appendUser(entry.text || '', displayAttachments);
                    } else if (entry.kind === 'agent') {
                        _appendMessage(entry.text || '');
                    } else if (entry.kind === 'tool') {
                        _appendTool(entry.id || entry.tool, entry.label, entry.status);
                    } else if (entry.kind === 'result') {
                        if (entry.ok && entry.output) _appendResult(entry.output);
                        else if (!entry.ok && entry.error) _appendError(null, entry.error);
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
                _appendConfirm(pc.confirmId, pc.modelName, pc.downloadGb);
            }
        }

        // ── Public sendMessage ─────────────────────────────────────────────────
        async function _sendMessage(text, attachments) {
            if (!text && (!attachments || !attachments.length)) return;
            _appendUser(text, attachments);
            _setWorking(true);
            try {
                const project = state.currentProject || null;
                await agentSendMessage(text, attachments || [], project);
            } catch (err) {
                clientLogger.error('MpiAgentChat', 'send failed', err);
                _appendError(err.code, err.message || 'Failed to send message');
                _setWorking(false);
            }
        }

        el.setWorking  = _setWorking;

        // ── Panel mode: receive send requests from MpiPromptBox ──────────────
        // agent:send is emitted by MpiPromptBox when in agent mode. Only the
        // panel instance (standalone:false) handles it — standalone has its own input.
        if (!props.standalone) {
            _unsubs.push(Events.on('agent:send', ({ text, attachments }) => {
                _sendMessage(text, attachments || []);
            }));
        }

        // ── Standalone input row ──────────────────────────────────────────────
        if (props.standalone) {
            const inputSlot    = qs('#ac-input-slot',   el);
            const sendSlot     = qs('#ac-send-slot',    el);
            const attachSlot   = qs('#ac-attachments',  el);

            const mainInput = MpiInput.mount(inputSlot, {
                type: 'textarea',
                placeholder: 'Ask the agent…',
                autoHeight: true,
            });
            const textareaEl = qs('textarea', mainInput.el);

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
                if (textareaEl) textareaEl.value = '';
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

            function _renderAttachments() {
                if (!attachSlot) return;
                attachSlot.style.display = _pendingAttachments.length ? '' : 'none';
                attachSlot.innerHTML = '';
                _pendingAttachments.forEach((a, i) => {
                    const img = document.createElement('img');
                    img.src = a.dataUrl;
                    img.alt = a.name;
                    img.className = 'mpi-agent-chat__attachment-thumb';
                    img.title = `Click to remove ${a.name}`;
                    on(img, 'click', () => {
                        _pendingAttachments.splice(i, 1);
                        _renderAttachments();
                    });
                    attachSlot.appendChild(img);
                });
            }

            // Drag-and-drop on root el
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
                _unsubs.push(on(el, ev, (e) => e.preventDefault()))
            );
            _unsubs.push(on(el, 'drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files) Array.from(files).forEach(_addImageFile);
            }));
        }

        // ── Load history on mount ─────────────────────────────────────────────
        _loadHistory().catch(err => clientLogger.warn('MpiAgentChat', 'history load failed', err));

        // ── Cleanup ────────────────────────────────────────────────────────────
        el.destroy = () => {
            _unsubs.forEach(fn => fn());
        };
    },
});
