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
 *                       agent:result, agent:compacting, agent:error, agent:user, agent:session.
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
import { qs, on }              from '../../../utils/dom.js';
import { renderIcon }          from '../../../utils/icons.js';
import { renderMarkdownInto }  from '../../../utils/markdown.js';
import { resolveMediaUrl }     from '../../../utils/mediaActions.js';
import { Events }              from '../../../events.js';
import { clientLogger }        from '../../../services/clientLogger.js';
import { state }               from '../../../state.js';
import {
    agentSendMessage,
    agentGetHistory,
    agentPostConfirm,
    agentReset,
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
                <span class="mpi-agent-chat__header-action" id="ac-reset-slot"></span>
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
        /** The conversation shown: '' = the landing page, else the server's key for the project; null = none yet. */
        let _session = props.standalone ? '' : null;
        let _loading = null;   // the history load in flight; events wait for it
        let _queued = [];      // [name, data] that arrived during that load
        const _buttons = [];   // confirm-card buttons, destroyed when the transcript is cleared

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
                attachments.forEach(({ dataUrl, name }) => {
                    if (!dataUrl) return;
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.alt = name || 'attachment';
                    img.className = 'mpi-agent-chat__attachment-thumb';
                    row.appendChild(img);
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

        /** Install confirm card with Yes / No buttons. */
        function _appendConfirm(confirmId, modelName, downloadGb) {
            if (qs(`[data-confirm-id="${CSS.escape(confirmId)}"]`, transcript)) return;
            const div = document.createElement('div');
            div.className = 'mpi-agent-chat__entry mpi-agent-chat__entry--confirm';
            div.dataset.confirmId = confirmId;

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
                    break;
                case 'agent:confirm':
                    _appendConfirm(data.confirmId, data.modelName, data.downloadGb);
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
            }
        }
        /** Staged attachments are {id, name} with no dataUrl: shown through the attachment route. */
        function _stagedThumbs(attachments) {
            return (attachments || []).map((att) => ({
                dataUrl: att.id ? `/agent/attachment/${att.id}` : (att.dataUrl || ''),
                name: att.name || '',
            }));
        }
        ['agent:working', 'agent:message', 'agent:tool', 'agent:confirm', 'agent:result', 'agent:compacting', 'agent:error', 'agent:user']
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
                _appendConfirm(pc.confirmId, pc.modelName, pc.downloadGb);
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
                    // BUSY, NO_PROFILE and a bad body come back as a 200 with ok: false.
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
            // One line to start, level with Send (Fabio, round 2). MpiInput sets no `rows`,
            // so the browser default of 2 made autoHeight's first measurement two lines tall
            // and the box stood well above the button. Set here, not on the Primitive: every
            // other auto-height textarea in the app is sized for a paragraph.
            // The `input` event is how MpiInput's own auto-height handler re-measures; it
            // ran once at mount, against two rows.
            if (textareaEl) {
                textareaEl.rows = 1;
                textareaEl.dispatchEvent(new Event('input'));
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
        _reload().catch(err => clientLogger.warn('MpiAgentChat', 'history load failed', err));

        // ── Cleanup ────────────────────────────────────────────────────────────
        el.destroy = () => {
            _unsubs.forEach(fn => fn());
            _buttons.splice(0).forEach((b) => b.destroy());
        };
    },
});
