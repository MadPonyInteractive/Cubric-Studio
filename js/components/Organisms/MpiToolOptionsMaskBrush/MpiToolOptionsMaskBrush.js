/**
 * MpiToolOptionsMaskBrush — Organism: the Brush mask tool (MPI-381).
 *
 * Paint the mask by hand. One job, nothing else: the brush rode along on Detect
 * and Points until MPI-381 split the family, so the user now goes HERE to paint
 * and nowhere else. No detect row — nothing on this tool talks to the engine.
 *
 * Owns nothing of its own; it is the shared strip WITH its brush pair. That is
 * the whole tool, and it stays that way — brush size lives on the canvas wheel.
 *
 * Props:
 * @param {object} viewer - MpiCanvasViewer instance, or MpiGifViewer (MPI-771
 *   `gifMaskBrush`: it implements the same surface over one frame at a time)
 * @param {string} [mode] - the rail mode; `gifMaskBrush` adds a note saying the
 *   fixes are kept per frame and baked by the Cut-out tool (Fabio chose a note
 *   over a second Cut out button, 2026-09-16)
 *
 * Requires on viewer.el:
 *   enterMode('mask'), exitMode(), evaluateMask(), setMaskPointsMode()
 * No 'apply' emitted — the mask is canvas-resident; PromptBox drives operations.
 */

import { ComponentFactory } from '../../factory.js';
import { MpiMaskStrip }     from '../../Compounds/MpiMaskStrip/MpiMaskStrip.js';
import { qs }               from '../../../utils/dom.js';

export const MpiToolOptionsMaskBrush = ComponentFactory.create({
    name: 'MpiToolOptionsMaskBrush',
    css: ['js/components/Organisms/MpiToolOptionsMaskBrush/MpiToolOptionsMaskBrush.css'],

    template: (props) => `
        <div class="mpi-tool-options-mask-brush">
            ${props.mode === 'gifMaskBrush' ? `
            <p class="mpi-tool-options-mask-brush__info">
                Fixes are kept per frame. Cut them out with the <b>Cut-out</b> tool.
            </p>` : ''}
            <div id="strip-slot"></div>
        </div>
    `,

    setup: (el, props) => {
        const { viewer } = props;
        const _children = [];

        viewer.el.enterMode?.('mask');
        // Entering Brush from Points must give the right mouse button back.
        viewer.el.setMaskPointsMode?.(false);

        _children.push(MpiMaskStrip.mount(qs('#strip-slot', el), { viewer, brush: true }));

        el.destroy = () => {
            viewer.el.evaluateMask?.();
            viewer.el.exitMode?.();
            _children.forEach(c => c.destroy?.());
        };
    },
});
