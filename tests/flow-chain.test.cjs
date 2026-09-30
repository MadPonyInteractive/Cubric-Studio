/**
 * flow-chain.test.cjs — MPI-623. A Flow that runs as TWO dispatches.
 *
 * The 3D Scene flow cannot run as one prompt: ComfyUI never evicts what the CURRENT
 * prompt produced, and the bake's second stage spikes to ~43 GB on its own, so it needs
 * the machine otherwise empty. Only a NEW prompt bumps the cache generation that frees
 * the first stage. So a `chain: { operation }` flow becomes leg 1, then leg 2 dispatched
 * from leg 1's completion — two ordinary jobs, NOT a two-prompt job inside
 * commandExecutor's lane machinery.
 *
 * The branching lives in `chainCallbacks`, which takes the leg-2 dispatch as an argument
 * precisely so it can be executed here: importing flowService is cheap, reaching
 * `enqueueGeneration` is not. The rest is asserted against the source, because the config
 * build sits behind that enqueue.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'js/services/flowService.js');
const read = () => fs.readFileSync(SRC, 'utf8');
const load = () => import('file://' + SRC.replace(/\\/g, '/'));

const CHAINED = { id: 'scene', title: 'Scene', operation: 'a', chain: { operation: 'b' } };
const PLAIN = { id: 'plain', title: 'Plain', operation: 'a' };

test('a flow with no chain gets its callbacks back untouched', async () => {
    const { chainCallbacks } = await load();
    const callbacks = { onComplete() {}, onError() {} };
    assert.strictEqual(chainCallbacks(PLAIN, callbacks, () => {
        throw new Error('a flow with no chain must never dispatch a second leg');
    }), callbacks);
});

test('leg 1 completing dispatches leg 2 and does NOT report the flow done', async () => {
    const { chainCallbacks } = await load();
    let dispatched = 0;
    let reported = 0;
    const wrapped = chainCallbacks(CHAINED, { onComplete: () => { reported++; } }, () => {
        dispatched++;
        return { queueJobId: 'job-2' };
    });
    wrapped.onComplete({ item: {} });
    assert.strictEqual(dispatched, 1, 'leg 1 completing must dispatch leg 2');
    assert.strictEqual(reported, 0,
        'the flow is not done until leg 2 is — the caller must see ONE completion, on leg 2');
});

test('leg 2 failing to enqueue forwards leg 1 rather than hanging the pane', async () => {
    const { chainCallbacks } = await load();
    // submitFlowGeneration returns null when its model/dep guard aborts. Swallowing that
    // would leave MpiBaseFlow spinning on a job that never entered the queue.
    let got = null;
    const wrapped = chainCallbacks(CHAINED, { onComplete: (r) => { got = r; } }, () => null);
    const result = { item: { id: 'leg-1' } };
    wrapped.onComplete(result);
    assert.strictEqual(got, result, 'leg 1 completion must be forwarded when leg 2 cannot run');
});

test('the non-onComplete callbacks pass straight through', async () => {
    const { chainCallbacks } = await load();
    const onError = () => {};
    const onCancel = () => {};
    const wrapped = chainCallbacks(CHAINED, { onError, onCancel }, () => ({ queueJobId: 'x' }));
    assert.strictEqual(wrapped.onError, onError);
    assert.strictEqual(wrapped.onCancel, onCancel);
    // No onComplete declared → forwarding a null-guard result must not throw.
    assert.doesNotThrow(() => wrapped.onComplete({}));
});

test('leg 2 runs the CHAINED op, and no second `workflow` field was invented', () => {
    const src = read();
    assert.match(src, /operation: _leg\.operation \|\| flow\.operation/,
        'the op is what picks the graph — one op per leg is how the second workflow is named');
    assert.ok(!/chain\.workflow/.test(src),
        'a second workflow name on FlowDef would bypass universal_workflows.js');
});

test('leg 2 carries no media unless the chain names an input role, and never chains a third leg', () => {
    const src = read();
    assert.match(src, /const mediaItems = _leg\.operation && !flow\.chain\?\.input \? \[\]/,
        'the chained leg reads leg 1 output off disk by name; re-sending media stages a dead file');
    assert.match(src, /_leg\.operation \? callbacks : chainCallbacks\(/,
        'leg 2 must not wrap its own callbacks — one chain, two legs');
});

// MPI-997 — Character Sheet's head removal: an OPTIONAL leg that EDITS leg 1's picture.
const HEADLESS = {
    id: 'character-sheet', title: 'Character Sheet', operation: 'a', mediaType: 'image',
    chain: { operation: 'b', when: 'Input_Remove_Head', input: 'image1' },
    fields: [{ id: 'Input_Remove_Head', type: 'toggle', default: true }],
};

test('`when` gates leg 2 on the field, falling back to its default', async () => {
    const { chainCallbacks } = await load();
    const callbacks = { onComplete() {} };
    const never = () => { throw new Error('the toggle is off — leg 2 must not run'); };
    assert.strictEqual(chainCallbacks(HEADLESS, callbacks, never, { injectionParams: { Input_Remove_Head: false } }), callbacks,
        'off: the run is leg 1 alone, callbacks untouched');

    for (const run of [{ injectionParams: { Input_Remove_Head: true } }, {}, { injectionParams: {} }]) {
        let got = null;
        const wrapped = chainCallbacks(HEADLESS, callbacks, (r) => { got = r; return { queueJobId: 'x' }; }, run);
        const result = { item: { filePath: '/p/sheet.png' }, group: { id: 'g1' } };
        wrapped.onComplete(result);
        assert.strictEqual(got, result, `on (${JSON.stringify(run)}): leg 2 must be handed leg 1's result`);
    }

    // A field at the root, not an `Input_*` one, is read at the root.
    const ROOT = { ...HEADLESS, chain: { ...HEADLESS.chain, when: 'headless' }, fields: [{ id: 'headless', default: false }] };
    assert.strictEqual(chainCallbacks(ROOT, callbacks, never, {}), callbacks, 'the default decides when the run says nothing');
    assert.notStrictEqual(chainCallbacks(ROOT, callbacks, never, { headless: true }), callbacks);
});

test('an `input` chain hands leg 1\'s picture to leg 2 and lands it on leg 1\'s card', async () => {
    const { chainLegInputs } = await load();
    const inputs = { positive: 'a wizard', injectionParams: { Input_Remove_Head: true }, runLanding: { batchId: 'r1' } };
    const group = { id: 'card-1' };
    const leg = chainLegInputs(HEADLESS, inputs, { item: { filePath: '/project-file?path=C%3A%5Csheet.png' }, group });
    assert.deepStrictEqual(leg.runMediaItems, [{ role: 'image1', mediaType: 'image',
        url: '/project-file?path=C%3A%5Csheet.png', filePath: '/project-file?path=C%3A%5Csheet.png' }]);
    assert.deepStrictEqual(leg.runLanding, { batchId: 'r1', existingGroup: group },
        'leg 2 is the card\'s NEXT VERSION, inside whatever landing the run already had');
    assert.strictEqual(leg.positive, 'a wizard', 'everything else rides through');
    assert.strictEqual(inputs.runLanding.existingGroup, undefined, 'leg 1\'s inputs are not mutated');

    // MPI-623's shape: no input role, leg 2 gets leg 1's inputs as they were.
    assert.strictEqual(chainLegInputs(CHAINED, inputs, { item: {}, group }), inputs);
});

test('into a CLOSED project, leg 2 versions the card leg 1 just registered', async () => {
    // Live 2026-09-30: an agent run into a project the app did not have open. The completion
    // versions a closed project's card off the frozen copy the run was dispatched with, and
    // leg 1's copy predates leg 1's card: leg 2 found no card, deleted its output, CANCELLED.
    const { chainLegInputs } = await load();
    const other = { id: 'card-0', history: [] };
    const origin = { folderPath: 'C:/p', itemGroups: [other] };
    const card = { id: 'card-1', history: [{ id: 'v1' }] };
    const leg = chainLegInputs(HEADLESS, { runOriginProject: origin }, { item: { filePath: '/f.png' }, group: card });
    assert.deepStrictEqual(leg.runOriginProject.itemGroups, [other, card], 'the origin copy must hold leg 1\'s card');
    assert.strictEqual(leg.runOriginProject.folderPath, 'C:/p');
    assert.deepStrictEqual(origin.itemGroups, [other], 'the caller\'s copy is not mutated');

    // An open project has no frozen copy to fix: nothing is invented.
    assert.ok(!('runOriginProject' in chainLegInputs(HEADLESS, {}, { item: { filePath: '/f.png' }, group: card })));
});

test('leg 2 reuses leg 1 tempId so Cancel and live previews keep working', () => {
    const src = read();
    assert.match(src, /const tempId = _leg\.tempId \|\| crypto\.randomUUID\(\)/);
    assert.match(src, /\{ operation: flow\.chain\.operation, tempId \}/,
        'MpiBaseFlow holds ONE _myTempId per run — a fresh id on leg 2 orphans the pane');
});
