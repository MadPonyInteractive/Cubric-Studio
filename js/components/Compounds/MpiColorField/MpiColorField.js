/**
 * MpiColorField — Compound: a colour swatch with the screen eyedropper beside it
 * (MPI-964).
 *
 * MpiColorPicker + a Pick button on Chromium's EyeDropper API. Five tool panels
 * mounted that pair by hand (Remove Background, Paint, Paint Adjust, the GIF
 * cut-out's By colour, the image Colour mask); this is the one copy. The button
 * is not mounted at all where the API is missing, rather than shown disabled.
 *
 * A pick goes through the picker's own `setHex`, so it leaves as the same
 * 'change' a swatch edit does — a consumer has ONE path for a new colour.
 *
 * Props:
 * @param {string|{r:number,g:number,b:number}} [value] - initial colour (picker default when omitted)
 * @param {string} [info] - Info Bar text for the swatch
 * @param {string} [pickInfo] - Info Bar text for Pick
 *
 * Emits:
 *   'change' { r, g, b, hex } — the swatch was edited or a colour was picked
 *
 * Instance methods (on instance.el): setHex(hex) — emits 'change', as the picker's does; getHex()
 */

import { ComponentFactory } from '../../factory.js';
import { MpiColorPicker } from '../../Primitives/MpiColorPicker/MpiColorPicker.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { qs } from '../../../utils/dom.js';

export const MpiColorField = ComponentFactory.create({
    name: 'MpiColorField',
    css: ['js/components/Compounds/MpiColorField/MpiColorField.css'],

    template: () => `
        <div class="mpi-color-field">
            <div class="mpi-color-field__picker"></div>
            <div class="mpi-color-field__pick"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        // Never pass `value: undefined|null` through: the picker's template reads
        // `value.r` for any object, and typeof null === 'object'.
        const picker = MpiColorPicker.mount(qs('.mpi-color-field__picker', el), {
            ...(props.value != null && { value: props.value }),
            info: props.info,
        });
        picker.on('change', payload => emit('change', payload));

        let pickBtn = null;
        if ('EyeDropper' in window) {
            // `label` is an ICON-MODE prop: without `icon`, MpiButton renders `text`
            // and drops `label` (an empty grey box, 2026-09-18).
            pickBtn = MpiButton.mount(qs('.mpi-color-field__pick', el), {
                icon: 'eyedropper', label: 'Pick', size: 'sm', variant: 'secondary',
                info: props.pickInfo || 'Pick a colour from the screen',
            });
            pickBtn.on('click', async () => {
                try {
                    const { sRGBHex } = await new window.EyeDropper().open();
                    if (sRGBHex && el.isConnected) picker.el.setHex(sRGBHex);
                } catch { /* the user pressed Escape */ }
            });
        }

        el.setHex = hex => picker.el.setHex(hex);
        el.getHex = () => picker.el.getHex();

        el.destroy = () => {
            picker.destroy?.();
            pickBtn?.destroy?.();
        };
    },
});
