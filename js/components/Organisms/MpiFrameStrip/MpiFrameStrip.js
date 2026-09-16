/**
 * MpiFrameStrip — full-width GIF frame strip with a fixed centre marker
 * (MPI-769, Fabio's design / plan decisions 9-10).
 *
 * The current frame always sits under the centre marker; the strip slides
 * under it as playback advances or the user scrubs. Click a thumbnail to
 * jump. Drag a thumbnail to reorder; ctrl/cmd-click toggles it into a
 * multi-select the Backspace hotkey (`gif.frame.delete`) drops. Both edits
 * STAGE in a local working copy — nothing is sent to the server until the
 * pill's Update (rewrite the current entry) or Apply (save a new one) is
 * clicked. Only a window of thumbnails around the current index is ever in
 * the DOM (`_ensureWindow`), so a long GIF never renders every frame at once.
 *
 * This component owns NO navigation authority — it is a peer of MpiGifViewer
 * under the Block's mediator. It emits intent ('frame-select', 'scrub') and
 * the Block drives the viewer; the viewer's own 'frame-change' comes back
 * through `setCurrentIndex()` so the marker is always painted from the same
 * single source of truth the frame counter reads (docs/video-player.md § the
 * frame-index coordinate law applies here too, just in frame units).
 *
 * Instance API (on el):
 *   setFrames(frames, { currentIndex = 0 } = {}) — full (re)load: resets the
 *                                                  committed AND staged copy,
 *                                                  clears selection, hides
 *                                                  the pill.
 *   setCurrentIndex(idx)     — move the marker (no event; called back by the
 *                              Block from the viewer's own 'frame-change').
 *   getStagedFrames()        — current working copy
 *   commit(frames)           — server round-trip landed: staged AND
 *                              committed both become `frames`, the marker
 *                              resets to frame 0 (matching the Block's paired
 *                              `viewer.el.loadFrames()` call), pill hides.
 *   destroy()
 *
 * Emits:
 *   'frame-select' { index } — thumbnail clicked (no modifier)
 *   'scrub'        { index } — dragging the empty track
 *   'stage-change' { frames } — reorder or delete changed the staged list
 *   'update'       { frames } — pill's Update button
 *   'apply'        { frames } — pill's Apply button
 */

import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { qs, on } from '../../../utils/dom.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';

const THUMB_W    = 64;
const THUMB_GAP  = 6;
const SLOT       = THUMB_W + THUMB_GAP;
/** Frames rendered each side of the current index — generous but bounded. */
const VIEW_RADIUS = 40;
/** Drag threshold in px before a mousedown counts as a drag, not a click. */
const DRAG_THRESHOLD = 4;

export const MpiFrameStrip = ComponentFactory.create({
    name: 'MpiFrameStrip',
    css: ['js/components/Organisms/MpiFrameStrip/MpiFrameStrip.css'],

    template: () => `
        <div class="mpi-frame-strip">
            <div class="mpi-frame-strip__pill" hidden>
                <span class="mpi-frame-strip__pill-count"></span>
                <div class="mpi-frame-strip__pill-actions">
                    <div data-mount="update-btn"></div>
                    <div data-mount="apply-btn"></div>
                </div>
            </div>
            <div class="mpi-frame-strip__track">
                <div class="mpi-frame-strip__thumbs"></div>
                <div class="mpi-frame-strip__marker"></div>
            </div>
        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];
        const _hotkeyUnsubs = [];

        const pillEl      = qs('.mpi-frame-strip__pill', el);
        const pillCountEl = qs('.mpi-frame-strip__pill-count', el);
        const trackEl     = qs('.mpi-frame-strip__track', el);
        const thumbsEl    = qs('.mpi-frame-strip__thumbs', el);

        const updateBtn = MpiButton.mount(qs('[data-mount="update-btn"]', el), { text: 'Update', variant: 'secondary', size: 'sm', info: 'Rewrite this entry' });
        const applyBtn  = MpiButton.mount(qs('[data-mount="apply-btn"]', el),  { text: 'Apply',  variant: 'primary',   size: 'sm', info: 'Save as a new entry' });

        /** @type {Array<{hash:string,url:string,thumbUrl:string,delay:number}>} */
        let _committed = [];
        let _staged = [];
        let _currentIndex = 0;
        /** @type {Set<number>} staged indices marked for deletion */
        const _selection = new Set();

        let _windowStart = 0;
        let _windowEnd = -1; // empty until first render

        // ── Diff / pill ──────────────────────────────────────────────────

        function _dirtyCount() {
            let n = Math.abs(_staged.length - _committed.length);
            const len = Math.min(_staged.length, _committed.length);
            for (let i = 0; i < len; i++) {
                if (_staged[i]?.hash !== _committed[i]?.hash) n++;
            }
            return n;
        }

        function _syncPill() {
            const n = _dirtyCount();
            pillEl.hidden = n === 0;
            if (n > 0) pillCountEl.textContent = `${n} frame change${n === 1 ? '' : 's'}`;
        }

        // ── Windowed rendering ───────────────────────────────────────────

        function _ensureWindow(idx) {
            const pad = Math.floor(VIEW_RADIUS / 2);
            if (_windowEnd >= _windowStart && idx >= _windowStart + pad && idx <= _windowEnd - pad) return false;
            _windowStart = Math.max(0, idx - VIEW_RADIUS);
            _windowEnd = Math.min(_staged.length - 1, idx + VIEW_RADIUS);
            return true;
        }

        function _renderWindow() {
            thumbsEl.innerHTML = '';
            thumbsEl.style.width = `${Math.max(0, _staged.length * SLOT)}px`;
            for (let i = _windowStart; i <= _windowEnd; i++) {
                const f = _staged[i];
                if (!f) continue;
                const d = document.createElement('div');
                d.className = 'mpi-frame-strip__thumb';
                d.dataset.index = String(i);
                if (i === _currentIndex) d.classList.add('is-current');
                if (_selection.has(i)) d.classList.add('is-selected');
                d.style.left = `${i * SLOT}px`;
                const img = document.createElement('img');
                img.src = f.thumbUrl || f.url || '';
                img.alt = '';
                img.draggable = false;
                d.appendChild(img);
                thumbsEl.appendChild(d);
            }
        }

        function _applyTransform() {
            const trackWidth = trackEl.clientWidth;
            if (!trackWidth) return; // hidden ancestor (MpiOverlay Stash Pattern) — nothing to size against
            const center = trackWidth / 2;
            const thumbCenterX = _currentIndex * SLOT + THUMB_W / 2;
            thumbsEl.style.transform = `translateX(${Math.round(center - thumbCenterX)}px)`;
        }

        // ── Public API ───────────────────────────────────────────────────

        el.setFrames = (frames, { currentIndex = 0 } = {}) => {
            _committed = Array.isArray(frames) ? frames.slice() : [];
            _staged = _committed.slice();
            _selection.clear();
            _currentIndex = Math.max(0, Math.min(_staged.length - 1, currentIndex || 0));
            _windowEnd = -1; // force a full re-render
            _ensureWindow(_currentIndex);
            _renderWindow();
            _applyTransform();
            _syncPill();
        };

        el.setCurrentIndex = (idx) => {
            if (!_staged.length) return;
            const clamped = Math.max(0, Math.min(_staged.length - 1, Math.round(idx)));
            if (clamped === _currentIndex && _windowEnd >= _windowStart) { _applyTransform(); return; }
            const prev = _currentIndex;
            _currentIndex = clamped;
            if (_ensureWindow(_currentIndex)) {
                _renderWindow();
            } else {
                qs(`[data-index="${prev}"]`, thumbsEl)?.classList.remove('is-current');
                qs(`[data-index="${_currentIndex}"]`, thumbsEl)?.classList.add('is-current');
            }
            _applyTransform();
        };

        el.getStagedFrames = () => _staged.slice();

        el.commit = (frames) => {
            _committed = Array.isArray(frames) ? frames.slice() : _staged.slice();
            _staged = _committed.slice();
            _selection.clear();
            // The Block reloads the saved entry into the viewer via
            // `loadFrames()` (a fresh `.gif` revision, new sequenced file per
            // E5), which always resets ITS index to 0 — match it here, or the
            // marker would keep pointing at wherever the pointer happened to
            // be before Update/Apply while the counter already reads 0.
            _currentIndex = 0;
            _windowEnd = -1;
            _ensureWindow(_currentIndex);
            _renderWindow();
            _applyTransform();
            _syncPill();
        };

        // ── Resize ───────────────────────────────────────────────────────

        const _ro = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (!rect || !rect.width || !rect.height) return; // Stash Pattern zero-rect
            _applyTransform();
        });
        _ro.observe(trackEl);
        _unsubs.push(() => _ro.disconnect());

        // ── Drag: reorder a thumb, or scrub the empty track ───────────────

        let _drag = null;

        // Bound to the TRACK, not the thumbs container: the track is the
        // thumbs' own ancestor and is always the track's full visible width,
        // so a click that lands past the currently-rendered window (or in
        // any gap) still bubbles here and correctly falls into the scrub
        // branch below (`closest('.mpi-frame-strip__thumb')` finds nothing).
        _unsubs.push(on(trackEl, 'mousedown', (e) => {
            if (e.button !== 0) return;
            const thumbEl = e.target.closest('.mpi-frame-strip__thumb');
            if (thumbEl) {
                _drag = {
                    mode: 'thumb',
                    index: Number(thumbEl.dataset.index),
                    startX: e.clientX,
                    moved: false,
                    modifier: e.ctrlKey || e.metaKey || e.shiftKey,
                };
            } else {
                _drag = { mode: 'scrub', startX: e.clientX, startIndex: _currentIndex, moved: false };
            }
        }));

        const _onMove = (e) => {
            if (!_drag) return;
            const dx = e.clientX - _drag.startX;
            if (!_drag.moved && Math.abs(dx) > DRAG_THRESHOLD) _drag.moved = true;
            if (!_drag.moved) return;

            if (_drag.mode === 'scrub') {
                const newIdx = Math.max(0, Math.min(_staged.length - 1, Math.round(_drag.startIndex - dx / SLOT)));
                emit('scrub', { index: newIdx });
                return;
            }

            if (_drag.mode === 'thumb' && !_drag.modifier) {
                const deltaSlots = Math.round(dx / SLOT);
                const targetIdx = Math.max(0, Math.min(_staged.length - 1, _drag.index + deltaSlots));
                if (targetIdx === _drag.index) return;
                const [moved] = _staged.splice(_drag.index, 1);
                _staged.splice(targetIdx, 0, moved);
                _drag.index = targetIdx;
                _drag.startX = e.clientX;
                _windowEnd = -1;
                _ensureWindow(_currentIndex);
                _renderWindow();
                _applyTransform();
                _syncPill();
            }
        };

        const _onUp = () => {
            if (!_drag) return;
            const d = _drag;
            _drag = null;

            if (d.mode === 'thumb' && !d.moved) {
                if (d.modifier) {
                    if (_selection.has(d.index)) _selection.delete(d.index);
                    else _selection.add(d.index);
                    _renderWindow();
                } else {
                    _selection.clear();
                    emit('frame-select', { index: d.index });
                }
                return;
            }
            if (d.mode === 'thumb' && d.moved) {
                emit('stage-change', { frames: _staged.slice() });
                _syncPill();
            }
            // scrub end needs no extra event — the Block already applied every
            // intermediate 'scrub' as it happened.
        };

        _unsubs.push(on(window, 'mousemove', _onMove));
        _unsubs.push(on(window, 'mouseup', _onUp));

        // ── Delete selected (staged only) ─────────────────────────────────

        const _canDrive = () => el.isConnected && el.getClientRects().length > 0;

        _hotkeyUnsubs.push(Hotkeys.bind('gif.frame.delete', () => {
            if (!_canDrive() || _selection.size === 0) return;
            // A GIF needs at least one frame — never stage a delete that would
            // empty the strip (the Block's save round trip rejects it anyway,
            // but failing silently here is friendlier than a toast after the
            // fact for a selection that could only ever produce it).
            if (_staged.length - _selection.size < 1) return;
            _staged = _staged.filter((_, i) => !_selection.has(i));
            _selection.clear();
            _currentIndex = Math.max(0, Math.min(_staged.length - 1, _currentIndex));
            _windowEnd = -1;
            _ensureWindow(_currentIndex);
            _renderWindow();
            _applyTransform();
            _syncPill();
            emit('stage-change', { frames: _staged.slice() });
        }));

        // ── Pill buttons ───────────────────────────────────────────────────

        updateBtn.on('click', () => emit('update', { frames: _staged.slice() }));
        applyBtn.on('click',  () => emit('apply',  { frames: _staged.slice() }));

        // ── Teardown ─────────────────────────────────────────────────────

        el.destroy = () => {
            _unsubs.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
            _hotkeyUnsubs.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
            try { updateBtn.destroy(); } catch (_) { /* noop */ }
            try { applyBtn.destroy(); } catch (_) { /* noop */ }
        };
    },
});
