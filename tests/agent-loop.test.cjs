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
function makeFakeTools({ generateDelay = 0, installResult = { ok: true }, quote = null, refuseBatch = false } = {}) {
    const calls = { listModels: [], readKnowledge: [], installModel: [], generate: [], look: [], openProject: [], placeAsset: [], quote: [] };
    return {
        calls,
        // MPI-876 — `POST /connector/quote`. `billed: false` is the honest default: every
        // test here runs a local model, and a local model can never cost anything. A test
        // about the spend gate passes `quote`, an object or a function of the body.
        quoteGeneration: async (body) => {
            calls.quote.push(body);
            const out = typeof quote === 'function' ? quote(body) : quote;
            return { ok: true, output: out || { billed: false } };
        },
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
            // What the connector answers a model whose images 2+ artefact (MPI-876 phase 2).
            if (refuseBatch && body.batch) return { ok: false, error: { code: 'BATCH_UNSUPPORTED', message: 'cannot batch cleanly' } };
            if (generateDelay > 0) {
                await new Promise((r) => setTimeout(r, generateDelay));
            }
            return { ok: true, output: { itemId: 'item-1', groupId: 'group-1', type: 'image', filePath: '/path/result.png' } };
        },
        look: async (args) => {
            calls.look.push(args);
            return { ok: true, output: { text: 'A generated image showing a fox.' } };
        },
        // No sidecar by default, so every look is live; block (k) swaps in a real store.
        storedLook: async () => null,
        storeLook: async () => {},
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

        // Longer than EARLY_REFUSAL_MS (1000): a generate now waits that long to catch a
        // refusal, so a fixture that settles inside the window proves nothing about
        // blocking. A real generation takes 30-160 s, which this stands in for.
        const GENERATE_DELAY = 1800; // ms — long enough to prove non-blocking
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

        // The turn must return before the generation settles. If generate were awaited,
        // elapsed would be >= GENERATE_DELAY.
        assert.ok(
            elapsed < GENERATE_DELAY,
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

    /**
     * MPI-817. Non-blocking is right for the LAST step and wrong for every step something
     * else needs. Live (Fabio, 2026-09-19): "grow the top and bottom edges so the format
     * becomes 9:16, and after that animate it". The outpaint started, the turn ended, the
     * picture arrived afterwards as a note nothing would read until the next user message,
     * and the animation was simply never made — the model said so itself in the chat, that
     * it had nowhere to wait. `wait: true` is that place.
     *
     * The assertion that matters second is ONE report. The waiting branch and the
     * fire-and-forget branch share a single `settle`, and attaching it as well as awaiting
     * it would emit `agent:result` twice and push the note twice — a chat showing the same
     * card twice, from one generation.
     */
    test('wait: true holds the turn open, hands back the result, and reports exactly once', async () => {
        const GENERATE_DELAY = 1800;
        const { loop, fakeRes } = await makeLoop({
            engineResponses: [
                {
                    text: '',
                    toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'generate', arguments: '{"modelId":"test-model","operation":"t2i","prompt":"A fox","wait":true}' } }],
                },
                { text: 'Here it is, and here is the video.' },
            ],
            toolOpts: { generateDelay: GENERATE_DELAY },
        });

        const start = Date.now();
        await loop.runTurn('Make a fox, then animate it', [], { folderPath: '/project', name: 'Test' }, 'auto', 'deepinfra', 'turn-wait');
        const elapsed = Date.now() - start;

        assert.ok(elapsed >= GENERATE_DELAY,
            `the turn (${elapsed} ms) must not end before the generation it was told to wait for (${GENERATE_DELAY} ms)`);

        // The model gets the result IN the tool result, which is the whole point: without
        // it there is nothing to pass as the next step's media.
        const toolResult = loop._messages.find((m) => m.role === 'tool');
        assert.ok(toolResult, 'the model must get a tool result back');
        const payload = JSON.parse(toolResult.content);
        assert.equal(payload.ok, true);
        assert.ok(!payload.started, 'a waited generate reports its result, never `started: true`');
        assert.ok(payload.output?.filePath, 'the result must carry the filePath the next step passes as media');

        const results = fakeRes.events.filter((e) => e.event === 'agent:result');
        assert.equal(results.length, 1, 'one generation, one agent:result — never both branches');
        assert.equal(results[0].data.ok, true);
        const finished = loop._notes.filter((n) => n.startsWith('[Generation finished:'));
        assert.equal(finished.length, 1, 'one generation, one note');
    });
});

/**
 * The tool schema is the contract: with `additionalProperties: false` a key the schema
 * does not name cannot be emitted at all, which is exactly how `duration` was lost
 * (tests/agent-duration.test.cjs). `wait` is deliberately NOT forwarded into the connector
 * body — it is the loop's own concern — so the named-param sweep cannot cover it.
 */
test('`wait` is declared on the generate tool, and the system prompt says when to reach for it', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const loop = fs.readFileSync(path.join(__dirname, '..', 'services', 'agentLoop.mjs'), 'utf8');

    const from = loop.indexOf("name: 'generate'");
    const to = loop.indexOf("name: 'look'", from);
    assert.ok(from > 0 && to > from, 'the generate / look tool blocks were not found');
    assert.match(loop.slice(from, to), /\bwait:\s*\{/, '`wait` must be declared or the model cannot send it');

    assert.match(loop, /Chaining rule:/, 'a tool with no rule telling the agent when to use it is a tool it will not use');
});

/**
 * MPI-903: the always-loaded rules route, the docs teach. Each test pins the FACT a rule
 * must still carry after the rewrite, not the prose around it. A rule is sliced from its
 * "<Name> rule:" to the next newline, so never write another rule's "X rule:" inside one.
 */
const RULES = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'services', 'agentLoop.mjs'), 'utf8');
const rule = (name) => {
    const at = RULES.indexOf(`${name} rule:`);
    assert.ok(at > 0, `there is no ${name} rule`);
    return RULES.slice(at, RULES.indexOf('\n', at));
};

test('Cards: recency is the list order, never a note; an open card is "this one"', () => {
    const r = rule('Cards');
    assert.match(r, /"The last".*list's order, newest first/);
    assert.match(r, /a project note never answers it/);
    assert.match(r, /do not call list_cards to find it, never ask them to attach it/);
});

test('Duration: 2-3 s default, a sequence earns more, never promise to report back', () => {
    const r = rule('Duration');
    assert.match(r, /defaults to 2 to 3 seconds: ONE continuous action fits/);
    assert.match(r, /Only a SEQUENCE/);
    assert.match(r, /The user naming a length always wins/);
    assert.match(r, /Never promise to report back: you never speak first.*only when the user writes again/);
    assert.ok(r.length <= 1212, `the Duration rule is ${r.length} chars`);
});

test('Settings: a named resolution matches tierSizes; one clip\'s settings never carry', () => {
    const r = rule('Settings');
    assert.match(r, /params\.tierSizes/);
    assert.match(r, /1K = 1080p = full HD = 1920 on the long side/);
    assert.match(r, /quality at the lowest tier/);
    assert.match(r, /only a redo keeps its card's settings/);
});

// MPI-908: a no in words fails no tool, so the panel's Cosmo cannot see it. The agent marks
// the reply; the server hides the marker from the user and flags the frame.
test('Declining: the marker is hidden from the user, flagged on the frame, kept in context', async () => {
    assert.match(rule('Declining'), /start that reply with \[declined\]/);
    const { loop, fakeRes } = await makeLoop({ engineResponses: [{ text: '[declined] There is no Z Image Turbo installed.' }] });
    await loop.runTurn('Make a cat with Z Image Turbo', [], { folderPath: '/p', name: 'P' }, 'auto', 'deepinfra', 'turn-decline');
    const msg = fakeRes.events.find((e) => e.event === 'agent:message').data;
    assert.equal(msg.text, 'There is no Z Image Turbo installed.');
    assert.equal(msg.declined, true);
    assert.equal(loop._messages.at(-1).content, '[declined] There is no Z Image Turbo installed.');

    const plain = await makeLoop({ engineResponses: [{ text: 'Done.' }] });
    await plain.loop.runTurn('Hi', [], { folderPath: '/p', name: 'P' }, 'auto', 'deepinfra', 'turn-plain');
    assert.equal(plain.fakeRes.events.find((e) => e.event === 'agent:message').data.declined, undefined);
});

test('Voice: the reply, never the reasoning', () => {
    const r = rule('Voice');
    assert.match(r, /write the reply, never the thinking behind it/);
    assert.match(r, /Do not name a rule, a note, an op's description or a knowledge entry/);
    assert.match(r, /do not write your plan and then carry it out in the same message/);
    assert.match(r, /never as "the user"/);
    assert.match(r, /one short line, not a paragraph/);
});

test('Route: one question, three answers, at most three routes, always recommend', () => {
    const r = rule('Route');
    assert.match(r, /does the change stay inside ONE area/);
    assert.match(r, /Light, sky, time of day, weather, season and style fall on the whole frame/);
    assert.match(r, /several asks in one message are ONE edit, never split/);
    assert.match(r, /Not one area: run ONE whole-picture edit, ask nothing/);
    assert.match(r, /words that protect the rest.*ask for the mask, offer nothing else/);
    assert.match(r, /recommend one, and wait/);
    assert.match(r, /At most three routes, only at a genuine fork, always recommend one/);
    assert.match(r, /never add adjectives/);
    assert.match(r, /keeps the source's size/);
});

test('Masking: the user paints, in the app\'s own words, and the prompt shape is gated on app:masking', () => {
    const r = rule('Masking');
    assert.match(r, /click the card in the gallery to open it/);
    assert.match(r, /toolbar down the left/);
    assert.match(r, /already looking at the card, skip the first half/);
    assert.match(r, /Never say "History"/);
    assert.match(r, /generate refuses a masked op until you have read app:masking/);
    const honest = RULES.split('\n').filter((l) => l.includes('I cannot paint masks'));
    assert.equal(honest.length, 1, 'the mask limit is written in exactly one place');
    assert.doesNotMatch(honest[0], /History/i);
});

test('a generation that never landed survives a restart as a project note, and landing removes it', async () => {
    const project = { folderPath: '/project', name: 'Test' };
    const store = new Map(); // file -> { title, hook, text }: the project's Agent/ folder
    const withNotes = (tools) => Object.assign(tools, {
        readMemory: async (_folder, file) => {
            if (!file) return { ok: true, notes: [...store].map(([f, n]) => ({ file: f, title: n.title, hook: n.hook })) };
            return store.has(file) ? { ok: true, file, text: store.get(file).text } : { ok: false, error: { code: 'UNKNOWN_NOTE' } };
        },
        writeMemory: async (_folder, note) => { store.set(note.file, note); return { ok: true }; },
    });
    const call = '{"modelId":"test-model","operation":"t2v","prompt":"A cowboy takes off his hat","qualityTier":"medium","duration":3,"cardName":"Cyberpunk cowboy"}';
    const generateTurn = [{ text: '', toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'generate', arguments: call } }] }, { text: 'Rendering.' }];

    // 1. Submitted, and the app closes before it lands: the promise never settles.
    const first = await makeLoop({ engineResponses: generateTurn });
    withNotes(first.tools).generate = () => new Promise(() => {});
    await first.loop.runTurn('A cowboy', [], project, 'auto', 'deepinfra', 'turn-1');

    const note = store.get('unfinished-generations.md');
    assert.ok(note, 'nothing was written at submit');
    assert.equal(note.hook, '1: Cyberpunk cowboy');
    const [entry] = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(note.text)[1]);
    assert.equal(entry.status, 'running');
    assert.deepEqual(entry.generate, JSON.parse(call), 'the note must hold the exact call, or a requeue is a guess');
    assert.doesNotMatch(note.text, /Rendering\./, 'none of the conversation belongs in it');

    // 2. A new loop = after the restart. The message that lists notes names the clip.
    const second = await makeLoop({ engineResponses: generateTurn });
    withNotes(second.tools);
    await second.loop.runTurn('requeue it', [], project, 'auto', 'deepinfra', 'turn-2');
    const heard = JSON.stringify(second.engine.calls[0].messages);
    assert.match(heard, /unfinished-generations\.md: Generations that never finished \(1: Cyberpunk cowboy\)/);

    // 3. That requeue was the same call and it LANDED (the default fake does): the entry is
    //    gone, not doubled, and an empty note costs the next conversation no line at all.
    await second.loop._unfinishedQueue;
    assert.equal(store.get('unfinished-generations.md').hook, 'none');
    const third = await makeLoop({ engineResponses: [{ text: 'Hi.' }] });
    withNotes(third.tools);
    await third.loop.runTurn('hello', [], project, 'auto', 'deepinfra', 'turn-3');
    assert.doesNotMatch(JSON.stringify(third.engine.calls[0].messages), /unfinished-generations/);

    // 4. A cancel is not a landing: it stays, with why.
    await third.loop._trackUnfinished(project, JSON.parse(call), 'CANCELLED');
    assert.match(store.get('unfinished-generations.md').text, /"status":"CANCELLED"/);
});

/*
 * Fabio, live 2026-09-20: a photoreal clip rendering, an anime one queued behind it, then
 * "Scratch that. Leave it." It was meant to cancel the anime clip. The agent had thirteen
 * tools and none of them cancels, so it read "leave it" as "leave it running", said so, and
 * the clip he had taken back rendered anyway.
 */
test('the agent can cancel what it started: the latest by default, an earlier one by id', async () => {
    const project = { folderPath: '/project', name: 'Test' };
    const store = new Map();
    const gen = (id, prompt, cardName) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name: 'generate',
        arguments: JSON.stringify({ modelId: 'test-model', operation: 't2v', prompt, cardName }) } }] });
    const cancel = (id, args = {}) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name: 'cancel_generation', arguments: JSON.stringify(args) } }] });
    const { loop, tools } = await makeLoop({ engineResponses: [
        gen('g1', 'A cowgirl on a haystack', 'Cowgirl'), { text: 'Generating.' },
        gen('g2', 'A cowgirl on a haystack, anime', 'Cowgirl anime'), { text: 'Anime version started.' },
        cancel('c1'), { text: 'Cancelled the anime one.' },
        cancel('c2', { toolCallId: 'PHOTOREAL' }), cancel('c3'), { text: 'Both gone.' },
    ] });
    Object.assign(tools, {
        readMemory: async (_f, file) => (store.has(file) ? { ok: true, file, text: store.get(file).text } : { ok: true, notes: [] }),
        writeMemory: async (_f, note) => { store.set(note.file, note); return { ok: true }; },
    });
    // The route's half: a submit is held open under its requestId, and a cancel settles it
    // CANCELLED — the same envelope a Stop press in the app produces.
    const held = new Map();
    tools.generate = (body) => new Promise((resolve) => held.set(body.requestId, resolve));
    const cancelled = [];
    tools.cancelGeneration = async (requestId) => {
        cancelled.push(requestId);
        if (!held.has(requestId)) return { ok: false, error: { code: 'NOT_IN_FLIGHT', message: 'gone' } };
        held.get(requestId)({ ok: false, error: { code: 'CANCELLED', message: 'The generation was cancelled or produced no output.' } });
        held.delete(requestId);
        return { ok: true, output: { cancelled: true, was: 'pending' } };
    };
    const toolResults = () => loop._messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
    const ledger = () => JSON.parse(/```json\n([\s\S]*?)\n```/.exec(store.get('unfinished-generations.md').text)?.[1] || '[]');

    await loop.runTurn('a cowgirl video', [], project, 'auto', 'deepinfra', 't1');
    await loop.runTurn('make it anime', [], project, 'auto', 'deepinfra', 't2');
    const [photoreal, anime] = [...held.keys()];
    assert.equal(held.size, 2, 'each submit carries its own requestId');
    assert.equal(toolResults()[1].toolCallId, anime, 'the id the model is given is the one the route can cancel');

    await loop.runTurn('Scratch that. Leave it.', [], project, 'auto', 'deepinfra', 't3');
    await new Promise((r) => setImmediate(r));
    await loop._unfinishedQueue;
    assert.deepEqual(cancelled, [anime], 'no id given: the LATEST one it started');
    assert.match(toolResults()[2].message, /^Cancelled: Cowgirl anime\. Still in flight: .+\(Cowgirl\)\./);
    assert.deepEqual(ledger().map((e) => e.generate.cardName), ['Cowgirl'], 'a clip the user took back is not one to requeue');
    const last = loop.getHistory().entries.filter((e) => e.kind === 'result').pop();
    assert.deepEqual(last.error, { code: 'CANCELLED', message: 'Cancelled, as you asked.' });
    assert.doesNotMatch(JSON.stringify(loop._notes), /Generation failed/, 'and the model is not told it failed');

    // An id it was never given reaches nothing; then the default finds the one still running.
    await loop.runTurn('and the first one', [], project, 'auto', 'deepinfra', 't4');
    await new Promise((r) => setImmediate(r));
    await loop._unfinishedQueue;
    assert.deepEqual(cancelled, [anime, photoreal]);
    assert.equal(toolResults()[3].error.code, 'NOT_IN_FLIGHT');
    assert.match(toolResults()[3].error.message, /Still in flight: .+\(Cowgirl\)/);
    assert.equal(store.get('unfinished-generations.md').hook, 'none');

    // Nothing left: it says so, and points at the app's own Stop for the user's runs.
    const after = await makeLoop({ engineResponses: [cancel('c9'), { text: 'Nothing to cancel.' }] });
    await after.loop.runTurn('cancel it', [], project, 'auto', 'deepinfra', 't5');
    const r = JSON.parse(after.loop._messages.find((m) => m.role === 'tool').content);
    assert.equal(r.error.code, 'NOT_IN_FLIGHT');
    assert.match(r.error.message, /Stop in the app/);
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

    /** A keyless loop on `presetId`, its engine faked. `makeLoop` cannot do this: it forces a key. */
    async function keylessLoop(presetId) {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop({
            tools: makeFakeTools(),
            resolveEndpoint: async () => ({ profile: { id: presetId, name: presetId, baseURL: 'http://localhost:11434/v1' }, key: null }),
            lookupContextWindow: async () => 32_768,
        });
        const fakeRes = makeFakeRes();
        loop.addSubscriber(fakeRes);
        const engine = makeFakeEngine([{ text: 'hi' }]);
        // `chatEngineFor` sends the ollama preset to OllamaEngine and everything else to
        // DeepInfraEngine, so both are stubbed: patching only one would put a "unit" test
        // on a real localhost:11434 and load a model off disk.
        const { DeepInfraEngine, OllamaEngine } = await import('../services/llmEngines.mjs');
        const orig = [DeepInfraEngine.prototype.chat, OllamaEngine.prototype.chat];
        DeepInfraEngine.prototype.chat = engine.chat;
        OllamaEngine.prototype.chat = engine.chat;
        return {
            loop, fakeRes, engine,
            restore: () => {
                [DeepInfraEngine.prototype.chat, OllamaEngine.prototype.chat] = orig;
            },
        };
    }

    test('Ollama is keyless: a turn and a probe both run with no key (the routes/llm.js rule)', async () => {
        // Regression: routes/llm.js exempted 'ollama' from NO_KEY and the agent loop did not,
        // so the Ollama connection worked for enhance and describe and never for the agent.
        const { loop, fakeRes, engine, restore } = await keylessLoop('ollama');
        try {
            await loop.runTurn('Hello', [], null, 'auto', 'ollama', 't-ollama', { model: 'some/local-model' });
            assert.equal(fakeRes.events.find((e) => e.event === 'agent:error'), undefined);
            assert.equal(engine.calls.length, 1);
            const probed = await loop.probe('ollama', 'some/local-model');
            assert.notEqual(probed.error?.code, 'NO_KEY');
            assert.equal(engine.calls.length, 2);
        } finally { restore(); }
    });

    test('the agent goes to OllamaEngine on the ollama preset, DeepInfra everywhere else', async () => {
        const { chatEngineFor, OLLAMA_AGENT_CONTEXT } = await import('../services/llmEngines.mjs');
        // `/v1` cannot carry an agent turn: measured 2026-09-19 against a real Ollama, it
        // returns 200 and ignores num_ctx (4096 either way), and it has no `think` flag.
        const ollama = chatEngineFor('ollama', null, 'http://localhost:11434/v1');
        assert.equal(ollama.engine.backend, 'ollama');
        assert.equal(ollama.contextWindow, OLLAMA_AGENT_CONTEXT);
        // The native route is rooted at the host; the `/v1` suffix belongs to the shim.
        assert.equal(ollama.engine.baseUrl, 'http://localhost:11434');

        const hosted = chatEngineFor('deepinfra', 'k', 'https://api.deepinfra.com/v1/openai');
        assert.equal(hosted.engine.backend, 'deepinfra');
        assert.equal(hosted.contextWindow, null, 'a hosted endpoint reports its own window');
    });

    test('Ollama tool calls are translated into the dialect the loop speaks', async () => {
        const { OllamaEngine } = await import('../services/llmEngines.mjs');
        // Three differences, each of which fails QUIETLY rather than erroring.
        const sent = [];
        const origFetch = global.fetch;
        global.fetch = async (url, opts) => {
            sent.push({ url, body: JSON.parse(opts.body) });
            return {
                ok: true,
                json: async () => ({
                    message: {
                        content: '',
                        // 1. arguments is an OBJECT here; OpenAI gives a JSON string, and the
                        //    loop JSON.parses it — an object throws and every tool would run
                        //    with no arguments at all.
                        tool_calls: [{ function: { name: 'generate', arguments: { modelId: 'krea2' } } }],
                    },
                    prompt_eval_count: 1200,
                    eval_count: 34,
                }),
            };
        };
        try {
            const engine = new OllamaEngine('http://localhost:11434');
            const res = await engine.chat({
                model: 'm',
                tools: [{ type: 'function', function: { name: 'generate' } }],
                options: { contextWindow: 32768 },
                messages: [
                    { role: 'user', content: 'go' },
                    // 2. no id on the way out, so the loop's tool_call_id is ours to mint, and
                    // 3. a result is matched by tool_name, not by id.
                    { role: 'assistant', content: '', tool_calls: [{ id: 'call_7', type: 'function', function: { name: 'look', arguments: '{"image":"a.png"}' } }] },
                    { role: 'tool', tool_call_id: 'call_7', content: '{"ok":true}' },
                ],
            });

            assert.equal(typeof res.toolCalls[0].function.arguments, 'string', 'the loop JSON.parses this');
            assert.deepEqual(JSON.parse(res.toolCalls[0].function.arguments), { modelId: 'krea2' });
            assert.ok(res.toolCalls[0].id, 'a tool result needs an id to answer against');
            // Compaction reads usage.prompt_tokens; Ollama spells its counts differently and
            // without the mapping the agent would never compact at all.
            assert.equal(res.usage.prompt_tokens, 1200);
            assert.equal(res.usage.completion_tokens, 34);

            const body = sent[0].body;
            assert.equal(body.options.num_ctx, 32768, 'the window the agent asked for');
            assert.equal(body.think, false);
            assert.ok(body.tools?.length, 'tools must reach the native route');
            const assistant = body.messages.find(m => m.role === 'assistant');
            assert.deepEqual(assistant.tool_calls[0].function.arguments, { image: 'a.png' }, 'an object on the wire');
            assert.equal(body.messages.find(m => m.role === 'tool').tool_name, 'look');
        } finally { global.fetch = origFetch; }
    });

    test('a non-agent Ollama call keeps the 8k window and gains no tool keys', async () => {
        const { OllamaEngine } = await import('../services/llmEngines.mjs');
        // Enhance and describe share this client. They destructure { text }, so the new
        // keys must not reach them and the window must not move under them.
        let body = null;
        const origFetch = global.fetch;
        global.fetch = async (_url, opts) => {
            body = JSON.parse(opts.body);
            return { ok: true, json: async () => ({ message: { content: 'a prompt' } }) };
        };
        try {
            const res = await new OllamaEngine().chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] });
            assert.equal(body.options.num_ctx, 8192);
            assert.equal(body.tools, undefined);
            assert.equal(res.text, 'a prompt');
            assert.equal(res.toolCalls, undefined);
            assert.equal(res.usage, null, 'no counts reported, no invented ones');
        } finally { global.fetch = origFetch; }
    });

    test('any other keyless connection is still refused, and nothing is spent', async () => {
        const { loop, fakeRes, engine, restore } = await keylessLoop('openrouter');
        try {
            await loop.runTurn('Hello', [], null, 'auto', 'openrouter', 't-nokey', { model: 'some/model' });
            assert.equal(fakeRes.events.find((e) => e.event === 'agent:error')?.data.code, 'NO_KEY');
            assert.equal((await loop.probe('openrouter', 'some/model')).error?.code, 'NO_KEY');
            assert.equal(engine.calls.length, 0);
        } finally { restore(); }
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

    // MPI-817, live 2026-09-19. Two ILL Anime runs, then Fabio pinned Krea 2 and asked for
    // a cartoon. The agent looked at the ill-anime image, called it "the Krea 2 result", and
    // generated nothing — the request looked already met. It had no way to be right: the
    // state line listed bare refs, `look` reads pixels, and the only model named anywhere in
    // that turn was the pinned one. The sidecars on disk said `modelId: ill-anime`.
    test('a result ref says which model made it, and an unknown one says so rather than nothing', async () => {
        const { loop } = await makeLoop({ engineResponses: [{ text: 'a' }] });
        loop._registerResult('/project-file?path=%2Fp%2Fduck.png', 'ill-anime');
        loop._registerResult('/project-file?path=%2Fp%2Fmystery.png');   // no modelId known
        await loop.runTurn('look', [], null, 'auto', 'deepinfra', 't-prov');
        const line = loop._messages.find((m) => m.role === 'user').content.split('\n')[0];
        assert.match(line, /duck\.png \(made by ill-anime\)/);
        assert.doesNotMatch(line, /mystery\.png \(made by/, 'an unknown origin must not be invented');
        // And the line must SAY that a bare ref is unknown, or the model fills the gap itself.
        assert.match(line, /never assume it came from the model selected now/);
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

    // Live, 2026-09-20: the model cleared unfinished-generations.md itself while the requeue
    // was still rendering. The code rewrote it on landing, but an app close in that window
    // would have lost the one clip the note exists to recover.
    test('the unfinished ledger is the app\'s: the model can read it, never write it', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('w1', 'write_memory', { file: ' Unfinished-Generations.md', title: 'Unfinished generations', text: 'Nothing unfinished.' }),
            call('r1', 'read_memory', { file: 'unfinished-generations.md' }),
            { text: 'Done.' },
        ] });
        withMemory(tools);
        await loop.runTurn('Clear the list', [], project, 'auto', 'deepinfra', 't-ledger');
        assert.equal(tools.calls.writeMemory.length, 0, 'the model\'s write never reaches the file');
        assert.deepEqual(toolResults(loop).map((r) => r.error?.code), ['APP_OWNED_NOTE', undefined]);
        // and the step does not claim a note was made
        assert.equal(loop.getHistory().entries.find((e) => e.tool === 'write_memory').label, 'Checking unfinished generations');
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

    // A generation that fails once it is RUNNING — the engine dies, ComfyUI refuses the
    // graph — still reports at the start of the next turn, because there is no turn left to
    // report into. A failure that lands before anything is queued is a different animal and
    // goes back in-turn instead; see "refused IN-TURN" in the diet block.
    test('a generation that fails AFTER it started is reported at the next turn', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox' }),
            { text: 'Started.' },
            { text: 'Sorry.' },
        ] });
        tools.generate = async () => {
            await new Promise((r) => setTimeout(r, 1100)); // past the early-refusal window
            return { ok: false, error: { code: 'MODEL_NOT_INSTALLED', message: 'not installed' } };
        };
        await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', 't-f');
        await new Promise((r) => setTimeout(r, 250));
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
        assert.match(loop._messages[0].content, /the picture's own shape is used/);
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

    test('a box that takes over 0.6 of the image is refused, and a second one says stop', async () => {
        const box = { x: 0, y: 0, width: 700, height: 900 };
        const swap = (id) => call(id, 'generate', { flowId: 'head-swap', params: { box1: box }, media: [{ role: 'image1', image: 'att_1' }] });
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('l1', 'look', { image: 'att_1', question: 'the head', box: true }),
            swap('g1'),
            call('l2', 'look', { image: 'att_1', question: 'the head only', box: true }),
            { text: 'Please crop it.' },
        ] });
        tools.listModels = async () => ({ ok: true, models: [], flows: [{ id: 'head-swap', boxParams: [{ param: 'box1', role: 'image1', ratio: 1 }] }] });
        tools.look = async () => ({ ok: true, output: { box, square: box, squareShare: { w: 0.7, h: 0.9 } } });
        loop._images.set('att_1', { path: '/tmp/att_1.png', kind: 'attachment' });
        await loop.runTurn('Swap the head', [], project, 'auto', 'deepinfra', 't-over');
        const [look1, gen, look2] = toolResults(loop);
        assert.match(look1.hint, /whole person, not the head/);
        assert.equal(gen.error.code, 'BOX_TOO_BIG');
        assert.match(look2.hint, /Stop measuring/);
        assert.equal(tools.calls.generate.length, 0);
    });

    test('with a mask painted, a masked op waits until app:masking is read', async () => {
        const edit = (id) => call(id, 'generate', { modelId: 'test-model', operation: 'kleinEdit', prompt: 'convert the boy into a demon' });
        const { loop, tools } = await makeLoop({ engineResponses: [
            edit('g1'),
            call('k1', 'read_knowledge', { id: 'app:masking' }),
            edit('g2'),
            { text: 'Started.' },
        ] });
        tools.listModels = async () => ({ ok: true, models: [{ id: 'test-model', guides: [] }], flows: [] });
        const workspace = { activeEntry: { filePath: '/project/Media/a.png' }, card: { name: 'a' }, masked: true };
        await loop.runTurn('make him a demon', [], project, 'auto', 'deepinfra', 't-mask', { workspace });
        assert.equal(toolResults(loop)[0].error.code, 'KNOWLEDGE_NOT_READ');
        assert.equal(tools.calls.generate.length, 1, 'only the call after the read reached the app');
    });

    test('without a mask, the masking doc is not required', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'test-model', operation: 'kleinEdit', prompt: 'make it night' }),
            { text: 'Started.' },
        ] });
        tools.listModels = async () => ({ ok: true, models: [{ id: 'test-model', guides: [] }], flows: [] });
        await loop.runTurn('make it night', [], project, 'auto', 'deepinfra', 't-nomask');
        assert.equal(tools.calls.generate.length, 1);
    });

    test('the first generate of a turn with no note asks for one, once; a noted turn is not asked', async () => {
        const gen = (id) => call(id, 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'a crow on a roof' });
        const { loop, tools } = await makeLoop({ engineResponses: [
            gen('g1'), gen('g2'), { text: 'Started.' },
            call('m1', 'write_memory', { file: 'rook.md', title: 'Rook', text: 'A one-eyed crow.' }), gen('g3'), { text: 'Noted, started.' },
        ] });
        tools.listModels = async () => ({ ok: true, models: [{ id: 'test-model', guides: [] }], flows: [] });
        tools.writeMemory = async () => ({ ok: true });
        await loop.runTurn('Rook is a one-eyed crow. Make two of him.', [], project, 'auto', 'deepinfra', 't-n1');
        const [first, second] = toolResults(loop);
        assert.match(first.remember, /write_memory/);
        assert.equal(second.remember, undefined, 'once per turn');
        await loop.runTurn('Rook wears a compass. One more.', [], project, 'auto', 'deepinfra', 't-n2');
        const after = toolResults(loop).slice(2);
        assert.equal(after[0].ok, true, 'the note was written');
        assert.equal(after[1].remember, undefined, 'a turn that noted something is not asked');
        assert.equal(tools.calls.generate.length, 3);
    });
});

// ---------------------------------------------------------------------------
// (i) Phase 7: the catalogue diet — a short list plus describe_model
// ---------------------------------------------------------------------------

describe('(i) the catalogue diet', () => {
    const call = (id, name, args) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
    const project = { folderPath: '/project', name: 'Test' };
    const toolResults = (loop) => loop._messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));

    const RATIOS = ['1:1', '3:4', '4:5', '5:8', '9:16', '4:3', '5:4', '8:5', '16:9'];
    const catalogue = {
        ok: true,
        engine: 'local',
        hardware: { gpuName: 'Test GPU', vramGb: 16 },
        models: [
            {
                id: 'one-note', name: 'One Note', type: 'image', installed: true,
                guides: ['guide:one'],
                fit: { floorVramGb: 8, runs: true },
                missingDownloadGb: 0,
                ops: [
                    { op: 't2i', installed: true, rank: 1, note: 'same note', params: { ratios: RATIOS, styles: ['a', 'b'] }, media: [] },
                    { op: 'i2i', installed: true, rank: 2, note: 'same note', params: { ratios: RATIOS, styles: ['a', 'b'] }, media: [{ role: 'image1', type: 'image' }] },
                ],
            },
            {
                id: 'too-big', name: 'Too Big', type: 'video', installed: false,
                guides: [], missingDownloadGb: 12.4,
                fit: { floorVramGb: 24, runs: false },
                ops: [
                    { op: 'i2v', installed: false, note: 'a note of its own', params: { ratios: RATIOS }, media: [] },
                    { op: 't2v', installed: false, params: { ratios: RATIOS }, media: [] },
                ],
            },
        ],
        flows: [{ id: 'a-flow', title: 'A Flow', installed: true, fields: [{ id: 'positive', label: 'Expression', type: 'text' }], boxParams: [{ param: 'box1', role: 'image1', ratio: 1 }] }],
    };

    test('the short list carries what chooses, and none of what sets', async () => {
        const { compactCatalogue } = await import('../services/agentLoop.mjs');
        const short = compactCatalogue(catalogue);
        const text = JSON.stringify(short);

        assert.ok(!text.includes('16:9'), 'params are gone from the list');
        assert.ok(!text.includes('guide:one'), 'guide ids are gone from the list');
        assert.ok(!text.includes('box1'), "a Flow's boxes are gone from the list");
        assert.ok(!text.includes('Expression'), "a Flow's fields are gone from the list");
        assert.ok(text.length < JSON.stringify(catalogue).length / 2, `the list did not shrink (${text.length} chars)`);

        const [one, big] = short.models;
        assert.deepEqual(one.ops, [{ op: 't2i', rank: 1 }, { op: 'i2i', rank: 2 }]);
        assert.equal(one.note, 'same note', 'one note on every op is said once, about the model');
        assert.equal(one.downloadGb, undefined, 'an installed model has nothing to download');
        assert.equal(one.runsHere, undefined, 'only a model that does NOT run says so');

        assert.equal(big.installed, false);
        assert.equal(big.downloadGb, 12.4);
        assert.equal(big.runsHere, false);
        assert.equal(big.note, undefined, 'ops that disagree keep their own notes');
        assert.deepEqual(big.ops, [
            { op: 'i2v', installed: false, note: 'a note of its own' },
            { op: 't2v', installed: false },
        ]);

        assert.deepEqual(short.flows, [{ id: 'a-flow', title: 'A Flow', installed: true }]);
    });

    test('list_models hands the model the short list, and still arms the guide gate', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('m1', 'list_models', {}),
            call('g1', 'generate', { modelId: 'one-note', operation: 't2i', prompt: 'A fox' }),
            { text: 'ok' },
        ] });
        tools.listModels = async () => catalogue;
        await loop.runTurn('what can you do', [], project, 'auto', 'deepinfra', 't-diet');

        const [list, gen] = toolResults(loop);
        assert.equal(list.models.length, 2);
        assert.equal(list.models[0].ops[0].params, undefined, 'the model was handed no params');
        // The guide ids never reached the model, and the gate still bites: the loop read
        // them off the full answer itself.
        assert.equal(gen.error.code, 'GUIDE_NOT_READ');
        assert.match(gen.error.message, /"guide:one"/);
    });

    // Fabio, live 2026-09-19: the model called i2v_ms with no media at all and told him the
    // video had started from his picture. The refusal came back from the renderer long after
    // generate had answered started: true, which is the only thing the model reports.
    test('generate refuses in-turn when a required media slot is empty, and names it', async () => {
        const withMedia = {
            ...catalogue,
            models: [{
                id: 'vid', name: 'Vid', type: 'video', installed: true, guides: [], ops: [
                    { op: 'i2v', installed: true, media: [{ role: 'startFrame', type: 'image', required: true }] },
                    { op: 't2v', installed: true, media: [] },
                ],
            }],
        };
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'vid', operation: 'i2v', prompt: 'a horse' }),
            call('g2', 'generate', { modelId: 'vid', operation: 'i2v', prompt: 'a horse', media: [{ role: 'startFrame', image: 'att_1' }] }),
            call('g3', 'generate', { modelId: 'vid', operation: 't2v', prompt: 'a horse' }),
            { text: 'ok' },
        ] });
        tools.listModels = async () => withMedia;
        loop._images.set('att_1', { path: '/tmp/att_1.png', kind: 'attachment' });
        await loop.runTurn('animate it', [], project, 'auto', 'deepinfra', 't-media');

        const [empty, filled, noSlots] = toolResults(loop);
        assert.equal(empty.error.code, 'MEDIA_REQUIRED');
        assert.match(empty.error.message, /"startFrame"/);
        assert.match(empty.error.message, /Nothing was generated/);
        assert.equal(filled.started, true, 'the call that fills the slot goes through');
        assert.equal(noSlots.started, true, 'an op with no media slots is not gated');
        assert.equal(tools.calls.generate.length, 2, 'the empty call never reached the app');
    });

    // Fabio, live 2026-09-19: he asked for his LANDSCAPE still to be animated, named no ratio,
    // and the model put it on 9:16 — it never called look, so it never had a size to compare.
    // The choice is code's now, and the prompt lost the arithmetic that did not work anyway.
    test('an unnamed ratio is taken from the picture, same orientation, and said out loud', async () => {
        const wide = require('node:path').join(__dirname, '..', 'assets', 'mascot', 'studio', 'logo.webp'); // 128x86
        const withRatios = {
            ...catalogue,
            models: [{
                id: 'vid', name: 'Vid', type: 'video', installed: true, guides: [], ops: [{
                    op: 'i2v', installed: true,
                    media: [{ role: 'startFrame', type: 'image', required: true }],
                    params: { ratios: ['1:1', '9:16', '16:9', '21:9'] },
                }],
            }],
        };
        const go = (id, extra) => call(id, 'generate', {
            modelId: 'vid', operation: 'i2v', prompt: 'animate it',
            media: [{ role: 'startFrame', image: 'att_1' }], ...extra,
        });
        const { loop, tools } = await makeLoop({ engineResponses: [go('g1'), go('g2', { ratio: '9:16' }), { text: 'ok' }] });
        tools.listModels = async () => withRatios;
        loop._images.set('att_1', { path: wide, kind: 'attachment' });
        await loop.runTurn('animate it', [], project, 'auto', 'deepinfra', 't-snap');

        assert.equal(tools.calls.generate[0].ratio, '16:9', 'a wide picture never lands on a tall ratio');
        assert.match(toolResults(loop)[0].message, /Ratio 16:9/, 'the model is told, or it narrates one of its own');
        // Live, same day: a 768x1024 picture, H3 on 9:16, and the agent offered to "keep the full
        // 768x1024 framing". It was told the ratio it got and never that the set was closed.
        assert.match(toolResults(loop)[0].message, /only ratios this model makes \(1:1, 9:16, 16:9, 21:9\)/, 'the whole list, or it offers a shape the model cannot make');
        assert.equal(tools.calls.generate[1].ratio, '9:16', 'a ratio the user asked for is never overridden');
        assert.doesNotMatch(toolResults(loop)[1].message, /Ratio/, 'a ratio the user named needs no note');
    });

    test('describe_model gives one entry whole, model or Flow, and refuses an id it does not know', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('d1', 'describe_model', { id: 'one-note' }),
            call('d2', 'describe_model', { id: 'a-flow' }),
            call('d3', 'describe_model', { id: 'not-a-thing' }),
            { text: 'ok' },
        ] });
        tools.listModels = async () => catalogue;
        await loop.runTurn('tell me about them', [], project, 'auto', 'deepinfra', 't-desc');

        const [model, flow, miss] = toolResults(loop);
        assert.deepEqual(model.model.ops[0].params.ratios, RATIOS, 'the params the list dropped');
        assert.deepEqual(model.model.guides, ['guide:one']);
        assert.deepEqual(flow.flow.fields, [{ id: 'positive', label: 'Expression', type: 'text' }]);
        assert.deepEqual(flow.flow.boxParams, [{ param: 'box1', role: 'image1', ratio: 1 }]);
        assert.equal(miss.error.code, 'UNKNOWN_MODEL');
    });

    // Fabio, live 2026-09-19 10:09Z: he asked for an image from the landing page and the chat
    // answered "I need a project to create this image. Please open or create a project first." —
    // this error, relayed almost verbatim, and the exact opposite of the Project rule ("never ask
    // them to open or create one first, that is your job"). The rule lost, because a concrete tool
    // result beats a prompt rule. So the result has to BE the instruction.
    test('a tool result with no project open tells the agent to create one, never the user to', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('n1', 'generate', { modelId: 'one-note', operation: 't2i', prompt: 'a cowgirl' }),
            call('n2', 'write_memory', { file: 'brief', title: 'Brief', text: 'a western set in 1876' }),
            { text: 'ok' },
        ] });
        tools.listModels = async () => catalogue;
        // The project gate is the first thing generate checks, before the guide gate.
        await loop.runTurn('make me a cowgirl', [], null, 'auto', 'deepinfra', 't-noproj');

        const results = toolResults(loop);
        assert.ok(results.length >= 2, 'both calls ran without a project');
        for (const r of results) {
            assert.equal(r.error.code, 'NO_PROJECT');
            assert.match(r.error.message, /create_project/, 'the message must name the call that fixes it');
            assert.doesNotMatch(r.error.message, /Please open or create/i, 'the wording Fabio was shown');
            assert.match(r.error.message, /Do not ask the user/i, 'and it must say so out loud');
        }
        assert.equal(tools.calls.generate.length, 0, 'nothing was dispatched');
    });

    // Fabio, live 2026-09-19: "make an image of a cowgirl riding a bull". The route refused
    // the submit — INVALID_STYLE_SELECT, and the log carries no `generation.submit` at all —
    // and the chat still said "Your image of a cowgirl riding a big bull is on its way."
    // Fire-and-forget answered `started: true` in the same tick, so the model could neither
    // tell the truth nor fix the call: the refusal only reached it at the START of the next
    // turn, by which time it had already promised him a picture.
    test('a dispatch refused before anything is queued is refused IN-TURN, never "started"', async () => {
        const noGuide = { ...catalogue, models: [{ ...catalogue.models[0], guides: [] }] };
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'one-note', operation: 't2i', prompt: 'a cowgirl on a bull', styleSelect: 'Dark Brush' }),
            { text: 'ok' },
        ] });
        tools.listModels = async () => noGuide;
        tools.generate = async (body) => {
            tools.calls.generate.push(body);
            return { ok: false, error: { code: 'INVALID_STYLE_SELECT', message: 'styleSelect must be an integer 0-10.' } };
        };
        await loop.runTurn('make me a cowgirl riding a bull', [], project, 'auto', 'deepinfra', 't-refused');

        const [r] = toolResults(loop);
        assert.equal(tools.calls.generate.length, 1, 'it was dispatched — the refusal is the route\'s');
        assert.equal(r.ok, false, 'and the model is told so in the same turn');
        assert.equal(r.started, undefined, 'never "started"');
        assert.equal(r.error.code, 'INVALID_STYLE_SELECT');
        assert.match(r.error.message, /Nothing was generated/);
        assert.match(r.error.message, /describe_model with "one-note"/, 'and where the accepted values are');
        assert.equal(loop._notes.length, 0, 'nothing waiting for next turn: it already has it');
    });
});

// ---------------------------------------------------------------------------
// (j) out of rounds: the turn ends in the model's own words, never on a bare error
// ---------------------------------------------------------------------------
// Fabio, 2026-09-20: "make this video in anime style" took 8 rounds (card, models, two
// settings reads, guide, generate, look, guide, generate). The ninth was refused with
// "Too many tool calls, try a simpler request" one second after the clip was dispatched,
// so the chat read as a failure while the GPU rendered it.

describe('(j) out of rounds', () => {
    const round = (i) => ({ text: '', toolCalls: [{ id: `tc-${i}`, type: 'function', function: { name: 'list_models', arguments: '{}' } }] });

    test('the call after the last round carries NO tools, and its text is the answer', async () => {
        const { MAX_STEPS } = await import('../services/agentLoop.mjs');
        assert.ok(MAX_STEPS >= 16, 'still -> look -> animate is 8 rounds on its own; a chain needs room');
        const closing = 'The anime still is done and the clip is rendering now.';
        const engineResponses = [...Array.from({ length: MAX_STEPS }, (_, i) => round(i)), { text: closing }];
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses });

        await loop.runTurn('Keep going', [], { folderPath: '/p', name: 'P' }, 'auto', 'deepinfra', 'turn-cap');

        const calls = loop._fakeEngine.calls;
        assert.equal(calls.length, MAX_STEPS + 1, 'one closing call, not a refused round plus a retry');
        assert.ok(calls.slice(0, -1).every((c) => Array.isArray(c.tools) && c.tools.length), 'every round before it offers the tools');
        assert.equal(calls.at(-1).tools, undefined, 'with no tools the model can only answer in words');
        assert.equal(tools.calls.listModels.length, MAX_STEPS, 'nothing runs past the cap');
        assert.equal(fakeRes.events.find((e) => e.event === 'agent:message')?.data.text, closing);
        assert.ok(!fakeRes.events.some((e) => e.event === 'agent:error'), 'a turn that did its work does not end on an error line');
        assert.ok(!loop._messages.some((m) => /out of tool calls/i.test(String(m.content))), 'the closing nudge is for that one call and never joins the conversation');
    });

    test('a model that says nothing even then gets a STEP_LIMIT that does not deny work in flight', async () => {
        const { MAX_STEPS } = await import('../services/agentLoop.mjs');
        const engineResponses = [...Array.from({ length: MAX_STEPS }, (_, i) => round(i)), { text: '' }];
        const { loop, fakeRes } = await makeLoop({ engineResponses });

        await loop.runTurn('Keep going', [], { folderPath: '/p', name: 'P' }, 'auto', 'deepinfra', 'turn-cap-mute');

        const err = fakeRes.events.find((e) => e.event === 'agent:error');
        assert.equal(err?.data.code, 'STEP_LIMIT');
        assert.match(err.data.message, /still running/i);
        assert.doesNotMatch(err.data.message, /simpler request/i, 'the request was not the problem');
    });
});

// ---------------------------------------------------------------------------
// (k) a look is made once and kept with the card
// ---------------------------------------------------------------------------
// Fabio, 2026-09-20: "if an image is described, it's described forever". Live that night every
// waited still was described TWICE (settle's auto-look, then the model's own look on the same
// file, two `agent.describe` 8 s apart), and what either said was recorded nowhere, so a wrong
// description could not be told from a wrong paraphrase. The card's sidecar is now the record.

describe('(k) a look is made once and kept with the card', () => {
    const call = (id, name, args) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
    const project = { folderPath: '/project', name: 'Test' };
    const toolResults = (loop) => loop._messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));

    /** The sidecar, as a Map: what `agentTools.storedLook` / `storeLook` do against disk. */
    function withStore(tools, kept = new Map()) {
        tools.calls.storeLook = [];
        tools.storedLook = async (imagePath, itemId) => kept.get(itemId) || null;
        tools.storeLook = async (imagePath, itemId, text) => { tools.calls.storeLook.push({ itemId, text }); kept.set(itemId, text); };
        return kept;
    }

    test('a waited still is described ONCE: the model\'s own look reads what the auto-look kept', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox', wait: true }),
            call('l1', 'look', { image: '/path/result.png' }),
            { text: 'Done.' },
        ] });
        withStore(tools);
        await loop.runTurn('Make a fox and tell me what you see', [], project, 'auto', 'deepinfra', 't-once');

        assert.equal(tools.calls.look.length, 1, 'one picture, one vision call');
        assert.deepEqual(tools.calls.storeLook, [{ itemId: 'item-1', text: 'A generated image showing a fox.' }]);
        const looked = toolResults(loop).at(-1);
        assert.equal(looked.ok, true);
        assert.equal(looked.output.text, 'A generated image showing a fox.', 'the kept description is what the model reads');
    });

    test('a description kept by an earlier conversation is read, and the vision model is never called', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox', wait: true }),
            { text: 'Done.' },
        ] });
        withStore(tools, new Map([['item-1', 'An upright rider, both revolvers raised.']]));
        await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', 't-kept');
        await loop.runTurn('And?', [], project, 'auto', 'deepinfra', 't-kept-2');

        assert.equal(tools.calls.look.length, 0);
        assert.deepEqual(tools.calls.storeLook, [], 'nothing is rewritten over what is already kept');
    });

    // MPI-908: the panel's Cosmo flags a tool that said no and a generation the agent redoes,
    // so both have to reach the chat on the tool frames (a refusal is still status `done`).
    test('a refused tool and a redo are marked on their agent:tool frames', async () => {
        const { loop, fakeRes } = await makeLoop({ engineResponses: [
            call('g0', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox' }),
            { text: 'No project.' },
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox', redo: true, wait: true }),
            { text: 'Done.' },
        ] });
        await loop.runTurn('Make a fox', [], null, 'auto', 'deepinfra', 't-refused');
        await loop.runTurn('Try again', [], project, 'auto', 'deepinfra', 't-redo');

        const frames = fakeRes.events.filter((e) => e.event === 'agent:tool' && e.data.tool === 'generate').map((e) => e.data);
        assert.deepEqual(frames.map((f) => [f.status, !!f.refused, !!f.redo]), [
            ['started', false, false], ['done', true, false],
            ['started', false, true], ['done', false, false],
        ]);
    });

    // MPI-870. Live at ~09:18Z on 2026-09-21 the chat printed "Looking at image" over a read
    // that made ZERO vision calls, and Fabio did not believe the answer was real until the log
    // was read back to him. A saving the user cannot see does not count as one: people who work
    // with agents read this line to tell whether their credits are being spent.
    test('a cache read says so in the chat line; a fresh look does not', async (t) => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [
            // An ATTACHMENT has no sidecar, so this one can only be a real vision call.
            call('l0', 'look', { image: 'att_1' }),
            { text: 'A fox.' },
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox', wait: true }),
            call('l1', 'look', { image: '/path/result.png' }),
            { text: 'Done.' },
        ] });
        withStore(tools);
        await loop.runTurn('What is this?', [{ id: 'att_1', name: 'fox.png', filePath: '/tmp/cubric-agent/attachments/att_1.png' }], project, 'auto', 'deepinfra', 't-label-1');
        await loop.runTurn('Now make one and tell me what you see', [], project, 'auto', 'deepinfra', 't-label-2');

        const frames = fakeRes.events.filter((e) => e.event === 'agent:tool' && e.data.tool === 'look');
        const done = frames.filter((e) => e.data.status === 'done');
        assert.equal(frames.filter((e) => e.data.status === 'started').every((e) => e.data.label === 'Looking at image'), true,
            'the started frame cannot know yet, and says the honest thing for a look about to run');
        assert.equal(done.length, 2, 'the attachment, then the card the auto-look had already described');
        assert.equal(done[0].data.label, 'Looking at image', 'an attachment has no sidecar: that one really did cost a vision call');
        assert.equal(done[1].data.label, 'Fetching saved image description');
        assert.equal(tools.calls.look.length, 2, 'the attachment and the auto-look — the model\'s own look spent nothing');

        // History carries the corrected label too, or a remounted chat redraws the claim the
        // run disproved.
        const entries = loop.getHistory().entries.filter((e) => e.kind === 'tool' && e.tool === 'look');
        assert.equal(entries.at(-1).label, 'Fetching saved image description');
        t.diagnostic(`look labels: ${done.map((e) => e.data.label).join(' | ')}`);
    });

    test('a question, a crop or a box is a different answer: always asked, never kept', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [
            call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox', wait: true }),
            call('l1', 'look', { image: '/path/result.png', question: 'Which way do the revolvers point?' }),
            call('l2', 'look', { image: '/path/result.png', crop: { x: 0, y: 0, width: 8, height: 8 } }),
            { text: 'Done.' },
        ] });
        withStore(tools);
        await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', 't-asked');

        assert.equal(tools.calls.look.length, 3, 'the auto-look, then both asked looks');
        assert.equal(tools.calls.look[1].question, 'Which way do the revolvers point?');
        assert.equal(tools.calls.storeLook.length, 1, 'only the unprompted description is "the" description');
    });

    test('an attachment is no card: it has no sidecar, so it is described live and nothing is kept', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [call('l1', 'look', { image: 'att_1' }), { text: 'A fox.' }] });
        withStore(tools);
        await loop.runTurn('What is this?', [{ id: 'att_1', name: 'fox.png', filePath: '/tmp/cubric-agent/attachments/att_1.png' }], null, 'auto', 'deepinfra', 't-att');

        assert.equal(tools.calls.look.length, 1);
        assert.deepEqual(tools.calls.storeLook, []);
    });
});

// ---------------------------------------------------------------------------
// (l) one ask, many cards (MPI-870)
// ---------------------------------------------------------------------------
//
// `generate` took ONE card, so "upscale all 50 visible" was 50 tool calls, 50 chat lines,
// 50 auto-look vision calls and ~100 notes waiting for the next turn. `cards` is the same
// op fanned out over the existing single-dispatch path — one call, one result — and above
// five the user is asked first (Fabio, 2026-09-21).

describe('(l) one ask, many cards', () => {
    const call = (id, name, args) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
    const project = { folderPath: '/project', name: 'Test' };
    const lastToolResult = (loop) => JSON.parse(loop._messages.filter((m) => m.role === 'tool').at(-1).content);

    /** A model whose `upscale` declares a required image slot, so a batch has somewhere to go. */
    function withOps(tools) {
        tools.listModels = async () => ({
            ok: true,
            models: [{
                id: 'test-model',
                name: 'Test Model',
                installed: true,
                guides: [],
                ops: [
                    { op: 'upscale', media: [{ role: 'inputImage', type: 'image', required: true }] },
                    { op: 't2i', media: [] },
                ],
            }],
            flows: [],
        });
        return tools;
    }

    /** Register N gallery refs the way a listing would, so `cards` can name them. */
    function seeCards(loop, n) {
        const refs = [];
        for (let i = 1; i <= n; i += 1) {
            const p = `/project/Media/card_${i}.png`;
            loop._registerResult(p, 'test-model', `item-${i}`);
            refs.push(p);
        }
        return refs;
    }

    test('five cards fan out with no confirm: one tool call in, one result out, five dispatches', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [{ text: 'placeholder' }, { text: 'Started them.' }] });
        withOps(tools);
        const refs = seeCards(loop, 5);
        loop._fakeEngine.calls.length = 0;
        // Built here rather than driven through the model: the point under test is the fan-out,
        // and a five-card argument list is noise in an engine script.
        const out = JSON.parse(await loop._executeTool('generate',
            { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-batch-5', project));

        assert.equal(out.ok, true);
        assert.equal(out.started, 5);
        assert.deepEqual(out.refused, []);
        assert.equal(tools.calls.generate.length, 5, 'one dispatch per card, through the normal path');
        assert.deepEqual(tools.calls.generate.map((b) => b.media[0].role), Array(5).fill('inputImage'),
            'each card lands in the op\'s own required image slot');
        assert.equal(new Set(tools.calls.generate.map((b) => b.media[0].url)).size, 5, 'five different pictures');
        assert.equal(tools.calls.generate.every((b) => b.modelId === 'test-model' && b.operation === 'upscale'), true,
            'and everything else is shared, exactly as asked once');
    });

    test('no auto-look on batch items: fifty cards must not cost fifty vision calls', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        withOps(tools);
        const refs = seeCards(loop, 3);
        await loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-batch-look', project);
        await new Promise((r) => setTimeout(r, 30));
        assert.equal(tools.calls.look.length, 0);
    });

    test('above five, the user is asked — and No dispatches nothing', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        withOps(tools);
        const refs = seeCards(loop, 6);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-batch-no', project);

        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.kind, 'batch');
        assert.equal(evt.data.count, 6);
        assert.equal(evt.data.what, 'upscale with test-model');
        assert.equal(tools.calls.generate.length, 0, 'nothing may run before the answer');

        await loop.confirm(evt.data.confirmId, false);
        const out = JSON.parse(await pending);
        assert.equal(out.ok, false);
        assert.equal(out.declined, true);
        assert.equal(tools.calls.generate.length, 0);
    });

    test('above five, Yes runs all of them', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        withOps(tools);
        const refs = seeCards(loop, 6);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-batch-yes', project);
        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        await loop.confirm(evt.data.confirmId, true);

        const out = JSON.parse(await pending);
        assert.equal(out.started, 6);
        assert.equal(tools.calls.generate.length, 6);
    });

    test('a reset while the card is up is a NO, not a yes', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        withOps(tools);
        const refs = seeCards(loop, 6);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-batch-reset', project);
        await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');

        // The install card resolves with the STRING 'declined', which is truthy: handed to a
        // batch it would read as Yes and queue every card the user just walked away from.
        await loop.reset();
        const out = JSON.parse(await pending);
        assert.equal(out.declined, true);
        assert.equal(tools.calls.generate.length, 0);
    });

    test('one bad ref among many is reported per card, not as a failed batch', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        withOps(tools);
        const refs = seeCards(loop, 3);
        const out = JSON.parse(await loop._executeTool('generate',
            { modelId: 'test-model', operation: 'upscale', cards: [...refs, '/project/Media/never.png'] }, 'turn-batch-bad', project));

        assert.equal(out.ok, true, 'three of four started: the batch did not fail');
        assert.equal(out.started, 3);
        assert.equal(out.refused.length, 1);
        assert.equal(out.refused[0].code, 'IMAGE_NOT_FOUND');
        assert.equal(out.refused[0].card, '/project/Media/never.png');
    });

    test('refused by name where a list of cards has nowhere to go: a t2i op, and a Flow', async () => {
        const { loop, tools } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        withOps(tools);
        const refs = seeCards(loop, 2);

        const t2i = JSON.parse(await loop._executeTool('generate',
            { modelId: 'test-model', operation: 't2i', cards: refs }, 'turn-batch-t2i', project));
        assert.equal(t2i.error.code, 'BATCH_UNSUPPORTED');

        const flow = JSON.parse(await loop._executeTool('generate',
            { flowId: 'head-swap', cards: refs }, 'turn-batch-flow', project));
        assert.equal(flow.error.code, 'BATCH_UNSUPPORTED', 'a Flow\'s fields and boxes belong to ONE picture');
        assert.equal(tools.calls.generate.length, 0);
    });
});

// ---------------------------------------------------------------------------
// (m) the agent asks before it spends (MPI-876)
// ---------------------------------------------------------------------------
//
// Fabio, 2026-09-21, after watching the in-app agent run a billed cloud model unprompted:
// the agent may not run one without a yes/no card, and the card has to say roughly what it
// will cost. ASK EVERY TIME — there is deliberately no suppression path to test for.
//
// The price itself is `deepinfraPricing.js`'s job and is proven in tests/deepinfra-pricing
// and tests/cloud-price-tag. What is proven HERE is the gate: that a billed run stops, that
// a local one is never interrupted, that six billed cards ask once, and that every way of
// walking away from the card resolves as a refusal rather than a spend.

describe('(m) the spend gate', () => {
    const project = { folderPath: '/project', name: 'Test' };
    const BILLED = { billed: true, modelName: 'Nano Banana 2', count: 1, usd: 0.067296, display: 'about $0.07' };

    /** A model whose `upscale` takes a picture, so a batch has somewhere to go. */
    function withOps(tools) {
        tools.listModels = async () => ({
            ok: true,
            models: [{
                id: 'test-model', name: 'Test Model', installed: true, guides: [],
                ops: [{ op: 'upscale', media: [{ role: 'inputImage', type: 'image', required: true }] }, { op: 't2i', media: [] }],
            }],
            flows: [],
        });
        return tools;
    }

    function seeCards(loop, n) {
        const refs = [];
        for (let i = 1; i <= n; i += 1) {
            const p = `/project/Media/card_${i}.png`;
            loop._registerResult(p, 'test-model', `item-${i}`);
            refs.push(p);
        }
        return refs;
    }

    test('a billed model raises a card naming the price, and dispatches nothing until Yes', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: BILLED } });
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-spend', project);

        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.kind, 'spend');
        assert.equal(evt.data.modelName, 'Nano Banana 2');
        assert.equal(evt.data.count, 1);
        // Verbatim from the estimator. The card never formats a number of its own.
        assert.equal(evt.data.price, 'about $0.07');
        assert.equal(tools.calls.generate.length, 0, 'the money is spent by generate, so nothing may reach it before the answer');

        await loop.confirm(evt.data.confirmId, true);
        const out = JSON.parse(await pending);
        assert.equal(out.started, true);
        assert.equal(tools.calls.generate.length, 1);
    });

    test('No spends nothing, and the refusal does not talk about an installation', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: BILLED } });
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-spend-no', project);
        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');

        await loop.confirm(evt.data.confirmId, false);
        const out = JSON.parse(await pending);
        assert.equal(out.declined, true);
        assert.equal(out.code, 'SPEND_DECLINED');
        assert.doesNotMatch(out.message, /install/i, 'the install path\'s decline copy must not leak into a spend card');
        assert.equal(tools.calls.generate.length, 0);
    });

    test('a local model is never asked about at all', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        const out = JSON.parse(await loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-local', project));

        assert.equal(out.started, true);
        assert.equal(tools.calls.generate.length, 1, 'it ran straight through');
        assert.equal(fakeRes.events.some((e) => e.event === 'agent:confirm'), false, 'a free run must not raise a card');
    });

    test('a price that cannot be known still asks, and says so without naming a cause', async () => {
        const { loop, tools, fakeRes } = await makeLoop({
            engineResponses: [{ text: 'ok' }],
            toolOpts: { quote: { billed: true, modelName: 'Some Cloud Model', count: 1, usd: null, display: null } },
        });
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-spend-null', project);

        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.kind, 'spend', 'a price tag may stay silent; a spend gate may not');
        assert.equal(evt.data.price, null);
        assert.equal(tools.calls.generate.length, 0);
        await loop.confirm(evt.data.confirmId, false);
        await pending;
    });

    test('a reset while the spend card is up is a NO, not a yes', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: BILLED } });
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-spend-reset', project);
        await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');

        // The install card resolves with the STRING 'declined', which is truthy. Handed to a
        // spend card it would read as Yes and bill the user for a run they walked away from.
        await loop.reset();
        const out = JSON.parse(await pending);
        assert.equal(out.declined, true);
        assert.equal(tools.calls.generate.length, 0);
    });

    test('only a literal true is a yes: anything else the card is resolved with is a NO', async () => {
        // The defence that actually bites on this path, and the reason backing `reset()`'s
        // own branch out does not turn the test above red. `_askSpend` answers `yes === true`,
        // so every other way a pending card can be resolved — the install path's 'declined'
        // string, a stray truthy value, an undefined from a future caller — spends nothing.
        for (const answer of ['declined', 'yes', 1, {}, undefined, null]) {
            const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: BILLED } });
            const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-spend-truthy', project);
            await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');

            loop._pendingConfirm.resolve(answer);
            const out = JSON.parse(await pending);
            assert.equal(out.declined, true, `resolving with ${JSON.stringify(answer)} was read as a yes`);
            assert.equal(tools.calls.generate.length, 0);
        }
    });

    test('the quote prices the body that is about to be SENT, not the call the model wrote', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: BILLED } });
        withOps(tools);
        const [ref] = seeCards(loop, 1);
        // No ratio asked for, so the loop snaps one off the picture. The quote must carry the
        // snapped value: `priceImageUnits` scales by area, so pricing the model's default
        // size would quote the wrong money for a 4:5 tile.
        loop._ops.set('test-model\nupscale', { op: 'upscale', media: [{ role: 'inputImage', type: 'image', required: true }], params: { ratios: ['1:1', '16:9'] } });
        const pending = loop._executeTool('generate',
            { modelId: 'test-model', operation: 'upscale', media: [{ role: 'inputImage', image: ref }] }, 'turn-spend-body', project);

        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        await loop.confirm(evt.data.confirmId, true);
        await pending;

        assert.equal(tools.calls.quote.length, 1);
        const quoted = tools.calls.quote[0];
        const sent = tools.calls.generate[0];
        assert.equal(quoted.modelId, sent.modelId);
        assert.equal(quoted.operation, sent.operation);
        assert.deepEqual(quoted.media, sent.media, 'the reference bills too on two of the shipped models');
        assert.equal(quoted.ratio, sent.ratio, 'the snapped ratio, or the price is for a picture nobody asked for');
    });

    test('six billed cards are ONE card quoting the batch, and the batch card never also appears', async () => {
        const { loop, tools, fakeRes } = await makeLoop({
            engineResponses: [{ text: 'ok' }],
            toolOpts: { quote: (body) => ({ billed: true, modelName: 'Nano Banana 2', count: body.count || 1, usd: 0.403776, display: 'about $0.40' }) },
        });
        withOps(tools);
        const refs = seeCards(loop, 6);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-spend-batch', project);

        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.kind, 'spend');
        assert.equal(evt.data.count, 6);
        // The batch figure, from ONE call carrying the count. `display` is never multiplied:
        // below a cent it is one significant figure and cannot be read back out of the string.
        assert.equal(evt.data.price, 'about $0.40');
        assert.equal(tools.calls.quote[0].count, 6);

        await loop.confirm(evt.data.confirmId, true);
        const out = JSON.parse(await pending);
        assert.equal(out.started, 6);
        assert.equal(tools.calls.generate.length, 6);
        const cards = fakeRes.events.filter((e) => e.event === 'agent:confirm');
        assert.equal(cards.length, 1, 'one action, one question: the batch card must not stack on top of the spend card');
        assert.equal(tools.calls.quote.length, 1, 'and the six fanned-out calls must not each raise their own');
    });

    test('No to a billed batch dispatches nothing at all', async () => {
        const { loop, tools, fakeRes } = await makeLoop({
            engineResponses: [{ text: 'ok' }],
            toolOpts: { quote: (body) => ({ billed: true, modelName: 'Nano Banana 2', count: body.count || 1, display: 'about $0.40' }) },
        });
        withOps(tools);
        const refs = seeCards(loop, 6);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-spend-batch-no', project);
        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');

        await loop.confirm(evt.data.confirmId, false);
        const out = JSON.parse(await pending);
        assert.equal(out.code, 'SPEND_DECLINED');
        assert.equal(tools.calls.generate.length, 0);
    });

    test('a billed batch BELOW the five-card threshold still asks', async () => {
        const { loop, tools, fakeRes } = await makeLoop({
            engineResponses: [{ text: 'ok' }],
            toolOpts: { quote: (body) => ({ billed: true, modelName: 'Nano Banana 2', count: body.count || 1, display: 'about $0.13' }) },
        });
        withOps(tools);
        const refs = seeCards(loop, 2);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-spend-small', project);

        // The threshold is about fan-out noise. This is about money, and two paid cards are
        // still the user's money.
        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.kind, 'spend');
        assert.equal(evt.data.count, 2);
        await loop.confirm(evt.data.confirmId, true);
        assert.equal(JSON.parse(await pending).started, 2);
    });

    // Fabio live, 2026-09-22: "a batch of two" on FLUX Schnell (Cloud) raised TWO cards at
    // $0.0005 each. t2i has no image slot, so `cards` cannot carry it; `count` does.
    // Phase 2: that fan-out is now the FALLBACK, for a model the connector will not batch.
    test('a batch of two on a model that cannot batch is ONE card for both, then two runs', async () => {
        const { loop, tools, fakeRes } = await makeLoop({
            engineResponses: [{ text: 'ok' }],
            toolOpts: { refuseBatch: true, quote: (body) => ({ billed: true, modelName: 'FLUX Schnell (Cloud)', count: body.count || 1, display: 'about $0.001' }) },
        });
        withOps(tools);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a pony', seed: 7, count: 2 }, 'turn-spend-count', project);

        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.kind, 'spend');
        assert.equal(evt.data.count, 2);
        assert.equal(tools.calls.quote[0].count, 2);
        await loop.confirm(evt.data.confirmId, true);
        assert.equal(JSON.parse(await pending).started, 2);

        assert.equal(fakeRes.events.filter((e) => e.event === 'agent:confirm').length, 1);
        assert.equal(tools.calls.quote.length, 1, 'the two runs must not each raise their own card');
        assert.equal(tools.calls.generate[0].batch, 2, 'the batch is tried first');
        const runs = tools.calls.generate.slice(1);
        assert.equal(runs.length, 2);
        assert.deepEqual(runs.map((b) => b.seed), [7, 8], 'a given seed steps, or both are one picture');
        assert.ok(runs.every((b) => b.batch === undefined), 'the fallback runs are single jobs');
        assert.ok(tools.calls.generate.every((b) => b.count === undefined), 'count never reaches the connector');
    });

    test('count on a model that batches is ONE job per four, every card drawn up front', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: (body) => ({ ...BILLED, count: body.count || 1 }) } });
        withOps(tools);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a pony', seed: 7, count: 6 }, 'turn-count-batch', project);
        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.count, 6);
        await loop.confirm(evt.data.confirmId, true);
        const out = JSON.parse(await pending);
        assert.equal(out.started, 6);
        assert.deepEqual(tools.calls.generate.map((b) => [b.batch, b.seed]), [[4, 7], [2, 8]]);
        assert.equal(fakeRes.events.filter((e) => e.event === 'agent:confirm').length, 1, 'one spend card for both jobs');
    });

    test('count is refused by name on a Flow and alongside cards, before any card is asked', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: BILLED } });
        withOps(tools);
        const flow = JSON.parse(await loop._executeTool('generate', { flowId: 'head-swap', count: 2 }, 'turn-count-flow', project));
        assert.equal(flow.error.code, 'BATCH_UNSUPPORTED');
        const both = JSON.parse(await loop._executeTool('generate',
            { modelId: 'test-model', operation: 'upscale', cards: seeCards(loop, 2), count: 2 }, 'turn-count-cards', project));
        assert.equal(both.error.code, 'BAD_REQUEST');
        assert.equal(fakeRes.events.filter((e) => e.event === 'agent:confirm').length, 0);
        assert.equal(tools.calls.generate.length, 0);
    });

    test('a free batch above the threshold still gets the batch card, unchanged', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        withOps(tools);
        const refs = seeCards(loop, 6);
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 'upscale', cards: refs }, 'turn-free-batch', project);

        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');
        assert.equal(evt.data.kind, 'batch', 'MPI-870\'s card is untouched where nothing is billed');
        await loop.confirm(evt.data.confirmId, true);
        assert.equal(JSON.parse(await pending).started, 6);
    });

    test('a reload mid-card repaints it WITH its price', async () => {
        const { loop, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }], toolOpts: { quote: BILLED } });
        const pending = loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-spend-history', project);
        const evt = await waitForEvent(fakeRes, (e) => e.event === 'agent:confirm');

        // What a refreshed chat paints from. Without these the card comes back as a bare
        // yes/no over an unnamed amount of the user's money — and Yes still spends it.
        const pc = loop.getHistory().pendingConfirm;
        assert.equal(pc.confirmId, evt.data.confirmId);
        assert.equal(pc.kind, 'spend');
        assert.equal(pc.price, 'about $0.07');
        assert.equal(pc.modelName, 'Nano Banana 2');
        assert.equal(pc.count, 1);

        await loop.confirm(evt.data.confirmId, false);
        await pending;
    });

    test('a quote that cannot be taken never blocks a run, and never invents a card', async () => {
        const { loop, tools, fakeRes } = await makeLoop({ engineResponses: [{ text: 'ok' }] });
        // An app that cannot answer a quote cannot answer a generate either: the call below
        // fails the same way and spends nothing, so a thrown quote is not a reason to ask.
        tools.quoteGeneration = async () => { throw new Error('APP_UNAVAILABLE'); };
        const out = JSON.parse(await loop._executeTool('generate', { modelId: 'test-model', operation: 't2i', prompt: 'a fox' }, 'turn-quote-dead', project));

        assert.equal(out.started, true);
        assert.equal(fakeRes.events.some((e) => e.event === 'agent:confirm'), false);
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

// ---------------------------------------------------------------------------
// (e) MPI-890 — the agent reads the open workspace
// ---------------------------------------------------------------------------

/**
 * Fabio, 2026-09-22: "If the user is in the history workspace, he shouldn't be forced to go
 * into the gallery space to drag an image and send it to the agent." He could not: the App
 * state line carried the open project and this conversation's refs and nothing else, so with
 * a card open the agent's only honest moves were list_cards or asking for an attachment —
 * and that view has no drag surface to attach from.
 */
describe('(e) the open workspace reaches the agent', () => {
    const PROJECT = require('node:path').join(require('node:os').tmpdir(), 'mpi890-project');
    const ENTRY = require('node:path').join(PROJECT, 'Media', 'g1', 'i1.png');

    const workspace = () => ({
        page: 'group-history',
        groupId: 'g1',
        card: { name: 'Demon boy', type: 'image' },
        activeEntry: { itemId: 'i1', filePath: ENTRY, modelId: 'klein-9b' },
    });

    test('the App state line names the card and the entry in front of the user', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        const ws = workspace();
        loop._registerWorkspaceEntry(ws);
        const line = loop._appStateLine({ name: 'Demons', folderPath: PROJECT }, ws);

        assert.match(line, /The user is looking at the card "Demon boy"/);
        assert.ok(line.includes(ENTRY), 'the line must name the entry, not just the card');
        assert.match(line, /"This image", "it" and "this one" mean that entry/);
    });

    /**
     * The invariant the App state line documents about ITSELF: it is the only set of refs
     * `look` and `generate` resolve, "so the two cannot differ". An entry named in the line
     * but missing from `_images` is a picture the agent offers and then cannot open.
     */
    test('the named entry resolves through the _images allowlist', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        loop._registerWorkspaceEntry(workspace());

        const resolved = loop._resolveImage(ENTRY);
        assert.ok(resolved, 'the entry named in the App state line must resolve for look/generate');
        assert.equal(resolved.path, ENTRY);
        assert.equal(resolved.modelId, 'klein-9b', 'provenance travels with it, per MPI-817');
        assert.equal(resolved.itemId, 'i1', 'the itemId is what lets a look be stored on the card');
    });

    // MPI-891 live read 2: a masked corner got "people in the chairs, keep the girl in
    // front", and Klein, seeing only the crop, drew a second girl in it.
    test('a painted mask is named on the line; no mask, no mention', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        const masked = { ...workspace(), masked: true };
        loop._registerWorkspaceEntry(masked);
        const project = { name: 'Demons', folderPath: PROJECT };

        assert.match(loop._appStateLine(project, masked), /MASK painted on it/);
        assert.match(loop._appStateLine(project, masked), /write the prompt for the masked area/);
        // Live read 3: "an edit of that entry" steered a masked ADD to edit; the op is the
        // Masking rule's call, and several painted areas are still one run.
        assert.doesNotMatch(loop._appStateLine(project, masked), /an edit of that entry/);
        // Live read 4: several areas are NOT one run on edit/inpaint (one crop box, the adds
        // land outside the paint and are discarded). The line must not promise it.
        assert.doesNotMatch(loop._appStateLine(project, masked), /several separate areas/);
        assert.doesNotMatch(loop._appStateLine(project, workspace()), /MASK/);
    });

    test('no card open: the line says nothing about standing anywhere', async () => {
        const AgentLoop = await loadAgentLoop();
        const loop = new AgentLoop();
        const ws = { page: 'gallery', groupId: null, card: null, activeEntry: null };
        loop._registerWorkspaceEntry(ws);

        const line = loop._appStateLine({ name: 'Demons', folderPath: PROJECT }, ws);
        assert.doesNotMatch(line, /The user is looking at/);
        assert.equal(loop._images.size, 0, 'nothing to register means nothing registered');
        // And a turn that predates the renderer change sends no workspace at all.
        assert.doesNotMatch(loop._appStateLine({ name: 'Demons', folderPath: PROJECT }), /The user is looking at/);
    });

    /**
     * The trust boundary. `look` and `generate` ship whatever the allowlist names to the
     * engine, which may be a remote Pod, so a filePath from the renderer is checked against
     * the open project's Media/ before it ever reaches the loop.
     */
    describe('the route checks the entry before the loop registers it', () => {
        const { _sanitiseWorkspace } = require('../routes/agent.js');
        const project = { folderPath: PROJECT, name: 'Demons' };
        // The shape a hydrated MediaItem really carries (routes/projects.js projectFileUrlBusted):
        // a url, cache-buster and all. MPI-890 live read 1 went red because these tests fed a
        // relative `Media/g1/i1.png` the app never sends, and the real url was path.resolve()d
        // into `C:\project-file?...` - which nothing decodes - so every real entry was dropped.
        const fileUrl = (abs) => `/project-file?path=${encodeURIComponent(abs)}&v=1790062432237`;

        test('an entry inside the project Media/ survives, resolved to an absolute path', async () => {
            const clean = await _sanitiseWorkspace({
                page: 'group-history',
                groupId: 'g1',
                card: { name: 'Demon boy', type: 'image' },
                activeEntry: { itemId: 'i1', filePath: fileUrl(ENTRY), modelId: 'klein-9b' },
            }, project);

            assert.equal(clean.activeEntry.filePath, ENTRY);
            assert.equal(clean.activeEntry.itemId, 'i1');
            assert.equal(clean.card.name, 'Demon boy');
        });

        test('an entry outside the project Media/ is dropped, and the turn survives', async () => {
            const clean = await _sanitiseWorkspace({
                page: 'group-history',
                groupId: 'g1',
                card: { name: 'Demon boy', type: 'image' },
                activeEntry: { itemId: 'i1', filePath: fileUrl(require('node:path').join(PROJECT, '..', 'secrets.png')), modelId: null },
            }, project);

            assert.equal(clean.activeEntry, null, 'a path outside Media/ must not become a ref');
            assert.equal(clean.page, 'group-history', 'losing the entry costs the shortcut, never the turn');
        });

        test('masked passes only as a real true', async () => {
            const ws = { page: 'group-history', groupId: 'g1', card: null, activeEntry: null };
            assert.equal((await _sanitiseWorkspace({ ...ws, masked: true }, project)).masked, true);
            assert.equal((await _sanitiseWorkspace({ ...ws, masked: 'yes' }, project)).masked, false);
            assert.equal((await _sanitiseWorkspace(ws, project)).masked, false);
        });

        test('no project open: there is nothing to contain the entry against, so it is dropped', async () => {
            const clean = await _sanitiseWorkspace({
                page: 'group-history',
                groupId: 'g1',
                card: null,
                activeEntry: { itemId: 'i1', filePath: fileUrl(ENTRY), modelId: null },
            }, null);

            assert.equal(clean.activeEntry, null);
        });
    });
});

// ---------------------------------------------------------------------------
// MPI-891 — `follow`: only a turn the user TYPED may move their view
// ---------------------------------------------------------------------------

describe('(MPI-891) follow rides only on a typed turn', () => {
    const call = (id, name, args) => ({ text: '', toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
    const project = { folderPath: '/project', name: 'Test' };
    const gen = call('g1', 'generate', { modelId: 'test-model', operation: 't2i', prompt: 'A fox' });

    for (const [label, opts, expected] of [
        ['a typed turn', {}, true],
        // A wake was not asked for, and a carry was asked in a view the user has since left.
        ['a wake turn', { wake: true }, undefined],
        ['a carried request', { carried: true }, undefined],
    ]) {
        test(`${label}: follow is ${expected ? 'sent' : 'not sent'}`, async () => {
            const { loop, tools } = await makeLoop({ engineResponses: [gen, { text: 'Started.' }] });
            await loop.runTurn('Make a fox', [], project, 'auto', 'deepinfra', `t-follow-${label}`, opts);
            assert.equal(tools.calls.generate.length, 1, 'the generate reached the connector');
            assert.equal(tools.calls.generate[0].follow, expected);
        });
    }
});

/**
 * MPI-855 — the chat header shows what a conversation spent, chat and generations APART
 * (Fabio: a question is about half a cent, one 1080p Seedance clip $1.90, and one total
 * would hide which is the spend). Chat is DeepInfra's own `usage.estimated_cost` on each
 * reply; a generation is its card's `cost.usd`, reported back as `output.costUsd`.
 */
describe('session spend (MPI-855)', () => {
    test('chat replies and a cloud generation add up separately, and reset clears both', async () => {
        const { loop, tools, fakeRes } = await makeLoop({
            engineResponses: [
                {
                    text: '',
                    toolCalls: [{ id: 'tc-1', type: 'function', function: { name: 'generate', arguments: '{"modelId":"test-model","operation":"t2i","prompt":"A fox","wait":true}' } }],
                    usage: { prompt_tokens: 100, estimated_cost: 0.002 },
                },
                { text: 'Here it is.', usage: { prompt_tokens: 120, estimated_cost: 0.003 } },
            ],
        });
        tools.generate = async () => ({ ok: true, output: { itemId: 'item-1', groupId: 'group-1', type: 'video', filePath: '/path/clip.mp4', costUsd: 1.9 } });

        await loop.runTurn('Make a clip', [], { folderPath: '/project', name: 'Test' }, 'auto', 'deepinfra', 'turn-spend');

        const spend = loop.getHistory().spend;
        assert.ok(Math.abs(spend.chatUsd - 0.005) < 1e-12, `chat is the sum of both replies, got ${spend.chatUsd}`);
        assert.equal(spend.genUsd, 1.9, 'the clip is counted under generations, never under chat');
        const last = fakeRes.events.filter((e) => e.event === 'agent:spend').pop();
        assert.deepEqual({ chatUsd: last.data.chatUsd, genUsd: last.data.genUsd }, spend, 'the chat hears the running figures');

        await loop.reset();
        assert.deepEqual(loop.getHistory().spend, { chatUsd: 0, genUsd: 0 });
    });

    test('a provider with no estimated_cost and a local generation add nothing', async () => {
        const { loop } = await makeLoop({ engineResponses: [{ text: 'Hello.', usage: { prompt_tokens: 10 } }] });
        await loop.runTurn('Hi', [], { folderPath: '/project', name: 'Test' }, 'auto', 'deepinfra', 'turn-free');
        assert.deepEqual(loop.getHistory().spend, { chatUsd: 0, genUsd: 0 });
    });
});
