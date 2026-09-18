/**
 * MpiToolOptionsMaskColour — Organism: the Colour mask tool (MPI-771).
 *
 * Select pixels by colour (magic wand / Select Colour Range). Pure-JS,
 * no engine, no GPU. Runs colourKeyMaskUrl on the current image and feeds
 * the result into the viewer's existing auto-pick preview path as a
 * single pre-picked detection — the same path Points mode uses.
 *
 * Controls:
 *   - Key colour: MpiColorPicker (seeded from the image's corner pixel)
 *   - Pick button: EyeDropper API when available (Chromium 95+ / Electron)
 *   - Tolerance: MpiProgressBar (interactive, 0-100)
 *   - Only touching the edges: MpiCheckbox (switch variant)
 *   - Shared detect row (Detect / Stop + Add / Subtract)
 *   - Shared mask strip (no brush pair — brush belongs to the Brush tool)
 *
 * Tolerance and edgesOnly persist via toolSettings.mask (same namespace as
 * the sibling mask tools). The key colour resets on each tool mount — it
 * defaults to the current image's top-left pixel and is never persisted.
 *
 * Changing tolerance, edgesOnly or colour after a run re-runs the key
 * with a 250 ms debounce so the preview follows the control.
 *
 * Props:
 * @param {object} viewer - MpiCanvasViewer instance
 *
 * Requires on viewer.el:
 *   enterMode('mask'), exitMode(), evaluateMask(),
 *   setMaskPointsMode(), setMaskTextMode(), setMaskColourMode(),
 *   setMaskColourParams(), runAutoMaskDetect(), getSourceElement()
 */

import { ComponentFactory }  from '../../factory.js';
import { MpiColorPicker }    from '../../Primitives/MpiColorPicker/MpiColorPicker.js';
import { MpiButton }         from '../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar }    from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiCheckbox }       from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiMaskDetectRow }  from '../../Compounds/MpiMaskDetectRow/MpiMaskDetectRow.js';
import { MpiMaskStrip }      from '../../Compounds/MpiMaskStrip/MpiMaskStrip.js';
import { qs }                from '../../../utils/dom.js';
import { Events }            from '../../../events.js';
import { state }             from '../../../state.js';
import { getToolSettings }   from '../../../data/projectModel.js';
import { readImagePixels, cornerColour, COLOUR_KEY_DEFAULTS } from '../../../utils/colourKeyMask.js';
import { clientLogger }      from '../../../services/clientLogger.js';

const SETTINGS_KEY = 'mask';
const DEFAULTS = {
    colourTolerance: COLOUR_KEY_DEFAULTS.tolerance,
    colourEdgesOnly: COLOUR_KEY_DEFAULTS.edgesOnly,
};

export const MpiToolOptionsMaskColour = ComponentFactory.create({
    name: 'MpiToolOptionsMaskColour',
    css: ['js/components/Organisms/MpiToolOptionsMaskColour/MpiToolOptionsMaskColour.css'],

    template: () => `
        <div class="mpi-tool-options-mask-colour">
            <p class="mpi-tool-options-mask-colour__info">
                Select pixels by colour. Pick the key colour, set a tolerance, then Detect.
            </p>
            <div class="mpi-tool-options-mask-colour__colour-row">
                <span class="mpi-tool-options-mask-colour__label">Colour</span>
                <div id="colour-picker-slot"></div>
                <div id="eyedropper-slot"></div>
            </div>
            <div class="mpi-tool-options-mask-colour__slider-row">
                <span class="mpi-tool-options-mask-colour__label">Tolerance</span>
                <div class="mpi-tool-options-mask-colour__slider" id="tolerance-slot"></div>
            </div>
            <div id="edges-slot"></div>
            <div id="detect-row-slot"></div>
            <div id="strip-slot"></div>
        </div>
    `,

    setup: (el, props) => {
        const { viewer } = props;
        const _children = [];
        let _debounceTimer = null;
        /** True once a colour-key run has completed — enables debounced re-runs. */
        let _hasDetected = false;

        viewer.el.enterMode?.('mask');
        // Entering Colour from Points must give the right mouse button back.
        viewer.el.setMaskPointsMode?.(false);
        viewer.el.setMaskTextMode?.(false);
        viewer.el.setMaskColourMode?.(true);

        // Restore persisted settings (tolerance + edgesOnly only — colour never persists).
        const settings = {
            ...DEFAULTS,
            ...getToolSettings(state.currentProject || {}, SETTINGS_KEY, DEFAULTS),
        };
        const savedTolerance = Number(settings.colourTolerance);
        let _tolerance = Math.max(0, Math.min(100,
            Number.isFinite(savedTolerance) ? savedTolerance : DEFAULTS.colourTolerance));
        let _edgesOnly = !!settings.colourEdgesOnly;
        // Start null; the corner-pixel seed sets it below, and colourKeyMaskUrl falls
        // back to the corner pixel when colour is null. It throws instead when that
        // pixel is TRANSPARENT (MPI-771) — the run reports that and the user picks.
        let _colour = null;

        const _pushParams = () => {
            viewer.el.setMaskColourParams?.({
                colour:    _colour,
                tolerance: _tolerance,
                edgesOnly: _edgesOnly,
            });
        };

        // Read the top-left pixel of the loaded image and seed the colour picker.
        // Runs asynchronously; any user interaction before it resolves is fine —
        // the last explicit pick wins because event handlers update _colour first.
        const _seedCornerColour = async () => {
            const imgEl = viewer.el.getSourceElement?.();
            const url = imgEl?.currentSrc || imgEl?.src || null;
            if (!url) return;
            try {
                const { data } = await readImagePixels(url);
                const hex = cornerColour(data);
                // Null = the corner is transparent, so its RGB is whatever an earlier
                // cut hid and is not a colour on screen (MPI-771). The picker keeps its
                // own default and the user picks; a run before then says so.
                if (!hex) return;
                _colour = hex;
                _pushParams();
                colourPicker.el.setHex?.(hex);
            } catch (err) {
                clientLogger.warn('colour-mask',
                    `Could not read corner pixel: ${err?.message || err}`);
            }
        };

        // ── Colour picker ──────────────────────────────────────────────────────
        // No `value`: the picker's own default stands in until _seedCornerColour()
        // reads the image's corner. Never pass null: its template reads `value.r`
        // for any object, and typeof null === 'object'.
        const colourPicker = MpiColorPicker.mount(qs('#colour-picker-slot', el), {
            info:  'Key colour to select',
        });
        colourPicker.on('change', ({ hex }) => {
            _colour = hex;
            _pushParams();
            _scheduleRerun();
        });
        _children.push(colourPicker);

        // ── EyeDropper (Chromium 95+ / Electron — screen colour sampler) ──────
        // Mount only when the API exists; the button does not appear in environments
        // that don't support it, rather than appearing disabled.
        if ('EyeDropper' in window) {
            const pickBtn = MpiButton.mount(qs('#eyedropper-slot', el), {
                label: 'Pick', size: 'sm', variant: 'secondary',
                info:  'Pick a colour from the screen',
            });
            pickBtn.on('click', async () => {
                try {
                    const dropper = new window.EyeDropper();
                    const result = await dropper.open();
                    if (result?.sRGBHex) {
                        _colour = result.sRGBHex;
                        colourPicker.el.setHex?.(_colour);
                        _pushParams();
                        _scheduleRerun();
                    }
                } catch (_err) {
                    // AbortError from Escape — ignore; the picker state is unchanged
                }
            });
            _children.push(pickBtn);
        }

        // ── Tolerance slider ───────────────────────────────────────────────────
        const toleranceBar = MpiProgressBar.mount(qs('#tolerance-slot', el), {
            min: 0, max: 100, step: 1, value: _tolerance,
            interactive: true,
            info: 'Tolerance: {value}',
        });
        toleranceBar.on('input', ({ value }) => {
            _tolerance = value;
            _pushParams();
            _scheduleRerun();
        });
        toleranceBar.on('change', ({ value }) => {
            Events.emit('settings:tool:update', {
                toolKey: SETTINGS_KEY, key: 'colourTolerance', value,
            });
        });
        _children.push(toleranceBar);

        // ── Only touching the edges (edgesOnly) ────────────────────────────────
        const edgesCheckbox = MpiCheckbox.mount(qs('#edges-slot', el), {
            label:   'Only touching the edges',
            variant: 'switch',
            checked: _edgesOnly,
        });
        edgesCheckbox.on('change', ({ checked }) => {
            _edgesOnly = checked;
            _pushParams();
            _scheduleRerun();
            Events.emit('settings:tool:update', {
                toolKey: SETTINGS_KEY, key: 'colourEdgesOnly', value: checked,
            });
        });
        _children.push(edgesCheckbox);

        // ── Shared detect row + mask strip ─────────────────────────────────────
        // The row's Detect button calls viewer.el.runAutoMaskDetect(), which routes
        // to the colour-key workflow when _colourMode is true. No brush pair (MPI-381).
        _children.push(MpiMaskDetectRow.mount(qs('#detect-row-slot', el), { viewer }));
        _children.push(MpiMaskStrip.mount(qs('#strip-slot', el), { viewer, brush: false }));

        // Push initial params then seed corner colour asynchronously.
        _pushParams();
        _seedCornerColour();

        // Track when a run has completed once, so subsequent control changes trigger
        // a debounced re-run. The 'automask:running' event going false means a run
        // just finished — this includes cancelled runs, but that's safe: if the user
        // cancels and then moves a slider, re-running is correct.
        const _offRunning = Events.on('automask:running', ({ running }) => {
            if (!running) _hasDetected = true;
        });

        function _scheduleRerun() {
            if (!_hasDetected) return;
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => {
                viewer.el.runAutoMaskDetect?.();
            }, 250);
        }

        el.destroy = () => {
            clearTimeout(_debounceTimer);
            _offRunning();
            viewer.el.setMaskColourMode?.(false);
            viewer.el.evaluateMask?.();
            viewer.el.exitMode?.();
            _children.forEach(c => c.destroy?.());
        };
    },
});
