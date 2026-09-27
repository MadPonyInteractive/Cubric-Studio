/**
 * MpiFrameStrip — full-width GIF frame strip with a fixed centre marker
 * (MPI-769, Fabio's design / plan decisions 9-10).
 *
 * Composes MpiThumbStrip (Phase 3b, MPI-949) for the generic strip behaviour
 * (windowed rendering, centre marker, pointer grammar) and keeps only the GIF
 * layer: staged/committed/origin bookkeeping, the Discard/Update/Apply pill,
 * duplicate/delete, mask overlay, trim range, and the gif.frame.delete hotkeys.
 *
 * The current frame always sits under the centre marker; the strip slides
 * under it as playback advances or the user scrubs. Click a thumbnail to
 * jump; drag anywhere to scrub. PRESS AND HOLD a thumbnail (HOLD_MS), then
 * drag, to reorder — a plain drag never edits (Fabio, 2026-09-16: users drag
 * a film strip to scrub it). Ctrl/cmd-click toggles a thumbnail into a
 * multi-select the Backspace hotkey (`gif.frame.delete`) drops. Right-click
 * duplicates a frame (MPI-857), deletes it, or clears its cut-out mask. Every
 * edit STAGES in a local working copy — nothing is sent to the server until the
 * pill's Update (rewrite the current entry) or Apply (save a new one) is
 * clicked; Discard drops them. Only a window of thumbnails around the current
 * index is ever in the DOM (`MpiThumbStrip._ensureWindow`), so a long GIF
 * never renders every frame at once.
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
 *   setRange(range|null)     — MPI-771: paint the control bar's trim handles
 *                              ON the strip (frames outside the range dimmed,
 *                              an edge bar at in and at out). Fabio, 2026-09-18:
 *                              the range was legible only as numbers in the
 *                              Trim panel, so Trim read as doing nothing.
 *                              Frame INDICES, matching MpiGifControlBar's
 *                              `getRange()`; `null` clears the paint.
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
 *   'selection-change' { indices, viewerIndices } — the Ctrl-click selection
 *                              changed (or was cleared by a load, delete or
 *                              Discard). `viewerIndices` is the same set in the
 *                              VIEWER's frame order, which is what the cut-out
 *                              panel's "Selected" scope acts on.
 *   'clear-frame-mask' { index, viewerIndex } — context menu; `viewerIndex` is
 *                              the position the VIEWER keys its masks by (see
 *                              setMaskOverlay), which is what the Block passes
 *                              to `viewer.el.clearFrameMasks()`
 *   'scrub'        { index } — dragging the empty track
 *   'stage-change' { frames, order } — reorder, delete, duplicate or Discard
 *                              changed the staged list; `order[newPos]` = that
 *                              frame's position in the list of the previous
 *                              'stage-change' (or load), undefined for a frame
 *                              that list did not hold. A duplicate's copy names
 *                              its SOURCE's position, so the mask comes with it
 *   'update'       { frames } — pill's Update button
 *   'apply'        { frames } — pill's Apply button
 */

import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiThumbStrip } from '../../Compounds/MpiThumbStrip/MpiThumbStrip.js';
import { qs } from '../../../utils/dom.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';

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
            <div class="mpi-frame-strip__track"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        const _unsubs = [];
        const _hotkeyUnsubs = [];

        const pillEl      = qs('.mpi-frame-strip__pill', el);
        const pillCountEl = qs('.mpi-frame-strip__pill-count', el);

        // ── GIF layer state ───────────────────────────────────────────────

        /** @type {Array<{hash:string,url:string,thumbUrl:string,delay:number}>} */
        let _committed = [];
        let _staged = [];
        let _currentIndex = 0;
        /** Identity for each staged frame: its committed index (or a negative
         *  dup-token). Same semantics as before — see the original header. */
        let _origin = [];
        /** Negative so a dup-token never collides with a committed index. */
        let _dupToken = -1;
        /** Origin → position in the list the viewer holds (mask index key). */
        let _viewerPos = new Map();

        /** @type {number[]|null} — index-aligned mask URLs from the cut-out tool. */
        let _maskOverlay = null;
        /** Positions whose mask was fixed with the Mask Brush. */
        let _edited = new Set();

        /** The control bar's trim handles, in frame indices, or null. */
        let _range = null;

        const _syncViewerPos = () => {
            _viewerPos = new Map(_origin.map((o, i) => [o, i]));
        };
        const _viewerPosOf = (i) => _viewerPos.get(_origin[i]);

        // ── Selection (delegated to MpiThumbStrip, mapped to viewer coords) ──

        function _emitSelection() {
            const indices = strip.el.getSelection(); // staged indices
            emit('selection-change', {
                indices,
                viewerIndices: indices.map(_viewerPosOf).filter(v => v !== undefined),
            });
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

        // ── Item builder ─────────────────────────────────────────────────

        function _makeItems() {
            return _staged.map((f, i) => ({
                key: f.hash ? `${f.hash}-${i}` : String(i),
                thumbUrl: f.thumbUrl || f.url || '',
                info: `Frame ${i + 1}/${_staged.length} — click to jump, drag to scrub, `
                    + 'hold then drag to reorder, Ctrl-click to select (Backspace deletes), '
                    + 'right-click to duplicate / delete / clear mask',
            }));
        }

        // ── Origin helpers ───────────────────────────────────────────────

        function _resetOrigin() {
            _origin = _staged.map((_, i) => i);
            _syncViewerPos();
        }

        /** Hand the staged list to the Block, with where each frame sat in the viewer. */
        function _emitStage() {
            const order = _origin.map(o => _viewerPos.get(o));
            _syncViewerPos();
            _syncPill();
            emit('stage-change', { frames: _staged.slice(), order });
        }

        // ── Range clamp ──────────────────────────────────────────────────

        function _clampRange() {
            if (!_range) return;
            const last = Math.max(0, _staged.length - 1);
            _range = { in: Math.min(_range.in, last), out: Math.min(_range.out, last) };
        }

        // ── decorateThumb — GIF-specific classes and elements ────────────
        //
        // MpiThumbStrip applies its own state classes (is-current, is-selected,
        // mpi-thumb-strip__thumb--lifted) BEFORE calling this function, so the
        // decorator can mirror them as the GIF-spec's `mpi-frame-strip__thumb--*`
        // classes. This keeps the GIF desktop specs' selectors working unchanged
        // while the generic strip uses its own BEM namespace.

        function _decorateThumb(d, i) {
            // Always add the frame-strip class so GIF specs' selectors still work.
            d.classList.add('mpi-frame-strip__thumb');

            // Mirror the lifted modifier so specs can find mpi-frame-strip__thumb--lifted.
            d.classList.toggle('mpi-frame-strip__thumb--lifted',
                d.classList.contains('mpi-thumb-strip__thumb--lifted'));

            // Range decoration (MPI-771).
            if (_range) {
                d.classList.toggle('mpi-frame-strip__thumb--outside',
                    i < _range.in || i > _range.out);
                d.classList.toggle('mpi-frame-strip__thumb--range-in', i === _range.in);
                d.classList.toggle('mpi-frame-strip__thumb--range-out', i === _range.out);
            } else {
                d.classList.remove('mpi-frame-strip__thumb--outside');
                d.classList.remove('mpi-frame-strip__thumb--range-in');
                d.classList.remove('mpi-frame-strip__thumb--range-out');
            }

            // Edited mark (MPI-771 Mask Brush).
            const vp = _viewerPosOf(i);
            d.classList.toggle('mpi-frame-strip__thumb--edited', _edited.has(vp));

            // Mask tint: remove the old one (if any) and add a fresh one.
            const old = qs('.mpi-frame-strip__thumb-tint', d);
            if (old) old.remove();
            const maskUrl = vp === undefined ? null : _maskOverlay?.[vp];
            if (maskUrl) {
                const tint = document.createElement('div');
                tint.className = 'mpi-frame-strip__thumb-tint';
                tint.style.webkitMaskImage = `url("${maskUrl}")`;
                tint.style.maskImage = `url("${maskUrl}")`;
                d.appendChild(tint);
            }
        }

        // ── Context menu items (GIF-specific) ────────────────────────────
        //
        // MpiThumbStrip passes (index, selection) and MpiFrameStrip builds the
        // items. The onSelect handling is done via strip's 'menu-select' event.
        // An Organism MAY call MpiContextMenu.show() directly, but going through
        // the shell hop is equivalent and avoids an extra import.

        function _menuItems(index, selection) {
            const targets = new Set(selection.includes(index) ? selection : [index]);
            const vp = _viewerPosOf(index);
            const hasMask = vp !== undefined && !!_maskOverlay?.[vp];
            const n = targets.size;
            return [
                {
                    key: 'duplicate',
                    icon: 'copy',
                    label: n > 1 ? `Duplicate ${n} frames` : 'Duplicate frame',
                    info: 'Stages a copy right after each frame — Update or Apply saves it',
                },
                {
                    key: 'delete',
                    icon: 'trash',
                    label: n > 1 ? `Delete ${n} frames` : 'Delete frame',
                    danger: true,
                    kbd: 'Backspace',
                    disabled: _staged.length - n < 1,
                    info: 'Stages the delete — Update or Apply saves it',
                },
                {
                    key: 'clear-mask',
                    icon: 'eraser',
                    label: "Clear this frame's mask",
                    disabled: !hasMask,
                    info: hasMask
                        ? "Throws this frame's cut-out mask and brush fixes away"
                        : 'This frame has no cut-out mask',
                },
            ];
        }

        // ── Mount MpiThumbStrip ──────────────────────────────────────────

        const strip = MpiThumbStrip.mount(qs('.mpi-frame-strip__track', el), {
            allowReorder: true,
            decorateThumb: _decorateThumb,
            menuItems: _menuItems,
        });

        // ── Wire MpiThumbStrip events ────────────────────────────────────
        // A component's `on()` returns no unsubscribe; `strip.destroy()` drops these.

        strip.on('thumb-select', ({ index }) => {
            emit('frame-select', { index });
        });

        strip.on('selection-change', () => {
            _emitSelection();
        });

        strip.on('scrub', ({ index }) => {
            emit('scrub', { index });
        });

        strip.on('reorder', ({ from, to }) => {
            // The strip has already moved the item visually. Sync _staged and _origin.
            const [movedFrame]  = _staged.splice(from, 1);
            _staged.splice(to, 0, movedFrame);
            const [movedOrigin] = _origin.splice(from, 1);
            _origin.splice(to, 0, movedOrigin);
            // Rebuild the items so MpiThumbStrip's internal array matches _staged
            // (keys, info strings). The strip re-renders — same positions, no flash.
            strip.el.setItems(_makeItems(), { currentIndex: _currentIndex });
            _emitStage();
        });

        strip.on('menu-select', ({ key, index, selection }) => {
            const targets = new Set(selection.includes(index) ? selection : [index]);
            if (key === 'duplicate') _duplicateIndices(targets);
            else if (key === 'delete') _deleteIndices(targets);
            else if (key === 'clear-mask') {
                const vp = _viewerPosOf(index);
                emit('clear-frame-mask', { index, viewerIndex: vp });
            }
        });

        // ── Pill buttons ─────────────────────────────────────────────────

        const discardBtn = MpiButton.mount(qs('[data-mount="discard-btn"]', el),
            { text: 'Discard', variant: 'ghost', size: 'sm', info: 'Undo these frame changes' });
        const updateBtn = MpiButton.mount(qs('[data-mount="update-btn"]', el),
            { text: 'Update', variant: 'secondary', size: 'sm', info: 'Rewrite this entry' });
        const applyBtn  = MpiButton.mount(qs('[data-mount="apply-btn"]', el),
            { text: 'Apply',  variant: 'primary',   size: 'sm', info: 'Save as a new entry' });

        discardBtn.on('click', () => {
            _staged = _committed.slice();
            _origin = _staged.map((_, i) => i);
            _currentIndex = Math.max(0, Math.min(_staged.length - 1, _currentIndex));
            strip.el.setItems(_makeItems(), { currentIndex: _currentIndex });
            // setItems clears selection → strip emits selection-change → _emitSelection() fires
            _emitStage();
        });
        updateBtn.on('click', () => emit('update', { frames: _staged.slice() }));
        applyBtn.on('click',  () => emit('apply',  { frames: _staged.slice() }));

        // ── Public API ───────────────────────────────────────────────────

        el.setFrames = (frames, { currentIndex = 0 } = {}) => {
            _committed = Array.isArray(frames) ? frames.slice() : [];
            _staged = _committed.slice();
            _resetOrigin();
            _clampRange();
            _currentIndex = Math.max(0, Math.min(_staged.length - 1, currentIndex || 0));
            strip.el.setItems(_makeItems(), { currentIndex: _currentIndex });
            _syncPill();
        };

        el.setCurrentIndex = (idx) => {
            if (!_staged.length) return;
            const clamped = Math.max(0, Math.min(_staged.length - 1, Math.round(idx)));
            _currentIndex = clamped;
            strip.el.setCurrentIndex(clamped);
        };

        el.setRange = (range) => {
            const last = Math.max(0, _staged.length - 1);
            if (!range || !Number.isFinite(+range.in) || !Number.isFinite(+range.out)) {
                if (!_range) return;
                _range = null;
            } else {
                const a = Math.max(0, Math.min(last, Math.round(+range.in)));
                const b = Math.max(0, Math.min(last, Math.round(+range.out)));
                const next = { in: Math.min(a, b), out: Math.max(a, b) };
                if (_range && _range.in === next.in && _range.out === next.out) return;
                _range = next;
            }
            // Cheap pass: re-decorate existing thumbs, no DOM rebuild.
            strip.el.repaintThumbs();
        };

        el.getStagedFrames = () => _staged.slice();

        /** VIEWER positions of the selected thumbs — the cut-out panel reads this. */
        el.getSelection = () => strip.el.getSelection()
            .map(_viewerPosOf)
            .filter(v => v !== undefined);

        el.setMaskOverlay = (masks, edited = []) => {
            _maskOverlay = Array.isArray(masks) ? masks : null;
            _edited = new Set(edited);
            // Cheap pass: re-decorate existing thumbs with the new tint data.
            strip.el.repaintThumbs();
        };

        el.commit = (frames) => {
            _committed = Array.isArray(frames) ? frames.slice() : _staged.slice();
            _staged = _committed.slice();
            _resetOrigin();
            _clampRange();
            // The Block reloads the saved entry into the viewer via `loadFrames()`
            // which always resets ITS index to 0 — match here so the marker and
            // counter stay in sync.
            _currentIndex = 0;
            strip.el.setItems(_makeItems(), { currentIndex: 0 });
            _syncPill();
        };

        // ── Delete (staged only) ─────────────────────────────────────────

        const _canDrive = () => el.isConnected && el.getClientRects().length > 0;

        /**
         * Stage a delete of `indices` (staged positions). Shared by the Backspace
         * hotkey and the context menu — both stage the SAME edit.
         * @param {Set<number>|number[]} indices
         */
        function _deleteIndices(indices) {
            const drop = indices instanceof Set ? indices : new Set(indices);
            if (drop.size === 0) return;
            // A GIF needs at least one frame.
            if (_staged.length - drop.size < 1) return;
            _staged = _staged.filter((_, i) => !drop.has(i));
            _origin = _origin.filter((_, i) => !drop.has(i));
            _clampRange();
            _currentIndex = Math.max(0, Math.min(_staged.length - 1, _currentIndex));
            strip.el.setItems(_makeItems(), { currentIndex: _currentIndex });
            // setItems clears selection → strip emits selection-change → _emitSelection() fires
            _emitStage();
        }

        /**
         * Stage a copy of every frame in `indices`, each right after itself
         * (MPI-857). The frames store is content-addressed, so a duplicate costs
         * zero bytes — it's one more entry in the list.
         * @param {Set<number>|number[]} indices staged positions
         */
        function _duplicateIndices(indices) {
            const src = [...(indices instanceof Set ? indices : new Set(indices))].sort((a, b) => a - b);
            if (src.length === 0) return;
            // Descending: each splice leaves every lower position alone.
            for (let k = src.length - 1; k >= 0; k--) {
                const i = src[k];
                if (!_staged[i]) continue;
                // The copy gets its own negative token but POINTS AT the source's
                // viewer position, so _emitStage's `order` carries the mask along.
                const token = _dupToken--;
                _viewerPos.set(token, _viewerPosOf(i));
                _staged.splice(i + 1, 0, { ..._staged[i] });
                _origin.splice(i + 1, 0, token);
                if (i < _currentIndex) _currentIndex++;
            }
            strip.el.setItems(_makeItems(), { currentIndex: _currentIndex });
            // setItems clears selection → strip emits selection-change → _emitSelection()
            _emitStage();
        }

        // Bound to all three ids: the selection is made with Ctrl (or Shift)
        // held, and the modifier is usually still held at the Backspace —
        // which normalises to `control+backspace`, a different key entirely.
        const _deleteSelection = () => {
            if (!_canDrive() || strip.el.getSelection().length === 0) return;
            _deleteIndices(new Set(strip.el.getSelection()));
        };
        for (const id of ['gif.frame.delete', 'gif.frame.delete.ctrl', 'gif.frame.delete.shift']) {
            _hotkeyUnsubs.push(Hotkeys.bind(id, _deleteSelection));
        }

        // ── Teardown ─────────────────────────────────────────────────────

        el.destroy = () => {
            _unsubs.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
            _hotkeyUnsubs.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
            try { strip.destroy(); } catch (_) { /* noop */ }
            try { discardBtn.destroy(); } catch (_) { /* noop */ }
            try { updateBtn.destroy(); } catch (_) { /* noop */ }
            try { applyBtn.destroy(); } catch (_) { /* noop */ }
        };
    },
});
