import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { qs } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { isGalleryFiltered, describeGalleryFilter } from '../../../utils/galleryFilter.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { mountFilterPanel, currentListedKinds } from './filterPanel.js';

/**
 * MpiGalleryToolbar — the gallery's view controls, in the project bar (MPI-749).
 *
 * Layout:  [grid] size ━━●  [vol] volume ━━●  │  FILTER•  ARCHIVE  INFO
 *
 * Replaced the grid's second toolbar row. Lives in `MpiProjectName`'s toolbar slot,
 * mounted and destroyed by js/shell/navigation.js (gallery page only). A Compound, so it
 * is built from Primitives only and talks to MpiGalleryGrid ONLY through state — which is
 * why neither the grid nor the project bar imports it (the tier rule).
 *
 * State: `gallerySizeLevel`, `galleryVolume`, `gallerySort`, `galleryShowInfo` (read +
 * write); `currentProject` (read — which kind rows the FILTER panel lists).
 *
 * Props: none.
 *
 * Instance methods (on instance.el):
 *   destroy() — drops the state listener and closes the filter panel.
 *
 * Emits: nothing.
 */
export const MpiGalleryToolbar = ComponentFactory.create({
    name: 'MpiGalleryToolbar',
    css: ['js/components/Compounds/MpiGalleryToolbar/MpiGalleryToolbar.css'],

    template: () => `
        <div class="mpi-gallery-toolbar">
            <span class="mpi-gallery-toolbar__icon">${renderIcon('grid', 'sm')}</span>
            <div class="mpi-gallery-toolbar__slider mpi-gallery-toolbar__slider--size"></div>
            <span class="mpi-gallery-toolbar__icon mpi-gallery-toolbar__volume-icon"></span>
            <div class="mpi-gallery-toolbar__slider mpi-gallery-toolbar__slider--volume"></div>
            <span class="mpi-gallery-toolbar__divider" aria-hidden="true"></span>
            <div class="mpi-gallery-toolbar__filter-slot"></div>
            <div class="mpi-gallery-toolbar__archive-slot"></div>
            <div class="mpi-gallery-toolbar__info-slot"></div>
        </div>
    `,

    setup: (el) => {
        const _unsubs = [];

        // ── Card size ───────────────────────────────────────────────────────────
        const sizeSlider = MpiProgressBar.mount(qs('.mpi-gallery-toolbar__slider--size', el), {
            min: 1, max: 4, step: 1, value: state.gallerySizeLevel,
            interactive: true,
            wheel: true,
            handle: true,
            info: 'Size: {value}',
        });
        sizeSlider.on('input', ({ value }) => { state.gallerySizeLevel = value; });

        // ── Playback volume — 0 IS the mute (docs/gallery.md § Hover audio) ─────
        const volumeIcon = qs('.mpi-gallery-toolbar__volume-icon', el);
        const _paintVolumeIcon = () => {
            volumeIcon.innerHTML = renderIcon(state.galleryVolume === 0 ? 'volumeOff' : 'volumeHigh', 'sm');
        };
        _paintVolumeIcon();

        const volumeSlider = MpiProgressBar.mount(qs('.mpi-gallery-toolbar__slider--volume', el), {
            min: 0, max: 100, step: 5, value: Math.round(state.galleryVolume * 100),
            interactive: true,
            wheel: true,
            handle: true,
            info: 'Volume: {value}%',
        });
        volumeSlider.on('input', ({ value }) => { state.galleryVolume = value / 100; });

        // ── FILTER + its panel ──────────────────────────────────────────────────
        // The heat dot is the header's own "active = heat dot" rule (DESIGN.md § Tags):
        // filters behind a button must never read as missing assets. Oldest hides
        // nothing, so it never lights it (isGalleryFiltered).
        const filterBtn = MpiButton.mount(qs('.mpi-gallery-toolbar__filter-slot', el), {
            icon: 'filter', label: 'Filter', size: 'sm', variant: 'ghost',
            extraClasses: 'mpi-gallery-toolbar__filter',
        });
        filterBtn.el.setAttribute('aria-haspopup', 'true');
        filterBtn.el.setAttribute('aria-expanded', 'false');

        const panel = mountFilterPanel(filterBtn.el, {
            onOpenChange: (open) => {
                filterBtn.el.setAttribute('aria-expanded', String(open));
                filterBtn.el.classList.toggle('mpi-gallery-toolbar__filter--open', open);
            },
        });

        filterBtn.on('click', ({ originalEvent }) => {
            if (panel.isOpen()) { panel.close(); return; }
            // Enter/Space fire a click with detail 0 — a keyboard open moves focus in.
            panel.open({ focusFirst: originalEvent?.detail === 0 });
        });

        const _syncFilter = () => {
            const sort = state.gallerySort;
            const filtered = isGalleryFiltered(sort);
            filterBtn.el.classList.toggle('mpi-gallery-toolbar__filter--filtered', filtered);
            filterBtn.el.setAttribute('data-info', filtered
                ? `Filtered: ${describeGalleryFilter(sort, currentListedKinds(sort))}`
                : 'Filter and sort');
        };
        _syncFilter();

        // ── Archive scope toggle ────────────────────────────────────────────────
        // A SCOPE, not a filter (MPI-678): it empties the grid, so it stays its own
        // loud toggle rather than a row in the panel.
        const _isArchived = () => state.gallerySort.scope === 'archived';
        const _archiveTip = (on) => on
            ? 'Showing the archive — back to the gallery'
            : 'Show archived cards';
        const archiveBtn = MpiButton.mount(qs('.mpi-gallery-toolbar__archive-slot', el), {
            icon: 'archive', size: 'sm', variant: 'ghost', toggleable: true,
            active: _isArchived(), info: _archiveTip(_isArchived()),
            extraClasses: 'mpi-gallery-toolbar__archive',
        });
        archiveBtn.on('click', () => {
            state.gallerySort = {
                ...state.gallerySort,
                scope: _isArchived() ? 'active' : 'archived',
            };
        });

        // ── Info toggle ─────────────────────────────────────────────────────────
        const _infoTip = (on) => on
            ? 'Hide card info — mouse over shows it (I)'
            : 'Show card info always — mouse over hides it (I)';
        const infoBtn = MpiButton.mount(qs('.mpi-gallery-toolbar__info-slot', el), {
            icon: 'info', size: 'sm', variant: 'ghost', toggleable: true,
            active: state.galleryShowInfo, info: _infoTip(state.galleryShowInfo),
        });
        infoBtn.on('click', () => { state.galleryShowInfo = !state.galleryShowInfo; });

        // ── Reflect state (hotkeys, SHOW ALL and the panel write it too) ────────
        _unsubs.push(Events.on('state:changed', ({ key }) => {
            if (key === 'gallerySizeLevel') {
                sizeSlider.el.setValueQuiet(state.gallerySizeLevel);
            } else if (key === 'galleryVolume') {
                volumeSlider.el.setValueQuiet(Math.round(state.galleryVolume * 100));
                _paintVolumeIcon();
            } else if (key === 'galleryShowInfo') {
                infoBtn.el.setActive(state.galleryShowInfo);
                infoBtn.el.setAttribute('data-info', _infoTip(state.galleryShowInfo));
            } else if (key === 'gallerySort') {
                archiveBtn.el.setActive(_isArchived());
                archiveBtn.el.setAttribute('data-info', _archiveTip(_isArchived()));
                _syncFilter();
            } else if (key === 'currentProject') {
                _syncFilter();
            }
        }));

        el.destroy = () => {
            _unsubs.forEach(fn => fn());
            panel.destroy();
        };
    }
});
