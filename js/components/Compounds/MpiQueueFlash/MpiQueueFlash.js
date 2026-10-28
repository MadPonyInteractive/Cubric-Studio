/**
 * MpiQueueFlash — the right-edge strip that says "the queue just took a job" (Compound).
 *
 * MPI-1105 (Fabio, 2026-10-12): the Cue panel is closed most of the time, so a job that
 * lands in it (a generation, a Transfers row) would otherwise be seen by nobody. On
 * `queue:added` a gradient strip the queue panel's height flashes on the right
 * edge, in the job's subject colour (DESIGN.md "The accent family": image rose, video
 * orange, audio green), one flash fading out over 3 s. The whole strip is the button that opens the queue: a small icon
 * and "Queue" label on it. Gone after ~3 s. Nothing when the
 * Cue panel is already open: the row itself is in view.
 *
 * Mounted once by the shell; app lifetime.
 *
 * Props: none.
 * Listens: `queue:added` { mediaType?: 'image'|'video'|'audio' }.
 * Emits: `open` - the Open queue button; the shell opens the Cue slide-over (a Compound
 *   may not import MpiQueuePanel, another Compound).
 */

import { ComponentFactory } from '../../factory.js';
import { Events } from '../../../events.js';
import { on, qs } from '../../../utils/dom.js';
import { mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { renderIcon } from '../../../utils/icons.js';

/** The CSS fade's own length. */
const FLASH_MS = 3000;
const SUBJECTS = new Set(['image', 'video', 'audio']);

export const MpiQueueFlash = ComponentFactory.create({
    name: 'MpiQueueFlash',
    css: ['js/components/Compounds/MpiQueueFlash/MpiQueueFlash.css'],

    template: () => `
        <div class="mpi-queue-flash" aria-live="polite">
            <div class="mpi-queue-flash__strip"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];
        let _timer = null;

        const open = mountButton({ size: 'sm', variant: 'ghost', extraClasses: 'mpi-queue-flash__open' },
            `<span class="mpi-queue-flash__chip">${renderIcon('layers', 'sm')}<span class="mpi-queue-flash__label">Queue</span></span>`);
        open.setAttribute('aria-label', 'Open queue');
        el.appendChild(open);

        const _hide = () => {
            clearTimeout(_timer);
            el.classList.remove('mpi-queue-flash--on');
        };

        _unsubs.push(on(open, 'click', () => {
            _hide();
            emit('open', {});
        }));

        _unsubs.push(Events.on('queue:added', ({ mediaType } = {}) => {
            if (qs('.mpi-slide-over--queue[aria-expanded="true"], .queue-panel-mount--open')) return;
            el.dataset.subject = SUBJECTS.has(mediaType) ? mediaType : 'image';
            // Restart the animation when a second job lands mid-flash.
            el.classList.remove('mpi-queue-flash--on');
            void el.offsetWidth;
            el.classList.add('mpi-queue-flash--on');
            clearTimeout(_timer);
            _timer = setTimeout(_hide, FLASH_MS);
        }));

        el.destroy = () => {
            clearTimeout(_timer);
            _unsubs.forEach(u => u());
        };
    },
});
