/**
 * tileCount.js — how many tiles the upscale op's Use Tiles path will sample (MPI-1038).
 *
 * A port of Impact Pack's `MakeTileSEGS.doit` tile maths (segs_nodes.py), so the prompt
 * box can say "Upscale · 15 tiles" before the run. The defaults are the widget values
 * every shipped "Tile Upscale" group bakes (bbox 1024, min_overlap 200, irregularity 0.7,
 * "Reuse fast"); change them here only together with the graphs.
 *
 * The node sees the picture AFTER `ImageScaleBy`, so the count follows the output size:
 * ComfyUI rounds the scaled size with Python's round() (half to even).
 */

/** Python's round(): halves go to the even neighbour. */
function _pyRound(x) {
    const r = Math.round(x);
    return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/**
 * @param {number} width   input picture width (px)
 * @param {number} height  input picture height (px)
 * @param {number} factor  the upscale factor (1 = detail only)
 * @returns {number} tiles the detailer will sample
 */
export function tileCount(width, height, factor, { bbox = 1024, overlap = 200, irregularity = 0.7 } = {}) {
    const w = _pyRound(width * factor);
    const h = _pyRound(height * factor);
    if (!(w > 0 && h > 0)) return 0;

    if (bbox <= 2 * overlap) overlap = bbox / 2;
    if (irregularity > 0) {
        // "Reuse fast" draws its masks at quality 128 and pads both values to make room.
        const compensate = Math.max(6, Math.trunc(128 * irregularity / 4));
        overlap += compensate;
        bbox += compensate * 2;
    }
    bbox = Math.min(bbox, w, h);

    const along = (len) => {
        // ponytail: a side under the padded overlap (~222 px) has no sane tiling in
        // Impact either; call it one tile rather than port its negative counts.
        if (bbox - overlap <= 0) return 1;
        let n = Math.ceil(len / (bbox - overlap));
        let sum = bbox * n - len;
        if (sum < 0) { n += 1; sum = bbox * n - len; }
        const step = n === 1 ? 0 : Math.trunc(sum / (n - 1));
        return step === bbox ? 1 : n;
    };
    return along(w) * along(h);
}
