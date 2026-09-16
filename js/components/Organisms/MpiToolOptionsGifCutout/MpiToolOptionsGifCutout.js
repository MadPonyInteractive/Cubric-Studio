/**
 * MpiToolOptionsGifCutout — Organism: the GIF cut-out tool group (MPI-771 UI half).
 *
 * SAM3 video tracking by name, across every frame of the CURRENT GIF entry, into a
 * new alpha-cut entry. The engine gives back one MERGED mask per frame — no
 * per-object output (`docs/masking-sam3-gif.md`) — so the flow reads:
 *
 *   1. Track: name the object, run once with every object kept (`objectIndices: ''`)
 *      and read `SAM3_TrackPreview`'s numbered debug video to see which index is
 *      which object.
 *   2. Toggle the fixed 4 object chips (`max_objects` is a graph literal) to keep
 *      or drop — each toggle RE-dispatches, which is cheap: `SAM3_VideoTrack` is
 *      cached by ComfyUI, so only the downstream mask node re-executes.
 *   3. Mask Adjust (Grow/Shrink) + Fill Holes + Invert — set ONCE for every frame;
 *      the CURRENT frame gets a live tint preview, built with the exact same
 *      `distanceField.js` functions `routes/gifCutout.js` runs server-side on
 *      every frame at Cut-out time (grow/shrink only; Fill Holes has no live
 *      preview — it is cheap and deterministic, so a preview would not change
 *      the decision to use it).
 *   4. Cut out -> `POST /gif-cutout/apply` (via the Block, which owns appending
 *      the result into the open group's history — same shape as the frame
 *      strip's own Apply, `MpiGroupHistoryBlock._handleGifStripSave`).
 *
 * This panel does the SAM3 dispatch itself (`runGifCutoutTrack`, beside
 * `runAutoMask`) — it only needs `state.currentProject.folderPath` and the
 * viewer's own frame list, no Block-internal state. It does NOT know how to
 * commit a new history entry, so Cut-out only EMITS; the Block appends it
 * (same division as every other tool's 'apply').
 *
 * Tint preview: emits 'mask-tint' (current-frame, ADJUSTED) for the Block to
 * hand to `viewer.el.setMaskTint()`, and 'mask-overlay' (every frame, RAW) for
 * `frameStrip.el.setMaskOverlay()` — raw is enough there, its only job is
 * letting a scrub reveal flicker between frames, not previewing the cut.
 *
 * Props:
 * @param {object} viewer - MpiGifViewer instance
 *
 * Emits:
 *   'mask-tint'    { url: string|null }   — current-frame adjusted preview
 *   'mask-overlay' { masks: string[]|null } — every frame's raw tracked mask
 *   'apply' { frames, masks, adjust, invert } — Cut-out pressed; Block posts
 *            /gif-cutout/apply and appends the result to history.
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
const DEFAULTS = { textPrompt: '', textCount: 1 };

export const MpiToolOptionsGifCutout = ComponentFactory.create({
    name: 'MpiToolOptionsGifCutout',
    css: ['js/components/Organisms/MpiToolOptionsGifCutout/MpiToolOptionsGifCutout.css'],

    template: () => `
        <div class="mpi-tool-options-gif-cutout">
            <p class="mpi-tool-options-gif-cutout__info">
                Name what to cut out — <b>mascot</b>, <b>logo</b>. Track finds it across
                every frame; read the numbered preview below, then keep or drop objects.
            </p>
            <div class="mpi-tool-options-gif-cutout__row">
                <div class="mpi-tool-options-gif-cutout__prompt" id="prompt-slot"></div>
                <div class="mpi-tool-options-gif-cutout__count"  id="count-slot"></div>
            </div>
            <div id="track-slot"></div>

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
        const _unsubs = [];

        const settings = { ...DEFAULTS, ...getToolSettings(state.currentProject || {}, 'gifCutout', DEFAULTS) };
        let _raw   = typeof settings.textPrompt === 'string' ? settings.textPrompt : '';
        let _count = Math.max(1, Math.round(Number(settings.textCount) || 1));

        /** Kept object indices (default: every slot — matches the first Track's
         *  empty `objectIndices`, "keep everything"). */
        const _selected = new Set(Array.from({ length: OBJECT_SLOTS }, (_, i) => i));

        let _busy = false;
        let _trackExec = null;
        /** Cached temp-video encode (E7) — reused across a chip re-dispatch, which
         *  only changes the downstream mask node (docs/masking-sam3-gif.md). */
        let _videoPath = null;
        let _videoSignature = '';
        /** Per-frame RAW mask URLs from the last successful Track, in frame order —
         *  paired 1:1 with `_videoSignature`'s frame list. */
        let _masks = null;
        let _grow = 0;
        let _fillHoles = false;
        let _invert = false;
        let _destroyed = false;

        /** Raw (unadjusted) decoded alpha per mask URL — decode once, reuse across
         *  every slider tick and every re-visit of the same frame while scrubbing. */
        const _alphaCache = new Map(); // url -> { width, height, alpha: Uint8Array }
        /** Distance field per mask URL, built lazily from the cached alpha — the
         *  SAME "build once, range-test on every slider move" split
         *  MpiToolOptionsMaskAdjust uses, just re-keyed by mask URL instead of by
         *  tool-entry (a GIF has many frames, each with its own field). */
        const _fieldCache = new Map(); // url -> Float32Array

        // ── Name + count (mirrors MpiToolOptionsMaskText) ──────────────────────

        const promptInput = MpiInput.mount(qs('#prompt-slot', el), {
            type: 'text', value: _raw, placeholder: 'mascot, logo',
            info: 'What to cut out. Separate several with commas.',
        });
        promptInput.on('input', ({ value }) => {
            _raw = value;
            Events.emit('settings:tool:update', { toolKey: 'gifCutout', key: 'textPrompt', value });
        });
        _children.push(promptInput);

        const countInput = MpiInput.mount(qs('#count-slot', el), {
            type: 'number', value: _count, min: 1, max: 20, step: 1, size: 'sm',
            info: 'How many of them to find',
        });
        countInput.on('change', ({ value }) => {
            _count = value;
            Events.emit('settings:tool:update', { toolKey: 'gifCutout', key: 'textCount', value });
        });
        _children.push(countInput);

        // ── Track / Stop — one button re-mounted, MpiMaskDetectRow's precedent
        // (a text-mode button here, so its own click handler drives busy state
        // instead of the toggleable icon-button path) ─────────────────────────

        const trackSlot = qs('#track-slot', el);
        let trackBtn = null;
        function _mountTrackBtn() {
            trackBtn?.destroy?.();
            trackBtn = MpiButton.mount(trackSlot, _busy
                ? { label: 'Stop', icon: 'stop', size: 'sm', variant: 'danger', info: 'Stop tracking' }
                : { label: 'Track', icon: 'search', size: 'sm', variant: 'primary', info: 'Track the named object across every frame' });
            trackBtn.on('click', () => {
                if (_busy) { _trackExec?.cancel?.(); return; }
                _runTrack();
            });
        }
        _mountTrackBtn();

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
                if (_masks) _runTrack({ reencode: false });
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
            info: 'Bake the mask into every frame’s alpha and save a new entry',
        });
        cutoutBtn.on('click', () => _runCutout());
        _children.push(cutoutBtn);
        cutoutBtn.el.setDisabled?.(true);

        // ── Track dispatch ───────────────────────────────────────────────────

        function _frameSignature(frames) {
            return frames.map(f => f.hash).join('|');
        }

        function _indicesString() {
            return _selected.size >= OBJECT_SLOTS ? '' : [...(_selected)].sort((a, b) => a - b).join(',');
        }

        async function _encodeSource(frames) {
            const project = state.currentProject;
            const res = await fetch('/gif-cutout/source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderPath: project.folderPath,
                    frames: frames.map(f => ({ hash: f.hash, delay: f.delay })),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
            return data.videoPath;
        }

        async function _runTrack({ reencode } = {}) {
            if (_destroyed || _busy) return;
            const raw = _raw.trim();
            if (!raw) { StatusBar.notify('Name what to cut out first', 'warning'); return; }
            const frames = viewer.el.getFrames();
            if (!frames.length) { StatusBar.notify('No frames to track', 'warning'); return; }
            const project = state.currentProject;
            if (!project?.folderPath) return;

            const sig = _frameSignature(frames);
            _busy = true;
            _mountTrackBtn();
            chipEls.forEach(c => c.el.setDisabled?.(true));

            try {
                if (reencode !== false || sig !== _videoSignature) {
                    _videoPath = await _encodeSource(frames);
                    _videoSignature = sig;
                    _masks = null;
                    emit('mask-overlay', { masks: null });
                }

                const stamped = stampDetectionCount(raw, _count);
                const exec = runGifCutoutTrack({
                    videoPath: _videoPath,
                    textPrompt: stamped,
                    objectIndices: _indicesString(),
                });
                _trackExec = exec;
                exec.onPreview = (url) => {
                    if (_destroyed || _trackExec !== exec) return;
                    previewVideo.el._setSrc(url);
                    previewWrap.hidden = false;
                };
                exec.onMasks = (urls) => {
                    if (_destroyed || _trackExec !== exec) return;
                    _masks = urls;
                    previewWrap.hidden = false;
                    qs('#adjust-section', el).hidden = false;
                    cutoutBtn.el.setDisabled?.(false);
                    emit('mask-overlay', { masks: _masks });
                    _updateCurrentTint();
                };
                exec.onError = (err) => {
                    if (_destroyed) return;
                    clientLogger.warn('MpiToolOptionsGifCutout', 'track failed', err);
                };
                exec.onDone = () => {
                    if (_destroyed) return;
                    _busy = false;
                    _trackExec = null;
                    _mountTrackBtn();
                    chipEls.forEach(c => c.el.setDisabled?.(false));
                };
            } catch (err) {
                _busy = false;
                _mountTrackBtn();
                chipEls.forEach(c => c.el.setDisabled?.(false));
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
            // The mask arrives as a plain greyscale-as-RGB PreviewImage (full alpha,
            // white = mask) — same source `applyMaskAlpha()` reads server-side, so
            // luma stands in for coverage here the way its own greyscale() pass does.
            for (let i = 0; i < n; i++) {
                alpha[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
            }
            const entry = { width: canvas.width, height: canvas.height, alpha };
            _alphaCache.set(url, entry);
            return entry;
        }

        function _fieldFor(url, entry) {
            let field = _fieldCache.get(url);
            if (field) return field;
            const { width, height, alpha } = entry;
            const rgba = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = alpha[i];
            field = signedSquaredDistanceField(rgba, width, height);
            _fieldCache.set(url, field);
            return field;
        }

        let _tintToken = 0;
        async function _updateCurrentTint() {
            if (_destroyed) return;
            const token = ++_tintToken;
            if (!_masks) { emit('mask-tint', { url: null }); return; }
            const idx = viewer.el.getFrameIndex();
            const url = _masks[idx];
            if (!url) { emit('mask-tint', { url: null }); return; }

            let entry;
            try {
                entry = await _loadAlpha(url);
            } catch (err) {
                clientLogger.warn('MpiToolOptionsGifCutout', 'mask decode failed', err);
                return;
            }
            if (_destroyed || token !== _tintToken) return;

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

        // The Block owns the ONE persistent `viewer.on('frame-change', ...)`
        // subscription for this viewer's whole lifetime (`MpiGroupHistoryBlock`)
        // and forwards into whichever tool panel is mounted — the factory's own
        // `instance.on()` has no per-listener unsubscribe (only `destroy()`
        // clears it), so a panel that (re)subscribed directly here on every
        // mount would leak one listener per tool-rail visit for as long as the
        // viewer itself lives.
        el.onFrameChange = () => _updateCurrentTint();

        // ── Cut out ──────────────────────────────────────────────────────────

        function _runCutout() {
            if (_destroyed || _busy || !_masks) return;
            const frames = viewer.el.getFrames();
            if (_frameSignature(frames) !== _videoSignature) {
                StatusBar.notify('The frame list changed — run Track again first', 'warning');
                return;
            }
            emit('apply', {
                frames: frames.map(f => ({ hash: f.hash, delay: f.delay })),
                masks: _masks.slice(),
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
            emit('mask-overlay', { masks: null });
            // trackBtn is re-mounted outside `_children` (its own var, per
            // `_mountTrackBtn`); cutoutBtn is destroyed via `_children` below.
            trackBtn?.destroy?.();
            _unsubs.forEach(fn => fn?.());
            _children.forEach(c => c.destroy?.());
        };
    },
});
