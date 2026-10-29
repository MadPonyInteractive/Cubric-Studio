/**
 * layerShared — the code the brush layers had copied between them (AUDIT D7).
 *
 * `MaskManager`, `PaintManager` and `CompositeManager` each held their own copy of the
 * stroke box, `MaskManager` and `PaintManager` their own undo pair and Adjust session.
 * Undo correctness is a stated invariant (`docs/masking-undo.md`), and three copies of
 * the code that feeds the stack is three places to open a hole in Ctrl+Z. So the copies
 * live here once, as method sets each manager mixes into its prototype:
 *
 *   Object.assign(MaskManager.prototype, strokeBoxMethods, oneShotUndoMethods, adjustMethods({...}));
 *
 * Mixed in rather than called as functions so every call site — `InputController`'s
 * `takeStrokeBox()`, `MpiCanvas`'s `beginAdjust()`/`endAdjust()` — stays exactly what it
 * was. What DIFFERS between the layers stays in the managers: what a stroke paints, the
 * Adjust preview's fills, and what a Fill composites. This file never touches a pixel of
 * a layer itself; it only reads them.
 *
 * Node-testable against a fake 2D context: `tests/layer-shared.test.cjs`.
 */

import { fieldOverContent } from './distanceField.js';
import { holeFlood } from './holeFlood.js';

/** The in-flight stroke's dirty box — all three brush layers. Coords in layer px. */
export const strokeBoxMethods = {
    /**
     * Take the dirty box the stroke in flight accumulated and reset it. Padded by
     * 1px because the brush arc is antialiased past its own radius.
     * @returns {{x:number,y:number,w:number,h:number}|null} null when nothing was painted
     */
    takeStrokeBox() {
        const b = this._strokeBox;
        this._strokeBox = null;
        // This is the stroke BOUNDARY — InputController calls it at mousedown and
        // again at mouseup/interrupt, and nowhere else. So it is also where the
        // interpolator's previous sample dies: carrying `_lastDab` across strokes
        // would draw a line from wherever the last one ended to wherever the next
        // one starts (MPI-375).
        this._lastDab = null;
        if (!b) return null;
        return { x: b.x0 - 1, y: b.y0 - 1, w: (b.x1 - b.x0) + 2, h: (b.y1 - b.y0) + 2 };
    },

    /** Grow the in-flight stroke box to cover a dab of radius r at (x, y). */
    _growStrokeBox(x, y, r) {
        const b = this._strokeBox;
        if (!b) {
            this._strokeBox = { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
            return;
        }
        b.x0 = Math.min(b.x0, x - r);
        b.y0 = Math.min(b.y0, y - r);
        b.x1 = Math.max(b.x1, x + r);
        b.y1 = Math.max(b.y1, y + r);
    },
};

/**
 * The layer-wide one-shot capture — mask and paint. `CompositeManager` keeps its own
 * `_recordUndo()`: its hole layer is scratch at 1536 and records whole with `record()`.
 */
export const oneShotUndoMethods = {
    /** Open a capture of `undoLayers()` before a layer-wide mutation; `_commitUndo()`
     *  closes it once the mutation is done. */
    _recordUndo() {
        const layers = this.undoLayers();
        if (layers.length) this.undo?.begin(layers);
    },

    /** Keep only the box the one-shot changed (MPI-961): whole layers at 4096^2 are
     *  64 MB (paint) or 128 MB (mask), so one Fill evicted every stroke before it. */
    _commitUndo() {
        this.undo?.commitChanged();
    },
};

/**
 * The Adjust session (MPI-382 mask, MPI-436 paint) and Fill's hole lookup (MPI-431,
 * MPI-566) — everything around `distanceField.js` / `holeFlood.js` that is not a fill.
 *
 * @param {object} opts
 * @param {number} opts.pad the field's starting margin in layer px (each layer's
 *   `ADJUST_PAD`); a preview asking for a bigger radius rebuilds with more
 * @param {(mgr: any) => HTMLCanvasElement|null} opts.source the canvas Adjust snapshots
 *   and Fill reads when no preview is up
 */
export function adjustMethods({ pad: minPad, source }) {
    return {
        /**
         * Enter Adjust: snapshot the layer so every preview frame derives from
         * tool-entry state rather than from the frame before it (the MPI-351
         * double-scale bug).
         *
         * The distance field is INVALIDATED here, not built (MPI-441). It costs up to
         * 1.7 s at the 4096 working size and describes this snapshot, so building it
         * eagerly would charge that to entering the tool AND to every Apply — including
         * the user who only came in to press Fill. The first `previewAdjust()` that
         * needs it builds it; see `_ensureAdjustField()`.
         */
        beginAdjust() {
            const layer = source(this);
            if (!layer) return;
            const w = layer.width;
            const h = layer.height;
            if (!w || !h) return;

            if (!this._adjustPristine) this._adjustPristine = document.createElement('canvas');
            this._adjustPristine.width = w;
            this._adjustPristine.height = h;
            this._adjustPristine.getContext('2d', { willReadFrequently: true })
                .drawImage(layer, 0, 0);
            this._adjustField = null;
            this._adjustImg = null;
            this._adjustBox = null;
            this._adjustPad = 0;

            if (!this.adjustCanvas) {
                this.adjustCanvas = document.createElement('canvas');
                this.adjustCtx = this.adjustCanvas.getContext('2d', { willReadFrequently: true });
            }
            this.adjustCanvas.width = w;
            this.adjustCanvas.height = h;
            this.hasAdjustPreview = false;
        },

        /**
         * Build the distance field and the preview buffer from the pristine snapshot,
         * once per snapshot. Reads `_adjustPristine`, NEVER `adjustCanvas` — sourcing it
         * from its own output is how the adjustment starts compounding frame over frame.
         *
         * The `ImageData` is cached alongside it because a fresh one per slider tick is a
         * 64 MB allocation at the working size — GC churn during a drag for nothing.
         *
         * Built over the CONTENT's bounding box padded by the largest radius asked for,
         * not the whole layer (MPI-445). The field's cost is quadratic in the pixel count:
         * a whole-layer field at 4096² measured ~1.6 s on the first slider move. A
         * scribble, an eye or a face pays its box; content filling the frame still pays
         * the lot. The box is padded, never clamped to the content: the primitive reads
         * outside-the-box as background, so an unpadded box would erode the layer from
         * a border that is not there.
         * @param {number} maxR the largest radius this preview asks for, in LAYER px
         * @returns {boolean} false when there is nothing to build from
         */
        _ensureAdjustField(maxR = 0) {
            const pad = Math.max(minPad, Math.ceil(maxR) + 2);
            if (this._adjustField && this._adjustImg && this._adjustPad >= pad) return true;
            const src = this._adjustPristine;
            if (!src?.width || !src?.height || !this.adjustCtx) return false;
            const w = src.width;
            const h = src.height;
            const data = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
            const built = fieldOverContent(data, w, h, pad);
            if (!built) return false; // empty layer — nothing to grow or shrink
            this._adjustField = built.field;
            this._adjustBox = built.box;
            this._adjustPad = pad;
            this._adjustImg = this.adjustCtx.createImageData(built.box.w, built.box.h);
            return true;
        },

        /**
         * Drop the preview and its buffers. Called by Reset, by leaving the tool through
         * the shared `discardPreview()` seam, and by a new image load. Idempotent.
         * @returns {boolean} true when a preview was discarded
         */
        endAdjust() {
            const had = this.hasAdjustPreview;
            this.hasAdjustPreview = false;
            for (const c of [this.adjustCanvas, this._adjustPristine]) {
                if (c) { c.width = 0; c.height = 0; }
            }
            this.adjustCanvas = null;
            this.adjustCtx = null;
            this._adjustPristine = null;
            this._adjustField = null;
            this._adjustImg = null;
            this._adjustBox = null;
            this._adjustPad = 0;
            return had;
        },

        /**
         * Fill's lookup: the enclosed holes in what is ON SCREEN — the live preview when
         * one is up, the layer otherwise — so pressing Fill mid-adjustment bakes both as
         * ONE undo entry rather than silently dropping the preview.
         * @returns {{src: HTMLCanvasElement, region: {box:{x:number,y:number,w:number,h:number}, data: Uint8ClampedArray}}|null}
         *   null when there is no hole, so the caller returns before recording undo
         */
        _findHoles() {
            const src = (this.hasAdjustPreview && this.adjustCanvas) ? this.adjustCanvas : source(this);
            if (!src?.width || !src?.height) return null;
            const ctx = src.getContext('2d', { willReadFrequently: true });
            const region = holeFlood(ctx.getImageData(0, 0, src.width, src.height).data, src.width, src.height);
            return region ? { src, region } : null;
        },
    };
}
