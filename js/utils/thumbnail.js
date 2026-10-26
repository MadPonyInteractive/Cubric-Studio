// @ts-check
/**
 * thumbnail.js — Downscale a source image/video element to a small data URL
 * suitable for cheap Comfy preview round-trips.
 *
 * Returns:
 *   {
 *     dataUrl,        // image/png data URL of the downscaled frame
 *     width,          // thumbnail width  (px)
 *     height,         // thumbnail height (px)
 *     sourceWidth,    // original natural width  (px)
 *     sourceHeight,   // original natural height (px)
 *   }
 *
 * For video: the frame must have been SHOWN, or drawImage reads blank. Await the
 * viewer's whenSourceLoaded() (MpiVideoViewer) first.
 */

const DEFAULT_MAX_EDGE = 512;

function _intrinsicDims(source) {
    if (source instanceof HTMLImageElement) {
        return { w: source.naturalWidth || source.width || 0, h: source.naturalHeight || source.height || 0 };
    }
    if (source instanceof HTMLVideoElement) {
        return { w: source.videoWidth || 0, h: source.videoHeight || 0 };
    }
    if (source instanceof HTMLCanvasElement) {
        return { w: source.width, h: source.height };
    }
    return { w: 0, h: 0 };
}

/**
 * Extract a downscaled thumbnail of the source as a PNG data URL.
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} source
 * @param {number} [maxEdge=512]
 */
export function extractThumbnail(source, maxEdge = DEFAULT_MAX_EDGE) {
    const { w: sw, h: sh } = _intrinsicDims(source);
    if (!sw || !sh) return null;

    const scale = Math.min(1, maxEdge / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, w, h);

    return {
        dataUrl: canvas.toDataURL('image/png'),
        width: w,
        height: h,
        sourceWidth: sw,
        sourceHeight: sh,
    };
}
