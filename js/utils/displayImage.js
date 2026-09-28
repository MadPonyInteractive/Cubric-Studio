/**
 * displayImage.js — which pixels the History canvas and the Prompt preview draw (MPI-961).
 *
 * A 16K original cost a 2.4-3.6 s main-thread decode on every canvas mount, the Prompt
 * preview re-decoded it at each zoom step (fit -> 1x: 11.6 s), and a 32K never opened —
 * Chromium cannot decode one. Past `displayMaxEdge()` both draw the server's display
 * copy instead (`resolveDisplayImage` in `routes/projects.js`), while every coordinate
 * they keep stays in the ORIGINAL's px: only the pixels shrink.
 */

// Twice the screen's long edge in device px, so the copy is still sharp at fit on a
// window spanning the screen; 4096 below that; WebP's 16383 limit above.
// ponytail: read once — a monitor change mid-session keeps the old cap, which only sets
// how sharp the image is at fit.
let _maxEdge = Math.min(16383, Math.max(4096, Math.round(
    2 * Math.max(window.screen?.width || 0, window.screen?.height || 0) * (window.devicePixelRatio || 1))));

export const displayMaxEdge = () => _maxEdge;

/** Specs force a small cap so a 2048 fixture exercises the copy. */
export function setDisplayMaxEdge(px) { _maxEdge = px; }

/**
 * A small preview's src (a prompt-box chip): the item's sidecar thumb, served for the
 * original's `/project-file` URL. Anything else is returned as-is.
 */
export function thumbSrc(url) {
    return typeof url === 'string' ? url.replace(/\/project-file\?/, '/project-thumb?') : url;
}

/**
 * @param {string} url what the caller would have loaded
 * @param {number} [edge]
 * @returns {Promise<{src: string, width: number, height: number}>} `src` to load. With a
 *   copy, the ORIGINAL's size as Chromium orients it; without one (`src === url`), 0 —
 *   the loaded image's own size is the truth.
 */
export async function resolveDisplayImage(url, edge = _maxEdge) {
    const asIs = { src: url, width: 0, height: 0 };
    const u = new URL(url, location.href);
    const filePath = u.pathname.endsWith('/project-file') ? u.searchParams.get('path') : null;
    if (!filePath) return asIs;
    try {
        const res = await fetch(`/display-image?path=${encodeURIComponent(filePath)}&edge=${edge}`);
        if (!res.ok) return asIs;
        const { url: copy, width, height } = await res.json();
        // No copy (`url: null`): load the caller's own URL, which may carry a `&v=`
        // cache-bust the server never saw, and let the decode give the size.
        return copy ? { src: copy, width, height } : asIs;
    } catch {
        return asIs;
    }
}
