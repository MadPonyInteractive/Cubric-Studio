/**
 * step-edges.test.cjs — MPI-1101 A2.
 *
 * Unit tests for the pure maths functions exported by MpiStepEdges:
 *   - clamping: per-side [0,50]; pairs (left+right, top+bottom) ≤ 100
 *   - default value
 *   - axes from value
 *   - CSS repeat mapping for tiles 1–4, including a single-axis case
 *
 * No DOM required — all functions are pure JS exported alongside the component.
 */

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const mod  = () => import(
    'file://' + repo('js/components/Organisms/MpiStepEdges/MpiStepEdges.js').replace(/\\/g, '/')
);

// ── clampEdge ─────────────────────────────────────────────────────────────────

test('clampEdge: values inside [0,50] pass through', async () => {
    const { clampEdge } = await mod();
    assert.equal(clampEdge(0),  0);
    assert.equal(clampEdge(10), 10);
    assert.equal(clampEdge(25), 25);
    assert.equal(clampEdge(50), 50);
});

test('clampEdge: below 0 clamps to 0', async () => {
    const { clampEdge } = await mod();
    assert.equal(clampEdge(-1),   0);
    assert.equal(clampEdge(-100), 0);
});

test('clampEdge: above 50 clamps to 50', async () => {
    const { clampEdge } = await mod();
    assert.equal(clampEdge(51),  50);
    assert.equal(clampEdge(100), 50);
});

test('clampEdge: non-finite input clamps to 0', async () => {
    const { clampEdge } = await mod();
    assert.equal(clampEdge(NaN),       0);
    assert.equal(clampEdge(Infinity),  50); // +Inf → min(50, max(0, Inf)) = 50
    assert.equal(clampEdge(-Infinity), 0);
    assert.equal(clampEdge(undefined), 0);
    assert.equal(clampEdge(null),      0);
    assert.equal(clampEdge('abc'),     0);
});

// ── defaultValue ─────────────────────────────────────────────────────────────

test('defaultValue: all sides are 10', async () => {
    const { defaultValue } = await mod();
    assert.deepEqual(defaultValue(), { left: 10, right: 10, top: 10, bottom: 10 });
});

// ── normalizeValue ────────────────────────────────────────────────────────────

test('normalizeValue: null input returns defaults', async () => {
    const { normalizeValue } = await mod();
    assert.deepEqual(normalizeValue(null), { left: 10, right: 10, top: 10, bottom: 10 });
    assert.deepEqual(normalizeValue(undefined), { left: 10, right: 10, top: 10, bottom: 10 });
});

test('normalizeValue: clamps out-of-range sides', async () => {
    const { normalizeValue } = await mod();
    const v = normalizeValue({ left: 60, right: -5, top: 0, bottom: 50 });
    assert.equal(v.left,   50, 'left clamped from 60 to 50');
    assert.equal(v.right,   0, 'right clamped from -5 to 0');
    assert.equal(v.top,     0, 'top at 0 passes through');
    assert.equal(v.bottom, 50, 'bottom at 50 passes through');
});

test('normalizeValue: partial input fills missing sides with defaults', async () => {
    const { normalizeValue } = await mod();
    const v = normalizeValue({ left: 20 });
    assert.equal(v.left,   20, 'left from input');
    assert.equal(v.right,  10, 'right from default');
    assert.equal(v.top,    10, 'top from default');
    assert.equal(v.bottom, 10, 'bottom from default');
});

// ── pair constraint ───────────────────────────────────────────────────────────

test('pair constraint: left+right ≤ 100 for any valid input', async () => {
    const { normalizeValue } = await mod();
    // Maximum legal value per side is 50; max sum is therefore 100.
    const v = normalizeValue({ left: 50, right: 50, top: 50, bottom: 50 });
    assert.ok(v.left  + v.right  <= 100, `left+right = ${v.left + v.right}`);
    assert.ok(v.top   + v.bottom <= 100, `top+bottom = ${v.top  + v.bottom}`);
});

test('pair constraint: over-clamped inputs still satisfy the pair rule', async () => {
    const { normalizeValue } = await mod();
    // Both over 50: each gets clamped to 50; sum = 100.
    const v = normalizeValue({ left: 80, right: 70, top: 90, bottom: 60 });
    assert.ok(v.left  + v.right  <= 100, `left+right = ${v.left + v.right}`);
    assert.ok(v.top   + v.bottom <= 100, `top+bottom = ${v.top  + v.bottom}`);
});

// ── axesFromValue ─────────────────────────────────────────────────────────────

test('axesFromValue: both sides > 0 → both axes', async () => {
    const { axesFromValue } = await mod();
    const a = axesFromValue({ left: 10, right: 10, top: 10, bottom: 10 });
    assert.deepEqual(a, { x: true, y: true });
});

test('axesFromValue: left-right only → x axis, not y', async () => {
    const { axesFromValue } = await mod();
    assert.deepEqual(axesFromValue({ left: 10, right: 5, top: 0, bottom: 0 }), { x: true, y: false });
});

test('axesFromValue: top-bottom only → y axis, not x', async () => {
    const { axesFromValue } = await mod();
    assert.deepEqual(axesFromValue({ left: 0, right: 0, top: 15, bottom: 5 }), { x: false, y: true });
});

test('axesFromValue: only one side per axis', async () => {
    const { axesFromValue } = await mod();
    // left=10, right=0 → x is still active
    assert.deepEqual(axesFromValue({ left: 10, right: 0, top: 0, bottom: 0 }), { x: true,  y: false });
    // top=0, bottom=10 → y is still active
    assert.deepEqual(axesFromValue({ left: 0,  right: 0, top: 0, bottom: 10 }), { x: false, y: true  });
});

test('axesFromValue: all zero → no axes', async () => {
    const { axesFromValue } = await mod();
    assert.deepEqual(axesFromValue({ left: 0, right: 0, top: 0, bottom: 0 }), { x: false, y: false });
});

// ── repeatFromTiles ───────────────────────────────────────────────────────────

test('repeatFromTiles: n=1 → no-repeat regardless of axes', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(1, { x: true, y: true });
    assert.equal(r.repeat, 'no-repeat');
    assert.equal(r.size,   '100% 100%');
});

test('repeatFromTiles: n=2, both axes → repeat 50% 50%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(2, { x: true, y: true });
    assert.equal(r.repeat, 'repeat');
    assert.equal(r.size,   '50% 50%');
});

test('repeatFromTiles: n=4, both axes → repeat 25% 25%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(4, { x: true, y: true });
    assert.equal(r.repeat, 'repeat');
    assert.equal(r.size,   '25% 25%');
});

test('repeatFromTiles: n=3, both axes → repeat 33.3333% 33.3333%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(3, { x: true, y: true });
    assert.equal(r.repeat, 'repeat');
    // 100/3 rounded to 4 dp, trailing zeros stripped: 33.3333
    assert.equal(r.size, '33.3333% 33.3333%');
});

test('repeatFromTiles: n=2, x-axis only (single-axis) → repeat-x 50% 100%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(2, { x: true, y: false });
    assert.equal(r.repeat, 'repeat-x');
    assert.equal(r.size,   '50% 100%');
});

test('repeatFromTiles: n=4, y-axis only (single-axis) → repeat-y 100% 25%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(4, { x: false, y: true });
    assert.equal(r.repeat, 'repeat-y');
    assert.equal(r.size,   '100% 25%');
});

test('repeatFromTiles: n=3, x-axis only → repeat-x 33.3333% 100%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(3, { x: true, y: false });
    assert.equal(r.repeat, 'repeat-x');
    assert.equal(r.size,   '33.3333% 100%');
});

test('repeatFromTiles: no axes → no-repeat even for n>1', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(2, { x: false, y: false });
    assert.equal(r.repeat, 'no-repeat');
});

// The gizmo emits only once dragged: an untouched step must run what it SHOWS.
test('edgesFor: an untouched step (no sides, only step fields) is the shown default', async () => {
    const { edgesFor, defaultValue } = await mod();
    assert.deepEqual(edgesFor(undefined, undefined), defaultValue());
    assert.deepEqual(edgesFor({ fields: { tiles: 2 } }, undefined), defaultValue());
});

test('edgesFor: a dragged value wins over direction, clamped', async () => {
    const { edgesFor } = await mod();
    assert.deepEqual(edgesFor({ left: 20, right: 0, top: 0, bottom: 70 }, 'left-right'),
        { left: 20, right: 0, top: 0, bottom: 50 });
});

test('edgesFor: direction for a caller with no gizmo (the agent)', async () => {
    const { edgesFor } = await mod();
    assert.deepEqual(edgesFor(null, 'left-right'), { left: 10, right: 10, top: 0, bottom: 0 });
    assert.deepEqual(edgesFor(null, 'top-bottom'), { left: 0, right: 0, top: 10, bottom: 10 });
    assert.deepEqual(edgesFor(null, 'both'), { left: 10, right: 10, top: 10, bottom: 10 });
});
