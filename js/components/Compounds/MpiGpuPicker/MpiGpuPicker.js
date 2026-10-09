import { ComponentFactory } from '../../factory.js';
import { MpiOverlay } from '../../Primitives/MpiOverlay/MpiOverlay.js';
import { MpiCheckbox } from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiGpuTileGrid } from '../../Primitives/MpiGpuTileGrid/MpiGpuTileGrid.js';
import { qs } from '../../../utils/dom.js';
import {
    VIDEO_MIN_VRAM_GB, gpuGenSecs, stockBars, visibleGpuCards,
} from '../../../data/runpodGpuSpecs.js';

const STOCK_WORD = ['Out of stock', 'Low stock', 'Medium stock', 'High stock'];

/**
 * MpiGpuPicker — the RunPod GPU overlay (MPI-894 1c), after RunPod's own deploy page.
 *
 * One tile per card: name, $/hr, VRAM, max GPUs per Pod, RunPod's three-bar stock
 * meter, and a Gen speed bar from measured image times (RunPod's, plus ours, MPI-1054). RunPod's
 * "Available | All" tabs are our Auto-retry switch (on = every card, Connect waits for an
 * out-of-stock one), and a Video switch
 * keeps the cards with more than 24 GB VRAM. The system-RAM floor lives here too: it is
 * a Pod requirement, not a tile filter, because RunPod gives no per-card RAM.
 *
 * Owns no RunPod logic. The opener (MpiRunpodSettings) builds the cards from its
 * availability snapshot and applies every choice — the same split as MpiModelPicker.
 *
 * Usage:
 *   const picker = MpiGpuPicker.mount(document.createElement('div'));
 *   picker.el.open({ cards, selectedId, autoRetry, minRamGb, showMinRam, scope });
 *   picker.el.setCards(cards, ok);                    // fresh stock; ok=false: the check failed
 *   picker.on('select',     ({ id }) => ...);         // already closed
 *   picker.on('refresh',    () => ...);               // re-read stock, then setCards
 *   picker.on('auto-retry', ({ on }) => ...);
 *   picker.on('min-ram',    ({ gb }) => ...);
 *
 * Card shape: { id, name, vramGb, price, stock: 'High'|'Medium'|'Low'|null, inStock,
 *               maxCount, cpu?, note? }
 */
export const MpiGpuPicker = ComponentFactory.create({
    name: 'MpiGpuPicker',
    css: ['js/components/Compounds/MpiGpuPicker/MpiGpuPicker.css'],

    template: () => `
        <div class="mpi-gpu-picker">
            <div class="mpi-gpu-picker__head">
                <h1 class="mpi-gpu-picker__title">GPU</h1>
                <div class="mpi-gpu-picker__subrow">
                    <p class="mpi-gpu-picker__sub" id="gpu-sub"></p>
                    <span class="mpi-gpu-picker__stamp" id="gpu-stamp"></span>
                </div>
                <div class="mpi-gpu-picker__controls">
                    <div class="mpi-gpu-picker__control" id="gpu-retry"></div>
                    <div class="mpi-gpu-picker__control" id="gpu-video"></div>
                    <div class="mpi-gpu-picker__ram" id="gpu-ram-row">
                        <span class="mpi-gpu-picker__ram-label">Min RAM</span>
                        <div class="mpi-gpu-picker__ram-input" id="gpu-ram"></div>
                        <span class="mpi-gpu-picker__ram-unit">GB</span>
                    </div>
                    <div class="mpi-gpu-picker__refresh" id="gpu-refresh"></div>
                </div>
                <p class="mpi-gpu-picker__note">Auto-retry: pick an out-of-stock card and Connect waits until it frees. Min RAM: every GPU Pod gets at least this much system RAM (0 = any host). Gen speed: measured seconds per image on each card (FLUX.2 Klein 9B; RunPod's Sept 2026 runs, plus ours on the cards they skipped), lower is faster; no bar = not benchmarked.</p>
            </div>
            <div class="mpi-gpu-picker__body">
                <div id="gpu-grid"></div>
                <p class="mpi-gpu-picker__empty" id="gpu-empty">No card matches. Turn on Auto-retry to wait for one that is out of stock.</p>
            </div>
        </div>`,

    setup: (el, props, emit) => {
        const emptyEl = qs('#gpu-empty', el);
        const subEl   = qs('#gpu-sub', el);
        const ramRow  = qs('#gpu-ram-row', el);
        const stampEl = qs('#gpu-stamp', el);

        let _cards = [];
        let _selectedId = null;
        let _autoRetry = false;
        let _video = false;   // ponytail: session-only; persist it if users ask

        const overlay = MpiOverlay.mount(document.createElement('div'), {
            closable: true, mountTarget: 'body',
        });
        overlay.el.appendToContainer(el);

        const retrySw = MpiCheckbox.mount(qs('#gpu-retry', el), {
            variant: 'switch', label: 'Auto-retry',
        });
        retrySw.on('change', ({ checked }) => {
            _autoRetry = checked === true;
            emit('auto-retry', { on: _autoRetry });
            _render();
        });
        const videoSw = MpiCheckbox.mount(qs('#gpu-video', el), {
            variant: 'switch', label: `Video (over ${VIDEO_MIN_VRAM_GB} GB VRAM)`,
        });
        videoSw.on('change', ({ checked }) => {
            _video = checked === true;
            _render();
        });
        const ramIn = MpiInput.mount(qs('#gpu-ram', el), {
            type: 'number', min: 0, max: 2000, step: 10, value: 0, size: 'sm',
        });
        ramIn.on('change', ({ value }) => {
            emit('min-ram', { gb: Math.max(0, Math.min(2000, Math.round(Number(value) || 0))) });
        });

        // Stock is read on open and on Refresh, never polled: RunPod's stock drifts by the
        // minute, and the stamp says how old the tiles are.
        // Same control as the Model and Flow Libraries' refresh: an icon at the row's end.
        const refreshBtn = MpiButton.mount(qs('#gpu-refresh', el), {
            icon: 'refresh', variant: 'ghost', size: 'md',
            info: 'Refresh GPU stock from RunPod',
        });
        function _checking() {
            refreshBtn.el.setDisabled(true);
            stampEl.textContent = 'checking stock…';
        }
        refreshBtn.on('click', () => {
            _checking();
            emit('refresh');
        });

        const grid = MpiGpuTileGrid.mount(qs('#gpu-grid', el));
        grid.on('select', ({ id }) => {
            overlay.el.hide();
            emit('select', { id });
        });

        function _item(card, bestSecs) {
            const selected = card.id === _selectedId;
            if (card.cpu) return { id: card.id, name: card.name, specs: card.note, selected };
            const bars = stockBars(card);
            const out = !card.inStock;
            const secs = gpuGenSecs(card.id);
            return {
                id: card.id,
                name: card.name || card.id,
                price: typeof card.price === 'number' ? `$${card.price.toFixed(2)}/hr` : 'price unknown',
                specs: `${card.vramGb} GB VRAM${card.maxCount ? ` · max ${card.maxCount}` : ''}`,
                bars,
                speed: secs != null ? bestSecs / secs : undefined,   // fastest card = full bar
                speedText: secs != null ? `${secs.toFixed(1)} s/img` : '',   // a bar alone hid close cards (MPI-1013)
                state: out ? 'Out of stock · Connect waits' : STOCK_WORD[bars],
                selected,
                available: !out,
                out,
            };
        }

        function _render() {
            // Bars scale against every card passed in, not just the visible ones, so a
            // tile's bar does not grow when a filter hides the faster cards.
            const bestSecs = Math.min(..._cards.map(c => gpuGenSecs(c.id) ?? Infinity));
            const shown = visibleGpuCards(_cards, { autoRetry: _autoRetry, video: _video, selectedId: _selectedId });
            grid.el.setItems(shown.map(c => _item(c, bestSecs)));
            emptyEl.classList.toggle('mpi-gpu-picker__empty--on', !shown.some(c => !c.cpu));
        }

        el.open = ({ cards = [], selectedId = null, autoRetry = false, minRamGb = 0,
            showMinRam = true, scope = '' } = {}) => {
            _cards = cards;
            _selectedId = selectedId;
            _autoRetry = autoRetry === true;
            retrySw.el.setChecked(_autoRetry);
            ramIn.el.setValue(Number(minRamGb) > 0 ? Number(minRamGb) : 0);
            // RunPod ignores the floor in Any region (no DC to place against).
            ramRow.classList.toggle('mpi-gpu-picker__ram--hidden', !showMinRam);
            subEl.textContent = scope;
            _checking();   // the opener reads live stock right after, then calls setCards
            _render();
            overlay.el.show();
            grid.el.getTile(_selectedId)?.scrollIntoView({ block: 'center', inline: 'nearest' });
        };

        el.setCards = (cards = [], ok = true) => {
            _cards = cards;
            refreshBtn.el.setDisabled(false);
            stampEl.textContent = ok
                ? `checked ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'stock check failed, showing the last list';
            _render();
        };

        el.close = () => overlay.el.hide();

        el.destroy = () => {
            grid.el.destroy?.();
            refreshBtn.el.destroy?.();
            retrySw.el.destroy?.();
            videoSw.el.destroy?.();
            ramIn.el.destroy?.();
            overlay.el.destroy?.();
            el.remove();
        };

        void props;
    },
});
