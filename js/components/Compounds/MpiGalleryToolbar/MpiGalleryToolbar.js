import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { qs } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { mountGalleryFilter } from '../../galleryFilterPanel.js';

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
 * FILTER and its panel are js/components/galleryFilterPanel.js, shared with MpiMediaPicker
 * (MPI-785); here they run on `state.gallerySort`.
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
    css: [
        'js/components/Compounds/MpiGalleryToolbar/MpiGalleryToolbar.css',
        'js/components/galleryFilterPanel.css',
    ],

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

        // ── FILTER + its panel (shared with MpiMediaPicker) ─────────────────────
        const filter = mountGalleryFilter(qs('.mpi-gallery-toolbar__filter-slot', el));

        // ── Archive scope toggle ────────────────────────────────────────────────
        // A SCOPE, not a filter (MPI-678): it empties the grid, so it stays its own
        // loud toggle rather than a row in the panel.
        const _isArchived = () => state.gallerySort.scope === 'archived';
        const _archiveTip = (on) => on
            ? 'Showing the archive — back to the gallery'
            : 'Show archived cards';
        // NOT `ghost` (MPI-736): a ghost icon button's toggled state is colour ALONE, and
        // since --accent-heat became the shared cream that colour sits a hair off --ink-2 —
        // on and off read the same. `secondary` is the app's ordinary toggle: bordered at
        // rest, filled with the accent and black-iconed when on.
        const archiveBtn = MpiButton.mount(qs('.mpi-gallery-toolbar__archive-slot', el), {
            icon: 'archive', size: 'sm', toggleable: true,
            active: _isArchived(), info: _archiveTip(_isArchived()),
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
            icon: 'info', size: 'sm', toggleable: true,
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
                filter.refresh();
            } else if (key === 'currentProject') {
                filter.refresh();
            }
        }));

        el.destroy = () => {
            _unsubs.forEach(fn => fn());
            filter.destroy();
        };
    }
});
