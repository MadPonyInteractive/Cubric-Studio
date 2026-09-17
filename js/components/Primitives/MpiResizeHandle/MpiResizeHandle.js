import { ComponentFactory } from '../../factory.js';
import { on } from '../../../utils/dom.js';

/**
 * MpiResizeHandle — a drag edge that reports the pointer while it is held (MPI-797).
 *
 * It sizes nothing itself: the owner reads `x`/`y` (client coordinates) and sets its own
 * width or height, so one handle serves any panel. Pointer capture keeps the drag alive
 * when the pointer outruns the edge.
 *
 * Props:
 * @param {'x'|'y'} [axis='x'] - 'x' drags left/right (a vertical edge), 'y' up/down
 *
 * Emits: 'resize-start' | 'resize' | 'resize-end'  — `{ x, y }`
 */
export const MpiResizeHandle = ComponentFactory.create({
    name: 'MpiResizeHandle',
    css: ['js/components/Primitives/MpiResizeHandle/MpiResizeHandle.css'],

    template: (props) => {
        const axis = props.axis === 'y' ? 'y' : 'x';
        return `<div class="mpi-resize-handle mpi-resize-handle--${axis}" role="separator"
                     aria-orientation="${axis === 'x' ? 'vertical' : 'horizontal'}"></div>`;
    },

    setup: (el, props, emit) => {
        const at = (e) => ({ x: e.clientX, y: e.clientY });
        const unsubs = [
            on(el, 'pointerdown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault(); // no text selection while dragging
                el.setPointerCapture(e.pointerId);
                el.classList.add('mpi-resize-handle--active');
                emit('resize-start', at(e));
            }),
            on(el, 'pointermove', (e) => {
                if (el.hasPointerCapture(e.pointerId)) emit('resize', at(e));
            }),
            // Capture ends on pointerup AND when the system takes it (a window blur).
            on(el, 'lostpointercapture', (e) => {
                el.classList.remove('mpi-resize-handle--active');
                emit('resize-end', at(e));
            }),
        ];
        el.destroy = () => unsubs.forEach((off) => off());
    },
});
