import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { ce, qs, on } from '../../../utils/dom.js';
import { onStream } from '../../../services/eventStream.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { formatClock } from '../../../utils/elapsedTicker.js';

/**
 * MpiPhoneGallery — the project's cards on the phone (MPI-1300, Phase 2).
 *
 * Reads `GET /phone/cards` (newest first, every version) a page at a time. The newest card
 * takes the full width, the rest fall into the mockup's half / third / wide rhythm.
 * Spec: tasks/MPI-1300/research/mockups/phone.html, screen 03.
 *
 * Props: none. Instance methods (on instance.el):
 *   setProject(project) — { folderPath, name } or null; reloads.
 *   refresh()           — reload the first page (the tab came back into view).
 * Emits:
 *   'open' { cards, index, total } — a card was tapped: the cards loaded so far, which one,
 *                                    and how many the project holds under this filter.
 */

const PAGE = 40;
const FILTERS = [
    { id: 'all',   label: 'All' },
    { id: 'image', label: 'Images' },
    { id: 'video', label: 'Video' },
];
// After the full-width newest card: two halves, three thirds, a wide and a third (6 columns).
const RHYTHM = ['half', 'half', 'third', 'third', 'third', 'wide', 'third'];


export const MpiPhoneGallery = ComponentFactory.create({
    name: 'MpiPhoneGallery',
    css: ['js/components/Compounds/MpiPhoneGallery/MpiPhoneGallery.css'],

    template: () => `
        <div class="mpi-phone-gallery">
            <div class="mpi-phone-gallery__filters">
                <span class="mpi-phone-gallery__count"></span>
            </div>
            <div class="mpi-phone-gallery__scroll">
                <div class="mpi-phone-gallery__grid"></div>
                <p class="mpi-phone-gallery__empty"></p>
                <div class="mpi-phone-gallery__more"></div>
            </div>
        </div>`,

    setup: (el, _props, emit) => {
        const grid = qs('.mpi-phone-gallery__grid', el);
        const empty = qs('.mpi-phone-gallery__empty', el);
        const more = qs('.mpi-phone-gallery__more', el);
        const countEl = qs('.mpi-phone-gallery__count', el);
        const children = [];
        const unsubs = [];

        let _project = null;
        let _filter = 'all';
        let _cards = [];
        let _total = 0;
        let _load = null;

        const filterBtns = FILTERS.map((f) => {
            const host = ce('div', { className: 'mpi-phone-gallery__filter' });
            countEl.before(host);
            const btn = MpiButton.mount(ce('div'), { text: f.label, variant: 'ghost', size: 'sm', info: `Show ${f.label.toLowerCase()}` });
            host.appendChild(btn.el);
            children.push(btn);
            btn.on('click', () => { _filter = f.id; paintFilters(); load(); });
            return { ...f, btn, host };
        });
        function paintFilters() {
            for (const f of filterBtns) {
                f.btn.el.setActive(f.id === _filter);
                f.host.classList.toggle('mpi-phone-gallery__filter--active', f.id === _filter);
            }
        }
        paintFilters();

        const spinner = MpiSpinner.mount(ce('div'), { size: 'md' });
        const moreBtn = MpiButton.mount(ce('div'), { text: 'Load more', variant: 'secondary' });
        moreBtn.on('click', () => load(_cards.length));
        children.push(spinner, moreBtn);

        function tile(card, i) {
            const v = card.versions[card.selected] || card.versions[0];
            const size = i === 0 ? 'hero' : RHYTHM[(i - 1) % RHYTHM.length];
            // A card, like the desktop gallery's: a tile, not a control, so no MpiButton chrome.
            const frame = ce('div', { className: `mpi-phone-gallery__frame mpi-phone-gallery__frame--${size}`, tabIndex: 0 });
            frame.dataset.accent = card.kind === 'video' ? 'video' : card.kind === 'audio' ? 'audio' : 'vision';
            frame.setAttribute('role', 'button');
            frame.setAttribute('aria-label', card.name || 'Card');
            const src = (i === 0 ? v.thumbLg : null) || v.thumb || (v.type === 'image' ? v.url : '');
            if (src) frame.appendChild(ce('img', { src, alt: '', loading: 'lazy', decoding: 'async' }));
            if (card.kind === 'video') {
                frame.appendChild(ce('span', { className: 'mpi-phone-gallery__kind', textContent: v.duration ? `Video · ${formatClock(Math.round(v.duration) * 1000)}` : 'Video' }));
            }
            if (size === 'hero' || size === 'half') {
                const name = ce('div', { className: 'mpi-phone-gallery__name' }, [ce('b', { textContent: card.name || '' })]);
                if (card.versions.length > 1) name.appendChild(ce('span', { textContent: `v${card.selected + 1}` }));
                frame.appendChild(name);
            }
            return frame;
        }

        function render() {
            grid.replaceChildren(..._cards.map(tile));
            countEl.textContent = `${_total} card${_total === 1 ? '' : 's'}`;
            empty.textContent = !_project ? 'Open or pick a project to see its cards.'
                : _cards.length ? '' : (_filter === 'all' ? 'No cards in this project yet.' : `No ${_filter === 'image' ? 'images' : 'videos'} in this project.`);
            moreBtn.el.setLabel(`Load more (${_total - _cards.length} left)`);
            more.replaceChildren(...(_cards.length < _total ? [moreBtn.el] : []));
        }

        async function load(offset = 0) {
            if (!_project?.folderPath) { _cards = []; _total = 0; render(); return; }
            const token = {};
            _load = token;
            more.replaceChildren(spinner.el);
            try {
                const kind = _filter === 'all' ? '' : `&kind=${_filter}`;
                const url = `/phone/cards?folderPath=${encodeURIComponent(_project.folderPath)}${kind}&offset=${offset}&limit=${PAGE}`;
                const r = await (await fetch(url)).json();
                if (_load !== token) return;
                if (!r.ok) throw new Error(r.error?.message || 'no answer');
                _cards = offset ? [..._cards, ...r.cards] : r.cards;
                _total = r.total;
            } catch (err) {
                if (_load !== token) return;
                clientLogger.warn('phone', `gallery load failed: ${err.message}`);
                empty.textContent = `Could not load the cards: ${err.message}`;
                more.replaceChildren();
                return;
            }
            render();
        }

        unsubs.push(on(grid, 'click', (e) => {
            const frame = e.target.closest('.mpi-phone-gallery__frame');
            if (!frame) return;
            emit('open', { cards: _cards, index: [...grid.children].indexOf(frame), total: _total });
        }));
        // A card Cosmo made lands here too.
        unsubs.push(onStream('agent:result', (e) => {
            try { if (JSON.parse(e.data).ok && el.isConnected) load(); } catch { /* bad frame */ }
        }));

        el.setProject = (project) => { _project = project; load(); };
        el.refresh = () => load();
        el.destroy = () => {
            unsubs.forEach((u) => u());
            children.forEach((c) => c.destroy?.());
        };
    },
});
