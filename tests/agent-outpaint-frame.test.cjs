/**
 * agent-outpaint-frame.test.cjs — the agent can say WHICH side Outpaint grows (MPI-900,
 * agent half, done under MPI-891).
 *
 * Live (Fabio, 2026-09-24): "expand this image up" on i2i_005 (1280x800) for an Instagram
 * post. The agent sent 4:5 and `frameRectForRatio` CENTRED the source, so half the new
 * room went under the picture. `frame.grow` puts all of it on one side, and the run then
 * plans its passes from that one-sided rect like the flow frame does.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = require('node:path').join(__dirname, '..');
const esm = (p) => import('file://' + require('node:path').join(repoRoot, p).replace(/\\/g, '/'));

const I2I_005 = { w: 1280, h: 800 };

test('frameRectForRatio: grow "up" keeps the bottom edge and puts all the new room on top', async () => {
    const { frameRectForRatio } = await esm('js/shell/agentDispatch.js');
    const r = frameRectForRatio(I2I_005, 4 / 5, 'up');
    assert.deepEqual(r, { x: 0, y: -800, w: 1280, h: 1600 });
    assert.equal(r.y + r.h, I2I_005.h, 'the source sits on the bottom edge');
});

test('frameRectForRatio: each side anchors the source on the opposite edge', async () => {
    const { frameRectForRatio } = await esm('js/shell/agentDispatch.js');
    assert.equal(frameRectForRatio(I2I_005, 4 / 5, 'down').y, 0);
    const wide = { w: 800, h: 1280 };
    const left = frameRectForRatio(wide, 16 / 9, 'left');
    assert.equal(left.x + left.w, wide.w, 'grow left keeps the right edge');
    assert.equal(frameRectForRatio(wide, 16 / 9, 'right').x, 0);
});

test('frameRectForRatio: a side on the axis the shape does not grow is null, never a guess', async () => {
    const { frameRectForRatio } = await esm('js/shell/agentDispatch.js');
    // 4:5 makes a landscape picture TALLER: there is no left or right to grow.
    assert.equal(frameRectForRatio(I2I_005, 4 / 5, 'left'), null);
    assert.equal(frameRectForRatio({ w: 800, h: 1280 }, 16 / 9, 'up'), null);
    // No grow is the old centred rect, unchanged.
    assert.deepEqual(frameRectForRatio(I2I_005, 4 / 5), { x: 0, y: -400, w: 1280, h: 1600 });
});

test('validateBoxParams: frame.grow takes a side, and refuses anything else', async () => {
    const { validateBoxParams } = await esm('js/shell/agentDispatch.js');
    const { getFlowById } = await esm('js/data/flowsRegistry.js');
    const outpaint = getFlowById('outpaint');
    assert.equal(validateBoxParams(outpaint, { frame: { ratio: '4:5', grow: 'up' } }).ok, true);
    const bad = validateBoxParams(outpaint, { frame: { ratio: '4:5', grow: 'top' } });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'INVALID_FRAME');
});

// Outpaint itself runs ONE pass since e7228875 (Klein, no `maxGrow`), and so does the agent
// path. This is the generic `maxGrow` path both frames keep, for a crop flow that declares it.
test('with maxGrow, the one-sided rect splits into passes that all keep the bottom edge', async () => {
    const { frameRectForRatio } = await esm('js/shell/agentDispatch.js');
    const { planOutpaintPasses, OUTPAINT_MAX_GROW } = await esm('js/utils/outpaintPasses.js');
    const rect = frameRectForRatio(I2I_005, 4 / 5, 'up');
    const plan = planOutpaintPasses(I2I_005, rect, OUTPAINT_MAX_GROW);
    assert.ok(plan && plan.length > 1, 'doubling the height is more than one pass holds');
    for (const p of plan) assert.equal(p.y + p.h, I2I_005.h, `a pass grew downward: ${JSON.stringify(p)}`);
    assert.deepEqual(plan.at(-1), rect, 'the last pass is the frame asked for');
});
