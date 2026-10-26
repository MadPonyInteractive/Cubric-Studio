// @ts-check
/**
 * sheetLayout.js — where each picture goes on a combined image sheet (MPI-1094).
 *
 * Gallery Combine on 2+ stills packs them into ONE picture: a character or clothes sheet
 * from views the user already has, or a mood board up to 16K. Pure and import-free, so the
 * dialog previews with the same code the server renders with (`routes/imageSheet.js`
 * requires this file).
 *
 * The idea is the LTX reference sheet's (`routes/ingredientsSheet.js`): a slicing tree —
 * side by side adds aspects, stacked adds 1/aspects — of exact-aspect cells has no padding
 * inside, so only its OUTER shape can miss the canvas. Not that file's code: its crop search
 * grows 3^n (measured 2026-10-11: 9 croppable pictures took 67 s) and its canvas is fixed to
 * the clip. Here no crop is searched at all. Shape Auto takes the tree's own shape (nothing
 * cut, nothing padded); a fixed shape stretches the tree to it and every cell cover-crops,
 * which the user frames by hand (`frameRect`).
 *
 * Trees are searched exhaustively up to TREE_MAX pictures; rows and columns, which keep the
 * click order, are tried for any count, so a 30-picture mood board still packs.
 */

export const SHEET_SHAPES = [
    { value: 'auto', label: 'Auto', r: null },
    { value: '1:1', label: '1:1', r: 1 },
    { value: '4:3', label: '4:3', r: 4 / 3 },
    { value: '3:2', label: '3:2', r: 3 / 2 },
    { value: '8:5', label: '8:5', r: 8 / 5 },
    { value: '16:9', label: '16:9', r: 16 / 9 },
];
// Wide or square only (Fabio, 2026-10-11: a wide sheet works better; 8:5 is his most used).

/**
 * A sheet shape's width / height: a SHEET_SHAPES value, or any "w:h" label such as the
 * dialog's ratio picker sends ("9:16", "1:1.85"; MPI-1268). Null for 'auto'; undefined for
 * anything else, which the route refuses.
 */
export function sheetShapeRatio(shape) {
    const known = SHEET_SHAPES.find(s => s.value === shape);
    if (known) return known.r;
    const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(shape));
    const r = m ? Number(m[1]) / Number(m[2]) : NaN;
    return r >= 0.25 && r <= 4 ? r : undefined;
}

/** Long edge, px. 16384 is past sharp's default pixel limit: every reader passes `limitInputPixels: false`. */
export const SHEET_SIZES = [2048, 4096, 8192, 16384];

const AUTO_MIN = 1;        // Auto never picks a portrait sheet, nor one wider than 16:9
const AUTO_MAX = 16 / 9;
const TREE_MAX = 8;        // exhaustive trees: ~50 ms at 8 pictures, ~350 ms at 9
const FAIR = 0.6;          // no picture under 60% of its fair share (Bigger counts double)
const MAX_ZOOM = 8;
const STRIP_PENALTY = 0.85; // Whole pictures: a one-row / one-column grid must win by this much

const _isLeaf = (t) => t.kind === undefined;

function _leaf(id, asp, w) {
    return { id, r: asp[id], worst: 1, wsum: w[id] };
}

/**
 * `worst` = the smallest (area share / fair share) of any picture in the subtree, carried
 * up in O(1): a child's ratio scales by its area fraction and by how much of the weight it
 * holds.
 */
function _join(kind, a, b) {
    const r = kind === 'H' ? a.r + b.r : 1 / (1 / a.r + 1 / b.r);
    const fa = kind === 'H' ? a.r / (a.r + b.r) : (1 / a.r) / (1 / a.r + 1 / b.r);
    const wsum = a.wsum + b.wsum;
    const worst = Math.min(a.worst * fa * wsum / a.wsum, b.worst * (1 - fa) * wsum / b.wsum);
    return { kind, a, b, r, worst, wsum };
}

function _trees(ids, asp, w, memo) {
    const key = ids.join(',');
    if (memo.has(key)) return memo.get(key);
    let out;
    if (ids.length === 1) {
        out = [_leaf(ids[0], asp, w)];
    } else {
        const buckets = new Map();
        const [first, ...rest] = ids;
        for (let mask = 0; mask < 2 ** rest.length; mask++) {   // `first` always on side A: each split once
            const a = [first, ...rest.filter((_, j) => mask >> j & 1)];
            const b = rest.filter((_, j) => !(mask >> j & 1));
            if (!b.length) continue;
            for (const ta of _trees(a, asp, w, memo)) {
                for (const tb of _trees(b, asp, w, memo)) {
                    for (const t of [_join('H', ta, tb), _join('V', ta, tb)]) {
                        // ponytail: the fairest tree per 0.01 aspect bucket keeps the search instant
                        const k = Math.round(t.r * 100);
                        const had = buckets.get(k);
                        if (!had || t.worst > had.worst) buckets.set(k, t);
                    }
                }
            }
        }
        out = [...buckets.values()];
    }
    memo.set(key, out);
    return out;
}

/** Contiguous groups of `ids`, in order, with sums of `size` as even as a greedy cut makes them. */
function _split(ids, size, k) {
    const total = ids.reduce((s, i) => s + size(i), 0);
    const groups = [];
    let cur = [];
    let acc = 0;
    ids.forEach((id, j) => {
        cur.push(id);
        acc += size(id);
        const left = ids.length - j - 1;
        const need = k - groups.length - 1;   // groups still to open after this one
        if (need > 0 && (acc >= total * (groups.length + 1) / k || left === need)) {
            groups.push(cur);
            cur = [];
        }
    });
    if (cur.length) groups.push(cur);
    return groups;
}

/**
 * Rows (H inside, stacked V) and columns (V inside, side by side H), click order kept.
 * `rowsOnly`: rows alone, so the order also READS left to right, top to bottom.
 */
function _grids(ids, asp, w, rowsOnly = false) {
    const out = [];
    const chain = (group, kind) => group.map(i => _leaf(i, asp, w)).reduce((x, y) => _join(kind, x, y));
    for (let k = 1; k <= ids.length; k++) {
        out.push(_split(ids, i => asp[i], k).map(g => chain(g, 'H')).reduce((x, y) => _join('V', x, y)));
        if (!rowsOnly) out.push(_split(ids, i => 1 / asp[i], k).map(g => chain(g, 'V')).reduce((x, y) => _join('H', x, y)));
    }
    return out;
}

function _shapeFit(r, target) {
    if (target) return Math.min(r / target, target / r);
    return r < AUTO_MIN ? r / AUTO_MIN : r > AUTO_MAX ? AUTO_MAX / r : 1;
}

/** Plain JSON: leaves `{id}`, nodes `{kind, a, b}`. What the dialog sends the server. */
function _strip(t) {
    return _isLeaf(t) ? { id: t.id } : { kind: t.kind, a: _strip(t.a), b: _strip(t.b) };
}

/**
 * The arrangement and the sheet's shape.
 * @param {number[]} aspects - each picture's upright width / height
 * @param {{weights?: number[], shape?: number|null, ordered?: boolean}} [opts] - weight 2 =
 *   Bigger; shape null = Auto; `ordered` = rows only, so the pictures read in the order given
 *   (a stack's numbered sheet, MPI-1268)
 * @returns {{tree: object, r: number}} `r` = the sheet's width / height
 */
export function packSheet(aspects, { weights = [], shape = null, ordered = false } = {}) {
    const ids = aspects.map((_, i) => i);
    const w = ids.map(i => weights[i] || 1);
    const candidates = _grids(ids, aspects, w, ordered);
    if (!ordered && ids.length <= TREE_MAX) candidates.push(..._trees(ids, aspects, w, new Map()));
    let best = null;
    let bestScore = -1;
    for (const t of candidates) {
        // The small fairness term breaks ties between trees that both fit the shape.
        const s = _shapeFit(t.r, shape) * Math.min(1, t.worst / FAIR) + 0.01 * Math.min(1, t.worst);
        if (s > bestScore) { best = t; bestScore = s; }
    }
    return { tree: _strip(best), r: shape || autoRatio(best.r) };
}

/**
 * Whole pictures (MPI-1268): a grid of equal cells at the pictures' median shape, read left
 * to right, top to bottom; nothing is cropped. The grid that shows the most picture on the
 * sheet wins. Auto takes that grid's own shape (nothing padded); a fixed shape centres it.
 * @param {number[]} aspects - each picture's upright width / height
 * @param {{shape?: number|null}} [opts]
 * @returns {{grid: {cols:number, rows:number, cellAspect:number}, r: number}}
 */
export function gridSheet(aspects, { shape = null } = {}) {
    const n = aspects.length;
    const cellAspect = [...aspects].sort((a, b) => a - b)[(n - 1) >> 1];
    let best = null;
    let bestScore = -1;
    for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        if (cols > 1 && (cols - 1) * rows >= n) continue;   // a whole column would stand empty
        const r = cols * cellAspect / rows;
        // A single strip of 4+ reads as a ribbon, not a sheet (six 16:9 panels on 9:16 = two
        // columns, as a storyboard page has them, not one thin column with slightly more area).
        const strip = n >= 4 && Math.min(cols, rows) === 1 ? STRIP_PENALTY : 1;
        const score = (n / (cols * rows)) * _shapeFit(r, shape) * strip;
        if (score > bestScore + 1e-9) { best = { cols, rows, r }; bestScore = score; }
    }
    return { grid: { cols: best.cols, rows: best.rows, cellAspect }, r: shape || best.r };
}

/**
 * Each cell of a `gridSheet` grid, in px, on a `width` x `height` sheet with `gut` gutters;
 * the grid is centred when the sheet's shape is not its own.
 * @returns {Array<{x:number,y:number,w:number,h:number}>} indexed by picture
 */
export function placeGrid({ cols, rows, cellAspect }, n, width, height, gut) {
    const w0 = (width - (cols + 1) * gut) / cols;
    const h0 = (height - (rows + 1) * gut) / rows;
    const cw = Math.min(w0, h0 * cellAspect);
    const ch = cw / cellAspect;
    const x0 = (width - cols * cw - (cols - 1) * gut) / 2;
    const y0 = (height - rows * ch - (rows - 1) * gut) / 2;
    return Array.from({ length: n }, (_, i) => {
        const x = x0 + (i % cols) * (cw + gut);
        const y = y0 + Math.floor(i / cols) * (ch + gut);
        return { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(x + cw) - Math.round(x)), h: Math.max(1, Math.round(y + ch) - Math.round(y)) };
    });
}

/** The whole picture inside its cell (contain), centred, in the cell's px. */
export function containRect(imgAspect, cell) {
    const w = Math.max(1, Math.min(cell.w, Math.round(cell.h * imgAspect)));
    const h = Math.max(1, Math.min(cell.h, Math.round(cell.w / imgAspect)));
    return { x: cell.x + Math.round((cell.w - w) / 2), y: cell.y + Math.round((cell.h - h) / 2), w, h };
}

/** Auto's sheet shape for a tree of shape `treeR`: its own, kept inside the Auto range. */
export function autoRatio(treeR) {
    return Math.min(AUTO_MAX, Math.max(AUTO_MIN, treeR));
}

/** True when `tree` names every picture 0..count-1 exactly once (the server's trust check). */
export function isValidTree(tree, count) {
    const seen = new Set();
    const walk = (t) => {
        if (!t || typeof t !== 'object') return false;
        if (t.kind === undefined) {
            if (!Number.isInteger(t.id) || t.id < 0 || t.id >= count || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        }
        return (t.kind === 'H' || t.kind === 'V') && walk(t.a) && walk(t.b);
    };
    return walk(tree) && seen.size === count;
}

/** The sheet's pixel size for shape `r` and a long edge. */
export function sheetPixelSize(r, longEdge) {
    return r >= 1
        ? { width: longEdge, height: Math.max(1, Math.round(longEdge / r)) }
        : { width: Math.max(1, Math.round(longEdge * r)), height: longEdge };
}

/** Gutter in px: the LTX sheet's 12 px at 1920, scaled with the sheet. */
export function sheetGutter(width, height) {
    return Math.max(2, Math.round(Math.max(width, height) * 12 / 1920));
}

/**
 * Each picture's cell, in px, on a `width` x `height` sheet with `gut` gutters (edges too).
 * The tree's own aspects size the cells; a sheet of another shape stretches them.
 * @returns {Array<{x:number,y:number,w:number,h:number}>} indexed by picture
 */
export function placeSheet(tree, aspects, width, height, gut) {
    const ratio = (t) => (_isLeaf(t) ? aspects[t.id]
        : t.kind === 'H' ? ratio(t.a) + ratio(t.b) : 1 / (1 / ratio(t.a) + 1 / ratio(t.b)));
    const cells = [];
    const place = (t, x, y, w, h) => {
        if (_isLeaf(t)) {
            cells[t.id] = { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(x + w) - Math.round(x)), h: Math.max(1, Math.round(y + h) - Math.round(y)) };
            return;
        }
        const ra = ratio(t.a);
        const rb = ratio(t.b);
        if (t.kind === 'H') {
            const wa = (w - gut) * ra / (ra + rb);
            place(t.a, x, y, wa, h);
            place(t.b, x + wa + gut, y, w - wa - gut, h);
        } else {
            const ha = (h - gut) * (1 / ra) / (1 / ra + 1 / rb);
            place(t.a, x, y, w, ha);
            place(t.b, x, y + ha + gut, w, h - ha - gut);
        }
    };
    place(tree, gut, gut, width - 2 * gut, height - 2 * gut);
    return cells;
}

/**
 * A numbered sheet's badge in a cell's top-left corner (MPI-1268), in sheet px: the server
 * draws it, the dialog previews it from the same numbers.
 * @param {{x:number,y:number,w:number,h:number}} cell
 * @param {number} n - the number shown, from 1
 * @returns {{x:number, y:number, w:number, h:number, font:number}}
 */
export function sheetBadge(cell, n) {
    const h = Math.max(14, Math.round(Math.min(cell.w, cell.h) * 0.11));
    const m = Math.round(h * 0.3);
    const w = String(n).length > 1 ? Math.round(h * 1.45) : h;
    return { x: cell.x + m, y: cell.y + m, w, h, font: Math.round(h * 0.62) };
}

/**
 * The part of a picture its cell shows, as fractions of the picture: the cell's shape,
 * covering the picture at zoom 1, `zoom` times smaller past it, centred on (cx, cy) and
 * kept inside the picture.
 * @param {number} imgAspect - the picture's width / height
 * @param {number} cellAspect - the cell's width / height
 * @param {{zoom?:number, cx?:number, cy?:number}} [frame]
 * @returns {{x:number, y:number, w:number, h:number}}
 */
export function frameRect(imgAspect, cellAspect, { zoom = 1, cx = 0.5, cy = 0.5 } = {}) {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const w = Math.min(1, cellAspect / imgAspect) / z;
    const h = Math.min(1, imgAspect / cellAspect) / z;
    const x = Math.min(1 - w, Math.max(0, cx - w / 2));
    const y = Math.min(1 - h, Math.max(0, cy - h / 2));
    return { x, y, w, h };
}

export const SHEET_MAX_ZOOM = MAX_ZOOM;
