import { ComponentFactory } from '../../factory.js';
import { ce, on } from '../../../utils/dom.js';

/**
 * MpiGpuTileGrid — the GPU tile grid inside MpiGpuPicker (Primitive, MPI-894 1c).
 *
 * Compact text cards after RunPod's deploy page, so not MpiTileSheet (which is built
 * around a 4:5 / 16:9 thumbnail). State-DUMB like MpiTileSheet: the consumer hands over
 * display-ready values and owns every rule about which cards show and why.
 *
 * Usage:
 *   const grid = MpiGpuTileGrid.mount(document.createElement('div'));
 *   host.appendChild(grid.el);
 *   grid.el.setItems(items);
 *   grid.on('select', ({ id }) => ...);
 *
 * Item shape:
 * @typedef {Object} GpuTileItem
 * @property {string}  id
 * @property {string}  name
 * @property {string}  [price]     - e.g. "$0.89/hr"
 * @property {string}  [specs]     - e.g. "32 GB VRAM · max 8"
 * @property {number}  [bars]      - stock meter 0-3; omit for no meter
 * @property {number}  [speed]     - speed bar fill 0-1; omit for no bar
 * @property {string}  [speedText] - label beside the speed bar
 * @property {string}  [state]     - bottom line, e.g. "High stock"
 * @property {boolean} [selected]
 * @property {boolean} [available] - in stock: green edge, lifted ground
 * @property {boolean} [out]       - out of stock: dimmed
 *
 * Instance methods (on instance.el):
 *   setItems(items) — full rebuild
 *   getTile(id)     — the tile element, or null
 *
 * Emits:
 *   'select' { id } — tile clicked
 */
export const MpiGpuTileGrid = ComponentFactory.create({
    name: 'MpiGpuTileGrid',
    css: ['js/components/Primitives/MpiGpuTileGrid/MpiGpuTileGrid.css'],

    template: () => `<div class="mpi-gpu-tiles"></div>`,

    setup: (el, props, emit) => {
        const _unsubs = [];

        function _tile(item) {
            const tile = ce('button', {
                type: 'button',
                className: 'mpi-gpu-tiles__tile'
                    + (item.selected ? ' mpi-gpu-tiles__tile--selected' : '')
                    + (item.available ? ' mpi-gpu-tiles__tile--available' : '')
                    + (item.out ? ' mpi-gpu-tiles__tile--out' : ''),
            });
            tile.dataset.id = item.id;

            const meter = Number.isInteger(item.bars)
                ? ce('span', { className: `mpi-gpu-tiles__stock mpi-gpu-tiles__stock--${item.bars}` },
                    [ce('i'), ce('i'), ce('i')])
                : null;
            tile.append(ce('span', { className: 'mpi-gpu-tiles__top' }, [
                ce('span', { className: 'mpi-gpu-tiles__name', textContent: item.name }),
                meter,
            ]));
            if (item.price) tile.append(ce('span', { className: 'mpi-gpu-tiles__price', textContent: item.price }));
            if (item.specs) tile.append(ce('span', { className: 'mpi-gpu-tiles__specs', textContent: item.specs }));
            if (Number.isFinite(item.speed)) {
                const bar = ce('span', { className: 'mpi-gpu-tiles__speed-bar' }, ce('span'));
                bar.style.setProperty('--fill', String(item.speed));
                tile.append(ce('span', { className: 'mpi-gpu-tiles__speed' },
                    [bar, ce('span', { textContent: item.speedText || '' })]));
            }
            if (item.state) tile.append(ce('span', { className: 'mpi-gpu-tiles__state', textContent: item.state }));
            return tile;
        }

        el.setItems = (items = []) => {
            el.innerHTML = '';
            items.forEach(item => el.appendChild(_tile(item)));
        };

        el.getTile = (id) => [...el.children].find(t => t.dataset.id === id) || null;

        _unsubs.push(on(el, 'click', (e) => {
            const tile = e.target.closest?.('.mpi-gpu-tiles__tile');
            if (tile) emit('select', { id: tile.dataset.id });
        }));

        el.destroy = () => _unsubs.forEach(fn => fn?.());

        void props;
    },
});
