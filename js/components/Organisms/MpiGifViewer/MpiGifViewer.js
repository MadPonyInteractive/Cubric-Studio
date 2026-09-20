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
 *   setCutoutPreview(url|null, proposalUrl|null) — MPI-771 audit: DISPLAY ONLY. Cut-out
 *                                            mounts the same canvas and the same
 *                                            MpiMaskStrip as the Mask Brush, but
 *                                            shows the ADJUSTED bitmap (Grow, Fill
 *                                            Holes) or the PROPOSAL instead of the
 *                                            stored mask. Never flipped: the store
 *                                            holds what gets cut (MPI-859). Drives the
 *                                            canvas while the tool is up and the CSS
 *                                            tint while the GIF plays, so play/pause
 *                                            never changes what the highlight means.
 *                                            Never read by getCutMasks(); `null`
 *                                            restores the real mask. `proposalUrl`
 *                                            (MPI-859) is a method run waiting on
 *                                            Add / Subtract, drawn GREEN OVER the
 *                                            white on both surfaces — the canvas
 *                                            through MaskManager's autoPickMasks
 *                                            layer, as the image workspace does.
 *
 * Cut-out masks (MPI-771, plan Decision 14) — per frame POSITION, carried along a
 * staged reorder/delete and emptied when a different list loads (`gifFrameMasks.js`):
 *   setTrackMasks(urls) / setTrackMask(idx, url) — engine masks (Track All /
 *                                            Track Single Frame). Brush fixes stay.
 *   setCandidateMasks(entries)             — MPI-859: what a METHOD RUN proposed,
 *                                            position -> URL. A proposal, not mask
 *                                            content: it shows on the tint and the
 *                                            strip, and `hasFrameMasks()` /
 *                                            `getCutMasks()` cannot see it, so an
 *                                            uncommitted run never reaches the cut
 *   commitCandidates('add'|'subtract')     — Promise<boolean>: fold every proposal
 *                                            into its frame's track (`maskCompose.js`),
 *                                            which is what makes two methods STACK
 *                                            on one frame instead of the second
 *                                            replacing the first (Fabio, 2026-09-20)
 *   discardCandidates() / hasCandidates() / candidateAt(idx)
 *   getFrameMaskURL(idx)                   — Promise: what `idx` would cut with
 *                                            (a composed B/W PNG when it was
 *                                            brushed, the track URL, or null)
 *   getCutMasks()                          — Promise: one mask per frame for
 *                                            `/gif-cutout/apply`, flipped ONCE to
 *                                            the route's keep-space (the store is
 *                                            what gets cut). An empty frame comes
 *                                            through unchanged: a 1x1 WHITE PNG =
 *                                            keep the whole frame
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
 *   isToolOwningDrag()                     — that tool owns a plain left-drag, so
 *                                            Space is its pan and not playback
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
 *   'edit-change'  { editing, ownsDrag } — a canvas tool (Mask Brush, Cut-out, Crop)
 *                                   opened or closed. `ownsDrag` says whether THAT
 *                                   tool takes a plain left-drag, so Space is its
 *                                   pan; it re-fires when `setMaskPaintEnabled`
 *                                   lands, which is after the tool opened.
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
import { composeFrameMask } from './maskCompose.js';
import { invertMaskUrl } from '../../../utils/maskUtils.js';

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
                    <div class="mpi-gif-viewer__mask-tint mpi-gif-viewer__mask-tint--proposal" id="proposal-tint"></div>
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
        const proposalTintEl = qs('#proposal-tint', el);
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
        /**
         * Cut-out's display override (MPI-771 consistency audit).
         *
         * Cut-out shows the ADJUSTED mask — grow, then flipped so the highlight marks
         * what DISAPPEARS (Fabio, 2026-09-19) — which is not what the store holds. It
         * mounts the same canvas and the same `MpiMaskStrip` as the Mask Brush, so
         * opacity / invert / B-W are one component in both tools; only the bitmap the
         * canvas is SHOWN differs. Null = show the real mask, which is every other tool.
         *
         * DISPLAY ONLY. `getFrameMaskURL()` and `getCutMasks()` read `_masks`, never
         * this, and the strip mounts with `brush: false` so nothing can write the
         * override back into the store.
         */
        let _cutoutPreview = null;
        /**
         * The PROPOSAL half of Cut-out's override (MPI-859): a method run waiting on
         * Add / Subtract, drawn GREEN ON TOP of `_cutoutPreview`'s white — both at
         * once, exactly as the image workspace shows a detect run over the mask it
         * is about to change. A proposal that REPLACED the view made every run look
         * like it had destroyed the mask already there (Fabio, 2026-09-20). Either
         * half may be null: a first run has no mask under it.
         */
        let _cutoutProposalUrl = null;
        /** Cut-out is driving the display — with a mask, a proposal, or both. */
        const _overrideOn = () => _cutoutPreview !== null || _cutoutProposalUrl !== null;
        /*
         * NO COMPLEMENT HERE (MPI-859, Fabio 2026-09-20). The store holds WHAT GETS
         * CUT and is drawn as itself — the image workspace's model, and the only one
         * the verbs read correctly: a run proposes a region in green, Add turns those
         * same pixels white, Subtract takes them back out. MPI-771 stored "what
         * stays" and complemented it on the way to the screen, so Add moved the
         * highlight to the OTHER side of the frame, and a By colour Add on an
         * already-kept region did nothing you could see.
         *
         * A committed mask looks exactly as it did: the complement of "what stays"
         * is the same pixels as "what gets cut". "The highlight marks what
         * disappears" is unchanged — it is now what the store literally holds rather
         * than a translation applied to it. `getCutMasks()` inverts once at the
         * boundary, so `routes/gifCutout.js` still receives keep-space and MPI-858's
         * alpha ceiling is untouched.
         */
        /** What the strip last asked for. */
        let _brushModeWanted = 'brush';
        /** Mask Brush / Crop surface (MPI-771, MPI-773) — mounted only while the tool is up. */
        let _canvas = null;
        let _editing = false;
        /** Which tool owns the canvas: 'mask' | 'crop' (null when none). */
        let _editKind = null;
        /** MpiCanvas arms mask painting by default; MpiMaskStrip pushes the real
         *  value down on mount, which is AFTER `enterMode` emits 'edit-change'. */
        let _paintEnabled = true;
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
            if (_editing && _playing) { if (_editKind === 'mask') _setPlayingTint(); }
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
        function _setTintEl(maskTintEl, url, luma = false) {
            if (!url) {
                // HIDE ONLY. `--luma` and the mask image stay exactly as they are
                // until the next mask replaces them. Dropping `--luma` here (or
                // clearing `mask-image`) while the PREVIOUS frame's opaque B/W mask
                // is still set falls the element back to `mask-mode: alpha` over an
                // alpha-255 bitmap, so `--mask-fill` covers the whole stage — and
                // `transition: opacity` then stretches that into a visible white
                // flash every time playback leaves a masked run of frames.
                maskTintEl.classList.remove('mpi-gif-viewer__mask-tint--visible');
                return;
            }
            // Bitmap and mode together, before the show: one style flush, so the
            // element is never painted with one frame's mask under the other's mode.
            const image = `url("${url}")`;
            maskTintEl.style.webkitMaskImage = image;
            maskTintEl.style.maskImage = image;
            maskTintEl.classList.toggle('mpi-gif-viewer__mask-tint--luma', luma);
            maskTintEl.classList.add('mpi-gif-viewer__mask-tint--visible');
        }
        /** The committed mask: white. */
        const _setTint = (url, luma = false) => _setTintEl(maskTintEl, url, luma);
        /** A proposal: green, stacked over the white (MPI-859). */
        const _setProposalTint = (url, luma = false) => _setTintEl(proposalTintEl, url, luma);

        /** The tint for a frame that playback just stepped ONTO. */
        function _setPlayingTint() {
            // Cut-out's override is per frame and the panel pushes the next one a
            // beat later; until it lands the last one is the closer answer.
            if (_overrideOn()) return;
            // The store IS what the screen shows, so there is nothing to translate:
            // the mask in white, a pending proposal in green over it (MPI-859).
            _setTint(_masks.committedAt(_index), true);
            _setProposalTint(_masks.candidateAt(_index), true);
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
                const url = mm.getURL('black', 'white', true);
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

        // ── Candidate masks — a run PROPOSES, Add / Subtract commits (MPI-859) ──
        //
        // Before this, every method landed through `setTrackMask` and REPLACED the
        // frame's track, so Background then By colour on one frame kept only the
        // second (Fabio, 2026-09-20). The image workspace solved this years-of-
        // cards ago and the fix is its model, not a new one: a run renders as a
        // proposal and waits for an explicit verb.

        el.setCandidateMasks = (entries) => {
            _masks.setCandidates(entries);
            _emitMasks();
        };

        el.hasCandidates = () => _masks.hasCandidates();
        el.candidateAt = (idx) => _masks.candidateAt(idx);

        el.discardCandidates = () => {
            if (!_masks.clearCandidates()) return false;
            _emitMasks();
            return true;
        };

        /**
         * Fold every proposal into the mask its frame already has.
         * @param {'add'|'subtract'} mode
         * @returns {Promise<boolean>} false when there was nothing to commit
         */
        el.commitCandidates = async (mode) => {
            const idxs = _masks.candidateIndices();
            if (!idxs.length) return false;
            for (const idx of idxs) {
                try {
                    const url = await composeFrameMask(_masks.track.get(idx) || null, _masks.candidateAt(idx), mode);
                    // `setTrack` drops the composite with it, so a brushed frame is
                    // rebuilt against the NEW base by `_recomposeStale()` below.
                    _masks.setTrack(idx, url);
                } catch (err) {
                    clientLogger.warn('MpiGifViewer', `mask ${mode} failed on frame ${idx}: ${err?.message || err}`);
                }
            }
            _masks.clearCandidates();
            // The brush frame holds its layers on the CANVAS, so its base has to be
            // reloaded there; every other frame is store-only.
            if (idxs.includes(_editIdx)) _refreshEditBase();
            _emitMasks();
            await _recomposeStale();
            return true;
        };

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
        /**
         * The store holds WHAT GETS CUT; `routes/gifCutout.js` reads a mask as
         * ALPHA, i.e. what stays. One inversion here is the whole translation
         * (MPI-859) — `applyMaskAlpha`, its Grow/Fill Holes/Invert and MPI-858's
         * frame-alpha ceiling all keep seeing exactly what they saw before.
         */
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
            for (let i = 0; i < _frames.length; i++) {
                const cut = await el.getFrameMaskURL(i);
                // An untouched frame masks NOTHING, which in keep-space is the same
                // 1x1 white "keep the whole frame" it has always been.
                out.push(cut ? await invertMaskUrl(cut) : _emptyMask);
            }
            return out;
        };

        // ── Mask Brush edit mode ─────────────────────────────────────────

        function _saveEdit() {
            if (!_canvas || _editIdx < 0 || !_dirty) return;
            const manual = _canvas.el.getManualURL();
            const subtract = _canvas.el.getSubtractURL();
            // SOFT (MPI-835): the track under the brush layers carries the engine's
            // own soft edge and the cut reads luma as alpha. The binary export grew
            // the WHOLE frame's mask by that feather the moment one stroke landed.
            const composed = (manual || subtract) ? _canvas.el.getMaskDataURL('black', 'white', true) : null;
            _masks.setEdits(_editIdx, { manual, subtract, composed });
            _dirty = false;
            _emitMasks();
        }

        /**
         * Loads are SERIALISED. A superseded load still has layer decodes in flight
         * past its last token check, so run side by side its late subtract lands on
         * the NEXT load's freshly wiped canvas — a brush layer on top of Cut-out's
         * override, or one frame's stroke on another. Queued, the newer
         * `loadImage()` always wipes whatever the older one left behind.
         */
        let _editLoad = Promise.resolve();
        function _loadEditFrame(idx) {
            if (!_canvas) return _editLoad;
            _saveEdit();
            const token = ++_editToken;
            _editIdx = -1;
            _editLoad = _editLoad.then(() => (token === _editToken ? _runEditLoad(idx, token) : undefined));
            return _editLoad;
        }

        async function _runEditLoad(idx, token) {
            const f = _frames[idx];
            const cv = _canvas?.el;
            if (!f || !cv) return;
            try {
                // Frames share one size, so a zoomed or panned view carries over,
                // and so does a crop box (loadImage() re-seeds it).
                const view = cv.isManagedView ? null : { scale: cv.scale, x: cv.offsetX, y: cv.offsetY };
                const cropRect = _editKind === 'crop' && cv.img ? cv.getCropRect() : null;
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
                // Cut-out's override is already the composed, adjusted, flipped
                // bitmap for THIS frame, so it replaces the base AND the brush
                // layers — re-applying the edits on top would double them.
                //
                // `_editIdx` DELIBERATELY STAYS -1. It does not mean "the frame on
                // the canvas", it means "the canvas holds this frame's real layers
                // and may be saved back", and under the override it holds neither:
                // the brush layers were never loaded. Setting it cost a brushed
                // frame its fix on master — a Track run lands `setTrackMask`,
                // `_refreshEditBase()` sees `_editIdx === idx` with edits present,
                // and calls `_saveEdit()`, which writes the canvas's EMPTY manual
                // and subtract over them. At -1, `_saveEdit`, `_refreshEditBase`
                // and `getFrameMaskURL`'s save-first all correctly treat this
                // canvas as read-only, and the panel repaints through
                // `onMasksChange` -> `setCutoutPreview()` anyway.
                if (_overrideOn()) {
                    await cv.setMaskBase(_cutoutPreview);
                    await _setCanvasProposal(cv, _cutoutProposalUrl);
                    if (token !== _editToken) return;
                    cv.activeMode = 'mask';
                    _dirty = false;
                    return;
                }
                const edits = _masks.edits.get(idx);
                const base = _masks.track.get(idx) || null;
                // The store's own layers: committed by definition, whatever the last
                // override was showing (MPI-859).
                cv.clearAutoPicks();
                await cv.setMaskBase(base);
                if (edits?.manual) await cv.setManualFromDataURL(edits.manual);
                if (edits?.subtract) await cv.setSubtractFromDataURL(edits.subtract);
                if (token !== _editToken) return;
                _applyBrushMode();
                // loadImage() drops every mode; arm painting once the layers are in.
                cv.activeMode = 'mask';
                _editIdx = idx;
                _dirty = false;
            } catch (err) {
                clientLogger.warn('MpiGifViewer', `mask frame load failed: ${err?.message || err}`);
            }
        }

        /**
         * Does the CANVAS TOOL own a plain left-drag? That, not "a canvas tool is
         * up", is what makes Space load-bearing (Fabio, 2026-09-19). Crop owns the
         * drag over its handles, and the Mask Brush owns it while it paints — in
         * both, hold-Space IS the only pan. Cut-out mounts the strip with
         * `brush: false`, so `mask.paintEnabled` is off and InputController's final
         * `else` already pans on a bare drag: Space is free there, and plays.
         */
        const _toolOwnsDrag = () => _editing && (_editKind === 'crop' || _paintEnabled);

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
            emit('edit-change', { editing: true, ownsDrag: _toolOwnsDrag() });
        }

        /** Playback in the Mask Brush: the plain frame under its tint. The canvas
         *  keeps its layout (visibility, not display) so its view survives. */
        function _hideEditCanvas() {
            _saveEdit();
            _editToken++; // drop an in-flight frame load
            _editIdx = -1;
            editSlot.classList.add('mpi-gif-viewer__edit--playing');
            frameWrap.hidden = false;
            // Same bitmap the canvas was showing, so play/pause never changes what
            // the highlight means.
            if (_editKind === 'mask') {
                // The override's bitmaps are alpha-encoded; the store's are opaque B/W.
                const over = _overrideOn();
                _setTint(over ? _cutoutPreview : _masks.committedAt(_index), !over);
                _setProposalTint(over ? _cutoutProposalUrl : _masks.candidateAt(_index), !over);
            }
        }

        function _showEditCanvas() {
            _setTint(null);
            _setProposalTint(null);
            editSlot.classList.remove('mpi-gif-viewer__edit--playing');
            frameWrap.hidden = true;
            _loadEditFrame(_index);
        }

        function _exitEdit() {
            if (!_editing) return;
            if (_playing) { _setTint(null); _setProposalTint(null); }
            // The override belongs to the tool that set it. Leaving Cut-out with it
            // still on would show the Mask Brush a preview instead of the store.
            _cutoutPreview = null;
            _cutoutProposalUrl = null;
            _saveEdit();
            _editToken++;
            _brushSize = _canvas?.el.brushSize ?? _brushSize;
            _canvas?.destroy();
            _canvas = null;
            _editing = false;
            _editKind = null;
            // Back to the canvas default, or a Cut-out visit would leave the NEXT
            // tool's Space dead before its strip has said anything.
            _paintEnabled = true;
            _editIdx = -1;
            editSlot.hidden = true;
            editSlot.classList.remove('mpi-gif-viewer__edit--playing');
            frameWrap.hidden = _preview;
            emit('edit-change', { editing: false, ownsDrag: false });
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
            if (mode !== 'brush' && mode !== 'eraser') return;
            _brushModeWanted = mode;
            _applyBrushMode();
        };
        /**
         * Paint paints and Erase erases (MPI-859). The swap this used to do existed
         * only because the canvas showed the complement of the layer it painted;
         * the store is now what the screen shows, so a stroke grows the region under
         * the cursor without translating anything — the image workspace's brush.
         */
        function _applyBrushMode() {
            _canvas?.el.setBrushType(_brushModeWanted);
        }
        el.setMaskBrushPreset  = (id) => _canvas?.el.setBrushPreset(id);
        el.setMaskInverted     = (v) => _canvas?.el.setMaskInverted(v);
        el.isMaskInverted      = () => !!_canvas?.el.isMaskInverted();
        el.setMaskBwView       = (v) => _canvas?.el.setMaskBwView(v);
        el.isMaskBwView        = () => !!_canvas?.el.isMaskBwView();
        el.setMaskPaintEnabled = (v) => {
            _paintEnabled = !!v;
            _canvas?.el.setMaskPaintEnabled(v);
            // Re-announce: the strip mounts AFTER `enterMode`, so the ownership the
            // control bar heard at open is stale by exactly this call.
            if (_editing) emit('edit-change', { editing: true, ownsDrag: _toolOwnsDrag() });
        };
        el.isToolOwningDrag = () => _toolOwnsDrag();
        el.setMaskOpacity      = (v) => _canvas?.el.setMaskOpacity(v);
        /** This frame only. With a track it erases over it, so Ctrl+Z restores it. */
        el.clearMask = () => {
            // Under Cut-out's override there is no brush layer to erase WITH — the
            // strip mounts `brush: false` — so the same button has to mean the same
            // thing by throwing this frame's mask away instead. Clearing only the
            // canvas would look like a dead button: the override would repaint on
            // the next tick from a store that still holds the mask.
            if (_overrideOn()) { el.clearFrameMasks(_index); return; }
            if (!_canvas || _editIdx < 0) return;
            _canvas.el.clearMask();
            _dirty = true;
            _saveEdit();
        };

        /**
         * The proposal on the CANVAS — the surface that is up while the tool is. It
         * goes through `MaskManager`'s own `autoPickMasks` layer, which is what the
         * image workspace draws a detect run with: green, over the mask, whatever
         * the strip's invert-display says. Display only — nothing here is saved, the
         * override canvas is read-only (`_editIdx === -1`) and the auto layer is
         * never exported.
         */
        async function _setCanvasProposal(cv, url) {
            if (!url) { cv.clearAutoPicks(); return; }
            const img = new Image();
            img.src = url;
            await img.decode();
            // Superseded while decoding: a newer override owns the layer now.
            if (url !== _cutoutProposalUrl) return;
            cv.setAutoPickMasks(new Map([[0, img]]));
            cv.setSelectedAutoPicks(new Set([0]));
        }
        /**
         * Cut-out's display override (MPI-771 audit). `null` restores the real mask.
         * Drives BOTH surfaces so play/pause never changes what the highlight means:
         * the canvas while the tool is up, the CSS tint while the GIF is playing.
         */
        el.setCutoutPreview = (url, proposalUrl = null) => {
            const arriving = !_overrideOn() && !!(url || proposalUrl);
            _cutoutPreview = url || null;
            _cutoutProposalUrl = proposalUrl || null;
            if (_editKind !== 'mask') return;
            // The override turns this canvas into a DISPLAY surface, so it stops
            // being the edit frame — see `_loadEditFrame`. It has to happen HERE
            // too, not only there: Cut-out's `enterMode('mask')` runs before its
            // first preview arrives, so the mount already took the normal branch
            // and claimed `_editIdx`. Leaving it claimed is what let a landing
            // track save empty brush layers over a real fix.
            if (_overrideOn()) _editIdx = -1;
            // Playing: the canvas is hidden behind the frame-wrap, so the tint is
            // what is on screen. `false` = an alpha mask, not an opaque B/W one.
            if (editSlot.classList.contains('mpi-gif-viewer__edit--playing')) {
                _setTint(_cutoutPreview, false);
                _setProposalTint(_cutoutProposalUrl, false);
                return;
            }
            if (!_canvas) return;

            // The FIRST override after a mount (or after a Clear) finds a canvas the
            // normal branch already filled: base, manual AND subtract. Swapping only
            // the base left the brush's subtract on top of a bitmap that is composed
            // and flipped already, so it erased the stroke back OUT of the tint — a
            // Mask Brush stroke read "goes" in the brush and "stays" here (Fabio,
            // 2026-09-19). Reload through the one branch that knows the override
            // replaces every layer; later overrides find only a base to swap.
            if (arriving) { _loadEditFrame(_index); return; }
            const cv = _canvas.el;
            cv.setMaskBase(_cutoutPreview)
                .then(() => _setCanvasProposal(cv, _cutoutProposalUrl))
                .catch(err => clientLogger.warn('MpiGifViewer', `cut-out preview load failed: ${err?.message || err}`));
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
