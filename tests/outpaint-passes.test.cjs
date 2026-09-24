/**
 * outpaint-passes.test.cjs — MPI-900. A big outpaint runs as two passes.
 *
 * Fabio's case: i2i_005, 1280x800, grown UP to 4:5 (1280x1600). One pass holds ~25%, so
 * pass 1 must add 200px on top only, and pass 2 must land the full frame on pass 1's
 * (rescaled) result.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const load = () => import('file://' + path.join(__dirname, '..', 'js/utils/outpaintPasses.js').replace(/\\/g, '/'));
const SRC = { w: 1280, h: 800 };

test('a small extension is one pass', async () => {
    const { planOutpaintPasses } = await load();
    assert.equal(planOutpaintPasses(SRC, { x: 0, y: -200, w: 1280, h: 1000 }), null);
    assert.equal(planOutpaintPasses(SRC, { x: -160, y: 0, w: 1600, h: 800 }), null);
});

test('grow up 100%: pass 1 adds 25% on top only', async () => {
    const { planOutpaintPasses } = await load();
    const plan = planOutpaintPasses(SRC, { x: 0, y: -800, w: 1280, h: 1600 });
    assert.deepEqual(plan.first, { x: 0, y: -200, w: 1280, h: 1000 });
});

test('centred growth splits the 25% across both sides in proportion', async () => {
    const { planOutpaintPasses } = await load();
    const plan = planOutpaintPasses(SRC, { x: 0, y: -400, w: 1280, h: 1600 });
    assert.deepEqual(plan.first, { x: 0, y: -100, w: 1280, h: 1000 });
});

test('only the over-limit axis shrinks; an axis that cuts in stays', async () => {
    const { planOutpaintPasses } = await load();
    // width +10% (fine), height +50% on the bottom (too much), left edge cropped IN by 40
    const plan = planOutpaintPasses(SRC, { x: 40, y: 0, w: 1368, h: 1200 });
    assert.deepEqual(plan.first, { x: 40, y: 0, w: 1368, h: 1000 });
});

test('pass 2 rect lands the final frame on the rescaled pass-1 result', async () => {
    const { planOutpaintPasses, nextPassRect } = await load();
    const plan = planOutpaintPasses(SRC, { x: 0, y: -800, w: 1280, h: 1600 });
    // 1280x1000 at ~1 MP comes back 1136x880 (16px grid)
    const r = nextPassRect(plan, { w: 1136, h: 880 });
    assert.deepEqual(r, { x: 0, y: -528, w: 1136, h: 1408 });
    // the result sits at the BOTTOM of the final frame: its bottom edge is the frame's
    assert.equal(r.y + r.h, 880);
});
