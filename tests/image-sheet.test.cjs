'use strict';

/**
 * MPI-1094 — gallery Combine on stills: the packer (js/utils/sheetLayout.js, shared by the
 * dialog preview and the server) and the render (routes/imageSheet.js), on real pixels.
 */

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('fs-extra');
const sharp = require('sharp');

const {
    packSheet, placeSheet, frameRect, isValidTree, sheetPixelSize, sheetGutter, sheetBadge,
    gridSheet, placeGrid, containRect, sheetShapeRatio,
} = require('../js/utils/sheetLayout.js');
const { renderSheet } = require('../routes/imageSheet.js');

/** Share of the sheet a cell would cover with its picture uncropped (contain). */
function coverage(tree, aspects, r) {
    const { width, height } = sheetPixelSize(r, 2048);
    const cells = placeSheet(tree, aspects, width, height, 0);
    return cells.reduce((s, c, i) => s + Math.min(c.w, c.h * aspects[i]) * Math.min(c.h, c.w / aspects[i]), 0) / (width * height);
}

test('Auto picks a shape the pictures fill: nothing padded, nothing cropped', () => {
    for (const aspects of [[0.75, 0.75], [0.75, 0.55, 1.5], [1.33, 0.7, 1, 1.78, 0.6]]) {
        const { tree, r } = packSheet(aspects);
        assert.ok(isValidTree(tree, aspects.length));
        assert.ok(r >= 1, `Auto went portrait: ${r}`);   // wide or square only (Fabio, 2026-10-11)
        assert.ok(coverage(tree, aspects, r) > 0.97, `${aspects}: ${coverage(tree, aspects, r)}`);
    }
});

test('Fabio\'s example: two portrait shots on a 1:1 sheet sit side by side', () => {
    const { tree, r } = packSheet([405 / 539, 408 / 741], { shape: 1 });
    assert.strictEqual(r, 1);
    assert.strictEqual(tree.kind, 'H');
});

test('Bigger gives a picture the bigger cell', () => {
    const aspects = [0.75, 0.75, 0.75];
    const { tree, r } = packSheet(aspects, { weights: [1, 1, 2] });
    const { width, height } = sheetPixelSize(r, 2048);
    const cells = placeSheet(tree, aspects, width, height, 0);
    const area = cells.map(c => c.w * c.h);
    assert.ok(area[2] > area[0] && area[2] > area[1], JSON.stringify(cells));
});

test('A 30-picture mood board packs fast and keeps every picture', () => {
    const aspects = Array.from({ length: 30 }, (_, i) => [0.67, 1, 1.5, 0.8, 1.78][i % 5]);
    const t0 = Date.now();
    const { tree } = packSheet(aspects, { shape: 16 / 9 });
    assert.ok(Date.now() - t0 < 500);
    assert.ok(isValidTree(tree, 30));
});

test('MPI-1268: an ordered sheet reads in the given order, left to right, top to bottom', () => {
    const sets = [[1.78, 1.78, 1.78, 1.78, 1.78, 1.78], [0.75, 1.5, 1, 0.6, 1.33], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [0.7, 0.7]];
    for (const aspects of sets) {
        for (const shape of [null, 1, 16 / 9]) {
            const { tree, r } = packSheet(aspects, { ordered: true, shape });
            assert.ok(isValidTree(tree, aspects.length));
            const { width, height } = sheetPixelSize(r, 2048);
            const cells = placeSheet(tree, aspects, width, height, sheetGutter(width, height));
            for (let i = 1; i < cells.length; i++) {
                const [p, c] = [cells[i - 1], cells[i]];
                const sameRow = Math.abs(c.y - p.y) <= 1 && c.x > p.x;
                const nextRow = c.y >= p.y + p.h;
                assert.ok(sameRow || nextRow, `${aspects} shape ${shape}: picture ${i + 1} is out of reading order`);
            }
        }
    }
});

test('MPI-1268: Whole pictures = an even grid at the pictures\' shape, nothing cropped, in order', () => {
    // Fabio's case: two 16:9 panels on a 16:9 sheet must not be cropped.
    const two = gridSheet([16 / 9, 16 / 9], { shape: 16 / 9 });
    assert.strictEqual(two.r, 16 / 9);
    // Fabio's reference storyboard: twelve 4:3 panels on a 9:16 page = two columns of six.
    const ref = gridSheet(Array(12).fill(4 / 3), { shape: 9 / 16 });
    assert.deepStrictEqual([ref.grid.cols, ref.grid.rows], [2, 6]);
    // Six 16:9 panels on a 9:16 page: two columns of three, not one thin column.
    const six = gridSheet(Array(6).fill(16 / 9), { shape: 9 / 16 });
    assert.deepStrictEqual([six.grid.cols, six.grid.rows], [2, 3]);
    // Auto takes the grid's own shape: no padding at all.
    const auto = gridSheet(Array(6).fill(16 / 9));
    assert.ok(Math.abs(auto.r - auto.grid.cols * (16 / 9) / auto.grid.rows) < 1e-9);
    for (const { grid, r } of [two, six, auto]) {
        const n = grid === two.grid ? 2 : 6;
        const { width, height } = sheetPixelSize(r, 2048);
        const cells = placeGrid(grid, n, width, height, sheetGutter(width, height));
        cells.forEach((c, i) => {
            const pic = containRect(16 / 9, c);
            assert.ok(Math.abs(pic.w / pic.h - 16 / 9) < 0.02, `picture ${i + 1} keeps its shape`);
            assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= width && c.y + c.h <= height, `cell ${i + 1} inside`);
            if (i) assert.ok(c.y > cells[i - 1].y || c.x > cells[i - 1].x, `cell ${i + 1} in reading order`);
        });
    }
});

test('MPI-1268: a sheet shape is a known value or any w:h label', () => {
    assert.strictEqual(sheetShapeRatio('auto'), null);
    assert.strictEqual(sheetShapeRatio('16:9'), 16 / 9);
    assert.strictEqual(sheetShapeRatio('9:16'), 9 / 16);
    assert.strictEqual(sheetShapeRatio('1:1.85'), 1 / 1.85);
    for (const bad of ['tall', '0:1', '1:0', '20:1', '', undefined]) assert.strictEqual(sheetShapeRatio(bad), undefined, String(bad));
});

test('Cells never overlap and stay inside the sheet', () => {
    const aspects = [0.75, 0.55, 1.5, 0.8, 1.33, 0.7];
    for (const shape of [null, 1, 8 / 5, 16 / 9]) {
        const { tree, r } = packSheet(aspects, { shape });
        const { width, height } = sheetPixelSize(r, 4096);
        const gut = sheetGutter(width, height);
        const cells = placeSheet(tree, aspects, width, height, gut);
        for (const [i, a] of cells.entries()) {
            assert.ok(a.x >= gut && a.y >= gut && a.x + a.w <= width - gut + 1 && a.y + a.h <= height - gut + 1);
            for (const b of cells.slice(i + 1)) {
                assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
            }
        }
    }
});

test('isValidTree refuses a missing, repeated or foreign picture', () => {
    assert.ok(!isValidTree({ kind: 'H', a: { id: 0 }, b: { id: 0 } }, 2));
    assert.ok(!isValidTree({ kind: 'H', a: { id: 0 }, b: { id: 2 } }, 2));
    assert.ok(!isValidTree({ kind: 'X', a: { id: 0 }, b: { id: 1 } }, 2));
    assert.ok(!isValidTree({ id: 0 }, 2));
    assert.ok(isValidTree({ kind: 'V', a: { id: 1 }, b: { id: 0 } }, 2));
});

test('frameRect: cover at zoom 1, smaller when zoomed, always inside the picture', () => {
    assert.deepStrictEqual(frameRect(2, 1), { x: 0.25, y: 0, w: 0.5, h: 1 });
    const z = frameRect(1, 1, { zoom: 2, cx: 0, cy: 1 });
    assert.deepStrictEqual(z, { x: 0, y: 0.5, w: 0.5, h: 0.5 });
});

test('renderSheet: the framed part of each picture lands in its cell', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi1094-'));
    try {
        // Left half red, right half blue: framing on the right must give blue only.
        const a = path.join(dir, 'a.png');
        const b = path.join(dir, 'b.png');
        const half = Buffer.alloc(200 * 100 * 3);
        for (let i = 0; i < 200 * 100; i++) half.set((i % 200) < 100 ? [255, 0, 0] : [0, 0, 255], i * 3);
        await sharp(half, { raw: { width: 200, height: 100, channels: 3 } }).png().toFile(a);
        await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toFile(b);

        const tree = { kind: 'H', a: { id: 0 }, b: { id: 1 } };
        const out = await renderSheet([a, b], { tree, shape: '1:1', longEdge: 2048, frames: [{ cx: 1, cy: 0.5 }, {}] });
        assert.deepStrictEqual([out.width, out.height], [2048, 2048]);
        const { data, info } = await out.sharp.raw().toBuffer({ resolveWithObject: true });
        const ch = info.channels;   // composite adds an alpha band
        const px = (x, y) => [...data.subarray((y * info.width + x) * ch, (y * info.width + x) * ch + 3)];
        const gut = sheetGutter(2048, 2048);
        const cells = placeSheet(tree, [2, 1], 2048, 2048, gut);
        const c0 = cells[0];
        assert.deepStrictEqual(px(c0.x + 2, c0.y + 2), [0, 0, 255]);
        assert.deepStrictEqual(px(c0.x + c0.w - 3, c0.y + c0.h - 3), [0, 0, 255]);
        const c1 = cells[1];
        assert.deepStrictEqual(px(c1.x + c1.w / 2 | 0, c1.y + c1.h / 2 | 0), [0, 255, 0]);
        assert.deepStrictEqual(px(1, 1), [0, 0, 0]);   // gutter

        // MPI-1099: no tree (Cosmo's make_sheet) = packed here, every picture centred.
        const auto = await renderSheet([a, b], { shape: 'auto', longEdge: 2048 });
        assert.ok(auto.width === 2048 && auto.height <= 2048, `never portrait: ${auto.width}x${auto.height}`);
        const { data: ad, info: ai } = await auto.sharp.raw().toBuffer({ resolveWithObject: true });
        assert.ok(ad.length === ai.width * ai.height * ai.channels);

        // MPI-1268: a numbered sheet stamps 1, 2 top-left of each cell, black with a white number.
        const num = await renderSheet([b, b], { tree, shape: '1:1', longEdge: 2048, numbered: true });
        const { data: nd, info: ni } = await num.sharp.raw().toBuffer({ resolveWithObject: true });
        const npx = (x, y) => [...nd.subarray((y * ni.width + x) * ni.channels, (y * ni.width + x) * ni.channels + 3)];
        for (const [i, c] of placeSheet(tree, [1, 1], 2048, 2048, gut).entries()) {
            const bd = sheetBadge(c, i + 1);
            assert.deepStrictEqual(npx(bd.x + 2, bd.y + (bd.h >> 1)), [0, 0, 0], `badge ${i + 1} is black`);
            let white = 0;
            for (let y = bd.y; y < bd.y + bd.h; y++) for (let x = bd.x; x < bd.x + bd.w; x++) if (npx(x, y).every(v => v > 230)) white++;
            assert.ok(white > 20, `badge ${i + 1} has a white number (${white} px)`);
            assert.deepStrictEqual(npx(c.x + c.w - 3, c.y + c.h - 3), [0, 255, 0], 'the rest of the cell is the picture');
        }

        // MPI-1268 Whole pictures: the 2:1 red|blue picture keeps BOTH halves (no crop).
        const wh = await renderSheet([a, a], { shape: '9:16', longEdge: 2048, whole: true });
        assert.ok(wh.height > wh.width, 'a portrait sheet');
        const { data: wd, info: wi } = await wh.sharp.raw().toBuffer({ resolveWithObject: true });
        const wpx = (x, y) => [...wd.subarray((y * wi.width + x) * wi.channels, (y * wi.width + x) * wi.channels + 3)];
        const { grid } = gridSheet([2, 2], { shape: 9 / 16 });
        const pic = containRect(2, placeGrid(grid, 2, wi.width, wi.height, sheetGutter(wi.width, wi.height))[0]);
        const mid = pic.y + (pic.h >> 1);
        assert.deepStrictEqual(wpx(pic.x + 3, mid), [255, 0, 0], 'left edge red');
        assert.deepStrictEqual(wpx(pic.x + pic.w - 4, mid), [0, 0, 255], 'right edge blue');
    } finally {
        await fs.remove(dir);
    }
});
