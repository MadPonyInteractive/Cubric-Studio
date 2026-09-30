/**
 * routine-runner.test.cjs — MPI-970 R1: the order, landing and failure rules of
 * js/services/routineRunner.js, against a fake app that lands results the way the queue
 * does (step 1 a new card, `existingGroup` the card's next version). The catalogues are
 * the REAL ones, so a routine that stops validating breaks this test too.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const esm = (p) => import('file:///' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

let quoteRoutine, runRoutine, lookups;

test.before(async () => {
    ({ quoteRoutine, runRoutine } = await esm('js/services/routineRunner.js'));
    const { MODELS } = await esm('js/data/modelConstants/models.js');
    const { FLOWS } = await esm('js/data/flowsRegistry.js');
    lookups = { models: MODELS, flows: FLOWS };
});

const routine = (steps) => ({ schema: 'cubric/routine/v1', name: 'polish', summary: 'upscale, edit, cut out', steps, created_at: '2026-09-30T00:00:00Z' });
const THREE = [
    { operation: 'imageUpscale' },
    { modelId: 'klein-4b', operation: 'i2i', ratio: '1:1' },
    { operation: 'removeBackground' },
];
const label = (s) => s.modelId ? `${s.modelId}/${s.operation}` : s.operation;

/**
 * A project with two pictures and a clip, and a `submit` that lands like the queue.
 * `fail(call, phase)` returns a refusal to answer with: phase 'submit' refuses before the
 * queue, phase 'done' fails the finished job.
 */
function fakeApp({ fail = () => null, check = () => null, price = () => ({ billed: false, usd: null }) } = {}) {
    const card = (id, type, file) => ({ id, type, selectedIndex: 0, history: [{ id: `${id}1`, type, filePath: file }] });
    const project = { folderPath: 'C:/p', itemGroups: [card('A', 'image', 'C:/p/a.png'), card('B', 'image', 'C:/p/b.png'), card('V', 'video', 'C:/p/v.mp4')] };
    const calls = [];
    const log = [];
    let n = 0;
    const deps = {
        lookups,
        check,
        price,
        newId: () => `id${++n}`,
        readProject: async () => project,
        addStack: async (stack) => { log.push({ stack, afterCalls: calls.length }); },
        submit: async (step, input, landing) => {
            const call = { i: calls.length, step: label(step), sent: step, input: input.url, landing, into: landing.existingGroup?.id ?? null };
            calls.push(call);
            const refused = fail(call, 'submit');
            if (refused) return refused;
            const done = new Promise(resolve => setImmediate(() => {
                const bad = fail(call, 'done');
                if (bad) return resolve(bad);
                const item = { id: `out${call.i}`, type: 'image', filePath: `C:/p/out${call.i}.png` };
                const prev = landing.existingGroup && project.itemGroups.find(g => g.id === landing.existingGroup.id);
                const group = prev
                    ? { ...prev, history: [...prev.history, item], selectedIndex: prev.history.length }
                    : { id: `R${call.i}`, type: 'image', selectedIndex: 0, history: [item], ...(landing.stackId ? { stackId: landing.stackId } : {}) };
                project.itemGroups = [...project.itemGroups.filter(g => g.id !== group.id), group];
                resolve({ ok: true, item, group });
            }));
            return { ok: true, done };
        },
    };
    const groupOf = (id) => project.itemGroups.find(g => g.id === id);
    return { deps, calls, log, groupOf };
}

test('one card: step 1 makes a new card, each later step versions it, no stack', async () => {
    const app = fakeApp();
    const run = await runRoutine(routine(THREE), ['A'], { projectFolder: 'C:/p' }, app.deps);
    assert.strictEqual(run.ok, true, run.message);
    const summary = await run.finished;

    assert.deepStrictEqual(app.calls.map(c => c.step), ['imageUpscale', 'klein-4b/i2i', 'removeBackground']);
    assert.strictEqual(app.calls[0].into, null, 'step 1 must make a NEW card (D2)');
    assert.strictEqual(app.calls[0].input, 'C:/p/a.png');
    const result = summary.cards[0].groupId;
    assert.deepStrictEqual(app.calls.slice(1).map(c => c.into), [result, result], 'later steps version the result card');
    assert.deepStrictEqual(app.calls.slice(1).map(c => c.input), ['C:/p/out0.png', 'C:/p/out1.png'], 'each step runs on the previous result (D1)');
    assert.strictEqual(app.groupOf(result).history.length, 3);
    assert.strictEqual(app.groupOf('A').history.length, 1, 'the input card is never versioned');
    assert.strictEqual(run.stackId, null);
    assert.strictEqual(app.log.length, 0, 'one card in, one card out: no stack');
    assert.deepStrictEqual(summary.cards, [{ inputGroupId: 'A', groupId: result, steps: 3 }]);
    assert.strictEqual(summary.ok, true);
});

test('two cards: every step 1 queued before the stack, stackId on every step, one stack of two', async () => {
    const app = fakeApp();
    const run = await runRoutine(routine(THREE), ['A', 'B'], { projectFolder: 'C:/p' }, app.deps);
    const summary = await run.finished;

    assert.deepStrictEqual(app.calls.slice(0, 2).map(c => [c.step, c.input]), [['imageUpscale', 'C:/p/a.png'], ['imageUpscale', 'C:/p/b.png']]);
    assert.deepStrictEqual(app.log, [{ stack: { id: run.stackId, name: 'polish', kind: 'image', expected: 2 }, afterCalls: 2 }],
        'the stack is added once, after both step-1 jobs are queued');
    assert.ok(app.calls.every(c => c.landing.stackId === run.stackId && c.landing.batchId === run.runId && c.landing.batchTotal === 2),
        'stackId and the batch ride on every step, so the stack settles after the last one');
    assert.strictEqual(app.calls.length, 6);
    assert.ok(summary.cards.every(c => c.steps === 3));
    for (const c of summary.cards) assert.strictEqual(app.groupOf(c.groupId).history.length, 3);
});

test('a failed step stops only that card; its card keeps the versions made (D3)', async () => {
    const app = fakeApp({ fail: (c, phase) => (phase === 'done' && c.into && c.step === 'klein-4b/i2i' && c.input === 'C:/p/out0.png'
        ? { ok: false, code: 'RUNTIME_ERROR', message: 'The generation failed.' } : null) });
    const run = await runRoutine(routine(THREE), ['A', 'B'], { projectFolder: 'C:/p' }, app.deps);
    const [a, b] = (await run.finished).cards;

    assert.strictEqual(a.failedAt, 2);
    assert.strictEqual(a.error.code, 'RUNTIME_ERROR');
    assert.strictEqual(a.steps, 1);
    assert.strictEqual(app.groupOf(a.groupId).history.length, 1, 'the failed card keeps step 1');
    assert.strictEqual(b.steps, 3, 'the other card carries on');
    assert.strictEqual(app.calls.filter(c => c.into === a.groupId).length, 1, 'nothing runs after the failed step');
});

test('a cancelled step stops that card the same way', async () => {
    const app = fakeApp({ fail: (c, phase) => (phase === 'done' && c.step === 'removeBackground' ? { ok: false, code: 'CANCELLED', message: 'cancelled' } : null) });
    const run = await runRoutine(routine(THREE), ['A'], { projectFolder: 'C:/p' }, app.deps);
    const summary = await run.finished;
    assert.deepStrictEqual([summary.cards[0].failedAt, summary.cards[0].steps, summary.cards[0].error.code], [3, 2, 'CANCELLED']);
    assert.strictEqual(summary.ok, false);
});

test('a card whose step 1 is refused drops out; the stack expects only what was queued', async () => {
    const app = fakeApp({ fail: (c, phase) => (phase === 'submit' && c.input === 'C:/p/b.png' ? { ok: false, code: 'OP_UNAVAILABLE', message: 'no' } : null) });
    const run = await runRoutine(routine(THREE), ['A', 'B'], { projectFolder: 'C:/p' }, app.deps);
    const [a, b] = (await run.finished).cards;
    assert.strictEqual(app.log[0].stack.expected, 1);
    assert.strictEqual(a.steps, 3);
    assert.deepStrictEqual([b.failedAt, b.groupId, b.error.code], [1, null, 'OP_UNAVAILABLE']);
});

test('a result card deleted mid-run stops that chain with CARD_GONE', async () => {
    const app = fakeApp();
    const readProject = app.deps.readProject;
    let reads = 0;
    app.deps.readProject = async (f) => {
        const p = await readProject(f);
        if (++reads === 2) p.itemGroups = p.itemGroups.filter(g => !g.id.startsWith('R'));
        return p;
    };
    const run = await runRoutine(routine(THREE), ['A'], { projectFolder: 'C:/p' }, app.deps);
    const [a] = (await run.finished).cards;
    assert.deepStrictEqual([a.failedAt, a.error.code], [2, 'CARD_GONE']);
});

test('nothing runs when a model is missing, a card is the wrong kind or unknown, or the routine is illegal', async () => {
    const missing = fakeApp({ check: (s) => (s.modelId ? 'Klein 4B' : null) });
    const r1 = await runRoutine(routine(THREE), ['A'], { projectFolder: 'C:/p' }, missing.deps);
    assert.deepStrictEqual([r1.code, r1.missing], ['NOT_INSTALLED', ['Klein 4B']]);
    assert.match(r1.message, /Klein 4B/);

    for (const [ids, code] of [[['A', 'V'], 'WRONG_MEDIA_TYPE'], [['nope'], 'CARD_NOT_FOUND'], [[], 'NO_CARDS']]) {
        const app = fakeApp();
        assert.strictEqual((await runRoutine(routine(THREE), ids, { projectFolder: 'C:/p' }, app.deps)).code, code);
        assert.strictEqual(app.calls.length, 0, `${code}: nothing may be queued`);
    }

    const t2i = fakeApp();
    const r2 = await runRoutine(routine([{ modelId: 'klein-4b', operation: 't2i' }]), ['A'], { projectFolder: 'C:/p' }, t2i.deps);
    assert.strictEqual(r2.code, 'NOT_BATCHABLE');
    assert.strictEqual(t2i.calls.length + missing.calls.length, 0);
});

// A Flow may be any step (Fabio, 2026-09-30): `runLanding` must reach every leg of a
// two-leg Flow and every pass of a multi-pass one, and never the sidecar. Source-checked,
// as flow-defer-commit.test.cjs checks this path: reaching enqueueGeneration is not cheap.
test('flowService: runLanding is run-only and rides every leg and pass', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'js', 'services', 'flowService.js'), 'utf8');
    assert.match(src, /const \{ runMediaItems, runInputs, runNextPass, runOriginProject, runLanding, \.\.\.snapshot \} = inputs;/,
        'runLanding must stay out of the flowInputs snapshot');
    assert.match(src, /runMediaItems: media, runOriginProject, runLanding,/, 'each next pass must land where the routine said');
    assert.match(src, /submitFlowGeneration\(flow, inputs, callbacks, \{ operation: flow\.chain\.operation, tempId \}\)/,
        'leg 2 must get the same inputs, runLanding included');
    assert.match(src, /\? \{ \.\.\.runLanding, scope: 'groupHistory', groupId: runLanding\.existingGroup\.id,/,
        'a later step lands as the card\'s next version');
    assert.match(src, /enqueueGeneration\(config, runCallbacks, landing\)/, 'the routine landing is what gets enqueued');
});

test('quoteRoutine: the price is steps x cards, unknowable stays billed, missing is named once', async () => {
    const priced = fakeApp({ price: (s) => (s.modelId ? { billed: true, usd: 0.02 } : { billed: false, usd: null }), check: (s) => (s.modelId ? 'Klein 4B' : null) });
    const q = quoteRoutine(routine([...THREE, THREE[1]]), 3, priced.deps);
    assert.deepStrictEqual([q.ok, q.billed, q.missing], [true, true, ['Klein 4B']]);
    assert.ok(Math.abs(q.usd - 0.12) < 1e-9, `2 billed steps x 3 cards x $0.02 = $0.12, got ${q.usd}`);

    const unknown = fakeApp({ price: (s) => (s.modelId ? { billed: true, usd: null } : { billed: false, usd: null }) });
    assert.deepStrictEqual(quoteRoutine(routine(THREE), 2, unknown.deps), { ok: true, missing: [], billed: true, usd: null });
    assert.deepStrictEqual(quoteRoutine(routine(THREE), 2, fakeApp().deps), { ok: true, missing: [], billed: false, usd: 0 });
});

// ── Run inputs (D9) ───────────────────────────────────────────────────────────

/** "Place this character in each scene": the scene card is edited, the character is the reference. */
const PLACE = {
    ...routine([
        { operation: 'imageUpscale' },
        { modelId: 'klein-4b', operation: 'kleinEdit', positive: 'the person from picture 2 here, {mood} light',
            media: [{ role: 'inputImage2', input: 'character' }] },
    ]),
    inputs: [{ id: 'character', kind: 'image', label: 'the person to place' }, { id: 'mood', kind: 'text' }],
};

test('D9: the run inputs reach every card\'s step, filled the same, the card still in the required slot', async () => {
    const app = fakeApp();
    const run = await runRoutine(PLACE, ['A', 'B'], { projectFolder: 'C:/p', inputs: { character: 'C:/p/hero.png', mood: 'warm' } }, app.deps);
    assert.strictEqual(run.ok, true, run.message);
    await run.finished;
    const edits = app.calls.filter(c => c.step === 'klein-4b/kleinEdit');
    assert.strictEqual(edits.length, 2);
    for (const c of edits) {
        assert.deepStrictEqual(c.sent.media, [{ role: 'inputImage2', url: 'C:/p/hero.png' }], 'the reference is the run input, as a url');
        assert.strictEqual(c.sent.positive, 'the person from picture 2 here, warm light');
        assert.match(c.input, /^C:\/p\/out\d\.png$/, 'the chained result is still the input');
    }
    assert.strictEqual(PLACE.steps[1].positive.includes('{mood}'), true, 'the saved routine is never rewritten');

    const byCard = fakeApp();
    const r2 = await runRoutine(PLACE, ['A'], { projectFolder: 'C:/p', inputs: { character: 'B', mood: 'cold' } }, byCard.deps);
    await r2.finished;
    assert.deepStrictEqual(byCard.calls[1].sent.media, [{ role: 'inputImage2', url: 'C:/p/b.png' }], 'a card id resolves to its selected file');
});

test('D9: a missing or wrong run input refuses before anything is queued, and the quote refuses too', async () => {
    const app = fakeApp();
    const none = await runRoutine(PLACE, ['A'], { projectFolder: 'C:/p' }, app.deps);
    assert.deepStrictEqual([none.code, none.missing], ['INPUT_MISSING', ['character', 'mood']]);
    assert.match(none.message, /the person to place/);
    const blank = await runRoutine(PLACE, ['A'], { projectFolder: 'C:/p', inputs: { character: 'B', mood: '  ' } }, app.deps);
    assert.deepStrictEqual(blank.missing, ['mood']);

    for (const character of ['V', ['A', 'B'], 'nope', 'C:/p/voice.wav']) {
        const r = await runRoutine(PLACE, ['A'], { projectFolder: 'C:/p', inputs: { character, mood: 'warm' } }, app.deps);
        assert.strictEqual(r.code, 'INVALID_INPUT', `${JSON.stringify(character)} is not one picture`);
    }
    assert.strictEqual(app.calls.length, 0, 'nothing may be queued');

    assert.strictEqual(quoteRoutine(PLACE, 2, app.deps).code, 'INPUT_MISSING', 'never ask to pay for a run that cannot start');
    assert.strictEqual(quoteRoutine(PLACE, 2, app.deps, { character: 'B', mood: 'warm' }).ok, true);
});
