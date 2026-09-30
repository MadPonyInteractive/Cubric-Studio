'use strict';
/**
 * tests/agent-routine-tool.test.cjs — the agent's `routine` tool (MPI-970 W2).
 *
 * Run: node --test tests/agent-routine-tool.test.cjs
 *
 * Fake engine, fake connector tools: the gates the LOOP owns. A save waits on app:routines
 * and is saved in the connector's words; a run is quoted first (a missing model refuses
 * with no card), asks the price ONCE, then is held like a slow generate and reports in ONE
 * `[Routine finished]` note. What the app does with the call is routineRunner's test.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const project = { folderPath: '/project', name: 'Test' };
const call = (id, args) => ({ toolCalls: [{ id, type: 'function', function: { name: 'routine', arguments: JSON.stringify(args) } }] });
const read = (id, kid) => ({ toolCalls: [{ id, type: 'function', function: { name: 'read_knowledge', arguments: JSON.stringify({ id: kid }) } }] });

function fakeTools(over = {}) {
    const calls = { save: [], quote: [], run: [], list: [], del: [] };
    return {
        calls,
        readKnowledge: async (id) => (id ? { ok: true, id, title: id, text: 'How to write a routine.' } : { ok: true, entries: [] }),
        listModels: async () => ({ ok: true, models: [], flows: [] }),
        placeAsset: async () => ({ success: true, filePath: '/project-file?path=%2Fproject%2FMedia%2Fstyle.png' }),
        listRoutines: async (folderPath, scope) => {
            calls.list.push({ folderPath, scope });
            return { ok: true, routines: [{ name: scope === 'global' ? 'everywhere' : 'here', summary: 's', steps: [], inputs: [] }] };
        },
        saveRoutine: async (folderPath, scope, routine) => {
            calls.save.push({ folderPath, scope, routine });
            return { ok: true, name: routine.name, created: true, summary: 'square-up — Square it' };
        },
        deleteRoutine: async (folderPath, scope, name) => { calls.del.push({ folderPath, scope, name }); return { ok: true, name, deleted: true }; },
        quoteRoutine: async (name, body) => {
            calls.quote.push({ name, body: structuredClone(body) });
            return { ok: true, output: { missing: [], billed: false, count: body.cards.length, usd: 0, display: null } };
        },
        runRoutine: async (name, body) => {
            calls.run.push({ name, body });
            return { ok: true, output: { ok: true, runId: 'r1', stackId: null, cards: [] } };
        },
        ...over,
    };
}

async function makeLoop(responses, tools) {
    const { AgentLoop } = await import('../services/agentLoop.mjs');
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    let i = 0;
    const loop = new AgentLoop({
        tools,
        resolveEndpoint: async () => ({ profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'https://api.deepinfra.com/v1/openai' }, key: 'k' }),
        lookupContextWindow: async () => 1_048_576,
    });
    const events = [];
    loop.addSubscriber({ write: (p) => {
        const m = /^event: (.+)\ndata: (.+)\n/.exec(p);
        if (m) events.push({ event: m[1], data: JSON.parse(m[2]) });
    } });
    const turn = async (text) => {
        const orig = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = async () => {
            const r = responses[i++] || { text: 'done' };
            return { text: r.text || '', toolCalls: r.toolCalls, usage: null };
        };
        try { await loop.runTurn(text, [], project, 'auto', 'deepinfra', 't1'); } finally { DeepInfraEngine.prototype.chat = orig; }
    };
    const results = () => loop._messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
    return { loop, events, turn, results };
}

async function until(pred, ms = 5000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        const v = pred();
        if (v) return v;
        await new Promise((r) => setTimeout(r, 10));
    }
    return null;
}

const SAVE = {
    action: 'save', name: 'square-up', summary: 'Square it and restyle it',
    steps: [
        { operation: 'crop', ratio: '1:1' },
        { modelId: 'klein-4b', operation: 'kleinEdit', ratio: '1:1', prompt: 'Make it {mood}', media: [{ role: 'inputImage2', input: 'style' }], wait: true },
    ],
    inputs: [{ id: 'style', kind: 'image' }, { id: 'mood', kind: 'text' }],
};

test('save waits on app:routines, then saves each step in the connector\'s words', async () => {
    const tools = fakeTools();
    const { turn, results } = await makeLoop([call('s1', SAVE), read('k1', 'app:routines'), call('s2', SAVE), { text: 'Saved.' }], tools);
    await turn('Save that as a routine');
    const [refused, readRes] = results();
    assert.equal(refused.error.code, 'KNOWLEDGE_NOT_READ');
    assert.match(readRes.next, /has NOT run\. Send it again now/);
    assert.equal(tools.calls.save.length, 1, 'only the save after the read reached the app');
    const { folderPath, scope, routine } = tools.calls.save[0];
    assert.equal(folderPath, '/project');
    assert.equal(scope, 'project');
    // crop's `ratio` is its own field; the model step's prompt is `positive`; `wait` is dropped.
    assert.deepEqual(routine.steps, [
        { operation: 'crop', fields: { ratio: '1:1' } },
        { modelId: 'klein-4b', operation: 'kleinEdit', positive: 'Make it {mood}', ratio: '1:1', media: [{ role: 'inputImage2', input: 'style' }] },
    ]);
    assert.deepEqual(routine.inputs, SAVE.inputs);
});

test('run with a missing model refuses by name: no spend card, nothing run', async () => {
    const tools = fakeTools({
        quoteRoutine: async () => ({ ok: true, output: { missing: ['Klein 4B'], billed: true, count: 2, usd: 0.1, display: 'about $0.10' } }),
    });
    const { turn, results, events } = await makeLoop([call('r1', { action: 'run', name: 'square-up', cards: ['g1', 'g2'] }), { text: 'Missing.' }], tools);
    await turn('Run square-up on these');
    assert.equal(results()[0].error.code, 'NOT_INSTALLED');
    assert.match(results()[0].error.message, /Klein 4B/);
    assert.equal(tools.calls.run.length, 0);
    assert.ok(!events.some((e) => e.event === 'agent:confirm'));
});

test('a billed run asks ONCE for every card, then runs held and leaves one finished note', async () => {
    let finish;
    const tools = fakeTools({
        quoteRoutine: async (name, body) => ({ ok: true, output: { missing: [], billed: true, count: body.cards.length, usd: 0.3, display: 'about $0.30' } }),
        runRoutine: (name, body) => {
            tools.calls.run.push({ name, body });
            return new Promise((r) => { finish = r; });
        },
    });
    const { loop, turn, results, events } = await makeLoop([
        call('r1', { action: 'run', name: 'square-up', cards: ['set:s1', 'g9'], values: { style: 'att_1', mood: 'stormy' } }),
        { text: 'Started.' },
    ], tools);
    // A dropped selection of two cards and an attached picture, as the chat hands them over.
    loop._images.set('ref-a', { path: '/project/Media/a.png', kind: 'result', groupId: 'g1' });
    loop._images.set('ref-b', { path: '/project/Media/b.png', kind: 'result', groupId: 'g2' });
    loop._images.set('att_1', { path: '/tmp/att_1.png', kind: 'attachment' });
    loop._sets.set('s1', ['ref-a', 'ref-b']);

    const running = turn('Run square-up on these');
    const ask = await until(() => events.find((e) => e.event === 'agent:confirm'));
    assert.equal(ask.data.kind, 'spend');
    assert.equal(ask.data.count, 3);
    assert.equal(ask.data.price, 'about $0.30');
    await loop.confirm(ask.data.confirmId, true);
    await running;

    assert.equal(events.filter((e) => e.event === 'agent:confirm').length, 1, 'one card for the whole run');
    assert.equal(tools.calls.run.length, 1);
    assert.deepEqual(tools.calls.run[0].body.cards, ['g1', 'g2', 'g9']);
    assert.deepEqual(tools.calls.run[0].body.inputs, { style: '/project-file?path=%2Fproject%2FMedia%2Fstyle.png', mood: 'stormy' });
    assert.equal(results()[0].started, true);
    assert.ok(!loop._notes.length, 'nothing to report until it finishes');

    finish({ ok: true, output: { ok: true, runId: 'r1', stackId: 'stk1', cards: [
        { inputGroupId: 'g1', groupId: 'n1', steps: 2 },
        { inputGroupId: 'g2', groupId: 'n2', steps: 1, skipped: [1] },
        { inputGroupId: 'g9', groupId: 'n3', steps: 1, failedAt: 2, error: { code: 'OOM', message: 'out of memory' } },
    ] } });
    const note = await until(() => loop._notes.find((n) => n.startsWith('[Routine finished')));
    assert.match(note, /"square-up" on 3 cards, 3 new cards in the new stack stk1\./);
    assert.match(note, /step 1 had nothing to do, skipped, on card g2\./);
    assert.match(note, /step 2 failed, OOM: out of memory, on card g9\./);
    assert.ok(await until(() => events.some((e) => e.event === 'agent:drained')), 'the finish wakes the chat');
    assert.ok(loop._groups.has('n3') && loop._groups.has('stk1'), 'the new cards can be named');
});

test('a No on the price runs nothing', async () => {
    const tools = fakeTools({
        quoteRoutine: async () => ({ ok: true, output: { missing: [], billed: true, count: 1, usd: 0.1, display: 'about $0.10' } }),
    });
    const { loop, turn, results, events } = await makeLoop([call('r1', { action: 'run', name: 'square-up', cards: ['g1'] }), { text: 'Ok.' }], tools);
    const running = turn('Run it');
    const ask = await until(() => events.find((e) => e.event === 'agent:confirm'));
    await loop.confirm(ask.data.confirmId, false);
    await running;
    assert.equal(results()[0].code, 'SPEND_DECLINED');
    assert.equal(tools.calls.run.length, 0);
});

test('a run finds a global routine when the model leaves scope out', async () => {
    const tools = fakeTools();
    const base = tools.quoteRoutine;
    tools.quoteRoutine = async (name, body) => (body.scope === 'global'
        ? base(name, body)
        : (tools.calls.quote.push({ name, body: structuredClone(body) }), { ok: false, error: { code: 'ROUTINE_NOT_FOUND', message: 'no' } }));
    const { turn } = await makeLoop([call('r1', { action: 'run', name: 'everywhere', cards: ['g1'] }), { text: 'Ok.' }], tools);
    await turn('Run everywhere');
    assert.deepEqual(tools.calls.quote.map((q) => q.body.scope), ['project', 'global']);
    assert.equal(tools.calls.run[0].body.scope, 'global');
});

test('list gives this project\'s routines and the global ones', async () => {
    const tools = fakeTools();
    const { turn, results } = await makeLoop([call('l1', { action: 'list' }), { text: 'Two.' }], tools);
    await turn('What routines do I have?');
    assert.deepEqual(results()[0].project.map((r) => r.name), ['here']);
    assert.deepEqual(results()[0].global.map((r) => r.name), ['everywhere']);
});

test('the tool says when to offer a routine (D7); the system prompt puts routines in "what can you do" (D12)', async () => {
    const { TOOL_DEFS } = await import('../services/agentLoop.mjs');
    assert.match(TOOL_DEFS.find((t) => t.function.name === 'routine').function.description, /repeats steps/);
    // D12 lives in the system prompt: in the tool description only, DeepSeek left it out 0/3 (B1).
    const { loop } = await makeLoop([], fakeTools());
    const system = await loop._buildSystemPrompt('auto');
    assert.match(system, /Routines rule: asked what you can do, name routines/);
    // F2 (Fabio, 2026-09-30): told "the app runs one", his agent said to run it himself.
    assert.match(system, /YOU run on any cards\. The app has no routine button; never tell the user to run one\./);
});
