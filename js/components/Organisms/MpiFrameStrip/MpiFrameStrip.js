/**
 * MpiFrameStrip — full-width GIF frame strip with a fixed centre marker
 * (MPI-769, Fabio's design / plan decisions 9-10).
 *
 * The current frame always sits under the centre marker; the strip slides
 * under it as playback advances or the user scrubs. Click a thumbnail to
 * jump; drag anywhere to scrub. PRESS AND HOLD a thumbnail (HOLD_MS), then
 * drag, to reorder — a plain drag never edits (Fabio, 2026-09-16: users drag
 * a film strip to scrub it). Ctrl/cmd-click toggles a thumbnail into a
 * multi-select the Backspace hotkey (`gif.frame.delete`) drops. Both edits
 * STAGE in a local working copy — nothing is sent to the server until the
 * pill's Update (rewrite the current entry) or Apply (save a new one) is
 * clicked; Discard drops them. Only a window of thumbnails around the current
 * index is ever in the DOM (`_ensureWindow`), so a long GIF never renders
 * every frame at once.
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
 *                                                  the pill. The mask overlay
 *                                                  is the viewer's to reset.
 *   setCurrentIndex(idx)     — move the marker (no event; called back by the
 *                              Block from the viewer's own 'frame-change').
 *   getStagedFrames()        — current working copy
 *   commit(frames)           — server round-trip landed: staged AND
 *                              committed both become `frames`, the marker
 *                              resets to frame 0 (matching the Block's paired
 *                              `viewer.el.loadFrames()` call), pill hides.
 *   setMaskOverlay(masks|null, edited = []) — MPI-771: tint each visible thumb
 *                              with `masks[i]` (index-aligned to the list the
 *                              VIEWER holds — a cut-out mask is per frame
 *                              POSITION, not per content hash, so this is
 *                              index-keyed where every other API here is
 *                              content-keyed; a thumb being dragged keeps its
 *                              tint), and mark the `edited` positions
 *                              (hand-fixed with the Mask Brush).
 *                              Read-only preview so a scrub reveals flicker
 *                              between frames; `null` clears it. No UndoStack
 *                              entry — see docs/masking-sam3-gif.md.
 *   destroy()
 *
 * Emits:
 *   'frame-select' { index } — thumbnail clicked (no modifier)
 *   'scrub'        { index } — dragging the empty track
 *   'stage-change' { frames, order } — reorder, delete or Discard changed the
 *                              staged list; `order[newPos]` = that frame's
 *                              position in the list of the previous
 *                              'stage-change' (or load), undefined for a frame
 *                              that list did not hold
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
/** Hold a thumbnail this long, without moving, to pick it up for a reorder. */
const HOLD_MS = 300;

export const MpiFrameStrip = ComponentFactory.create({
    name: 'MpiFrameStrip',
    css: ['js/components/Organisms/MpiFrameStrip/MpiFrameStrip.css'],

    template: () => `
        <div class="mpi-frame-strip">
            <div class="mpi-frame-strip__pill" hidden>
                <span class="mpi-frame-strip__pill-count"></span>
                <div class="mpi-frame-strip__pill-actions">
                    <div data-mount="discard-btn"></div>
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

        const discardBtn = MpiButton.mount(qs('[data-mount="discard-btn"]', el), { text: 'Discard', variant: 'ghost', size: 'sm', info: 'Undo these frame changes' });
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

        /** MPI-771 (UI half): index-aligned mask URLs from the cut-out tool's
         *  last Track, or null. Index-keyed (not hash-keyed, unlike every
         *  other list here) because a tracked mask belongs to a frame
         *  POSITION, not its content. */
        let _maskOverlay = null;
        /** Positions whose mask was fixed with the Mask Brush — same keying. */
        let _edited = new Set();

        /** Committed index each staged frame came from: the identity a reorder keeps. */
        let _origin = [];
        /** Origin -> position in the list the viewer holds (what the overlay is keyed by). */
        let _viewerPos = new Map();

        const _syncViewerPos = () => { _viewerPos = new Map(_origin.map((o, i) => [o, i])); };
        function _resetOrigin() {
            _origin = _staged.map((_, i) => i);
            _syncViewerPos();
        }

        /** Hand the staged list to the Block, with where each frame sat in the viewer's list. */
        function _emitStage() {
            const order = _origin.map(o => _viewerPos.get(o));
            _syncViewerPos();
            _syncPill();
            emit('stage-change', { frames: _staged.slice(), order });
        }

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
                if (_drag?.mode === 'thumb' && _drag.index === i) d.classList.add('mpi-frame-strip__thumb--lifted');
                d.style.left = `${i * SLOT}px`;
                const img = document.createElement('img');
                img.src = f.thumbUrl || f.url || '';
                img.alt = '';
                img.draggable = false;
                d.appendChild(img);
                const vp = _viewerPos.get(_origin[i]);
                if (_edited.has(vp)) d.classList.add('mpi-frame-strip__thumb--edited');
                const maskUrl = vp === undefined ? null : _maskOverlay?.[vp];
                if (maskUrl) {
                    const tint = document.createElement('div');
                    tint.className = 'mpi-frame-strip__thumb-tint';
                    tint.style.webkitMaskImage = `url("${maskUrl}")`;
                    tint.style.maskImage = `url("${maskUrl}")`;
                    d.appendChild(tint);
                }
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
            _resetOrigin();
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

        el.setMaskOverlay = (masks, edited = []) => {
            _maskOverlay = Array.isArray(masks) ? masks : null;
            _edited = new Set(edited);
            _renderWindow();
        };

        el.commit = (frames) => {
            _committed = Array.isArray(frames) ? frames.slice() : _staged.slice();
            _staged = _committed.slice();
            _resetOrigin();
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

        // ── Drag: scrub, or (after a hold) reorder a thumb ────────────────
        //
        // mode 'press' — a thumb is down, undecided: a release is a click, a
        //   move becomes 'scrub', HOLD_MS without moving becomes 'thumb'.
        // mode 'scrub' — the strip follows the pointer, no edit.
        // mode 'thumb' — the held thumb is lifted and follows the pointer:
        //   it sits `round(dx / SLOT)` slots from where it was lifted.
        //
        // The strip OWNS its press (pointer events, `preventDefault`, capture —
        // MpiTrimBar's idiom). Left to the browser, a press starts a text
        // selection, and a press inside a selection starts Chromium's NATIVE
        // drag: its ghost is the "copy" Fabio saw, and a native drag never
        // delivers the release, so the lifted thumb kept reordering on hover.

        let _drag = null;
        let _holdTimer = 0;
        const _clearHold = () => { clearTimeout(_holdTimer); _holdTimer = 0; };

        // Bound to the TRACK, not the thumbs container: the track is the
        // thumbs' own ancestor and is always the track's full visible width,
        // so a click that lands past the currently-rendered window (or in
        // any gap) still bubbles here and correctly falls into the scrub
        // branch below (`closest('.mpi-frame-strip__thumb')` finds nothing).
        // The capture sits on the track too: a thumb is re-rendered mid-drag.
        _unsubs.push(on(trackEl, 'pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            // preventDefault also keeps focus where it was; hotkeys skip a
            // focused text field, so let it go the way a native press would.
            document.activeElement?.blur?.();
            try { trackEl.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
            const thumbEl = e.target.closest('.mpi-frame-strip__thumb');
            const base = { startX: e.clientX, startIndex: _currentIndex, moved: false };
            if (!thumbEl) { _drag = { ...base, mode: 'scrub' }; return; }
            const modifier = e.ctrlKey || e.metaKey || e.shiftKey;
            const index = Number(thumbEl.dataset.index);
            _drag = { ...base, mode: 'press', index, liftIndex: index, modifier };
            if (modifier) return;
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
            }

            if (_drag.mode === 'scrub') {
                const newIdx = Math.max(0, Math.min(_staged.length - 1, Math.round(_drag.startIndex - dx / SLOT)));
                emit('scrub', { index: newIdx });
                return;
            }

            // mode 'thumb' — the strip does not slide while a thumb is up, so
            // slot N stays at the same x and the pointer maps 1:1 onto slots.
            const targetIdx = Math.max(0, Math.min(_staged.length - 1, _drag.liftIndex + Math.round(dx / SLOT)));
            if (targetIdx === _drag.index) return;
            const [moved] = _staged.splice(_drag.index, 1);
            _staged.splice(targetIdx, 0, moved);
            const [movedOrigin] = _origin.splice(_drag.index, 1);
            _origin.splice(targetIdx, 0, movedOrigin);
            _drag.index = targetIdx;
            _windowEnd = -1;
            _ensureWindow(_currentIndex);
            _renderWindow();
            _applyTransform();
            _syncPill();
        };

        const _onUp = () => {
            if (!_drag) return;
            _clearHold();
            const d = _drag;
            _drag = null;

            if (d.mode === 'thumb') {
                if (d.moved) _emitStage();
                else emit('frame-select', { index: d.index });
                _renderWindow(); // drops the lift
                return;
            }
            if (d.mode === 'press') {
                if (d.modifier) {
                    if (_selection.has(d.index)) _selection.delete(d.index);
                    else _selection.add(d.index);
                    _renderWindow();
                } else {
                    _selection.clear();
                    emit('frame-select', { index: d.index });
                }
            }
            // scrub end needs no extra event — the Block already applied every
            // intermediate 'scrub' as it happened.
        };

        _unsubs.push(on(window, 'pointermove', _onMove));
        _unsubs.push(on(window, 'pointerup', _onUp));
        _unsubs.push(on(window, 'pointercancel', _onUp));

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
            _origin = _origin.filter((_, i) => !_selection.has(i));
            _selection.clear();
            _currentIndex = Math.max(0, Math.min(_staged.length - 1, _currentIndex));
            _windowEnd = -1;
            _ensureWindow(_currentIndex);
            _renderWindow();
            _applyTransform();
            _emitStage();
        }));

        // ── Pill buttons ───────────────────────────────────────────────────

        discardBtn.on('click', () => {
            _staged = _committed.slice();
            _origin = _staged.map((_, i) => i);
            _selection.clear();
            _windowEnd = -1;
            _ensureWindow(_currentIndex);
            _renderWindow();
            _applyTransform();
            _emitStage();
        });
        updateBtn.on('click', () => emit('update', { frames: _staged.slice() }));
        applyBtn.on('click',  () => emit('apply',  { frames: _staged.slice() }));

        // ── Teardown ─────────────────────────────────────────────────────

        el.destroy = () => {
            _clearHold();
            _unsubs.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
            _hotkeyUnsubs.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
            try { discardBtn.destroy(); } catch (_) { /* noop */ }
            try { updateBtn.destroy(); } catch (_) { /* noop */ }
            try { applyBtn.destroy(); } catch (_) { /* noop */ }
        };
    },
});
