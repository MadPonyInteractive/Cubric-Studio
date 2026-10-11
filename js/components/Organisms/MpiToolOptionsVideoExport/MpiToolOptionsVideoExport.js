/**
 * MpiToolOptionsVideoExport — Organism: "Export for editing" (MPI-1073).
 *
 * One sentence and a Save button. The clip (its trim range, if set) leaves as
 * ProRes 4444 .mov with its transparency, for DaVinci and other editors. It is never
 * a card: the Block encodes it and the system Save dialog takes it out of the app.
 *
 * Props:
 * @param {object} viewer - MpiVideoViewer instance (unused; every tool panel gets one)
 *
 * Emits:
 *   'apply' {} — user pressed Save
 */

import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { qs } from '../../../utils/dom.js';

export const MpiToolOptionsVideoExport = ComponentFactory.create({
    name: 'MpiToolOptionsVideoExport',
    css: ['js/components/Organisms/MpiToolOptionsVideoExport/MpiToolOptionsVideoExport.css'],

    template: () => `
        <div class="mpi-tool-options-video-export">
            <p class="mpi-tool-options-video-export__note">
                Saves the clip as ProRes 4444 (.mov), transparency kept, for DaVinci
                and other editors. It does not add a card.
            </p>
            <div class="mpi-tool-options-video-export__row" id="save-slot"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const saveBtn = MpiButton.mount(qs('#save-slot', el), {
            icon: 'download', label: 'Save ProRes', size: 'sm', variant: 'primary',
            info: 'Save the clip as ProRes 4444 with transparency',
        });
        saveBtn.on('click', () => emit('apply', {}));

        el.destroy = () => saveBtn.destroy?.();
    },
});
