'use strict';

/**
 * ingredients-sheet.test.cjs — MPI-1060.
 *
 * LTX's Reference to Video reads ONE reference sheet, so the prompt box's pictures are
 * packed into one (routes/ingredientsSheet.js, a port of the bench's compose_pack). Held
 * down here, each rule from a failed bench clip:
 *   - the cells tile the canvas inside the gutters (black areas get copied into the clip);
 *   - characters keep >= 45% of the sheet and sit first (left / top), never cropped;
 *     only a setting is cropped;
 *   - the layout is the bench's, pixel for pixel, on the two eye-tested sheets;
 *   - the prompt names every DESCRIBED cell and never emits a bare "Picture n";
 *   - one picture passes through as the sheet; the sheet takes the clip's shape.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const {
    buildReferenceSheet, layoutSheet, cellName, parseSheetPrompt, sheetSize, GUT,
} = require('../routes/ingredientsSheet.js');

const W = 1920;
const H = 1024;
// The bench's eye-tested sheets (results.md § Phase 2b): her 3-view sheet, the mountains
// crop, the 3-view backpack.
const WOMAN = 1792 / 1120;
const MOUNTAINS = 367 / 155;
const BACKPACK = 408 / 269;

const area = (c) => c.w * c.h;

test('cells tile the canvas inside the gutters, never overlapping', () => {
    for (const aspects of [[WOMAN, MOUNTAINS, BACKPACK], [0.5, 1.6, 1, 0.75, 1.33], [0.6, 0.6]]) {
        const { cells } = layoutSheet(aspects, { characters: new Set([0]), croppable: new Set(), width: W, height: H });
        for (const c of cells) {
            assert.ok(c.x >= GUT && c.y >= GUT, `cell starts inside the gutter: ${JSON.stringify(c)}`);
            assert.ok(c.x + c.w <= W - GUT + 1 && c.y + c.h <= H - GUT + 1, `cell ends inside: ${JSON.stringify(c)}`);
        }
        for (const [i, a] of cells.entries()) {
            for (const b of cells.slice(i + 1)) {
                const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
                assert.ok(apart, `cells overlap: ${JSON.stringify(a)} ${JSON.stringify(b)}`);
            }
        }
        // Stretched to the canvas: what is not a cell is gutter, so no big black area.
        const used = cells.reduce((s, c) => s + area(c), 0);
        const gutters = GUT * (W + H) * (aspects.length + 1);
        assert.ok(used + gutters >= W * H * 0.99, `cells cover the canvas: ${used} of ${W * H}`);
    }
});

test('the layout is the bench\'s compose_pack, pixel for pixel', () => {
    const run = (aspects, chars, crop) => layoutSheet(aspects, { characters: new Set(chars), croppable: new Set(crop), width: W, height: H })
        .cells.map(c => [c.x, c.y, c.w, c.h]);
    // From layout_run.py on the bench python, 2026-10-10.
    assert.deepEqual(run([WOMAN, MOUNTAINS, BACKPACK], [0], [1]), [[12, 12, 1292, 1000], [1316, 12, 592, 510], [1316, 534, 592, 478]]);
    assert.deepEqual(run([WOMAN, 1.5], [0], [1]), [[12, 12, 1206, 1000], [1230, 12, 678, 1000]]);
});

test('the character floor: a character gets the biggest cell and sits first, never cropped', () => {
    // A thin full-body portrait among wide pictures: coverage alone makes it a fifth of the
    // sheet. The 45% floor is a score PENALTY (as on the bench), not a hard cut, so the
    // character lands near it: 43% here against 21% as a plain picture.
    const aspects = [0.4, 2.4, 1.8, 1.5];
    const share = (chars) => {
        const { cells } = layoutSheet(aspects, { characters: new Set(chars), croppable: new Set([1]), width: W, height: H });
        return [area(cells[0]) / cells.reduce((s, c) => s + area(c), 0), cells];
    };
    const [plain] = share([]);
    const [character, cells] = share([0]);
    assert.ok(character >= 0.4 && character >= 1.5 * plain, `character share ${character} vs ${plain} as a plain picture`);
    assert.ok(cells.every((c, i) => i === 0 || area(c) < area(cells[0])), 'the character has the biggest cell');
    assert.equal(cells[0].x, GUT, 'the character is on the left');
    assert.equal(cells[0].crop, false, 'a character is never cropped');
    assert.ok(cells.slice(2).every(c => !c.crop), 'only the setting may be cropped');
});

test('cell names follow the bench\'s where()', () => {
    assert.equal(cellName({ x: 12, y: 12, w: 1292, h: 1000 }, W, H), 'Left Panel');
    assert.equal(cellName({ x: 1316, y: 12, w: 592, h: 510 }, W, H), 'Top Far Right Panel');
    assert.equal(cellName({ x: 1316, y: 534, w: 592, h: 478 }, W, H), 'Bottom Far Right Panel');
    assert.equal(cellName({ x: 0, y: 0, w: W, h: H }, W, H), 'Panel');
});

test('the prompt\'s <Picture n> lines parse, the role word optional', () => {
    const { lines, scene } = parseSheetPrompt([
        '<Picture 1> a woman with copper-red hair',
        '<Picture 2>: setting: a mountain path',
        '<Picture 3> - Prop, a blue backpack',
        '<Picture 4>',
        'she walks up the path.',
        'handheld camera.',
    ].join('\n'));
    assert.deepEqual(lines.get(1), { role: null, text: 'a woman with copper-red hair' });
    assert.deepEqual(lines.get(2), { role: 'Setting', text: 'a mountain path' });
    assert.deepEqual(lines.get(3), { role: 'Prop', text: 'a blue backpack' });
    assert.equal(lines.has(4), false, 'a bare tag is not a description');
    assert.equal(scene, 'she walks up the path.\nhandheld camera.');
});

async function pictures(specs) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1060-'));
    return Promise.all(specs.map(async ([width, height, [r, g, b]], i) => {
        const file = path.join(dir, `pic${i + 1}.png`);
        await sharp({ create: { width, height, channels: 3, background: { r, g, b } } }).png().toFile(file);
        return { tag: i + 1, path: file };
    }));
}

const RED = [220, 30, 30];
const BLUE = [30, 60, 220];
const GREEN = [30, 170, 60];

test('the sheet: each picture in the cell its tag names, prompt names each described cell', async () => {
    const pics = await pictures([[1792, 1120, RED], [734, 310, BLUE], [816, 538, GREEN]]);
    const prompt = '<Picture 1> a woman with copper-red hair\n<Picture 3> prop: a blue backpack\nshe walks up the path.';
    const out = await buildReferenceSheet(pics, prompt, { width: 960, height: 512 });
    const meta = await sharp(out.png).metadata();
    assert.deepEqual([meta.width, meta.height], [1920, 1024]);
    const { data, info } = await sharp(out.png).raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    for (const [i, colour] of [RED, BLUE, GREEN].entries()) {
        const c = out.cells[i];
        assert.deepEqual(at(c.x + (c.w >> 1), c.y + (c.h >> 1)), colour, `picture ${i + 1} in its cell`);
    }
    // A role word given: only that role is labelled, Picture 1 gets none; Picture 2 has no
    // line and gets NO line, never a bare "Picture 2".
    assert.equal(out.prompt, [
        '### Reference Sheet Description',
        `**${cellName(out.cells[0], 1920, 1024)}:** a woman with copper-red hair`,
        `**${cellName(out.cells[2], 1920, 1024)} (Prop):** a blue backpack`,
        '### Target Description',
        'she walks up the path.',
    ].join('\n'));
    assert.doesNotMatch(out.prompt, /Picture \d/);
});

test('no role word anywhere: Picture 1 is the character', async () => {
    const pics = await pictures([[600, 1200, RED], [1200, 600, BLUE]]);
    const out = await buildReferenceSheet(pics, '<Picture 1> a man\n<Picture 2> a harbour\nhe waves.', {});
    assert.match(out.prompt, /^### Reference Sheet Description\n\*\*\w[\w ]* Panel \(Character\):\*\* a man\n\*\*[\w ]+Panel:\*\* a harbour\n### Target Description\nhe waves\.$/);
});

test('the sheet takes the clip\'s shape: a portrait clip gets a portrait sheet', async () => {
    assert.deepEqual(sheetSize(544, 960), { width: 1088, height: 1920 });
    assert.deepEqual(sheetSize(undefined, undefined), { width: 1920, height: 1080 });
    const pics = await pictures([[600, 1200, RED], [1200, 600, BLUE]]);
    const out = await buildReferenceSheet(pics, 'x', { width: 544, height: 960 });
    const meta = await sharp(out.png).metadata();
    assert.deepEqual([meta.width, meta.height], [1088, 1920]);
});

test('one picture passes through; a hand-written sheet prompt and an undescribed one are left alone', async () => {
    const [pic] = await pictures([[1792, 1120, RED]]);
    const one = await buildReferenceSheet([pic], '<Picture 1> a fisherman\nhe fishes.', {});
    assert.equal(one.png, null, 'the one picture IS the sheet');
    assert.equal(one.prompt, '### Reference Sheet Description\n**Panel (Character):** a fisherman\n### Target Description\nhe fishes.');

    const written = '### Reference Sheet Description\n**Left Panel (Character - Front View):** a fisherman\n### Target Description\nhe fishes.';
    assert.equal((await buildReferenceSheet([pic], written, {})).prompt, written);
    assert.equal((await buildReferenceSheet([pic], 'he fishes.', {})).prompt, 'he fishes.');
});
