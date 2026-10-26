import { ComponentFactory } from '../../factory.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { qs } from '../../../utils/dom.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { describeImage } from '../../../services/llmService.js';
import { clientLogger } from '../../../services/clientLogger.js';
import {
    MULTI_ANGLE_LABELS, MULTI_ANGLE_SLIDERS, MULTI_ANGLE_TURNS, MULTI_ANGLE_HEIGHTS, MULTI_ANGLE_RUNGS, MULTI_ANGLE_VIEW_ASK,
    multiAngleChoices, multiAnglePreview, parseMultiAngleView, QWEN,
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

/** The rungs the preview shows by zooming into Cosmo (one CSS modifier each); far is its own render. */
const ZOOM_IN = MULTI_ANGLE_RUNGS.filter(r => r !== 'far');

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
 * The value with every stop the start cannot reach put back to the closest one it can: a turn the bench
 * never ran from there goes to the start's turn, a height to the start's (eye level on a turned pick), a
 * zoom to none.
 * @param {AngleValue} v
 * @param {{ qwen: boolean, from?: AngleValue }} opts - `from` = the view matched in step 2
 * @returns {AngleValue}
 */
export function fitAngle(v, opts) {
    const start = opts.from || normalizeAngle(null);
    const { turns } = multiAngleChoices(v.turn, 'level', opts);
    const turnOk = turns.includes(v.turn);
    const turn = turnOk ? v.turn : start.turn;
    const turnPos = turnOk ? v.turnPos : MULTI_ANGLE_SLIDERS.turn.indexOf(turn);
    const { heights } = multiAngleChoices(turn, 'level', opts);
    const fallback = heights.includes(start.height) && turn === start.turn ? start.height : 'level';
    const height = heights.includes(v.height) ? v.height : fallback;
    const { zooms } = multiAngleChoices(turn, height, opts);
    return { ...v, turn, turnPos, height, zoom: zooms.includes(v.zoom) ? v.zoom : 'none' };
}

/** Step 2 matches the picture: every stop is offered, nothing here is a pass. */
const MATCH_OFFERS = { turn: MULTI_ANGLE_SLIDERS.turn, height: MULTI_ANGLE_SLIDERS.height, zoom: MULTI_ANGLE_SLIDERS.zoom };

/**
 * MpiAngleGizmo — the Multi-angle camera picker (MPI-1039), the `angle` field type.
 *
 * A pre-rendered 3D Cosmo that shows where the camera is, over three step sliders (Turn, Height,
 * Zoom). Each preview comes from the SAME Blender camera as that stop's doll ref, so what Cosmo shows
 * is the view the edit is asked for. Two modes (Fabio 2026-10-26):
 *
 * - `match` (step 2, big): the user's picture on top, Cosmo under it; the user moves the sliders until
 *   Cosmo shows the picture's view EXACTLY. Every stop is offered. It starts at front / eye level / as
 *   in the picture, never guessed; "Try to Match" asks the describer for its guess on demand (a queue
 *   row) and moves the sliders, which the user then corrects.
 * - `pick` (the Generate slide, small): the new view. It starts on the matched view, and only the stops
 *   the bench proved FROM that view are offered: a thumb dragged onto one it cannot take stays on the
 *   last one it could, and a slider greys when it has nothing to offer (flow-spec.md § DECISION).
 *
 * Props: { value: AngleValue|null, onChange(AngleValue), mode?: 'match'|'pick', from?: AngleValue|null
 *   (pick: the matched view), picture?: string|null (match: the user's picture URL) }
 * el.getValue() → AngleValue
 */
export const MpiAngleGizmo = ComponentFactory.create({
    name: 'MpiAngleGizmo',
    css: ['js/components/Compounds/MpiAngleGizmo/MpiAngleGizmo.css'],

    template: (props = {}) => {
        const match = props.mode === 'match';
        return `
        <div class="mpi-angle-gizmo${match ? ' mpi-angle-gizmo--match' : ''}">
            ${match ? `
            <div class="mpi-angle-gizmo__picture">
                <img class="mpi-angle-gizmo__picture-img" id="angle-gizmo-picture" alt="Your picture" draggable="false">
                <p class="mpi-angle-gizmo__picture-empty" id="angle-gizmo-picture-empty">Add your picture on the first step.</p>
            </div>` : ''}
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
            ${match ? '<div class="mpi-angle-gizmo__match" id="angle-gizmo-match"></div>' : ''}
        </div>`;
    },

    setup: (el, props) => {
        const S = MULTI_ANGLE_SLIDERS;
        const match = props.mode === 'match';
        const from = match ? null : normalizeAngle(props.from);
        const opts = { qwen: (state.s_installedModelIds || []).includes(QWEN), from };
        // A pick nobody has moved yet starts on the matched view: nothing moved = no pass.
        let _val = match ? normalizeAngle(props.value) : fitAngle(normalizeAngle(props.value || from), opts);
        const previewEl = qs('#angle-gizmo-preview', el);
        // Warm every preview once, so a fast drag never shows the last stop's Cosmo under this one's name.
        MULTI_ANGLE_TURNS.forEach((t) => {
            MULTI_ANGLE_HEIGHTS.forEach((h) => {
                new Image().src = multiAnglePreview(t, h);
                new Image().src = multiAnglePreview(t, h, 'far');
            });
        });

        const posOf = key => (key === 'turn' ? _val.turnPos : S[key].indexOf(_val[key]));

        const _offers = () => {
            if (match) return MATCH_OFFERS;
            const { turns } = multiAngleChoices(_val.turn, 'level', opts);
            const { heights } = multiAngleChoices(_val.turn, 'level', opts);
            const { zooms } = multiAngleChoices(_val.turn, _val.height, opts);
            return { turn: S.turn.filter(t => turns.includes(t)), height: heights, zoom: zooms };
        };

        const _paint = () => {
            previewEl.src = multiAnglePreview(_val.turn, _val.height, _val.zoom);
            // The zoom-in rungs are CSS on the preview; none and far leave it whole. A high hs has its own anchor.
            const hsHi = _val.zoom === 'hs' && _val.height === 'hi';
            ZOOM_IN.forEach(r => previewEl.classList.toggle(`mpi-angle-gizmo__preview--${r}`, _val.zoom === r && !hsHi));
            previewEl.classList.toggle('mpi-angle-gizmo__preview--hs-hi', hsHi);
            previewEl.alt = `Cosmo seen ${MULTI_ANGLE_LABELS.turn[_val.turn].toLowerCase()}, ${MULTI_ANGLE_LABELS.height[_val.height].toLowerCase()}`;
            const offers = _offers();
            ROWS.forEach(({ key }) => {
                qs(`#angle-gizmo-readout-${key}`, el).textContent = MULTI_ANGLE_LABELS[key][_val[key]];
                const row = qs(`#angle-gizmo-row-${key}`, el);
                const off = offers[key].length < 2;
                row.classList.toggle('mpi-angle-gizmo__row--off', off);
                row.inert = off;
                _bars[key].el.setValueQuiet(posOf(key));
            });
        };

        const _set = (next) => {
            const changed = ['turn', 'turnPos', 'height', 'zoom'].some(k => next[k] !== _val[k]);
            _val = next;
            _paint();
            if (changed) props.onChange?.({ ..._val });
        };

        const _pick = (key, pos) => {
            const stop = S[key][pos];
            const next = key === 'turn' ? { ..._val, turn: stop, turnPos: pos } : { ..._val, [key]: stop };
            if (match) { _set(next); return; }
            const fitted = fitAngle(next, opts);
            // A stop the start cannot reach: the thumb stays where it was.
            if (fitted[key] !== stop) {
                _bars[key].el.setValueQuiet(posOf(key));
                return;
            }
            _set(fitted);
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

        let _matchBtn = null;
        if (match) {
            const img = qs('#angle-gizmo-picture', el);
            img.hidden = !props.picture;
            if (props.picture) img.src = props.picture;
            qs('#angle-gizmo-picture-empty', el).hidden = !!props.picture;
            _matchBtn = MpiButton.mount(qs('#angle-gizmo-match', el), {
                text: 'Try to Match', variant: 'secondary', size: 'md', disabled: !props.picture,
            });
            // The describer's guess, on demand only: a queue row while it reads, the sliders move when it
            // lands, and the user corrects what it got wrong (it reads a 3/4 front as a profile).
            _matchBtn.on('click', async () => {
                if (!props.picture) return;
                _matchBtn.el.setDisabled(true);
                _matchBtn.el.setLabel('Cosmo is looking…');
                const r = await describeImage({ imagePath: props.picture, question: MULTI_ANGLE_VIEW_ASK, greedy: true, queued: true });
                _matchBtn.el.setDisabled(false);
                _matchBtn.el.setLabel('Try to Match');
                if (!r.ok) {
                    if (!r.cancelled) Events.emit('ui:warning', { message: `Cosmo could not read the picture: ${r.error}` });
                    return;
                }
                const guess = parseMultiAngleView(r.text);
                clientLogger.info('multi-angle', `try to match: ${JSON.stringify(guess)}`);
                _set({ ...guess, turnPos: S.turn.indexOf(guess.turn) });
                Events.emit('ui:info', { message: 'Cosmo matched what it could see. Check each slider against your picture.' });
            });
        }
        _paint();

        el.getValue = () => ({ ..._val });

        el.destroy = () => {
            Object.values(_bars).forEach(b => b.destroy());
            _matchBtn?.destroy?.();
        };
    },
});
