import { ComponentFactory } from '../../factory.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { qs } from '../../../utils/dom.js';
import { startElapsedTicker } from '../../../utils/elapsedTicker.js';
import { mascotLoop } from '../../../utils/mascotLoop.js';

// The curated pip pass behind "Installing Python packages" is minutes of silence, and a
// Pod boot can be too; a spinner alone reads as a hang after a while (MPI-792).
const QUIET_HINTS = [
    'Still working. The first start after an install or update takes longest.',
    'No need to click anything. This closes by itself when the engine is ready.',
];

/**
 * MpiStartingComfy — Engine Startup Indicator (Compound)
 *
 * Portals directly to document.body, bypassing the Overlays queue.
 * This is intentional: the ComfyUI engine startup is a system-level event
 * that must be visible regardless of whatever overlay is currently active
 * (e.g. the projects page overlay showing at app boot).
 *
 * API:
 *   inst.el.show()           — portals backdrop + wrapper, starts spinner
 *   inst.el.hide()           — removes portal, clears spinner
 *   inst.el.setError(msg)    — switches spinner to error text (stays visible)
 */
export const MpiStartingComfy = ComponentFactory.create({
    name: 'MpiStartingComfy',
    css: ['js/components/Compounds/MpiStartingComfy/MpiStartingComfy.css'],
    template: (props) => `
        <div class="mpi-starting-comfy">
            <div class="mpi-starting-comfy__media" data-ref="media"></div>
            <div class="mpi-starting-comfy__content">
                <h2 class="mpi-starting-comfy__title gradient-text" data-ref="title">${props.title || 'Starting ComfyUI Engine...'}</h2>
                <p class="mpi-starting-comfy__text text-muted" data-ref="text">${props.text || 'This may take a few moments...'}</p>
                <div class="mpi-starting-comfy__status" data-ref="status"></div>
                <p class="mpi-starting-comfy__pulse">
                    <span class="mpi-starting-comfy__clock" data-ref="clock"></span>
                    <span class="mpi-starting-comfy__quiet" data-ref="quiet"></span>
                </p>
            </div>
        </div>
    `,
    setup: (el, props, emit) => {
        // Direct portal — bypasses Overlays queue so startup indicator always shows.
        let _backdrop  = null;
        let _wrapper   = null;
        let spinnerInst = null;
        let ticker = null;

        const statusSlot = qs('[data-ref="status"]', el);
        const titleEl    = qs('[data-ref="title"]', el);
        const textEl     = qs('[data-ref="text"]', el);
        const clockEl    = qs('[data-ref="clock"]', el);
        const quietEl    = qs('[data-ref="quiet"]', el);
        const mediaEl    = qs('[data-ref="media"]', el);
        const _default   = { title: titleEl.textContent, text: textEl.textContent };

        const stopTicker = () => {
            ticker?.stop();
            ticker = null;
            quietEl.textContent = '';
        };

        el.setLoading = (isLoading) => {
            statusSlot.innerHTML = '';
            if (spinnerInst) { spinnerInst.destroy(); spinnerInst = null; }
            if (isLoading) {
                spinnerInst = MpiSpinner.mount(statusSlot, { size: 'lg', variant: 'primary' });
            }
        };

        el.setError = (errMsg) => {
            stopTicker();
            el.setLoading(false);
            statusSlot.innerHTML = `<p class="mpi-starting-comfy__error">${errMsg}</p>`;
        };

        // `phase` renames the copy for a startup step that is not just "starting" —
        // e.g. the multi-minute curated pip pass on a fresh install (MPI-525). Always
        // reset from it, so a later plain show() cannot inherit the previous phase.
        el.show = (phase) => {
            // Copy is set BEFORE the idempotent guard: a second show() while visible is
            // how a caller advances the phase (pip done → engine booting), so it must
            // still relabel. Always assigned, so a later plain show() cannot inherit it.
            titleEl.textContent = (phase && phase.title) || _default.title;
            textEl.textContent  = (phase && phase.text)  || _default.text;
            if (_backdrop) { ticker?.touch(); return; } // already visible — idempotent
            el.setLoading(true);
            // Studio's engine-starting loop (MPI-906), mounted only while shown: the
            // component lives for the whole session, a looping clip must not.
            mediaEl.innerHTML = mascotLoop('studio', 'engine-starting', 'mpi-starting-comfy__img');
            // One clock for the whole visible stretch: a phase change relabels, it
            // does not restart the count.
            ticker = startElapsedTicker((elapsed, hint) => {
                clockEl.textContent = `${elapsed} elapsed`;
                quietEl.textContent = hint || '';
            }, { hints: QUIET_HINTS });

            _backdrop = document.createElement('div');
            _backdrop.className = 'mpi-modal-backdrop';
            document.body.appendChild(_backdrop);

            _wrapper = document.createElement('div');
            _wrapper.className = 'mpi-modal-wrapper';
            _wrapper.style.width = 'min(440px, 90vw)';
            _wrapper.appendChild(el);
            document.body.appendChild(_wrapper);
        };

        el.hide = () => {
            stopTicker();
            // Detaching a video keeps its decoder; only dropping the src frees it.
            const clip = mediaEl.firstElementChild;
            if (clip) { clip.pause(); clip.removeAttribute('src'); clip.load(); clip.remove(); }
            _backdrop?.remove(); _backdrop = null;
            _wrapper?.remove();  _wrapper  = null;
        };

        el.destroy = () => {
            if (spinnerInst) spinnerInst.destroy();
            el.hide();
        };
    }
});
