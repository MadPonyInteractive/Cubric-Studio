/**
 * outpaintPasses.js — split a big outpaint into two passes (MPI-900).
 *
 * One Outpaint pass holds about a quarter of the picture: past that the model is inventing
 * most of the frame and it shows. Fabio's manual fix, which this automates: grow ~25% first,
 * then run the full frame on THAT result, so the second pass has real pixels to continue.
 *
 * Pure geometry, no DOM — both the flow frame and the agent path plan with it.
 * Rects are in the SOURCE's own pixels and may go negative (the crop gizmo's convention,
 * `composePaddedImage` draws at `-x, -y`).
 */

/** How much one pass may add on an axis, as a fraction of the source on that axis. */
export const OUTPAINT_MAX_GROW = 0.25;

/**
 * @param {{w:number,h:number}} natural - the source's real pixels
 * @param {{x:number,y:number,w:number,h:number}} rect - the frame the user asked for
 * @param {number} [maxGrow]
 * @returns {{first:{x:number,y:number,w:number,h:number}, final:{x:number,y:number,w:number,h:number}}|null}
 *   null when one pass holds it. `first` is `rect` with each over-limit axis's overhang
 *   shrunk, proportionally per side, to `maxGrow` of the source.
 *
 * ponytail: two passes, never N. 8:5 → 4:5 still asks pass 2 for ~60%; Fabio's manual
 * run did the same and was happy. Loop `first` if a third pass ever earns its minute.
 */
export function planOutpaintPasses(natural, rect, maxGrow = OUTPAINT_MAX_GROW) {
    const { w: nw, h: nh } = natural;
    const left = Math.max(0, -rect.x);
    const top = Math.max(0, -rect.y);
    const right = Math.max(0, rect.x + rect.w - nw);
    const bottom = Math.max(0, rect.y + rect.h - nh);
    const kx = left + right > maxGrow * nw ? (maxGrow * nw) / (left + right) : 1;
    const ky = top + bottom > maxGrow * nh ? (maxGrow * nh) / (top + bottom) : 1;
    if (kx === 1 && ky === 1) return null;

    // An edge that cuts INTO the source stays where the user put it; only overhang shrinks.
    const x = left ? -Math.round(left * kx) : rect.x;
    const y = top ? -Math.round(top * ky) : rect.y;
    const x2 = right ? nw + Math.round(right * kx) : rect.x + rect.w;
    const y2 = bottom ? nh + Math.round(bottom * ky) : rect.y + rect.h;
    return { first: { x, y, w: x2 - x, h: y2 - y }, final: rect };
}

/**
 * The final frame in PASS-1-RESULT pixels. The graph rescales to ~1 MP, so the result is
 * not the size of `plan.first`; each axis scales on its own because the rescale snaps to
 * a 16px grid and the aspect drifts by a pixel or two.
 *
 * @param {{first:Object, final:Object}} plan
 * @param {{w:number,h:number}} result - pass 1's output pixels
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function nextPassRect(plan, result) {
    const { first: a, final: f } = plan;
    const sx = result.w / a.w;
    const sy = result.h / a.h;
    return {
        x: Math.round((f.x - a.x) * sx),
        y: Math.round((f.y - a.y) * sy),
        w: Math.round(f.w * sx),
        h: Math.round(f.h * sy),
    };
}
