// MPI-1156 Phase 3 - every place a run is built stamps what the child-safety gate reads:
// the words a person or an agent TYPED (`config.userWords`) and an age the app set
// (`config.minorAge`). Never a Flow's template text, its built prompt or a describer's prose.
//
//   prompt box     no stamp: `gateWords` reads its `positive`, which IS the typed box (child-safety.test.cjs)
//   Flow           flowService, from the FlowDef's visible text fields (`flowGateInputs`): hand, agent, routine
//   agent model    agentDispatch.buildGeneration: the prompt + any raw text param it sent (routine model steps too)
//   agent tool     agentDispatch.buildTool: its string fields (routine tool steps too)
//   scene path     scenePathVideo: the fill line (scene-path-video.test.cjs)

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));

const FLOW = {
    id: 'gate-edge', title: 'Gate edge', operation: 'flowGateEdge', mediaType: 'image',
    fields: [
        { id: 'positive', type: 'text', label: 'Prompt', default: '' },
        { id: 'Input_Who', type: 'text', label: 'Who', default: 'the person' },
        { id: 'negative', type: 'text', label: 'Avoid', default: '' },
        { id: 'Input_Mood', type: 'text', label: 'Mood', default: '', hidden: true },
        { id: 'Input_Age', type: 'slider', label: 'Age', min: -1, max: 100, default: -1, setsAge: true },
    ],
    describe: [{ to: 'Input_Kept', media: 'image1', ask: 'What is kept?' }],
};

test('flowGateInputs: visible typed fields and the positive; never a negative or a hidden field', async () => {
    const { flowGateInputs } = await esm('js/data/flowsRegistry.js');
    const run = { positive: 'a red coat', negative: 'nude', injectionParams: { Input_Mood: 'naked, by the Enhancer', Input_Age: 10 } };
    assert.deepEqual(flowGateInputs(FLOW, run), { userWords: ['a red coat', 'the person'], minorAge: 10 });
    assert.deepEqual(flowGateInputs(FLOW, { injectionParams: { Input_Age: -1 } }), { userWords: ['the person'] }, 'Keep is no age');
    assert.deepEqual(flowGateInputs(FLOW, { injectionParams: { Input_Age: 0 } }).minorAge, 0, 'a newborn is an age');
});

test('every shipped Flow: each visible text field reaches the gate, no negative and no hidden one does', async () => {
    const { FLOWS, flowGateInputs } = await esm('js/data/flowsRegistry.js');
    let checked = 0;
    for (const flow of FLOWS) {
        const fields = [...(flow.fields || []), ...(flow.steps || []).flatMap(s => s?.fields || [])].filter(f => f?.type === 'text');
        const run = { injectionParams: {} };
        for (const f of fields) (f.id.startsWith('Input_') ? run.injectionParams : run)[f.id] = `typed ${f.id}`;
        const { userWords } = flowGateInputs(flow, run);
        for (const f of fields) {
            const read = userWords.includes(`typed ${f.id}`);
            assert.equal(read, !f.hidden && !/negative/i.test(f.id), `${flow.id}.${f.id}`);
            checked += 1;
        }
    }
    assert.ok(checked >= 20, `${checked} text fields checked`);
    const editor = FLOWS.find(f => f.id === 'character-sheet-editor');
    assert.equal(flowGateInputs(editor, { injectionParams: { Input_Age: 10 } }).minorAge, 10, 'the Age slider sets the age');
});

test('a Clothes reference reaches the gate only when its clothes are applied (MPI-1156)', async () => {
    const { FLOWS, flowGateInputs } = await esm('js/data/flowsRegistry.js');
    const media = [{ role: 'image1', url: 'sheet.png' }, { role: 'image2', url: 'ref.png' }];
    const editor = FLOWS.find(f => f.id === 'character-sheet-editor');
    assert.deepEqual(flowGateInputs(editor, { change: 'clothes' }, media).clothesRefs, ['ref.png']);
    assert.equal(flowGateInputs(editor, { change: 'hair' }, media).clothesRefs, undefined, 'a hairstyle reference is not clothes');
    assert.equal(flowGateInputs(editor, { change: 'clothes' }, media.slice(0, 1)).clothesRefs, undefined, 'no reference picture');
    const videoEdit = FLOWS.find(f => f.id === 'video-edit');
    const pic = [{ role: 'video1', url: 'clip.mp4' }, { role: 'image1', url: 'outfit.png' }];
    assert.deepEqual(flowGateInputs(videoEdit, { injectionParams: { Input_Operation: 3 } }, pic).clothesRefs, ['outfit.png'], 'Change the outfit');
    assert.equal(flowGateInputs(videoEdit, { injectionParams: { Input_Operation: 1 } }, pic).clothesRefs, undefined, 'Swap the person');
    assert.ok(fs.readFileSync(repo('js/services/flowService.js'), 'utf8').includes('flowGateInputs(flow, run, mediaItems)'), 'flowService hands it the run\'s media');
});

test('submitFlowGeneration stamps the typed words and the age on every pass, never the describer\'s answer', async () => {
    const { submitFlowGeneration } = await esm('js/services/flowService.js');
    const queued = [];
    const io = {
        describe: async () => ({ ok: true, injectionParams: { Input_Kept: 'a naked monkey' } }),
        enqueue: (config, callbacks) => { queued.push({ config, callbacks }); return { queueJobId: `q${queued.length}` }; },
    };
    const tick = () => new Promise(r => setImmediate(r));
    submitFlowGeneration(FLOW, {
        positive: 'make it night', injectionParams: { Input_Age: 10 }, runByAgent: true,
        runMediaItems: [{ role: 'image1', url: 'a.png' }], runPass: { index: 1, count: 2 },
        runNextPass: async () => ({ media: [{ role: 'image1', url: 'b.png' }], last: true, runPass: { index: 2, count: 2 } }),
    }, {}, {}, io);
    await tick();
    await queued[0].callbacks.onComplete({ item: {} });
    await tick();
    assert.equal(queued.length, 2);
    for (const { config } of queued) {
        assert.equal(config.injectionParams.Input_Kept, 'a naked monkey', 'the describer still feeds the graph');
        assert.deepEqual([config.userWords, config.minorAge, config.byAgent], [['make it night', 'the person'], 10, true]);
    }
});

test('a hand-run Flow is not an agent\'s', async () => {
    const { submitFlowGeneration } = await esm('js/services/flowService.js');
    const queued = [];
    submitFlowGeneration({ ...FLOW, describe: [] }, { positive: 'x', runMediaItems: [] }, {}, {},
        { enqueue: (config) => { queued.push(config); return { queueJobId: 'q' }; } });
    assert.equal(queued[0].byAgent, undefined);
});

// agentDispatch reaches the live store and the queue, which bare Node cannot stand up: source contracts.
test('agent model, tool and Flow submits stamp what the agent wrote', () => {
    const src = fs.readFileSync(repo('js/shell/agentDispatch.js'), 'utf8');
    const gen = src.slice(src.indexOf('export async function buildGeneration('), src.indexOf('async function _submitTool('));
    assert.match(gen, /userWords: \[positive, \.\.\.Object\.entries\(owner\.injectionParams \|\| \{\}\)/);
    assert.match(gen, /!\/negative\/i\.test\(k\)/);
    const tool = src.slice(src.indexOf('export async function buildTool('), src.indexOf('export async function buildTool(') + 2000);
    assert.match(tool, /userWords: Object\.values\(fields\)\.filter\(v => typeof v === 'string'\)/);
    assert.match(src, /submitFlowGeneration\(built\.flow, \{ \.\.\.built\.inputs, runByAgent: true \}/);
    // A routine step builds through the same three (MPI-970).
    const routine = fs.readFileSync(repo('js/shell/routineDispatch.js'), 'utf8');
    for (const name of ['buildGeneration', 'buildTool', 'buildFlow']) assert.match(routine, new RegExp(`\\b${name}\\b`), name);
});
