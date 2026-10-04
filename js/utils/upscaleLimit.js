/**
 * upscaleLimit.js — how big an upscale may make a picture (MPI-971 Phase 3, P-A), and how big
 * a picture the engine can open or an Outpaint can make (Phase 4).
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

// Pillow's decompression-bomb line (MPI-971 Phase 4): the engine's image loader will not open
// a picture past it (a 16384 x 10240 loads, a 16384^2 does not).
export const ENGINE_LOAD_MAX_PIXELS = 178956970;
const _mp = (px) => Math.round(px / 1e6);

/** Why the engine cannot open an image this big, or null when it can. */
export function loadRefusal(width, height) {
    if (!(width * height > ENGINE_LOAD_MAX_PIXELS)) return null;
    return `Too big for the engine: ${width}x${height} is ${_mp(width * height)} MP, and it opens at most ${_mp(ENGINE_LOAD_MAX_PIXELS)} MP. Try a smaller copy of the picture.`;
}
