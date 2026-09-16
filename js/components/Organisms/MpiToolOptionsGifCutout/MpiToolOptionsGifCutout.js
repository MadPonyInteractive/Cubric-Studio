/**
 * MpiToolOptionsGifCutout — Organism: the GIF cut-out tool group (MPI-771).
 *
 * SAM3 video tracking by name into a new alpha-cut entry. A track is a STARTING
 * POINT (plan Decision 14): object numbers need not stay the same object from
 * frame to frame, so the user fixes frames by hand with the Mask Brush, a
 * separate tool. The masks themselves live on the viewer (`MpiGifViewer`,
 * per frame position), which is how this panel and the brush share them.
 *
 *   1. Track All: name the object, track it across every frame. Track Single
 *      Frame: the same graph on a one-frame video, replacing only the current
 *      frame's track. Either replaces TRACKS only; brush fixes survive.
 *   2. The numbered preview (`SAM3_TrackPreview`) says which index is which
 *      object; the 4 chips keep or drop them. A toggle re-dispatches the LAST
 *      scope, which is cheap: `SAM3_VideoTrack` is cached, only the mask node
 *      re-runs. There is no count input: each name is stamped `name:4`, the
 *      same 4 as the chips (`max_objects`, a graph literal). A bare name finds
 *      ONE object (docs/masking-sam3.md).
 *   3. Mask Adjust (Grow/Shrink) + Fill Holes + Invert — set ONCE for every
 *      frame; the current frame gets a live tint built with the same
 *      `distanceField.js` functions `routes/gifCutout.js` runs at Cut-out time.
 *   4. Cut out -> emits `apply`; the Block posts `/gif-cutout/apply` and
 *      appends the entry (same division as every other tool's 'apply').
 *
 * Props:
 * @param {object} viewer - MpiGifViewer instance
 *
 * Block hooks (on el): `onFrameChange()`, `onMasksChange()` — the Block owns
 * the one subscription to each viewer event and forwards here.
 *
 * Emits:
 *   'mask-tint' { url: string|null } — current-frame adjusted preview
 *   'apply' { frames, masks, adjust, invert } — Cut-out pressed
 */

import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiCheckbox } from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiVideoSurface } from '../../Compounds/MpiVideoSurface/MpiVideoSurface.js';
import { signedSquaredDistanceField, rangeFor, writeRange } from '../../Primitives/MpiCanvas/managers/distanceField.js';
import { Events } from '../../../events.js';
import { state } from '../../../state.js';
import { getToolSettings } from '../../../data/projectModel.js';
import { stampDetectionCount } from '../../../utils/maskTextPrompt.js';
import { runGifCutoutTrack } from '../../../services/commandExecutor.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { StatusBar } from '../../../shell/statusBar.js';
import { qs } from '../../../utils/dom.js';

/** `SAM3_TrackToMask`'s `max_objects` is a fixed graph literal (docs/masking-sam3-gif.md). */
const OBJECT_SLOTS = 4;
const MAX_R = 50;
/** Decoded masks kept for the tint; composed masks are data URLs, so keys can be big. */
const DECODE_CACHE = 8;
const DEFAULTS = { textPrompt: '' };

/** A frame list's identity: its hashes in order (masks are per position). */
const frameSignature = (frames) => frames.map(f => f.hash).join('|');

export const MpiToolOptionsGifCutout = ComponentFactory.create({
    name: 'MpiToolOptionsGifCutout',
    css: ['js/components/Organisms/MpiToolOptionsGifCutout/MpiToolOptionsGifCutout.css'],

    template: () => `
        <div class="mpi-tool-options-gif-cutout">
            <p class="mpi-tool-options-gif-cutout__info">
                Name what to cut out — <b>mascot</b>, <b>logo</b>. A track is a starting
                point: step through the frames and fix any of them with the <b>Mask Brush</b>.
            </p>
            <div class="mpi-tool-options-gif-cutout__prompt" id="prompt-slot"></div>
            <div class="mpi-tool-options-gif-cutout__row" id="track-slot">
                <div id="track-all-slot"></div>
                <div id="track-frame-slot"></div>
            </div>

            <div class="mpi-tool-options-gif-cutout__preview" id="preview-wrap" hidden>
                <div class="mpi-tool-options-gif-cutout__section-label">Tracked objects</div>
                <div class="mpi-tool-options-gif-cutout__preview-frame" id="preview-video-slot"></div>
                <div class="mpi-tool-options-gif-cutout__chips" id="chips-slot"></div>
            </div>

            <div class="mpi-tool-options-gif-cutout__section" id="adjust-section" hidden>
                <div class="mpi-tool-options-gif-cutout__section-label">Mask Adjust</div>
                <div class="mpi-tool-options-gif-cutout__slider-row">
                    <div class="mpi-tool-options-gif-cutout__label">
                        <span>Shrink / Grow</span>
                        <span id="grow-val"></span>
                    </div>
                    <div id="grow-slot"></div>
                </div>
                <div class="mpi-tool-options-gif-cutout__row" id="fill-slot"></div>
                <div class="mpi-tool-options-gif-cutout__row" id="invert-slot"></div>
            </div>

            <div class="mpi-tool-options-gif-cutout__actions" id="cutout-slot"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const { viewer } = props;
        const _children = [];

        const settings = { ...DEFAULTS, ...getToolSettings(state.currentProject || {}, 'gifCutout', DEFAULTS) };
        let _raw = typeof settings.textPrompt === 'string' ? settings.textPrompt : '';

        /** Kept object indices (default: every slot — "keep everything"). */
        const _selected = new Set(Array.from({ length: OBJECT_SLOTS }, (_, i) => i));

        let _busy = false;
        let _trackExec = null;
        /** What the chips re-dispatch: 'all', or the frame { idx, hash } last tracked alone. */
        let _lastScope = null;
        /** Temp source videos by frame signature — a chip re-dispatch reuses one. */
        const _videos = new Map();
        let _grow = 0;
        let _fillHoles = false;
        let _invert = false;
        let _destroyed = false;

        /** Raw decoded alpha, then its distance field, per mask URL (small LRU). */
        const _alphaCache = new Map(); // url -> { width, height, alpha: Uint8Array }
        const _fieldCache = new Map(); // url -> Float32Array
        const _remember = (map, key, value) => {
            map.set(key, value);
            if (map.size > DECODE_CACHE) map.delete(map.keys().next().value);
            return value;
        };

        // ── Name ────────────────────────────────────────────────────────────

        const promptInput = MpiInput.mount(qs('#prompt-slot', el), {
            type: 'text', value: _raw, placeholder: 'mascot, logo',
            info: 'What to cut out. Separate several with commas.',
        });
        promptInput.on('input', ({ value }) => {
            _raw = value;
            Events.emit('settings:tool:update', { toolKey: 'gifCutout', key: 'textPrompt', value });
        });
        _children.push(promptInput);

        // ── Track All / Track Single Frame — the running one turns into Stop ──

        const trackBtns = { all: null, frame: null };
        const TRACK_BTN = {
            all:   { slot: '#track-all-slot',   label: 'Track All',          icon: 'search', info: 'Track the named object across every frame' },
            frame: { slot: '#track-frame-slot', label: 'Track Single Frame', icon: 'search', info: 'Track it on this frame only; the other frames keep their masks' },
        };
        let _runningKind = null;
        function _mountTrackBtns() {
            for (const kind of ['all', 'frame']) {
                const def = TRACK_BTN[kind];
                trackBtns[kind]?.destroy?.();
                const stop = _busy && _runningKind === kind;
                trackBtns[kind] = MpiButton.mount(qs(def.slot, el), stop
                    ? { label: 'Stop', icon: 'stop', size: 'sm', variant: 'danger', info: 'Stop tracking' }
                    : { label: def.label, icon: def.icon, size: 'sm', variant: kind === 'all' ? 'primary' : 'secondary', info: def.info });
                if (_busy && !stop) trackBtns[kind].el.setDisabled?.(true);
                trackBtns[kind].on('click', () => {
                    if (stop) { _trackExec?.cancel?.(); return; }
                    const frames = viewer.el.getFrames();
                    if (kind === 'all') { _runTrack('all'); return; }
                    const idx = viewer.el.getFrameIndex();
                    if (frames[idx]) _runTrack({ idx, hash: frames[idx].hash });
                });
            }
        }
        _mountTrackBtns();

        // ── Preview video — MpiVideoSurface, the numbered debug loop ───────────

        const previewWrap = qs('#preview-wrap', el);
        const previewVideo = MpiVideoSurface.mount(qs('#preview-video-slot', el), {
            autoplay: true, loop: true, muted: true,
        });
        _children.push(previewVideo);

        // ── Object chips — fixed 4 slots (max_objects is a graph literal) ──────

        const chipsSlot = qs('#chips-slot', el);
        const chipEls = [];
        for (let i = 0; i < OBJECT_SLOTS; i++) {
            const wrap = document.createElement('div');
            chipsSlot.appendChild(wrap);
            const chip = MpiCheckbox.mount(wrap, {
                checked: true, label: String(i), name: `gif-cutout-object-${i}`,
            });
            chip.on('change', ({ checked }) => {
                if (checked) _selected.add(i);
                else if (_selected.size > 1) _selected.delete(i);
                else {
                    // Never let the last kept object go — '' would mean "keep
                    // everything" server-side, the opposite of "keep nothing".
                    chip.el.setChecked(true);
                    StatusBar.notify('At least one object must stay kept', 'warning');
                    return;
                }
                if (_lastScope) _runTrack(_lastScope);
            });
            chipEls.push(chip);
            _children.push(chip);
        }

        // ── Mask Adjust — Grow/Shrink slider reusing distanceField.js's math ───

        const growSlider = MpiProgressBar.mount(qs('#grow-slot', el), {
            min: -MAX_R, max: MAX_R, step: 1, value: 0,
            interactive: true, handle: true, wheel: true, info: '',
        });
        _children.push(growSlider);
        const _syncGrowLabel = () => {
            qs('#grow-val', el).textContent = `${_grow > 0 ? '+' : ''}${_grow} px`;
        };
        let _raf = 0;
        growSlider.on('input', ({ value }) => {
            _grow = value;
            _syncGrowLabel();
            if (_raf) return;
            _raf = requestAnimationFrame(() => { _raf = 0; _updateCurrentTint(); });
        });
        _syncGrowLabel();

        const fillChip = MpiCheckbox.mount(qs('#fill-slot', el), {
            checked: false, label: 'Fill Holes', name: 'gif-cutout-fill-holes',
        });
        fillChip.on('change', ({ checked }) => { _fillHoles = checked; });
        _children.push(fillChip);

        const invertChip = MpiCheckbox.mount(qs('#invert-slot', el), {
            checked: false, label: 'Invert', name: 'gif-cutout-invert', variant: 'switch',
        });
        invertChip.on('change', ({ checked }) => { _invert = checked; _updateCurrentTint(); });
        _children.push(invertChip);

        // ── Cut out ──────────────────────────────────────────────────────────

        const cutoutBtn = MpiButton.mount(qs('#cutout-slot', el), {
            label: 'Cut out', icon: 'eraser', size: 'sm', variant: 'primary',
            info: 'Bake the masks into every frame’s alpha and save a new entry',
        });
        cutoutBtn.on('click', () => _runCutout());
        _children.push(cutoutBtn);

        /** Adjust and Cut out need a mask on at least one frame — tracked or brushed. */
        function _syncHasMasks() {
            const has = !!viewer.el.hasFrameMasks?.();
            qs('#adjust-section', el).hidden = !has;
            cutoutBtn.el.setDisabled?.(!has || _busy);
        }
        _syncHasMasks();

        // ── Track dispatch ───────────────────────────────────────────────────

        function _indicesString() {
            return _selected.size >= OBJECT_SLOTS ? '' : [...(_selected)].sort((a, b) => a - b).join(',');
        }

        async function _sourceVideo(frames) {
            const sig = frameSignature(frames);
            if (_videos.has(sig)) return _videos.get(sig);
            const res = await fetch('/gif-cutout/source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderPath: state.currentProject.folderPath,
                    frames: frames.map(f => ({ hash: f.hash, delay: f.delay })),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
            _videos.set(sig, data.videoPath);
            return data.videoPath;
        }

        function _setBusy(on, kind = null) {
            _busy = on;
            _runningKind = on ? kind : null;
            _mountTrackBtns();
            chipEls.forEach(c => c.el.setDisabled?.(on));
            _syncHasMasks();
        }

        /** @param {'all'|{idx:number, hash:string}} scope */
        async function _runTrack(scope) {
            if (_destroyed || _busy) return;
            const raw = _raw.trim();
            if (!raw) { StatusBar.notify('Name what to cut out first', 'warning'); return; }
            const frames = viewer.el.getFrames();
            if (!frames.length) { StatusBar.notify('No frames to track', 'warning'); return; }
            if (!state.currentProject?.folderPath) return;

            const single = scope !== 'all';
            // A single-frame scope is only valid while that frame still sits there.
            if (single && frames[scope.idx]?.hash !== scope.hash) { _lastScope = null; return; }
            const listSig = frameSignature(frames);
            _setBusy(true, single ? 'frame' : 'all');

            try {
                const videoPath = await _sourceVideo(single ? [frames[scope.idx]] : frames);
                const exec = runGifCutoutTrack({
                    videoPath,
                    textPrompt: stampDetectionCount(raw, OBJECT_SLOTS),
                    objectIndices: _indicesString(),
                });
                _trackExec = exec;
                _lastScope = scope;
                exec.onPreview = (url) => {
                    if (_destroyed || _trackExec !== exec) return;
                    previewVideo.el._setSrc(url);
                    previewWrap.hidden = false;
                };
                exec.onMasks = (urls) => {
                    if (_destroyed || _trackExec !== exec) return;
                    if (frameSignature(viewer.el.getFrames()) !== listSig) {
                        StatusBar.notify('The frames changed while tracking — track again', 'warning');
                        return;
                    }
                    previewWrap.hidden = false;
                    if (single) viewer.el.setTrackMask(scope.idx, urls[0] || null);
                    else viewer.el.setTrackMasks(urls);
                };
                exec.onError = (err) => {
                    if (_destroyed) return;
                    clientLogger.warn('MpiToolOptionsGifCutout', 'track failed', err);
                };
                exec.onDone = () => {
                    if (_destroyed) return;
                    _trackExec = null;
                    _setBusy(false);
                };
            } catch (err) {
                _setBusy(false);
                clientLogger.warn('MpiToolOptionsGifCutout', 'source encode failed', err);
                StatusBar.notify('Could not prepare the track video: ' + err.message, 'error');
            }
        }

        // ── Live current-frame tint (adjusted) ──────────────────────────────
        // Same functions `routes/gifCutout.js`'s applyMaskAlpha() runs server-side:
        // build the field once per mask URL, then every slider move is a range
        // test over it (managers/distanceField.js's own design).

        async function _loadAlpha(url) {
            if (_alphaCache.has(url)) return _alphaCache.get(url);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const n = canvas.width * canvas.height;
            const alpha = new Uint8Array(n);
            // Engine and composed masks are both opaque greyscale (white = mask),
            // the source `applyMaskAlpha()` reads server-side, so luma is coverage.
            for (let i = 0; i < n; i++) {
                alpha[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
            }
            return _remember(_alphaCache, url, { width: canvas.width, height: canvas.height, alpha });
        }

        function _fieldFor(url, entry) {
            const field = _fieldCache.get(url);
            if (field) return field;
            const { width, height, alpha } = entry;
            const rgba = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = alpha[i];
            return _remember(_fieldCache, url, signedSquaredDistanceField(rgba, width, height));
        }

        let _tintToken = 0;
        async function _updateCurrentTint() {
            if (_destroyed) return;
            const token = ++_tintToken;
            let url = null;
            let entry;
            try {
                url = await viewer.el.getFrameMaskURL(viewer.el.getFrameIndex());
                if (url) entry = await _loadAlpha(url);
            } catch (err) {
                clientLogger.warn('MpiToolOptionsGifCutout', 'mask decode failed', err);
                return;
            }
            if (_destroyed || token !== _tintToken) return;
            if (!url) { emit('mask-tint', { url: null }); return; }

            const { width, height, alpha } = entry;
            let out = alpha;
            const range = _grow ? rangeFor({ grow: _grow }) : null;
            if (range) {
                const field = _fieldFor(url, entry);
                const out32 = new Uint32Array(width * height);
                writeRange(field, out32, range.lo, range.hi);
                out = new Uint8Array(width * height);
                for (let i = 0; i < out.length; i++) out[i] = out32[i] & 0xff;
            }
            if (_invert) {
                const inverted = new Uint8Array(out.length);
                for (let i = 0; i < out.length; i++) inverted[i] = 255 - out[i];
                out = inverted;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(width, height);
            for (let i = 0; i < out.length; i++) {
                imgData.data[i * 4] = 255;
                imgData.data[i * 4 + 1] = 255;
                imgData.data[i * 4 + 2] = 255;
                imgData.data[i * 4 + 3] = out[i];
            }
            ctx.putImageData(imgData, 0, 0);
            emit('mask-tint', { url: canvas.toDataURL('image/png') });
        }

        // The Block owns the ONE persistent subscription to each viewer event for
        // the viewer's whole lifetime and forwards here — the factory's own
        // `instance.on()` has no per-listener unsubscribe, so a panel that
        // (re)subscribed on every mount would leak one listener per rail visit.
        el.onFrameChange = () => _updateCurrentTint();
        el.onMasksChange = () => {
            _syncHasMasks();
            _updateCurrentTint();
        };
        _updateCurrentTint();

        // ── Cut out ──────────────────────────────────────────────────────────

        async function _runCutout() {
            if (_destroyed || _busy || !viewer.el.hasFrameMasks?.()) return;
            const frames = viewer.el.getFrames();
            let masks;
            try {
                masks = await viewer.el.getCutMasks();
            } catch (err) {
                clientLogger.warn('MpiToolOptionsGifCutout', 'mask compose failed', err);
                StatusBar.notify('Could not prepare the masks: ' + err.message, 'error');
                return;
            }
            if (_destroyed || frameSignature(viewer.el.getFrames()) !== frameSignature(frames)) return;
            emit('apply', {
                frames: frames.map(f => ({ hash: f.hash, delay: f.delay })),
                masks,
                adjust: { grow: _grow, fillHoles: _fillHoles },
                invert: _invert,
            });
        }

        // ── Teardown ─────────────────────────────────────────────────────────

        el.destroy = () => {
            _destroyed = true;
            if (_raf) cancelAnimationFrame(_raf);
            _trackExec?.cancel?.();
            emit('mask-tint', { url: null });
            // The track buttons are re-mounted outside `_children` (_mountTrackBtns).
            trackBtns.all?.destroy?.();
            trackBtns.frame?.destroy?.();
            _children.forEach(c => c.destroy?.());
        };
    },
});
