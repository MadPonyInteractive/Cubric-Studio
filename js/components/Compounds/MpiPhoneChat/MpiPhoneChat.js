import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { ce, qs, on } from '../../../utils/dom.js';
import { renderMarkdownInto } from '../../../utils/markdown.js';
import { onStream } from '../../../services/eventStream.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { pickPhoto, fileToDataUrl, saveMedia, shareMedia, canShare } from '../../../phone/phoneMedia.js';

/**
 * MpiPhoneChat — Cosmo on the phone (MPI-1300, Phase 2).
 *
 * The same conversation the PC's chat shows for that project, over the same routes
 * (`docs/agent-chat.md`): `/agent/history` on load, `POST /agent/message` to send, the
 * `agent:*` events on `/events/stream` for the reply. Not MpiAgentChat: that one is built
 * into the desktop shell (mascot crew, router, prompt-box settings) and cannot load in a
 * phone's browser. Spec: tasks/MPI-1300/research/mockups/phone.html, screens 01-02.
 *
 * Props: none. Instance methods (on instance.el):
 *   setProject(project) — { folderPath, name } or null (the landing conversation); reloads.
 *   attachCard(card)    — { name, url, mediaType, itemId, groupId }: "To Cosmo" from the viewer.
 */

const EVENTS = ['agent:working', 'agent:message', 'agent:tool', 'agent:confirm', 'agent:result',
    'agent:job', 'agent:error', 'agent:user', 'agent:session'];

async function _json(url, body) {
    const res = await fetch(url, body === undefined ? undefined : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return res.json();
}

/** Staged attachments come back as { id, name } (or a card's own url), never a data URL. */
const _staged = (atts) => (atts || []).map((a) => ({ name: a.name, src: a.url || (a.id ? `/agent/attachment/${a.id}` : a.dataUrl || '') }));

export const MpiPhoneChat = ComponentFactory.create({
    name: 'MpiPhoneChat',
    css: ['js/components/Compounds/MpiPhoneChat/MpiPhoneChat.css', 'styles/markdown.css'],

    template: () => `
        <div class="mpi-phone-chat">
            <div class="mpi-phone-chat__log" role="log" aria-live="polite"></div>
            <div class="mpi-phone-chat__attachments"></div>
            <div class="mpi-phone-chat__composer">
                <div class="mpi-phone-chat__photo"></div>
                <div class="mpi-phone-chat__field"></div>
                <div class="mpi-phone-chat__send"></div>
            </div>
        </div>`,

    setup: (el) => {
        const log = qs('.mpi-phone-chat__log', el);
        const attachStrip = qs('.mpi-phone-chat__attachments', el);
        const children = [];      // lives as long as the chat
        let entryKids = [];       // lives as long as the transcript (cleared on reload)
        let chipKids = [];        // the pending-attachment chips
        const unsubs = [];
        const mount = (slot, Comp, props, bucket = entryKids) => {
            const inst = Comp.mount(ce('div'), props);
            slot.appendChild(inst.el);
            bucket.push(inst);
            return inst;
        };

        let _project = null;
        let _session = null;      // the server's key for this conversation; events carry it
        let _loading = null;
        let _queued = [];
        const _pending = [];      // attachments waiting for Send
        let _working = null;
        const _live = new Map();  // toolCallId -> live card row
        const _tools = new Map(); // tool entry id -> its status line

        const scrollEnd = () => { log.scrollTop = log.scrollHeight; };
        const row = (cls, ...kids) => {
            const div = ce('div', { className: `mpi-phone-chat__row ${cls}` }, kids);
            log.appendChild(div);
            if (_working && div !== _working) log.appendChild(_working);   // "working" stays last
            scrollEnd();
            return div;
        };
        const cosmo = (...kids) => row('mpi-phone-chat__row--cosmo',
            ce('img', { className: 'mpi-phone-chat__head', src: 'assets/mascot/studio/logo.webp', alt: 'Cosmo' }),
            ce('div', { className: 'mpi-phone-chat__body' }, kids));

        // ── Entries ──────────────────────────────────────────────────────────
        function appendUser(text, attachments = []) {
            const pics = attachments.map((a) => ce('img', { className: 'mpi-phone-chat__photo-sent', src: a.src, alt: a.name || '' }));
            row('mpi-phone-chat__row--me', ...pics, text ? ce('div', { className: 'mpi-phone-chat__bubble', textContent: text }) : null);
        }

        function appendMessage(text) {
            const p = ce('div', { className: 'mpi-md mpi-phone-chat__text' });
            renderMarkdownInto(p, text || '');
            cosmo(p);
        }

        function appendTool(id, label, status) {
            let line = _tools.get(id);
            if (!line) {
                line = ce('div', { className: 'mpi-phone-chat__tool' }, [ce('span', { className: 'mpi-phone-chat__dot' }), ce('span')]);
                _tools.set(id, line);
                cosmo(line);
            }
            line.lastChild.textContent = label || '';
            line.dataset.status = status || 'done';
        }

        function appendError(message) {
            cosmo(ce('div', { className: 'mpi-phone-chat__error', textContent: message }));
        }

        /** A job Cosmo just sent: a running card with Stop, until its result replaces it. */
        function appendJob({ toolCallId, label }) {
            if (!toolCallId || _live.has(toolCallId)) return;
            const card = ce('div', { className: 'mpi-phone-chat__live' }, [
                ce('div', { className: 'mpi-phone-chat__live-label', textContent: label || 'Generating' }),
            ]);
            // No step count reaches the phone until Phase 4: the moving sweep, never a still bar.
            const bar = mount(card, MpiProgressBar, { value: 100 });
            bar.el.classList.add('mpi-progress--loading');
            const stop = mount(card, MpiButton, { icon: 'stop', label: 'Stop', variant: 'danger', info: 'Stop this generation' });
            stop.on('click', async () => {
                stop.el.setDisabled(true);
                const r = await _json('/connector/cancel', { requestId: toolCallId }).catch(() => null);
                if (!r?.ok) {
                    stop.el.setDisabled(false);
                    appendError(r?.error?.message || 'Could not stop it.');
                }
            });
            _live.set(toolCallId, cosmo(card));
        }

        function endJob(toolCallId) {
            _live.get(toolCallId)?.remove();
            _live.delete(toolCallId);
        }

        function appendResult(output, toolCallId) {
            endJob(toolCallId);
            if (!output?.filePath) return;
            const media = output.type === 'video'
                ? ce('video', { className: 'mpi-phone-chat__media', src: output.filePath, controls: true, playsInline: true, muted: true })
                : ce('img', { className: 'mpi-phone-chat__media', src: output.filePath, alt: 'Result' });
            const actions = ce('div', { className: 'mpi-phone-chat__actions' });
            const act = (icon, label, fn) => mount(actions, MpiButton, { icon, label, variant: 'secondary', info: label }).on('click', fn);
            act('download', 'Save', () => saveMedia(output.filePath));
            if (canShare()) {
                act('upload', 'Share', () => shareMedia(output.filePath)
                    .catch((err) => { if (err?.name !== 'AbortError') appendError(`Share failed: ${err.message}`); }));
            }
            act('refresh', 'Again', () => send('Again, the same way.', []));
            cosmo(ce('div', { className: 'mpi-phone-chat__result' }, [media, actions]));
        }

        function appendConfirm({ confirmId, kind, modelName, downloadGb, count, price }) {
            if (!confirmId || qs(`[data-confirm-id="${CSS.escape(confirmId)}"]`, log)) return;
            const box = ce('div', { className: 'mpi-phone-chat__confirm' });
            box.dataset.confirmId = confirmId;
            const yesNo = kind === 'install' || kind === 'batch' || kind === 'spend';
            // REDESIGN-DEVIATION: the PC's choice cards (Song lyrics, voice, model, tiles) are
            // drawn from MpiAgentChat's CHOICE_CARDS; until that table is shared they are
            // answered on the PC.
            const title = kind === 'install' ? `Install ${modelName || 'this model'}?`
                : kind === 'batch' ? `Run this ${count} times?`
                    : kind === 'spend' ? `Run this on ${modelName || 'this model'}${count > 1 ? `, ${count} times` : ''}?`
                        : 'Cosmo is asking something you can answer on your PC.';
            const sub = kind === 'install' && downloadGb != null ? `Download: ${Number(downloadGb).toFixed(1)} GB`
                : kind === 'spend' ? (price ? `Runs on your DeepInfra key and costs ${price}.` : 'Runs on your DeepInfra key. The cost is not known until it finishes.')
                    : '';
            box.append(ce('div', { className: 'mpi-phone-chat__confirm-title', textContent: title }));
            if (sub) box.append(ce('div', { className: 'mpi-phone-chat__confirm-sub', textContent: sub }));
            if (yesNo) {
                const actions = ce('div', { className: 'mpi-phone-chat__actions' });
                box.append(actions);
                const no = mount(actions, MpiButton, { text: 'No', variant: 'secondary' });
                const yes = mount(actions, MpiButton, { text: kind === 'install' ? 'Yes, install' : 'Yes, run it', variant: 'primary' });
                const answer = (ok) => async () => {
                    no.el.setDisabled(true);
                    yes.el.setDisabled(true);
                    const r = await _json('/agent/confirm', { confirmId, yes: ok }).catch(() => null);
                    if (!r?.ok) appendError(r?.error?.message || 'That answer did not reach the PC.');
                };
                no.on('click', answer(false));
                yes.on('click', answer(true));
            }
            cosmo(box);
        }

        function setWorking(working) {
            if (working && !_working) {
                _working = cosmo(ce('div', { className: 'mpi-phone-chat__thinking', textContent: 'Cosmo is working…' }));
            } else if (!working && _working) {
                _working.remove();
                _working = null;
            }
        }

        // ── The stream ───────────────────────────────────────────────────────
        function apply(name, d) {
            if (name === 'agent:session') {
                if (_session !== null && (d.from === _session || d.to === _session)) reload();
                return;
            }
            if (d.session !== _session) return;
            switch (name) {
                case 'agent:working': setWorking(d.working); break;
                case 'agent:message': appendMessage(d.text); break;
                case 'agent:tool': appendTool(d.id, d.label, d.status); break;
                case 'agent:confirm': appendConfirm(d); break;
                case 'agent:job': appendJob(d); break;
                case 'agent:result':
                    if (d.ok) appendResult(d.output, d.toolCallId);
                    else { endJob(d.toolCallId); appendError(d.error?.message || 'It failed.'); }
                    break;
                case 'agent:error': appendError(d.message || d.code); setWorking(false); break;
                case 'agent:user': appendUser(d.text, _staged(d.attachments)); break;
            }
        }
        for (const name of EVENTS) {
            unsubs.push(onStream(name, (e) => {
                let d;
                try { d = JSON.parse(e.data); } catch { return; }
                if (_loading) _queued.push([name, d]);
                else apply(name, d);
            }));
        }

        async function reload() {
            const load = {};
            _loading = load;
            _queued = [];
            const url = _project?.folderPath ? `/agent/history?project=${encodeURIComponent(_project.folderPath)}` : '/agent/history';
            const h = await _json(url).catch((err) => ({ ok: false, error: { message: err.message } }));
            if (_loading !== load) return;   // a newer load took over
            entryKids.forEach((c) => c.destroy?.());
            entryKids = [];
            log.replaceChildren();
            _tools.clear();
            _live.clear();
            _working = null;
            _session = h.ok ? h.session : null;
            if (!h.ok) appendError(`Could not load the conversation: ${h.error?.message || 'no answer'}`);
            for (const e of h.entries || []) {
                if (e.kind === 'user') appendUser(e.text, _staged(e.attachments));
                else if (e.kind === 'agent') appendMessage(e.text);
                else if (e.kind === 'tool') appendTool(e.id || e.tool, e.label, e.status);
                else if (e.kind === 'result') {
                    if (e.ok) appendResult(e.output, e.toolCallId);
                    else if (e.error) appendError(e.error.message);
                }
            }
            if (h.ok && !(h.entries || []).length) {
                cosmo(ce('div', { className: 'mpi-phone-chat__text', textContent: 'Tell me what to make, or send me a photo.' }));
            }
            if (h.pendingConfirm) appendConfirm(h.pendingConfirm);
            if (h.working) setWorking(true);
            _loading = null;
            for (const [n, d] of _queued.splice(0)) apply(n, d);
        }

        // ── Sending ──────────────────────────────────────────────────────────
        async function send(text, attachments) {
            if (!text && !attachments.length) return;
            appendUser(text, attachments.map((a) => ({ name: a.name, src: a.dataUrl || a.url })));
            const prefs = await _json('/phone/agent-prefs').catch(() => null);
            if (!prefs?.ok) return appendError('Your PC did not answer. Is Cubric Studio still open there?');
            const { profileId, model, mode } = prefs.output;
            const r = await _json('/agent/message', {
                text, attachments, mode, model, profileId,
                project: _project?.folderPath ? { folderPath: _project.folderPath, name: _project.name } : null,
            }).catch((err) => ({ ok: false, error: { message: err.message } }));
            if (!r.ok) {
                return appendError(r.error?.code === 'NO_PROFILE'
                    ? 'Cosmo has no language model connected yet. Set one up in Settings on your PC.'
                    : (r.error?.message || 'The message did not reach the PC.'));
            }
            _session = r.session;
            setWorking(true);
        }

        function renderPending() {
            chipKids.forEach((c) => c.destroy?.());
            chipKids = [];
            attachStrip.replaceChildren(..._pending.map((a, i) => {
                const chip = ce('div', { className: 'mpi-phone-chat__chip' }, [ce('img', { src: a.dataUrl || a.url, alt: a.name || '' })]);
                mount(chip, MpiButton, { icon: 'close', variant: 'ghost', size: 'sm', info: 'Remove' }, chipKids)
                    .on('click', () => { _pending.splice(i, 1); renderPending(); });
                return chip;
            }));
            el.classList.toggle('mpi-phone-chat--attached', _pending.length > 0);
        }

        const field = mount(qs('.mpi-phone-chat__field', el), MpiInput, { type: 'textarea', placeholder: 'Message Cosmo', autoHeight: true }, children);
        const textarea = qs('textarea', field.el);
        if (textarea) {
            textarea.rows = 1;
            textarea.style.height = '';
        }
        const sendBtn = mount(qs('.mpi-phone-chat__send', el), MpiButton, { icon: 'chevronRight', variant: 'primary', info: 'Send' }, children);
        const photoBtn = mount(qs('.mpi-phone-chat__photo', el), MpiButton, { icon: 'camera', variant: 'ghost', info: 'Take or pick a photo' }, children);

        function doSend() {
            const text = (textarea?.value || '').trim();
            if (!text && !_pending.length) return;
            send(text, _pending.splice(0));
            field.el.setValue('');
            renderPending();
        }
        sendBtn.on('click', doSend);
        if (textarea) {
            unsubs.push(on(textarea, 'keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
            }));
        }
        photoBtn.on('click', async () => {
            const file = await pickPhoto();
            if (!file) return;
            try {
                _pending.push({ name: file.name, dataUrl: await fileToDataUrl(file) });
                renderPending();
            } catch (err) {
                clientLogger.warn('phone', `photo read failed: ${err.message}`);
                appendError('Could not read that photo.');
            }
        });

        el.setProject = (project) => { _project = project; reload(); };
        el.attachCard = (card) => {
            _pending.push(card);
            renderPending();
            textarea?.focus();
        };
        el.destroy = () => {
            unsubs.forEach((u) => u());
            [...children, ...entryKids, ...chipKids].forEach((c) => c.destroy?.());
        };
    },
});
