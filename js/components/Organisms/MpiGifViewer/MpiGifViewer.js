/**
 * MpiGifViewer — Organism: full-colour GIF frame display (MPI-769).
 *
 * Shows the group's GIF entry frame-by-frame, full colour, decoded at the
 * viewer's own size — never the built (256-colour) `.gif` file, unless the
 * user flips the "GIF preview" toggle, which swaps in the built file as a
 * plain `<img>` so it can be sanity-checked against the frames it was built
 * from. A small window of frames around the current index is kept warm in
 * the browser's own image cache (`_preloadWindow`) so a long GIF never loads
 * every frame at once.
 *
 * The control bar (MpiGifControlBar) and the frame strip (MpiFrameStrip) are
 * NOT owned by the viewer, and unlike MpiVideoViewer this component has no
 * inner sub-component to broker the connection through — it IS the surface.
 * The parent Block holds all three instances already (it mounted them), so
 * it wires them directly: `gifControlBar.el.attachViewer(viewer)` (the
 * `viewer` INSTANCE object `MpiGifViewer.mount()` returned, which already has
 * `.on()`), and both the control bar and the frame strip listen for this
 * viewer's `frame-change` and drive it back via `setFrameIndex`/`stepFrame`.
 *
 * Playback owns its own timer chain because GIF delays are per-frame, not a
 * constant fps: video's `<video>`-driven play/pause has nothing to attach to
 * here. `gif.loop` is total PLAYS (0 = forever, 1 = once, N = N plays) — the
 * same unit `services/gifFrames.js` / `routes/gif.js` already use.
 *
 * Instance API (on el):
 *   loadFrames(frames, { loop = 0 } = {})  — replace the frame list, reset to
 *                                            frame 0, stop any playback.
 *   setFrames(frames)                      — replace the frame list WITHOUT
 *                                            resetting position (staged strip
 *                                            edits): keeps showing the same
 *                                            frame (by hash) when it still
 *                                            exists, else clamps the index.
 *   getFrames() / getFrameCount() / getFrameIndex()
 *   setFrameIndex(idx)                     — jump to an exact index (clamped)
 *   stepFrame(delta)                       — relative step (clamped, no wrap)
 *   play() / pause() / isPlaying()
 *   setGifUrl(url)                         — the built `.gif`'s resolved URL,
 *                                            shown when preview mode is on
 *   setPreview(bool) / togglePreview() / isPreview()
 *   setGenerating(bool) / setLoading(bool) — spinner, OR'd like every viewer
 *   setMaskTint(url|null)                  — MPI-771 (UI half): tint the CURRENT
 *                                            frame with a mask PNG via CSS
 *                                            `mask-image` on a solid overlay —
 *                                            a read-only preview, not a canvas/
 *                                            paint layer, so no UndoStack entry
 *                                            applies (docs/masking-sam3-gif.md).
 *                                            Owned by the cut-out tool panel;
 *                                            `null` clears it.
 *   destroy()
 *
 * The Block wires the control bar / frame strip to this component's own
 * `.on()` (the instance `MpiGifViewer.mount()` returned) — there is no
 * attach method on `el` for either.
 *
 * Emits:
 *   'frame-change' { idx, frame } — index changed (step, scrub, playback)
 *   'play' / 'pause' / 'ended'
 *   'preview-change' { preview }
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { qs } from '../../../utils/dom.js';

/** Frames kept decoded around the current index, each side. */
const CACHE_RADIUS = 6;
/** GIF delay unit is hundredths of a second; never schedule under this floor
 *  (mirrors services/gifFrames.js MIN_DELAY_HUNDREDTHS so a corrupt/zero
 *  delay can't spin the timer chain). */
const MIN_DELAY_MS = 20;

export const MpiGifViewer = ComponentFactory.create({
    name: 'MpiGifViewer',
    css: ['js/components/Organisms/MpiGifViewer/MpiGifViewer.css'],

    template: () => `
        <div class="mpi-gif-viewer" data-mode="frames">
            <div class="mpi-gif-viewer__stage">
                <div class="mpi-gif-viewer__frame-wrap">
                    <img class="mpi-gif-viewer__frame" alt="" />
                    <div class="mpi-gif-viewer__mask-tint" id="mask-tint"></div>
                </div>
                <img class="mpi-gif-viewer__preview" alt="" hidden />
                <div class="mpi-gif-viewer__spinner" id="spinner-wrap"></div>
            </div>
        </div>
    `,

    setup: (el, props, emit) => {
        const frameWrap  = qs('.mpi-gif-viewer__frame-wrap', el);
        const frameImg   = qs('.mpi-gif-viewer__frame', el);
        const maskTintEl = qs('#mask-tint', el);
        const previewImg = qs('.mpi-gif-viewer__preview', el);
        const spinnerWrap = qs('#spinner-wrap', el);
        MpiSpinner.mount(spinnerWrap, { size: 'lg', variant: 'primary' });

        /** @type {Array<{hash:string, url:string, thumbUrl:string, delay:number}>} */
        let _frames = [];
        let _index = 0;
        let _loop = 0; // total plays; 0 = forever
        let _playsDone = 0;
        let _playing = false;
        let _playTimer = null;
        let _preview = false;
        let _gifUrl = null;

        /** @type {Map<string, HTMLImageElement>} hash -> warmed Image */
        const _cache = new Map();

        let _isGenerating = false;
        let _isLoading = false;
        const _syncSpinner = () => {
            spinnerWrap.classList.toggle('mpi-gif-viewer__spinner--visible', _isGenerating || _isLoading);
        };

        function _preloadWindow(idx) {
            const keep = new Set();
            for (let d = -CACHE_RADIUS; d <= CACHE_RADIUS; d++) {
                const f = _frames[idx + d];
                if (!f) continue;
                keep.add(f.hash);
                if (!_cache.has(f.hash)) {
                    const img = new Image();
                    img.src = f.url;
                    _cache.set(f.hash, img);
                }
            }
            for (const hash of [..._cache.keys()]) {
                if (!keep.has(hash)) _cache.delete(hash);
            }
        }

        function _render() {
            const f = _frames[_index];
            if (!f) return;
            frameImg.src = f.url;
            emit('frame-change', { idx: _index, frame: f });
        }

        function _stopPlayback() {
            if (_playTimer) { clearTimeout(_playTimer); _playTimer = null; }
            if (_playing) {
                _playing = false;
                emit('pause');
            }
        }

        function _scheduleNext() {
            const f = _frames[_index];
            const delayMs = Math.max(MIN_DELAY_MS, (Number(f?.delay) || 10) * 10);
            _playTimer = setTimeout(() => {
                if (!_playing) return;
                if (_index >= _frames.length - 1) {
                    _playsDone++;
                    if (_loop !== 0 && _playsDone >= _loop) {
                        _playing = false;
                        emit('pause');
                        emit('ended');
                        return;
                    }
                    _index = 0;
                } else {
                    _index++;
                }
                _preloadWindow(_index);
                _render();
                _scheduleNext();
            }, delayMs);
        }

        // ── Instance API ─────────────────────────────────────────────────

        el.loadFrames = (frames, { loop = 0 } = {}) => {
            _stopPlayback();
            _frames = Array.isArray(frames) ? frames.slice() : [];
            _loop = Number.isFinite(+loop) ? +loop : 0;
            _index = 0;
            _cache.clear();
            if (_frames.length) {
                _preloadWindow(0);
                _render();
            }
        };

        el.setFrames = (frames) => {
            const prevHash = _frames[_index]?.hash;
            _frames = Array.isArray(frames) ? frames.slice() : [];
            let idx = _frames.findIndex(f => f.hash === prevHash);
            if (idx === -1) idx = Math.min(_index, Math.max(0, _frames.length - 1));
            _index = idx;
            _preloadWindow(_index);
            if (_frames.length) _render();
        };

        el.getFrames      = () => _frames.slice();
        el.getFrameCount  = () => _frames.length;
        el.getFrameIndex  = () => _index;

        el.setFrameIndex = (idx) => {
            if (!_frames.length) return;
            const clamped = Math.max(0, Math.min(_frames.length - 1, Math.round(idx)));
            if (clamped === _index) return;
            _index = clamped;
            _preloadWindow(_index);
            _render();
        };

        el.stepFrame = (delta) => el.setFrameIndex(_index + (Number(delta) || 0));

        el.play = () => {
            if (_playing || _preview || _frames.length < 2) return;
            _playing = true;
            _playsDone = 0;
            emit('play');
            _scheduleNext();
        };
        el.pause     = () => _stopPlayback();
        el.isPlaying = () => _playing;

        el.setGifUrl = (url) => {
            _gifUrl = url || null;
            if (_preview) {
                previewImg.src = _gifUrl || '';
                previewImg.hidden = !_gifUrl;
            }
        };

        el.setPreview = (on) => {
            const next = !!on;
            if (next === _preview) return;
            _preview = next;
            if (_preview) {
                _stopPlayback();
                previewImg.src = _gifUrl || '';
                previewImg.hidden = !_gifUrl;
                // Hide the whole wrap, tint included — a mask preview means
                // nothing over the built (256-colour) `.gif`.
                frameWrap.hidden = true;
            } else {
                previewImg.hidden = true;
                frameWrap.hidden = false;
            }
            emit('preview-change', { preview: _preview });
        };
        el.togglePreview = () => el.setPreview(!_preview);
        el.isPreview     = () => _preview;

        el.setGenerating = (on) => { _isGenerating = !!on; _syncSpinner(); };
        el.setLoading    = (on) => { _isLoading = !!on; _syncSpinner(); };

        // MPI-771 (UI half): a solid overlay clipped to the mask PNG via CSS
        // `mask-image`, sized to the frame img's own rendered box by
        // `.mpi-gif-viewer__frame-wrap` (docs/masking-sam3-gif.md) — read-only
        // preview, never a canvas layer, so no UndoStack entry applies.
        el.setMaskTint = (url) => {
            if (url) {
                maskTintEl.style.webkitMaskImage = `url("${url}")`;
                maskTintEl.style.maskImage = `url("${url}")`;
                maskTintEl.classList.add('mpi-gif-viewer__mask-tint--visible');
            } else {
                maskTintEl.classList.remove('mpi-gif-viewer__mask-tint--visible');
                maskTintEl.style.webkitMaskImage = '';
                maskTintEl.style.maskImage = '';
            }
        };

        let _destroyed = false;
        el.destroy = () => {
            if (_destroyed) return;
            _destroyed = true;
            _stopPlayback();
            _cache.clear();
        };
    },
});
