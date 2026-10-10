/**
 * flow-legs.test.cjs — MPI-1041 Batch A1. The engine under the Character Sheet Editor: a Flow
 * whose leg 1 is ROUTED by a field, whose `chain` is a LIST of legs with rules on any field, and
 * whose second model is OPTIONAL and serves only some of its ops.
 *
 * Nothing here is the editor itself (that is Phase B). The fixtures are synthetic FlowDefs built
 * from real op keys, so each assertion names the engine rule it guards:
 *
 *   1. one rule evaluator (`ruleHolds`) behind hiddenWhen, disabledWhen and a leg's `when`;
 *   2. the op leg 1 takes is picked by a select's value, and `null` skips it;
 *   3. a chain runs the legs whose rules hold, in order, and a skipped leg passes the picture on;
 *   4. each leg resolves its model ids FOR ITS OP, so leg 2 of a two-slot Flow gets the Qwen
 *      graph and not the Klein one (the `getUniversalWorkflow` first-id trap);
 *   5. an optional model blocks only the ops it serves;
 *   6. EVERY shipped Flow resolves the same op / graph / availability as before this change.
 *
 * The table in section 6 was computed from the code BEFORE the engine changed and is data here.
 * If a shipped Flow legitimately changes (a new model slot, a new graph), update its row.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const esm = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));

const registry = () => esm('js/data/flowsRegistry.js');
const fields = () => esm('js/utils/declaredFields.js');
const stage = async (installed) => {
    const { state } = await esm('js/state.js');
    state.s_installedModelIds = installed;
};

// ── Fixture ──────────────────────────────────────────────────────────────────
//
// The shape Phase B will declare, with stand-in ops that already exist: `flowOutpaint` plays the
// Klein edit op (a Klein graph), `flowCharacterSheetImages` is the real two-graph op (Qwen by
// default, Klein through `byModel`), `flowCharacterSheetHeadless` the head-removal leg. The one op
// that does not exist yet is the Qwen edit; availability never resolves a graph, so a string will do.
const QWEN_EDIT = 'flowCharacterSheetEditQwen';
const EDITOR = {
    id: 'legs-fixture',
    title: 'Legs Fixture',
    operation: 'flowOutpaint',
    mediaType: 'image',
    type: 'edit',
    requiredModels: [
        'klein-9b',
        { label: 'Qwen-Image 2.1', models: ['qwen-image-2-1'], optional: true, for: [QWEN_EDIT, 'flowCharacterSheetImages'] },
    ],
    operationBy: { field: 'change', map: { clothes: 'flowOutpaint', body: QWEN_EDIT, none: null } },
    fields: [
        { id: 'change', type: 'select', default: 'clothes', options: [{ v: 'clothes', label: 'Clothes' }, { v: 'body', label: 'Body' }, { v: 'none', label: 'Nothing else' }] },
        { id: 'Input_Age', type: 'slider', min: 0, max: 100, default: 0 },
        { id: 'Input_Remove_Head', type: 'toggle', default: true },
    ],
    chain: [
        { operation: 'flowOutpaint', when: { field: 'Input_Age', atLeast: 1 }, input: 'image1' },
        {
            operation: 'flowCharacterSheetImages',
            when: [{ field: 'Input_Age', atLeast: 1 }, { field: 'Input_Age', atMost: 12 }],
            input: 'image1',
            box: { x: 0.5, y: 0, width: 0.5, height: 1 },
            params: { Input_Face_Pose: 'TURNED' },
        },
        { operation: 'flowCharacterSheetHeadless', when: 'Input_Remove_Head', input: 'image1' },
    ],
};
const run = (change, age, extra = {}) => ({ change, injectionParams: { Input_Age: age, ...extra } });
const opsOf = (legs) => legs.map(l => l.operation);

// ── 1. one rule evaluator ──────────────────────────────────────────────────────

test('ruleHolds: is, isNot, in, atMost, below, atLeast, several in one rule, and a list = all', async () => {
    const { ruleHolds } = await registry();
    const v = { n: 12, s: 'a', blank: '', none: null };

    assert.ok(ruleHolds({ field: 's', is: 'a' }, v));
    assert.ok(!ruleHolds({ field: 's', is: 'b' }, v));
    assert.ok(ruleHolds({ field: 's', isNot: 'b' }, v));
    assert.ok(ruleHolds({ field: 'blank', isNot: 0 }, v), '`isNot: 0` is a legal clause, not a falsy one');
    assert.ok(ruleHolds({ field: 's', in: ['a', 'b'] }, v));
    assert.ok(!ruleHolds({ field: 's', in: ['b'] }, v));
    assert.ok(!ruleHolds({ field: 's', in: 'a' }, v), '`in` takes a list');

    assert.ok(ruleHolds({ field: 'n', atMost: 12 }, v) && !ruleHolds({ field: 'n', atMost: 11 }, v));
    assert.ok(!ruleHolds({ field: 'n', below: 12 }, v) && ruleHolds({ field: 'n', below: 13 }, v));
    assert.ok(ruleHolds({ field: 'n', atLeast: 12 }, v) && !ruleHolds({ field: 'n', atLeast: 13 }, v));

    // A blank or absent value is NOT a number: no numeric test fires on it.
    for (const field of ['blank', 'none', 'missing']) {
        for (const test of [{ atMost: 100 }, { below: 100 }, { atLeast: -1 }]) {
            assert.ok(!ruleHolds({ field, ...test }, v), `${field} ${JSON.stringify(test)}`);
        }
    }

    assert.ok(ruleHolds({ field: 'n', atLeast: 1, atMost: 12 }, v), 'several tests in one rule must ALL hold');
    assert.ok(!ruleHolds({ field: 'n', atLeast: 13, atMost: 20 }, v));
    assert.ok(ruleHolds([{ field: 'n', atLeast: 1 }, { field: 's', is: 'a' }], v), 'a list holds when every rule does');
    assert.ok(!ruleHolds([{ field: 'n', atLeast: 1 }, { field: 's', is: 'b' }], v));
    assert.ok(ruleHolds([], v));

    // `hiddenWhen` has always read a rule with no test as `is: undefined`.
    assert.ok(ruleHolds({ field: 'missing' }, v));
    assert.ok(!ruleHolds({ field: 's' }, v));
});

test('hiddenWhen and disabledWhen go through ruleHolds, which declaredFields.js exports', async () => {
    const reg = await registry();
    const { ruleHolds, hiddenFieldIds, disabledFieldIds, flowControlFieldIds } = await fields();
    assert.strictEqual(ruleHolds, reg.ruleHolds, 'one evaluator, two import paths');
    assert.strictEqual(flowControlFieldIds, reg.flowControlFieldIds);

    const decls = [
        { id: 'words', hiddenWhen: { field: 'change', is: 'none' } },
        { id: 'young', hiddenWhen: { field: 'Input_Age', atMost: 0 } },
        { id: 'teen', hiddenWhen: [{ field: 'Input_Age', atLeast: 1 }, { field: 'Input_Age', atMost: 12 }] },
        { id: 'grey', disabledWhen: { field: 'change', in: ['none', 'body'] } },
        { id: 'greyAge', disabledWhen: { field: 'Input_Age', below: 18 } },
        { id: 'revealed', hiddenWhen: { field: 'change', isNot: 'body' } },
        { id: 'model', hiddenWhen: { model: 'klein-9b' } },
    ];
    const at = (values, models = []) => ({
        hidden: [...hiddenFieldIds(decls, values, models)].sort(),
        disabled: [...disabledFieldIds(decls, values)].sort(),
    });

    assert.deepStrictEqual(at({ change: 'none', Input_Age: 0 }), {
        hidden: ['revealed', 'words', 'young'], disabled: ['grey', 'greyAge'],
    });
    assert.deepStrictEqual(at({ change: 'body', Input_Age: 10 }, ['klein-9b']), {
        hidden: ['model', 'teen'], disabled: ['grey', 'greyAge'],
    });
    assert.deepStrictEqual(at({ change: 'clothes', Input_Age: 30 }), {
        hidden: ['revealed'], disabled: [],
    });
});

// ── 2. the op is routed by a field ─────────────────────────────────────────────

test('leg 1 takes the op the routing field\'s value maps to', async () => {
    const { flowOperation, flowOperations } = await registry();

    assert.strictEqual(flowOperation(EDITOR, { change: 'body' }), QWEN_EDIT);
    assert.strictEqual(flowOperation(EDITOR, { change: 'clothes' }), 'flowOutpaint');
    assert.strictEqual(flowOperation(EDITOR, {}), 'flowOutpaint', 'no value: the field\'s declared default routes');
    assert.strictEqual(flowOperation(EDITOR, { change: 'none' }), null, 'a null entry SKIPS leg 1');
    assert.strictEqual(flowOperation(EDITOR, { change: 'something-new' }), EDITOR.operation, 'an unmapped value takes `operation`');
    for (const hostile of ['constructor', 'toString', '__proto__']) {
        assert.strictEqual(flowOperation(EDITOR, { change: hostile }), EDITOR.operation, `${hostile} is no map key`);
    }

    // An `Input_*` routing field is read from injectionParams, a numeric option value by its string key.
    const byInput = { operation: 'a', operationBy: { field: 'Input_Mode', map: { 2: 'b', 3: 'c' } }, fields: [{ id: 'Input_Mode', default: 3 }] };
    assert.strictEqual(flowOperation(byInput, { injectionParams: { Input_Mode: 2 } }), 'b');
    assert.strictEqual(flowOperation(byInput, {}), 'c');

    // No `operationBy`: always `operation`, whatever the run says.
    assert.strictEqual(flowOperation({ operation: 'a' }, { change: 'body' }), 'a');

    assert.deepStrictEqual(flowOperations(EDITOR),
        ['flowOutpaint', QWEN_EDIT, 'flowCharacterSheetImages', 'flowCharacterSheetHeadless']);
    assert.deepStrictEqual(flowOperations({ operation: 'a' }), ['a']);
});

// ── 3. legs: rules, order, pass-through ───────────────────────────────────────────

test('a 3-leg chain with an `atMost` rule runs legs 1 and 3 and skips leg 2', async () => {
    const { flowRunLegs } = await registry();
    const flow = {
        operation: 'a',
        fields: [{ id: 'Input_Age', default: 0 }],
        chain: [{ operation: 'b', when: { field: 'Input_Age', atMost: 12 } }, { operation: 'c' }],
    };
    assert.deepStrictEqual(opsOf(flowRunLegs(flow, { injectionParams: { Input_Age: 30 } })), ['a', 'c']);
    assert.deepStrictEqual(opsOf(flowRunLegs(flow, { injectionParams: { Input_Age: 12 } })), ['a', 'b', 'c']);
    assert.deepStrictEqual(opsOf(flowRunLegs(flow, { injectionParams: { Input_Age: 13 } })), ['a', 'c']);
    assert.deepStrictEqual(opsOf(flowRunLegs(flow, {})), ['a', 'b', 'c'], 'the declared default (0) is at most 12');
});

test('the leg driver dispatches the wanted legs in order and the caller hears ONE completion, on the last', async () => {
    const { chainCallbacks } = await esm('js/services/flowService.js');

    const drive = (flow, input) => {
        const order = [];
        let heard = 0;
        const caller = { onComplete: () => { heard++; } };
        let cb = null;
        const submit = (result, next) => {
            order.push(next.operation);
            cb = chainCallbacks(flow, caller, submit, input, next.index);
            return { queueJobId: 'x' };
        };
        cb = chainCallbacks(flow, caller, submit, input, -1);
        while (cb) { const cur = cb; cb = null; cur.onComplete({ item: {} }); }
        return { order, heard };
    };

    // Age 30 on "clothes": leg 1, the Klein age edit, the head removal; the child rebuild is skipped.
    assert.deepStrictEqual(drive(EDITOR, run('clothes', 30)), { order: ['flowOutpaint', 'flowCharacterSheetHeadless'], heard: 1 });
    // Age 8: all four.
    assert.deepStrictEqual(drive(EDITOR, run('clothes', 8)),
        { order: ['flowOutpaint', 'flowCharacterSheetImages', 'flowCharacterSheetHeadless'], heard: 1 });
    // No age, head kept: leg 1 alone, and the caller still hears it once.
    assert.deepStrictEqual(drive(EDITOR, run('clothes', 0, { Input_Remove_Head: false })), { order: [], heard: 1 });
    // A leg that cannot enqueue forwards the completion before it rather than hanging the pane.
    let got = null;
    const wrapped = chainCallbacks(EDITOR, { onComplete: (r) => { got = r; } }, () => null, run('clothes', 30));
    wrapped.onComplete({ item: { id: 'leg-1' } });
    assert.deepStrictEqual(got, { item: { id: 'leg-1' } });
});

test('a skipped leg 1 starts the run on the first wanted leg, and nothing wanted is nothing to run', async () => {
    const { flowRunLegs } = await registry();

    // "Nothing else" + age 30: leg 1 is skipped, the age edit runs FIRST (index 0, not -1).
    const legs = flowRunLegs(EDITOR, run('none', 30));
    assert.deepStrictEqual(legs.map(l => [l.index, l.operation]), [[0, 'flowOutpaint'], [2, 'flowCharacterSheetHeadless']]);
    assert.deepStrictEqual(flowRunLegs(EDITOR, run('none', 0, { Input_Remove_Head: false })), []);

    // The real run path stops before anything is queued, and says so.
    const { Events } = await esm('js/events.js');
    const { submitFlowGeneration } = await esm('js/services/flowService.js');
    const warnings = [];
    const off = Events.on('ui:warning', ({ message }) => warnings.push(message));
    try {
        await stage(['klein-9b']);
        const res = submitFlowGeneration(EDITOR, run('none', 0, { Input_Remove_Head: false }));
        assert.strictEqual(res, null);
        assert.match(warnings.join('|'), /Legs Fixture has nothing to do/);
    } finally { off(); }
});

test('each leg is fed the picture before it, on its own role, and lands on the card as its next version', async () => {
    const { chainLegInputs, legInjection } = await esm('js/services/flowService.js');
    const { flowLegs } = await registry();
    const legs = flowLegs(EDITOR);
    const group = { id: 'card-1' };
    const result = { item: { filePath: '/p/out.png', pixelDimensions: { w: 1920, h: 1200 } }, group };

    for (const leg of legs) {
        const inputs = chainLegInputs(EDITOR, { positive: 'x', runLanding: { batchId: 'r' } }, result, leg);
        assert.deepStrictEqual(inputs.runMediaItems.map(m => [m.role, m.url]), [['image1', '/p/out.png']]);
        assert.deepStrictEqual(inputs.runLanding, { batchId: 'r', existingGroup: group });
    }
    // A leg with no `input` role takes the inputs as they were (MPI-623).
    const plain = { operation: 'a', chain: [{ operation: 'b' }] };
    const inputs = { positive: 'x' };
    assert.strictEqual(chainLegInputs(plain, inputs, result, flowLegs(plain)[0]), inputs);
    // ...and with no leg named, the first, as the two-argument form always did.
    assert.strictEqual(chainLegInputs(plain, inputs, result), inputs);
    assert.deepStrictEqual(chainLegInputs(EDITOR, {}, result).runMediaItems.map(m => m.role), ['image1']);

    // A leg's `params` are sent as declared, its `box` as pixels of the picture it was fed.
    assert.deepStrictEqual(legInjection(legs[1], result.item.pixelDimensions), {
        Input_Face_Pose: 'TURNED', box1: { x: 960, y: 0, width: 960, height: 1200 },
    });
    assert.deepStrictEqual(legInjection(legs[0], undefined), {}, 'no box: nothing sent, so the whole picture');
    assert.deepStrictEqual(legInjection({ operation: 'x', params: { A: 1 } }, null), { A: 1 });
    assert.strictEqual(legInjection(legs[1], { w: 0, h: 0 }), null, 'a box with no picture size never runs the whole picture instead');
    assert.deepStrictEqual(
        legInjection({ operation: 'x', input: 'image2', box: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } }, { w: 1001, h: 7 }).box2,
        { x: 250, y: 2, width: 501, height: 3 }, 'integers, box2 for an image2 input');
    // The right half of an odd-width picture ends ON its last pixel, never one past it.
    assert.deepStrictEqual(legInjection({ operation: 'x', box: { x: 0.5, y: 0, width: 0.5, height: 1 } }, { w: 1001, h: 7 }).box1,
        { x: 501, y: 0, width: 500, height: 7 });
});

// ── 4. model ids per op ────────────────────────────────────────────────────────────

test('leg 2 of a two-slot Flow gets the QWEN graph: ids are resolved per op', async () => {
    const { flowModelIds } = await registry();
    const { getUniversalWorkflow } = await esm('js/data/modelRegistry.js');
    await stage(['klein-9b', 'qwen-image-2-1']);

    // THE TRAP: every slot's id used to go out with every leg, and the FIRST id with a `byModel`
    // arm picks the graph. Klein is first, so the child rebuild ran on the Klein graph.
    assert.strictEqual(getUniversalWorkflow('flowCharacterSheetImages', flowModelIds(EDITOR)),
        'flow_character_sheet_from_images_klein.json', 'unresolved per op, the trap is still there to fall into');

    const op = 'flowCharacterSheetImages';
    assert.deepStrictEqual(flowModelIds(EDITOR, { op }), [null, 'qwen-image-2-1'], 'the Qwen slot claims the op; Klein is null-filled');
    assert.strictEqual(getUniversalWorkflow(op, flowModelIds(EDITOR, { op })), 'flow_character_sheet_from_images.json');

    // An op nobody claims is served by the slot with no `for`; the optional one is null-filled.
    assert.deepStrictEqual(flowModelIds(EDITOR, { op: 'flowOutpaint' }), ['klein-9b', null]);
    assert.deepStrictEqual(flowModelIds(EDITOR, { op: 'flowCharacterSheetHeadless' }), ['klein-9b', null]);
    assert.deepStrictEqual(flowModelIds(EDITOR, { op: QWEN_EDIT }), [null, 'qwen-image-2-1']);
    // No op: every slot, indexed as before (the badge, the pickers, the sidecar).
    assert.deepStrictEqual(flowModelIds(EDITOR), ['klein-9b', 'qwen-image-2-1']);

    // `for` on the Klein slot too: it then serves exactly what it names.
    const both = { ...EDITOR, requiredModels: [{ label: 'Klein', models: ['klein-9b'], for: ['flowOutpaint'] }, EDITOR.requiredModels[1]] };
    assert.deepStrictEqual(flowModelIds(both, { op: 'flowOutpaint' }), ['klein-9b', null]);
    assert.deepStrictEqual(flowModelIds(both, { op: 'flowCharacterSheetHeadless' }), [null, null]);

    // A Flow with no `for` anywhere serves every op from every slot, as every shipped Flow does.
    const plain = { id: 'plain', operation: 'a', requiredModels: ['klein-9b', 'qwen-image-2-1'] };
    assert.deepStrictEqual(flowModelIds(plain, { op: 'flowCharacterSheetImages' }), ['klein-9b', 'qwen-image-2-1']);
});

test('modelParams follow the ops a slot serves, and the run carries the ids resolved for its op', async () => {
    const { flowModelParams } = await registry();
    await stage(['klein-9b', 'qwen-image-2-1']);
    const flow = { ...EDITOR, modelParams: { 'klein-9b': { Input_Edit_Model: 'klein.safetensors' }, 'qwen-image-2-1': { Input_Edit_Model: 'qwen.safetensors' } } };
    assert.deepStrictEqual(flowModelParams(flow, { op: 'flowOutpaint' }), { Input_Edit_Model: 'klein.safetensors' });
    assert.deepStrictEqual(flowModelParams(flow, { op: 'flowCharacterSheetImages' }), { Input_Edit_Model: 'qwen.safetensors' });

    // The wiring, not just the helper (reaching enqueueGeneration is not cheap, so it is source-checked).
    const src = read('js/services/flowService.js');
    assert.match(src, /const modelIds = flowModelIds\(flow, \{ op: operation \}\);/);
    assert.match(src, /flowModelIds: modelIds,/);
    assert.match(src, /loraPhases: flowLoraPhases\(flow\)\.filter\(\(\{ phase \}\) => modelIds\[phase - 1\]\)/,
        'a rack follows the slots THIS op runs');
});

// ── 5. optional models ───────────────────────────────────────────────────────────────

test('an optional slot never gates the Flow, and a missing one blocks only the ops it serves', async () => {
    const { flowAvailability, flowRunAvailability } = await registry();

    await stage(['klein-9b']);
    assert.deepStrictEqual(flowAvailability(EDITOR), { available: true, missing: [], missingDeps: [] },
        'the Library says Ready: Klein is all the Flow needs to open');

    const blocked = (r) => [flowRunAvailability(EDITOR, r).available, flowRunAvailability(EDITOR, r).missing];
    assert.deepStrictEqual(blocked(run('clothes', 0)), [true, []]);
    assert.deepStrictEqual(blocked(run('clothes', 30)), [true, []], 'the age edit is Klein, and 30 is no child');
    assert.deepStrictEqual(blocked(run('none', 30)), [true, []]);
    assert.deepStrictEqual(blocked(run('body', 0)), [false, ['qwen-image-2-1']], 'the body change runs on Qwen');
    assert.deepStrictEqual(blocked(run('clothes', 8)), [false, ['qwen-image-2-1']], 'so does the child rebuild leg');
    assert.deepStrictEqual(blocked(run('none', 8)), [false, ['qwen-image-2-1']]);
    assert.deepStrictEqual(blocked(run('body', 0, { Input_Remove_Head: false })), [false, ['qwen-image-2-1']]);

    // The real run path refuses the blocked one before anything is queued, and names the model.
    const { Events } = await esm('js/events.js');
    const { submitFlowGeneration } = await esm('js/services/flowService.js');
    const warnings = [];
    const off = Events.on('ui:warning', ({ message }) => warnings.push(message));
    try {
        assert.strictEqual(submitFlowGeneration(EDITOR, run('body', 0)), null);
        assert.match(warnings.join('|'), /Legs Fixture needs a model installed first/);
    } finally { off(); }

    // A REQUIRED slot still gates everything, and the Qwen model is never named for it.
    await stage([]);
    assert.deepStrictEqual(flowAvailability(EDITOR), { available: false, missing: ['klein-9b'], missingDeps: [] });
    assert.deepStrictEqual(blocked(run('clothes', 0)), [false, ['klein-9b']]);
    assert.deepStrictEqual(blocked(run('body', 0)), [false, ['klein-9b', 'qwen-image-2-1']]);

    await stage(['klein-9b', 'qwen-image-2-1']);
    for (const r of [run('body', 0), run('clothes', 8), run('none', 8), run('clothes', 0)]) {
        assert.deepStrictEqual(blocked(r), [true, []], JSON.stringify(r));
    }
});

test('the agent and routine gates ask the run, after its fields resolve', () => {
    const agent = read('js/shell/agentDispatch.js');
    const resolved = agent.indexOf('resolveFlowFieldValues(flow, fields)');
    const asked = agent.indexOf('flowRunAvailability(flow, run)', resolved);
    const enhanced = agent.indexOf('enhanceFlowRun(flow,', resolved);
    assert.ok(resolved > -1 && asked > resolved && enhanced > asked,
        'fields resolve -> the run is asked -> only then does the enhancer spend a call');
    assert.match(agent, /_refuse\('NOTHING_TO_DO'/);
    assert.match(agent, /\.\.\.\(optional\.length \? \{ optional \} : \{\}\),/, 'the catalogue marks the optional models');

    const routines = read('js/shell/routineDispatch.js');
    assert.match(routines, /flowRunAvailability\(flow, _flowStepRun\(flow, step\)\)\.available/,
        'a routine step asks about the run its own fields make');
});

// ── 6. the control fields, the Flow package validator, the frame ─────────────────────────

test('flowControlFieldIds names the fields the engine reads and no others', async () => {
    const { flowControlFieldIds } = await fields();
    assert.deepStrictEqual([...flowControlFieldIds(EDITOR)].sort(), ['Input_Age', 'Input_Remove_Head', 'change']);
    assert.deepStrictEqual([...flowControlFieldIds({ operation: 'a', chain: { operation: 'b', when: 'Input_X' } })], ['Input_X'],
        'the one-object chain of MPI-997');
    assert.deepStrictEqual([...flowControlFieldIds({ operation: 'a', chain: { operation: 'b' } })], []);
    assert.deepStrictEqual([...flowControlFieldIds({ operation: 'a' })], []);
    // Every shipped Flow: the ids are declared fields, and only a toggle leg's `when` is one today.
    const { FLOWS } = await registry();
    for (const flow of FLOWS) {
        const declared = new Set([...(flow.fields || []), ...(flow.steps || []).flatMap(s => s.fields || [])].map(f => f.id));
        for (const id of flowControlFieldIds(flow)) assert.ok(declared.has(id), `${flow.id}: ${id} is read by the engine but declared nowhere`);
    }
});

test('a Flow package may route and chain, and its control fields name no graph node', () => {
    const uf = require('../services/userFlows');
    const known = uf.loadKnown();
    const MODEL = [...known.models][0];
    const graph = {
        1: { class_type: 'MpiLoadImageFromPath', inputs: { string: '' }, _meta: { title: 'Input_Image' } },
        2: { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'x' }, _meta: { title: 'Output_Image' } },
    };
    const manifest = (flow = {}) => ({
        schema: uf.SCHEMA, id: 'legs-package', version: '1.0.0', compat: { minAppVersion: '1.0.0' },
        flow: {
            title: 'Legs', description: 'A package made by a test.', preview: 'preview.webp',
            requiredModels: [MODEL], mediaType: 'image', type: 'edit',
            fields: [{ id: 'Input_Mode', type: 'select' }, { id: 'Input_Age', type: 'slider' }, { id: 'Input_Remove_Head', type: 'toggle' }],
            ...flow,
        },
        op: {
            label: 'Flow: Legs', mediaType: 'image',
            mediaInputs: [{ key: 'image1', mediaType: 'image', title: 'Input_Image', required: true }],
        },
    });
    const check = (m) => uf.validatePackage(m, graph, new Set(['preview.webp']), known);
    const named = (errors, id) => errors.filter(e => e.includes(`"${id}"`) && /no node/.test(e));

    // Without the engine reading them, all three control fields are dead sliders and are refused.
    assert.deepStrictEqual(named(check(manifest()), 'Input_Mode').length + named(check(manifest()), 'Input_Age').length, 2);

    const routed = manifest({
        operationBy: { field: 'Input_Mode', map: { 1: 'flowOutpaint', 2: null } },
        chain: [{ operation: 'flowOutpaint', when: { field: 'Input_Age', atLeast: 1 }, input: 'image1' },
            { operation: 'flowCharacterSheetHeadless', when: 'Input_Remove_Head', input: 'image1' }],
    });
    assert.deepStrictEqual(check(routed), []);
    assert.ok(read('services/userFlows.js').includes("'operationBy'"), 'FLOW_KEYS carries it');
});

test('the frame asks the routed op for promptRequired, and offers the toggle for a string `when` only', async () => {
    const src = read('js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js');
    assert.match(src, /const runOperation = flowOperation\(flow, inputs\);\s*if \(runOperation && getCommand\(runOperation\)\?\.promptRequired && !hasPrompt\) \{/,
        'a skipped leg 1 asks for no prompt');
    assert.match(src, /const legIndex = flowToggleLeg\(flow\);/);
    assert.match(src, /\}, legIndex\)\);/, 'the toggle runs the leg it mounted for');

    const { flowToggleLeg } = await registry();
    assert.strictEqual(flowToggleLeg(EDITOR), 2, 'the head-removal leg: a string `when` and an input role');
    assert.strictEqual(flowToggleLeg({ operation: 'a', chain: [{ operation: 'b', when: { field: 'x', is: 1 }, input: 'image1' }] }), -1,
        'a rule is the run\'s own business and gets no toggle');
    assert.strictEqual(flowToggleLeg({ operation: 'a', chain: { operation: 'b', when: 'Input_Remove_Head', input: 'image1' } }), 0);
    assert.strictEqual(flowToggleLeg({ operation: 'a', chain: { operation: 'b', when: 'Input_Remove_Head' } }), -1);
});

// ── 7. every shipped Flow resolves what it did before ────────────────────────────────────
//
// Computed from the code as it stood BEFORE this change (one row per Flow in FLOWS, three install
// states): the op, its chain ops, the resolved model ids, the graph file each op resolves through
// `getUniversalWorkflow`, and whether the Flow is available and which model is named missing.
// `none` = nothing installed, `all` = every candidate of every slot, `last` = only the LAST
// candidate of each slot (the any-of resolution and every `byModel` arm). Dep lists are left out:
// they are not what this change touches, and `flowRunAvailability` is held to `flowAvailability`
// on them below.
const BEFORE = {
    'ltx-extend': {
        op: 'flowLtxExtend', chain: [],
        none: { ids: ['ltx-23-balanced'], graph: 'flow_ltx_extend.json', chainGraph: [], available: false, missing: ['ltx-23-balanced'] },
        all: { ids: ['ltx-23-balanced'], graph: 'flow_ltx_extend.json', chainGraph: [], available: true, missing: [] },
        last: { ids: ['minimax-h3'], graph: 'flow_h3_extend.json', chainGraph: [], available: true, missing: [] },
    },
    'ltx-foley': {
        op: 'flowLtxFoley', chain: [],
        none: { ids: ['ltx-23-balanced'], graph: 'flow_ltx_foley.json', chainGraph: [], available: false, missing: ['ltx-23-balanced'] },
        all: { ids: ['ltx-23-balanced'], graph: 'flow_ltx_foley.json', chainGraph: [], available: true, missing: [] },
        last: { ids: ['ltx-23-balanced'], graph: 'flow_ltx_foley.json', chainGraph: [], available: true, missing: [] },
    },
    'ltx-upscale': {
        op: 'ltxVideoUpscale', chain: [],
        none: { ids: ['ltx-23-balanced'], graph: 'ltx_video_upscale.json', chainGraph: [], available: false, missing: ['ltx-23-balanced'] },
        all: { ids: ['ltx-23-balanced'], graph: 'ltx_video_upscale.json', chainGraph: [], available: true, missing: [] },
        last: { ids: ['ltx-23-balanced'], graph: 'ltx_video_upscale.json', chainGraph: [], available: true, missing: [] },
    },
    'video-edit': {
        op: 'flowVideoEdit', chain: [],
        none: { ids: ['minimax-h3-ref2va'], graph: 'flow_video_edit.json', chainGraph: [], available: false, missing: ['minimax-h3-ref2va'] },
        all: { ids: ['minimax-h3-ref2va'], graph: 'flow_video_edit.json', chainGraph: [], available: false, missing: [] },
        last: { ids: ['minimax-h3-ref2va'], graph: 'flow_video_edit.json', chainGraph: [], available: false, missing: [] },
    },
    'scribble-object': {
        op: 'flowScribObj', chain: [],
        none: { ids: ['klein-9b'], graph: 'flow_draw_it_in.json', chainGraph: [], available: false, missing: ['klein-9b'] },
        all: { ids: ['klein-9b'], graph: 'flow_draw_it_in.json', chainGraph: [], available: true, missing: [] },
        last: { ids: ['klein-9b-cloud'], graph: 'flow_draw_it_in.json', chainGraph: [], available: true, missing: [] },
    },
    'scribble': {
        op: 'flowScribble', chain: [],
        none: { ids: ['klein-9b'], graph: 'flow_scribble.json', chainGraph: [], available: false, missing: ['klein-9b'] },
        all: { ids: ['klein-9b'], graph: 'flow_scribble.json', chainGraph: [], available: true, missing: [] },
        last: { ids: ['nano-banana-2-lite-cloud'], graph: 'flow_scribble.json', chainGraph: [], available: true, missing: [] },
    },
    'character-sheet': {
        op: 'flowCharacterSheet', chain: ['flowCharacterSheetHeadless'],
        none: { ids: ['krea2'], graph: 'flow_character_sheet.json', chainGraph: ['flow_character_sheet_headless.json'], available: false, missing: ['krea2'] },
        all: { ids: ['krea2'], graph: 'flow_character_sheet.json', chainGraph: ['flow_character_sheet_headless.json'], available: true, missing: [] },
        last: { ids: ['krea2-nsfw'], graph: 'flow_character_sheet.json', chainGraph: ['flow_character_sheet_headless.json'], available: true, missing: [] },
    },
    'character-sheet-from-images': {
        op: 'flowCharacterSheetImages', chain: ['flowCharacterSheetHeadless'],
        none: { ids: ['qwen-image-2-1'], graph: 'flow_character_sheet_from_images.json', chainGraph: ['flow_character_sheet_headless.json'], available: false, missing: ['qwen-image-2-1'] },
        all: { ids: ['qwen-image-2-1'], graph: 'flow_character_sheet_from_images.json', chainGraph: ['flow_character_sheet_headless.json'], available: true, missing: [] },
        last: { ids: ['klein-9b'], graph: 'flow_character_sheet_from_images_klein.json', chainGraph: ['flow_character_sheet_headless.json'], available: true, missing: [] },
    },
    'outpaint': {
        op: 'flowOutpaint', chain: [],
        none: { ids: ['klein-9b'], graph: 'flow_outpaint.json', chainGraph: [], available: false, missing: ['klein-9b'] },
        all: { ids: ['klein-9b'], graph: 'flow_outpaint.json', chainGraph: [], available: true, missing: [] },
        last: { ids: ['klein-9b'], graph: 'flow_outpaint.json', chainGraph: [], available: true, missing: [] },
    },
    'voice-changer': {
        op: 'flowVoiceChanger', chain: [],
        none: { ids: [], graph: 'flow_voice_changer.json', chainGraph: [], available: false, missing: [] },
        all: { ids: [], graph: 'flow_voice_changer.json', chainGraph: [], available: false, missing: [] },
        last: { ids: [], graph: 'flow_voice_changer.json', chainGraph: [], available: false, missing: [] },
    },
    'stems': {
        op: 'flowStems', chain: [],
        none: { ids: [], graph: 'flow_stems.json', chainGraph: [], available: false, missing: [] },
        all: { ids: [], graph: 'flow_stems.json', chainGraph: [], available: false, missing: [] },
        last: { ids: [], graph: 'flow_stems.json', chainGraph: [], available: false, missing: [] },
    },
    'object-stamp': {
        op: 'flowObjectStamp', chain: [],
        none: { ids: ['klein-9b'], graph: 'flow_object_stamp.json', chainGraph: [], available: false, missing: ['klein-9b'] },
        all: { ids: ['klein-9b'], graph: 'flow_object_stamp.json', chainGraph: [], available: true, missing: [] },
        last: { ids: ['klein-9b'], graph: 'flow_object_stamp.json', chainGraph: [], available: true, missing: [] },
    },
    'minimax-music': {
        op: 'flowTextToMusic', chain: [],
        none: { ids: [], graph: 'flow_minimax_music.json', chainGraph: [], available: false, missing: [] },
        all: { ids: [], graph: 'flow_minimax_music.json', chainGraph: [], available: false, missing: [] },
        last: { ids: [], graph: 'flow_minimax_music.json', chainGraph: [], available: false, missing: [] },
    },
};

test('every shipped Flow resolves the op, graph and availability it did before the legs engine', async () => {
    const reg = await registry();
    const { getUniversalWorkflow } = await esm('js/data/modelRegistry.js');
    const flows = reg.listFlows();
    assert.deepStrictEqual(Object.keys(BEFORE).filter(id => !flows.some(f => f.id === id)), [],
        'a Flow in the table is gone: retire its row on purpose');

    for (const [id, want] of Object.entries(BEFORE)) {
        const flow = reg.getFlowById(id);
        const slots = reg.flowModelSlots(flow);
        const states = { none: [], all: slots.flatMap(s => s.models), last: slots.map(s => s.models[s.models.length - 1]) };

        assert.strictEqual(flow.operation, want.op, id);
        assert.deepStrictEqual(reg.flowLegs(flow).map(l => l.operation), want.chain, `${id}: chain ops`);
        assert.strictEqual(reg.flowOperation(flow, {}), want.op, `${id}: routed op`);
        assert.deepStrictEqual(reg.flowOperations(flow), [want.op, ...want.chain], `${id}: every op`);
        assert.ok(!slots.some(s => s.optional || s.for), `${id}: a shipped Flow declares no optional or per-op slot`);

        for (const [state, installed] of Object.entries(states)) {
            await stage(installed);
            const at = `${id} / ${state}`;
            const ids = reg.flowModelIds(flow);
            const availability = reg.flowAvailability(flow);

            assert.deepStrictEqual(ids, want[state].ids, `${at}: model ids`);
            assert.strictEqual(getUniversalWorkflow(flow.operation, ids), want[state].graph, `${at}: graph`);
            assert.deepStrictEqual(want.chain.map(op => getUniversalWorkflow(op, ids)), want[state].chainGraph, `${at}: chain graphs`);
            assert.strictEqual(availability.available, want[state].available, `${at}: available`);
            assert.deepStrictEqual(availability.missing, want[state].missing, `${at}: missing`);

            // The new per-op path agrees on every op the Flow can take: nothing is null-filled
            // when no slot declares `for`, so a leg gets exactly the ids it always got...
            for (const op of reg.flowOperations(flow)) {
                assert.deepStrictEqual(reg.flowModelIds(flow, { op }), ids, `${at}: ids for ${op}`);
                assert.deepStrictEqual(reg.flowModelParams(flow, { op }), reg.flowModelParams(flow), `${at}: params for ${op}`);
            }
            // ...and the run gate is the Flow gate.
            assert.deepStrictEqual(reg.flowRunAvailability(flow, {}), availability, `${at}: run availability`);
            assert.deepStrictEqual(reg.flowRunAvailability(flow, { injectionParams: { Input_Remove_Head: false } }), availability);
        }
    }
});

test('a shipped chain still runs leg 2 only while its toggle is on, defaulting to the declared value', async () => {
    const reg = await registry();
    for (const id of ['character-sheet', 'character-sheet-from-images']) {
        const flow = reg.getFlowById(id);
        const head = (r) => opsOf(reg.flowRunLegs(flow, r));
        assert.deepStrictEqual(head({}), [flow.operation, 'flowCharacterSheetHeadless'], `${id}: default on`);
        assert.deepStrictEqual(head({ injectionParams: { Input_Remove_Head: true } }), [flow.operation, 'flowCharacterSheetHeadless']);
        assert.deepStrictEqual(head({ injectionParams: { Input_Remove_Head: false } }), [flow.operation], `${id}: off`);
        assert.strictEqual(reg.flowToggleLeg(flow), 0, `${id}: the result pane still offers the toggle`);
    }
});
