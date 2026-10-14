'use strict';

/** MPI-1141 — reshapeRect: a ratio change keeps the box, and keeps snapped edges snapped. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let reshapeRect;
test.before(async () => {
    ({ reshapeRect } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'cropSnap.js')).href));
});

const IMG = { w: 1024, h: 1024 };
const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('nothing snapped: same centre, same area, new ratio', () => {
    const r = reshapeRect({ x: 100, y: 500, w: 600, h: 300 }, 4 / 3, IMG, { inside: true });
    near(centre(r)[0], 400); near(centre(r)[1], 650);
    near(r.w * r.h, 600 * 300);
    near(r.w / r.h, 4 / 3);
});

test('left, top and bottom snapped (2:1 off the right) -> 21:9 keeps all three', () => {
    const r = reshapeRect({ x: 0, y: 0, w: 2048, h: 1024 }, 21 / 9, IMG);
    assert.deepEqual([r.x, r.y, r.h], [0, 0, 1024]);
    near(r.w, 1024 * 21 / 9);
});

test('right edge snapped stays snapped', () => {
    const r = reshapeRect({ x: -1024, y: 0, w: 2048, h: 1024 }, 16 / 9, IMG);
    near(r.x + r.w, 1024); near(r.y, 0); near(r.h, 1024);
});

test('left + right snapped keeps the width; free vertical axis keeps its centre', () => {
    const r = reshapeRect({ x: 0, y: 200, w: 1024, h: 512 }, 16 / 9, IMG, { inside: true });
    near(r.x, 0); near(r.w, 1024);
    near(r.h, 1024 * 9 / 16);
    near(centre(r)[1], 456);
});

test('whole picture to a wide ratio inside: largest centred box', () => {
    const r = reshapeRect({ x: 0, y: 0, w: 1024, h: 1024 }, 16 / 9, IMG, { inside: true });
    near(r.x, 0); near(r.w, 1024); near(r.h, 576); near(r.y, 224);
});

test('normalized space (video twin): bounds 1 x 1', () => {
    const r = reshapeRect({ x: 0, y: 0.1, w: 0.5, h: 0.8 }, 1, { w: 1, h: 1 }, { inside: true });
    near(r.x, 0);
    near(r.w * r.h, 0.4);
});
