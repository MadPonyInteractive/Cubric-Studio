/**
 * MpiToolOptionsGifTiming — Organism: the GIF timing and output tools (MPI-772).
 *
 * One panel for four rail modes; `props.mode` picks the section (the
 * maskAdjust/paintAdjust pattern). Every Apply saves a NEW GIF entry through
 * `POST /gif/entry` (the Block owns the call): the edit rewrites the frame list,
 * `loop` or `output` only, so no frame file is written. The math lives in
 * `gifTiming.js`.
 *
 *   gifTrim    — keep the frames between the control bar's trim handles
 *   gifSpeed   — one frame rate for every frame, 0.1-50 fps
 *   gifLoop    — total plays, 0 = forever
 *   gifOutput  — built `.gif` longest edge, colour limit, transparency + edge
 *                colour (rebuilds the `.gif` only)
 *
 * Settings persist to project.json `toolSettings.gifTiming`.
 *
 * Props:
 * @param {object} viewer - MpiGifViewer instance (reads getFrameCount())
 * @param {'gifTrim'|'gifSpeed'|'gifLoop'|'gifOutput'} mode
 *
 * Block hooks on el:
 *   onRangeChange({ in, out }) — the control bar's trim range (frame indices)
 *
 * Emits:
 *   'apply' { tool: 'trim'|'speed'|'loop'|'output', values }
 *
 * `reverse` is still a `timingEdit()` tool — the GIF stage's context menu emits
 * it straight to the Block (MPI-771 audit); this panel no longer has that mode.
 */

import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiCheckbox } from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiColorPicker } from '../../Primitives/MpiColorPicker/MpiColorPicker.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { getToolSettings } from '../../../data/projectModel.js';
import { qs } from '../../../utils/dom.js';
import {
    MIN_FPS, MAX_FPS, MAX_LOOP, MIN_EDGE, MAX_EDGE, MIN_COLOURS, MAX_COLOURS,
    OUTPUT_DEFAULTS, clampNumber, fpsToDelay, delayToFps,
} from './gifTiming.js';

const TOOLS = {
    gifTrim: {
        tool: 'trim', icon: 'frames', label: 'Trim',
        desc: 'Keeps the frames between the trim handles in the control bar.',
    },
    gifSpeed: {
        tool: 'speed', icon: 'bolt', label: 'Speed',
        desc: 'Plays every frame at one rate. Below 1 fps each frame holds longer than a second.',
    },
    gifLoop: {
        tool: 'loop', icon: 'loop', label: 'Loop count',
        desc: 'How many times the GIF plays. 0 loops forever.',
    },
    gifOutput: {
        tool: 'output', icon: 'gif', label: 'GIF output',
        desc: 'Rebuilds the .gif file. The frames stay full colour.',
    },
};

const DEFAULTS = Object.freeze({ fps: 10, loop: 0, ...OUTPUT_DEFAULTS });

function coerceSettings(raw) {
    return {
        fps: clampNumber(raw.fps, DEFAULTS.fps, MIN_FPS, MAX_FPS),
        loop: Math.round(clampNumber(raw.loop, DEFAULTS.loop, 0, MAX_LOOP)),
        maxEdge: Math.round(clampNumber(raw.maxEdge, DEFAULTS.maxEdge, MIN_EDGE, MAX_EDGE)),
        colours: Math.round(clampNumber(raw.colours, DEFAULTS.colours, MIN_COLOURS, MAX_COLOURS)),
        transparent: !!raw.transparent,
        edgeColour: typeof raw.edgeColour === 'string' ? raw.edgeColour : DEFAULTS.edgeColour,
    };
}

export const MpiToolOptionsGifTiming = ComponentFactory.create({
    name: 'MpiToolOptionsGifTiming',
    css: ['js/components/Organisms/MpiToolOptionsGifTiming/MpiToolOptionsGifTiming.css'],

    template: (props) => `
        <div class="mpi-tool-options-gif-timing">
            <div class="mpi-tool-options-gif-timing__desc">${(TOOLS[props.mode] || TOOLS.gifTrim).desc}</div>
            <div class="mpi-tool-options-gif-timing__section" id="fields-slot"></div>
            <div class="mpi-tool-options-gif-timing__note" id="note" hidden></div>
            <div class="mpi-tool-options-gif-timing__row" id="actions-slot"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const def = TOOLS[props.mode] || TOOLS.gifTrim;
        const viewer = props.viewer;
        let settings = coerceSettings(getToolSettings(state.currentProject || {}, 'gifTiming', DEFAULTS));
        let range = null;

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

        const setValue = (key, value) => {
            settings = { ...settings, [key]: value };
            persist(key, value);
            renderNote();
        };

        const numberField = (key, label, min, max, step, info) => {
            const input = mountRow(MpiInput, { type: 'number', label, value: settings[key], min, max, step, info });
            const onValue = ({ value }) => {
                const n = clampNumber(value, settings[key], min, max);
                setValue(key, step < 1 ? n : Math.round(n));
            };
            input.on('input', onValue);
            input.on('change', onValue);
        };

        function renderNote() {
            if (def.tool === 'speed') {
                const delay = fpsToDelay(settings.fps);
                setNote(`Each frame shows for ${(delay / 100).toFixed(2)} s (plays at ${delayToFps(delay).toFixed(1)} fps).`);
            } else if (def.tool === 'trim') {
                const count = viewer?.el.getFrameCount?.() || 0;
                if (!range || !count) { setNote(''); return; }
                const a = Math.round(Math.min(range.in, range.out));
                const b = Math.round(Math.max(range.in, range.out));
                // An untouched range drops nothing, and Apply refuses with a
                // toast AFTER the click — which read as "Trim does nothing"
                // (Fabio, 2026-09-18). Say it up front instead. The strip now
                // paints the range too, so the handles are findable.
                if (b - a + 1 >= count) {
                    setNote(`All ${count} frames are selected — drag the handles in the control bar to pick a shorter range.`);
                    return;
                }
                setNote(`Keeps frames ${a} to ${b} (${b - a + 1} of ${count}); the rest are dimmed on the strip.`);
            }
        }

        // ── Fields per tool ──────────────────────────────────────────────────
        let colourPicker = null;
        if (def.tool === 'speed') {
            numberField('fps', 'Frame rate (fps)', MIN_FPS, MAX_FPS, 0.01, 'One rate for every frame, 0.1 to 50 fps');
        } else if (def.tool === 'loop') {
            numberField('loop', 'Plays', 0, MAX_LOOP, 1, 'Total plays; 0 = loop forever, 1 = play once');
        } else if (def.tool === 'output') {
            numberField('maxEdge', 'Longest edge (px)', MIN_EDGE, MAX_EDGE, 1, 'The built .gif never grows past its frames');
            numberField('colours', 'Colours', MIN_COLOURS, MAX_COLOURS, 1, 'Palette size, 2 to 256');
            const transparent = mountRow(MpiCheckbox, {
                label: 'Transparent', checked: settings.transparent, variant: 'switch',
                name: 'gif-output-transparent', info: 'Keep the frames\' transparency in the .gif',
            });
            colourPicker = mountRow(MpiColorPicker, {
                value: settings.edgeColour, info: 'Edge colour: soft edges blend into it before the cut',
            });
            const syncColour = () => { colourPicker.el.parentElement.hidden = !settings.transparent; };
            transparent.on('change', ({ checked }) => { setValue('transparent', checked); syncColour(); });
            colourPicker.on('change', ({ hex }) => setValue('edgeColour', hex));
            syncColour();
        }

        const applyBtn = MpiButton.mount(qs('#actions-slot', el), {
            icon: def.icon, label: 'Apply', size: 'sm', variant: 'primary',
            info: `${def.label}: save as a new GIF entry`,
        });
        _children.push(applyBtn);
        applyBtn.on('click', () => emit('apply', { tool: def.tool, values: { ...settings, ...range } }));

        el.onRangeChange = (r) => {
            range = r ? { in: r.in, out: r.out } : null;
            renderNote();
        };

        renderNote();

        el.destroy = () => {
            _persistTimers.forEach(t => clearTimeout(t));
            _persistTimers.clear();
            _children.forEach(c => c.destroy?.());
        };
    },
});
