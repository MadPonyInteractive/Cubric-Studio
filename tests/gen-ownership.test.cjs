// AUDIT D9 — the generation-ownership state machine the Gallery and History Blocks shared
// by copy, now js/utils/genOwnership.js. The Stop bridge (MPI-195) is the part a copy
// drifts on: a Stopped job that still finishes must paint, and one that comes back empty
// must not leave its id behind.

const assert = require('node:assert');
const test = require('node:test');

const load = () => import('../js/utils/genOwnership.js').then(m => m.createGenOwnership());

test('a job that is not ours is ignored by every settle', async () => {
    const g = await load();
    assert.strictEqual(g.has('x'), false);
    assert.strictEqual(g.complete('x'), false);
    assert.deepStrictEqual(g.error('x'), { owned: false, bridged: false });
    assert.strictEqual(g.cancelled('x'), false);
});

test('our job completes once', async () => {
    const g = await load();
    g.add('a');
    assert.strictEqual(g.has('a'), true);
    assert.strictEqual(g.complete('a'), true);
    assert.strictEqual(g.has('a'), false);
    assert.strictEqual(g.complete('a'), false);
});

test('Stop, then the job finishes anyway: the late complete is ours (MPI-195)', async () => {
    const g = await load();
    g.add('a');
    assert.strictEqual(g.cancelled('a'), true);
    assert.strictEqual(g.has('a'), false, 'Stop drops ownership at once');
    assert.strictEqual(g.complete('a'), true);
    assert.strictEqual(g.complete('a'), false, 'the bridge is used once');
});

test('Stop, then the job comes back empty: the second cancelled drops the bridge', async () => {
    const g = await load();
    g.add('a');
    g.cancelled('a');
    assert.strictEqual(g.cancelled('a'), false);
    assert.strictEqual(g.complete('a'), false, 'nothing leaked');
});

test('Stop, then the job fails: error reports it bridged, not owned (MPI-937)', async () => {
    const g = await load();
    g.add('a');
    g.cancelled('a');
    assert.deepStrictEqual(g.error('a'), { owned: false, bridged: true });
    assert.strictEqual(g.complete('a'), false);
});

test('our job fails: owned', async () => {
    const g = await load();
    g.add('a');
    assert.deepStrictEqual(g.error('a'), { owned: true, bridged: false });
    assert.strictEqual(g.has('a'), false);
});

test('clear forgets owned and bridged ids', async () => {
    const g = await load();
    g.add('a');
    g.add('b');
    g.cancelled('b');
    g.clear();
    assert.strictEqual(g.has('a'), false);
    assert.strictEqual(g.complete('b'), false);
});
