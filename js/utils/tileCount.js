/**
 * tileCount.js — how many tiles the upscale op's Use Tiles path will sample (MPI-1038),
 * and the rect maths Phase 3 needs for per-tile captions (MPI-1232).
 *
 * A port of Impact Pack's `MakeTileSEGS.doit` tile maths (segs_nodes.py), so the prompt
 * box can say "Tile size · 15 tiles" before the run. The defaults are the widget values
 * every shipped "Tile Upscale" group bakes (bbox 1024, irregularity 0.7, "Reuse fast");
 * change them here only together with the graphs.
 *
 * The node sees the picture AFTER `ImageScaleBy`, so the count follows the output size:
 * ComfyUI rounds the scaled size with Python's round() (half to even).
 */

import { imageSize } from './upscaleLimit.js';

/** Python's round(): halves go to the even neighbour. */
function _pyRound(x) {
    const r = Math.round(x);
    return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/**
 * The min_overlap for a given tile bbox size: 20% of the tile, floor 64 px.
 * Matches the Phase 2 wiring decision (Fabio, 2026-10-22: "20% of tile, floor 64").
 * 1024 → 205 (≈ the graph's previously baked 200, within the "Reuse fast" padding).
 *
 * @param {number} tile  bbox size in px
 * @returns {number}
 */
export function overlapFor(tile) {
    return Math.max(64, Math.round(0.2 * tile));
}

/**
 * The bounding boxes Impact's MakeTileSEGS will cut on the SCALED picture,
 * sorted the way [ASC] wildcards order them: ascending by x1, then y1
 * (left column → right, top → bottom within each column).
 *
 * Port of `tilebench.py:tile_rects` (which ports `MakeTileSEGS.doit`, "Reuse fast" path).
 *
 * @param {number} width       input picture width (px)
 * @param {number} height      input picture height (px)
 * @param {number} factor      upscale factor (1 = detail only)
 * @param {{bbox?:number, overlap?:number, irregularity?:number}} [opts]
 *   overlap defaults to overlapFor(bbox) when omitted.
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number}>}
 */
export function tileRects(width, height, factor, { bbox = 1024, overlap, irregularity = 0.7 } = {}) {
    const iw = _pyRound(width * factor);
    const ih = _pyRound(height * factor);
    if (!(iw > 0 && ih > 0)) return [];

    if (overlap == null) overlap = overlapFor(bbox);
    if (bbox <= 2 * overlap) overlap = bbox / 2;
    if (irregularity > 0) {
        const comp = Math.max(6, Math.trunc(128 * irregularity / 4));
        overlap += comp;
        bbox += comp * 2;
    }
    bbox = Math.min(bbox, iw, ih);

    const nAlong = (length) => {
        // a side under the padded overlap has no sane tiling; call it one tile.
        if (bbox - overlap <= 0) return [1, 0];
        let n = Math.ceil(length / (bbox - overlap));
        let s = bbox * n - length;
        if (s < 0) { n += 1; s = bbox * n - length; }
        const step = n === 1 ? 0 : Math.trunc(s / (n - 1));
        return step === bbox ? [1, 0] : [n, step];
    };

    const [nh, wo] = nAlong(iw);
    const [nv, ho] = nAlong(ih);

    const rects = [];
    let y = 0;
    for (let r = 0; r < nv; r++) {
        let x = 0;
        for (let c = 0; c < nh; c++) {
            const x1 = (x + bbox < iw - 1) ? x : iw - bbox;
            const x2 = (x + bbox < iw - 1) ? x + bbox : iw;
            const y1 = (y + bbox < ih - 1) ? y : ih - bbox;
            const y2 = (y + bbox < ih - 1) ? y + bbox : ih;
            rects.push({ x1, y1, x2, y2 });
            x += bbox - wo;
        }
        y += bbox - ho;
    }
    return rects.sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
}

/**
 * @param {number} width   input picture width (px)
 * @param {number} height  input picture height (px)
 * @param {number} factor  the upscale factor (1 = detail only)
 * @param {{bbox?:number, overlap?:number, irregularity?:number}} [opts]
 * @returns {number} tiles the detailer will sample
 */
export function tileCount(width, height, factor, opts = {}) {
    return tileRects(width, height, factor, opts).length;
}

/**
 * The tiles a RESOLVED run will sample: the status bar's stage total (MPI-1175) and the
 * number Cosmo is told (MPI-1237), so the two can never differ.
 *
 * Reads Input_Tile_Size / Input_Tile_Overlap from the run params (falling back to
 * 1024 / overlapFor(1024) when absent — old runs without these keys stay unchanged).
 *
 * @param {Object} params  the run's injection params
 * @param {?string} image  its source picture, a disk path
 * @returns {Promise<number>} 0 = not a tile run, or no readable size
 */
export async function runTileCount(params, image) {
    if (params?.Input_Tile_Upscale !== true) return 0;
    if (!image || /^(data|blob|http)/.test(image)) return 0;
    const size = await imageSize(image);
    if (!size) return 0;
    const tileSize = Number(params.Input_Tile_Size) || 1024;
    const tileOverlap = params.Input_Tile_Overlap != null ? Number(params.Input_Tile_Overlap) : undefined;
    return tileRects(size.width, size.height, Number(params.Input_Upscale_Factor) || 1, {
        bbox: tileSize,
        overlap: tileOverlap,
    }).length;
}
