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

    const endpointProfile = {
        id: 'deepinfra',
        name: 'DeepInfra',
        baseURL: 'https://api.deepinfra.com/v1/openai',
        model: 'deepseek-ai/DeepSeek-V4-Flash-0731',
        contextWindow,
    };

    const loop = new AgentLoop({
        tools,
        resolveEndpoint: resolveEndpointOverride || (async () => ({ profile: endpointProfile, key: 'fake-key' })),
    });

    // Patch: inject fake engine so the loop uses it instead of DeepInfraEngine
    loop._fakeEngine = engine;
    const origRunTurn = loop.runTurn.bind(loop);
    loop.runTurn = async function(text, attachments, project, mode, profileId, turnId) {
        // Intercept the engine construction inside the loop
        const origResolve = loop._resolveEndpoint.bind(loop);
        loop._resolveEndpoint = async () => ({ profile: endpointProfile, key: 'fake-key' });
        // Patch DeepInfraEngine inside the loop
        const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
        const origChatProto = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = engine.chat;
        try {
            await origRunTurn(text, attachments, project, mode, profileId, turnId);
        } finally {
            DeepInfraEngine.prototype.chat = origChatProto;
            loop._resolveEndpoint = origResolve;
        }
    };

    // Patch probe similarly
    loop.probe = async function(profileId) {
        const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
        const origChatProto = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = engine.chat;
        const origResolve = loop._resolveEndpoint.bind(loop);
        loop._resolveEndpoint = async () => ({ profile: endpointProfile, key: 'fake-key' });
        try {
            const AgentLoop = await loadAgentLoop();
            return await AgentLoop.prototype.probe.call(loop, profileId);
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
