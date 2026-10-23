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

/**
 * MOSS-Image's layout prompt (MPI-1243): what core `MOSSImageLayoutPrompt` builds, the WHOLE
 * prompt as JSON - `summary.caption` = the prompt, one `object` item per box, bbox = pixel edges
 * `[y0, x0, y1, x1]` with the origin at the frame's centre. A `<name>` the prompt cites reads as
 * the name in words: MOSS has no box ids.
 */
export function mossLayoutPrompt(prompt, boxes, width, height) {
    const caption = String(prompt || '').replace(/<([A-Za-z][A-Za-z0-9_]*)>/g, (_, n) => n.replace(/_/g, ' ')).trim();
    // core rounds to 9 places before floor/ceil, so a float error never moves an edge a pixel
    const px = (v, side, edge) => edge(Number((v * side / SCALE).toFixed(9))) - Math.floor(side / 2);
    const items = layoutRows(boxes).map(({ bbox: [y0, x0, y1, x1], desc }, i) => {
        // A lettering box (Create boxes) is a MOSS `text` item: the quoted words are what it prints.
        const words = boxes[i].kind === 'text' && desc.match(/"([^"]+)"/)?.[1];
        return {
            label: words ? 'text' : 'object',
            caption: desc,
            ...(words && { text: words }),
            bbox: [px(y0, height, Math.floor), px(x0, width, Math.floor), px(y1, height, Math.ceil), px(x1, width, Math.ceil)],
        };
    });
    return JSON.stringify({ summary: { caption }, items, bbox_coord_space: 'abs_centralized', bbox_format: 'yxyx' });
}

/**
 * Create boxes (MPI-1253): the describer lays a picture out as a caption plus named boxes, in
 * the box format ITS family was trained on. A vision model only grounds precisely in its own
 * format and answers in it whatever the question says: Gemma 4 asked Qwen's [x1,y1,x2,y2] drew
 * a top strip of sky down the left side, and Qwen3-VL-4B asked named edges guessed on a
 * 100-step grid (Vogue cover, 1 of 9 boxes right). The wording is AcademiaSD's MOSS Layout
 * "Analyze Image" (comfyui_AcademiaSD, the video's tool) plus a name per item: Qwen3-VL-4B
 * greedy, 16 tight boxes, every text block found (MPI-1253 research/qwen-bench).
 * `named` is for a describer of no known family; it held on Gemma 4 and Qwen3-VL-30B.
 */
const MAX_BOXES = 20;
const BOX_FORMATS = {
    qwen: ['"bbox_2d": [x1, y1, x2, y2]', 'bbox_2d: x from the left edge (0) to the right edge (1000), y from the top edge (0) to the bottom edge (1000)'],
    gemma: ['"box_2d": [y1, x1, y2, x2]', 'box_2d: y from the top edge (0) to the bottom edge (1000), x from the left edge (0) to the right edge (1000)'],
    named: ['"box": {"top": 0, "left": 0, "bottom": 1000, "right": 1000}', 'box: each edge from 0 to 1000, top and bottom measured down from the top edge, left and right across from the left edge'],
};
export function analyseQuestion(family) {
    const [shape, rule] = BOX_FORMATS[family] || BOX_FORMATS.named;
    return 'Analyze this image to rebuild it as a layout. Output one JSON object and nothing else:\n'
        + `{"caption": "...", "items": [{"name": "...", "label": "...", ${shape}, "caption": "...", "text": "..."}]}\n`
        + 'caption: one paragraph describing the whole image: medium and style, setting, lighting, colors and composition.\n'
        + `items: the elements worth placing, the largest and most important first, at most ${MAX_BOXES}.\n`
        + '- label "character": a person, animal or creature. "object": a distinct object or region (a product, a car, '
        + 'a building, a table, the sky). "text": a legible sign, title or text block.\n'
        + `- ${rule}; the box tightly encloses the element.\n`
        + '- name: 1 to 3 words naming the element.\n'
        + '- caption: what the element looks like, at most 25 words (appearance, color, material, pose; for text, its '
        + 'typography and color). No names of real people.\n'
        + '- text: only for text items: every character exactly as written, in its own script, one item per text block '
        + 'with \\n between its lines. Omit the field for other labels.\n'
        + 'If there is no legible text, use no text items.';
}

/** An item's box as `[left, top, right, bottom]` on 0-1000. An array is read in its key's own
 *  family order (`box_2d` Google's, `bbox_2d`/`bbox` Qwen's) for a model that ignores the ask.
 *  A bare `box` array has no family of its own, so it is read in the order the describer was
 *  asked: Gemma 4 asked for `box_2d` answers `"box": [y1, x1, y2, x2]` some runs (Bazaar cover,
 *  2026-10-23: every item dropped, "found nothing"). */
function _edges(it, family) {
    const o = it?.box;
    if (o && typeof o === 'object' && !Array.isArray(o)) return [o.left, o.top, o.right, o.bottom];
    const google = Array.isArray(it?.box_2d) ? it.box_2d : family === 'gemma' && Array.isArray(o) ? o : null;
    if (google) { const [t, l, b, r] = google; return [l, t, r, b]; }
    return it?.bbox_2d || it?.bbox || o;
}

/** `text` with every string, list and object still open at its end closed (AcademiaSD's `_cerrar`). */
function _closeJson(text) {
    const open = [];
    let inStr = false, esc = false;
    for (const ch of text) {
        if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
        else if (ch === '"') inStr = true;
        else if (ch === '{' || ch === '[') open.push(ch === '{' ? '}' : ']');
        else if ((ch === '}' || ch === ']') && open.length) open.pop();
    }
    return (text + (inStr ? '"' : '')).replace(/[,:\s]+$/, '') + open.reverse().join('');
}

/** The first JSON object in the answer. One cut off by the token cap keeps its finished items:
 *  the tail is trimmed back to the last whole item and closed. */
function _firstJson(s) {
    const at = s.indexOf('{');
    for (let end = s.lastIndexOf('}'); at >= 0 && end > at; end = s.lastIndexOf('}', end - 1)) {
        try { return JSON.parse(s.slice(at, end + 1)); } catch { /* shorter */ }
    }
    for (let frag = at >= 0 ? s.slice(at) : ''; frag;) {
        try { return JSON.parse(_closeJson(frag)); } catch { /* trim an item */ }
        const k = Math.max(frag.lastIndexOf('},'), frag.lastIndexOf('}]'));
        frag = k > 0 ? frag.slice(0, k + 1) : '';
    }
    return null;
}

/**
 * The describer's answer -> `{ caption, boxes }` in the panel's shape (fractions, unique
 * names), or null when it holds no JSON. A box off the grid or with no area is dropped. A
 * lettering item becomes `kind: 'text'` with its words quoted at the head of the desc, so the
 * one editable field carries them to FLUX.3 and MOSS alike (`mossLayoutPrompt`).
 */
export function boxesFromAnalysis(text, family, max = MAX_BOXES) {
    const data = _firstJson(String(text || ''));
    if (!data || typeof data !== 'object') return null;
    const boxes = [];
    for (const it of Array.isArray(data.items) ? data.items : []) {
        const bb = _edges(it, family);
        if (!Array.isArray(bb) || bb.length !== 4 || !bb.every((v) => Number.isFinite(Number(v)))) continue;
        const [x1, y1, x2, y2] = bb.map((v) => Math.max(0, Math.min(SCALE, Number(v))) / SCALE);
        if (x2 - x1 < 0.01 || y2 - y1 < 0.01) continue;
        const name = uniqueBoxName(boxName(it.name || it.label).toLowerCase() || 'box', boxes);
        let desc = String(it.desc || it.caption || '').trim();
        // ponytail: the desc field is one line, so the text's own line breaks become spaces
        const words = it.label === 'text' && typeof it.text === 'string' ? it.text.replace(/"/g, '\'').split(/\s*\n\s*/).filter(Boolean).join(' ') : '';
        if (words) desc = `"${words}": ${desc}`;
        boxes.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1, desc, name, ...(words && { kind: 'text' }) });
        if (boxes.length >= max) break;
    }
    return { caption: String(data.caption || data.summary?.caption || '').trim(), boxes };
}

/** BFL's upsampler input for a request with locked boxes (`bbox.upsampling_input`). */
export function upsamplingInput(prompt, rows) {
    return `ORIGINAL PROMPT:\n${String(prompt).trim()}\n\n`
        + 'LOCKED BOUNDING-BOX ANNOTATIONS ([y_min, x_min, y_max, x_max] on a 0-1000 canvas, with (0, 0) at '
        + 'the top-left). This is an authoritative JSON list of dictionaries; preserve every supplied identity, '
        + `provenance value, null, and coordinate exactly:\n${JSON.stringify(rows)}`;
}

/**
 * The EDIT enhancer's request with boxes: each box as words (`<tiger>: A Bengal tiger, on the
 * right of the frame, at middle height.`), never coordinates, and told the pictures do not show
 * it. BFL's "LOCKED ... identity, provenance" header made the 4B enhancer write "the tiger from
 * the first image" 3 of 3 with no tiger picture; raw coordinates leaked into its prose or landed
 * on the wrong side. This wording: 0 of 3 (`research/boxes/enhbench.mjs`, 2026-10-20). The app
 * still appends the real table at run time (`withLayoutBoxes`).
 */
export function editPlacementInput(prompt, boxes) {
    const where = (b) => {
        const cx = (Number(b.x) || 0) + (Number(b.w) || 0) / 2;
        const cy = (Number(b.y) || 0) + (Number(b.h) || 0) / 2;
        const h = cx < 1 / 3 ? 'on the left' : cx > 2 / 3 ? 'on the right' : 'in the centre';
        const v = cy < 1 / 3 ? 'near the top' : cy > 2 / 3 ? 'near the bottom' : 'at middle height';
        return `${h} of the frame, ${v}`;
    };
    const rows = layoutRows(boxes);
    return `${String(prompt).trim()}\n\nPLACEMENT (where each thing goes in the edited image; the attached images do not show it):\n`
        + rows.map((r, i) => `<${r.id}>: ${r.desc}, ${where(boxes[i])}.`).join('\n');
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
