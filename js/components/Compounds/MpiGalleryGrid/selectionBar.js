/**
 * selectionBar — the gallery's multi-select bar (MPI-945), a parts file of MpiGalleryGrid.
 *
 * Selection mode hides the PromptBox (the block's `selection-start`), so what acts on a
 * whole selection sits in the strip it leaves. Shown only under
 * `.mpi-gallery-grid--selecting` (CSS). Same order as the card menu, coarse → fine →
 * irreversible: count · Stack, Routines · Compare, Combine, Make GIF · marks · Download,
 * Archive, Delete · close. Stack, Routines, Compare, Combine and Make GIF live ONLY here;
 * Download, Archive and Delete are on the card menu too (Fabio, 2026-09-27). Stack took
 * Cue all's slot (MPI-949); Routines is MPI-970 D13.
 *
 * The bar is dumb: the grid owns the selection, hands each action its disabled state and
 * status-bar reason through `update`, and gets every click back as `onAction(key)`.
 */

import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiDropdown } from '../../Primitives/MpiDropdown/MpiDropdown.js';
import { ce, on } from '../../../utils/dom.js';
import { CARD_MARKS } from '../../../utils/galleryFilter.js';

/**
 * @param {HTMLElement} host - the grid root; the bar is appended as its last child.
 * @param {{ onAction: (key: string) => void, onMark: (id: string|null) => void,
 *     onRoutine: (name: string) => void }} handlers
 * @returns {{ update: (s: { count: number, mark: string|null,
 *     actions: Object<string, { disabled?: boolean, info: string, label?: string }>,
 *     routines: Array<Object> }) => void,
 *     destroy: () => void }}
 */
export function mountSelectionBar(host, { onAction, onMark, onRoutine }) {
    const btn = (props) => MpiButton.mount(ce('div'), { size: 'sm', ...props }).el;
    const sep = () => ce('span', { className: 'mpi-gallery-grid__selection-sep' });
    const action = (key, icon, variant = 'ghost') => {
        const el = btn({ icon, variant });
        el.dataset.action = key;
        return el;
    };

    const count = ce('span', { className: 'mpi-gallery-grid__selection-count' });
    const actions = {
        stack:      btn({ text: 'Stack', variant: 'primary', extraClasses: 'mpi-gallery-grid__selection-stack' }),
        compare:    action('compare', 'compare'),
        combine:    action('combine', 'merge'),
        'make-gif': action('make-gif', 'gif'),
        download:   action('download', 'download'),
        archive:    action('archive', 'archive'),
        // Ghost, not danger: danger fills a solid red block that outshouts the bar, and
        // Delete already opens a confirm (Cancel / Archive / Delete).
        delete:     action('delete', 'trash'),
        close:      action('close', 'close'),
    };
    actions.stack.dataset.action = 'stack';
    actions.close.dataset.info = 'Exit selection (Esc)';

    const marks = CARD_MARKS.map(m => ({
        id: m.id,
        el: btn({ icon: m.icon, variant: 'secondary', info: `Mark the selection: ${m.singular}` }),
    }));
    const unmark = btn({ icon: 'mark_none', variant: 'secondary', info: 'Clear the selection\'s marks' });
    marks.forEach(m => { m.el.dataset.mark = m.id; });
    unmark.dataset.mark = 'none';

    // MPI-970 D13: the saved routines, run on the selection. Only the agent makes them, so
    // with none saved the dropdown is not there at all. Options come whole from the grid
    // (`setRoutineMenu`), greyed ones carrying their reason.
    const routines = MpiDropdown.mount(ce('div'), {
        options: [], placeholder: 'Routines', direction: 'up',
        info: 'Run a routine the agent saved on the selected cards',
        extraClasses: 'mpi-gallery-grid__selection-routines',
    });
    let routineList = [];
    let routineKey = '';
    routines.on('change', ({ value }) => {
        routines.el.setOptions(routineList, '');   // the trigger reads "Routines" again next time
        onRoutine(value);
    });

    const bar = ce('div', { className: 'mpi-gallery-grid__selection-bar' }, [
        count, sep(),
        actions.stack, routines.el, sep(),
        actions.compare, actions.combine, actions['make-gif'], sep(),
        ...marks.map(m => m.el), unmark, sep(),
        actions.download, actions.archive, actions.delete, sep(),
        actions.close,
    ]);
    host.append(bar);

    const unsubs = [
        ...Object.entries(actions).map(([key, el]) => on(el, 'click', () => onAction(key))),
        ...marks.map(m => on(m.el, 'click', () => onMark(m.id))),
        on(unmark, 'click', () => onMark(null)),
    ];

    return {
        update({ count: n, mark, actions: states, routines: list = [] }) {
            count.textContent = `${n} selected`;
            routines.el.classList.toggle('hide', !list.length);
            // Only on a change: this runs on every grid render, and a rebuilt list would
            // repaint under a menu the user has open.
            const key = JSON.stringify(list);
            if (key !== routineKey) {
                routineKey = key;
                routineList = list;
                routines.el.setOptions(list, '');
            }
            for (const [key, s] of Object.entries(states)) {
                const el = actions[key];
                el.setDisabled(!!s.disabled);
                // This app has no tooltips: `data-info` → the status bar is the only place
                // a button explains itself, and a greyed one must say WHY.
                el.dataset.info = s.info;
                if (s.label) el.setLabel(s.label);
            }
            // Lit only when EVERY selected card wears that shape.
            marks.forEach(m => m.el.setActive(m.id === mark));
        },
        destroy() {
            unsubs.forEach(fn => fn());
            routines.el.destroy();   // its option list is portalled to <body>
            bar.remove();
        },
    };
}
