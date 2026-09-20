/**
 * gifFrameMasks — the per-frame cut-out masks one GIF entry is being edited with
 * (MPI-771, plan Decision 14 / E10). Plain data, no DOM: `MpiGifViewer` owns one
 * instance, both GIF mask tools reach it through the viewer.
 *
 * Every map is keyed by frame POSITION, because a track is returned per position
 * of the source video the tracker ran on. A mask still describes its own frame's
 * pixels wherever that frame moves, so a staged reorder or delete carries the
 * masks along with their frames (`remap()`, Fabio 2026-09-16: a stray strip drag
 * must never lose work). Any other change of list empties the store (`sync()`),
 * but the old list's masks are STASHED under its signature: coming back to that
 * list (the source entry after a Cut out) restores them (Fabio 2026-09-17).
 *
 *   track    idx -> engine mask URL (Track All / Track Single Frame)
 *   edits    idx -> { manual, subtract } — the brush layers as working-res alpha
 *                   PNG data URLs (`MaskManager.getManualURL()` shape), which
 *                   survive a re-track (Fabio, 2026-09-16)
 *   composed idx -> greyscale PNG of (track OR manual) AND NOT subtract at the
 *                   frame's own size, taken from the live canvas when the edits were
 *                   saved — COVERAGE, never a binary cut: the track's soft edge must
 *                   come through a brush fix unchanged (MPI-835). `MaskManager` is
 *                   the one compositor, this only stores its output
 *   candidate idx -> the mask a METHOD RUN just produced, waiting for Add or
 *                   Subtract (MPI-859). A proposal, never mask content: it is
 *                   absent from `maskFor()` and from `hasAny()`, so a run that is
 *                   never committed cannot reach the cut — the image workspace's
 *                   MPI-426 rule, which is what makes the methods compose instead
 *                   of each one replacing the last. `overlayAt()` DOES show it,
 *                   because display is the whole point of a proposal
 */

/** Frame lists whose masks stay stashed for the session (oldest dropped first). */
const STASH_LISTS = 8;

function frameSignature(frames) {
    return (frames || []).map(f => f.hash).join('|');
}

export class GifFrameMasks {
    constructor() {
        this._sig = '';
        this.track = new Map();
        this.edits = new Map();
        this.composed = new Map();
        this.candidate = new Map();
        /** signature -> { track, edits, composed } of a list the store left */
        this._stash = new Map();
    }

    /**
     * Bind to a frame list. A different list stashes the current masks and
     * restores that list's own, if it was bound before.
     * @returns {boolean} true when the store's content changed (masks left or came back)
     */
    sync(frames) {
        const sig = frameSignature(frames);
        if (sig === this._sig) return false;
        const had = this.hasAny();
        if (had) {
            this._stash.delete(this._sig);
            this._stash.set(this._sig, { track: this.track, edits: this.edits, composed: this.composed });
            if (this._stash.size > STASH_LISTS) this._stash.delete(this._stash.keys().next().value);
        }
        const back = this._stash.get(sig);
        this._stash.delete(sig);
        this._sig = sig;
        this.track = back?.track || new Map();
        this.edits = back?.edits || new Map();
        this.composed = back?.composed || new Map();
        // A proposal is never stashed and never restored: an uncommitted preview
        // must not outlive the list it was proposed for (docs/masking-tools.md
        // § The preview contract).
        this.candidate.clear();
        return had || !!back;
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
        // A reorder is the SAME frames in another order, so a proposal still
        // describes its own frame — unlike `sync()`, where the list itself changed.
        this.candidate = pick(this.candidate);
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

    /**
     * Replace the whole proposal set with what a method run just produced
     * (MPI-859). A run SUPERSEDES the last one: two live proposals would ask the
     * user to commit two things with one button.
     * @param {Array<[number, string]>} entries position -> mask URL
     */
    setCandidates(entries) {
        this.candidate.clear();
        (entries || []).forEach(([idx, url]) => { if (url) this.candidate.set(idx, url); });
    }

    /** @returns {boolean} true when there was a proposal to drop */
    clearCandidates() {
        if (!this.candidate.size) return false;
        this.candidate.clear();
        return true;
    }

    hasCandidates() { return this.candidate.size > 0; }
    candidateAt(idx) { return this.candidate.get(idx) || null; }
    candidateIndices() { return [...this.candidate.keys()].sort((a, b) => a - b); }

    /**
     * Throw one position's mask away — track AND brush layers. Clearing with the
     * brush only writes a full-frame `subtract`, which survives every re-mask by
     * design, so without this a frame the user "cleared" could never be masked
     * again (Fabio, 2026-09-18).
     */
    clear(idx) {
        this.track.delete(idx);
        this.edits.delete(idx);
        this.composed.delete(idx);
        this.candidate.delete(idx);
    }

    /** `clear()` for every position. */
    clearAll() {
        this.track.clear();
        this.edits.clear();
        this.composed.clear();
        this.candidate.clear();
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

    /**
     * `maskFor()` for display: a stale edit reads as its track, and a PROPOSAL
     * outranks both — it is what the user is being asked about (MPI-859).
     */
    overlayAt(i) {
        return this.candidate.get(i)
            || (this.edits.has(i) && this.composed.get(i)) || this.track.get(i) || null;
    }

    /**
     * `overlayAt()` WITHOUT the proposal: the mask the frame owns, for display.
     * The stage draws the two as separate layers — this in white, `candidateAt()`
     * in green over it (MPI-859) — so a run never hides the mask it is about to
     * change. The strip still takes `overlayAt()`: one thumb, one tint.
     */
    committedAt(i) {
        return (this.edits.has(i) && this.composed.get(i)) || this.track.get(i) || null;
    }

    /** `overlayAt()` for every position, for the frame strip. */
    overlay(count) {
        return Array.from({ length: count }, (_, i) => this.overlayAt(i));
    }
}
