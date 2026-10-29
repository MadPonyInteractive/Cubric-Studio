import { ComponentFactory } from '../../factory.js';
import { MpiOverlay } from '../../Primitives/MpiOverlay/MpiOverlay.js';
import { MpiTileSheet } from '../../Primitives/MpiTileSheet/MpiTileSheet.js';
import { MpiFilterBar } from '../../Primitives/MpiFilterBar/MpiFilterBar.js';
import { ce, qs, on } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { modelQuote } from '../../../data/modelConstants/deepinfraPricing.js';
import { ASSET_KINDS } from '../../../utils/assetKinds.js';
import { Storage } from '../../../core/storage.js';
import { Events } from '../../../events.js';

const _mediaLabel = (media) => ASSET_KINDS.find(k => k.kind === media)?.singular || media;

/**
 * MpiModelPicker — the model overlay (MPI-356).
 *
 * Deliberately renders the SAME tile as the Model Library (MpiTileSheet): a
 * different card per surface is exactly the inconsistency this card removes.
 * Only three things differ — the list is whatever the caller passes (installed,
 * already filtered by workspace), a click SELECTS and closes instead of opening
 * a detail drawer, and the tile's state row carries a LoRA & Upscale button.
 *
 * Owns no model logic. The Block that opens it passes its own list and applies
 * the choice, exactly as it does for the op strip's `workspace:set-operation` —
 * one validated owner per workspace, no second source of truth.
 *
 * Usage:
 *   const picker = MpiModelPicker.mount(document.createElement('div'));
 *   picker.el.open({ models: installedAllModels, modelId: activeModelId });
 *   picker.on('select',   ({ model }) => applyModel(model));   // already closed
 *   picker.on('settings', ({ model }) => _settingsOverlay.el.open({ modelId: model.id }));
 *
 * Instance methods (on instance.el):
 *   open({ models, modelId })  — render + show
 *   close()                    — hide
 *
 * Emits:
 *   'select'   { model } — tile clicked (overlay closes itself first)
 *   'settings' { model } — LoRA & Upscale clicked; the opener owns MpiModelSettings
 *                          (a Compound may not import a Compound)
 */
export const MpiModelPicker = ComponentFactory.create({
    name: 'MpiModelPicker',
    css: ['js/components/Compounds/MpiModelPicker/MpiModelPicker.css'],

    template: () => `
        <div class="mpi-model-picker">
            <div class="mpi-model-picker__head">
                <h1 class="mpi-model-picker__title">Model</h1>
                <p class="mpi-model-picker__sub" id="picker-sub"></p>
            </div>
            <div class="mpi-model-picker__body" id="picker-body"></div>
        </div>`,

    setup: (el, props, emit) => {
        const TIER_WORD = { low: 'Low', balanced: 'Balanced', high: 'High' };
        const bodySlot = qs('#picker-body', el);
        const subEl    = qs('#picker-sub', el);

        const _unsubs = [];
        let _sheets = [];
        let _models = [];

        const overlay = MpiOverlay.mount(document.createElement('div'), {
            closable: true, mountTarget: 'body',
        });
        overlay.el.appendToContainer(el);

        // ── Source filter + search (MPI-1303) ────────────────────────────────
        // The libraries' MpiFilterBar row. Each Block mounts its own picker, so a
        // closure would forget the choice on the next workspace — Source lives in
        // Storage instead and is read back on every open. Search is per-open: a
        // stale query hiding the model you came to swap is worse than retyping it.
        // An empty group means "all", as in the libraries.
        let _source = new Set(Storage.getModelPickerSource());
        let _query = '';
        let _activeId = null;
        const filterBar = MpiFilterBar.mount(ce('div'), {
            groups: [
                { key: 'source', label: 'Source', options: [{ value: 'local', label: 'Local' }, { value: 'cloud', label: 'Cloud' }] },
            ],
            searchPlaceholder: 'Search models…',
        });
        filterBar.on('change', ({ active, query }) => {
            _source = active.source;
            _query = query;
            Storage.setModelPickerSource(_source);
            _render(_activeId);
        });
        qs('.mpi-model-picker__head', el).appendChild(filterBar.el);

        const _passes = (m) =>
            (_source.size === 0 || _source.has(m.provider ? 'cloud' : 'local'))
            && (!_query || `${m.name} ${m.dropdownMeta || ''}`.toLowerCase().includes(_query));

        function _tileItem(model, activeId) {
            // A cloud model (MPI-865) has no weights, so two of the tile's parts describe
            // something it does not have. The size tier is a WEIGHT class, and defaulting
            // it made every cloud tile read `CLOUD · BALANCED`; `dropdownMeta` alone is
            // true. LoRA & Upscale is the other: both live in local `loras/` and
            // `upscale_models/` folders a DeepInfra endpoint cannot reach, and no cloud
            // ModelDef declares either — so the control is dropped rather than disabled,
            // which would keep advertising a setting that is never coming.
            //
            // Where the settings control would be, a cloud tile carries its price (MPI-914)
            // — the same chip, figure and unit as its Model Library tile, from the same
            // `modelQuote`, so choosing a model tells you what a run costs before you run it.
            // The meta drops the library's `CLOUD ·` prefix: here the corner badge and the
            // chip's ☁ already say it, and without it `PER 5S AT 1080P` fits one line, so
            // the clip tiles stay the height of their row (Fabio, 2026-09-25).
            const isCloud = !!model.provider;
            const tier = model.sizeTier || 'balanced';
            const quote = isCloud ? modelQuote(model) : null;
            return {
                id: model.id,
                name: model.name,
                // An audio model (MPI-1012) shows its 4:5 still, like an image model.
                media: model.mediaType,
                preview: model.mediaType === 'video' ? model.video : model.image,
                meta: isCloud
                    ? quote.unit
                    : `${model.dropdownMeta || ''}${model.dropdownMeta ? ' · ' : ''}${TIER_WORD[tier] || tier}`,
                showMediaBadge: true,
                featured: !!model.featured,
                deprecated: !!model.deprecated,
                cloud: isCloud,
                selected: model.id === activeId,
                // A <button> may not nest inside the tile <button>, so this is a
                // span; the capture-phase handler below stops it from reaching the
                // tile's own click (which would select the model and close).
                state: isCloud
                    ? `<span class="mpi-tile__chip mpi-tile__chip--paid${
                        model.mediaType === 'video' ? ' mpi-tile__chip--paid-video' : ''
                    }">${quote.text || 'price unknown'}</span>`
                    : model.showSettings === false ? '' :
                    `<span class="mpi-model-picker__lora" role="button">${renderIcon('settings', 'sm')}LoRA &amp; Upscale</span>`,
                source: model,
            };
        }

        function _mediaBlock(list, media, activeId) {
            // Featured first, stable — the Model Library's own order (MPI-1245).
            const items = list.filter(m => m.mediaType === media)
                .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
            if (!items.length) return;

            const head = ce('div', {
                className: `mpi-model-picker__media-head mpi-model-picker__media-head--${media}`,
            });
            head.innerHTML = `${renderIcon(media, 'sm')}<span>${_mediaLabel(media)}</span><span class="mpi-model-picker__media-head-n">${items.length}</span>`;
            bodySlot.appendChild(head);

            const sheet = MpiTileSheet.mount(ce('div'), { items: items.map(m => _tileItem(m, activeId)) });
            sheet.on('select', ({ item }) => {
                overlay.el.hide();
                emit('select', { model: item.source });
            });
            // Capture phase: the tile's own click listener sits on the inner tile
            // element, so a bubbling handler here would fire AFTER it and the
            // overlay would already be closing on the wrong intent.
            _unsubs.push(on(sheet.el, 'click', (e) => {
                const btn = e.target.closest?.('.mpi-model-picker__lora');
                if (!btn) return;
                e.stopPropagation();
                e.preventDefault();
                const tile = btn.closest('.mpi-tile');
                const item = items.find(m => sheet.el.getTile(m.id) === tile);
                if (item) emit('settings', { model: item });
            }, true));

            _sheets.push(sheet);
            bodySlot.appendChild(sheet.el);
        }

        function _render(activeId) {
            _sheets.forEach(s => s.el.destroy?.());
            _sheets = [];
            bodySlot.innerHTML = '';
            // MPI-853 took cloud models out of both library counts, because nothing about
            // them is installed or installable. The same fact is true one surface over:
            // "24 installed" was counting sixteen models that were never downloaded. With
            // no key saved there are no cloud models and the line is unchanged.
            const cloudN = _models.filter(m => m.provider).length;
            subEl.textContent = cloudN
                ? `${_models.length - cloudN} installed · ${cloudN} cloud`
                : `${_models.length} installed`;
            const shown = _models.filter(_passes);
            if (!shown.length) {
                bodySlot.appendChild(ce('p', {
                    className: 'mpi-model-picker__empty',
                    textContent: 'No model matches these filters.',
                }));
                return;
            }
            _mediaBlock(shown, 'image', activeId);
            _mediaBlock(shown, 'video', activeId);
            _mediaBlock(shown, 'audio', activeId);
        }

        el.open = ({ models = [], modelId = null } = {}) => {
            _models = models;
            _activeId = modelId;
            // Re-read: another workspace's picker may have changed it since.
            _source = new Set(Storage.getModelPickerSource());
            filterBar.el.setActive('source', _source);
            _query = '';
            filterBar.el.setQuery('');
            _render(modelId);
            overlay.el.show();
            // Centre the active tile — AFTER show(), the overlay is only in the DOM
            // from there (a detached body measures 0 and the scroll silently no-ops).
            // The fade-in's translateY shifts tile and scroller together, so the
            // scroll delta is unaffected; no rAF/timeout needed. Instant, not smooth:
            // the list must already BE in position when the overlay first paints.
            // No selection / model filtered out of the list → getTile() is null → no-op.
            _sheets.map(s => s.el.getTile(modelId)).find(Boolean)
                ?.scrollIntoView({ block: 'center', inline: 'nearest' });
        };

        el.close = () => overlay.el.hide();

        el.destroy = () => {
            _unsubs.forEach(fn => fn?.());
            _sheets.forEach(s => s.el.destroy?.());
            _sheets = [];
            filterBar.el.destroy?.();
            overlay.el.destroy?.();
            el.remove();
        };

        void props;
    },
});

/**
 * The opener's side, shared by the Gallery and History Blocks (AUDIT D9): mount the picker,
 * open it on `ui:open-model-picker` (the prompt box's model button and the radial) with the
 * Block's own list, route LoRA & Upscale to the Block's settings overlay, and hand a CHANGED
 * pick to `onSelect`. The Block keeps the model logic.
 * @param {{ models: () => Object[], activeModelId: () => string, settingsOverlay: Object, onSelect: (model: Object) => void }} opts
 * @returns {{ picker: Object, off: Function }} `off` drops the open listener
 */
export function mountBlockModelPicker({ models, activeModelId, settingsOverlay, onSelect }) {
    const picker = MpiModelPicker.mount(document.createElement('div'));
    const off = Events.on('ui:open-model-picker', () => {
        picker.el.open({ models: models(), modelId: activeModelId() });
    });
    picker.on('settings', ({ model }) => settingsOverlay.el.open({ modelId: model.id }));
    picker.on('select', ({ model }) => {
        if (model && model.id !== activeModelId()) onSelect(model);
    });
    return { picker, off };
}
