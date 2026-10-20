/**
 * layoutBoxes.js — the Boxes layout table (MPI-1181, FLUX.3).
 *
 * The app's boxes are `{ x, y, w, h, desc, name }`, fractions of the output frame; the
 * name is the row id the prompt cites as `<name>`. FLUX.3 reads them as a JSON table at the END of its prompt:
 * `[{ id, bbox: [y_min, x_min, y_max, x_max] on a 0-1000 grid, desc }]` (core
 * `Flux3LayoutPrompt`). The enhancer's box mode is BFL's `flux3/bbox.py`, ported here:
 * `upsamplingInput` is the user message it was trained on, `reconcileBoxes` re-imposes the
 * user's boxes on its answer. Copy of BFL's file:
 * `.agents/mpi-kanban/tasks/MPI-1181/research/bfl_bbox.py`.
 */

const SCALE = 1000;
const ID = /^[A-Za-z][A-Za-z0-9_]*$/;

/** What the user typed as a box name -> a table id (`big cat` -> `big_cat`), or '' . */
export function boxName(raw) {
    return String(raw || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^[^A-Za-z]+/, '').replace(/_+$/, '');
}

/** `base` if no other box has it, else `base_2`, `base_3`... (`box` -> `box1`, `box2`). */
export function uniqueBoxName(base, others = []) {
    const taken = new Set(others.map((b) => b?.name));
    if (base === 'box') { let n = 1; while (taken.has(`box${n}`)) n++; return `box${n}`; }
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}_${n}`)) n++;
    return `${base}_${n}`;
}

/**
 * The app's boxes -> table rows, clamped to the grid. The id is the box's name (the
 * `<name>` the prompt cites); a box saved before names existed is `obj_N`. An empty desc
 * falls back to the name, so `tree` with "make <tree> purple" in the prompt still reads.
 */
export function layoutRows(boxes = []) {
    const grid = (v) => Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * SCALE);
    const seen = new Set();
    return boxes.map((b, i) => {
        let id = ID.test(String(b.name || '')) ? b.name : `obj_${i + 1}`;
        if (seen.has(id)) id = `${id}_${i + 1}`;
        seen.add(id);
        return {
            id,
            bbox: [grid(b.y), grid(b.x), grid(b.y + b.h), grid(b.x + b.w)],
            desc: String(b.desc || '').trim() || id.replace(/_/g, ' '),
        };
    });
}

/** BFL's upsampler input for a request with locked boxes (`bbox.upsampling_input`). */
export function upsamplingInput(prompt, rows) {
    return `ORIGINAL PROMPT:\n${String(prompt).trim()}\n\n`
        + 'LOCKED BOUNDING-BOX ANNOTATIONS ([y_min, x_min, y_max, x_max] on a 0-1000 canvas, with (0, 0) at '
        + 'the top-left). This is an authoritative JSON list of dictionaries; preserve every supplied identity, '
        + `provenance value, null, and coordinate exactly:\n${JSON.stringify(rows)}`;
}

/** `[caption, rows]`: the rows are the list parsed from the LAST `[` that parses (`bbox.split`). */
export function splitBoxTable(text) {
    const s = String(text);
    for (let i = s.length - 1; i >= 0; i--) {
        if (s[i] !== '[') continue;
        try {
            const rows = JSON.parse(s.slice(i));
            if (Array.isArray(rows)) return [s.slice(0, i).trimEnd(), rows];
        } catch { /* not this bracket */ }
    }
    return [s.trim(), null];
}

function validBox(box) {
    if (!Array.isArray(box) || box.length !== 4 || box.some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null;
    const [y1, x1, y2, x2] = box;
    // max <= 1 means 0-1 coordinates, not the 0-1000 canvas
    if (y1 < 0 || x1 < 0 || y2 <= y1 || x2 <= x1 || y2 > SCALE || x2 > SCALE || Math.max(...box) <= 1) return null;
    return box;
}

const boxOf = (r) => r?.bbox || r?.tgt_bbox || r?.src_bbox;

/** Does `text` already end in a box table (an enhanced box prompt)? `bbox.detect`, rows only. */
export function endsWithBoxTable(text) {
    const [, rows] = splitBoxTable(text);
    return !!rows?.length && rows.every((r) => r && typeof r === 'object' && ID.test(String(r.id))
        && ['bbox', 'src_bbox', 'tgt_bbox'].some((k) => validBox(r[k])));
}

/** A row the upsampler added: kept only if its id is cited as `<id>` and it is well formed. */
function validAdded(row, caption) {
    if (!row || typeof row !== 'object' || !ID.test(String(row.id)) || !caption.includes(`<${row.id}>`)) return null;
    const desc = typeof row.desc === 'string' ? row.desc.trim() : '';
    if (!desc) return null;
    const box = validBox(row.bbox);
    if (box) return { id: row.id, bbox: box, desc };
    const src = row.src_bbox == null ? null : validBox(row.src_bbox);
    const tgt = row.tgt_bbox == null ? null : validBox(row.tgt_bbox);
    const from = row.from;
    if (typeof from !== 'string' || !/^(ref_image_\d+|target)$/.test(from)
        || (row.src_bbox != null && !src) || (row.tgt_bbox != null && !tgt)
        || (!src && !tgt) || (from === 'target') === !!src) return null;
    return { id: row.id, from, src_bbox: src, tgt_bbox: tgt, desc };
}

function iou(a, b) {
    const inter = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
    return union > 0 ? inter / union : 0;
}

/**
 * The upsampler's answer with the user's boxes re-imposed (`bbox.reconcile`):
 * 1. a row re-planning a locked box under its own id (IoU >= 0.9) takes the locked id, in
 *    the rows and in the caption's `<id>` citations;
 * 2. locked rows are kept verbatim, adopting the upsampler's desc; its own valid rows follow.
 */
export function reconcileBoxes(text, locked) {
    let [caption, rows] = splitBoxTable(text);
    rows = (rows || []).filter((r) => r && typeof r === 'object');
    const lockedIds = new Set(locked.map((r) => r.id));
    const rowIds = new Set(rows.map((r) => r.id));
    const renamed = new Map();
    for (const lock of locked) {
        const lockBox = boxOf(lock);
        if (rowIds.has(lock.id) || !lockBox) continue;
        const hit = rows.find((r) => !renamed.has(r.id) && !lockedIds.has(r.id)
            && validBox(boxOf(r)) && iou(boxOf(r), lockBox) >= 0.9);
        if (hit) renamed.set(hit.id, lock.id);
    }
    for (const r of rows) if (renamed.has(r.id)) r.id = renamed.get(r.id);
    for (const [from, to] of renamed) caption = caption.split(`<${from}>`).join(`<${to}>`);

    const byId = new Map(rows.filter((r) => typeof r.id === 'string').map((r) => [r.id, r]));
    const out = locked.map((lock) => {
        const desc = byId.get(lock.id)?.desc;
        return { ...lock, desc: typeof desc === 'string' && desc.trim() ? desc.trim() : (lock.desc || '') };
    });
    for (const r of rows) {
        const added = validAdded(r, caption);
        if (added && !out.some((o) => o.id === added.id)) out.push(added);
    }
    return `${caption} ${JSON.stringify(out)}`;
}
