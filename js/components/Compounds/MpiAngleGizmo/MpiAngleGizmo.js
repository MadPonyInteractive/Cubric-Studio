import { ComponentFactory } from '../../factory.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { qs } from '../../../utils/dom.js';
import { state } from '../../../state.js';
import {
    MULTI_ANGLE_LABELS, MULTI_ANGLE_SLIDERS, MULTI_ANGLE_TURNS, MULTI_ANGLE_HEIGHTS, multiAngleChoices,
    multiAnglePreview, QWEN,
} from '../../../data/flowPrompts/multiAngle.js';

/**
 * @typedef {Object} AngleValue
 * @property {string} turn    - a MULTI_ANGLE_TURNS stop
 * @property {string} height  - 'lo' | 'level' | 'hi'
 * @property {string} zoom    - a MULTI_ANGLE_RUNGS rung, or 'none'
 * @property {number} turnPos - where the Turn thumb sits: the back is at BOTH ends of the slider
 *
 * NOTE: this typedef belongs in js/components/types.js — it lives here only because other
 * sessions keep that file busy, as MpiStepEdges' does.
 */

/** The three sliders, top to bottom. */
const ROWS = [
    { key: 'turn', label: 'Turn' },
    { key: 'height', label: 'Height' },
    { key: 'zoom', label: 'Zoom' },
];

/**
 * What an untouched or restored value means. A stop this build does not offer falls back to the
 * front, eye level, as in the picture.
 * @param {Partial<AngleValue>|null|undefined} v
 * @returns {AngleValue}
 */
export function normalizeAngle(v) {
    const S = MULTI_ANGLE_SLIDERS;
    const turn = S.turn.includes(v?.turn) ? v.turn : 'front';
    const pos = Number.isInteger(v?.turnPos) && S.turn[v.turnPos] === turn ? v.turnPos : S.turn.indexOf(turn);
    return {
        turn,
        turnPos: pos,
        height: S.height.includes(v?.height) ? v.height : 'level',
        zoom: S.zoom.includes(v?.zoom) ? v.zoom : 'none',
    };
}

/**
 * The value with every stop the turn cannot take put back to the closest one it can: a height the
 * bench never ran goes to eye level, a zoom to none.
 * @param {AngleValue} v
 * @param {{ qwen: boolean }} opts
 * @returns {AngleValue}
 */
export function fitAngle(v, opts) {
    const { heights } = multiAngleChoices(v.turn, 'level', opts);
    const height = heights.includes(v.height) ? v.height : 'level';
    const { zooms } = multiAngleChoices(v.turn, height, opts);
    return { ...v, height, zoom: zooms.includes(v.zoom) ? v.zoom : 'none' };
}

/**
 * MpiAngleGizmo — the Multi-angle camera picker (MPI-1039), the `angle` field type.
 *
 * A small pre-rendered 3D Cosmo that shows where the camera goes, over three step sliders
 * (Turn, Height, Zoom). It sits in the Generate slide's control column (Fabio, 2026-10-25: no
 * step of its own, small). Each preview comes from the SAME Blender camera as that stop's doll
 * ref, so what Cosmo shows is the view the edit is asked for. Only the benched stops are offered:
 * a thumb dragged onto a stop the current view cannot take stays on the last one it could, and a
 * slider greys when it has nothing to offer (flow-spec.md § DECISION).
 *
 * Props: { value: AngleValue|null, onChange(AngleValue) }
 * el.getValue() → AngleValue
 */
export const MpiAngleGizmo = ComponentFactory.create({
    name: 'MpiAngleGizmo',
    css: ['js/components/Compounds/MpiAngleGizmo/MpiAngleGizmo.css'],

    template: () => `
        <div class="mpi-angle-gizmo">
            <div class="mpi-angle-gizmo__stage">
                <img class="mpi-angle-gizmo__preview" id="angle-gizmo-preview" alt="" draggable="false">
            </div>
            ${ROWS.map(r => `
            <div class="mpi-angle-gizmo__row" id="angle-gizmo-row-${r.key}">
                <div class="mpi-angle-gizmo__label">
                    <span>${r.label}</span>
                    <span class="mpi-angle-gizmo__readout" id="angle-gizmo-readout-${r.key}"></span>
                </div>
                <div class="mpi-angle-gizmo__slot" id="angle-gizmo-slot-${r.key}"></div>
            </div>`).join('')}
        </div>`,

    setup: (el, props) => {
        const S = MULTI_ANGLE_SLIDERS;
        const opts = { qwen: (state.s_installedModelIds || []).includes(QWEN) };
        let _val = fitAngle(normalizeAngle(props.value), opts);
        const previewEl = qs('#angle-gizmo-preview', el);
        // Warm every preview once, so a fast drag never shows the last stop's Cosmo under this one's name.
        MULTI_ANGLE_TURNS.forEach(t => MULTI_ANGLE_HEIGHTS.forEach((h) => { new Image().src = multiAnglePreview(t, h); }));

        const posOf = key => (key === 'turn' ? _val.turnPos : S[key].indexOf(_val[key]));

        const _paint = () => {
            previewEl.src = multiAnglePreview(_val.turn, _val.height);
            previewEl.alt = `Cosmo seen ${MULTI_ANGLE_LABELS.turn[_val.turn].toLowerCase()}, ${MULTI_ANGLE_LABELS.height[_val.height].toLowerCase()}`;
            const { heights } = multiAngleChoices(_val.turn, 'level', opts);
            const { zooms } = multiAngleChoices(_val.turn, _val.height, opts);
            const offers = { turn: S.turn, height: heights, zoom: zooms };
            ROWS.forEach(({ key }) => {
                qs(`#angle-gizmo-readout-${key}`, el).textContent = MULTI_ANGLE_LABELS[key][_val[key]];
                const row = qs(`#angle-gizmo-row-${key}`, el);
                const off = offers[key].length < 2;
                row.classList.toggle('mpi-angle-gizmo__row--off', off);
                row.inert = off;
                _bars[key].el.setValueQuiet(posOf(key));
            });
        };

        const _pick = (key, pos) => {
            const stop = S[key][pos];
            const next = key === 'turn' ? { ..._val, turn: stop, turnPos: pos } : { ..._val, [key]: stop };
            const fitted = fitAngle(next, opts);
            // A height or zoom the view cannot take: the thumb stays where it was.
            if (key !== 'turn' && fitted[key] !== stop) {
                _bars[key].el.setValueQuiet(posOf(key));
                return;
            }
            const changed = ['turn', 'turnPos', 'height', 'zoom'].some(k => fitted[k] !== _val[k]);
            _val = fitted;
            _paint();
            if (changed) props.onChange?.({ ..._val });
        };

        const _bars = {};
        ROWS.forEach(({ key }) => {
            const bar = MpiProgressBar.mount(qs(`#angle-gizmo-slot-${key}`, el), {
                min: 0, max: S[key].length - 1, step: 1, value: posOf(key),
                interactive: true, handle: true, wheel: true,
                // The readout above already names the stop; a number in the status bar says nothing.
                info: '',
            });
            bar.on('input', ({ value }) => _pick(key, value));
            _bars[key] = bar;
        });
        _paint();

        el.getValue = () => ({ ..._val });

        el.destroy = () => {
            Object.values(_bars).forEach(b => b.destroy());
        };
    },
});
