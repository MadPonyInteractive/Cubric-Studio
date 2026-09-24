/**
 * outpaintPasses.js — split a big outpaint into passes (MPI-900).
 *
 * One Outpaint pass holds about a third of the picture PER SIDE: a third up and a third
 * down fills cleanly, half or two thirds in one direction fails most runs (Fabio's bench,
 * 2026-09-24). So each pass grows every side by at most a third of what it already
 * knows, and the next pass runs on THAT result, with real pixels to continue.
 *
 * Pure geometry, no DOM — both the flow frame and the agent path plan with it.
 * Rects are in the SOURCE's own pixels and may go negative (the crop gizmo's convention,
 * `composePaddedImage` draws at `-x, -y`).
 */

/** How much one pass may add on a side, as a fraction of the picture it starts from. */
export const OUTPAINT_MAX_GROW = 1 / 3;

/**
 * @param {{w:number,h:number}} natural - the source's real pixels
 * @param {{x:number,y:number,w:number,h:number}} rect - the frame the user asked for
 * @param {number} [maxGrow]
 * @returns {Array<{x:number,y:number,w:number,h:number}>|null} every pass's frame in
 *   source pixels, the last one `rect` itself; null when one pass holds it. An edge that
 *   cuts INTO the source is where the user put it from pass 1 on; only overhang grows.
 */
export function planOutpaintPasses(natural, rect, maxGrow = OUTPAINT_MAX_GROW) {
    const t = { x0: rect.x, y0: rect.y, x1: rect.x + rect.w, y1: rect.y + rect.h };
    // What pass 1 knows: the source, cut by any edge the user pulled in.
    let c = { x0: Math.max(0, t.x0), y0: Math.max(0, t.y0), x1: Math.min(natural.w, t.x1), y1: Math.min(natural.h, t.y1) };
    const passes = [];
    do {
        const gx = Math.max(1, Math.round(maxGrow * (c.x1 - c.x0)));
        const gy = Math.max(1, Math.round(maxGrow * (c.y1 - c.y0)));
        c = {
            x0: Math.max(t.x0, c.x0 - gx), y0: Math.max(t.y0, c.y0 - gy),
            x1: Math.min(t.x1, c.x1 + gx), y1: Math.min(t.y1, c.y1 + gy),
        };
        passes.push({ x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0 });
    } while (c.x0 > t.x0 || c.y0 > t.y0 || c.x1 < t.x1 || c.y1 < t.y1);
    return passes.length > 1 ? passes : null;
}

/**
 * The next pass's frame in the PREVIOUS PASS'S RESULT pixels. The graph rescales to
 * ~1 MP, so the result is not the size of `prev`; each axis scales on its own because the
 * rescale snaps to a 16px grid and the aspect drifts by a pixel or two.
 *
 * @param {{x:number,y:number,w:number,h:number}} prev - the pass that just ran (source px)
 * @param {{x:number,y:number,w:number,h:number}} next - the pass to run (source px)
 * @param {{w:number,h:number}} result - `prev`'s output pixels
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function nextPassRect(prev, next, result) {
    const sx = result.w / prev.w;
    const sy = result.h / prev.h;
    return {
        x: Math.round((next.x - prev.x) * sx),
        y: Math.round((next.y - prev.y) * sy),
        w: Math.round(next.w * sx),
        h: Math.round(next.h * sy),
    };
}
