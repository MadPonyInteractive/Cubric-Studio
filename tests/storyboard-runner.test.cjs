/**
 * storyboard-runner.test.cjs — MPI-1231: the order, landing and failure rules of
 * js/services/storyboardRunner.js, against a fake app whose jobs finish in whatever order
 * the test says, and whose stack gains members in ARRIVAL order the way the queue's landing
 * does. The reorder is the REAL `applyReorderMembers`, so its same-set rule applies here too.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const esm = (p) => import('file:///' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

let runStoryboard, parseStoryboardPlan, applyReorderMembers;

test.before(async () => {
    ({ runStoryboard, parseStoryboardPlan } = await esm('js/services/storyboardRunner.js'));
    ({ applyReorderMembers } = await esm('js/data/stackModel.js'));
});

const plan = (n) => Array.from({ length: n }, (_, i) => ({ prompt: `panel ${i + 1} picture`, intent: `beat ${i + 1}` }));

/**
 * `refuse(i)` refuses panel i before the queue; `outcome(i)` is what its finished job
 * answers (default: lands). Jobs stay open until `finish(i)` is called.
 */
function fakeApp({ refuse = () => null, outcome = () => null, loop = false } = {}) {
    const calls = [];
    let groups = [];
    let ids = 0;
    const open = new Map();
    const deps = {
        isLoopArmed: () => loop,
        async submit(panel, index, landing) {
            calls.push(['submit', index, landing]);
            const no = refuse(index);
            if (no) return { ok: false, ...no };
            let settle;
            const done = new Promise((r) => { settle = r; });
            open.set(index, () => {
                const bad = outcome(index);
                if (bad) return settle({ ok: false, ...bad });
                const group = { id: `card${index}`, type: 'image', history: [{ id: `item${index}`, filePath: `C:/p/${index}.png` }], selectedIndex: 0 };
                groups = [...groups, group].map(g => (g.id === landing.stackId ? { ...g, members: [...g.members, group.id] } : g));
                settle({ ok: true, item: group.history[0], group });
            });
            return { ok: true, done };
        },
        async addStack(stack) {
            calls.push(['addStack', stack]);
            groups = [...groups, { ...stack, type: 'stack', members: [], history: [] }];
        },
        async writeNote(item, text) { calls.push(['note', item.id, text]); },
        async reorderStack(stackId, order) {
            calls.push(['reorder', order]);
            const next = applyReorderMembers(groups, stackId, order);
            const moved = next !== groups;
            groups = next;
            return moved;
        },
        async makeOverview(order, name) { calls.push(['overview', order, name]); },
        newId: () => `id${++ids}`,
    };
    const finish = (...order) => order.forEach(i => open.get(i)());
    const members = (stackId) => groups.find(g => g.id === stackId).members;
    return { deps, calls, finish, members };
}

test('every job is queued before the stack, all on one landing', async () => {
    const app = fakeApp();
    const run = await runStoryboard(plan(3), { name: 'Heist' }, app.deps);
    assert.strictEqual(run.ok, true);
    assert.deepStrictEqual(app.calls.map(c => c[0]), ['submit', 'submit', 'submit', 'addStack']);
    for (const [, , landing] of app.calls.slice(0, 3)) {
        assert.deepStrictEqual(landing, { batchId: run.runId, batchLabel: 'Heist', batchTotal: 3, stackId: run.stackId });
    }
    assert.deepStrictEqual(app.calls[3][1], { id: run.stackId, name: 'Heist', kind: 'image', expected: 3 });
    app.finish(0, 1, 2);
    await run.finished;
});

test('cards arriving out of order end in panel order, each with its note, then the overview', async () => {
    const app = fakeApp();
    const run = await runStoryboard(plan(4), { name: 'Heist' }, app.deps);
    app.finish(2, 0, 3, 1);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card0', 'card1', 'card2', 'card3']);
    assert.strictEqual(out.reordered, true);
    assert.deepStrictEqual(app.calls.filter(c => c[0] === 'note').map(c => c.slice(1)).sort(),
        [['item0', 'beat 1'], ['item1', 'beat 2'], ['item2', 'beat 3'], ['item3', 'beat 4']]);
    const last = app.calls.at(-1);
    assert.deepStrictEqual(last, ['overview', ['card0', 'card1', 'card2', 'card3'], 'Heist']);
    assert.deepStrictEqual(out, { ok: true, cancelled: false, reordered: true, overview: true,
        panels: [0, 1, 2, 3].map(i => ({ index: i, groupId: `card${i}` })) });
});

test('a failed panel leaves no card, the rest keep their order, the result names it', async () => {
    const app = fakeApp({ outcome: i => (i === 1 ? { code: 'RUNTIME_ERROR', message: 'out of memory' } : null) });
    const run = await runStoryboard(plan(4), { name: 'Heist' }, app.deps);
    app.finish(3, 1, 2, 0);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card0', 'card2', 'card3']);
    assert.deepStrictEqual(out.panels[1], { index: 1, groupId: null, error: { code: 'RUNTIME_ERROR', message: 'out of memory' } });
    assert.strictEqual(out.overview, true);
    assert.ok(!app.calls.some(c => c[0] === 'note' && c[1] === 'item1'));
});

test('a refused panel shrinks the stack it was expected in; the others still run', async () => {
    const app = fakeApp({ refuse: i => (i === 0 ? { code: 'REJECTED', message: 'no model' } : null) });
    const run = await runStoryboard(plan(3), { name: 'Heist' }, app.deps);
    assert.strictEqual(app.calls.find(c => c[0] === 'addStack')[1].expected, 2);
    app.finish(2, 1);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card1', 'card2']);
    assert.strictEqual(out.panels[0].error.code, 'REJECTED');
});

test('a stopped run is put in order but gets no overview', async () => {
    const app = fakeApp({ outcome: i => (i >= 2 ? { code: 'CANCELLED', message: 'The user pressed Stop.' } : null) });
    const run = await runStoryboard(plan(4), { name: 'Heist' }, app.deps);
    app.finish(1, 2, 0, 3);
    const out = await run.finished;
    assert.deepStrictEqual(app.members(run.stackId), ['card0', 'card1']);
    assert.strictEqual(out.cancelled, true);
    assert.strictEqual(out.overview, false);
    assert.ok(!app.calls.some(c => c[0] === 'overview'));
});

test('one card is no sheet; a panel with no intent gets no note', async () => {
    const app = fakeApp({ outcome: i => (i > 0 ? { code: 'RUNTIME_ERROR', message: 'x' } : null) });
    const panels = plan(3);
    delete panels[0].intent;
    const run = await runStoryboard(panels, { name: 'Heist' }, app.deps);
    app.finish(0, 1, 2);
    const out = await run.finished;
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.overview, false);
    assert.ok(!app.calls.some(c => c[0] === 'note' || c[0] === 'overview' || c[0] === 'reorder'));
});

test('the plan parses from the enhancer\'s one flattened line and from hand-edited lines alike', () => {
    const flat = '[PANEL 1] Picture: A wide photograph of a diner at night. Intent: We meet the place. [PANEL 2] Picture: The waitress pours coffee. Intent: She notices the stranger.';
    const want = [
        { prompt: 'A wide photograph of a diner at night.', intent: 'We meet the place.' },
        { prompt: 'The waitress pours coffee.', intent: 'She notices the stranger.' },
    ];
    assert.deepStrictEqual(parseStoryboardPlan(flat), want);
    assert.deepStrictEqual(parseStoryboardPlan(flat.replace(/ \[/g, '\n\n[').replace(/ Intent/g, '\nIntent')), want);
});

test('a block with no Intent keeps its words as the prompt; text before the first marker and empty blocks are dropped', () => {
    assert.deepStrictEqual(parseStoryboardPlan('Here is your plan: [panel 1] A fox in snow. [PANEL 2] Picture: Intent: nothing to draw'), [
        { prompt: 'A fox in snow.', intent: '' },
    ]);
    assert.deepStrictEqual(parseStoryboardPlan('just an idea, never enhanced'), []);
    assert.deepStrictEqual(parseStoryboardPlan(undefined), []);
});

test('nothing runs and no stack is made when every panel is refused, or Loop is armed, or a panel is blank', async () => {
    const all = fakeApp({ refuse: () => ({ code: 'REJECTED', message: 'Vision rejected the step.' }) });
    assert.deepStrictEqual(await runStoryboard(plan(2), { name: 'H' }, all.deps),
        { ok: false, code: 'REJECTED', message: 'Nothing was drawn: panel 1 was refused. Vision rejected the step.' });
    assert.ok(!all.calls.some(c => c[0] === 'addStack'));

    const loop = fakeApp({ loop: true });
    assert.strictEqual((await runStoryboard(plan(2), { name: 'H' }, loop.deps)).code, 'LOOP_ARMED');
    assert.deepStrictEqual(loop.calls, []);

    const blank = fakeApp();
    const panels = plan(3);
    panels[2].prompt = '  ';
    assert.deepStrictEqual(await runStoryboard(panels, { name: 'H' }, blank.deps),
        { ok: false, code: 'EMPTY_PANEL', message: 'Nothing was drawn: panel 3 has no picture prompt.' });
    assert.strictEqual((await runStoryboard([], { name: 'H' }, blank.deps)).code, 'NO_PANELS');
    assert.deepStrictEqual(blank.calls, []);
});
