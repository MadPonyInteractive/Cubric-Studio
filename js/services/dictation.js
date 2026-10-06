/**
 * dictation.js — speak into a text box instead of typing (MPI-946).
 *
 * A host mounts an MpiButton with the `mic` icon beside its textarea and hands both to
 * `attachDictation`. Click the mic, speak, click again; or hold Ctrl+Space, speak, release.
 * The recording goes to `POST /deepinfra/transcribe` (Whisper on the user's own DeepInfra
 * key) and the words land at the caret. Nothing is ever sent on the user's behalf: they read
 * it, then press Enter.
 *
 * WEBM AS RECORDED. MediaRecorder's WebM/Opus goes up untouched: Whisper decodes it, and it is
 * a fifth of the WAV's bytes. MpiAudioRecorder re-muxes to WAV only because it SAVES the take,
 * and a saved `.webm` is classified as video; nothing is saved here.
 *
 * GREYED WITHOUT A KEY (Fabio, 2026-09-26): the mic stays visible, disabled, and its Info Bar
 * line says where the key goes. `hasCloudKey()` is the renderer's mirror of the main process's
 * answer, and `models:checked` fires when it changes.
 *
 * The button carries `data-dictate` (idle | recording | held | busy): the hotkey registry's
 * `when` gates read it, the same way other entries read the DOM for a modal or a picker.
 */
import { Hotkeys } from '../managers/hotkeyManager.js';
import { Events } from '../events.js';
import { Storage } from '../core/storage.js';
import { hasCloudKey } from '../data/modelRegistry.js';
import { clientLogger } from './clientLogger.js';
import { on } from '../utils/dom.js';
import { openMic } from '../utils/audioInput.js';

const INFO_READY = 'Dictate: click, speak, click again. Or hold Ctrl+Space while you speak. Your voice is sent to DeepInfra to be written out';
const INFO_NO_KEY = 'Dictate: needs a DeepInfra key. Add one in Settings';
// A tap shorter than this is a slip, not speech, and is not worth a paid call.
const MIN_MS = 300;

/** @type {Set<{btn:HTMLElement, textarea:HTMLTextAreaElement}>} */
const _hosts = new Set();
let _last = null;        // the host whose box had focus most recently
let _take = null;        // the recording in progress
let _unbindKeys = null;

/**
 * Wire a mic button to a text box. Call from the host's `setup()`; call the returned
 * function from its `destroy()`.
 *
 * @param {HTMLElement} btn                  a mounted MpiButton element
 * @param {HTMLTextAreaElement} textarea     where the words land
 * @returns {Function} detach
 */
export function attachDictation(btn, textarea) {
    const host = { btn, textarea };
    _hosts.add(host);
    _mark(host, 'idle');
    const unsubs = [
        on(btn, 'click', () => (_take ? _stop() : _start(host, false))),
        on(textarea, 'focus', () => { _last = host; }),
        Events.on('models:checked', () => { if (btn.dataset.dictate === 'idle') _mark(host, 'idle'); }),
    ];
    if (!_unbindKeys) {
        const release = () => { if (_take?.held) _stop(); };
        const offs = [
            Hotkeys.bind('dictation.hold', (e) => {
                if (e.repeat || _take) return;
                const target = _hotkeyHost();
                if (target) _start(target, true);
            }),
            Hotkeys.bind('dictation.release', release),
            Hotkeys.bind('dictation.release.space', release),
        ];
        _unbindKeys = () => offs.forEach(off => off());
    }
    return () => {
        unsubs.forEach(off => off());
        if (_take?.host === host) { _take.discard = true; _stop(); }
        _hosts.delete(host);
        if (_last === host) _last = null;
        if (!_hosts.size) { _unbindKeys?.(); _unbindKeys = null; }
    };
}

/** The box a held Ctrl+Space speaks into: the focused one, else the last focused, else any on screen. */
function _hotkeyHost() {
    const usable = h => h && h.textarea.isConnected && h.textarea.getBoundingClientRect().width > 0 && !h.btn.disabled;
    const focused = [..._hosts].find(h => h.textarea === document.activeElement);
    return [focused, _last, ...[..._hosts].reverse()].find(usable) || null;
}

function _mark(host, stateName) {
    const { btn } = host;
    btn.dataset.dictate = stateName;
    btn.setActive?.(stateName === 'recording' || stateName === 'held');
    const hasKey = hasCloudKey();
    btn.setDisabled?.(stateName === 'busy' || !hasKey);
    btn.dataset.info = hasKey ? INFO_READY : INFO_NO_KEY;
}

async function _start(host, held) {
    if (_take || host.btn.dataset.dictate === 'busy') return;
    const take = _take = { host, held, chunks: [], recorder: null, stream: null, startedAt: 0, stopAsked: false, discard: false };
    _mark(host, held ? 'held' : 'recording');
    try {
        take.stream = await openMic();
    } catch (err) {
        clientLogger.warn('dictation', `getUserMedia failed: ${err?.name || err}`);
        _take = null;
        _mark(host, 'idle');
        Events.emit('ui:warning', { message: 'The microphone could not be opened. Check it is plugged in, and pick it in Settings.' });
        return;
    }
    take.recorder = new MediaRecorder(take.stream);
    take.recorder.ondataavailable = (e) => { if (e.data.size) take.chunks.push(e.data); };
    take.recorder.onstop = () => _finish(take);
    take.startedAt = Date.now();
    take.recorder.start();
    // Released (or detached) while the mic was still opening.
    if (take.stopAsked) take.recorder.stop();
}

function _stop() {
    if (!_take) return;
    _take.stopAsked = true;
    if (_take.recorder?.state === 'recording') _take.recorder.stop();
}

async function _finish(take) {
    take.stream.getTracks().forEach(t => t.stop());
    _take = null;
    const { host } = take;
    if (take.discard || Date.now() - take.startedAt < MIN_MS || !take.chunks.length) {
        _mark(host, 'idle');
        return;
    }
    _mark(host, 'busy');
    const blob = new Blob(take.chunks, { type: take.recorder.mimeType || 'audio/webm' });
    try {
        const res = await fetch(`/deepinfra/transcribe${Storage.getDictationTranslate() ? '?translate=1' : ''}`, {
            method: 'POST',
            headers: { 'Content-Type': blob.type },
            body: blob,
        });
        const json = await res.json();
        if (!json?.ok) {
            Events.emit('ui:warning', { message: json?.error?.message || 'Dictation failed.' });
            return;
        }
        _insert(host.textarea, json.text);
    } catch (err) {
        clientLogger.warn('dictation', `transcribe failed: ${err?.message || err}`);
        Events.emit('ui:warning', { message: 'Dictation failed: the app could not reach its own server.' });
    } finally {
        _mark(host, 'idle');
    }
}

/**
 * Put the words at the caret, as if typed: `input` fires so the host saves the prompt and
 * MpiInput's auto-height re-measures.
 */
function _insert(textarea, text) {
    if (!text || !textarea.isConnected) return;
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const pad = start > 0 && !/\s$/.test(value.slice(0, start)) ? ' ' : '';
    textarea.setRangeText(pad + text, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
}
