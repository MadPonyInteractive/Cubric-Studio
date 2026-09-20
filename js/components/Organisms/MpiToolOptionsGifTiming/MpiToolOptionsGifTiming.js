/**
 * MpiToolOptionsGifTiming — Organism: the GIF output tool (MPI-772, MPI-836).
 *
 * ONE tool now. Apply saves a NEW GIF entry through `POST /gif/entry` (the Block
 * owns the call): frame rate, loop count and the build settings, over the frames
 * between the control bar's trim handles.  The math lives in `gifTiming.js`.
 *
 * It had three siblings until MPI-836 — Trim, Speed and Loop count — and Trim was
 * a panel whose only content was a note about the control bar (Fabio, 2026-09-20).
 * Meanwhile no GIF operation read those handles at all: setting a range and opening
 * this panel rebuilt the whole GIF. The trim bar is the trim now, every operation
 * keeps its range (`_opFrames` in the Block), and rate + loop sit here, exactly
 * where the video workspace's GIF Maker has always had them.
 *
 * Frame rate is BLANK until the user types one: an entry with mixed delays has no
 * single rate, and seeding the field would silently retime the GIF on an Apply
 * about colours. Blank = keep every frame's own delay. The placeholder names the
 * rate the frames already play at when they share one.
 *
 * The build settings persist to project.json `toolSettings.gifTiming`; RATE and
 * LOOP never do — they belong to the GIF on screen, not to the tool, so loop is
 * read off its entry on mount.
 *
 * Props:
 * @param {object} viewer - MpiGifViewer instance (frame count, frames, loop)
 * @param {object} currentItem - the GIF entry being edited (`gif.loop` seeds the field)
 * @param {'gifOutput'} mode
 *
 * Block hooks on el:
 *   onRangeChange({ in, out }) — the control bar's trim range (frame indices)
 *   onFramesChange()           — the frame list moved under the panel (a staged
 *                                strip edit, or an Apply landing): the note and
 *                                the rate placeholder are read off it
 *   setEncoder(fn)             — `gifOutput` only (MPI-771 audit): fn(settings) →
 *                                Promise<{ url, byteSize }> for the preview pane.
 *                                Injected by the Block, the division
 *                                `MpiToolOptionsGif` already uses — the panel owns
 *                                the settings, the Block owns the request and the
 *                                frame list.
 *
 * Emits:
 *   'apply' { tool: 'output', values } — `values.fps` is null when the field is blank
 *
 * `reverse` is still a `timingEdit()` tool — the GIF stage's context menu emits
 * it straight to the Block (MPI-771 audit); this panel has never had that mode.
 */

import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiCheckbox } from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiColorPicker } from '../../Primitives/MpiColorPicker/MpiColorPicker.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { getToolSettings } from '../../../data/projectModel.js';
import { qs } from '../../../utils/dom.js';
import {
    MIN_FPS, MAX_FPS, MAX_LOOP, MIN_EDGE, MAX_EDGE, MIN_COLOURS, MAX_COLOURS,
    OUTPUT_DEFAULTS, clampNumber, fpsToDelay, delayToFps, rangeBounds, uniformFps,
} from './gifTiming.js';

const DESC = 'Saves the frames between the trim handles as a new GIF. The frames stay full colour.';

/** Only the build settings persist; rate and loop come from the GIF on screen. */
const DEFAULTS = Object.freeze({ ...OUTPUT_DEFAULTS });

/** Byte badge on the preview — same rounding as MpiToolOptionsGif's. */
function formatBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KiB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}

function coerceSettings(raw) {
    return {
        maxEdge: Math.round(clampNumber(raw.maxEdge, DEFAULTS.maxEdge, MIN_EDGE, MAX_EDGE)),
        colours: Math.round(clampNumber(raw.colours, DEFAULTS.colours, MIN_COLOURS, MAX_COLOURS)),
        transparent: !!raw.transparent,
        edgeColour: typeof raw.edgeColour === 'string' ? raw.edgeColour : DEFAULTS.edgeColour,
    };
}

export const MpiToolOptionsGifTiming = ComponentFactory.create({
    name: 'MpiToolOptionsGifTiming',
    css: ['js/components/Organisms/MpiToolOptionsGifTiming/MpiToolOptionsGifTiming.css'],

    template: () => `
        <div class="mpi-tool-options-gif-timing">
            <div class="mpi-tool-options-gif-timing__desc">${DESC}</div>
            <div class="mpi-tool-options-gif-timing__section" id="fields-slot"></div>
            <div class="mpi-tool-options-gif-timing__note" id="note" hidden></div>
            <div class="mpi-tool-options-gif-timing__preview" id="preview-wrap">
                <div class="mpi-tool-options-gif-timing__preview-head">
                    <span class="mpi-tool-options-gif-timing__preview-label">Preview</span>
                    <span class="mpi-tool-options-gif-timing__badge" id="preview-badge" hidden></span>
                </div>
                <div class="mpi-tool-options-gif-timing__preview-frame">
                    <img class="mpi-tool-options-gif-timing__preview-img" id="preview-img" alt="GIF preview" hidden />
                    <span class="mpi-tool-options-gif-timing__preview-empty" id="preview-empty">No preview yet</span>
                    <div class="mpi-tool-options-gif-timing__preview-spinner" id="preview-spinner"></div>
                </div>
                <div class="mpi-tool-options-gif-timing__row" id="preview-btn-slot"></div>
            </div>
            <div class="mpi-tool-options-gif-timing__row" id="actions-slot"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const viewer = props.viewer;
        let settings = coerceSettings(getToolSettings(state.currentProject || {}, 'gifTiming', DEFAULTS));
        let range = null;
        /** Blank until the user types a rate: null = every frame keeps its delay. */
        let fps = null;
        /** Total plays. The GIF's own, never a remembered tool value. */
        let loop = Math.round(clampNumber(props.currentItem?.gif?.loop, 0, 0, MAX_LOOP));

        // Destroying a child also drops its listeners (factory.js), so no unsubscribe list.
        const _children = [];
        const _persistTimers = new Map();
        const fields = qs('#fields-slot', el);
        const note = qs('#note', el);

        const persist = (key, value) => {
            clearTimeout(_persistTimers.get(key));
            _persistTimers.set(key, setTimeout(() => {
                Events.emit('settings:tool:update', { toolKey: 'gifTiming', key, value });
                _persistTimers.delete(key);
            }, 250));
        };

        const setNote = (text) => { note.textContent = text; note.hidden = !text; };

        /** Each primitive gets its own row: mount() replaces its container's content. */
        const mountRow = (Primitive, mountProps) => {
            const row = document.createElement('div');
            row.className = 'mpi-tool-options-gif-timing__row';
            fields.appendChild(row);
            const child = Primitive.mount(row, mountProps);
            _children.push(child);
            return child;
        };

        /**
         * Everything the preview was built from — what makes it stale. Rate, loop
         * and the TRIM RANGE are in it as well as the build settings (MPI-836):
         * the preview runs the same `_gifOutputEntry()` Apply does, so a moved
         * handle or a new rate changes the file it would produce.
         */
        const outputKey = () =>
            [settings.maxEdge, settings.colours, settings.transparent, settings.edgeColour,
                fps, loop, ...rangeBounds(viewer?.el.getFrameCount?.() || 0, range)].join('|');
        /** Assigned by the preview block below. */
        let _markStale = () => {};
        let _destroyed = false;

        const setValue = (key, value) => {
            settings = { ...settings, [key]: value };
            persist(key, value);
            renderNote();
            _markStale();
        };

        /** A persisted build setting. */
        const numberField = (key, label, min, max, step, info) => {
            const input = mountRow(MpiInput, { type: 'number', label, value: settings[key], min, max, step, info });
            const onValue = ({ value }) => {
                const n = clampNumber(value, settings[key], min, max);
                setValue(key, step < 1 ? n : Math.round(n));
            };
            input.on('input', onValue);
            input.on('change', onValue);
        };

        /** The frames Apply will keep: the trim range over the list on screen. */
        const rangedFrames = () => {
            const frames = viewer?.el.getFrames?.() || [];
            const [lo, hi] = rangeBounds(frames.length, range);
            return frames.slice(lo, hi + 1);
        };

        function renderNote() {
            const frames = viewer?.el.getFrames?.() || [];
            const count = frames.length;
            if (!count) { setNote(''); return; }
            const [lo, hi] = rangeBounds(count, range);
            const kept = hi - lo + 1;
            // What the button will DO, before it is pressed. A refusal toast after
            // the click read as the tool being broken (Fabio, 2026-09-18).
            const which = kept >= count
                ? `All ${count} frames`
                : `Frames ${lo} to ${hi} (${kept} of ${count}; the rest are dimmed on the strip)`;
            // Blank rate = keep each frame's delay, so the note names the rate
            // they already play at rather than leaving "their own timing" abstract
            // — that IS the value the field would have been seeded with, and a
            // mixed-delay GIF has none to seed it with in the first place.
            const current = uniformFps(rangedFrames());
            const timing = fps === null
                ? (current === null ? 'each frame keeps its own timing (they differ)' : `at ${current.toFixed(1)} fps`)
                : `each frame shows for ${(fpsToDelay(fps) / 100).toFixed(2)} s (${delayToFps(fpsToDelay(fps)).toFixed(1)} fps)`;
            setNote(`${which}, ${timing}, ${loop === 0 ? 'looping forever' : `${loop} play${loop === 1 ? '' : 's'}`}.`);
        }

        // ── Fields ───────────────────────────────────────────────────────────
        // Frame rate and loop count are the video GIF Maker's two, in its order,
        // above the build settings (MPI-836).
        const fpsInput = mountRow(MpiInput, {
            type: 'number', label: 'Frame rate (fps)', value: '', min: MIN_FPS, max: MAX_FPS, step: 0.01,
            placeholder: 'Unchanged',
            info: 'One rate for every frame, 0.1 to 50 fps. Leave blank to keep the frames\' own timing',
        });
        const onFps = ({ value }) => {
            const raw = String(value ?? '').trim();
            fps = raw === '' ? null : clampNumber(raw, MIN_FPS, MIN_FPS, MAX_FPS);
            renderNote();
            _markStale();
        };
        fpsInput.on('input', onFps);
        fpsInput.on('change', onFps);

        const loopInput = mountRow(MpiInput, {
            type: 'number', label: 'Loop count', value: loop, min: 0, max: MAX_LOOP, step: 1,
            info: 'Total plays; 0 = loop forever, 1 = play once',
        });
        const onLoop = ({ value }) => {
            loop = Math.round(clampNumber(value, loop, 0, MAX_LOOP));
            renderNote();
            _markStale();
        };
        loopInput.on('input', onLoop);
        loopInput.on('change', onLoop);

        numberField('maxEdge', 'Longest edge (px)', MIN_EDGE, MAX_EDGE, 1, 'The built .gif never grows past its frames');
        numberField('colours', 'Colours', MIN_COLOURS, MAX_COLOURS, 1, 'Palette size, 2 to 256');
        const transparent = mountRow(MpiCheckbox, {
            label: 'Transparent', checked: settings.transparent, variant: 'switch',
            name: 'gif-output-transparent', info: 'Keep the frames\' transparency in the .gif',
        });
        const colourPicker = mountRow(MpiColorPicker, {
            value: settings.edgeColour, info: 'Edge colour: soft edges blend into it before the cut',
        });
        const syncColour = () => { colourPicker.el.parentElement.hidden = !settings.transparent; };
        transparent.on('change', ({ checked }) => { setValue('transparent', checked); syncColour(); });
        colourPicker.on('change', ({ hex }) => setValue('edgeColour', hex));
        syncColour();

        const applyBtn = MpiButton.mount(qs('#actions-slot', el), {
            icon: 'gif', label: 'Apply', size: 'sm', variant: 'primary',
            info: 'GIF output: save as a new GIF entry',
        });
        _children.push(applyBtn);
        const applyValues = () => ({ ...settings, fps, loop });
        applyBtn.on('click', () => emit('apply', { tool: 'output', values: applyValues() }));

        // ── Preview — GIF output only (MPI-771 consistency audit) ────────────
        // The video workspace's GIF Maker has had one since MPI-760; this tool
        // rebuilds the same `.gif` and had none, so colours / longest edge /
        // transparency were judged by applying them and looking at the card that
        // came out (Fabio, 2026-09-19). Same shape as `MpiToolOptionsGif`: a pane,
        // a byte badge that goes stale on a settings change, and a button that runs
        // a REAL build — `/gif/preview` calls the same `buildGif()` Apply does.
        //
        // The encoder is INJECTED by the Block (`el.setEncoder`), the division
        // MpiToolOptionsGif already uses: the panel owns settings, the Block owns
        // requests and the frame list.
        let _encoder = null;
        let _busy = false;
        let _lastKey = '';
        el.setEncoder = (fn) => { _encoder = fn; };

        {
            const img = qs('#preview-img', el);
            const empty = qs('#preview-empty', el);
            const badge = qs('#preview-badge', el);
            // Hide the WRAPPER, never the mount result. Two reasons, and either alone
            // is a bug: `.mpi-spinner` carries `display: inline-block`, which outranks
            // the UA sheet's `[hidden]` rule, so the attribute on `spinner.el` does
            // nothing; and this wrapper is a full-pane SCRIM (see the .css), so hiding
            // the spinner alone would leave the preview permanently dimmed. The panel's
            // own CSS guards THIS element (MPI-382, MPI-838).
            const spinnerWrap = qs('#preview-spinner', el);
            const spinner = MpiSpinner.mount(spinnerWrap, { size: 'sm' });
            _children.push(spinner);
            spinnerWrap.hidden = true;

            const previewBtn = MpiButton.mount(qs('#preview-btn-slot', el), {
                icon: 'refresh_stroke', label: 'Generate preview', size: 'sm', variant: 'secondary',
                info: 'Build a preview .gif with the current settings',
            });
            _children.push(previewBtn);

            const _setBusy = (on) => {
                _busy = on;
                spinnerWrap.hidden = !on;
                applyBtn.el.setDisabled(on);
                previewBtn.el.setDisabled(on);
            };
            // The pane keeps showing the LAST build, so the badge is what says the
            // settings have moved past it. Clearing the image instead would throw
            // away the thing being compared against.
            _markStale = () => {
                if (_lastKey && _lastKey !== outputKey()) {
                    badge.classList.add('mpi-tool-options-gif-timing__badge--stale');
                }
            };

            previewBtn.on('click', async () => {
                if (_destroyed || _busy || !_encoder) return;
                const key = outputKey();
                _setBusy(true);
                try {
                    const result = await _encoder(applyValues());
                    if (_destroyed || !result?.url) return;
                    img.src = result.url;
                    img.hidden = false;
                    empty.hidden = true;
                    badge.textContent = formatBytes(result.byteSize);
                    badge.hidden = !result.byteSize;
                    badge.classList.remove('mpi-tool-options-gif-timing__badge--stale');
                    _lastKey = key;
                } catch (err) {
                    if (!_destroyed) clientLogger.warn('MpiToolOptionsGifTiming', 'GIF preview failed', err);
                } finally {
                    if (!_destroyed) _setBusy(false);
                }
            });
        }

        el.onRangeChange = (r) => {
            range = r ? { in: r.in, out: r.out } : null;
            renderNote();
            _markStale();
        };
        // A staged strip edit, or an Apply landing, changes what the note counts
        // and what the last preview was built from. An `item` means a different
        // ENTRY is on screen: the panel is not remounted when one is picked from
        // the history list, so its loop count would otherwise stay the old one's.
        el.onFramesChange = (item) => {
            if (item) {
                loop = Math.round(clampNumber(item.gif?.loop, 0, 0, MAX_LOOP));
                loopInput.el.setValue(loop);
                // The rate that was typed is now the entry's own — every frame of
                // it carries that delay. Leaving it in the field would re-apply it
                // to whatever entry is opened next, which is exactly the silent
                // retime the blank default exists to prevent.
                fps = null;
                fpsInput.el.setValue('');
            }
            renderNote();
            _markStale();
        };

        renderNote();

        el.destroy = () => {
            _destroyed = true;
            _persistTimers.forEach(t => clearTimeout(t));
            _persistTimers.clear();
            _children.forEach(c => c.destroy?.());
        };
    },
});
