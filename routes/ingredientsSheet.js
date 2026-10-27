/**
 * LTX 2.3 Reference to Video (MPI-1060): several pictures as ONE reference sheet for
 * Lightricks' Ingredients IC-LoRA, plus the prompt that tells the model which cell is which.
 *
 * The LoRA reads one picture repeated over the clip, so the prompt box's pictures are
 * packed into one sheet here, before upload, and the local engine and the Pod both get
 * one file. Every rule below comes from a failed bench clip (MPI-1060 research/results.md
 * § Phase 2b, ported from research/bench-tools/layout_run.py compose_pack + where):
 *   - big black areas make the clip COPY the sheet layout, so the cells tile the whole
 *     canvas: grey cards, black only in thin gutters;
 *   - a character's views split into cells become a second person, so each picture stays
 *     WHOLE in one cell; a setting may be centre-cropped (>= 60% kept), a character or a
 *     prop never;
 *   - a cell named without a description is drawn as a web-page collage, so the prompt
 *     carries one described line per cell, never a bare "Picture n".
 *
 * Unlike Nano Banana's collage (deepinfraCollage.js) the sheet follows the CLIP's shape:
 * the graph pads it to the output size, and padding is the black the first rule forbids.
 */
const sharp = require('sharp');

const LONG_EDGE = 1920;   // 2x the stage-1 size the bench ran at
const GUT = 12;           // black gutter (Lightricks' example: 6 px at 1088)
const GREY = { r: 128, g: 128, b: 128 };
const CROPS = [0.6, 0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.43, 1.67];   // a setting's centre crops, >= 60% kept
const FAIR = 0.6;         // no picture under 60% of its fair share (characters count double)
const CHARACTER_FLOOR = 0.45;   // identity is the op's whole point: characters keep >= 45% of the sheet

/** The sheet's size: the clip's shape, long edge LONG_EDGE. */
function sheetSize(width, height) {
    const w = Number(width) || 16;
    const h = Number(height) || 9;
    const k = LONG_EDGE / Math.max(w, h);
    return { width: Math.round(w * k), height: Math.round(h * k) };
}

const _isLeaf = (t) => t.kind === undefined;

/**
 * Every slicing arrangement of `ids` (sorted): side by side adds aspects, stacked adds
 * 1/aspects. A slicing tree of exact-aspect cells has no padding inside, so only its outer
 * shape can miss the canvas.
 */
function _trees(ids, asp, croppable, memo) {
    const key = ids.join(',');
    if (memo.has(key)) return memo.get(key);
    let out;
    if (ids.length === 1) {
        const [id] = ids;
        out = croppable.has(id) ? CROPS.map(f => ({ id, r: asp[id] * f, crop: true })) : [{ id, r: asp[id] }];
    } else {
        const buckets = new Map();
        const [first, ...rest] = ids;
        for (let mask = 0; mask < 2 ** rest.length; mask++) {   // `first` always on side A: each split once
            const a = [first, ...rest.filter((_, j) => mask >> j & 1)];
            const b = rest.filter((_, j) => !(mask >> j & 1));
            if (!b.length) continue;
            for (const ta of _trees(a, asp, croppable, memo)) {
                for (const tb of _trees(b, asp, croppable, memo)) {
                    for (const t of [
                        { kind: 'H', a: ta, b: tb, r: ta.r + tb.r },
                        { kind: 'V', a: ta, b: tb, r: 1 / (1 / ta.r + 1 / tb.r) },
                    ]) {
                        // ponytail: one tree per 0.01 aspect bucket keeps the search instant
                        const k = Math.round(t.r * 100);
                        if (!buckets.has(k)) buckets.set(k, t);
                    }
                }
            }
        }
        out = [...buckets.values()];
    }
    memo.set(key, out);
    return out;
}

/** Each picture's fraction of the tree's area. */
function _shares(t, f = 1, out = {}) {
    if (_isLeaf(t)) {
        out[t.id] = f;
        return out;
    }
    const wa = t.kind === 'H' ? t.a.r / (t.a.r + t.b.r) : (1 / t.a.r) / (1 / t.a.r + 1 / t.b.r);
    _shares(t.a, f * wa, out);
    return _shares(t.b, f * (1 - wa), out);
}

const _charShare = (t, chars) => Object.entries(_shares(t)).reduce((s, [i, v]) => s + (chars.has(+i) ? v : 0), 0);

/**
 * Coverage of the canvas, but no picture below FAIR of its fair share and the characters
 * at CHARACTER_FLOOR at least: packing for coverage alone shrinks a full-body view to a
 * thumbnail and blows a prop up to half the sheet.
 */
function _score(t, count, chars, canvas) {
    const weight = (i) => (chars.has(i) ? 2 : 1);
    let total = 0;
    for (let i = 0; i < count; i++) total += weight(i);
    const sh = _shares(t);
    let worst = Infinity;
    let people = chars.size ? 0 : 1;
    for (const [k, s] of Object.entries(sh)) {
        const i = +k;
        worst = Math.min(worst, s / (weight(i) / total));
        if (chars.has(i)) people += s;
    }
    return Math.min(t.r / canvas, canvas / t.r) * Math.min(1, worst / FAIR) * Math.min(1, people / CHARACTER_FLOOR);
}

/**
 * Where each picture goes. Pure: aspects in, cells out.
 * @param {number[]} aspects - each picture's width / height, upright
 * @param {{characters?:Set<number>, croppable?:Set<number>, width:number, height:number}} opts
 * @returns {{cells:Array<{x:number,y:number,w:number,h:number,crop:boolean}>, coverage:number}}
 *   `coverage` = the canvas share the pictures themselves cover (not their grey cards).
 */
function layoutSheet(aspects, { characters = new Set(), croppable = new Set(), width, height }) {
    const count = aspects.length;
    const ids = aspects.map((_, i) => i);
    const canvas = width / height;
    let best = null;
    let bestScore = -1;
    for (const t of _trees(ids, aspects, croppable, new Map())) {
        const s = _score(t, count, characters, canvas);
        if (s > bestScore) { best = t; bestScore = s; }
    }
    const cells = [];
    let area = 0;
    const place = (t, x, y, w, h) => {
        if (_isLeaf(t)) {
            const cell = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), crop: !!t.crop };
            cells[t.id] = cell;
            const a = aspects[t.id];
            area += cell.crop ? cell.w * cell.h : Math.round(Math.min(w, h * a)) * Math.round(Math.min(h, w / a));
            return;
        }
        let { a, b } = t;
        if (_charShare(b, characters) > _charShare(a, characters)) [a, b] = [b, a];   // characters left / top
        if (t.kind === 'H') {
            const wa = (w - GUT) * a.r / (a.r + b.r);
            place(a, x, y, wa, h);
            place(b, x + wa + GUT, y, w - wa - GUT, h);
        } else {
            const ha = (h - GUT) * (1 / a.r) / (1 / a.r + 1 / b.r);
            place(a, x, y, w, ha);
            place(b, x, y + ha + GUT, w, h - ha - GUT);
        }
    };
    place(best, GUT, GUT, width - 2 * GUT, height - 2 * GUT);
    return { cells, coverage: area / (width * height) };
}

/** A cell's name for the prompt, from its centre: "Top Far Right Panel", "Left Panel". */
function cellName({ x, y, w, h }, width, height) {
    const cx = (x + w / 2) / width;
    const cy = (y + h / 2) / height;
    const v = h > 0.8 * height ? '' : cy < 0.4 ? 'Top ' : cy > 0.6 ? 'Bottom ' : 'Middle ';
    const hz = w > 0.8 * width ? '' : ['Far Left ', 'Left ', 'Centre ', 'Right ', 'Far Right '][Math.min(4, Math.floor(cx * 5))];
    return `${v}${hz}Panel`;
}

const TAG_LINE = /^\s*<Picture (\d+)>\s*[:\-–—]?\s*(.*)$/;
// An enhancer copying the Attached references list gives the voice a "picture" line too
// (MPI-1084: 10 of 12 runs on one 12B model, whatever the wording). The audio reaches LTX by
// its own slot and the scene names the tag, so the line is dropped rather than sent as scene.
const AUDIO_LINE = /^\s*<Audio \d+>/;
const ROLE_WORD = /^(character|person|setting|location|place|background|prop|object)\s*[:\-–—,]\s*/i;
const ROLES = {
    character: 'Character', person: 'Character',
    setting: 'Setting', location: 'Setting', place: 'Setting', background: 'Setting',
    prop: 'Prop', object: 'Prop',
};
const SHEET_HEADING = '### Reference Sheet Description';

/**
 * The prompt's `<Picture n> what it is` lines (D5), the role word optional
 * (`<Picture 2> setting: a mountain path`), and the scene: every other line but an
 * `<Audio n>` one.
 * @returns {{lines:Map<number,{role:string|null,text:string}>, scene:string}}
 */
function parseSheetPrompt(prompt) {
    const lines = new Map();
    const scene = [];
    for (const line of String(prompt || '').split(/\r?\n/)) {
        if (AUDIO_LINE.test(line)) continue;
        const m = TAG_LINE.exec(line);
        if (!m) {
            scene.push(line);
            continue;
        }
        const role = ROLE_WORD.exec(m[2]);
        const text = role ? m[2].slice(role[0].length) : m[2];
        if (text.trim()) lines.set(Number(m[1]), { role: role ? ROLES[role[1].toLowerCase()] : null, text: text.trim() });
    }
    return { lines, scene: scene.join('\n').trim() };
}

/**
 * Roles per picture (index into `tags`): the role words where given; when no line names a
 * character, an unlabelled Picture 1 is the character (the strip's first chip, as the help
 * says and its example writes: `<Picture 1>` bare, `setting:`/`prop:` on the others).
 */
function sheetRoles(tags, lines) {
    const roles = tags.map(n => lines.get(n)?.role || null);
    if (!roles.includes('Character') && !roles[0]) roles[0] = 'Character';
    return roles;
}

/**
 * The Ingredients prompt: one described line per cell, then the scene. A prompt that
 * already carries the sheet heading was written in this format by hand and goes as it is,
 * and so does one with no described picture (an empty sheet section reads as a collage).
 * A picture with no line stays on the sheet with no line: never a bare "Picture n".
 * ponytail: the enhancer filling undescribed lines is a later MPI-1060 item.
 */
function sheetPrompt(prompt, tags, names, roles, lines) {
    if (String(prompt || '').includes(SHEET_HEADING) || !tags.some(n => lines.has(n))) return prompt;
    const { scene } = parseSheetPrompt(prompt);
    const described = tags.map((n, i) => lines.has(n)
        && `**${names[i]}${roles[i] ? ` (${roles[i]})` : ''}:** ${lines.get(n).text}`).filter(Boolean);
    return `${SHEET_HEADING}\n${described.join('\n')}\n### Target Description\n${scene}`;
}

async function _uprightAspect(file) {
    // Header only, as buildCollage: a full decode of a 16K photo just for its size is ~800 MB.
    const { width, height } = (await sharp(file, { limitInputPixels: false }).metadata()).autoOrient;
    return width / height;
}

/**
 * @param {Array<{tag:number, path:string}>} pictures - in strip order, `tag` = n of <Picture n>
 * @param {string} prompt - the user's prompt
 * @param {{width?:number, height?:number}} size - the clip's output size
 * @returns {Promise<{png:Buffer, prompt:string, cells:object[], coverage:number}>}
 *   One picture is a sheet too (MPI-1139): sent as it was, the graph padded a portrait
 *   picture on a landscape clip with ~70% BLACK, the first rule above.
 */
async function buildReferenceSheet(pictures, prompt, { width, height } = {}) {
    const { lines } = parseSheetPrompt(prompt);
    const tags = pictures.map(p => p.tag);
    const roles = sheetRoles(tags, lines);
    const canvas = sheetSize(width, height);
    const aspects = [];
    for (const p of pictures) aspects.push(await _uprightAspect(p.path));
    const characters = new Set(roles.flatMap((r, i) => (r === 'Character' ? [i] : [])));
    const croppable = new Set(roles.flatMap((r, i) => (r === 'Setting' ? [i] : [])));
    const { cells, coverage } = layoutSheet(aspects, { characters, croppable, ...canvas });

    // One at a time: nine 16K photos decoded at once would not fit a 16 GB machine.
    const parts = [];
    for (const [i, p] of pictures.entries()) {
        const c = cells[i];
        parts.push({
            input: await sharp(p.path, { limitInputPixels: false }).rotate()
                .resize(c.w, c.h, { fit: c.crop ? 'cover' : 'contain', background: GREY })
                .flatten({ background: GREY })
                .toBuffer(),
            left: c.x,
            top: c.y,
        });
    }
    const png = await sharp({ create: { ...canvas, channels: 3, background: { r: 0, g: 0, b: 0 } } })
        .composite(parts)
        .png()
        .toBuffer();
    const names = cells.map(c => cellName(c, canvas.width, canvas.height));
    return { png, prompt: sheetPrompt(prompt, tags, names, roles, lines), cells, coverage };
}

module.exports = { buildReferenceSheet, layoutSheet, cellName, parseSheetPrompt, sheetSize, GUT };
