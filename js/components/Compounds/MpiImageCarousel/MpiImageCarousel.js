import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { on, qs } from '../../../utils/dom.js';

/**
 * MpiImageCarousel — one image at a time, with arrows and a "2 / 5" count (Compound, MPI-1115)
 *
 * Several images side by side shrink to thumbnails; this shows each at full
 * width. With `expandable`, clicking the image opens it big in a modal holding a
 * second carousel at the same position, with its own arrows and a close X.
 * One image = no arrows and no count.
 *
 * Usage:
 *   const c = MpiImageCarousel.mount(host, { images: ['a.png', 'b.png'], expandable: true });
 *
 * Props:
 * @param {string[]} images        - Image URLs, shown in order.
 * @param {number}   [index=0]     - The image to start on.
 * @param {boolean}  [expandable]  - Click the image to open it big in a modal.
 * @param {boolean}  [large]       - The big variant the modal uses (fills the viewport height).
 *
 * Instance methods (on instance.el):
 *   destroy() — removes listeners and closes an open modal.
 */
export const MpiImageCarousel = ComponentFactory.create({
    name: 'MpiImageCarousel',
    css: ['js/components/Compounds/MpiImageCarousel/MpiImageCarousel.css'],

    template: (props) => `
        <div class="mpi-image-carousel${props.large ? ' mpi-image-carousel--large' : ''}">
            <div class="mpi-image-carousel__stage">
                <img class="mpi-image-carousel__image" alt="">
            </div>
            <span class="mpi-image-carousel__count"></span>
        </div>`,

    setup: (el, props) => {
        const images = props.images || [];
        const stage = qs('.mpi-image-carousel__stage', el);
        const img = qs('.mpi-image-carousel__image', el);
        const count = qs('.mpi-image-carousel__count', el);
        const many = images.length > 1;
        let index = Math.min(Math.max(props.index || 0, 0), Math.max(images.length - 1, 0));
        let modal = null;
        let big = null;
        const _unsubs = [];

        const show = (i) => {
            index = (i + images.length) % images.length;
            img.src = images[index];
            count.textContent = `${index + 1} / ${images.length}`;
        };

        count.hidden = !many;
        if (many) {
            const prev = mountButton({ icon: 'chevronLeft', size: 'sm', variant: 'secondary', info: 'Previous', extraClasses: 'mpi-image-carousel__arrow mpi-image-carousel__arrow--prev' });
            const next = mountButton({ icon: 'chevronRight', size: 'sm', variant: 'secondary', info: 'Next', extraClasses: 'mpi-image-carousel__arrow mpi-image-carousel__arrow--next' });
            stage.append(prev, next);
            _unsubs.push(on(prev, 'click', (e) => { e.stopPropagation(); show(index - 1); }));
            _unsubs.push(on(next, 'click', (e) => { e.stopPropagation(); show(index + 1); }));
        }

        const closeBig = () => {
            big?.destroy();
            big = null;
            modal?.el.hide();
            modal = null;
        };

        if (props.expandable) {
            el.classList.add('mpi-image-carousel--expandable');
            _unsubs.push(on(img, 'click', () => {
                modal = MpiModal.mount(document.createElement('div'), { width: 'min(1600px, 94vw)' });
                const box = document.createElement('div');
                box.className = 'mpi-image-carousel__modal';
                modal.el.appendChild(box);
                big = MpiImageCarousel.mount(box.appendChild(document.createElement('div')), { images, index, large: true });
                const close = mountButton({ icon: 'close', size: 'sm', variant: 'ghost', info: 'Close', extraClasses: 'mpi-image-carousel__close' });
                box.appendChild(close);
                on(close, 'click', closeBig);
                modal.el.show();
            }));
        }

        if (images.length) show(index);

        el.destroy = () => {
            _unsubs.forEach((fn) => fn());
            closeBig();
        };
    },
});
