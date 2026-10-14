'use strict';

/** MPI-1141 — reshapeRect: a ratio change keeps the box's centre and area. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let reshapeRect;
test.before(async () => {
    ({ reshapeRect } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'cropSnap.js')).href));
});

const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('free: same centre, same area, new ratio — may leave the picture', () => {
    const r = reshapeRect({ x: 0, y: 0, w: 2048, h: 1024 }, 16 / 9);
    near(centre(r)[0], 1024); near(centre(r)[1], 512);
    near(r.w * r.h, 2048 * 1024);
    near(r.w / r.h, 16 / 9);
});

test('bounded: shrinks and shifts to stay inside, keeping the ratio', () => {
    const r = reshapeRect({ x: 0, y: 0, w: 1024, h: 1024 }, 16 / 9, { w: 1024, h: 1024 });
    near(r.w / r.h, 16 / 9);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1024 + 1e-9 && r.y + r.h <= 1024 + 1e-9);
    near(r.w, 1024);
});

test('bounded: a box with room keeps its centre', () => {
    const r = reshapeRect({ x: 100, y: 500, w: 600, h: 300 }, 4 / 3, { w: 1024, h: 1024 });
    near(centre(r)[0], 400); near(centre(r)[1], 650);
    near(r.w * r.h, 600 * 300);
});
