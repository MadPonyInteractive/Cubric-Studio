/**
 * activeMask.js — the one slot that says whether the user has a mask painted right now,
 * and hands it over (MPI-877).
 *
 * A painted mask lives on the History workspace's canvas viewer and nowhere else. The
 * agent dispatches from `agentDispatch.js`, which has no viewer, no block and no business
 * querying the DOM (`document.querySelector` is banned, and `qs` would still be reaching
 * across two layers into a component's internals). So the workspace that OWNS a mask
 * publishes a reader here, and the dispatch path asks.
 *
 * Deliberately import-free. `agentDispatch.js` is required directly by the CJS tests, and
 * the obvious alternative — exporting the mounted block from `navigation.js` — drags the
 * whole component tree into that require. One of those components (`MpiLevelMeter.js:2`)
 * imports `/js/utils/dom.js`, a server-absolute path the browser resolves and Node cannot,
 * so every test touching dispatch died on a module three layers from anything it tested.
 *
 * ponytail: ONE slot, not a map. Exactly one workspace is mounted at a time, and
 * `navigation.js` destroys the previous block before mounting the next.
 */

let _read = null;

/**
 * Publish a mask reader. Called by the workspace that owns a canvas.
 *
 * The reader hands back the mask AND the image it was painted on, never the pixels alone.
 * The two are one thing: a mask is a region OF a picture, and the engine asserts they have
 * the same dimensions (`InpaintCropImproved`, inpaint_cropandstitch.py:1352). Live,
 * 2026-09-21: the mask came off the open card at 768x1024 while the agent edited the chat
 * ATTACHMENT it had been handed, a 512x682 thumbnail rendition, and five runs across two
 * models died before rendering a pixel. Pixels published with no identity are what let a
 * mask reach a picture it was never drawn on.
 *
 * @param {() => ({dataUrl: string, url: string}|null)} read - the painted mask and the url
 *   of the image under it, or null when nothing is painted.
 */
export function setMaskReader(read) {
    _read = typeof read === 'function' ? read : null;
}

/**
 * Withdraw a reader on teardown. Takes the reader back, so a late `destroy()` from an
 * already-replaced block cannot blank the live one.
 * @param {() => (string|null)} read
 */
export function clearMaskReader(read) {
    if (_read === read) _read = null;
}

/**
 * The mask the user has painted right now and the image it belongs to, or null.
 * Never throws.
 * @returns {{dataUrl: string, url: string}|null}
 */
export function activeMask() {
    try {
        const m = _read?.();
        return m?.dataUrl ? m : null;
    } catch {
        return null;
    }
}
