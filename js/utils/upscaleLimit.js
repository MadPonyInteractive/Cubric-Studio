/**
 * upscaleLimit.js — how big an upscale may make a picture (MPI-971 Phase 3, P-A).
 *
 * 16384 on the long edge: sharp's and ffmpeg's ceiling, and the display clamp (16383). A
 * picture that passes at x1.5 is at most 10922 px, so its input is also under Pillow's
 * load limit (119 MP of 179). The rail greys the factors past it; the executor refuses them
 * for every producer, an agent and the connector included.
 */

export const UPSCALE_MAX_EDGE = 16384;

/** A still's upright `{ width, height }` from the server (a header read), or null. */
export async function imageSize(filePath) {
    try {
        const res = await fetch(`/image-size?path=${encodeURIComponent(filePath)}`);
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

/**
 * @param {number} width - the source's upright width
 * @param {number} height
 * @param {number} factor
 * @returns {string|null} why `factor` cannot enlarge it, or null when it can
 */
export function upscaleRefusal(width, height, factor) {
    const long = Math.round(Math.max(width, height) * factor);
    if (!(long > UPSCALE_MAX_EDGE)) return null;
    return `Too big to upscale: ${width}x${height} at x${factor} would be ${long} px on the long edge, and the most the app can make is ${UPSCALE_MAX_EDGE}.`;
}
