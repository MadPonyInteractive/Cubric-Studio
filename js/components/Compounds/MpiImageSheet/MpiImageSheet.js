import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiDropdown } from '../../Primitives/MpiDropdown/MpiDropdown.js';
import { MpiRadioGroup } from '../../Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { qs, ce, on } from '../../../utils/dom.js';
import { ORIENTATION_OPTIONS, cropRatioOptions } from '../../../utils/ratios.js';
import {
    SHEET_SIZES, SHEET_MAX_ZOOM, packSheet, placeSheet, frameRect, sheetPixelSize, sheetGutter, sheetBadge,
    sheetShapeRatio, gridSheet, placeGrid, containRect,
} from '../../../utils/sheetLayout.js';

/** Auto, then the first six crop ratios of one orientation (1:1 to 9:16 or 16:9, 1:2 or 2:1). */
function _shapeOptions(orientation) {
    return [
        { label: 'Auto', value: 'auto', icon: 'image', info: 'The shape the pictures fill without padding' },
        ...cropRatioOptions(orientation).slice(0, 6),
    ];
}

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
 * @param {boolean} [numbered=false] - a stack's Create Sheet (MPI-1268): the pictures stay
 *   in the given order, each numbered top-left; no Bigger. Opens on Whole pictures. The
 *   request carries `numbered: true` so the server draws the same numbers.
 *
 * Whole pictures (MPI-1268, a toggle): nothing is cropped. An even grid at the pictures'
 * shape (`gridSheet`), in order; no framing. The request carries `whole: true`.
 * The shape is a ratio picker (portrait / landscape + ratios), sent as its label ("9:16").
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
            <div class="mpi-image-sheet__shape" id="shape"></div>
            <div class="mpi-image-sheet__controls" id="controls">
                <div class="mpi-image-sheet__hint" id="hint"></div>
            </div>
            <div class="mpi-image-sheet__actions" id="actions"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];
        let _cellUnsubs = [];
        const items = props.items || [];
        const numbered = props.numbered === true;
        if (numbered) qs('.mpi-image-sheet__title', el).textContent = 'Create a numbered sheet';
        const frames = items.map(() => ({ zoom: 1, cx: 0.5, cy: 0.5 }));
        const weights = items.map(() => 1);
        let shape = 'auto';
        let orientation = 'landscape';
        let whole = numbered;
        let longEdge = SHEET_SIZES[0];
        let layout = null;   // { tree, r } or, whole, { grid, r }

        const modal = MpiModal.mount(document.createElement('div'), { width: 'min(960px, 94vw)' });
        modal.el.appendChild(el);
        el.show = () => modal.el.show();
        el.hide = () => { modal.el.hide(); el.destroy(); };

        const preview = qs('#preview', el);
        const stage = qs('#stage', el);
        const sizeReadout = qs('#size-readout', el);

        // ── Controls ────────────────────────────────────────────────────────
        const shapeSlot = qs('#shape', el);
        const orientRadio = MpiRadioGroup.mount(document.createElement('div'), {
            options: ORIENTATION_OPTIONS, value: orientation, name: 'sheet-orientation', iconOnly: true,
        });
        let ratioRadio = null;
        const _mountRatios = () => {
            ratioRadio?.destroy?.();
            ratioRadio?.el.remove();
            ratioRadio = MpiRadioGroup.mount(document.createElement('div'), {
                options: _shapeOptions(orientation), value: shape, name: 'sheet-ratio', labelPosition: 'top', size: 'sm',
            });
            ratioRadio.on('select', ({ value }) => { shape = value; _relayout(); });
            shapeSlot.append(ratioRadio.el);
        };
        orientRadio.on('select', ({ value }) => {
            // The two lists are parallel (3:4 <-> 4:3), so a flip transposes the shape.
            const idx = _shapeOptions(orientation).findIndex(o => o.value === shape);
            orientation = value;
            shape = _shapeOptions(orientation)[Math.max(0, idx)].value;
            _mountRatios();
            _relayout();
        });
        shapeSlot.append(orientRadio.el);
        _mountRatios();
        _unsubs.push(() => { orientRadio.destroy?.(); ratioRadio?.destroy?.(); });

        const sizeDd = MpiDropdown.mount(document.createElement('div'), {
            options: SHEET_SIZES.map(s => ({ label: `${s / 1024}K`, value: String(s) })),
            value: String(longEdge),
            direction: 'up',
            info: 'The sheet\'s long edge in pixels',
        });
        sizeDd.on('change', ({ value }) => { longEdge = Number(value); _readout(); });
        const wholeBtn = MpiButton.mount(document.createElement('div'), {
            icon: 'fullscreen', label: 'Whole pictures', size: 'sm', toggleable: true, active: whole,
            info: 'Show every picture whole, in an even grid. Off: fill the sheet and crop to fit',
        });
        wholeBtn.on('toggle', ({ active }) => { whole = active; _relayout(); });
        const hint = qs('#hint', el);
        const controls = qs('#controls', el);
        controls.prepend(sizeDd.el, wholeBtn.el);
        _unsubs.push(() => wholeBtn.el.destroy?.());

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
            preview.style.setProperty('--sheet-w', `${w}px`);
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
            const gut = sheetGutter(width, height);
            // Whole: each cell IS the picture's own rect inside its grid slot, as the server draws it.
            const cells = whole
                ? placeGrid(layout.grid, items.length, width, height, gut).map((c, i) => containRect(aspects[i], c))
                : placeSheet(layout.tree, aspects, width, height, gut);
            hint.textContent = whole ? 'Every picture whole, in order.' : 'Drag a picture to frame it. Scroll to zoom.';
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
                const cell = ce('div', { className: 'mpi-image-sheet__cell' }, [img, ...(numbered || whole ? [] : [bigger.el])]);
                Object.assign(cell.style, {
                    left: `${100 * c.x / width}%`, top: `${100 * c.y / height}%`,
                    width: `${100 * c.w / width}%`, height: `${100 * c.h / height}%`,
                });
                if (numbered) {
                    // The server's badge, as % of this cell, so the preview matches the card.
                    const b = sheetBadge(c, i + 1);
                    const badge = ce('div', { className: 'mpi-image-sheet__number', textContent: String(i + 1) });
                    Object.assign(badge.style, {
                        left: `${100 * (b.x - c.x) / c.w}%`, top: `${100 * (b.y - c.y) / c.h}%`,
                        width: `${100 * b.w / c.w}%`, height: `${100 * b.h / c.h}%`,
                        fontSize: `calc(${b.font / width} * var(--sheet-w))`,
                    });
                    cell.append(badge);
                }
                _cellUnsubs.push(() => bigger.el.destroy?.());
                preview.append(cell);
                if (whole) {
                    Object.assign(img.style, { left: '0', top: '0', width: '100%', height: '100%' });
                    cell.classList.add('mpi-image-sheet__cell--whole');
                    return;
                }
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
            });
            _fitPreview();
            _readout();
        };

        const _relayout = () => {
            const fixed = sheetShapeRatio(shape) || null;
            const aspects = items.map(it => it.aspect);
            layout = whole ? gridSheet(aspects, { shape: fixed })
                : packSheet(aspects, { weights, shape: fixed, ordered: numbered });
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
                    ...(whole ? { whole: true } : { tree: layout.tree, frames: frames.map(f => ({ ...f })) }),
                    shape,
                    longEdge,
                    ...(numbered ? { numbered: true } : {}),
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
