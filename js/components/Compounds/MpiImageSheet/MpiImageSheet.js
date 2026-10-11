import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiDropdown } from '../../Primitives/MpiDropdown/MpiDropdown.js';
import { qs, ce, on } from '../../../utils/dom.js';
import {
    SHEET_SHAPES, SHEET_SIZES, SHEET_MAX_ZOOM, packSheet, placeSheet, frameRect, sheetPixelSize, sheetGutter,
} from '../../../utils/sheetLayout.js';

/**
 * MpiImageSheet — gallery Combine on 2+ stills: pack them into one sheet (Compound, MPI-1094)
 *
 * A blocking modal with a live preview of the sheet. The packer (`js/utils/sheetLayout.js`)
 * places the pictures so they fill it; the user then picks the sheet's Shape and Size,
 * marks a picture Bigger, and frames each one inside its cell — drag to move it, scroll to
 * zoom. Combine hands the previewed tree and framing to `onCombine`, which renders it
 * server-side with the same packer (`routes/imageSheet.js`), so the card is what was shown.
 *
 * Usage:
 *   const sheet = MpiImageSheet.mount(document.createElement('div'), {
 *       items: [{ src, aspect }, ...],          // in click order
 *       onCombine: async ({ tree, shape, longEdge, frames }) => { ... },
 *   });
 *   sheet.el.show();
 *
 * Props:
 * @param {Array<{src:string, aspect?:number}>} items - preview url + upright width/height
 *   (read off the loaded picture when missing)
 * @param {Function} [onCombine] - async (request) => void. Errors keep the modal open.
 */
export const MpiImageSheet = ComponentFactory.create({
    name: 'MpiImageSheet',
    css: ['js/components/Compounds/MpiImageSheet/MpiImageSheet.css'],

    template: () => `
        <div class="mpi-image-sheet" role="dialog" aria-modal="true">
            <div class="mpi-image-sheet__header">
                <div class="mpi-image-sheet__title">Combine into a sheet</div>
                <div class="mpi-image-sheet__size" id="size-readout"></div>
            </div>
            <div class="mpi-image-sheet__stage" id="stage">
                <div class="mpi-image-sheet__preview" id="preview"></div>
            </div>
            <div class="mpi-image-sheet__controls" id="controls">
                <div class="mpi-image-sheet__hint">Drag a picture to frame it. Scroll to zoom.</div>
            </div>
            <div class="mpi-image-sheet__actions" id="actions"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];
        let _cellUnsubs = [];
        const items = props.items || [];
        const frames = items.map(() => ({ zoom: 1, cx: 0.5, cy: 0.5 }));
        const weights = items.map(() => 1);
        let shape = 'auto';
        let longEdge = SHEET_SIZES[0];
        let layout = null;   // { tree, r }

        const modal = MpiModal.mount(document.createElement('div'), { width: 'min(960px, 94vw)' });
        modal.el.appendChild(el);
        el.show = () => modal.el.show();
        el.hide = () => { modal.el.hide(); el.destroy(); };

        const preview = qs('#preview', el);
        const stage = qs('#stage', el);
        const sizeReadout = qs('#size-readout', el);

        // ── Controls ────────────────────────────────────────────────────────
        const shapeDd = MpiDropdown.mount(document.createElement('div'), {
            options: SHEET_SHAPES.map(s => ({ label: s.label, value: s.value })),
            value: shape,
            direction: 'up',   // the controls sit at the dialog's foot
            info: 'The sheet\'s shape. Auto picks the shape the pictures fill without cropping',
        });
        shapeDd.on('change', ({ value }) => { shape = value; _relayout(); });
        const sizeDd = MpiDropdown.mount(document.createElement('div'), {
            options: SHEET_SIZES.map(s => ({ label: `${s / 1024}K`, value: String(s) })),
            value: String(longEdge),
            direction: 'up',
            info: 'The sheet\'s long edge in pixels',
        });
        sizeDd.on('change', ({ value }) => { longEdge = Number(value); _readout(); });
        const controls = qs('#controls', el);
        controls.prepend(shapeDd.el, sizeDd.el);

        // ── Preview ─────────────────────────────────────────────────────────
        const _readout = () => {
            if (!layout) return;
            const { width, height } = sheetPixelSize(layout.r, longEdge);
            sizeReadout.textContent = `${width} × ${height}`;
        };

        /** Fit the preview box inside the stage at the sheet's shape. */
        const _fitPreview = () => {
            if (!layout) return;
            const rect = stage.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const w = Math.min(rect.width, rect.height * layout.r);
            preview.style.width = `${w}px`;
            preview.style.height = `${w / layout.r}px`;
        };

        const _placeImg = (img, i, cellAspect) => {
            const f = frameRect(items[i].aspect, cellAspect, frames[i]);
            // Store the clamped centre so a drag past the edge does not bank slack.
            frames[i].cx = f.x + f.w / 2;
            frames[i].cy = f.y + f.h / 2;
            img.style.width = `${100 / f.w}%`;
            img.style.height = `${100 / f.h}%`;
            img.style.left = `${-100 * f.x / f.w}%`;
            img.style.top = `${-100 * f.y / f.h}%`;
            return f;
        };

        const _render = () => {
            _cellUnsubs.forEach(fn => fn());
            _cellUnsubs = [];
            preview.replaceChildren();
            const aspects = items.map(it => it.aspect);
            // Cells in the real sheet's pixels, then as % of it: the gutter previews true.
            const { width, height } = sheetPixelSize(layout.r, SHEET_SIZES[0]);
            const cells = placeSheet(layout.tree, aspects, width, height, sheetGutter(width, height));
            cells.forEach((c, i) => {
                const cellAspect = c.w / c.h;
                const img = ce('img', { className: 'mpi-image-sheet__img', src: items[i].src, draggable: false, alt: '' });
                const bigger = MpiButton.mount(document.createElement('div'), {
                    icon: 'fullscreen',
                    size: 'sm',
                    toggleable: true,
                    active: weights[i] > 1,
                    info: 'Bigger: give this picture more of the sheet',
                    extraClasses: 'mpi-image-sheet__bigger',
                });
                bigger.on('toggle', ({ active }) => { weights[i] = active ? 2 : 1; _relayout(); });
                const cell = ce('div', { className: 'mpi-image-sheet__cell' }, [img, bigger.el]);
                Object.assign(cell.style, {
                    left: `${100 * c.x / width}%`, top: `${100 * c.y / height}%`,
                    width: `${100 * c.w / width}%`, height: `${100 * c.h / height}%`,
                });
                _placeImg(img, i, cellAspect);

                // Drag = move the picture under the cell; the frame moves the other way.
                let drag = null;
                _cellUnsubs.push(on(cell, 'pointerdown', (e) => {
                    if (e.button !== 0 || e.target.closest('.mpi-image-sheet__bigger')) return;
                    cell.setPointerCapture(e.pointerId);
                    drag = { x: e.clientX, y: e.clientY, cx: frames[i].cx, cy: frames[i].cy };
                    cell.classList.add('mpi-image-sheet__cell--dragging');
                }));
                _cellUnsubs.push(on(cell, 'pointermove', (e) => {
                    if (!drag) return;
                    const box = cell.getBoundingClientRect();
                    const f = frameRect(items[i].aspect, cellAspect, frames[i]);
                    frames[i].cx = drag.cx - (e.clientX - drag.x) / box.width * f.w;
                    frames[i].cy = drag.cy - (e.clientY - drag.y) / box.height * f.h;
                    _placeImg(img, i, cellAspect);
                }));
                const _end = () => { drag = null; cell.classList.remove('mpi-image-sheet__cell--dragging'); };
                _cellUnsubs.push(on(cell, 'pointerup', _end));
                _cellUnsubs.push(on(cell, 'pointercancel', _end));
                _cellUnsubs.push(on(cell, 'wheel', (e) => {
                    e.preventDefault();
                    frames[i].zoom = Math.min(SHEET_MAX_ZOOM, Math.max(1, frames[i].zoom * Math.exp(-e.deltaY * 0.0015)));
                    _placeImg(img, i, cellAspect);
                }, { passive: false }));
                _cellUnsubs.push(() => bigger.el.destroy?.());
                preview.append(cell);
            });
            _fitPreview();
            _readout();
        };

        const _relayout = () => {
            const fixed = SHEET_SHAPES.find(s => s.value === shape)?.r || null;
            layout = packSheet(items.map(it => it.aspect), { weights, shape: fixed });
            _render();
        };

        const ro = new ResizeObserver(() => _fitPreview());
        ro.observe(stage);
        _unsubs.push(() => ro.disconnect());

        // ── Actions ─────────────────────────────────────────────────────────
        const actions = qs('#actions', el);
        const cancelBtn = MpiButton.mount(document.createElement('div'), { text: 'Cancel', variant: 'secondary', size: 'md' });
        cancelBtn.on('click', () => el.hide());
        const combineBtn = MpiButton.mount(document.createElement('div'), {
            text: 'Combine', variant: 'primary', size: 'md', disabled: true,
            info: 'Save the sheet as a new card',
        });
        actions.append(cancelBtn.el, combineBtn.el);

        const _combine = async () => {
            if (!layout) return;
            combineBtn.el.setDisabled(true);
            cancelBtn.el.setDisabled(true);
            try {
                await props.onCombine?.({
                    tree: layout.tree,
                    shape,
                    longEdge,
                    frames: frames.map(f => ({ ...f })),
                });
            } catch (err) {
                combineBtn.el.setDisabled(false);
                cancelBtn.el.setDisabled(false);
                window.MpiAlert?.('Could not combine: ' + (err?.message || err));
                return;
            }
            emit('combine', {});
            el.hide();
        };
        combineBtn.on('click', _combine);
        modal.on('confirm', _combine);

        // A picture with no known size is measured from its own preview first.
        Promise.all(items.map(it => (it.aspect > 0 ? null : new Promise((resolve) => {
            const probe = new Image();
            on(probe, 'load', () => { it.aspect = probe.naturalWidth / probe.naturalHeight || 1; resolve(); });
            on(probe, 'error', () => { it.aspect = 1; resolve(); });
            probe.src = it.src;
        })))).then(() => {
            _relayout();
            combineBtn.el.setDisabled(false);
        });

        el.destroy = () => {
            _cellUnsubs.forEach(fn => fn());
            _cellUnsubs = [];
            _unsubs.forEach(fn => fn());
            _unsubs.length = 0;
        };
    },
});
