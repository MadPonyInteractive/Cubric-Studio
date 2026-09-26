/**
 * selectionBar — the gallery's multi-select bar (MPI-945), a parts file of MpiGalleryGrid.
 *
 * Selection mode hides the PromptBox (the block's `selection-start`), so what acts on a
 * whole selection sits in the strip it leaves: the count, Cue all (moved here off the
 * card context menu), one mark for every selected card, and close. Shown only under
 * `.mpi-gallery-grid--selecting` (CSS). The grid owns the selection; this file draws it
 * and reports clicks.
 */

import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { ce, on } from '../../../utils/dom.js';
import { CARD_MARKS } from '../../../utils/galleryFilter.js';

// `selectCueAllTargets` reasons → the status-bar line (this app has no tooltips).
const CUE_INFO = {
    'no-operation':     'No operation selected',
    'not-batchable':    'Cue all does not support the current operation',
    'wrong-media-type': 'No selected card matches the current operation',
};
const CUE_INFO_OK = 'Queue one job per selected card on the current settings';

/**
 * @param {HTMLElement} host - the grid root; the bar is appended as its last child.
 * @param {{ onCue: () => void, onMark: (id: string|null) => void, onClose: () => void }} handlers
 * @returns {{ update: (s: { count: number, cue: { eligible: Array, reason?: string }, mark: string|null }) => void, destroy: () => void }}
 */
export function mountSelectionBar(host, { onCue, onMark, onClose }) {
    const btn = (props) => MpiButton.mount(ce('div'), { size: 'sm', ...props }).el;
    const sep = () => ce('span', { className: 'mpi-gallery-grid__selection-sep' });

    const count = ce('span', { className: 'mpi-gallery-grid__selection-count' });
    const cue = btn({ text: 'Cue all', variant: 'primary', extraClasses: 'mpi-gallery-grid__selection-cue' });
    const marks = CARD_MARKS.map(m => ({
        id: m.id,
        el: btn({ icon: m.icon, variant: 'secondary', info: `Mark the selection: ${m.singular}` }),
    }));
    const unmark = btn({ icon: 'mark_none', variant: 'secondary', info: 'Clear the selection\'s marks' });
    const close = btn({ icon: 'close', variant: 'ghost', info: 'Exit selection (Esc)' });
    marks.forEach(m => { m.el.dataset.mark = m.id; });
    unmark.dataset.mark = 'none';

    const bar = ce('div', { className: 'mpi-gallery-grid__selection-bar' }, [
        count, sep(), cue, sep(), ...marks.map(m => m.el), unmark, sep(), close,
    ]);
    host.append(bar);

    const unsubs = [
        on(cue, 'click', onCue),
        ...marks.map(m => on(m.el, 'click', () => onMark(m.id))),
        on(unmark, 'click', () => onMark(null)),
        on(close, 'click', onClose),
    ];

    return {
        update({ count: n, cue: c, mark }) {
            count.textContent = `${n} selected`;
            // Label counts the ELIGIBLE cards, not the selection: a mixed image+video
            // pick filters to the op's type rather than refusing (MPI-733).
            cue.setLabel(c.eligible.length ? `Cue all (${c.eligible.length})` : 'Cue all');
            cue.setDisabled(!c.eligible.length);
            cue.dataset.info = CUE_INFO[c.reason] ?? CUE_INFO_OK;
            // Lit only when EVERY selected card wears that shape.
            marks.forEach(m => m.el.setActive(m.id === mark));
        },
        destroy() {
            unsubs.forEach(fn => fn());
            bar.remove();
        },
    };
}
