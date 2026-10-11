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

test('a leg runs ITS op, and no second `workflow` field was invented', () => {
    const src = read();
    assert.match(src, /const operation = leg \? leg\.operation : flowOperation\(flow, run\);/,
        'the op is what picks the graph — one op per leg is how the second workflow is named');
    assert.ok(!/chain\.workflow/.test(src),
        'a second workflow name on FlowDef would bypass universal_workflows.js');
});

test('a later leg carries no media unless it names an input role, and a leg run alone ends there', () => {
    const src = read();
    assert.match(src, /const given = later && !leg\?\.input \? \[\]/,
        'the chained leg reads the previous output off disk by name; re-sending media stages a dead file');
    assert.match(src, /_leg\.alone \? callbacks : chainCallbacks\(/,
        'the result pane\'s single-leg run must not carry on into the legs after it');
});

// MPI-997 — Character Sheet's head removal: a leg that EDITS leg 1's picture. Since MPI-1087 it
// ALWAYS runs; its `toggle` only picks which of the two versions the card shows.
const HEADLESS = {
    id: 'character-sheet', title: 'Character Sheet', operation: 'a', mediaType: 'image',
    chain: { operation: 'b', toggle: 'Input_Remove_Head', input: 'image1' },
    fields: [{ id: 'Input_Remove_Head', type: 'toggle', default: true }],
};

test('a `toggle` leg runs whatever the toggle says', async () => {
    const { chainCallbacks } = await load();
    const callbacks = { onComplete() {} };

    for (const run of [{ injectionParams: { Input_Remove_Head: false } }, { injectionParams: { Input_Remove_Head: true } }, {}, { injectionParams: {} }]) {
        let got = null;
        const wrapped = chainCallbacks(HEADLESS, callbacks, (r) => { got = r; return { queueJobId: 'x' }; }, run);
        const result = { item: { filePath: '/p/sheet.png' }, group: { id: 'g1' } };
        wrapped.onComplete(result);
        assert.strictEqual(got, result, `on (${JSON.stringify(run)}): leg 2 must be handed leg 1's result`);
    }

    // A string `when` still GATES, and a field at the root, not an `Input_*` one, is read at the root.
    const never = () => { throw new Error('the gate is off — leg 2 must not run'); };
    const ROOT = { ...HEADLESS, chain: { operation: 'b', when: 'headless', input: 'image1' }, fields: [{ id: 'headless', default: false }] };
    assert.strictEqual(chainCallbacks(ROOT, callbacks, never, {}), callbacks, 'the default decides when the run says nothing');
    assert.notStrictEqual(chainCallbacks(ROOT, callbacks, never, { headless: true }), callbacks);
});

test('with its toggle off, a `toggle` leg lands without taking the card, and reports what the card shows', () => {
    const src = read();
    assert.match(src, /const keepShown = later && !_leg\.alone && !!leg\?\.toggle && flowRunValues\(flow, run\)\[leg\.toggle\] !== true;/,
        'only a chained run with the toggle off; the field running the leg alone on a result shows it');
    assert.match(src, /\.\.\.\(keepShown \? \{ keepSelected: true \} : \{\}\)/);
    assert.match(src, /item: result\.group\.history\[result\.group\.selectedIndex\] \?\? result\.item/);
    const gen = fs.readFileSync(path.join(__dirname, '..', 'js/services/generationService.js'), 'utf8');
    assert.match(gen, /\.\.\.\(opts\.keepSelected \? \{ selectedIndex: latestGroup\.selectedIndex \} : \{\}\)/);
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
    assert.match(src, /\{ index: next\.index, tempId, run: handle, item: result\?\.item, described \}/,
        'MpiBaseFlow holds ONE _myTempId per run — a fresh id on a later leg orphans the pane');
});

// MPI-1089: Fabio fed the Editor a card showing its head-removed version; the edit kept the grey
// oval and the chained Headless leg ran SAM3 on a sheet with no head, which took the braids.
const SHEET = { id: 'sheet', title: 'Sheet', operation: 'edit',
    chain: [{ operation: 'age', input: 'image1', when: { field: 'Input_Age', atLeast: 0 } },
        { operation: 'headless', toggle: 'Input_Remove_Head', input: 'image1' }] };
const file = name => `/project-file?path=C%3A%5CP%5CMedia%5C${name}.png`;
const PROJECT = { itemGroups: [{ id: 'g', history: [
    { operation: 'edit', filePath: file('flowCSE_010') },
    { operation: 'headless', filePath: file('flowCharacterSheet_012') },
] }] };

test('a head-removed picture goes in as the version it was made from', async () => {
    const { unchainedSource } = await load();
    const ref = { role: 'image2', url: file('flowCharacterSheet_012') };
    const [sheet, kept] = unchainedSource(SHEET, [{ role: 'image1', url: file('flowCharacterSheet_012') }, ref], PROJECT);
    assert.strictEqual(sheet.url, file('flowCSE_010'));
    assert.strictEqual(sheet.filePath, file('flowCSE_010'));
    assert.strictEqual(kept, ref, 'only the toggle leg\'s input role is swapped');
});

test('a with-head picture, an unknown file or a head-removed one with nothing before it go in as given', async () => {
    const { unchainedSource } = await load();
    const media = [{ role: 'image1', url: file('flowCSE_010') }, { role: 'image1', url: file('outside') }];
    assert.deepStrictEqual(unchainedSource(SHEET, media, PROJECT), media);
    const alone = { itemGroups: [{ id: 'g', history: [{ operation: 'headless', filePath: file('x') }] }] };
    const picked = [{ role: 'image1', url: file('x') }];
    assert.deepStrictEqual(unchainedSource(SHEET, picked, alone), picked);
    assert.strictEqual(unchainedSource(PLAIN, picked, alone), picked, 'a flow with no toggle leg is untouched');
});

test('only the user\'s own picture is swapped, never a later leg\'s', () => {
    assert.match(read(), /const mediaItems = later \? given : unchainedSource\(flow, given, /);
});

// MPI-1092: each leg tells the status bar its place in the run, counted over the legs THIS run takes.
test('a chained leg knows its step in the run; a run of one job has none', async () => {
    const { flowStep } = await load();
    const AGED = { id: 'aged', title: 'Aged', operation: 'a', fields: [{ id: 'Input_Age', default: -1 }],
        chain: [{ operation: 'b', when: { field: 'Input_Age', atLeast: 1 } }, { operation: 'c' }] };
    const old = { injectionParams: { Input_Age: 30 } };
    assert.deepStrictEqual([-1, 0, 1].map(i => flowStep(AGED, old, i)), ['1/3', '2/3', '3/3']);
    // No age: leg b is skipped, so c is the second of two, not the third of three.
    assert.deepStrictEqual([-1, 1].map(i => flowStep(AGED, {}, i)), ['1/2', '2/2']);
    assert.strictEqual(flowStep(PLAIN, {}, -1), null, 'one job, no counter');
    assert.match(read(), /if \(!_leg\.alone\) config\.flowStep = flowStep\(flow, run, index\);/,
        'a leg run alone from the result pane is a run of one');
});
