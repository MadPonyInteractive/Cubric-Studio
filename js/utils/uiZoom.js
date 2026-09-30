/**
 * uiZoom.js — global UI size control via Electron webFrame zoom factor.
 *
 * Single source of truth for the zoom bounds/step behind the Ctrl+ / Ctrl-
 * hotkeys (hotkeyManager.js) — the only way to change UI size. No-ops in
 * Browser Mode where webFrame is unavailable.
 *
 * MPI-374: the factor is persisted and restored on boot. It has to be, since
 * MPI-432 removed the Ctrl+wheel handler — the keyboard steps are all that is
 * left, so a user who needs a large UI would otherwise re-set it every launch.
 */
'use strict';

import { Storage } from '../core/storage.js';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.0;
export const ZOOM_STEP = 0.1;
// MPI-995: a fresh install opens one step down. At 1.0 the UI reads too big, and a
// first-time user does not know Ctrl+- yet. A stored size (1.0 included) still wins.
export const ZOOM_DEFAULT = 0.9;

const _webFrame = (() => {
    try { return window.require?.('electron')?.webFrame ?? null; } catch { return null; }
})();

/**
 * Coerce any stored/incoming value to a usable factor.
 * A missing, corrupt or out-of-range value falls back to ZOOM_DEFAULT rather than
 * wedging the UI at an unreadable size the user then cannot see the controls to fix.
 * @param {*} v
 * @returns {number}
 */
export function normalizeZoomFactor(v) {
    if (v === null || v === undefined) return ZOOM_DEFAULT;   // Number(null) is 0, not NaN
    const n = Number(v);
    if (!Number.isFinite(n) || n < ZOOM_MIN || n > ZOOM_MAX) return ZOOM_DEFAULT;
    return Number(n.toFixed(2));
}

/**
 * Step the global UI zoom factor by one ZOOM_STEP, clamped to [MIN, MAX].
 * @param {1|-1} dir 1 = enlarge UI, -1 = shrink UI
 */
export function applyUiZoom(dir) {
    if (!_webFrame) return;
    const current = _webFrame.getZoomFactor();
    const next = dir > 0
        ? Math.min(ZOOM_MAX, current + ZOOM_STEP)
        : Math.max(ZOOM_MIN, current - ZOOM_STEP);
    const factor = Number(next.toFixed(2));
    _webFrame.setZoomFactor(factor);
    Storage.setUiZoomFactor(factor);
}

/**
 * Re-apply the stored UI size. Call once, as early in the renderer as possible,
 * so the page is never painted at 1.0 and then resized under the user.
 */
export function restoreUiZoom() {
    if (!_webFrame) return;   // Browser Mode: no webFrame, nothing to restore
    const factor = normalizeZoomFactor(Storage.getUiZoomFactor());
    if (factor !== _webFrame.getZoomFactor()) _webFrame.setZoomFactor(factor);
}
