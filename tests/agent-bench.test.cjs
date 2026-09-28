'use strict';

/**
 * MPI-941 Phase 12 — the agent suite ships, so Settings can run it on the user's own model.
 *
 * `services/agentBench.mjs` holds the cases, the fake tools and the fixtures; the portable build
 * drops `scripts/` and `tests/` (`build-portable.mjs` APP_COPY_EXCLUDES), so nothing it loads may
 * live there. `runSuite` runs every case once against the REAL loop; here the model is scripted.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BENCH = path.join(ROOT, 'services', 'agentBench.mjs');

test('the shipped suite loads nothing the portable build drops', () => {
    const src = fs.readFileSync(BENCH, 'utf8');
    // `from '...'`, `import('...')`, and `createRequire(import.meta.url)('...')`.
    const specs = [...src.matchAll(/(?:from\s+|import\(|\)\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.ok(specs.length > 5, 'the import scan found the imports');
    const dropped = specs.filter((s) => /(^|\/)(scripts|tests)\//.test(s));
    assert.deepEqual(dropped, [], 'an import under scripts/ or tests/ is missing from every installed app');
    for (const f of ['connector-models.json', 'looks.json']) {
        assert.ok(fs.existsSync(path.join(ROOT, 'services', 'agentBench', f)), `fixture ${f} ships beside the module`);
    }
});

test('runSuite runs each case once, reports each as it lands, sums the cost, and stops between cases', async () => {
    const { CASES, runSuite, suiteHash } = await import('../services/agentBench.mjs');
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const realChat = DeepInfraEngine.prototype.chat;
    let calls = 0;
    // A model that answers every request in words: no tool is ever called.
    DeepInfraEngine.prototype.chat = async () => { calls++; return { text: 'Done.', usage: { prompt_tokens: 10, estimated_cost: 0.001 } }; };
    const opts = {
        loopOptions: {
            resolveEndpoint: async () => ({ profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'https://api.deepinfra.com/v1/openai' }, key: 'fake-key' }),
            lookupContextWindow: async () => 1_048_576,
        },
        profileId: 'deepinfra',
        model: 'test-model',
    };
    try {
        const cases = CASES.slice(0, 3);
        const seen = [];
        const r = await runSuite({ ...opts, cases, onProgress: (c) => seen.push(c.id) });
        assert.deepEqual(seen, cases.map((c) => c.id), 'one progress event per case, in order');
        assert.equal(r.results.length, 3);
        assert.equal(r.cases, 3);
        assert.equal(r.stopped, false);
        assert.equal(r.passed, r.results.filter((x) => x.passed).length);
        assert.ok(r.results.some((x) => !x.passed && x.failures.length), 'a model that never calls a tool fails a case');
        assert.ok(Math.abs(r.costUsd - calls * 0.001) < 1e-9, 'cost is the provider\'s own estimated_cost, summed');
        assert.equal(r.suiteHash, suiteHash(cases));
        assert.notEqual(suiteHash(cases), suiteHash(CASES), 'a different set of cases is a different suite');

        const stop = new AbortController();
        const partial = await runSuite({ ...opts, cases, signal: stop.signal, onProgress: () => stop.abort() });
        assert.equal(partial.results.length, 1, 'Stop ends the run after the case in flight');
        assert.equal(partial.stopped, true);
    } finally {
        DeepInfraEngine.prototype.chat = realChat;
    }
});

test('suiteHash names the TESTS, not the model catalogue they carry', async () => {
    const { CASES, suiteHash } = await import('../services/agentBench.mjs');
    // A model note edit (modelPriority.js) moved the old hash with no test changed: every score read "older tests".
    const recatalogued = CASES.map((c) => ({ ...c, setup: { ...c.setup, models: { models: [] } } }));
    assert.equal(suiteHash(recatalogued), suiteHash(CASES));
    const reworded = CASES.map((c, i) => (i ? c : { ...c, setup: { ...c.setup, turns: ['something else'] } }));
    assert.notEqual(suiteHash(reworded), suiteHash(CASES), 'a changed turn is a different test');
});

/** Sessions over a scripted model, with every event on the agent stream collected; `onEvent` runs as it is written. */
async function benchSessions(resolveEndpoint, onEvent = () => {}) {
    const { AgentSessions } = await import('../services/agentSessions.mjs');
    const setUp = [];
    // The app's setupLoop hands each loop the fork bridge, which is where the saved key comes from.
    const sessions = new AgentSessions({ loopOptions: { resolveEndpoint, lookupContextWindow: async () => 1_048_576 }, setupLoop: (l) => setUp.push(l) });
    sessions.setUp = setUp;
    const events = [];
    const waiters = [];
    sessions.addSubscriber({
        write(payload) {
            const event = /^event: (.+)$/m.exec(payload)[1];
            const e = { event, data: JSON.parse(/^data: (.+)$/m.exec(payload)[1]) };
            events.push(e);
            onEvent(e, sessions);
            for (const w of waiters.splice(0)) w();
        },
    });
    const until = async (pred) => { while (!pred(events)) await new Promise((r) => waiters.push(r)); };
    return { sessions, events, until };
}

const ENDPOINT = async () => ({ profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'https://api.deepinfra.com/v1/openai' }, key: 'fake-key' });

/** Calls the tool on the probe's one-tool request (so it passes "Test tool use"), answers in words otherwise. */
const probeThenWords = async (req) => (req.tools?.length === 1
    ? { text: '', toolCalls: [{ id: 'p', type: 'function', function: { name: 'list_models', arguments: '{}' } }] }
    : { text: 'Done.', usage: { prompt_tokens: 10, estimated_cost: 0.001 } });

test('AgentSessions.benchmark: one at a time, each case on the agent stream in order, Stop ends it', async () => {
    const { CASES } = await import('../services/agentBench.mjs');
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const realChat = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = probeThenWords;
    try {
        let status = null;
        // The user's Stop on the second case, as it is reported.
        const { sessions, events, until } = await benchSessions(ENDPOINT, (e, s) => {
            if (e.event === 'bench:case' && e.data.done === 2) { status = s.benchmarkStatus(); s.stopBenchmark(); }
        });
        const first = await sessions.benchmark('deepinfra', 'test-model');
        assert.deepEqual(first, { ok: true, cases: CASES.length });
        const second = await sessions.benchmark('deepinfra', 'test-model');
        assert.equal(second.error?.code, 'BUSY', 'a second run is refused while one runs');

        await until((ev) => ev.some((e) => e.event === 'bench:done'));
        assert.deepEqual(status, { profileId: 'deepinfra', model: 'test-model', done: 2, passed: status.passed, cases: CASES.length },
            'the running totals are readable for a remounted Settings');

        const bench = events.filter((e) => e.event.startsWith('bench:'));
        assert.deepEqual(bench.map((e) => e.event), ['bench:case', 'bench:case', 'bench:done'], 'Stop ends it after the case in flight');
        assert.deepEqual(bench.map((e) => e.data.done), [1, 2, 2]);
        assert.deepEqual(bench[0].data.last.id, CASES[0].id);
        const done = bench[2].data;
        assert.equal(done.stopped, true);
        assert.equal(done.cases, CASES.length);
        assert.equal(done.model, 'test-model');
        assert.equal(done.profileId, 'deepinfra');
        assert.ok(done.costUsd > 0);
        assert.ok(Math.abs(done.perChat - done.costUsd / 2) < 1e-12, 'perChat = cost over the conversations run');
        assert.equal(typeof done.suiteHash, 'string');
        assert.equal(sessions.setUp.length, 3, 'the probe loop and each case\'s loop got the app\'s setup (the key)');
        assert.equal(sessions.benchmarkStatus(), null, 'free again once it ends');
    } finally {
        DeepInfraEngine.prototype.chat = realChat;
    }
});

test('AgentSessions.benchmark: a connection that cannot answer ends on bench:error, not a 0 score', async () => {
    const { sessions, events, until } = await benchSessions(async () => ({ profile: null, key: null }));
    assert.equal((await sessions.benchmark('deepinfra', 'test-model')).ok, true);
    await until((ev) => ev.some((e) => e.event === 'bench:error' || e.event === 'bench:done'));
    const bench = events.filter((e) => e.event.startsWith('bench:'));
    assert.deepEqual(bench.map((e) => e.event), ['bench:error']);
    assert.match(bench[0].data.message, /Connection not found/);
    assert.equal(sessions.benchmarkStatus(), null);
});

test('AgentSessions.benchmark: a model that fails "Test tool use" is not run (it would fail almost every test, and bill for it)', async () => {
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const realChat = DeepInfraEngine.prototype.chat;
    let calls = 0;
    DeepInfraEngine.prototype.chat = async () => { calls++; return { text: 'I cannot use tools.' }; };
    try {
        const { sessions, events, until } = await benchSessions(ENDPOINT);
        assert.equal((await sessions.benchmark('deepinfra', 'test-model')).ok, true);
        await until((ev) => ev.some((e) => e.event === 'bench:error' || e.event === 'bench:done'));
        const bench = events.filter((e) => e.event.startsWith('bench:'));
        assert.deepEqual(bench.map((e) => e.event), ['bench:error']);
        assert.match(bench[0].data.message, /did not call a tool/);
        assert.equal(calls, 1, 'the probe only');
    } finally {
        DeepInfraEngine.prototype.chat = realChat;
    }
});

test('POST /agent/benchmark refuses a local model while a render holds this PC\'s GPU', async () => {
    const http = require('node:http');
    const express = require('express');
    const comfy = http.createServer((req, res) => res.end(JSON.stringify({ queue_running: [[1, 'p']], queue_pending: [] })));
    await new Promise((r) => comfy.listen(0, '127.0.0.1', r));
    const prev = process.env.CUBRIC_COMFY_URL;
    process.env.CUBRIC_COMFY_URL = `http://127.0.0.1:${comfy.address().port}`;
    const app = express();
    app.use(express.json());
    app.use(require('../routes/agent'));
    const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/agent/benchmark`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((r) => r.json());
    try {
        assert.equal((await post({ model: 'x' })).error?.code, 'BAD_REQUEST');
        assert.equal((await post({ profileId: 'ollama', model: 'gemma4:12b' })).error?.code, 'GPU_BUSY');
    } finally {
        server.close();
        comfy.close();
        if (prev === undefined) delete process.env.CUBRIC_COMFY_URL; else process.env.CUBRIC_COMFY_URL = prev;
    }
});
