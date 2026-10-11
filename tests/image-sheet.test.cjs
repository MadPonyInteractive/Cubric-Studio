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
    packSheet, placeSheet, frameRect, isValidTree, sheetPixelSize, sheetGutter,
} = require('../js/utils/sheetLayout.js');
const { renderSheet } = require('../routes/imageSheet.js');

const ids = (t) => (t.kind === undefined ? [t.id] : [...ids(t.a), ...ids(t.b)]);

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

test('Cells never overlap and stay inside the sheet', () => {
    const aspects = [0.75, 0.55, 1.5, 0.8, 1.33, 0.7];
    for (const shape of [null, 1, 16 / 9, 9 / 16]) {
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
    } finally {
        await fs.remove(dir);
    }
});
