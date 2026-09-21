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
 * @param {() => (string|null)} read - returns the current mask as a data URL, or null.
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

/** The mask the user has painted right now, or null. Never throws. */
export function activeMaskDataUrl() {
    try {
        return _read?.() || null;
    } catch {
        return null;
    }
}
