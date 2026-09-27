/**
 * MpiThumbStrip — generic thumbnail strip with a fixed centre marker.
 * (Phase 3b of MPI-949 — extracted from MpiFrameStrip.)
 *
 * Generic behaviour shared by the GIF frame strip (MpiFrameStrip, Organism)
 * and the future stack member strip (Phase 4): windowed rendering, fixed
 * centre marker + translateX, the full pointer grammar (click/scrub/
 * Ctrl+Shift range / press-and-hold reorder), and right-click routed through
 * Events.emit('ui:context-menu') so same-tier callers can use it.
 *
 * A Compound may only import Primitives — never another Compound or an
 * Organism (mpi/no-same-tier-component-import). Context menu items are
 * caller-supplied via the `menuItems` prop function; the shell hop already
 * registers MpiContextMenu as the global handler.
 *
 * Items shape: { key: string, thumbUrl: string, info?: string }
 *
 * Props:
 *   items          {Array}    Initial items (or pass via el.setItems).
 *   currentIndex   {number}   Initial current index (default 0).
 *   allowReorder   {boolean}  Enable press-and-hold reorder drag (default false).
 *   menuItems      {Function} (index, selectedIndices) => item[] | null
 *                             Called on right-click to build the context menu.
 *   decorateThumb  {Function} (thumbEl, index) => void
 *                             Called after state classes (is-current, is-selected,
 *                             mpi-thumb-strip__thumb--lifted) are applied so the
 *                             host can add its own classes / child elements.
 *                             Also called from repaintThumbs() for cheap updates.
 *
 * Instance API (on el):
 *   setItems(items, { currentIndex = 0 })
 *   setCurrentIndex(idx)        — move marker; no event (caller-driven)
 *   setSelection(indices)       — programmatically set the selection
 *   getSelection()              — sorted Array of selected (staged) indices
 *   repaintThumbs()             — cheap pass: re-applies state classes + calls
 *                                 decorateThumb on every visible thumb
 *   destroy()
 *
 * Emits:
 *   'thumb-select'    { index }             — click, no modifier
 *   'selection-change' { indices }          — Ctrl/Shift changed selection
 *   'scrub'           { index }             — mid-drag
 *   'scrub-end'       { index }             — pointer up after a scrub
 *   'reorder'         { from, to }          — press-and-hold drag complete
 *   'menu-select'     { key, index, selection } — context menu item picked
 */

import { ComponentFactory } from '../../factory.js';
import { qs, on } from '../../../utils/dom.js';
import { Events } from '../../../events.js';

const THUMB_W = 64;
const THUMB_GAP = 6;
const SLOT = THUMB_W + THUMB_GAP;
/** Frames rendered each side of the current index — generous but bounded. */
const VIEW_RADIUS = 40;
/** Drag threshold in px before a mousedown counts as a drag, not a click. */
const DRAG_THRESHOLD = 4;
/** Hold a thumbnail this long, without moving, to pick it up for a reorder. */
const HOLD_MS = 300;

export const MpiThumbStrip = ComponentFactory.create({
    name: 'MpiThumbStrip',
    css: ['js/components/Compounds/MpiThumbStrip/MpiThumbStrip.css'],

    template: () => `
        <div class="mpi-thumb-strip">
            <div class="mpi-thumb-strip__thumbs"></div>
            <div class="mpi-thumb-strip__marker"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];

        const thumbsEl = qs('.mpi-thumb-strip__thumbs', el);

        /** @type {Array<{key:string,thumbUrl:string,info?:string}>} */
        let _items = [];
        let _currentIndex = 0;
        /** Staged indices in the current selection. */
        const _selection = new Set();
        /** Shift-range anchor index. Same contract as MpiHistoryList / MpiFrameStrip. */
        let _anchor = 0;

        let _windowStart = 0;
        let _windowEnd = -1; // empty until first render

        // ── Windowed rendering ───────────────────────────────────────────

        function _ensureWindow(idx) {
            const pad = Math.floor(VIEW_RADIUS / 2);
            if (_windowEnd >= _windowStart && idx >= _windowStart + pad && idx <= _windowEnd - pad) return false;
            _windowStart = Math.max(0, idx - VIEW_RADIUS);
            _windowEnd = Math.min(_items.length - 1, idx + VIEW_RADIUS);
            return true;
        }

        function _renderWindow() {
            thumbsEl.innerHTML = '';
            thumbsEl.style.width = `${Math.max(0, _items.length * SLOT)}px`;
            for (let i = _windowStart; i <= _windowEnd; i++) {
                const item = _items[i];
                if (!item) continue;
                const d = document.createElement('div');
                d.className = 'mpi-thumb-strip__thumb';
                d.dataset.index = String(i);
                if (item.info) d.dataset.info = item.info;
                if (i === _currentIndex) d.classList.add('is-current');
                if (_selection.has(i)) d.classList.add('is-selected');
                if (_drag?.mode === 'thumb' && _drag.index === i) {
                    d.classList.add('mpi-thumb-strip__thumb--lifted');
                }
                d.style.left = `${i * SLOT}px`;
                const img = document.createElement('img');
                img.src = item.thumbUrl || '';
                img.alt = '';
                img.draggable = false;
                d.appendChild(img);
                if (typeof props.decorateThumb === 'function') props.decorateThumb(d, i);
                thumbsEl.appendChild(d);
            }
        }

        function _applyTransform() {
            const trackWidth = el.clientWidth;
            if (!trackWidth) return; // hidden ancestor (Stash Pattern) — bail (MPI-597)
            const center = trackWidth / 2;
            const thumbCenterX = _currentIndex * SLOT + THUMB_W / 2;
            thumbsEl.style.transform = `translateX(${Math.round(center - thumbCenterX)}px)`;
        }

        // ── Selection helpers ────────────────────────────────────────────

        /** Replace the selection with the run from `_anchor` to `idx`, inclusive. */
        function _rangeSelect(idx) {
            const clamped = Math.max(0, Math.min(_items.length - 1, idx));
            _anchor = Math.max(0, Math.min(_items.length - 1, _anchor));
            _selection.clear();
            const step = clamped >= _anchor ? 1 : -1;
            for (let i = _anchor; i !== clamped + step; i += step) _selection.add(i);
            _renderWindow();
        }

        // ── Public API ───────────────────────────────────────────────────

        el.setItems = (items, { currentIndex = 0 } = {}) => {
            _items = Array.isArray(items) ? items.slice() : [];
            _selection.clear();
            emit('selection-change', { indices: [] });
            _currentIndex = Math.max(0, Math.min(_items.length - 1, currentIndex || 0));
            _windowEnd = -1; // force a full re-render
            _ensureWindow(_currentIndex);
            _renderWindow();
            _applyTransform();
        };

        el.setCurrentIndex = (idx) => {
            if (!_items.length) return;
            const clamped = Math.max(0, Math.min(_items.length - 1, Math.round(idx)));
            if (clamped === _currentIndex && _windowEnd >= _windowStart) { _applyTransform(); return; }
            const prev = _currentIndex;
            _currentIndex = clamped;
            if (_ensureWindow(_currentIndex)) {
                _renderWindow();
            } else {
                qs(`[data-index="${prev}"]`, thumbsEl)?.classList.remove('is-current');
                const cur = qs(`[data-index="${_currentIndex}"]`, thumbsEl);
                if (cur) {
                    cur.classList.add('is-current');
                    if (typeof props.decorateThumb === 'function') props.decorateThumb(cur, _currentIndex);
                }
            }
            _applyTransform();
        };

        el.setSelection = (indices) => {
            _selection.clear();
            const arr = Array.isArray(indices) ? indices : [];
            for (const i of arr) _selection.add(i);
            _renderWindow();
        };

        el.getSelection = () => [..._selection].sort((a, b) => a - b);

        /**
         * Cheap pass: re-applies state classes and calls decorateThumb on every
         * visible thumb without rebuilding the DOM. Equivalent to the old
         * `_paintRange` idiom — use this when only decoration data changes
         * (range, mask overlay, etc.) and items/positions have not moved.
         */
        el.repaintThumbs = () => {
            for (const d of thumbsEl.children) {
                const i = +d.dataset.index;
                d.classList.toggle('is-current', i === _currentIndex);
                d.classList.toggle('is-selected', _selection.has(i));
                d.classList.toggle('mpi-thumb-strip__thumb--lifted',
                    !!(_drag?.mode === 'thumb' && _drag.index === i));
                if (typeof props.decorateThumb === 'function') props.decorateThumb(d, i);
            }
        };

        // ── ResizeObserver ───────────────────────────────────────────────

        const _ro = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (!rect || !rect.width || !rect.height) return; // Stash Pattern zero-rect (MPI-597)
            _applyTransform();
        });
        _ro.observe(el);
        _unsubs.push(() => _ro.disconnect());

        // ── Drag: scrub, or (after a hold) reorder a thumb ───────────────
        //
        // mode 'press'  — a thumb is down, undecided: a release is a click, a
        //   move becomes 'scrub'; HOLD_MS without moving → 'thumb' (if allowReorder).
        // mode 'scrub'  — the strip follows the pointer, no edit.
        // mode 'thumb'  — the held thumb is lifted and follows the pointer.

        let _drag = null;
        let _holdTimer = 0;
        const _clearHold = () => { clearTimeout(_holdTimer); _holdTimer = 0; };

        // Bound to the strip root (which IS the track):  a click that lands
        // past the rendered window still bubbles here and falls into the scrub
        // branch (`closest('.mpi-thumb-strip__thumb')` finds nothing).
        _unsubs.push(on(el, 'pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            document.activeElement?.blur?.();
            try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
            const thumbEl = e.target.closest('.mpi-thumb-strip__thumb');
            const base = { startX: e.clientX, startIndex: _currentIndex, moved: false, lastScrubIdx: _currentIndex };
            if (!thumbEl) { _drag = { ...base, mode: 'scrub' }; return; }
            const range  = e.shiftKey;
            const toggle = !range && (e.ctrlKey || e.metaKey);
            const index = Number(thumbEl.dataset.index);
            _drag = { ...base, mode: 'press', index, liftIndex: index, range, toggle };
            if (range || toggle) return;
            if (!props.allowReorder) return;
            _clearHold();
            _holdTimer = setTimeout(() => {
                if (_drag?.mode !== 'press') return;
                _drag.mode = 'thumb';
                _renderWindow(); // paints the lift
            }, HOLD_MS);
        }));

        const _onMove = (e) => {
            if (!_drag) return;
            const dx = e.clientX - _drag.startX;
            if (!_drag.moved && Math.abs(dx) > DRAG_THRESHOLD) _drag.moved = true;
            if (!_drag.moved) return;

            if (_drag.mode === 'press') {
                _clearHold();
                _drag.mode = 'scrub';
                _drag.lastScrubIdx = _drag.startIndex;
            }

            if (_drag.mode === 'scrub') {
                const newIdx = Math.max(0, Math.min(_items.length - 1,
                    Math.round(_drag.startIndex - dx / SLOT)));
                _drag.lastScrubIdx = newIdx;
                emit('scrub', { index: newIdx });
                return;
            }

            if (_drag.mode === 'thumb' && props.allowReorder) {
                const targetIdx = Math.max(0, Math.min(_items.length - 1,
                    _drag.liftIndex + Math.round(dx / SLOT)));
                if (targetIdx === _drag.index) return;
                const [moved] = _items.splice(_drag.index, 1);
                _items.splice(targetIdx, 0, moved);
                _drag.index = targetIdx;
                _windowEnd = -1;
                _ensureWindow(_currentIndex);
                _renderWindow();
                _applyTransform();
            }
        };

        const _onUp = () => {
            if (!_drag) return;
            _clearHold();
            const d = _drag;
            _drag = null;

            if (d.mode === 'thumb') {
                if (d.moved) emit('reorder', { from: d.liftIndex, to: d.index });
                else emit('thumb-select', { index: d.index });
                _renderWindow(); // drops the lift
                return;
            }
            if (d.mode === 'scrub') {
                emit('scrub-end', { index: d.lastScrubIdx });
                return;
            }
            if (d.mode === 'press') {
                if (d.range) {
                    // A first Shift-click with nothing selected anchors at the frame
                    // the pointer is ON (the subtlety MpiHistoryList:199-213 solved).
                    if (_selection.size === 0) _anchor = _currentIndex;
                    _rangeSelect(d.index);
                } else if (d.toggle) {
                    if (_selection.has(d.index)) {
                        _selection.delete(d.index);
                    } else {
                        _selection.add(d.index);
                        _anchor = d.index;
                    }
                    _renderWindow();
                } else {
                    _selection.clear();
                    _anchor = d.index;
                    _renderWindow();
                    emit('thumb-select', { index: d.index });
                }
                emit('selection-change', { indices: [..._selection].sort((a, b) => a - b) });
            }
        };

        _unsubs.push(on(window, 'pointermove', _onMove));
        _unsubs.push(on(window, 'pointerup', _onUp));
        _unsubs.push(on(window, 'pointercancel', _onUp));

        // ── Context menu ─────────────────────────────────────────────────
        //
        // A Compound cannot import MpiContextMenu (same tier) so the menu goes
        // through the shell hop 'ui:context-menu' (shell.js:442 registers
        // MpiContextMenu.show as its handler). This is the identical path
        // MpiHistoryList and MpiGalleryGrid use.

        _unsubs.push(on(el, 'contextmenu', (e) => {
            const thumbEl = e.target.closest('.mpi-thumb-strip__thumb');
            if (!thumbEl) return;
            e.preventDefault();
            const index = Number(thumbEl.dataset.index);
            if (!Number.isFinite(index) || !_items[index]) return;
            const selection = [..._selection].sort((a, b) => a - b);
            if (typeof props.menuItems !== 'function') return;
            const items = props.menuItems(index, selection);
            if (!items || !items.length) return;
            Events.emit('ui:context-menu', {
                x: e.clientX,
                y: e.clientY,
                items,
                onSelect: (key) => emit('menu-select', { key, index, selection }),
            });
        }));

        // ── Teardown ─────────────────────────────────────────────────────

        el.destroy = () => {
            _clearHold();
            _unsubs.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
        };
    },
});
