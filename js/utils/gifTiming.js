/**
 * gifTiming — the frame-list math behind the GIF timing and output tools (MPI-772).
 *
 * Pure: no DOM, no fetch. `MpiToolOptionsGifTiming` shows what a value will do,
 * `MpiGroupHistoryBlock` turns an Apply into a `POST /gif/entry` body,
 * `MpiGifViewer` reads the trim through `rangeBounds`, `js/shell/gifJobs.js`
 * applies the edit, and `tests/gif-timing.test.cjs` pins the numbers. It lives in
 * `js/utils/` rather than beside the panel (MPI-757) because four of those five
 * consumers are not that panel. Every edit rewrites only the
 * frame list, `loop` or `output`: no frame file is ever written (docs/gif.md).
 *
 * Delays are GIF hundredths of a second. Chromium plays 0 or 1 as 10, so 2 is
 * the floor and 50 fps the ceiling; 16 fps rounds to 6 and plays at 16.7.
 */

export const MIN_DELAY = 2;
export const MIN_FPS = 0.1;
export const MAX_FPS = 50;
export const MAX_LOOP = 999;
export const MIN_EDGE = 16;
export const MAX_EDGE = 4096;
export const MIN_COLOURS = 2;
export const MAX_COLOURS = 256;

export const OUTPUT_DEFAULTS = Object.freeze({
    maxEdge: 1024,
    colours: 256,
    transparent: false,
    // eslint-disable-next-line mpi/no-hardcoded-hex-color -- default edge colour, stored in the sidecar
    edgeColour: '#000000',
});

const HEX = /^#[0-9a-f]{6}$/i;

export function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

const clampInt = (value, fallback, min, max) => Math.round(clampNumber(value, fallback, min, max));

/** fps -> whole-hundredths delay, never under MIN_DELAY. */
export function fpsToDelay(fps) {
    return Math.max(MIN_DELAY, Math.round(100 / clampNumber(fps, MIN_FPS, MIN_FPS, MAX_FPS)));
}

/** The rate a delay really plays at. */
export const delayToFps = (delay) => 100 / delay;

/** UI output settings -> the sidecar's `gif.output` shape. */
export function toEntryOutput(v = {}) {
    return {
        maxEdge: clampInt(v.maxEdge, OUTPUT_DEFAULTS.maxEdge, MIN_EDGE, MAX_EDGE),
        colours: clampInt(v.colours, OUTPUT_DEFAULTS.colours, MIN_COLOURS, MAX_COLOURS),
        // One field carries the on/off and the blend colour (docs/gif.md).
        edgeColour: v.transparent ? (HEX.test(v.edgeColour) ? v.edgeColour : OUTPUT_DEFAULTS.edgeColour) : null,
    };
}

/**
 * The control bar's trim range as inclusive frame positions `[lo, hi]` of a list
 * `count` long. No range (or a reversed / out-of-bounds one) still lands inside
 * the list, so a caller can slice without checking. The ONE reading of the trim
 * bar: every GIF operation slices with it (MPI-836), and a mask batch aligned to
 * the frame list is sliced by the same pair.
 */
export function rangeBounds(count, range) {
    const last = Math.max(0, count - 1);
    const a = clampInt(range?.in, 0, 0, last);
    const b = clampInt(range?.out, last, 0, last);
    return [Math.min(a, b), Math.max(a, b)];
}

/** The rate every frame of a list plays at, or null when the delays differ. */
export function uniformFps(frames) {
    const delay = frames?.[0]?.delay;
    if (!delay || frames.some(f => f.delay !== delay)) return null;
    return delayToFps(delay);
}

/**
 * One tool's edit of `{ frames, loop, output }`. Returns only the fields the tool
 * changes; the caller keeps the rest of the current entry.
 *
 * @param {'trim'|'speed'|'reverse'|'loop'|'output'} tool
 * @param {{hash:string, delay:number}[]} frames - the list the user sees
 * @param {object} v - trim `{in, out}`, speed `{fps}`, loop `{loop}`, output (see toEntryOutput)
 */
export function timingEdit(tool, frames, v = {}) {
    switch (tool) {
        case 'trim': {
            const [lo, hi] = rangeBounds(frames.length, v);
            return { frames: frames.slice(lo, hi + 1) };
        }
        case 'speed': {
            const delay = fpsToDelay(v.fps);
            return { frames: frames.map(f => ({ ...f, delay })) };
        }
        case 'reverse':
            return { frames: [...frames].reverse() };
        case 'loop':
            return { loop: clampInt(v.loop, 0, 0, MAX_LOOP) };
        case 'output':
            return { output: toEntryOutput(v) };
        default:
            throw new Error(`unknown GIF timing tool: ${tool}`);
    }
}
