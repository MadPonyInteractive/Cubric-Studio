/**
 * MpiAgentChat — MPI-774 in-app agent chat UI (Compound).
 *
 * Props:
 *   standalone {boolean}  — true → renders its own input row + send button.
 *                           false/absent → the host provides input (MpiPromptBox).
 *
 * Public API (on el):
 *   el.sendMessage(text, attachments)  — append a user turn and send.
 *   el.setWorking(bool)                — set the agent:working state externally
 *                                        (used by MpiPromptBox integration).
 *   el.destroy()                       — teardown (unsub + close SSE).
 *
 * SSE events consumed: agent:working, agent:message, agent:tool, agent:confirm,
 *                       agent:result, agent:compacting, agent:error.
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
    agentOpenStream,
} from '../../../services/agentService.js';

export const MpiAgentChat = ComponentFactory.create({
    name: 'MpiAgentChat',
    css: ['js/components/Compounds/MpiAgentChat/MpiAgentChat.css'],

    template: (props) => `
        <div class="mpi-agent-chat${props.standalone ? ' mpi-agent-chat--standalone' : ''}">

            <!-- Mascot -->
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
        let _closeStream = null;
        let _working = false;
        /** @type {Array<{dataUrl:string, name:string}>} */
        let _pendingAttachments = [];

        const mascotEl   = qs('#ac-mascot',        el);
        const labelEl    = qs('#ac-mascot-label',  el);
        const transcript = qs('#ac-transcript',    el);

        // ── Mascot helpers ────────────────────────────────────────────────────
        function _setWorking(working) {
            _working = working;
            if (!mascotEl) return;
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
            bubble.textContent = text;
            // Show image attachments in the bubble
            if (attachments && attachments.length) {
                attachments.forEach(({ dataUrl, name }) => {
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

        // ── SSE event dispatch ─────────────────────────────────────────────────
        function _onSseEvent(name, data) {
            if (name === 'agent:working') {
                _setWorking(data.working);
                emit('working', { working: data.working });
            } else if (name === 'agent:message') {
                _appendMessage(data.text);
            } else if (name === 'agent:tool') {
                // Brief item 12: only show label, never args.prompt
                _appendTool(data.id, data.label, data.status);
            } else if (name === 'agent:confirm') {
                _appendConfirm(data.confirmId, data.modelName, data.downloadGb);
            } else if (name === 'agent:result') {
                if (data.ok && data.output) _appendResult(data.output);
                else if (!data.ok && data.error) _appendError(null, data.error);
            } else if (name === 'agent:compacting') {
                _appendCompacting(data.on);
            } else if (name === 'agent:error') {
                _appendError(data.code, data.message);
                _setWorking(false);
            }
        }

        // ── Load history ───────────────────────────────────────────────────────
        async function _loadHistory() {
            const history = await agentGetHistory();
            if (!history.ok) return;

            // Replay entries into the transcript
            if (history.entries) {
                for (const entry of history.entries) {
                    if (entry.role === 'user') {
                        _appendUser(entry.text, entry.attachments);
                    } else if (entry.role === 'assistant') {
                        _appendMessage(entry.text);
                    } else if (entry.role === 'tool') {
                        _appendTool(entry.id || entry.tool, entry.label, entry.status);
                    } else if (entry.role === 'result' && entry.output) {
                        _appendResult(entry.output);
                    }
                }
            }

            // Restore working state
            if (history.working) _setWorking(true);

            // Restore pending confirm
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
                const project = state.openProject || null;
                await agentSendMessage(text, attachments || [], project);
            } catch (err) {
                clientLogger.error('MpiAgentChat', 'send failed', err);
                _appendError(err.code, err.message || 'Failed to send message');
                _setWorking(false);
            }
        }

        el.sendMessage = _sendMessage;
        el.setWorking  = _setWorking;

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

        // ── Open SSE + load history ────────────────────────────────────────────
        _closeStream = agentOpenStream(_onSseEvent);
        _loadHistory().catch(err => clientLogger.warn('MpiAgentChat', 'history load failed', err));

        // ── Cleanup ────────────────────────────────────────────────────────────
        el.destroy = () => {
            _unsubs.forEach(fn => fn());
            _closeStream?.();
            _closeStream = null;
        };
    },
});
