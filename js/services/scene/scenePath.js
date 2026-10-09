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
