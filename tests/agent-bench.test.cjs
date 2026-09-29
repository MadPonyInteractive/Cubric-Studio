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
        assert.deepEqual(status, { profileId: 'deepinfra', model: 'test-model', done: 2, passed: status.passed, cases: CASES.length, results: status.results },
            'the running totals are readable for a remounted Settings');
        assert.equal(status.results.length, 2, 'and each test\'s pass or fail, in order, for the bar\'s steps');
        assert.equal(status.results.filter(Boolean).length, status.passed);

        const bench = events.filter((e) => e.event.startsWith('bench:'));
        assert.deepEqual(bench.map((e) => e.event), ['bench:case', 'bench:case', 'bench:done'], 'Stop ends it after the case in flight');
        assert.deepEqual(bench.map((e) => e.data.done), [1, 2, 2]);
        assert.deepEqual(bench[0].data.last.id, CASES[0].id);
        assert.deepEqual(bench[1].data.results, [bench[0].data.last.passed, bench[1].data.last.passed], 'each case carries every result so far');
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

// ---------------------------------------------------------------------------
// MPI-965 - sharing the result, and the clean-run check
// ---------------------------------------------------------------------------

const BENCH_URL = 'https://bench.example';

/**
 * Run `fn` with the community service at BENCH_URL and global fetch stubbed: `reply(url, init)` answers the
 * bench service, and any OTHER url is a failure (the benchmark itself reaches the model through the engine
 * stub, never fetch), so a test can never leave the machine. `log` collects 'POST' as it lands.
 */
async function withBench(reply, fn) {
    const prevUrl = process.env.CUBRIC_BENCH_URL;
    const real = global.fetch;
    const posts = [];
    const order = [];
    process.env.CUBRIC_BENCH_URL = BENCH_URL;
    global.fetch = async (url, init) => {
        if (!String(url).startsWith(BENCH_URL)) throw new Error(`unexpected network call: ${url}`);
        posts.push({ url: String(url), init });
        order.push('POST');
        return reply(String(url), init);
    };
    try { await fn({ posts, order }); } finally {
        global.fetch = real;
        if (prevUrl === undefined) delete process.env.CUBRIC_BENCH_URL; else process.env.CUBRIC_BENCH_URL = prevUrl;
    }
}

const created = () => ({ ok: true, status: 201, json: async () => ({ ok: true }) });

/** A whole run on the scripted model, share as asked; resolves with the bench events and the sessions. */
async function shareRunOf(share, { chat = probeThenWords, endpoint = ENDPOINT, order = [] } = {}) {
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const realChat = DeepInfraEngine.prototype.chat;
    DeepInfraEngine.prototype.chat = chat;
    try {
        const { sessions, events, until } = await benchSessions(endpoint, (e) => { if (e.event === 'bench:done') order.push('bench:done'); });
        assert.equal((await sessions.benchmark('deepinfra', 'test-model', { share })).ok, true);
        await until((ev) => ev.some((e) => e.event === 'bench:done' || e.event === 'bench:error'));
        return { sessions, events, done: events.find((e) => e.event === 'bench:done')?.data };
    } finally {
        DeepInfraEngine.prototype.chat = realChat;
    }
}

test('MPI-965: a clean whole run, share on, POSTs exactly the contract record BEFORE bench:done', async () => {
    const { CASES } = await import('../services/agentBench.mjs');
    const { APP_VERSION } = await import('../js/core/appVersion.js');
    await withBench(created, async ({ posts, order }) => {
        const { done, events } = await shareRunOf(true, { order });
        assert.equal(posts.length, 1);
        assert.deepEqual(order.filter((x) => x === 'POST' || x === 'bench:done'), ['POST', 'bench:done'], 'uploaded first, then the stream says so');
        assert.equal(posts[0].url, `${BENCH_URL}/v1/runs`);
        assert.equal(posts[0].init.method, 'POST');
        const body = JSON.parse(posts[0].init.body);
        assert.deepEqual(Object.keys(body).sort(), ['app', 'model', 'perChat', 'preset', 'results', 'secPerCase', 'suite', 'v'], 'no key the service does not know');
        assert.equal(body.v, 1);
        assert.equal(body.preset, 'deepinfra');
        assert.equal(body.model, 'test-model');
        assert.equal(body.suite, done.suiteHash);
        assert.equal(body.app, APP_VERSION);
        assert.deepEqual(body.results.map((r) => r.id), CASES.map((c) => c.id));
        for (const r of body.results) assert.deepEqual(Object.keys(r).sort(), ['id', 'pass']);
        assert.equal(body.results.filter((r) => r.pass).length, done.passed);
        assert.equal(body.perChat, done.perChat);
        assert.equal(typeof body.secPerCase, 'number');
        assert.ok(body.secPerCase >= 0 && body.secPerCase <= 3600);
        assert.equal('gpu' in body, false, 'a hosted model has no gpu');
        assert.ok(!posts[0].init.body.includes('failures'), 'the failure text never leaves the machine');
        // The scripted model fails cases in words the bench wrote: none of it may be in the upload either.
        const failureText = events.filter((e) => e.event === 'bench:case').flatMap((e) => e.data.last.failures).filter(Boolean);
        assert.ok(failureText.length > 0, 'the run did have failure lines');
        for (const line of failureText) assert.ok(!posts[0].init.body.includes(line));
        assert.equal(done.shared, true);
        assert.equal(done.shareError, null);
        assert.equal(done.errored, false);
        assert.equal(done.stopped, false);
    });
});

test('MPI-965: share off (the default), or a share the service refuses, still ends a kept run', async () => {
    await withBench(created, async ({ posts }) => {
        const off = (await shareRunOf(false)).done;
        assert.equal(posts.length, 0, 'nothing is sent unless the tickbox was ticked');
        assert.deepEqual([off.shared, off.shareError, off.errored], [false, null, false]);
    });
    await withBench(async () => { throw new TypeError('fetch failed'); }, async ({ posts }) => {
        const down = (await shareRunOf(true)).done;
        assert.equal(posts.length, 1);
        assert.equal(down.shared, false);
        assert.match(down.shareError, /reach bench\.example/);
        assert.equal(down.errored, false, 'the RUN was clean: only the upload failed, so it is still kept');
        assert.equal(down.stopped, false);
    });
    await withBench(async () => ({ ok: false, status: 429, json: async () => ({ ok: false, error: 'RATE_LIMIT' }) }), async () => {
        const limited = (await shareRunOf(true)).done;
        assert.equal(limited.shared, false);
        assert.match(limited.shareError, /limit/i);
    });
});

test('MPI-965: an errored run (a dead connection reads as a whole run of fails) is neither shared nor kept', async () => {
    // Every chat after the probe fails, as a 402 or a host that went away does: runCase turns each into a failure line.
    const dies = async (req) => {
        if (req.tools?.length === 1) return probeThenWords(req);
        throw Object.assign(new Error('HTTP 402 payment required'), { status: 402 });
    };
    await withBench(created, async ({ posts }) => {
        const { done, events } = await shareRunOf(true, { chat: dies });
        const lines = events.filter((e) => e.event === 'bench:case').map((e) => e.data.last.failures.join('\n'));
        assert.equal(lines.length, done.cases, 'a whole run of fails, which is what it looks like');
        assert.ok(lines.every((l) => /^agent:error|^crashed:/m.test(l)), 'each is the connection, not the model');
        assert.equal(done.errored, true);
        assert.equal(done.stopped, false, 'it ran to the end: errored is its own flag, and agentService keeps a run only when neither is set');
        assert.equal(done.shared, false);
        assert.match(done.shareError, /connection/i);
        assert.equal(posts.length, 0, 'never uploaded');
    });
    // Not asked to share: still errored (so it is not kept locally), and no reason is owed for a share nobody asked for.
    await withBench(created, async ({ posts }) => {
        const { done } = await shareRunOf(false, { chat: dies });
        assert.deepEqual([done.errored, done.shared, done.shareError], [true, false, null]);
        assert.equal(posts.length, 0);
    });
});

test('MPI-965: a stopped run is never shared, and says why', async () => {
    await withBench(created, async ({ posts }) => {
        const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
        const realChat = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = probeThenWords;
        try {
            const { sessions, events, until } = await benchSessions(ENDPOINT, (e, s) => { if (e.event === 'bench:case' && e.data.done === 2) s.stopBenchmark(); });
            await sessions.benchmark('deepinfra', 'test-model', { share: true });
            await until((ev) => ev.some((e) => e.event === 'bench:done'));
            const done = events.find((e) => e.event === 'bench:done').data;
            assert.equal(done.stopped, true);
            assert.equal(done.shared, false);
            assert.match(done.shareError, /stopped/i);
            assert.equal(done.errored, false);
            assert.equal(posts.length, 0);
        } finally {
            DeepInfraEngine.prototype.chat = realChat;
        }
    });
});

test('MPI-965: a connection that is not one of the four presets is never shared; CUBRIC_BENCH_URL=off shares nothing', async () => {
    await withBench(created, async ({ posts }) => {
        const custom = async () => ({ profile: { id: 'my-gateway', name: 'My gateway', baseURL: 'https://gateway.example/v1' }, key: 'fake-key' });
        const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
        const realChat = DeepInfraEngine.prototype.chat;
        DeepInfraEngine.prototype.chat = probeThenWords;
        try {
            const { sessions, events, until } = await benchSessions(custom);
            await sessions.benchmark('my-gateway', 'test-model', { share: true });
            await until((ev) => ev.some((e) => e.event === 'bench:done' || e.event === 'bench:error'));
            const done = events.find((e) => e.event === 'bench:done').data;
            assert.equal(done.shared, false);
            assert.match(done.shareError, /provider/i);
            assert.equal(posts.length, 0);
        } finally {
            DeepInfraEngine.prototype.chat = realChat;
        }
    });
    const prev = process.env.CUBRIC_BENCH_URL;
    process.env.CUBRIC_BENCH_URL = 'off';
    try {
        const { done } = await shareRunOf(true);
        assert.equal(done.shared, false);
        assert.match(done.shareError, /off/i);
    } finally {
        if (prev === undefined) delete process.env.CUBRIC_BENCH_URL; else process.env.CUBRIC_BENCH_URL = prev;
    }
});

test('MPI-965: benchmarkInfo says whether the tickbox shows and where the public page is', async () => {
    const { AgentSessions } = await import('../services/agentSessions.mjs');
    const sessions = new AgentSessions({ loopOptions: {} });
    const prev = process.env.CUBRIC_BENCH_URL;
    process.env.CUBRIC_BENCH_URL = BENCH_URL;
    try {
        // openrouter and custom carry no price fetch, so nothing here reaches the network.
        const or = await sessions.benchmarkInfo('openrouter', 'x');
        assert.deepEqual([or.canShare, or.communityUrl], [true, BENCH_URL]);
        const custom = await sessions.benchmarkInfo('custom', 'x');
        assert.deepEqual([custom.canShare, custom.communityUrl], [false, BENCH_URL], 'no tickbox for Custom, but the page is still there to read');
        process.env.CUBRIC_BENCH_URL = 'off';
        const off = await sessions.benchmarkInfo('openrouter', 'x');
        assert.deepEqual([off.canShare, off.communityUrl], [false, null]);
    } finally {
        if (prev === undefined) delete process.env.CUBRIC_BENCH_URL; else process.env.CUBRIC_BENCH_URL = prev;
    }
});

test('POST /agent/benchmark hands `share` on, and refuses one that is not a boolean', async () => {
    const express = require('express');
    const { AgentSessions } = await import('../services/agentSessions.mjs');
    const realBenchmark = AgentSessions.prototype.benchmark;
    const seen = [];
    AgentSessions.prototype.benchmark = async (...args) => { seen.push(args); return { ok: true, cases: 1 }; };
    const app = express();
    app.use(express.json());
    app.use(require('../routes/agent'));
    const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/agent/benchmark`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((r) => r.json());
    try {
        assert.equal((await post({ profileId: 'deepinfra', model: 'm', share: true })).ok, true);
        assert.equal((await post({ profileId: 'deepinfra', model: 'm' })).ok, true);
        assert.deepEqual(seen, [['deepinfra', 'm', { share: true }], ['deepinfra', 'm', { share: false }]], 'absent means not shared');
        assert.equal((await post({ profileId: 'deepinfra', model: 'm', share: 'yes' })).error?.code, 'BAD_REQUEST');
        assert.equal(seen.length, 2, 'the refused one never started');
    } finally {
        AgentSessions.prototype.benchmark = realBenchmark;
        server.close();
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
