/**
 * MpiGifViewer — Organism: full-colour GIF frame display (MPI-769).
 *
 * Shows the group's GIF entry frame-by-frame, full colour, decoded at the
 * viewer's own size — never the built (256-colour) `.gif` file, unless the
 * user flips the "GIF preview" toggle, which swaps in the built file as a
 * plain `<img>` so it can be sanity-checked against the frames it was built
 * from. A small window of frames around the current index is kept warm in
 * the browser's own image cache (`_preloadWindow`) so a long GIF never loads
 * every frame at once.
 *
 * The control bar (MpiGifControlBar) and the frame strip (MpiFrameStrip) are
 * NOT owned by the viewer, and unlike MpiVideoViewer this component has no
 * inner sub-component to broker the connection through — it IS the surface.
 * The parent Block holds all three instances already (it mounted them), so
 * it wires them directly: `gifControlBar.el.attachViewer(viewer)` (the
 * `viewer` INSTANCE object `MpiGifViewer.mount()` returned, which already has
 * `.on()`), and both the control bar and the frame strip listen for this
 * viewer's `frame-change` and drive it back via `setFrameIndex`/`stepFrame`.
 *
 * Playback owns its own timer chain because GIF delays are per-frame, not a
 * constant fps: video's `<video>`-driven play/pause has nothing to attach to
 * here. `gif.loop` is total PLAYS (0 = forever, 1 = once, N = N plays) — the
 * same unit `services/gifFrames.js` / `routes/gif.js` already use.
 *
 * Instance API (on el):
 *   loadFrames(frames, { loop = 0 } = {})  — replace the frame list, reset to
 *                                            frame 0, stop any playback.
 *   setFrames(frames, order?)              — replace the frame list WITHOUT
 *                                            resetting position (staged strip
 *                                            edits): keeps showing the same
 *                                            frame (by hash) when it still
 *                                            exists, else clamps the index.
 *                                            `order[newPos]` = that frame's
 *                                            position in the current list; the
 *                                            cut-out masks move with it. No
 *                                            `order` = the masks are cleared.
 *   getFrames() / getFrameCount() / getFrameIndex()
 *   setFrameIndex(idx)                     — jump to an exact index (clamped)
 *   stepFrame(delta)                       — relative step (clamped, no wrap)
 *   play() / pause() / isPlaying()
 *   setGifUrl(url)                         — the built `.gif`'s resolved URL,
 *                                            shown when preview mode is on
 *   setPreview(bool) / togglePreview() / isPreview()
 *   setGenerating(bool) / setLoading(bool) — spinner, OR'd like every viewer
 *   setMaskTint(url|null)                  — MPI-771 (UI half): tint the CURRENT
 *                                            frame with a mask PNG via CSS
 *                                            `mask-image` on a solid overlay —
 *                                            a read-only preview, not a canvas/
 *                                            paint layer, so no UndoStack entry
 *                                            applies (docs/masking-sam3-gif.md).
 *                                            Owned by the cut-out tool panel;
 *                                            `null` clears it.
 *
 * Cut-out masks (MPI-771, plan Decision 14) — per frame POSITION, carried along a
 * staged reorder/delete and emptied when a different list loads (`gifFrameMasks.js`):
 *   setTrackMasks(urls) / setTrackMask(idx, url) — engine masks (Track All /
 *                                            Track Single Frame). Brush fixes stay.
 *   getFrameMaskURL(idx)                   — Promise: what `idx` would cut with
 *                                            (a composed B/W PNG when it was
 *                                            brushed, the track URL, or null)
 *   getCutMasks()                          — Promise: one mask per frame for
 *                                            `/gif-cutout/apply` (an empty frame
 *                                            comes through unchanged: a 1x1
 *                                            WHITE PNG = keep the whole frame)
 *   clearFrameMasks('all' | idx)           — throw track AND brush layers away;
 *                                            the only way back to no mask at all
 *   hasFrameMasks()
 *   enterMode('mask'|'none') / exitMode()  — the Mask Brush: an MpiCanvas over
 *                                            the stage holding the current frame,
 *                                            its track as the BASE layer and its
 *                                            brush layers. Stepping frames saves
 *                                            and reloads, keeping a zoomed view.
 *                                            Play hides the canvas and plays the
 *                                            frames under their mask tint (a
 *                                            flicker check); pause brings the
 *                                            canvas back on the current frame.
 *   enterMode('crop')                      — MPI-773: the same MpiCanvas in crop
 *                                            mode over the current frame; the box
 *                                            survives frame steps (frames share a size)
 *   setCropRatio(r) / setCropSize(w, h) / getCropRect() — the surface
 *                                            `MpiToolOptionsCrop` drives (image names)
 *   isMaskEditing()                        — any canvas tool is up (Mask Brush or Crop)
 *   getFrameSize()                         — Promise<{w, h}> of the current frame
 *   setMaskBrushMode, setMaskBrushPreset, setMaskInverted, isMaskInverted,
 *   setMaskBwView, isMaskBwView, setMaskPaintEnabled, setMaskOpacity,
 *   clearMask                              — the `MpiMaskStrip` surface, so the
 *                                            image-mode `MpiToolOptionsMaskBrush`
 *                                            drives this viewer unchanged.
 *   destroy()
 *
 * The Block wires the control bar / frame strip to this component's own
 * `.on()` (the instance `MpiGifViewer.mount()` returned) — there is no
 * attach method on `el` for either.
 *
 * Emits:
 *   'frame-change' { idx, frame } — index changed (step, scrub, playback)
 *   'play' / 'pause' / 'ended'
 *   'preview-change' { preview }
 *   'edit-change'  { editing }      — a canvas tool (Mask Brush, Crop) opened or closed
 *   'masks-change' { overlay, edited } — per-position mask URLs for the strip
 *                                   tint, and the brushed positions
 *
 * On the GLOBAL bus (not `emit`), the way the other two viewers do it:
 *   'gif-viewer:context-menu' { x, y } — right-click on the stage; the Block
 *                                   owns the items.
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { MpiCanvas } from '../../Primitives/MpiCanvas/MpiCanvas.js';
import { MaskManager } from '../../Primitives/MpiCanvas/managers/MaskManager.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { Events } from '../../../events.js';
import { qs, on } from '../../../utils/dom.js';
import { GifFrameMasks } from './gifFrameMasks.js';

/** Frames kept decoded around the current index, each side. */
const CACHE_RADIUS = 6;
/** GIF delay unit is hundredths of a second; never schedule under this floor
 *  (mirrors services/gifFrames.js MIN_DELAY_HUNDREDTHS so a corrupt/zero
 *  delay can't spin the timer chain). */
const MIN_DELAY_MS = 20;

export const MpiGifViewer = ComponentFactory.create({
    name: 'MpiGifViewer',
    css: ['js/components/Organisms/MpiGifViewer/MpiGifViewer.css'],

    template: () => `
        <div class="mpi-gif-viewer" data-mode="frames">
            <div class="mpi-gif-viewer__stage">
                <div class="mpi-gif-viewer__frame-wrap">
                    <div class="mpi-gif-viewer__checker"></div>
                    <img class="mpi-gif-viewer__frame" alt="" />
                    <div class="mpi-gif-viewer__mask-tint" id="mask-tint"></div>
                </div>
                <img class="mpi-gif-viewer__preview" alt="" hidden />
                <div class="mpi-gif-viewer__edit" id="edit-slot" hidden></div>
                <div class="mpi-gif-viewer__spinner" id="spinner-wrap"></div>
            </div>
        </div>
    `,

    setup: (el, props, emit) => {
        const frameWrap  = qs('.mpi-gif-viewer__frame-wrap', el);
        const frameImg   = qs('.mpi-gif-viewer__frame', el);
        const maskTintEl = qs('#mask-tint', el);
        const previewImg = qs('.mpi-gif-viewer__preview', el);
        const spinnerWrap = qs('#spinner-wrap', el);
        const editSlot   = qs('#edit-slot', el);
        MpiSpinner.mount(spinnerWrap, { size: 'lg', variant: 'primary' });
        // The checker behind the frame takes the frame's aspect ratio.
        const _offFrameLoad = on(frameImg, 'load', () => {
            if (frameImg.naturalHeight) frameWrap.style.setProperty('--frame-ar', frameImg.naturalWidth / frameImg.naturalHeight);
        });

        // MPI-771 (consistency audit, Fabio 2026-09-19): the stage joins the shared
        // context menu the image and video viewers already use. Same shape as
        // MpiVideoViewer's — the VIEWER only reports the gesture, the owning Block
        // builds the items, because only it knows the entry and the routes.
        const _offCtxMenu = on(el, 'contextmenu', (e) => {
            e.preventDefault();
            Events.emit('gif-viewer:context-menu', { x: e.clientX, y: e.clientY });
        });

        const _masks = new GifFrameMasks();
        /** Mask Brush / Crop surface (MPI-771, MPI-773) — mounted only while the tool is up. */
        let _canvas = null;
        let _editing = false;
        /** Which tool owns the canvas: 'mask' | 'crop' (null when none). */
        let _editKind = null;
        /** Crop shape, kept across tool visits like the image canvas keeps it. */
        let _cropRatio = 1;
        let _cropSize = null;
        /** Position whose layers the canvas holds; -1 while a frame is loading. */
        let _editIdx = -1;
        let _editToken = 0;
        /** The canvas layers changed since they were loaded or saved. */
        let _dirty = false;
        /** Brush size outlives one visit to the tool, as it does on the image canvas. */
        let _brushSize = null;

        /** @type {Array<{hash:string, url:string, thumbUrl:string, delay:number}>} */
        let _frames = [];
        let _index = 0;
        let _loop = 0; // total plays; 0 = forever
        let _playsDone = 0;
        let _playing = false;
        let _playTimer = null;
        let _preview = false;
        let _gifUrl = null;

        /** @type {Map<string, HTMLImageElement>} hash -> warmed Image */
        const _cache = new Map();

        let _isGenerating = false;
        let _isLoading = false;
        const _syncSpinner = () => {
            spinnerWrap.classList.toggle('mpi-gif-viewer__spinner--visible', _isGenerating || _isLoading);
        };

        function _preloadWindow(idx) {
            const keep = new Set();
            for (let d = -CACHE_RADIUS; d <= CACHE_RADIUS; d++) {
                const f = _frames[idx + d];
                if (!f) continue;
                keep.add(f.hash);
                if (!_cache.has(f.hash)) {
                    const img = new Image();
                    img.src = f.url;
                    _cache.set(f.hash, img);
                }
            }
            for (const hash of [..._cache.keys()]) {
                if (!keep.has(hash)) _cache.delete(hash);
            }
        }

        function _render() {
            const f = _frames[_index];
            if (!f) return;
            frameImg.src = f.url;
            if (_editing && _playing) { if (_editKind === 'mask') _setTint(_masks.overlayAt(_index), true); }
            else if (_editing) _loadEditFrame(_index);
            emit('frame-change', { idx: _index, frame: f });
        }

        function _stopPlayback() {
            if (_playTimer) { clearTimeout(_playTimer); _playTimer = null; }
            if (_playing) {
                _playing = false;
                if (_editing) _showEditCanvas();
                emit('pause');
            }
        }

        function _scheduleNext() {
            const f = _frames[_index];
            const delayMs = Math.max(MIN_DELAY_MS, (Number(f?.delay) || 10) * 10);
            _playTimer = setTimeout(() => {
                if (!_playing) return;
                if (_index >= _frames.length - 1) {
                    _playsDone++;
                    if (_loop !== 0 && _playsDone >= _loop) {
                        _stopPlayback();
                        emit('ended');
                        return;
                    }
                    _index = 0;
                } else {
                    _index++;
                }
                _preloadWindow(_index);
                _render();
                _scheduleNext();
            }, delayMs);
        }

        // ── Instance API ─────────────────────────────────────────────────

        el.loadFrames = (frames, { loop = 0 } = {}) => {
            _stopPlayback();
            _frames = Array.isArray(frames) ? frames.slice() : [];
            _loop = Number.isFinite(+loop) ? +loop : 0;
            _index = 0;
            _cache.clear();
            // A saved revision of the same list keeps its masks; the strip
            // re-reads them either way.
            if (!_syncMasks(false)) _emitMasks();
            if (_frames.length) {
                _preloadWindow(0);
                _render();
            }
        };

        el.setFrames = (frames, order = null) => {
            const prevHash = _frames[_index]?.hash;
            const next = Array.isArray(frames) ? frames.slice() : [];
            if (Array.isArray(order) && order.length === next.length) {
                _saveEdit(); // the canvas layers belong to the OLD position
                _masks.remap(next, order);
                _editIdx = -1;
                _dirty = false;
                _frames = next;
                _emitMasks();
            } else {
                _frames = next;
                _syncMasks(true);
            }
            let idx = _frames.findIndex(f => f.hash === prevHash);
            if (idx === -1) idx = Math.min(_index, Math.max(0, _frames.length - 1));
            _index = idx;
            _preloadWindow(_index);
            if (_frames.length) _render();
        };

        el.getFrames      = () => _frames.slice();
        el.getFrameCount  = () => _frames.length;
        el.getFrameIndex  = () => _index;

        el.setFrameIndex = (idx) => {
            if (!_frames.length) return;
            const clamped = Math.max(0, Math.min(_frames.length - 1, Math.round(idx)));
            if (clamped === _index) return;
            _index = clamped;
            _preloadWindow(_index);
            _render();
        };

        el.stepFrame = (delta) => el.setFrameIndex(_index + (Number(delta) || 0));

        el.play = () => {
            if (_playing || _preview || _frames.length < 2) return;
            _playing = true;
            _playsDone = 0;
            // The brush canvas would reload every frame: play the plain frames
            // under their mask tint instead (Fabio, 2026-09-16).
            if (_editing) _hideEditCanvas();
            emit('play');
            _scheduleNext();
        };
        el.pause     = () => _stopPlayback();
        el.isPlaying = () => _playing;

        el.setGifUrl = (url) => {
            _gifUrl = url || null;
            if (_preview) {
                previewImg.src = _gifUrl || '';
                previewImg.hidden = !_gifUrl;
            }
        };

        el.setPreview = (on) => {
            const next = !!on;
            if (next === _preview) return;
            if (next && _editing) return; // the brush paints frames, not the built file
            _preview = next;
            if (_preview) {
                _stopPlayback();
                previewImg.src = _gifUrl || '';
                previewImg.hidden = !_gifUrl;
                // Hide the whole wrap, tint included — a mask preview means
                // nothing over the built (256-colour) `.gif`.
                frameWrap.hidden = true;
            } else {
                previewImg.hidden = true;
                frameWrap.hidden = false;
            }
            emit('preview-change', { preview: _preview });
        };
        el.togglePreview = () => el.setPreview(!_preview);
        el.isPreview     = () => _preview;

        el.setGenerating = (on) => { _isGenerating = !!on; _syncSpinner(); };
        el.setLoading    = (on) => { _isLoading = !!on; _syncSpinner(); };

        // MPI-771 (UI half): a solid overlay clipped to the mask PNG via CSS
        // `mask-image`, sized to the frame img's own rendered box by
        // `.mpi-gif-viewer__frame-wrap` (docs/masking-sam3-gif.md) — read-only
        // preview, never a canvas layer, so no UndoStack entry applies.
        /** `luma`: an opaque B/W mask (engine / composed) rather than an alpha one. */
        function _setTint(url, luma = false) {
            maskTintEl.classList.toggle('mpi-gif-viewer__mask-tint--luma', !!url && luma);
            if (url) {
                maskTintEl.style.webkitMaskImage = `url("${url}")`;
                maskTintEl.style.maskImage = `url("${url}")`;
                maskTintEl.classList.add('mpi-gif-viewer__mask-tint--visible');
            } else {
                maskTintEl.classList.remove('mpi-gif-viewer__mask-tint--visible');
                maskTintEl.style.webkitMaskImage = '';
                maskTintEl.style.maskImage = '';
            }
        }
        el.setMaskTint = (url) => _setTint(url);

        // ── Cut-out masks (MPI-771, plan E10) ────────────────────────────

        function _emitMasks(cleared = false) {
            emit('masks-change', {
                overlay: _masks.hasAny() ? _masks.overlay(_frames.length) : null,
                edited: _masks.editedIndices(),
                cleared,
            });
        }

        /**
         * A different frame list makes every position-keyed mask meaningless.
         * `announce`: a staged edit with no `order` threw masks away (a new entry did not).
         * @returns {boolean} true when the masks changed (dropped, or restored from the stash)
         */
        function _syncMasks(announce) {
            const had = _masks.hasAny();
            if (!_masks.sync(_frames)) return false;
            // The canvas still holds the old position's layers — never save them
            // into the new list.
            _editIdx = -1;
            _dirty = false;
            _emitMasks(announce && had);
            return true;
        }

        /**
         * Rebuild a brushed position's composite after its track changed. The
         * one compositor is `MaskManager`, run headless here.
         */
        async function _recompose(idx) {
            const edits = _masks.edits.get(idx);
            const f = _frames[idx];
            if (!edits || !f) return null;
            const img = new Image();
            img.src = f.url;
            await img.decode();
            const mm = new MaskManager();
            try {
                mm.init(img.naturalWidth, img.naturalHeight);
                await mm.setBaseFromDataURL(_masks.track.get(idx) || null);
                await mm.setManualFromDataURL(edits.manual);
                await mm.setSubtractFromDataURL(edits.subtract);
                if (_masks.edits.get(idx) !== edits) return null; // list changed meanwhile
                const url = mm.getURL('black', 'white');
                _masks.composed.set(idx, url);
                return url;
            } finally {
                mm.destroy();
            }
        }

        async function _recomposeStale() {
            for (const i of _masks.editedIndices()) {
                if (i === _editIdx || _masks.maskFor(i) !== undefined) continue;
                try { await _recompose(i); } catch (err) {
                    clientLogger.warn('MpiGifViewer', `mask recompose failed: ${err?.message || err}`);
                }
            }
            _emitMasks();
        }

        /** The canvas frame's track changed under its brush layers. */
        function _refreshEditBase() {
            if (!_canvas || _editIdx < 0) return;
            const idx = _editIdx;
            _canvas.el.setMaskBase(_masks.track.get(idx) || null).then(() => {
                if (_editIdx !== idx || !_masks.hasEdits(idx)) return;
                _dirty = true; // its composite depends on the base
                _saveEdit();
            }).catch(err => clientLogger.warn('MpiGifViewer', `mask base load failed: ${err?.message || err}`));
        }

        el.setTrackMasks = (urls) => {
            _masks.setTrackAll(urls);
            _refreshEditBase();
            _emitMasks();
            _recomposeStale();
        };

        el.setTrackMask = (idx, url) => {
            _masks.setTrack(idx, url);
            if (idx === _editIdx) _refreshEditBase();
            else if (_masks.hasEdits(idx)) _recomposeStale();
            _emitMasks();
        };

        el.hasFrameMasks = () => _masks.hasAny();

        /**
         * Throw masks away for good — track AND brush layers, so a re-mask starts
         * from nothing. `'all'`, or one position.
         * @param {'all'|number} scope
         */
        el.clearFrameMasks = (scope) => {
            if (scope === 'all') _masks.clearAll(); else _masks.clear(scope);
            if (_canvas && _editIdx >= 0 && (scope === 'all' || scope === _editIdx)) {
                // The open brush frame holds its layers on the canvas, not in the
                // store: clearing only the store would save them straight back.
                _canvas.el.clearMask();
                _canvas.el.setMaskBase(null).catch(err =>
                    clientLogger.warn('MpiGifViewer', `mask base clear failed: ${err?.message || err}`));
                _dirty = false;
            }
            _emitMasks();
        };

        el.getFrameMaskURL = async (idx) => {
            if (idx === _editIdx) _saveEdit();
            const m = _masks.maskFor(idx);
            return m === undefined ? _recompose(idx) : m;
        };

        let _emptyMask = null;
        el.getCutMasks = async () => {
            _saveEdit();
            if (!_emptyMask) {
                // `routes/gifCutout.js` resizes a mask to its frame, so 1x1 white is
                // "keep the whole frame" at any size. WHITE, not black: masking one
                // frame and cutting used to hand every other frame a fully
                // transparent alpha plane, so the result was an empty GIF (Fabio,
                // 2026-09-18). An unmasked frame is one the user did not touch —
                // it comes through unchanged.
                const c = document.createElement('canvas');
                c.width = c.height = 1;
                const ctx = c.getContext('2d');
                ctx.fillStyle = 'oklch(1 0 0)';
                ctx.fillRect(0, 0, 1, 1);
                _emptyMask = c.toDataURL('image/png');
            }
            const out = [];
            for (let i = 0; i < _frames.length; i++) out.push((await el.getFrameMaskURL(i)) || _emptyMask);
            return out;
        };

        // ── Mask Brush edit mode ─────────────────────────────────────────

        function _saveEdit() {
            if (!_canvas || _editIdx < 0 || !_dirty) return;
            const manual = _canvas.el.getManualURL();
            const subtract = _canvas.el.getSubtractURL();
            const composed = (manual || subtract) ? _canvas.el.getMaskDataURL('black', 'white') : null;
            _masks.setEdits(_editIdx, { manual, subtract, composed });
            _dirty = false;
            _emitMasks();
        }

        async function _loadEditFrame(idx) {
            if (!_canvas) return;
            _saveEdit();
            const token = ++_editToken;
            _editIdx = -1;
            const f = _frames[idx];
            if (!f) return;
            const cv = _canvas.el;
            // Frames share one size, so a zoomed or panned view carries over,
            // and so does a crop box (loadImage() re-seeds it).
            const view = cv.isManagedView ? null : { scale: cv.scale, x: cv.offsetX, y: cv.offsetY };
            const cropRect = _editKind === 'crop' && cv.img ? cv.getCropRect() : null;
            try {
                await cv.loadImage(f.url);
                if (token !== _editToken) return;
                if (view) {
                    cv.isManagedView = false;
                    cv.scale = view.scale;
                    cv.offsetX = view.x;
                    cv.offsetY = view.y;
                    cv.resize();
                }
                if (_editKind === 'crop') {
                    cv.activeMode = 'crop';
                    if (_cropSize) cv.setCropSize(_cropSize.w, _cropSize.h);
                    else cv.setCropRatio(_cropRatio);
                    if (cropRect?.w > 0) cv.setCropRect(cropRect);
                    _editIdx = idx;
                    return;
                }
                const edits = _masks.edits.get(idx);
                await cv.setMaskBase(_masks.track.get(idx) || null);
                if (edits?.manual) await cv.setManualFromDataURL(edits.manual);
                if (edits?.subtract) await cv.setSubtractFromDataURL(edits.subtract);
                if (token !== _editToken) return;
                // loadImage() drops every mode; arm painting once the layers are in.
                cv.activeMode = 'mask';
                _editIdx = idx;
                _dirty = false;
            } catch (err) {
                clientLogger.warn('MpiGifViewer', `mask frame load failed: ${err?.message || err}`);
            }
        }

        /** @param {'mask'|'crop'} kind */
        function _enterEdit(kind) {
            if (_destroyed) return;
            if (_editing && _editKind === kind) return;
            if (_editing) _exitEdit();
            _stopPlayback();
            el.setPreview(false);
            _editing = true;
            _editKind = kind;
            editSlot.hidden = false;
            frameWrap.hidden = true;
            _canvas = MpiCanvas.mount(editSlot, kind === 'mask' ? { onMaskStrokeEnd: () => { _dirty = true; } } : {});
            if (_brushSize) _canvas.el.setBrushSize(_brushSize);
            _loadEditFrame(_index);
            emit('edit-change', { editing: true });
        }

        /** Playback in the Mask Brush: the plain frame under its tint. The canvas
         *  keeps its layout (visibility, not display) so its view survives. */
        function _hideEditCanvas() {
            _saveEdit();
            _editToken++; // drop an in-flight frame load
            _editIdx = -1;
            editSlot.classList.add('mpi-gif-viewer__edit--playing');
            frameWrap.hidden = false;
            if (_editKind === 'mask') _setTint(_masks.overlayAt(_index), true);
        }

        function _showEditCanvas() {
            _setTint(null);
            editSlot.classList.remove('mpi-gif-viewer__edit--playing');
            frameWrap.hidden = true;
            _loadEditFrame(_index);
        }

        function _exitEdit() {
            if (!_editing) return;
            if (_playing) _setTint(null);
            _saveEdit();
            _editToken++;
            _brushSize = _canvas?.el.brushSize ?? _brushSize;
            _canvas?.destroy();
            _canvas = null;
            _editing = false;
            _editKind = null;
            _editIdx = -1;
            editSlot.hidden = true;
            editSlot.classList.remove('mpi-gif-viewer__edit--playing');
            frameWrap.hidden = _preview;
            emit('edit-change', { editing: false });
        }

        el.enterMode = (mode) => { if (mode === 'mask' || mode === 'crop') _enterEdit(mode); else _exitEdit(); };
        el.exitMode = () => _exitEdit();
        /** Any canvas tool (Mask Brush or Crop): the built-file preview is off meanwhile. */
        el.isMaskEditing = () => _editing;

        // The crop surface `MpiToolOptionsCrop` drives (MPI-773), same names as MpiCanvasViewer.
        el.setCropRatio = (ratio) => {
            _cropRatio = ratio;
            _cropSize = null;
            if (_editKind === 'crop') _canvas?.el.setCropRatio(ratio);
        };
        el.setCropSize = (w, h) => {
            if (!(w > 0) || !(h > 0)) return;
            _cropRatio = w / h;
            _cropSize = { w, h };
            if (_editKind === 'crop') _canvas?.el.setCropSize(w, h);
        };
        /** Image-space rect (may leave the frame), or null when Crop is not up. */
        el.getCropRect = () => (_editKind === 'crop' && _canvas?.el.img ? _canvas.el.getCropRect() : null);

        /** The current frame's pixel size (frames share one). */
        el.getFrameSize = async () => {
            const f = _frames[_index];
            if (!f) return null;
            const img = _cache.get(f.hash) || Object.assign(new Image(), { src: f.url });
            await img.decode();
            return { w: img.naturalWidth, h: img.naturalHeight };
        };

        // The MpiMaskStrip surface (`dest: 'mask'`), forwarded to the canvas.
        el.setMaskBrushMode = (mode) => {
            if (mode === 'brush' || mode === 'eraser') _canvas?.el.setBrushType(mode);
        };
        el.setMaskBrushPreset  = (id) => _canvas?.el.setBrushPreset(id);
        el.setMaskInverted     = (v) => _canvas?.el.setMaskInverted(v);
        el.isMaskInverted      = () => !!_canvas?.el.isMaskInverted();
        el.setMaskBwView       = (v) => _canvas?.el.setMaskBwView(v);
        el.isMaskBwView        = () => !!_canvas?.el.isMaskBwView();
        el.setMaskPaintEnabled = (v) => _canvas?.el.setMaskPaintEnabled(v);
        el.setMaskOpacity      = (v) => _canvas?.el.setMaskOpacity(v);
        /** This frame only. With a track it erases over it, so Ctrl+Z restores it. */
        el.clearMask = () => {
            if (!_canvas || _editIdx < 0) return;
            _canvas.el.clearMask();
            _dirty = true;
            _saveEdit();
        };

        let _destroyed = false;
        el.destroy = () => {
            if (_destroyed) return;
            _exitEdit();
            _destroyed = true;
            _stopPlayback();
            _offFrameLoad();
            _offCtxMenu();
            _cache.clear();
        };
    },
});
