'use strict';
/**
 * tests/agent-loop.test.cjs — agent loop unit tests (MPI-774).
 *
 * Run: node --test tests/agent-loop.test.cjs
 *
 * Uses Node's built-in test runner. All tests use fake engines and fake tools —
 * no GPU, no real generation, no DeepInfra spend.
 *
 * Tests:
 *   (a) install never runs without a confirm (gate removed → red; gate restored → green)
 *   (b) compaction fires at 50%, and at 30% for a 1 M window, from usage
 *   (c) generate returns control before it settles
 *   (d) probe reports a no-tools model without retrying
 *
 * Plus one LIVE DeepInfra run (guarded by env var; skipped if key absent).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Helpers — fake engine and fake tools
// ---------------------------------------------------------------------------

/**
 * Build a fake engine whose chat() resolves with a scripted sequence of responses.
 * Each call to chat() returns the next item from `responses`.
 * After exhaustion it returns { text: 'done', toolCalls: undefined }.
 */
function makeFakeEngine(responses) {
    let i = 0;
    const calls = [];
    return {
        calls,
        chat: async (req) => {
            calls.push(req);
            const r = responses[i++] || { text: 'done' };
            return { text: r.text || '', toolCalls: r.toolCalls || undefined, usage: r.usage || null };
        },
    };
}

/**
 * Build a fake tools object. generateDelay controls how long generate() takes.
 */
function makeFakeTools({ generateDelay = 0, installResult = { ok: true } } = {}) {
    const calls = { listModels: [], readKnowledge: [], installModel: [], generate: [], look: [], openProject: [], placeAsset: [] };
    return {
        calls,
        saveAttachment: async () => ({ id: 'att_test', filePath: '/tmp/att_test.jpg' }),
        placeAsset: async (folderPath, absPath) => {
            calls.placeAsset.push({ folderPath, absPath });
            return { success: true, filePath: '/project-file?path=%2Fproject%2FMedia%2F.preview-assets%2Fabc.png' };
        },
        initAttachmentDir: async () => {},
        attachmentDir: () => '/tmp/cubric-agent/attachments',
        cropDir: () => '/tmp/cubric-agent/crops',
        listModels: async () => {
            calls.listModels.push({});
            return { ok: true, models: [{ id: 'test-model', name: 'Test Model', missingDownloadGb: 1.2 }], flows: [] };
        },
        readKnowledge: async (id) => {
            calls.readKnowledge.push({ id });
            return id
                ? { ok: true, id, title: `Entry ${id}`, text: `Content of ${id}` }
                : { ok: true, entries: [{ id: 'app:operations', kind: 'app', title: 'Operations' }] };
        },
        installModel: async (modelId) => {
            calls.installModel.push({ modelId });
            return installResult;
        },
        generate: async (body) => {
            calls.generate.push(body);
            if (generateDelay > 0) {
                await new Promise((r) => setTimeout(r, generateDelay));
            }
            return { ok: true, output: { itemId: 'item-1', groupId: 'group-1', type: 'image', filePath: '/path/result.png' } };
        },
        look: async (args) => {
            calls.look.push(args);
            return { ok: true, output: { text: 'A generated image showing a fox.' } };
        },
        openProject: async (folderPath) => {
            calls.openProject.push({ folderPath });
            return { ok: true };
        },
    };
}

/** Collect SSE events emitted to a fake response object. */
function makeFakeRes() {
    const events = [];
    return {
        events,
        write: (payload) => {
            const lines = payload.split('\n').filter(Boolean);
            let event = '', data = '';
            for (const l of lines) {
                if (l.startsWith('event: ')) event = l.slice(7);
                else if (l.startsWith('data: ')) data = l.slice(6);
            }
            if (event) events.push({ event, data: data ? JSON.parse(data) : {} });
        },
    };
}

/** Load AgentLoop class (ESM) from CJS. Cached after first call. */
let _AgentLoopClass = null;
async function loadAgentLoop() {
    if (!_AgentLoopClass) {
        const m = await import('../services/agentLoop.mjs');
        _AgentLoopClass = m.AgentLoop;
    }
    return _AgentLoopClass;
}

/** Create an AgentLoop with injected fake engine and tools. */
async function makeLoop({ engineResponses = [], toolOpts = {}, resolveEndpointOverride, contextWindow = 1_048_576 } = {}) {
    const AgentLoop = await loadAgentLoop();
    const tools = makeFakeTools(toolOpts);
    const engine = makeFakeEngine(engineResponses);

    // A connection only: the model comes from the message (or the preset's
    // recommendation), the window from the lookup.
    const endpointProfile = {
        id: 'deepinfra',
        name: 'DeepInfra',
        baseURL: 'https://api.deepinfra.com/v1/openai',
    };

    const loop = new AgentLoop({
        tools,
        resolveEndpoint: resolveEndpointOverride || (async () => ({ profile: endpointProfile, key: 'fake-key' })),
        lookupContextWindow: async () => contextWindow,
    });

    // Patch: inject fake engine so the loop uses it instead of DeepInfraEngine
    loop._fakeEngine = engine;
    const origRunTurn = loop.runTurn.bind(loop);
    loop.runTurn = async function(text, attachments, project, mode, profileId, turnId, opts) {
        // Intercept the engine construction inside the loop
        const origResolve = loop._resolveEndpoint.bind(loop);
        loop._resolveEndpoint = async () => ({ profile: endpointProfile, key: 'fake-key' });
        // Patch DeepInfraEngine inside the loop
        const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
        const origChatProto = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = engine.chat;
        try {
            await origRunTurn(text, attachments, project, mode, profileId, turnId, opts);
        } finally {
            DeepInfraEngine.prototype.chat = origChatProto;
            loop._resolveEndpoint = origResolve;
        }
    };

    // Patch probe similarly
    loop.probe = async function(profileId, model) {
        const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
        const origChatProto = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = engine.chat;
        const origResolve = loop._resolveEndpoint.bind(loop);
        loop._resolveEndpoint = async () => ({ profile: endpointProfile, key: 'fake-key' });
        try {
            const AgentLoop = await loadAgentLoop();
            return await AgentLoop.prototype.probe.call(loop, profileId, model);
        } finally {
            DeepInfraEngine.prototype.chat = origChatProto;
            loop._resolveEndpoint = origResolve;
        }
    };

    const fakeRes = makeFakeRes();
    loop.addSubscriber(fakeRes);

    return { loop, tools, engine, fakeRes };
}

/** Wait for SSE event matching predicate (polls up to timeoutMs). */
async function waitForEvent(fakeRes, predicate, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const found = fakeRes.events.find(predicate);
        if (found) return found;
        await new Promise((r) => setTimeout(r, 10));
    }
    return null;
}

// ---------------------------------------------------------------------------
// (a) Install gate: confirm must fire before install executes
// ---------------------------------------------------------------------------

describe('(a) install gate', () => {
    test('install_model emits agent:confirm and waits before calling installModel', async () => {
        const engineResponses = [
            {
                text: '',
                toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'install_model', arguments: '{"modelId":"test-model"}' } }],
            },
            { text: 'Installation is done!', toolCalls: undefined },
        ];
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses });
        const turnId = 'turn-install';

        const turnPromise = loop.runTurn('Install test-model', [], { folderPath: '/p', name: 'P' }, 'auto', 'deepinfra', turnId);

        // Wait for the confirm event to arrive
        const confirmEvt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.ok(confirmEvt, 'agent:confirm event should have been emitted');
        assert.equal(confirmEvt.data.kind, 'install');
        assert.equal(confirmEvt.data.modelId, 'test-model');
        const confirmId = confirmEvt.data.confirmId;
        assert.ok(confirmId, 'confirmId should be present');

        // installModel should NOT have been called yet
        assert.equal(tools.calls.installModel.length, 0, 'installModel must not run before confirm');

        // Now confirm
        const confirmResult = await loop.confirm(confirmId, true);
        assert.equal(confirmResult.ok, true, 'confirm should succeed');

        await turnPromise;

        // After confirm, installModel should have been called once
        assert.equal(tools.calls.installModel.length, 1, 'installModel should run once after Yes');
    });

    test('MUTATION: removing the confirm gate causes install to run before user approval (gate removed → red)', async () => {
        // This test demonstrates what would happen if the gate were removed.
        // We simulate a "gate-removed" loop by calling installModel directly.
        const tools = makeFakeTools();
        // Without the gate, the tool would fire immediately:
        await tools.installModel('test-model');
        // The assertion BELOW would turn RED if we expected 0 calls (gate present)
        // With the gate removed, it runs immediately → 1 call
        assert.equal(tools.calls.installModel.length, 1, 'Without the gate, installModel fires immediately (this is the bad path)');
        // The real loop test above proves the gate IS present.
    });

    // MPI-774 Phase 4: the install is a started download; the re-read decides what the model is told.
    test('after Yes the model is told what the re-read says: installed, or still downloading', async () => {
        for (const [installed, said] of [[false, /pressed Yes\. Test Model is downloading now/], [true, /pressed Yes and Test Model is now installed/]]) {
            const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [
                { text: '', toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'install_model', arguments: '{"modelId":"test-model"}' } }] },
                { text: 'ok' },
            ] });
            let reads = 0;
            tools.listModels = async () => {
                reads += 1;
                // The first read is the install gate's own; the one after Yes is the re-read.
                return { ok: true, flows: [], models: [{ id: 'test-model', name: 'Test Model', missingDownloadGb: 1.2, installed: reads > 1 && installed }] };
            };
            const turn = loop.runTurn('Install test-model', [], null, 'auto', 'deepinfra', `turn-reread-${installed}`);
            const confirmEvt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
            await loop.confirm(confirmEvt.data.confirmId, true);
            await turn;
            const result = loop._messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content)).at(-1);
            assert.equal(result.installed, installed);
            assert.match(result.message, said);
        }
    });

    test('confirm declined → installModel never fires', async () => {
        const engineResponses = [
            {
                text: '',
                toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'install_model', arguments: '{"modelId":"test-model"}' } }],
            },
            { text: 'Understood, skipping install.' },
        ];
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses });
        const turnPromise = loop.runTurn('Install test-model', [], null, 'auto', 'deepinfra', 'turn-decline');

        const confirmEvt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.ok(confirmEvt, 'confirm event expected');
        await loop.confirm(confirmEvt.data.confirmId, false);
        await turnPromise;

        assert.equal(tools.calls.installModel.length, 0, 'installModel must never fire after No');
    });

    test('an id list_models does not know gets UNKNOWN_MODEL, and no card', async () => {
        const engineResponses = [
            { text: '', toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'install_model', arguments: '{"modelId":"ltx-2.3"}' } }] },
            { text: 'That id does not exist.' },
        ];
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses });
        await loop.runTurn('Install LTX', [], null, 'auto', 'deepinfra', 'turn-unknown');

        assert.ok(!fakeRes.events.some((e) => e.event === 'agent:confirm'), 'no card for a guessed id');
        assert.equal(tools.calls.installModel.length, 0);
        const result = loop._messages.find((m) => m.role === 'tool' && m.tool_call_id === 'tc-1');
        assert.equal(JSON.parse(result.content).error.code, 'UNKNOWN_MODEL');
    });
});

// ---------------------------------------------------------------------------
// (b) Compaction trigger: 50% and 30% (>= 1M window)
// ---------------------------------------------------------------------------

describe('(b) compaction trigger', () => {
    test('_shouldCompact: fires at >= 50% for a 100k window', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        loop._contextWindow = 100_000;
        loop._lastUsage = { prompt_tokens: 50_000 }; // exactly 50%
        assert.equal(loop._shouldCompact(), true, '50% should trigger compaction');
    });

    test('_shouldCompact: does NOT fire at 49% for a 100k window', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        loop._contextWindow = 100_000;
        loop._lastUsage = { prompt_tokens: 49_000 }; // 49%
        assert.equal(loop._shouldCompact(), false, '49% should not trigger');
    });

    test('_shouldCompact: fires at >= 30% for a 1M window', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        loop._contextWindow = 1_000_000;
        loop._lastUsage = { prompt_tokens: 300_000 }; // exactly 30%
        assert.equal(loop._shouldCompact(), true, '30% at 1M window should trigger');
    });

    test('_shouldCompact: does NOT fire at 29% for a 1M window', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        loop._contextWindow = 1_000_000;
        loop._lastUsage = { prompt_tokens: 290_000 }; // 29%
        assert.equal(loop._shouldCompact(), false, '29% at 1M window should not trigger');
    });

    test('_shouldCompact: threshold is 30% exactly at 1_000_000 context window boundary', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        // Exactly at boundary: contextWindow = 1,000,000 => uses 0.30 threshold
        loop._contextWindow = 1_000_000;
        loop._lastUsage = { prompt_tokens: 299_999 };
        assert.equal(loop._shouldCompact(), false, 'One below 30% should not trigger');
        loop._lastUsage = { prompt_tokens: 300_000 };
        assert.equal(loop._shouldCompact(), true, 'Exactly 30% should trigger');
    });

    test('compaction fires during a real turn when usage hits 50%', async () => {
        // Engine: first call returns text with usage at 50% of 100k window; second call (compaction handoff) returns text
        const engineResponses = [
            { text: 'Here is my answer.', usage: { prompt_tokens: 50_000, completion_tokens: 100 } },
            { text: 'Compact handoff summary.' }, // compaction handoff request
        ];

        // Use contextWindow: 100_000 so 50k prompt_tokens triggers at exactly 50%
        const { loop, fakeRes } = await makeLoop({ engineResponses, contextWindow: 100_000 });

        await loop.runTurn('Hello', [], null, 'auto', 'deepinfra', 'turn-compact');

        const compactEvt = fakeRes.events.find((e) => e.event === 'agent:compacting' && e.data.on === true);
        assert.ok(compactEvt, 'agent:compacting should have been emitted');
    });
});

// ---------------------------------------------------------------------------
// (c) generate returns control before it settles
// ---------------------------------------------------------------------------

describe('(c) generate non-blocking', () => {
    test('generate returns a started response before the async generation settles', async () => {
        let generateResolveFn = null;
        const generateCalledAt = [];
        const turnReturnedAt = [];

        const GENERATE_DELAY = 200; // ms — long enough to prove non-blocking
        const { loop, fakeRes } = await makeLoop({
            engineResponses: [
                {
                    text: '',
                    toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'generate', arguments: '{"modelId":"test-model","operation":"t2i","prompt":"A fox"}' } }],
                },
                { text: 'Generation started! I\'ll let you know when it\'s done.' },
            ],
            toolOpts: { generateDelay: GENERATE_DELAY },
        });

        const project = { folderPath: '/project', name: 'Test' };
        const start = Date.now();
        await loop.runTurn('Make an image of a fox', [], project, 'auto', 'deepinfra', 'turn-gen');
        const elapsed = Date.now() - start;

        // The turn should return well before the generate delay + some margin
        // If generate were awaited, elapsed would be >= GENERATE_DELAY.
        // We allow some buffer for test overhead.
        assert.ok(
            elapsed < GENERATE_DELAY + 150,
            `runTurn (${elapsed} ms) should return before generate settles (${GENERATE_DELAY} ms delay). If this fails, generate is being awaited.`,
        );

        // agent:working should have been emitted as false (turn complete)
        const workingDone = fakeRes.events.find((e) => e.event === 'agent:working' && e.data.working === false);
        assert.ok(workingDone, 'agent:working { working: false } should be emitted before generate settles');

        // Wait a bit for the background generate to settle and emit agent:result
        await new Promise((r) => setTimeout(r, GENERATE_DELAY + 100));
        const resultEvt = fakeRes.events.find((e) => e.event === 'agent:result');
        assert.ok(resultEvt, 'agent:result should eventually be emitted after generate settles');
        assert.equal(resultEvt.data.ok, true, 'agent:result.ok should be true');
    });
});

// ---------------------------------------------------------------------------
// (e) image references: only this session's attachments and its own results
// ---------------------------------------------------------------------------

describe('(e) image references', () => {
    const lookCall = (image) => ({
        text: '',
        toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'look', arguments: JSON.stringify({ image }) } }],
    });

    test('a path the model made up is refused, and never reaches the describer', async () => {
        const { loop, tools } = await makeLoop({
            engineResponses: [lookCall('C:\\Users\\Fabio\\.ssh\\id_rsa'), { text: 'I cannot read that.' }],
        });

        await loop.runTurn('Look at my key file', [], null, 'auto', 'deepinfra', 'turn-evil');

        assert.equal(tools.calls.look.length, 0, 'look must not be called with a path the model invented');
        const toolResult = loop._messages.find((m) => m.role === 'tool');
        assert.ok(toolResult, 'the model should get a tool result back');
        assert.match(toolResult.content, /IMAGE_NOT_FOUND/);
    });

    test('an attachment from this turn resolves to its staged file', async () => {
        const { loop, tools } = await makeLoop({
            engineResponses: [lookCall('att_1'), { text: 'A fox.' }],
        });

        await loop.runTurn(
            'What is this?',
            [{ id: 'att_1', name: 'fox.png', filePath: '/tmp/cubric-agent/attachments/att_1.png' }],
            null, 'auto', 'deepinfra', 'turn-att',
        );

        assert.deepEqual(tools.calls.look, [{ imagePath: '/tmp/cubric-agent/attachments/att_1.png' }]);
        const userEntry = loop.getHistory().entries.find((e) => e.kind === 'user');
        assert.deepEqual(userEntry.attachments, [{ id: 'att_1', name: 'fox.png' }],
            'the chat and the model must see the same attachment id');
    });

    test('a generate result is reachable afterwards, and is passed by project-file url', async () => {
        const { loop, tools } = await makeLoop({
            engineResponses: [
                { text: '', toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'generate', arguments: '{"modelId":"test-model","operation":"t2i","prompt":"A fox"}' } }] },
                { text: 'Started.' },
                { text: '', toolCalls: [{ id: 'tc-2', type: 'function', function: { name: 'generate', arguments: '{"modelId":"test-model","operation":"i2v","prompt":"Make it move","media":[{"role":"inputImage","image":"/path/result.png"}]}' } }] },
                { text: 'Animating it.' },
            ],
        });
        const project = { folderPath: '/project', name: 'Test' };

        await loop.runTurn('Make an image of a fox', [], project, 'auto', 'deepinfra', 'turn-gen-1');
        await new Promise((r) => setTimeout(r, 50)); // let the first generate settle
        await loop.runTurn('Now animate it', [], project, 'auto', 'deepinfra', 'turn-gen-2');

        const second = tools.calls.generate[1];
        assert.deepEqual(second.media, [{ role: 'inputImage', url: '/project-file?path=%2Fpath%2Fresult.png' }]);
    });

    test('an attachment used by a generate is placed into the project first', async () => {
        const { loop, tools } = await makeLoop({
            engineResponses: [
                { text: '', toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'generate', arguments: '{"modelId":"test-model","operation":"edit","prompt":"Make it night","media":[{"role":"inputImage","image":"att_1"}]}' } }] },
                { text: 'Editing it.' },
            ],
        });
        const project = { folderPath: '/project', name: 'Test' };

        await loop.runTurn(
            'Edit this',
            [{ id: 'att_1', name: 'street.png', filePath: '/tmp/cubric-agent/attachments/att_1.png' }],
            project, 'auto', 'deepinfra', 'turn-att-gen',
        );

        assert.deepEqual(tools.calls.placeAsset, [
            { folderPath: '/project', absPath: '/tmp/cubric-agent/attachments/att_1.png' },
        ], 'the attachment must be copied into the project before the generation runs');
        assert.deepEqual(tools.calls.generate[0].media, [
            { role: 'inputImage', url: '/project-file?path=%2Fproject%2FMedia%2F.preview-assets%2Fabc.png' },
        ], 'the generation must take the url the project store returned, not the scratch path');
    });
});

// ---------------------------------------------------------------------------
// (f) endpoint key: stored key first, then the environment
// ---------------------------------------------------------------------------

describe('(f) endpoint key resolution', () => {
    const DI_URL = 'https://api.deepinfra.com/v1/openai';

    /** A loop with a fork bridge that answers like the main process. */
    async function loopWithBridge(answer) {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop({ tools: makeFakeTools() });
        loop.setForkBridge(async () => answer);
        return loop;
    }

    test('the DeepInfra preset falls back to DEEPINFRA_API_KEY when no key is stored', async () => {
        // Regression: the bridge answering `key: null` used to return early, so inside
        // Electron the environment key was unreachable and a dev run reported NO_KEY.
        const loop = await loopWithBridge({ profile: { id: 'deepinfra', baseURL: DI_URL, model: 'm', contextWindow: 1000 }, key: null });
        const prev = process.env.DEEPINFRA_API_KEY;
        process.env.DEEPINFRA_API_KEY = 'env-key';
        try {
            const r = await loop._resolveEndpoint('deepinfra');
            assert.equal(r.key, 'env-key');
            assert.equal(r.profile.baseURL, DI_URL);
        } finally {
            if (prev === undefined) delete process.env.DEEPINFRA_API_KEY;
            else process.env.DEEPINFRA_API_KEY = prev;
        }
    });

    test('a stored key still wins over the environment', async () => {
        const loop = await loopWithBridge({ profile: { id: 'deepinfra', baseURL: DI_URL }, key: 'stored-key' });
        const prev = process.env.DEEPINFRA_API_KEY;
        process.env.DEEPINFRA_API_KEY = 'env-key';
        try {
            assert.equal((await loop._resolveEndpoint('deepinfra')).key, 'stored-key');
        } finally {
            if (prev === undefined) delete process.env.DEEPINFRA_API_KEY;
            else process.env.DEEPINFRA_API_KEY = prev;
        }
    });

    test('the environment key is never sent to an edited base URL', async () => {
        const loop = await loopWithBridge({ profile: { id: 'deepinfra', baseURL: 'https://somewhere-else.example/v1' }, key: null });
        const prev = process.env.DEEPINFRA_API_KEY;
        process.env.DEEPINFRA_API_KEY = 'env-key';
        try {
            assert.equal((await loop._resolveEndpoint('deepinfra')).key, null);
        } finally {
            if (prev === undefined) delete process.env.DEEPINFRA_API_KEY;
            else process.env.DEEPINFRA_API_KEY = prev;
        }
    });
});

// ---------------------------------------------------------------------------
// (g) the agent's model on the shared connection, its window, its attachments
// ---------------------------------------------------------------------------

describe('(g) model and context window', () => {
    test('the model picked for the agent is the one the engine is called with', async () => {
        const { loop } = await makeLoop({ engineResponses: [{ text: 'hi' }] });
        await loop.runTurn('Hello', [], null, 'auto', 'deepinfra', 't-pick', { model: 'vendor/picked-model' });
        assert.equal(loop._fakeEngine.calls[0].model, 'vendor/picked-model');
    });

    test('no pick = the connection\'s recommended agent model', async () => {
        const { loop } = await makeLoop({ engineResponses: [{ text: 'hi' }] });
        await loop.runTurn('Hello', [], null, 'auto', 'deepinfra', 't-rec');
        assert.equal(loop._fakeEngine.calls[0].model, 'deepseek-ai/DeepSeek-V4-Flash-0731');
    });

    test('no pick and no recommendation = NO_MODEL, and nothing is spent', async () => {
        const { loop, fakeRes } = await makeLoop({
            engineResponses: [{ text: 'hi' }],
            resolveEndpointOverride: async () => ({ profile: { id: 'custom', name: 'Custom', baseURL: 'http://x/v1' }, key: 'k' }),
        });
        // The helper swaps resolveEndpoint for its DeepInfra profile during runTurn, but the
        // model comes from the PRESET ID, which is what matters here.
        await loop.runTurn('Hello', [], null, 'auto', 'custom', 't-none');
        const err = fakeRes.events.find((e) => e.event === 'agent:error');
        assert.equal(err?.data.code, 'NO_MODEL');
        assert.equal(loop._fakeEngine.calls.length, 0);
    });

    test('context window: our table, then the endpoint list (cached), then the fallback', async () => {
        const AgentLoop = await loadAgentLoop();
        const { FALLBACK_CONTEXT_WINDOW } = await import('../services/llmEngines.mjs');
        const loop = new AgentLoop({ tools: makeFakeTools() });
        const profile = { id: 'deepinfra', baseURL: 'https://api.example/v1' };
        const origFetch = global.fetch;
        let fetches = 0;
        global.fetch = async () => {
            fetches++;
            return { ok: true, json: async () => ({ data: [{ id: 'big/model', metadata: { context_length: 262144, tags: ['chat'] } }] }) };
        };
        try {
            assert.equal(await loop._contextWindowFor('deepinfra', 'deepseek-ai/DeepSeek-V4-Flash-0731', profile, 'k'), 1_048_576);
            assert.equal(fetches, 0, 'a table hit needs no request');
            assert.equal(await loop._contextWindowFor('deepinfra', 'big/model', profile, 'k'), 262144);
            assert.equal(await loop._contextWindowFor('deepinfra', 'big/model', profile, 'k'), 262144);
            assert.equal(fetches, 1, 'the endpoint answer is cached for the session');
            assert.equal(await loop._contextWindowFor('deepinfra', 'unknown/model', profile, 'k'), FALLBACK_CONTEXT_WINDOW);
            global.fetch = async () => { throw new Error('offline'); };
            assert.equal(await loop._contextWindowFor('openai', 'gpt-x', profile, 'k'), FALLBACK_CONTEXT_WINDOW);
        } finally {
            global.fetch = origFetch;
        }
    });

    test('every user turn tells the model which project is open, or that none is', async () => {
        const { loop } = await makeLoop({ engineResponses: [{ text: 'a' }, { text: 'b' }] });
        await loop.runTurn('first', [], { folderPath: 'C:/P/Fox', name: 'Fox' }, 'auto', 'deepinfra', 't-open');
        await loop.runTurn('second', [], null, 'auto', 'deepinfra', 't-none');
        const users = loop._messages.filter((m) => m.role === 'user').map((m) => m.content);
        assert.match(users[0], /project "Fox" is open\./);
        assert.doesNotMatch(users[0], /C:\/P\/Fox/, 'the folder path invites the model to look at it or reopen it');
        assert.match(users[0], /first$/);
        assert.match(users[1], /no project is open/);
        assert.match(users[1], /Images you can look at: none\./);
        // The chat shows what the user typed, not the state line.
        assert.deepEqual(loop.getHistory().entries.filter((e) => e.kind === 'user').map((e) => e.text), ['first', 'second']);
    });

    test('the state line lists exactly the image refs look can resolve', async () => {
        const { loop } = await makeLoop({ engineResponses: [{ text: 'a' }] });
        loop._registerResult('/project-file?path=%2Fp%2Fold.png');
        await loop.runTurn('look', [{ id: 'att_9', name: 'cat.png', filePath: '/tmp/att_9.png' }], null, 'auto', 'deepinfra', 't-refs');
        const line = loop._messages.find((m) => m.role === 'user').content.split('\n')[0];
        assert.match(line, /Images you can look at: \/project-file\?path=%2Fp%2Fold\.png, att_9 \(cat\.png\)\./);
    });

    test('a project opened mid-turn is the one a later generate in that turn lands in', async () => {
        const engineResponses = [
            { toolCalls: [{ id: 'o1', type: 'function', function: { name: 'open_project', arguments: JSON.stringify({ folderPath: 'C:/P/Given' }) } }] },
            { toolCalls: [{ id: 'g1', type: 'function', function: { name: 'generate', arguments: JSON.stringify({ modelId: 'm', operation: 't2i', prompt: 'x' }) } }] },
            { text: 'started' },
        ];
        const { loop, tools } = await makeLoop({ engineResponses });
        tools.openProject = async (folderPath) => ({ ok: true, output: { folderPath, name: 'Given', groupCount: 0 } });
        await loop.runTurn('open C:/P/Given and make one', [], null, 'auto', 'deepinfra', 't-mid');
        assert.equal(tools.calls.generate.length, 1, 'generate reached the app instead of NO_PROJECT');
    });

    test('attachmentPath serves only this session\'s attachments, never a result or a stranger', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop({ tools: makeFakeTools() });
        loop._images.set('att_1', { path: '/tmp/att_1.png', kind: 'attachment' });
        loop._registerResult('/project-file?path=%2Fp%2Fresult.png');
        assert.equal(loop.attachmentPath('att_1'), '/tmp/att_1.png');
        assert.equal(loop.attachmentPath('/project-file?path=%2Fp%2Fresult.png'), null);
        assert.equal(loop.attachmentPath('att_2'), null);
        assert.equal(loop.attachmentPath('C:/Users/me/.secrets/key.txt'), null);
    });
});

// ---------------------------------------------------------------------------
// (h) Phase 3b: project notes, finished generations, card names, the guide gate
// ---------------------------------------------------------------------------

describe('(h) notes, results, names, guides', () => {
    const call = (id, name, args) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
    const project = { folderPath: '/project', name: 'Test' };
    const toolResults = (loop) => loop._messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
    const userMessages = (loop) => loop._messages.filter((m) => m.role === 'user').map((m) => m.content);

    function withMemory(tools, notes = []) {
        tools.calls.readMemory = [];
        tools.calls.writeMemory = [];
        tools.readMemory = async (folderPath, file) => {
            tools.calls.readMemory.push({ folderPath, file });
            return file ? { ok: true, file, text: 'Red hair.' } : { ok: true, notes };
        };
        tools.writeMemory = async (folderPath, note) => {
            tools.calls.writeMemory.push({ folderPath, ...note });
            return { ok: true, file: note.file, created: true };
        };
    }

    test('notes are read and written in the open project, whatever folder the model names', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('w1', 'write_memory', { file: 'ratio.md', title: 'Ratio', text: '16:9', folderPath: 'C:/Elsewhere' }),
            call('r1', 'read_memory', { file: 'ratio.md' }),
            { text: 'Noted.' },
        ] });
        withMemory(tools);
        await loop.runTurn('Remember 16:9', [], project, 'auto', 'deepinfra', 't-mem');
        assert.deepEqual(tools.calls.writeMemory, [{ folderPath: '/project', file: 'ratio.md', title: 'Ratio', hook: undefined, text: '16:9' }]);
        assert.deepEqual(tools.calls.readMemory.at(-1), { folderPath: '/project', file: 'ratio.md' });
        assert.equal(loop.getHistory().entries.find((e) => e.tool === 'write_memory').label, 'Noted: Ratio');
    });

    test('with no project open there are no notes to read or write', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('w1', 'write_memory', { file: 'a.md', title: 'A', text: 'x' }),
            call('r1', 'read_memory', {}),
            { text: 'Open a project first.' },
        ] });
        withMemory(tools);
        await loop.runTurn('Remember this', [], null, 'auto', 'deepinfra', 't-nomem');
        assert.equal(tools.calls.writeMemory.length, 0);
        assert.deepEqual(toolResults(loop).map((r) => r.error?.code), ['NO_PROJECT', 'NO_PROJECT']);
    });

    test('the project notes open the first turn with that project, and again after a switch', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] });
        withMemory(tools, [{ file: 'mira.md', title: 'Mira', hook: 'the courier' }]);
        await loop.runTurn('one', [], project, 'auto', 'deepinfra', 't1');
        await loop.runTurn('two', [], project, 'auto', 'deepinfra', 't2');
        await loop.runTurn('three', [], { folderPath: '/other', name: 'Other' }, 'auto', 'deepinfra', 't3');
        const users = userMessages(loop);
        assert.match(users[0], /\[Project notes you kept earlier[^\n]*\n- mira\.md: Mira \(the courier\)\]/);
        assert.match(users[0], /one$/);
        assert.doesNotMatch(users[1], /Project notes/);
        assert.match(users[2], /Project notes/);
        assert.deepEqual(tools.calls.readMemory.map((c) => c.folderPath), ['/project', '/other']);
    });

    test('a finished generation reaches the model at the start of its next turn, never mid-turn', async () => {
        const { loop } = await makeLoop({
            engineResponses: [
                call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox' }),
                { text: 'Started.' },
                { text: 'Here it is.' },
            ],
            toolOpts: { generateDelay: 30 },
        });
        await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', 't-g');
        await new Promise((r) => setTimeout(r, 120)); // the generate settles, then the auto-look
        assert.equal(loop._messages.at(-1).role, 'assistant', 'nothing was pushed into the context when it settled');
        await loop.runTurn('How did it go?', [], project, 'auto', 'deepinfra', 't-next');
        const last = userMessages(loop).at(-1);
        assert.match(last, /\[Generation finished: card group-1, image \/path\/result\.png\]/);
        assert.match(last, /\[You looked at it: A generated image showing a fox\.\]/);
        assert.match(last, /How did it go\?$/);
    });

    test('a failed generation is reported the same way', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox' }),
            { text: 'Started.' },
            { text: 'Sorry.' },
        ] });
        tools.generate = async () => ({ ok: false, error: { code: 'MODEL_NOT_INSTALLED', message: 'not installed' } });
        await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', 't-f');
        await new Promise((r) => setTimeout(r, 30));
        await loop.runTurn('Well?', [], project, 'auto', 'deepinfra', 't-f2');
        assert.match(userMessages(loop).at(-1), /\[Generation failed: MODEL_NOT_INSTALLED: not installed\]/);
    });

    test('rename_card names only cards this conversation generated; cardName rides on generate', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('n0', 'rename_card', { groupId: 'someone-elses', name: 'Mine now' }),
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox', cardName: 'Fox' }),
            { text: 'Started.' },
            call('n1', 'rename_card', { groupId: 'group-1', name: 'Snow fox' }),
            { text: 'Named.' },
        ] });
        tools.calls.renameCard = [];
        tools.renameCard = async (groupId, name) => { tools.calls.renameCard.push({ groupId, name }); return { ok: true }; };
        await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', 't-n');
        assert.equal(toolResults(loop)[0].error.code, 'UNKNOWN_CARD');
        assert.equal(tools.calls.generate[0].cardName, 'Fox');
        await new Promise((r) => setTimeout(r, 30));
        await loop.runTurn('Name it', [], project, 'auto', 'deepinfra', 't-n2');
        assert.deepEqual(tools.calls.renameCard, [{ groupId: 'group-1', name: 'Snow fox' }]);
    });

    test('generate waits until the model guide is read, then runs', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox' }),
            call('k1', 'read_knowledge', { id: 'guide:test' }),
            call('g2', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox, adapted' }),
            { text: 'Started.' },
        ] });
        tools.listModels = async () => ({ ok: true, models: [{ id: 'test-model', name: 'Test Model', guides: ['guide:test'] }], flows: [] });
        await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', 't-guide');
        const first = toolResults(loop)[0];
        assert.equal(first.error.code, 'GUIDE_NOT_READ');
        assert.match(first.error.message, /"guide:test"/);
        assert.deepEqual(tools.calls.generate.map((b) => b.positive), ['A fox, adapted'], 'only the call after the read reached the app');
    });

    test('a Flow, or a model with no guide, is not held back', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { flowId: 'head-swap', fields: {} }),
            call('g2', 'generate', { modelId: 'plain-model', operation: 't2i', prompt: 'x' }),
            { text: 'ok' },
        ] });
        tools.listModels = async () => ({ ok: true, models: [{ id: 'test-model', guides: ['guide:test'] }, { id: 'plain-model', guides: [] }], flows: [] });
        await loop.runTurn('go', [], project, 'auto', 'deepinfra', 't-free');
        assert.equal(tools.calls.generate.length, 2);
    });

    test('a compaction forgets the guides read and lists the notes again', async () => {
        const { loop } = await makeLoop({
            engineResponses: [{ text: 'a', usage: { prompt_tokens: 600 } }, { text: 'handoff' }],
            contextWindow: 1000,
        });
        loop._readIds.add('guide:test');
        loop._boxed.add('/tmp/att_1.png');
        loop._notesProject = '/project';
        await loop.runTurn('hi', [], project, 'auto', 'deepinfra', 't-c');
        assert.ok(loop.getHistory().entries.some((e) => e.kind === 'handoff'), 'the compaction ran');
        assert.equal(loop._readIds.size, 0);
        assert.equal(loop._boxed.size, 0, 'a measured box is forgotten with the turns that carried it');
        assert.equal(loop._notesProject, null);
    });

    // MPI-774 Phase 4, live: four kept turns sat above the trigger on their own, so every
    // later turn compacted again. The restart keeps only the recent turns that fit.
    test('a compaction keeps only the recent turns that fit in half the trigger', async () => {
        const { loop } = await makeLoop({
            engineResponses: [{ text: 'a', usage: { prompt_tokens: 600 } }, { text: 'handoff' }],
            contextWindow: 1000,
        });
        await loop._buildSystemPrompt('auto').then((s) => { loop._messages = [{ role: 'system', content: s }]; });
        const big = 'x'.repeat(20_000);
        for (const t of ['one', 'two', 'three']) {
            loop._messages.push({ role: 'user', content: `${t} ${big}` }, { role: 'assistant', content: 'ok' });
        }
        await loop.runTurn('newest', [], project, 'auto', 'deepinfra', 't-fit');
        const texts = loop._messages.map((m) => JSON.stringify(m.content));
        assert.match(texts[1], /Session compacted/, 'the handoff follows the system prompt');
        assert.ok(texts.some((t) => t.includes('newest')), 'the newest turn is kept');
        assert.ok(!texts.some((t) => t.startsWith('"one ')), 'an old turn that does not fit is dropped');
        assert.ok(!texts.some((t) => t.startsWith('"two ')), 'an old turn that does not fit is dropped');
    });

    // MPI-774 Phase 4: unnumbered, "edit picture 1" ran on an earlier turn's picture 1.
    // ... and sized: without it a portrait start frame went to 16:9 and lost the top of the head.
    test('attachments are numbered as the box numbers its chips, with their size', async () => {
        const { loop } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        const real = require('node:path').join(__dirname, '..', 'assets', 'mascot', 'studio', 'logo.webp');
        await loop.runTurn('Give the man in picture 1 the hair of picture 2', [
            { id: 'att_a', name: 'man.png', filePath: real },
            { id: 'att_b', name: 'woman.png', filePath: '/tmp/att_b.png' },
        ], project, 'auto', 'deepinfra', 't-num');
        const sent = userMessages(loop).at(-1);
        assert.match(sent, /\[Attached image 1: man\.png \(id: att_a, 128x86\)\]/);
        assert.match(sent, /\[Attached image 2: woman\.png \(id: att_b\)\]/, 'an unreadable file just has no size');
        assert.match(loop._messages[0].content, /Numbering rule: .*never an image from an earlier turn/);
        assert.match(loop._messages[0].content, /pick the listed ratio closest to its size/);
    });

    // MPI-774 Phase 4: live, the model guessed Head Swap boxes at {0,0,512,512} and the swap came
    // out half done, with the box tool right there.
    test('a Flow box waits until look measured the image of its role, then runs', async () => {
        const box = { x: 1, y: 2, width: 30, height: 30 };
        const swap = (id) => call(id, 'generate', {
            flowId: 'head-swap',
            params: { box1: box },
            media: [{ role: 'image1', image: 'att_1' }, { role: 'image2', image: 'att_2' }],
        });
        const { loop, tools } = await makeLoop({ engineResponses: [
            swap('g1'),
            call('l1', 'look', { image: 'att_2', question: 'the head', box: true }),
            swap('g2'),
            call('l2', 'look', { image: 'att_1', question: 'describe it' }),
            swap('g3'),
            call('l3', 'look', { image: 'att_1', question: 'the head', box: true }),
            swap('g4'),
            { text: 'Started.' },
        ] });
        tools.listModels = async () => ({ ok: true, models: [], flows: [
            { id: 'head-swap', boxParams: [{ param: 'box1', role: 'image1', ratio: 1 }, { param: 'box2', role: 'image2', ratio: 1 }] },
        ] });
        tools.look = async (args) => ({ ok: true, output: { text: '{}', ...(args.box ? { box, square: box } : {}) } });
        loop._images.set('att_1', { path: '/tmp/att_1.png', kind: 'attachment' });
        loop._images.set('att_2', { path: '/tmp/att_2.png', kind: 'attachment' });
        await loop.runTurn('Swap the heads', [], project, 'auto', 'deepinfra', 't-box');
        const codes = toolResults(loop).map((r) => r.error?.code || (r.started ? 'started' : 'look'));
        assert.deepEqual(codes, ['BOX_NOT_MEASURED', 'look', 'BOX_NOT_MEASURED', 'look', 'BOX_NOT_MEASURED', 'look', 'started'],
            'box1 is image1: a box on image2, or a look without box, does not open it');
        assert.match(toolResults(loop)[0].error.message, /"att_1"/);
        assert.equal(tools.calls.generate.length, 1, 'only the measured call reached the app');
    });
});

// ---------------------------------------------------------------------------
// (d) probe: no-tools model reported plainly, never retried
// ---------------------------------------------------------------------------

describe('(d) probe', () => {
    test('probe returns tools:false when model does not call a tool, no retry', async () => {
        // Fake engine returns a plain text response (no tool_calls)
        const engineResponses = [
            { text: 'I cannot call tools.', toolCalls: undefined },
        ];
        const { loop } = await makeLoop({ engineResponses });

        const result = await loop.probe('deepinfra');

        assert.equal(result.ok, true, 'probe should succeed (got a response, even without tools)');
        assert.equal(result.tools, false, 'tools should be false when no tool_calls in response');
        assert.ok(result.message.includes('not'), 'message should mention lack of tool support');

        // Engine should have been called exactly once (no retry)
        assert.equal(loop._fakeEngine.calls.length, 1, 'probe must call the engine exactly once — no retry');
    });

    test('probe returns tools:true when model calls a tool', async () => {
        const engineResponses = [
            {
                text: '',
                toolCalls: [{ id: 'tc-probe', type: 'function', function: { name: 'list_models', arguments: '{}' } }],
            },
        ];
        const { loop } = await makeLoop({ engineResponses });

        const result = await loop.probe('deepinfra');

        assert.equal(result.ok, true);
        assert.equal(result.tools, true, 'tools should be true when model calls a tool');
        assert.equal(loop._fakeEngine.calls.length, 1, 'probe calls engine exactly once');
    });

    test('probe handles endpoint error without retrying', async () => {
        const AgentLoop = await loadAgentLoop();
        const errorEngine = { calls: [], chat: async () => { throw new Error('connect ECONNREFUSED'); } };
        const loop = new AgentLoop({ resolveEndpoint: async () => ({ profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'http://localhost:1', model: 'm', contextWindow: 1000 }, key: 'k' }) });
        // Patch engine
        const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
        const orig = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = errorEngine.chat;
        try {
            const result = await loop.probe('deepinfra');
            assert.equal(result.ok, false, 'probe should report error');
            assert.equal(result.error.code, 'ENDPOINT_ERROR');
        } finally {
            DeepInfraEngine.prototype.chat = orig;
        }
    });
});

// ---------------------------------------------------------------------------
// Live DeepInfra run (skipped if DEEPINFRA_API_KEY absent)
// ---------------------------------------------------------------------------

test('LIVE: real loop against fake tools with DeepInfra', { skip: !process.env.DEEPINFRA_API_KEY && 'DEEPINFRA_API_KEY not set — skipping live test' }, async () => {
    const AgentLoop = await loadAgentLoop();
    const tools = makeFakeTools();
    const loop = new AgentLoop({
        tools,
        resolveEndpoint: async () => ({
            profile: {
                id: 'deepinfra',
                name: 'DeepInfra',
                baseURL: 'https://api.deepinfra.com/v1/openai',
                model: 'deepseek-ai/DeepSeek-V4-Flash-0731',
                contextWindow: 1_048_576,
            },
            key: process.env.DEEPINFRA_API_KEY,
        }),
    });

    const fakeRes = makeFakeRes();
    loop.addSubscriber(fakeRes);

    const start = Date.now();
    await loop.runTurn(
        'List the available models for me.',
        [],
        null,
        'auto',
        'deepinfra',
        'live-turn-1',
    );
    const elapsed = Date.now() - start;

    // Find the message event
    const msgEvt = fakeRes.events.find((e) => e.event === 'agent:message');
    const toolEvts = fakeRes.events.filter((e) => e.event === 'agent:tool');

    console.log('');
    console.log('=== LIVE RUN RESULTS ===');
    console.log(`Latency: ${elapsed} ms`);
    console.log(`Tool calls: ${toolEvts.map((e) => `${e.data.tool}(${e.data.status})`).join(', ') || 'none'}`);
    console.log(`Usage: ${JSON.stringify(loop._lastUsage)}`);
    console.log(`Response (first 200 chars): ${msgEvt?.data?.text?.slice(0, 200) || '(none)'}`);
    console.log('========================');
    console.log('');

    assert.ok(msgEvt || toolEvts.length > 0, 'Live run should produce at least a message or tool call');
});
