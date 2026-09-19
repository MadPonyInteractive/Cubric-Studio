/**
 * MpiToolOptionsGifTransform — Organism: GIF Resize and GIF to Video (MPI-773).
 *
 * One panel for two rail modes; `props.mode` picks the section. Crop is NOT
 * here: the gif rail reuses `MpiToolOptionsCrop` over `MpiGifViewer`'s crop
 * surface. The Block owns every request.
 *
 *   gifResize    — every frame to one size (new frames, new entry). Starts at
 *                  the frame's own size; Keep proportions ties the two fields.
 *   gifToVideo   — the frames with their delays as a 30 fps MP4 card; the
 *                  background colour fills transparent areas (MP4 has no alpha)
 *
 * Save frame LEFT this panel (MPI-771 consistency audit): it was a sentence and
 * a button, and it is the video workspace's own "Create snapshot" right-click.
 * The GIF stage's context menu calls the Block's `saveFrame` handler directly.
 *
 * Settings persist to project.json `toolSettings.gifTransform` (keepAspect, background).
 *
 * Props:
 * @param {object} viewer - MpiGifViewer instance (reads getFrameSize())
 * @param {'gifResize'|'gifToVideo'} mode
 *
 * Emits:
 *   'apply' { tool: 'resize', width, height }
 *   'apply' { tool: 'toVideo', background }
 */

import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiCheckbox } from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiColorPicker } from '../../Primitives/MpiColorPicker/MpiColorPicker.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { getToolSettings } from '../../../data/projectModel.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { qs } from '../../../utils/dom.js';

const MAX_SIDE = 8192;

const TOOLS = {
    gifResize: {
        tool: 'resize', icon: 'resize_stroke', label: 'Apply',
        desc: 'Resizes every frame to one size.',
    },
    gifToVideo: {
        tool: 'toVideo', icon: 'video', label: 'Make video',
        desc: 'Makes a 30 fps MP4 card. Each frame holds for its own delay.',
    },
};

const DEFAULTS = Object.freeze({
    keepAspect: true,
    // eslint-disable-next-line mpi/no-hardcoded-hex-color -- default video background, sent to the route
    background: '#000000',
});

const clampSide = (value, fallback) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(1, Math.min(MAX_SIDE, n)) : fallback;
};

export const MpiToolOptionsGifTransform = ComponentFactory.create({
    name: 'MpiToolOptionsGifTransform',
    css: ['js/components/Organisms/MpiToolOptionsGifTransform/MpiToolOptionsGifTransform.css'],

    template: (props) => `
        <div class="mpi-tool-options-gif-transform">
            <div class="mpi-tool-options-gif-transform__desc">${(TOOLS[props.mode] || TOOLS.gifResize).desc}</div>
            <div class="mpi-tool-options-gif-transform__section" id="fields-slot"></div>
            <div class="mpi-tool-options-gif-transform__note" id="note" hidden></div>
            <div class="mpi-tool-options-gif-transform__row" id="actions-slot"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const def = TOOLS[props.mode] || TOOLS.gifResize;
        const viewer = props.viewer;
        const saved = getToolSettings(state.currentProject || {}, 'gifTransform', DEFAULTS);
        let keepAspect = saved.keepAspect !== false;
        let background = typeof saved.background === 'string' ? saved.background : DEFAULTS.background;
        let size = null;          // the frame's own size
        let width = 0;
        let height = 0;
        let destroyed = false;

        // Destroying a child also drops its listeners (factory.js), so no unsubscribe list.
        const _children = [];
        const _persistTimers = new Map();
        const fields = qs('#fields-slot', el);
        const note = qs('#note', el);

        const persist = (key, value) => {
            clearTimeout(_persistTimers.get(key));
            _persistTimers.set(key, setTimeout(() => {
                Events.emit('settings:tool:update', { toolKey: 'gifTransform', key, value });
                _persistTimers.delete(key);
            }, 250));
        };

        /** Each primitive gets its own row: mount() replaces its container's content. */
        const mountRow = (Primitive, mountProps) => {
            const row = document.createElement('div');
            row.className = 'mpi-tool-options-gif-transform__row';
            fields.appendChild(row);
            const child = Primitive.mount(row, mountProps);
            _children.push(child);
            return child;
        };

        const applyBtn = MpiButton.mount(qs('#actions-slot', el), {
            icon: def.icon, label: def.label, size: 'sm', variant: 'primary', info: def.desc,
        });
        _children.push(applyBtn);

        if (def.tool === 'resize') {
            const wInput = mountRow(MpiInput, { type: 'number', label: 'Width', value: '', min: 1, max: MAX_SIDE, step: 1, info: 'Output width in pixels' });
            const hInput = mountRow(MpiInput, { type: 'number', label: 'Height', value: '', min: 1, max: MAX_SIDE, step: 1, info: 'Output height in pixels' });
            const keep = mountRow(MpiCheckbox, {
                label: 'Keep proportions', checked: keepAspect, variant: 'switch',
                name: 'gif-resize-keep', info: 'Change one side and the other follows',
            });
            const setBoth = (w, h) => {
                width = w; height = h;
                wInput.el.setValue(w);
                hInput.el.setValue(h);
            };
            wInput.on('input', ({ value }) => {
                width = clampSide(value, width);
                if (keepAspect && size) { height = Math.max(1, Math.round(width * size.h / size.w)); hInput.el.setValue(height); }
            });
            hInput.on('input', ({ value }) => {
                height = clampSide(value, height);
                if (keepAspect && size) { width = Math.max(1, Math.round(height * size.w / size.h)); wInput.el.setValue(width); }
            });
            keep.on('change', ({ checked }) => { keepAspect = checked; persist('keepAspect', checked); });

            applyBtn.el.setDisabled(true);
            viewer?.el.getFrameSize?.().then((s) => {
                if (destroyed || !s?.w) return;
                size = s;
                setBoth(s.w, s.h);
                note.textContent = `Frames are ${s.w} × ${s.h}.`;
                note.hidden = false;
                applyBtn.el.setDisabled(false);
            }).catch(err => clientLogger.warn('MpiToolOptionsGifTransform', `frame size read failed: ${err?.message || err}`));
            applyBtn.on('click', () => {
                if (width > 0 && height > 0) emit('apply', { tool: 'resize', width, height });
            });
        } else {
            const picker = mountRow(MpiColorPicker, { value: background, info: 'Background: fills transparent areas' });
            picker.on('change', ({ hex }) => { background = hex; persist('background', hex); });
            applyBtn.on('click', () => emit('apply', { tool: 'toVideo', background }));
        }

        el.destroy = () => {
            destroyed = true;
            _persistTimers.forEach(t => clearTimeout(t));
            _persistTimers.clear();
            _children.forEach(c => c.destroy?.());
        };
    },
});
