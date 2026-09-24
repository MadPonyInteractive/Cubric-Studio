/**
 * outpaint-passes.test.cjs — MPI-900. A big outpaint runs as several passes.
 *
 * Fabio's rule (bench, 2026-09-24): a third per side holds in one pass, a third up AND a
 * third down included; half or two thirds in ONE direction fails. So each pass grows each
 * side by at most a third of what it already knows. His case: i2i_005, 1280x800.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const load = () => import('file://' + path.join(__dirname, '..', 'js/utils/outpaintPasses.js').replace(/\\/g, '/'));
const SRC = { w: 1280, h: 800 };

test('a third per side is one pass, on both sides at once', async () => {
    const { planOutpaintPasses } = await load();
    assert.equal(planOutpaintPasses(SRC, { x: 0, y: -200, w: 1280, h: 1000 }), null);
    assert.equal(planOutpaintPasses(SRC, { x: 0, y: -260, w: 1280, h: 1320 }), null);
    assert.equal(planOutpaintPasses(SRC, { x: -400, y: 0, w: 2080, h: 800 }), null);
});

test('half in one direction is two passes', async () => {
    const { planOutpaintPasses } = await load();
    assert.deepEqual(planOutpaintPasses(SRC, { x: 0, y: -400, w: 1280, h: 1200 }), [
        { x: 0, y: -267, w: 1280, h: 1067 },
        { x: 0, y: -400, w: 1280, h: 1200 },
    ]);
});

test('doubling in one direction keeps going: each pass a third of what it knows', async () => {
    const { planOutpaintPasses } = await load();
    assert.deepEqual(planOutpaintPasses(SRC, { x: 0, y: -800, w: 1280, h: 1600 }), [
        { x: 0, y: -267, w: 1280, h: 1067 },
        { x: 0, y: -623, w: 1280, h: 1423 },
        { x: 0, y: -800, w: 1280, h: 1600 },
    ]);
});

test('an edge that cuts in stays put; only overhang grows', async () => {
    const { planOutpaintPasses } = await load();
    // width +10% (fine), height +50% on the bottom (too much), left edge cropped IN by 40
    assert.deepEqual(planOutpaintPasses(SRC, { x: 40, y: 0, w: 1368, h: 1200 }), [
        { x: 40, y: 0, w: 1368, h: 1067 },
        { x: 40, y: 0, w: 1368, h: 1200 },
    ]);
});

test('the next pass lands on the rescaled result of the one before', async () => {
    const { planOutpaintPasses, nextPassRect } = await load();
    const [p1, p2] = planOutpaintPasses(SRC, { x: 0, y: -800, w: 1280, h: 1600 });
    // 1280x1067 at ~1 MP comes back 1120x928 (16px grid)
    const r = nextPassRect(p1, p2, { w: 1120, h: 928 });
    assert.deepEqual(r, { x: 0, y: -310, w: 1120, h: 1238 });
    // growth is UP only, so the result's bottom edge is the next frame's
    assert.equal(r.y + r.h, 928);
});
