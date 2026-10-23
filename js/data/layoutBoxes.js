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

/** An item's box as `[left, top, right, bottom]` on 0-1000. Named edges read by name; an
 *  array (`box_2d`, `bbox_2d`, `bbox`, `box`) in `order` - `yx` or `xy` - else by its key
 *  (`box_2d` y-first, the rest x-first). A model's key does not say its order: Gemma 4 writes
 *  y-first under `bbox_2d` and bare `box` too, so `fitAnalysis` lets the picture decide. */
function _edges(it, order) {
    const o = it?.box;
    if (o && typeof o === 'object' && !Array.isArray(o)) return [o.left, o.top, o.right, o.bottom];
    const arr = [it?.box_2d, it?.bbox_2d, it?.bbox, o].find(Array.isArray);
    if (!arr || !(order ? order === 'yx' : arr === it?.box_2d)) return arr;
    const [t, l, b, r] = arr;
    return [l, t, r, b];
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
export function boxesFromAnalysis(text, order, max = MAX_BOXES) {
    const data = _firstJson(String(text || ''));
    if (!data || typeof data !== 'object') return null;
    const boxes = [];
    for (const it of Array.isArray(data.items) ? data.items : []) {
        const bb = _edges(it, order);
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

/**
 * Create boxes' snap pass: a chat describer places boxes loosely (Gemma 4 drops a text
 * block's first line, Bazaar cover 2026-10-23), so each box is fitted to the picture's own
 * ink. Around the box, every pixel that stands out from the window's border colour is ink;
 * ink within a line gap joins into one block (letters into words, lines into a text block,
 * never two blocks a heading apart); the box becomes the tight edge of the blocks it covers.
 * A block running out of the window (lettering on a photo) or landing far from the
 * describer's box leaves that box as it was. `img` is `{ data, width, height, channels }`,
 * best at ~640 px on the long side.
 */
export function snapBoxes(boxes, img) {
    const { data, width: W, height: H, channels: ch = 4 } = img;
    const luma = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
        const p = i * ch;
        luma[i] = ch < 3 ? data[p] : (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    }
    // Joins gaps up to 2x: letter-spaced caps (~1% wide) and line gaps (~0.8% high) close,
    // a rule or paragraph 2%+ below a heading stays apart (Bazaar + Vogue covers).
    const rx = Math.max(2, Math.round(W * 0.012)), ry = Math.max(1, Math.round(H * 0.006));
    return boxes.map((b) => {
        const bx0 = b.x * W, by0 = b.y * H, bx1 = (b.x + b.w) * W, by1 = (b.y + b.h) * H;
        const px = b.w * W / 4 + W * 0.025, py = b.h * H / 4 + H * 0.025;
        const x0 = Math.max(0, Math.floor(bx0 - px)), x1 = Math.min(W, Math.ceil(bx1 + px));
        const y0 = Math.max(0, Math.floor(by0 - py)), y1 = Math.min(H, Math.ceil(by1 + py));
        const w = x1 - x0, h = y1 - y0;
        if (w < 3 || h < 3) return b;
        const border = [];
        for (let x = x0; x < x1; x++) border.push(luma[y0 * W + x], luma[(y1 - 1) * W + x]);
        for (let y = y0; y < y1; y++) border.push(luma[y * W + x0], luma[y * W + x1 - 1]);
        border.sort((p, q) => p - q);
        const bg = border[border.length >> 1];
        // Ink, then joined: a pixel is in a block when any ink lies within rx/ry (integral image).
        const sum = new Int32Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) {
            let row = 0;
            for (let x = 0; x < w; x++) {
                row += Math.abs(luma[(y0 + y) * W + x0 + x] - bg) > 32 ? 1 : 0;
                sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
            }
        }
        const inkAt = (x, y) => sum[(y + 1) * (w + 1) + x + 1] - sum[y * (w + 1) + x + 1] - sum[(y + 1) * (w + 1) + x] + sum[y * (w + 1) + x] > 0;
        const near = (x, y) => {
            const ax = Math.max(0, x - rx), ay = Math.max(0, y - ry), bx = Math.min(w, x + rx + 1), by = Math.min(h, y + ry + 1);
            return sum[by * (w + 1) + bx] - sum[ay * (w + 1) + bx] - sum[by * (w + 1) + ax] + sum[ay * (w + 1) + ax] > 0;
        };
        const seen = new Uint8Array(w * h);
        const stack = new Int32Array(w * h);
        let ux0 = Infinity, uy0 = Infinity, ux1 = -1, uy1 = -1;
        for (let s = 0; s < w * h; s++) {
            if (seen[s] || !near(s % w, (s / w) | 0)) continue;
            // One block: its ink's edges, whether it reaches a cut window edge, its ink inside the box.
            let n = 0, top = 0, ix0 = Infinity, iy0 = Infinity, ix1 = -1, iy1 = -1, cut = false, inside = 0, ink = 0;
            stack[top++] = s; seen[s] = 1;
            while (top) {
                const p = stack[--top], x = p % w, y = (p / w) | 0;
                n++;
                if ((x === 0 && x0 > 0) || (y === 0 && y0 > 0) || (x === w - 1 && x1 < W) || (y === h - 1 && y1 < H)) cut = true;
                if (inkAt(x, y)) {
                    ink++;
                    if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
                    if (x0 + x >= bx0 && x0 + x < bx1 && y0 + y >= by0 && y0 + y < by1) inside++;
                }
                for (const q of [x > 0 && p - 1, x < w - 1 && p + 1, y > 0 && p - w, y < h - 1 && p + w]) {
                    if (q !== false && !seen[q] && near(q % w, (q / w) | 0)) { seen[q] = 1; stack[top++] = q; }
                }
            }
            if (!ink || inside < ink * 0.25) continue; // a neighbour the box only grazes
            if (cut) return b;
            ux0 = Math.min(ux0, ix0); uy0 = Math.min(uy0, iy0); ux1 = Math.max(ux1, ix1); uy1 = Math.max(uy1, iy1);
        }
        if (ux1 < 0) return b;
        const snapped = { x: (x0 + ux0) / W, y: (y0 + uy0) / H, w: (ux1 - ux0 + 1) / W, h: (uy1 - uy0 + 1) / H };
        // A missed line grows a box ~1.3x; much more is the box swallowing its neighbours.
        return iou(_rectEdges(b), _rectEdges(snapped)) < 0.4 || snapped.w * snapped.h > b.w * b.h * 1.6 ? b : { ...b, ...snapped };
    });
}

const _rectEdges = (r) => [r.x, r.y, r.x + r.w, r.y + r.h];

/**
 * The describer's answer read against the picture, for any model: an array box may be y-first
 * or x-first whatever its key, so both readings are snapped (`snapBoxes`) and the one whose
 * boxes land on the picture's ink wins - a mirrored reading lands on blank page and fits
 * nothing (Bazaar 2026-10-23: 0 of 10). The key's order stands unless another reading CLEARLY
 * fits better - 2+ boxes snapped and 1.0 more fit: on a photo collage almost nothing snaps either
 * way, and one stray snap flipped Tokyo's every box on its side (2026-10-23, Gemma 4, 1 snapped).
 * `{ caption, boxes, fixed, order, snapped }`, the boxes snapped; null with no JSON.
 */
export function fitAnalysis(text, img) {
    let key = null, best = null;
    for (const order of [undefined, 'yx', 'xy']) {
        const found = boxesFromAnalysis(text, order);
        if (!found) return null;
        const boxes = snapBoxes(found.boxes, img);
        const fit = boxes.reduce((s, b, i) => s + (b === found.boxes[i] ? 0 : iou(_rectEdges(b), _rectEdges(found.boxes[i]))), 0);
        const fixed = boxes.map((b, i) => b !== found.boxes[i]);
        const read = { ...found, boxes, fixed, order: order || 'key', snapped: fixed.filter(Boolean).length, fit };
        if (!key) key = best = read;
        else if (read.snapped >= 2 && read.fit >= key.fit + 1 && read.fit > best.fit) best = read;
    }
    return best;
}

/**
 * Create boxes' zoom pass (Fabio, 2026-10-23): a small box the ink could not fix (text on a
 * photo, a thin sidebar) is asked about again on an ENLARGED crop around it, where it fills
 * the model's view instead of a sliver of it. These pick the boxes, frame the crop, word the
 * question in the describer's own box format and map its answer back onto the picture.
 */
const ZOOM_MAX_AREA = 0.1; // a box past a tenth of the picture is seen well enough already
const ZOOM_MAX = 12;
export function zoomTargets(found) {
    return (found?.boxes || []).map((b, i) => i)
        .filter((i) => !found.fixed?.[i] && found.boxes[i].w * found.boxes[i].h < ZOOM_MAX_AREA)
        .slice(0, ZOOM_MAX);
}

/** The crop around `b`: half its long side and 4% of the picture on every side, so a box
 *  that is off still has its element inside. Fractions of the picture. */
export function zoomCrop(b) {
    const pad = Math.max(b.w, b.h) * 0.5 + 0.04;
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
    return { x, y, w: Math.min(1, b.x + b.w + pad) - x, h: Math.min(1, b.y + b.h + pad) - y };
}

export function zoomQuestion(family, b) {
    const [shape, rule] = BOX_FORMATS[family] || BOX_FORMATS.named;
    return `Find this element in the image: ${b.name.replace(/_/g, ' ')}${b.desc ? ` - ${b.desc}` : ''}\n`
        + 'Output one JSON object and nothing else:\n'
        + `{"items": [{"name": "...", ${shape}}]}\n`
        + `- ${rule}; the box tightly encloses the whole element${b.kind === 'text' ? ', every line of the text block' : ''}.\n`
        + '- If the element is not in the image, output {"items": []}.';
}

/** The zoom answer as `b` moved onto the picture, or null to keep `b`: nothing found, the
 *  whole crop (the model gave up), or a box that misses `b` entirely (a neighbour). */
export function fromZoom(text, crop, order, b) {
    const z = boxesFromAnalysis(text, order === 'key' ? undefined : order, 1)?.boxes[0];
    if (!z || z.w * z.h > 0.9) return null;
    const r = { x: crop.x + z.x * crop.w, y: crop.y + z.y * crop.h, w: z.w * crop.w, h: z.h * crop.h };
    return iou(_rectEdges(r), _rectEdges(b)) < 0.1 ? null : { ...b, ...r };
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
