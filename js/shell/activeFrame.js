/**
 * activeFrame.js — the frame of the open video the user is looking at (MPI-984).
 *
 * The agent was told WHICH clip was open, never WHERE in it the user stood. Paused on frame
 * 103, "edit this frame" sent the clip, and a clip sent as a picture is its first frame
 * (MPI-980), so the edit would have run on frame 0. The playhead lives in the History
 * workspace's video control bar and nowhere else, so that workspace publishes a reader here
 * and the agent's turn asks — the same shape, and the same reasons, as `activeMask.js`.
 *
 * Import-free for the same reason as `activeMask.js`. ONE slot: one workspace is mounted.
 */

let _read = null;

/**
 * Publish a frame reader. Called by the workspace that owns a video viewer.
 * @param {() => ({index: number, count: number, paused: boolean}|null)} read - the frame the
 *   viewer's counter shows (counted from 0), how many the clip has, and whether it is paused.
 */
export function setFrameReader(read) {
    _read = typeof read === 'function' ? read : null;
}

/**
 * Withdraw a reader on teardown; a late `destroy()` from a replaced block cannot blank the live one.
 * @param {Function} read
 */
export function clearFrameReader(read) {
    if (_read === read) _read = null;
}

/**
 * The frame on screen now, or null when no video is open. Never throws.
 * @returns {{index: number, count: number, paused: boolean}|null}
 */
export function activeFrame() {
    try {
        const f = _read?.();
        return Number.isInteger(f?.index) && Number.isInteger(f?.count) && f.count > 0 ? f : null;
    } catch {
        return null;
    }
}
