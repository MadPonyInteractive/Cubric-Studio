/**
 * result-tiles.test.cjs — MPI-1101 Phase 3: Result pane Tiles slider.
 *
 * Pure-function unit tests:
 *   - resultTileAxes: axes from a step value (picture run), from a direction
 *     string (no-picture texture mode), and from neither (no slider).
 *   - repeatFromTiles: the CSS mapping for 1–4 tiles on each axis combination.
 *   - The slider is only built when flow.result?.tiles is truthy (source-text
 *     assertion on the build guard — the only wiring that cannot run in Node).
 */

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const mod  = () => import(
    'file://' + repo('js/components/Organisms/MpiStepEdges/MpiStepEdges.js').replace(/\\/g, '/')
);

// ── resultTileAxes: from step value (picture run) ─────────────────────────────

test('resultTileAxes: both axes active when left and top > 0', async () => {
    const { resultTileAxes } = await mod();
    const v = { left: 10, right: 10, top: 10, bottom: 10 };
    assert.deepEqual(resultTileAxes(v, null), { x: true, y: true });
});

test('resultTileAxes: x-only when top=bottom=0', async () => {
    const { resultTileAxes } = await mod();
    const v = { left: 10, right: 10, top: 0, bottom: 0 };
    assert.deepEqual(resultTileAxes(v, null), { x: true, y: false });
});

test('resultTileAxes: y-only when left=right=0', async () => {
    const { resultTileAxes } = await mod();
    const v = { left: 0, right: 0, top: 10, bottom: 10 };
    assert.deepEqual(resultTileAxes(v, null), { x: false, y: true });
});

test('resultTileAxes: no axes when all sides 0', async () => {
    const { resultTileAxes } = await mod();
    const v = { left: 0, right: 0, top: 0, bottom: 0 };
    assert.deepEqual(resultTileAxes(v, null), { x: false, y: false });
});

test('resultTileAxes: step value takes priority over direction string', async () => {
    const { resultTileAxes } = await mod();
    const v = { left: 10, right: 10, top: 0, bottom: 0 };
    // direction says 'both' but stepValue says x-only → stepValue wins
    assert.deepEqual(resultTileAxes(v, 'both'), { x: true, y: false });
});

// ── resultTileAxes: from direction string (no-picture texture mode) ───────────

test('resultTileAxes: direction "both" → x and y', async () => {
    const { resultTileAxes } = await mod();
    assert.deepEqual(resultTileAxes(null, 'both'), { x: true, y: true });
    assert.deepEqual(resultTileAxes(undefined, 'both'), { x: true, y: true });
});

test('resultTileAxes: direction "left-right" → x only', async () => {
    const { resultTileAxes } = await mod();
    assert.deepEqual(resultTileAxes(null, 'left-right'), { x: true, y: false });
});

test('resultTileAxes: direction "top-bottom" → y only', async () => {
    const { resultTileAxes } = await mod();
    assert.deepEqual(resultTileAxes(null, 'top-bottom'), { x: false, y: true });
});

// ── resultTileAxes: neither source → no axes ─────────────────────────────────

test('resultTileAxes: null stepValue and null direction → no axes', async () => {
    const { resultTileAxes } = await mod();
    assert.deepEqual(resultTileAxes(null, null), { x: false, y: false });
});

test('resultTileAxes: null stepValue and unknown direction → no axes', async () => {
    const { resultTileAxes } = await mod();
    assert.deepEqual(resultTileAxes(null, 'diagonal'), { x: false, y: false });
    assert.deepEqual(resultTileAxes(null, ''), { x: false, y: false });
    assert.deepEqual(resultTileAxes(undefined, undefined), { x: false, y: false });
});

// ── repeatFromTiles: CSS mapping ──────────────────────────────────────────────

test('repeatFromTiles: n=1 → no-repeat regardless of axes', async () => {
    const { repeatFromTiles } = await mod();
    assert.deepEqual(repeatFromTiles(1, { x: true,  y: true  }), { repeat: 'no-repeat', size: '100% 100%' });
    assert.deepEqual(repeatFromTiles(1, { x: true,  y: false }), { repeat: 'no-repeat', size: '100% 100%' });
    assert.deepEqual(repeatFromTiles(1, { x: false, y: false }), { repeat: 'no-repeat', size: '100% 100%' });
});

test('repeatFromTiles: no joined axes → no-repeat for any n', async () => {
    const { repeatFromTiles } = await mod();
    assert.deepEqual(repeatFromTiles(2, { x: false, y: false }), { repeat: 'no-repeat', size: '100% 100%' });
    assert.deepEqual(repeatFromTiles(4, { x: false, y: false }), { repeat: 'no-repeat', size: '100% 100%' });
});

test('repeatFromTiles: n=2 x-only → repeat-x, 50% wide', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(2, { x: true, y: false });
    assert.equal(r.repeat, 'repeat-x');
    assert.equal(r.size, '50% 100%');
});

test('repeatFromTiles: n=2 y-only → repeat-y, 50% tall', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(2, { x: false, y: true });
    assert.equal(r.repeat, 'repeat-y');
    assert.equal(r.size, '100% 50%');
});

test('repeatFromTiles: n=2 both axes → repeat, 50% × 50%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(2, { x: true, y: true });
    assert.equal(r.repeat, 'repeat');
    assert.equal(r.size, '50% 50%');
});

test('repeatFromTiles: n=4 both axes → repeat, 25% × 25%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(4, { x: true, y: true });
    assert.equal(r.repeat, 'repeat');
    assert.equal(r.size, '25% 25%');
});

test('repeatFromTiles: n=3 x-only → repeat-x, 33.3333% × 100%', async () => {
    const { repeatFromTiles } = await mod();
    const r = repeatFromTiles(3, { x: true, y: false });
    assert.equal(r.repeat, 'repeat-x');
    // 100/3 = 33.3333...%; rounded to 4dp: '33.3333%'
    assert.ok(r.size.startsWith('33.3333%'), `size was ${r.size}`);
});

// ── Slider build guard (source-text assertion) ────────────────────────────────
// The slider is only built when `flow.result?.tiles` is truthy.
// This cannot execute in Node (no DOM), so we assert the guard is in the source.

test('MpiBaseFlow only builds tiles UI when flow.result?.tiles is set (source guard)', async () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(
        repo('js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js'), 'utf8',
    );
    assert.ok(
        src.includes('flow.result?.tiles'),
        'MpiBaseFlow.js must gate tiles UI on flow.result?.tiles',
    );
});
