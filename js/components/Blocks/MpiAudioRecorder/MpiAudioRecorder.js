import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiButton, mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiLevelMeter, meterAnalyser } from '../../Primitives/MpiLevelMeter/MpiLevelMeter.js';
import { MpiAudioPlayer } from '../../Organisms/MpiAudioPlayer/MpiAudioPlayer.js';
import { qs, on } from '../../../utils/dom.js';
import { Storage } from '../../../core/storage.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { toWavFile } from '../../../utils/toWavFile.js';
import { uploadMediaFile } from '../../../services/mediaUploadService.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';

/**
 * The waveform mask's rendition, kept equal to `AUDIO_WAVEFORM_PX` in
 * `services/ffmpegThumb.js` so a take looks the same before and after it is saved.
 * ONE 21:9 picture on purpose (MPI-730) — it is stretched to whatever box mounts it.
 */
const WAVE_PX = { w: 1260, h: 540 };

/**
 * Paint a waveform mask for a clip that does not exist on disk yet.
 *
 * A saved audio item carries one baked by ffmpeg (`extractAudioWaveform`), but
 * that runs over a FILE, and the whole point of this dialog is that the take is
 * not a file until Accept. Without a mask the track paints its fills and no wave,
 * which is a flat green bar in a dialog whose subject is the sound. So the same
 * picture is drawn here from the samples in hand.
 *
 * It is `showwavespic`'s shape deliberately: mono mixdown (one band, not one per
 * channel), amplitude on a `sqrt` scale (a mic take is nowhere near a mastered
 * -1 dBFS, and `lin` draws it as a flat line), white on transparent because
 * MpiWaveform consumes an alpha MASK and colours it with tokens, and the same
 * 21:9 rendition the baker emits, since it is stretched to whatever box mounts it.
 *
 * Exported for its check, which drives it with a synthetic clip - no mic, no dialog.
 *
 * @param {Blob} blob
 * @returns {Promise<string|null>} a data URL, or null if the clip would not decode
 */
export async function bakeWaveMask(blob) {
    try {
        // Decoding in an OfflineAudioContext pins the rate; a live AudioContext
        // decodes at the hardware rate, which on this machine is 96 kHz — four
        // times the samples to walk for a picture 1260 pixels wide.
        const octx = new OfflineAudioContext(1, 1, 48000);
        const buf = await octx.decodeAudioData(await blob.arrayBuffer());
        const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));

        const cvs = document.createElement('canvas');
        cvs.width = WAVE_PX.w;
        cvs.height = WAVE_PX.h;
        const g = cvs.getContext('2d');
        // An alpha MASK's ink, not a theme colour: only its coverage is ever read, and
        // MpiWaveform paints it with tokens. The server's bake says the same thing to
        // ffmpeg as `colors=white`.
        // eslint-disable-next-line mpi/no-hardcoded-hex-color -- see above
        g.fillStyle = '#fff';

        const per = Math.max(1, Math.floor(buf.length / WAVE_PX.w));
        for (let x = 0; x < WAVE_PX.w; x++) {
            let peak = 0;
            const from = x * per;
            const to = Math.min(from + per, buf.length);
            for (let i = from; i < to; i++) {
                let sum = 0;
                for (const c of chans) sum += c[i];
                peak = Math.max(peak, Math.abs(sum / chans.length));
            }
            const h = Math.sqrt(peak) * WAVE_PX.h;
            g.fillRect(x, (WAVE_PX.h - h) / 2, 1, Math.max(1, h));
        }
        return cvs.toDataURL('image/png');
    } catch (err) {
        clientLogger.warn('audio-recorder', `waveform bake failed: ${err?.message || err}`);
        return null;
    }
}

/**
 * MpiAudioRecorder — record the user's microphone into a project audio file (Block, MPI-573)
 *
 * Vision has always treated audio as first-class on the way IN — audio gallery cards,
 * audio media slots, an audio filter in the picker — but there was no way to CAPTURE
 * any. Every audio input had to come from a file the user made somewhere else. This is
 * that missing source, and it is the first half of the audio track: the music / TTS /
 * voice-clone Flows that follow all need reference audio, and a voice clone needs the
 * user's own voice specifically.
 *
 * Three states, one button changing meaning:
 *   idle      — a big mic. Click to arm the stream and start.
 *   recording — elapsed time + a live level meter. Click to stop.
 *   review    — playback, then Accept / Re-record / Discard.
 *
 * WHY IT ENCODES TO WAV. MediaRecorder on Chromium hands back a WebM container, and
 * `.webm` is classified as VIDEO by extension in five places on the server (the
 * reconciler at routes/projects.js:1008 and :2722 among them). The sidecar written at
 * upload time would say `audio`, and then the first project reload would silently
 * re-type the card to video. Ogg is not an option either — Chromium's MediaRecorder
 * cannot produce it. So the recorded blob is decoded and re-muxed as a 16-bit WAV,
 * which every one of those lists already knows is audio, and which ComfyUI's own audio
 * loaders take without a transcode.
 *
 * Usage — prefer the promise helper over mounting by hand:
 *   const file = await showAudioRecorder();   // File(.wav) | null
 *
 * Props: none.
 *
 * Emits:
 * 'accept' { file }  — Accept pressed; `file` is a WAV File
 * 'cancel' {}        — Discard, Escape or backdrop
 */
export const MpiAudioRecorder = ComponentFactory.create({
    name: 'MpiAudioRecorder',
    css: ['js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.css'],

    template: () => `
        <div class="mpi-audio-recorder" role="dialog" aria-modal="true" aria-label="Record audio">
            <div class="mpi-audio-recorder__title">Record audio</div>
            <div class="mpi-audio-recorder__stage">
                <div class="mpi-audio-recorder__mic" id="mic-slot"></div>
                <div class="mpi-audio-recorder__meter" id="meter-slot"></div>
                <div class="mpi-audio-recorder__time" id="time-slot">0:00</div>
            </div>
            <div class="mpi-audio-recorder__playback" id="playback-slot"></div>
            <div class="mpi-audio-recorder__hint" id="hint-slot"></div>
            <div class="mpi-audio-recorder__actions" id="actions-slot"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];

        // Live capture handles. All of them are torn down by _release(), which every
        // exit path calls — a mic left open keeps the OS recording indicator lit long
        // after the dialog is gone, which reads to the user as the app spying.
        let _stream = null;
        let _ctx = null;
        let _analyser = null;
        let _recorder = null;
        let _chunks = [];
        let _tick = 0;
        let _startedAt = 0;
        let _blob = null;
        let _player = null;
        let _playbackUrl = null;
        let _recordedSecs = 0;
        let _state = 'idle';   // idle | recording | review

        // backdropClose stays ON here (unlike the licence gate): a click outside a
        // recorder is unambiguously "not now", and _release() runs on teardown either
        // way, so the mic never survives the dismissal.
        const modal = MpiModal.mount(document.createElement('div'), {
            width: 'min(420px, 92vw)',
        });
        modal.el.appendChild(el);
        el.show = () => modal.el.show();
        el.hide = () => modal.el.hide();

        const meter = MpiLevelMeter.mount(qs('#meter-slot', el), { showValue: false });
        let _stopMeter = null;
        const timeSlot  = qs('#time-slot', el);
        const hintSlot  = qs('#hint-slot', el);
        const playSlot  = qs('#playback-slot', el);

        // ── The one big button. Its meaning follows the state ────────────────
        const micBtn = mountButton({
            icon: 'mic',
            size: 'lg',
            variant: 'secondary',
            extraClasses: 'mpi-audio-recorder__mic-btn',
        });
        micBtn.title = 'Start recording';
        _unsubs.push(on(micBtn, 'click', () => {
            if (_state === 'idle') _start();
            else if (_state === 'recording') _stop();
        }));
        qs('#mic-slot', el).appendChild(micBtn);

        // ── Actions ──────────────────────────────────────────────────────────
        const actions = qs('#actions-slot', el);

        const discardBtn = MpiButton.mount(document.createElement('div'), {
            text: 'Discard', variant: 'secondary', size: 'md',
        });
        discardBtn.on('click', () => { emit('cancel', {}); el.hide(); });
        actions.appendChild(discardBtn.el);

        const redoBtn = MpiButton.mount(document.createElement('div'), {
            text: 'Re-record', variant: 'secondary', size: 'md',
        });
        redoBtn.on('click', () => _reset());
        actions.appendChild(redoBtn.el);

        const acceptBtn = MpiButton.mount(document.createElement('div'), {
            text: 'Accept', variant: 'primary', size: 'md', disabled: true,
        });
        acceptBtn.on('click', async () => {
            if (!_blob) return;
            acceptBtn.el.setDisabled(true);
            hintSlot.textContent = 'Encoding…';
            const file = await toWavFile(_blob);
            if (!file) {
                hintSlot.textContent = 'That recording could not be encoded. Try again.';
                acceptBtn.el.setDisabled(false);
                return;
            }
            emit('accept', { file });
            el.hide();
        });
        actions.appendChild(acceptBtn.el);

        _render();

        // ── Capture ──────────────────────────────────────────────────────────

        /**
         * Arm the mic and start recording.
         *
         * The graph is source → gain → destination rather than recording the raw
         * track, so the input-gain setting is applied to what is actually written
         * rather than only to what the meter shows. The analyser hangs off the gain
         * node for the same reason: the meter has to report the recorded level, or a
         * user who turns the gain up sees no change and turns it up again.
         */
        async function _start() {
            const deviceId = Storage.getAudioInputDevice();
            const gain = Storage.getAudioInputGain();
            try {
                _stream = await navigator.mediaDevices.getUserMedia({
                    audio: deviceId ? { deviceId: { ideal: deviceId } } : true,
                });
            } catch (err) {
                // Two very different failures land here and the user can only fix one
                // of them from inside the app, so say which it is.
                const denied = err?.name === 'NotAllowedError';
                hintSlot.textContent = denied
                    ? 'Microphone access was refused. Allow it for Cubric Studio in your system privacy settings, then try again.'
                    : 'No microphone was found. Check it is plugged in and selected in Settings.';
                clientLogger.warn('audio-recorder', `getUserMedia failed: ${err?.name || err}`);
                return;
            }

            _ctx = new AudioContext();
            const source = _ctx.createMediaStreamSource(_stream);
            const gainNode = _ctx.createGain();
            gainNode.gain.value = gain;
            _analyser = _ctx.createAnalyser();
            _analyser.fftSize = 1024;
            const dest = _ctx.createMediaStreamDestination();
            source.connect(gainNode);
            gainNode.connect(_analyser);
            gainNode.connect(dest);

            _chunks = [];
            _recorder = new MediaRecorder(dest.stream);
            _recorder.ondataavailable = (e) => { if (e.data.size) _chunks.push(e.data); };
            _recorder.onstop = () => {
                _blob = new Blob(_chunks, { type: _recorder.mimeType || 'audio/webm' });
                // The take's length, off the same clock the elapsed readout used. The
                // player needs it: Chromium reports `Infinity` for a MediaRecorder WebM
                // blob until it is seeked, so metadata alone would paint no duration.
                _recordedSecs = (Date.now() - _startedAt) / 1000;
                // Release HERE, not in _stop(). MediaRecorder delivers its last chunk
                // and then onstop as queued tasks; tearing the graph down on a timer
                // beside them races that queue and can clip the tail off the take.
                _releaseCapture();
                _state = 'review';
                _buildPlayback();
                _render();
            };
            _recorder.start();

            _startedAt = Date.now();
            _state = 'recording';
            _render();
            _stopMeter = meterAnalyser(_analyser, meter.el);
            _tick = setInterval(_renderTime, 200);
        }

        function _stop() {
            if (_recorder?.state === 'recording') _recorder.stop();
            _stopMeter?.();
            _stopMeter = null;
            clearInterval(_tick);
        }

        function _renderTime() {
            const s = Math.floor((Date.now() - _startedAt) / 1000);
            timeSlot.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }

        /**
         * Mount the review transport — our own player, never the browser's controls.
         *
         * A FRESH instance every time, because MpiAudioPlayer owns one <audio> whose
         * `src` is set once and never re-pointed (MPI-727): Re-record has to destroy
         * and re-mount, not swap the URL. No `mask` — a just-recorded take has no
         * baked waveform, and a maskless player still scrubs. `hotkeys: false`: this
         * is a modal whose buttons take focus, so SPACE on Accept would both press
         * the button and toggle playback.
         *
         * The wave arrives AFTER the transport, not with it: decoding a take costs
         * real time, and the player scrubs and plays perfectly well while it is still
         * a plain bar. Re-record can land first, which is why the mask is only applied
         * if the instance it was baked for is still the mounted one.
         */
        function _buildPlayback() {
            _dropPlayback();
            _playbackUrl = URL.createObjectURL(_blob);
            _player = MpiAudioPlayer.mount(document.createElement('div'), {
                src: _playbackUrl, duration: _recordedSecs, hotkeys: false,
            });
            playSlot.appendChild(_player.el);

            const mine = _player;
            bakeWaveMask(_blob).then((mask) => {
                if (mask && _player === mine) _player.el.setMask(mask);
            });
        }

        /** Tear the review transport down and let its blob go. Idempotent. */
        function _dropPlayback() {
            _player?.destroy();
            _player = null;
            if (_playbackUrl) URL.revokeObjectURL(_playbackUrl);
            _playbackUrl = null;
            playSlot.textContent = '';
        }

        function _reset() {
            _releaseCapture();
            _dropPlayback();
            _recordedSecs = 0;
            _blob = null;
            _chunks = [];
            _state = 'idle';
            timeSlot.textContent = '0:00';
            meter.el.reset();
            _render();
        }

        function _render() {
            const recording = _state === 'recording';
            const review = _state === 'review';

            el.classList.toggle('mpi-audio-recorder--recording', recording);
            el.classList.toggle('mpi-audio-recorder--review', review);

            micBtn.style.display = review ? 'none' : '';
            micBtn.title = recording ? 'Stop recording' : 'Start recording';
            micBtn.setIcon(recording ? 'stop' : 'mic');

            redoBtn.el.style.display = review ? '' : 'none';
            acceptBtn.el.setDisabled(!review);

            if (!review) {
                hintSlot.textContent = recording
                    ? 'Recording — click to stop'
                    : 'Click the microphone to start';
            } else {
                hintSlot.textContent = 'Accept saves the clip to this project.';
            }
        }

        /** Drop the mic. Idempotent — every exit path calls it. */
        function _releaseCapture() {
            _stopMeter?.();
            _stopMeter = null;
            clearInterval(_tick);
            _stream?.getTracks().forEach(t => t.stop());
            _stream = null;
            _analyser = null;
            _ctx?.close().catch(() => {});
            _ctx = null;
            _recorder = null;
        }

        el.destroy = () => {
            _releaseCapture();
            _dropPlayback();
            _unsubs.forEach(fn => fn());
            _unsubs.length = 0;
            discardBtn?.el?.destroy?.();
            redoBtn?.el?.destroy?.();
            acceptBtn?.el?.destroy?.();
            modal?.el?.destroy?.();
        };
    },
});

/**
 * Show the recorder and resolve the recorded clip, or null if the user backed out.
 * A fresh instance per call — the dialog holds a live capture graph and one-shot state.
 * @returns {Promise<File|null>}
 */
export function showAudioRecorder() {
    return new Promise((resolve) => {
        const rec = MpiAudioRecorder.mount(document.createElement('div'), {});
        let settled = false;
        // Escape / ui:close-all-popups tear the modal down without emitting either.
        // Without this the caller's await never settles AND the mic is never released,
        // so the OS recording indicator stays lit — see MpiLicenceGate for the same
        // guard protecting the install chain.
        const observer = new MutationObserver(() => {
            if (!document.body.contains(rec.el)) finish(null);
        });
        const finish = (file) => {
            if (settled) return;
            settled = true;
            observer.disconnect();
            rec.destroy();
            resolve(file);
        };
        rec.on('accept', ({ file }) => finish(file));
        rec.on('cancel', () => finish(null));
        rec.el.show();
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

/**
 * Record, and land the clip in the current project as a normal audio card.
 *
 * A recording is NOT an import: it exists nowhere else, so it takes the same route
 * a gallery drop takes — `uploadMediaFile` writes the file and its sidecar,
 * `media:imported` builds the card — rather than a Flow slot's place-and-hash path,
 * which would fill the slot and leave nothing behind.
 *
 * Both entry points (the gallery's Record button and the media picker's mic card)
 * go through here, so a recording is saved identically whichever surface reached it.
 *
 * @returns {Promise<{filePath:string, filename:string, itemId:string, duration:number|null}|null>}
 *          null if the user backed out, there is no open project, or the save failed.
 */
export async function recordAudioIntoProject() {
    const file = await showAudioRecorder();
    if (!file) return null;

    const project = state.currentProject;
    if (!project?.folderPath || !project?.id) {
        clientLogger.warn('audio-recorder', 'No current project — cannot save the recording');
        return null;
    }

    const uploaded = await uploadMediaFile(file, 'audio', project.folderPath, project.id, {
        filenamePrefix: 'recording', operation: 'recorded',
    });
    if (!uploaded) return null;

    Events.emit('media:imported', {
        url: uploaded.filePath,
        filename: uploaded.filename,
        itemId: uploaded.itemId,
        thumbPath: uploaded.thumbPath,
        pixelDimensions: uploaded.pixelDimensions,
        duration: uploaded.duration,
        mediaType: 'audio',
    });
    return uploaded;
}
