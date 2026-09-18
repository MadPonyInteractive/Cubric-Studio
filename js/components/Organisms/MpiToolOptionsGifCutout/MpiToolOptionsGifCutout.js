/**
 * MpiToolOptionsGifCutout — Organism: the GIF cut-out tool group (MPI-771).
 *
 * Masks every frame, then cuts them into a new alpha entry. Three METHODS fill
 * the same per-frame track layer (plan Decision 15):
 *   - Remove background: BiRefNet (`gifCutoutBirefnet`), keeps the foreground.
 *   - By name: SAM3 video tracking (`gifCutoutSam3`), keeps what is named.
 *   - By colour: `utils/colourKeyMask.js` in the renderer, keys one colour out.
 * A mask is a STARTING POINT (plan Decision 14): the user fixes frames by hand
 * with the Mask Brush, a separate tool. The masks themselves live on the viewer
 * (`MpiGifViewer`, per frame position), which is how this panel and the brush
 * share them.
 *
 *   1. Mask All / Mask This Frame (Track All / Track Single Frame for SAM3):
 *      every frame, or only the current one. Either replaces TRACKS only;
 *      brush fixes survive. While one runs, the viewer spins and the status
 *      bar shows an indeterminate clock (the image Detect row's idiom).
 *   2. SAM3 only: the numbered preview (`SAM3_TrackPreview`) says which index is which
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
 *   'apply' { frames, masks, adjust, invert, settings } — Cut-out pressed;
 *     `settings` says which method made the masks (stamped on the sidecar)
 */

import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiCheckbox } from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiRadioGroup } from '../../Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { MpiColorPicker } from '../../Primitives/MpiColorPicker/MpiColorPicker.js';
import { MpiVideoSurface } from '../../Compounds/MpiVideoSurface/MpiVideoSurface.js';
import { signedSquaredDistanceField, rangeFor, writeRange } from '../../Primitives/MpiCanvas/managers/distanceField.js';
import { Events } from '../../../events.js';
import { state } from '../../../state.js';
import { getToolSettings } from '../../../data/projectModel.js';
import { stampDetectionCount } from '../../../utils/maskTextPrompt.js';
import { COLOUR_KEY_DEFAULTS, colourKeyMaskUrl, cornerColour, readImagePixels } from '../../../utils/colourKeyMask.js';
import { runGifCutoutTrack } from '../../../services/commandExecutor.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { StatusBar } from '../../../shell/statusBar.js';
import { qs } from '../../../utils/dom.js';

/** `SAM3_TrackToMask`'s `max_objects` is a fixed graph literal (docs/masking-sam3-gif.md). */
const OBJECT_SLOTS = 4;
const MAX_R = 50;
/** Decoded masks kept for the tint; composed masks are data URLs, so keys can be big. */
const DECODE_CACHE = 8;
/**
 * Every setting survives a trip to the Mask Brush and back (Decision 14: set once).
 * The key colour is NOT saved: it belongs to one GIF's background, so each visit
 * starts from the current frame's corner pixel.
 */
const DEFAULTS = {
    method: 'birefnet', textPrompt: '', grow: 0, fillHoles: false, invert: false,
    tolerance: COLOUR_KEY_DEFAULTS.tolerance, edgesOnly: COLOUR_KEY_DEFAULTS.edgesOnly,
};

const METHODS = {
    birefnet: {
        label: 'Background', icon: 'image', op: 'gifCutoutBirefnet', progress: 'Removing background',
        info: 'Remove background: keeps the foreground, no prompt needed (BiRefNet)',
        hint: 'Keeps the <b>foreground</b> and removes the background.',
        tintNote: 'The tinted area is what stays.',
    },
    sam3: {
        label: 'By name', icon: 'text', op: 'gifCutoutSam3', progress: 'Tracking',
        info: 'By name: keeps the objects you name (SAM3)',
        hint: 'Name what to <b>keep</b>: <b>mascot</b>, <b>logo</b>. Tick <b>Invert</b> to remove it instead.',
        tintNote: 'The tinted area is what stays.',
    },
    colour: {
        label: 'By colour', icon: 'mask_fill_holes_stroke', op: null, progress: 'Keying colour',
        info: 'By colour: removes one colour. No GPU',
        hint: 'Removes one <b>colour</b>. <b>Pick</b> it from the screen.',
        // This method is phrased as a removal, so it tints the removal — the other
        // two tint what they keep. Stated on screen either way, because reading the
        // tint backwards is what made the three feel like they flipped (Fabio, 2026-09-18).
        tintNote: 'The tinted area is what goes.',
    },
};
const HINT_TAIL = ' A mask is a starting point: step through the frames and fix any of them with the <b>Mask Brush</b>.';
/** A colour setting change re-keys the last scope once the user pauses. */
const REKEY_MS = 250;

/** A frame list's identity: its hashes in order (masks are per position). */
const frameSignature = (frames) => frames.map(f => f.hash).join('|');

export const MpiToolOptionsGifCutout = ComponentFactory.create({
    name: 'MpiToolOptionsGifCutout',
    css: ['js/components/Organisms/MpiToolOptionsGifCutout/MpiToolOptionsGifCutout.css'],

    template: () => `
        <div class="mpi-tool-options-gif-cutout">
            <div id="method-slot"></div>
            <p class="mpi-tool-options-gif-cutout__info" id="hint"></p>
            <div class="mpi-tool-options-gif-cutout__prompt" id="prompt-slot"></div>
            <div class="mpi-tool-options-gif-cutout__section" id="colour-section" hidden>
                <div class="mpi-tool-options-gif-cutout__row mpi-tool-options-gif-cutout__row--centre">
                    <div id="key-colour-slot"></div>
                    <div id="pick-slot"></div>
                </div>
                <div class="mpi-tool-options-gif-cutout__slider-row">
                    <div class="mpi-tool-options-gif-cutout__label">
                        <span>Tolerance</span>
                        <span id="tolerance-val"></span>
                    </div>
                    <div id="tolerance-slot"></div>
                </div>
                <div class="mpi-tool-options-gif-cutout__row" id="edges-slot"></div>
            </div>
            <div class="mpi-tool-options-gif-cutout__row" id="track-slot">
                <div id="track-all-slot"></div>
                <div id="track-frame-slot"></div>
            </div>
            <div class="mpi-tool-options-gif-cutout__row" id="clear-slot">
                <div id="clear-frame-slot"></div>
                <div id="clear-all-slot"></div>
            </div>
            <p class="mpi-tool-options-gif-cutout__info" id="tint-note"></p>

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

        let _method = METHODS[settings.method] ? settings.method : DEFAULTS.method;
        let _tolerance = Math.max(0, Math.min(100, Math.round(Number(settings.tolerance) || 0)));
        let _edgesOnly = settings.edgesOnly === true;
        /** Key colour (`#rrggbb`); null until the current frame's corner is read. */
        let _keyColour = null;
        /** Silences the picker's own 'change' while this panel sets it. */
        let _quietPicker = false;
        let _rekeyTimer = 0;
        /** A By colour run in flight checks this between frames (its Stop). */
        let _keyRun = null;

        let _busy = false;
        let _trackExec = null;
        /** What the chips re-dispatch: 'all', or the frame { idx, hash } last tracked alone. */
        let _lastScope = null;
        /** Temp source videos by frame signature — a chip re-dispatch reuses one. */
        const _videos = new Map();
        let _grow = Math.max(-MAX_R, Math.min(MAX_R, Math.round(Number(settings.grow) || 0)));
        let _fillHoles = settings.fillHoles === true;
        let _invert = settings.invert === true;
        let _destroyed = false;
        const _save = (key, value) => Events.emit('settings:tool:update', { toolKey: 'gifCutout', key, value });

        /** Raw decoded alpha, then its distance field, per mask URL (small LRU). */
        const _alphaCache = new Map(); // url -> { width, height, alpha: Uint8Array }
        const _fieldCache = new Map(); // url -> Float32Array
        const _remember = (map, key, value) => {
            map.set(key, value);
            if (map.size > DECODE_CACHE) map.delete(map.keys().next().value);
            return value;
        };

        // ── Method ──────────────────────────────────────────────────────────

        const methodRadio = MpiRadioGroup.mount(qs('#method-slot', el), {
            name: 'gif-cutout-method', size: 'sm', value: _method,
            options: Object.entries(METHODS).map(([value, m]) => ({ value, label: m.label, icon: m.icon, info: m.info })),
        });
        methodRadio.on('select', ({ value }) => {
            if (!METHODS[value] || value === _method || _busy) return;
            _method = value;
            _lastScope = null;
            _save('method', value);
            _syncMethod();
            // The tint's side depends on the method, so an existing mask re-tints.
            _updateCurrentTint();
        });
        _children.push(methodRadio);

        // ── By colour ───────────────────────────────────────────────────────

        // Starts at the picker's own default; `_defaultKeyColour()` sets the real one.
        const keyPicker = MpiColorPicker.mount(qs('#key-colour-slot', el), { info: 'The colour to remove. Applies on Mask All / Mask This Frame' });
        keyPicker.on('change', ({ hex }) => {
            if (_quietPicker) return;
            _keyColour = hex;
            _scheduleRekey();
        });
        _children.push(keyPicker);

        const _setKeyColour = (hex) => {
            _keyColour = hex;
            _quietPicker = true;
            keyPicker.el.setHex(hex);
            _quietPicker = false;
        };

        // Chromium's native eyedropper: picks any pixel on screen.
        if ('EyeDropper' in window) {
            const pickBtn = MpiButton.mount(qs('#pick-slot', el), {
                label: 'Pick', size: 'sm', variant: 'secondary', info: 'Pick the colour to remove from the screen',
            });
            pickBtn.on('click', async () => {
                try {
                    const { sRGBHex } = await new window.EyeDropper().open();
                    if (_destroyed || !sRGBHex) return;
                    _setKeyColour(sRGBHex);
                    _scheduleRekey();
                } catch { /* the user pressed Escape */ }
            });
            _children.push(pickBtn);
        }

        const toleranceSlider = MpiProgressBar.mount(qs('#tolerance-slot', el), {
            min: 0, max: 100, step: 1, value: _tolerance,
            interactive: true, handle: true, wheel: true, info: 'How far a colour may be from the key and still be removed. Applies on Mask All / Mask This Frame',
        });
        const _syncToleranceLabel = () => { qs('#tolerance-val', el).textContent = String(_tolerance); };
        toleranceSlider.on('input', ({ value }) => {
            _tolerance = value;
            _syncToleranceLabel();
            _save('tolerance', value);
            _scheduleRekey();
        });
        _syncToleranceLabel();
        _children.push(toleranceSlider);

        const edgesChip = MpiCheckbox.mount(qs('#edges-slot', el), {
            checked: _edgesOnly, label: 'Only touching the edges', name: 'gif-cutout-edges-only', variant: 'switch',
            info: 'Keep same-coloured areas the subject encloses',
        });
        edgesChip.on('change', ({ checked }) => { _edgesOnly = checked; _save('edgesOnly', checked); _scheduleRekey(); });
        _children.push(edgesChip);

        /** A By colour setting changed: re-key what was keyed last, once the user pauses. */
        function _scheduleRekey() {
            if (_method !== 'colour') return;
            clearTimeout(_rekeyTimer);
            // Nothing keyed yet: there is no mask to re-key, so the colour and the
            // slider do nothing at all — and silence reads as a broken slider
            // (Fabio, 2026-09-18, after picking a colour and dragging Tolerance to 81
            // on an opaque GIF with no run behind it). Say what it is waiting for.
            if (!_lastScope) {
                _rekeyTimer = setTimeout(() => {
                    if (!_busy && !_lastScope && !_destroyed) {
                        StatusBar.notify('Press Mask All or Mask This Frame to apply this colour', 'info');
                    }
                }, REKEY_MS);
                return;
            }
            _rekeyTimer = setTimeout(() => { if (!_busy) _runTrack(_lastScope); }, REKEY_MS);
        }

        /**
         * Default key: the current frame's top-left pixel — unless that pixel is
         * TRANSPARENT (an already-cut clip), where its RGB is whatever the old mask
         * hid and keying it removes a colour nobody can see. Then there is no
         * default and the user picks one.
         * @returns {Promise<string|null>}
         */
        async function _defaultKeyColour() {
            if (_keyColour) return _keyColour;
            const f = viewer.el.getFrames()[viewer.el.getFrameIndex()];
            if (!f) return null;
            const { data } = await readImagePixels(f.url);
            const hex = cornerColour(data);
            if (hex && !_keyColour) _setKeyColour(hex);
            return _keyColour;
        }

        // ── Name ────────────────────────────────────────────────────────────

        const promptInput = MpiInput.mount(qs('#prompt-slot', el), {
            type: 'text', value: _raw, placeholder: 'mascot, logo',
            info: 'What to cut out. Separate several with commas.',
        });
        promptInput.on('input', ({ value }) => {
            _raw = value;
            _save('textPrompt', value);
        });
        _children.push(promptInput);

        // ── Track All / Track Single Frame — the running one turns into Stop ──

        const trackBtns = { all: null, frame: null };
        const TRACK_BTN = {
            all:   { slot: '#track-all-slot',   sam3: 'Track All',          other: 'Mask All',        icon: 'search', info: 'Mask every frame' },
            frame: { slot: '#track-frame-slot', sam3: 'Track Single Frame', other: 'Mask This Frame', icon: 'search', info: 'Mask this frame only; the other frames keep their masks' },
        };
        let _runningKind = null;
        function _mountTrackBtns() {
            for (const kind of ['all', 'frame']) {
                const def = TRACK_BTN[kind];
                trackBtns[kind]?.destroy?.();
                const stop = _busy && _runningKind === kind;
                trackBtns[kind] = MpiButton.mount(qs(def.slot, el), stop
                    ? { label: 'Stop', icon: 'stop', size: 'sm', variant: 'danger', info: 'Stop masking' }
                    : { label: _method === 'sam3' ? def.sam3 : def.other, icon: def.icon, size: 'sm', variant: kind === 'all' ? 'primary' : 'secondary', info: def.info });
                if (_busy && !stop) trackBtns[kind].el.setDisabled?.(true);
                trackBtns[kind].on('click', () => {
                    if (stop) { _trackExec?.cancel?.(); if (_keyRun) _keyRun.cancelled = true; return; }
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
            min: -MAX_R, max: MAX_R, step: 1, value: _grow,
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
            _save('grow', value);
            if (_raf) return;
            _raf = requestAnimationFrame(() => { _raf = 0; _updateCurrentTint(); });
        });
        _syncGrowLabel();

        const fillChip = MpiCheckbox.mount(qs('#fill-slot', el), {
            checked: _fillHoles, label: 'Fill Holes', name: 'gif-cutout-fill-holes',
        });
        fillChip.on('change', ({ checked }) => { _fillHoles = checked; _save('fillHoles', checked); });
        _children.push(fillChip);

        const invertChip = MpiCheckbox.mount(qs('#invert-slot', el), {
            checked: _invert, label: 'Invert', name: 'gif-cutout-invert', variant: 'switch',
        });
        invertChip.on('change', ({ checked }) => { _invert = checked; _save('invert', checked); _updateCurrentTint(); });
        _children.push(invertChip);

        // ── Cut out ──────────────────────────────────────────────────────────

        const cutoutBtn = MpiButton.mount(qs('#cutout-slot', el), {
            label: 'Cut out', icon: 'eraser', size: 'sm', variant: 'primary',
            info: 'Bake the masks into every frame’s alpha and save a new entry',
        });
        cutoutBtn.on('click', () => _runCutout());
        _children.push(cutoutBtn);

        // ── Clear ────────────────────────────────────────────────────────────
        // Clearing with the Mask Brush only paints a full-frame SUBTRACT, which
        // survives every re-mask by design — so without a real clear, a frame the
        // user wiped could never be masked again (Fabio, 2026-09-18).

        const clearBtns = {
            frame: MpiButton.mount(qs('#clear-frame-slot', el), {
                label: 'Clear This Frame', icon: 'eraser', size: 'sm', variant: 'secondary',
                info: 'Throw this frame\'s mask away, brush fixes included',
            }),
            all: MpiButton.mount(qs('#clear-all-slot', el), {
                label: 'Clear All', icon: 'eraser', size: 'sm', variant: 'secondary',
                info: 'Throw every frame\'s mask away, brush fixes included',
            }),
        };
        clearBtns.frame.on('click', () => {
            if (_busy) return;
            viewer.el.clearFrameMasks(viewer.el.getFrameIndex());
            _lastScope = null;
            _updateCurrentTint();
        });
        clearBtns.all.on('click', () => {
            if (_busy) return;
            viewer.el.clearFrameMasks('all');
            _lastScope = null;
            _updateCurrentTint();
        });
        _children.push(clearBtns.frame, clearBtns.all);

        /** Show the controls of the current method only. */
        function _syncMethod() {
            qs('#hint', el).innerHTML = METHODS[_method].hint + HINT_TAIL;
            qs('#prompt-slot', el).hidden = _method !== 'sam3';
            qs('#colour-section', el).hidden = _method !== 'colour';
            qs('#tint-note', el).textContent = METHODS[_method].tintNote;
            if (_method !== 'sam3') previewWrap.hidden = true;
            if (_method === 'colour') {
                _defaultKeyColour().catch(err => clientLogger.warn('MpiToolOptionsGifCutout', 'corner colour read failed', err));
            }
            _mountTrackBtns();
        }
        _syncMethod();

        /** Adjust and Cut out need a mask on at least one frame — tracked or brushed. */
        function _syncHasMasks() {
            const has = !!viewer.el.hasFrameMasks?.();
            qs('#adjust-section', el).hidden = !has;
            qs('#clear-slot', el).hidden = !has;
            cutoutBtn.el.setDisabled?.(!has || _busy);
            clearBtns.frame.el.setDisabled?.(!has || _busy);
            clearBtns.all.el.setDisabled?.(!has || _busy);
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

        /**
         * A run shows on the viewer (spinner) and on the status bar (indeterminate
         * clock), driven directly like the image Detect row (docs/masking-tools.md
         * § Detect is a RUN). `outcome` ends it: 'done' completes the bar, anything
         * else cancels it.
         */
        function _setBusy(on, kind = null, outcome = 'cancel') {
            if (on === _busy) return;
            _busy = on;
            _runningKind = on ? kind : null;
            if (on) {
                StatusBar.progress.prepare(METHODS[_method].progress);
                StatusBar.progress.setIndeterminate(true);
                StatusBar.progress.startClock();
            } else if (outcome === 'done') {
                StatusBar.progress.complete();
            } else {
                StatusBar.progress.cancel();
            }
            viewer.el.setGenerating?.(on);
            methodRadio.el.classList.toggle('mpi-tool-options-gif-cutout__locked', on);
            _mountTrackBtns();
            chipEls.forEach(c => c.el.setDisabled?.(on));
            _syncHasMasks();
        }

        /** By colour: key each frame in the renderer, no engine. @returns {Promise<string[]|null>} null = stopped */
        async function _keyFrames(targets) {
            const run = { cancelled: false };
            _keyRun = run;
            try {
                const colour = await _defaultKeyColour();
                if (!colour) {
                    StatusBar.notify('Pick the colour to remove first', 'warning');
                    return null;
                }
                const urls = [];
                for (const f of targets) {
                    if (run.cancelled || _destroyed) return null;
                    const { url } = await colourKeyMaskUrl(f.url, { colour, tolerance: _tolerance, edgesOnly: _edgesOnly });
                    urls.push(url);
                    // Yield so the spinner paints and Stop stays clickable.
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                return urls;
            } finally {
                if (_keyRun === run) _keyRun = null;
            }
        }

        /** @param {'all'|{idx:number, hash:string}} scope */
        async function _runTrack(scope) {
            if (_destroyed || _busy) return;
            const raw = _raw.trim();
            if (_method === 'sam3' && !raw) { StatusBar.notify('Name what to keep first', 'warning'); return; }
            const frames = viewer.el.getFrames();
            if (!frames.length) { StatusBar.notify('No frames to track', 'warning'); return; }
            if (!state.currentProject?.folderPath) return;

            const single = scope !== 'all';
            // A single-frame scope follows its frame through a staged reorder.
            if (single && frames[scope.idx]?.hash !== scope.hash) {
                const idx = frames.findIndex(f => f.hash === scope.hash);
                if (idx === -1) { _lastScope = null; return; }
                scope = { idx, hash: scope.hash };
            }
            const listSig = frameSignature(frames);
            const method = _method;
            const targets = single ? [frames[scope.idx]] : frames;
            _lastScope = scope;
            _setBusy(true, single ? 'frame' : 'all');

            const landMasks = (urls) => {
                if (frameSignature(viewer.el.getFrames()) !== listSig) {
                    StatusBar.notify('The frames changed while masking — mask again', 'warning');
                    return false;
                }
                if (single) viewer.el.setTrackMask(scope.idx, urls[0] || null);
                else viewer.el.setTrackMasks(urls);
                return true;
            };

            if (method === 'colour') {
                let landed = false;
                try {
                    const urls = await _keyFrames(targets);
                    if (urls && !_destroyed) landed = landMasks(urls);
                } catch (err) {
                    clientLogger.warn('MpiToolOptionsGifCutout', 'colour key failed', err);
                    StatusBar.notify('Could not key the frames: ' + err.message, 'error');
                } finally {
                    if (!_destroyed) _setBusy(false, null, landed ? 'done' : 'cancel');
                }
                return;
            }

            try {
                const videoPath = await _sourceVideo(targets);
                const exec = runGifCutoutTrack({
                    op: METHODS[method].op,
                    videoPath,
                    textPrompt: stampDetectionCount(raw, OBJECT_SLOTS),
                    objectIndices: _indicesString(),
                });
                let landed = false;
                _trackExec = exec;
                exec.onPreview = (url) => {
                    if (_destroyed || _trackExec !== exec || method !== 'sam3') return;
                    previewVideo.el._setSrc(url);
                    previewWrap.hidden = false;
                };
                exec.onMasks = (urls) => {
                    if (_destroyed || _trackExec !== exec) return;
                    if (method === 'sam3' && _method === 'sam3') previewWrap.hidden = false;
                    landed = landMasks(urls) || landed;
                };
                exec.onError = (err) => {
                    if (_destroyed) return;
                    clientLogger.warn('MpiToolOptionsGifCutout', 'mask run failed', err);
                };
                exec.onDone = () => {
                    if (_destroyed) return;
                    _trackExec = null;
                    _setBusy(false, null, landed ? 'done' : 'cancel');
                };
            } catch (err) {
                _setBusy(false);
                clientLogger.warn('MpiToolOptionsGifCutout', 'source encode failed', err);
                StatusBar.notify('Could not prepare the mask video: ' + err.message, 'error');
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
            // The mask is always "what stays" (`applyMaskAlpha` writes it into the
            // alpha channel), so `Invert` flips it here exactly as the server does.
            // By colour then tints the OTHER side: that method is phrased as a
            // removal, and on an already-cut clip the keep side is the whole subject
            // at every tolerance, so tinting it showed nothing changing (Fabio,
            // 2026-09-18). `#tint-note` says which side is tinted either way.
            const flip = (_invert !== (_method === 'colour'));
            if (flip) {
                const flipped = new Uint8Array(out.length);
                for (let i = 0; i < out.length; i++) flipped[i] = 255 - out[i];
                out = flipped;
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
                settings: _method === 'sam3' ? { method: 'sam3', prompt: _raw.trim(), objects: [..._selected].sort((a, b) => a - b) }
                    : _method === 'colour' ? { method: 'colour', colour: _keyColour, tolerance: _tolerance, edgesOnly: _edgesOnly }
                    : { method: _method },
            });
        }

        // ── Teardown ─────────────────────────────────────────────────────────

        el.destroy = () => {
            _destroyed = true;
            if (_raf) cancelAnimationFrame(_raf);
            clearTimeout(_rekeyTimer);
            _trackExec?.cancel?.();
            if (_keyRun) _keyRun.cancelled = true;
            if (_busy) { StatusBar.progress.cancel(); viewer.el.setGenerating?.(false); }
            emit('mask-tint', { url: null });
            // The track buttons are re-mounted outside `_children` (_mountTrackBtns).
            trackBtns.all?.destroy?.();
            trackBtns.frame?.destroy?.();
            _children.forEach(c => c.destroy?.());
        };
    },
});
