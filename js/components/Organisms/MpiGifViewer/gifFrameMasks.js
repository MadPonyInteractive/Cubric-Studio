/**
 * gifFrameMasks — the per-frame cut-out masks one GIF entry is being edited with
 * (MPI-771, plan Decision 14 / E10). Plain data, no DOM: `MpiGifViewer` owns one
 * instance, both GIF mask tools reach it through the viewer.
 *
 * Every map is keyed by frame POSITION, because a track is returned per position
 * of the source video the tracker ran on. A mask still describes its own frame's
 * pixels wherever that frame moves, so a staged reorder or delete carries the
 * masks along with their frames (`remap()`, Fabio 2026-09-16: a stray strip drag
 * must never lose work). Any other change of list empties the store (`sync()`).
 *
 *   track    idx -> engine mask URL (Track All / Track Single Frame)
 *   edits    idx -> { manual, subtract } — the brush layers as working-res alpha
 *                   PNG data URLs (`MaskManager.getManualURL()` shape), which
 *                   survive a re-track (Fabio, 2026-09-16)
 *   composed idx -> B/W PNG of (track OR manual) AND NOT subtract at the frame's
 *                   own size, taken from the live canvas when the edits were saved
 *                   — `MaskManager` is the one compositor, this only stores its output
 */

function frameSignature(frames) {
    return (frames || []).map(f => f.hash).join('|');
}

export class GifFrameMasks {
    constructor() {
        this._sig = '';
        this.track = new Map();
        this.edits = new Map();
        this.composed = new Map();
    }

    /** Bind to a frame list. A different list empties the store. @returns {boolean} true when it emptied */
    sync(frames) {
        const sig = frameSignature(frames);
        if (sig === this._sig) return false;
        this._sig = sig;
        const had = this.hasAny();
        this.track.clear();
        this.edits.clear();
        this.composed.clear();
        return had;
    }

    /**
     * Rebind to a reordered / trimmed list. `order[newPos]` = the position that
     * frame held in the list the store was bound to; positions nobody picks are dropped.
     */
    remap(frames, order) {
        const pick = (map) => {
            const out = new Map();
            order.forEach((from, to) => { if (map.has(from)) out.set(to, map.get(from)); });
            return out;
        };
        this.track = pick(this.track);
        this.edits = pick(this.edits);
        this.composed = pick(this.composed);
        this._sig = frameSignature(frames);
    }

    /** Replace every track (Track All). Brush edits stay; their composites are stale. */
    setTrackAll(urls) {
        this.track.clear();
        (urls || []).forEach((u, i) => { if (u) this.track.set(i, u); });
        this.composed.clear();
    }

    /** Replace one position's track (Track Single Frame). */
    setTrack(idx, url) {
        if (url) this.track.set(idx, url); else this.track.delete(idx);
        this.composed.delete(idx);
    }

    /**
     * Store one position's brush layers and the composite they produce. Both
     * layers empty = no edits; the track alone describes the frame again.
     */
    setEdits(idx, { manual, subtract, composed }) {
        if (!manual && !subtract) {
            this.edits.delete(idx);
            this.composed.delete(idx);
            return;
        }
        this.edits.set(idx, { manual: manual || null, subtract: subtract || null });
        if (composed) this.composed.set(idx, composed); else this.composed.delete(idx);
    }

    hasEdits(idx) { return this.edits.has(idx); }
    editedIndices() { return [...this.edits.keys()].sort((a, b) => a - b); }
    hasAny() { return this.track.size > 0 || this.edits.size > 0; }

    /**
     * What position `idx` sends to the cut: the composite when it was edited,
     * else the raw track, else null (no mask). An edited position whose composite
     * went stale (a re-track after the edit) reports `undefined` — the viewer
     * must recompose it before use.
     */
    maskFor(idx) {
        if (this.edits.has(idx)) return this.composed.get(idx);
        return this.track.get(idx) || null;
    }

    /** `maskFor()` for display: a stale edit reads as its track. */
    overlayAt(i) {
        return (this.edits.has(i) && this.composed.get(i)) || this.track.get(i) || null;
    }

    /** `overlayAt()` for every position, for the frame strip. */
    overlay(count) {
        return Array.from({ length: count }, (_, i) => this.overlayAt(i));
    }
}
