/**
 * activeStackMember.js — the card on screen in an open stack (MPI-950).
 *
 * A stack owns no media (MPI-949), so with one open in History the agent's turn had no entry
 * to name: the route says the STACK, and which member the viewer shows lives only in that
 * workspace. It publishes a reader here and the agent's turn asks — the same shape, and the
 * same reasons, as `activeFrame.js`.
 *
 * Import-free for the same reason as `activeMask.js`. ONE slot: one workspace is mounted.
 */

let _read = null;

/**
 * Publish a member reader. Called by the workspace that shows a stack.
 * @param {() => (string|null)} read - the group id of the member on screen
 */
export function setStackMemberReader(read) {
    _read = typeof read === 'function' ? read : null;
}

/**
 * Withdraw a reader on teardown; a late `destroy()` from a replaced block cannot blank the live one.
 * @param {Function} read
 */
export function clearStackMemberReader(read) {
    if (_read === read) _read = null;
}

/**
 * The group id of the stack member on screen now, or null when no stack is open. Never throws.
 * @returns {string|null}
 */
export function activeStackMember() {
    try {
        const id = _read?.();
        return typeof id === 'string' && id ? id : null;
    } catch {
        return null;
    }
}
