/**
 * Camera paths through a scene (MPI-623 P1): points the user drops in the 3D view, in scene
 * coordinates, for Wan to render a 360 video along (P2). Kept on the pano item as
 * `cameraPaths: [{ points: [[x, y, z], ...] }]`. Pure: no three, no DOM.
 */

/** A path starts where the pano was shot: Wan's video starts from the pano itself. */
export const PATH_START = Object.freeze([0, 0, 0]);
/** A point this close to the last one (a share of the camera's height above the ground) is a double press. */
export const MIN_GAP = 0.05;

/**
 * `points` with `pos` added at the end; an empty path gets `PATH_START` first.
 * @param {number[][]} points
 * @param {number[]} pos      the camera's spot
 * @param {number} ground     the pano camera's height above the ground (`view.ground`)
 * @returns {number[][]} the path with `pos` added; unchanged (but started) when `pos` is a double press
 */
export function addPoint(points, pos, ground) {
    const path = points.length ? points : [[...PATH_START]];
    const last = path[path.length - 1];
    if (Math.hypot(pos[0] - last[0], pos[1] - last[1], pos[2] - last[2]) < MIN_GAP * ground) return path;
    return [...path, [...pos]];
}

/** `points` without its last point; only the start left = no path. */
export const removeLast = (points) => (points.length > 2 ? points.slice(0, -1) : []);

/** Wan 2.1's clip: 81 frames, 5 s at 16 fps. */
export const FRAMES = 81;
const STEPS = 64; // curve samples per segment before the even re-spacing
/** The heading is the chord over this share of the path either side: a bend turns the camera gradually. */
const TURN = 0.1;

/** Centripetal Catmull-Rom between `p1` and `p2` at `t` in [0, 1]: no loops or cusps on uneven spacing. */
function catmull(p0, p1, p2, p3, t) {
    const knot = (a, b) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])), 1e-9);
    const t1 = knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3), u = t1 + (t2 - t1) * t;
    const lerp = (a, b, ta, tb) => a.map((v, i) => ((tb - u) * v + (u - ta) * b[i]) / (tb - ta));
    const a1 = lerp(p0, p1, 0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
    return lerp(lerp(a1, a2, 0, t2), lerp(a2, a3, t1, t3), t1, t2);
}

/** The path's smooth curve (`STEPS` samples a segment) and the distance along it at each sample. */
function curveOf(points) {
    const ends = (a, b) => a.map((v, i) => 2 * v - b[i]); // phantom points: the curve starts and ends straight
    const p = [ends(points[0], points[1]), ...points, ends(points.at(-1), points.at(-2))];
    const curve = [points[0]];
    for (let s = 1; s < p.length - 2; s++) for (let k = 1; k <= STEPS; k++) curve.push(catmull(p[s - 1], p[s], p[s + 1], p[s + 2], k / STEPS));
    const len = [0];
    for (let i = 1; i < curve.length; i++) len.push(len[i - 1] + Math.hypot(...curve[i].map((v, c) => v - curve[i - 1][c])));
    return { curve, len };
}

/** The shortest clip Wan renders here, and how many frames a camera height of path gets: the spacing of
 *  the P2 window path that passed live (81 frames over 2.78 camera heights, ~4.5 m; the 5090's well
 *  path moved 3.5x faster a frame and passed too). Wan takes 4k + 1 frames. */
export const FRAMES_MIN = 33;
export const FRAMES_PER_HEIGHT = 29;
/** Frames for a path: a short path gets fewer (Wan's time drops with them), never more than `FRAMES`.
 *  `ground` = the pano camera's height above the ground (`view.ground`), the scene's own unit. */
export function frameCount(points, ground) {
    if (points.length < 2 || !(ground > 0)) return FRAMES;
    const want = curveOf(points).len.at(-1) / ground * FRAMES_PER_HEIGHT;
    return Math.min(FRAMES, Math.max(FRAMES_MIN, 4 * Math.round(want / 4) + 1));
}

/**
 * The camera of every video frame along a path: a smooth curve through its points, frames evenly
 * spaced along it (constant speed), each camera level and facing where it travels (Wan's 360
 * LoRA breaks when the camera faces away from its motion, plan-history-bake amendments 30-32).
 * Frame 0 is the path's first point, the pano's centre.
 * @param {number[][]} points  a path's points (`addPoint`), the first `PATH_START`
 * @returns {{pos: number[], yaw: number}[]} `n` frames; none for a path with no second point
 */
export function pathFrames(points, n = FRAMES) {
    if (points.length < 2) return [];
    const { curve, len } = curveOf(points), total = len.at(-1);
    const at = (s) => { // the curve's point `s` along it
        s = Math.min(Math.max(s, 0), total);
        let lo = 1, hi = curve.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (len[m] < s) lo = m + 1; else hi = m; }
        const a = curve[lo - 1], b = curve[lo], w = len[lo] > len[lo - 1] ? (s - len[lo - 1]) / (len[lo] - len[lo - 1]) : 0;
        return a.map((v, c) => v + (b[c] - v) * w);
    };
    const frames = [];
    let yaw = 0;
    for (let f = 0; f < n; f++) {
        const s = (total * f) / (n - 1), a = at(s - TURN * total), b = at(s + TURN * total);
        const dx = b[0] - a[0], dz = b[2] - a[2];
        if (Math.hypot(dx, dz) > 1e-9) yaw = Math.atan2(dx, dz); // straight up or down: keep the last heading
        frames.push({ pos: at(s), yaw });
    }
    return frames;
}
