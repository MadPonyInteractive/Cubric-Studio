'use strict';

/**
 * MPI-965 - the community agent benchmark, app side: `services/benchCommunity.mjs`.
 *
 * The Worker (mpi-ci/cubric-bench) and this file build against ONE contract (v1): the record the
 * app POSTs, the scores it reads. Every network call here is a stubbed global `fetch`, so nothing
 * leaves the machine and the real service is never touched.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The GPU probe logs through routes/logger, which resolves its file at load: keep this run out of the developer's app.log.
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-community-'));

const BASE = 'https://bench.example';

/** Run `fn` with the service pointed at `base` ('off' switches it off), restoring the environment after. */
async function withBase(base, fn) {
    const prev = process.env.CUBRIC_BENCH_URL;
    if (base === undefined) delete process.env.CUBRIC_BENCH_URL; else process.env.CUBRIC_BENCH_URL = base;
    try { return await fn(); } finally {
        if (prev === undefined) delete process.env.CUBRIC_BENCH_URL; else process.env.CUBRIC_BENCH_URL = prev;
    }
}

/** Replace global fetch with `handler(url, init)` for the duration of `fn`; returns the calls it saw. */
async function withFetch(handler, fn) {
    const real = global.fetch;
    const calls = [];
    global.fetch = async (url, init) => { calls.push({ url: String(url), init }); return handler(String(url), init); };
    try { await fn(calls); } finally { global.fetch = real; }
    return calls;
}

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const RESULTS = [
    { id: 'case-a', title: 'A', passed: true, failures: [] },
    { id: 'case-b', title: 'B', passed: false, failures: ['called generate with /Users/someone/secret.png'] },
];

test('buildRecord: EXACTLY the contract v1 record, and never a failure text', async () => {
    const { buildRecord } = await import('../services/benchCommunity.mjs');
    const { APP_VERSION } = await import('../js/core/appVersion.js');
    const record = buildRecord({ preset: 'deepinfra', model: 'acme/m', suite: 'abcdef012345', results: RESULTS, perChat: 0.0036, secPerCase: 12.34 });
    assert.deepEqual(record, {
        v: 1, preset: 'deepinfra', model: 'acme/m', suite: 'abcdef012345',
        results: [{ id: 'case-a', pass: true }, { id: 'case-b', pass: false }],
        perChat: 0.0036, app: APP_VERSION, secPerCase: 12.3,
    });
    assert.ok(!JSON.stringify(record).includes('secret'), 'the failure lines (model-chosen paths and ids) never leave the machine');
    assert.equal('gpu' in record, false, 'a hosted model has no gpu key at all');
});

test('buildRecord: gpu only for ollama, name capped at 80, secPerCase inside 0..3600', async () => {
    const { buildRecord } = await import('../services/benchCommunity.mjs');
    const base = { model: 'gemma4:12b', suite: 'abcdef012345', results: RESULTS, perChat: 0 };
    const local = buildRecord({ ...base, preset: 'ollama', secPerCase: 99999, gpu: { name: 'N'.repeat(200), vramGb: 12 } });
    assert.deepEqual(local.gpu, { name: 'N'.repeat(80), vramGb: 12 });
    assert.equal(local.secPerCase, 3600);
    assert.equal(local.perChat, 0);
    // A hosted preset given a gpu anyway (the server would 400 it): the record drops it.
    assert.equal('gpu' in buildRecord({ ...base, preset: 'openrouter', secPerCase: 1, gpu: { name: 'x', vramGb: 1 } }), false);
    // Ollama on a machine whose card is unknown: no gpu key, not a null.
    assert.equal('gpu' in buildRecord({ ...base, preset: 'ollama', secPerCase: 1, gpu: null }), false);
});

test('every case id in the shipped suite fits the contract (a bad id would 400 every share)', async () => {
    const { CASES } = await import('../services/agentBench.mjs');
    const ids = CASES.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
    for (const id of ids) assert.match(id, /^[a-z0-9-]{1,64}$/, id);
    assert.ok(ids.length >= 1 && ids.length <= 100);
});

test('runErrored: a connection that failed reads as errored; a model that merely failed does not', async () => {
    const { runErrored } = await import('../services/benchCommunity.mjs');
    const fail = (line) => [{ id: 'x', passed: false, failures: [line] }];
    assert.equal(runErrored(RESULTS), false, 'a plain failure is a score');
    assert.equal(runErrored([{ id: 'x', passed: true, failures: [] }]), false);
    assert.equal(runErrored(fail('agent:error ENDPOINT_ERROR: HTTP 402')), true, 'a 402 or a dead host');
    assert.equal(runErrored(fail('agent:error NO_KEY: No API key')), true);
    assert.equal(runErrored(fail('crashed: boom')), true);
    assert.equal(runErrored([...RESULTS, ...fail('crashed: boom')]), true, 'one such case is enough');
    // The model looped: that is the MODEL's failure, and it is the score of a weak model, not a dead connection.
    assert.equal(runErrored(fail('agent:error STEP_LIMIT: I ran out of steps for this turn.')), false);
});

test('shareRun POSTs the record as JSON to /v1/runs and answers ok on 201', async () => {
    const { shareRun, buildRecord } = await import('../services/benchCommunity.mjs');
    const record = buildRecord({ preset: 'deepinfra', model: 'acme/m', suite: 'abcdef012345', results: RESULTS, perChat: null, secPerCase: 3 });
    await withBase(BASE, async () => {
        let out;
        const calls = await withFetch(async () => reply(201, { ok: true }), async () => { out = await shareRun(record); });
        assert.deepEqual(out, { ok: true });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, `${BASE}/v1/runs`);
        assert.equal(calls[0].init.method, 'POST');
        assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(calls[0].init.body), record);
        assert.ok(calls[0].init.signal, 'a timeout rides along: nothing waits on the service forever');
    });
});

test('shareRun never throws: a refusal, a rate limit, a dead host and a switched-off service are each { ok: false, error }', async () => {
    const { shareRun } = await import('../services/benchCommunity.mjs');
    const record = { v: 1 };
    await withBase(BASE, async () => {
        const cases = [
            [async () => reply(429, { ok: false, error: 'RATE_LIMIT' }), /limit/i],
            [async () => reply(400, { ok: false, error: 'results: duplicate id' }), /400.*duplicate id/],
            [async () => reply(413, {}), /413/],
            [async () => reply(502, null), /502/],
            [async () => { throw new TypeError('fetch failed'); }, /reach bench\.example/],
            [async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }, /reach bench\.example/],
        ];
        for (const [handler, expected] of cases) {
            let out;
            await withFetch(handler, async () => { out = await shareRun(record); });
            assert.equal(out.ok, false);
            assert.match(out.error, expected);
        }
    });
    await withBase('off', async () => {
        let out;
        const calls = await withFetch(async () => reply(201, {}), async () => { out = await shareRun(record); });
        assert.equal(out.ok, false);
        assert.match(out.error, /off/i);
        assert.equal(calls.length, 0, 'off means no network at all');
    });
});

test('the base is the constant, CUBRIC_BENCH_URL overrides it, off disables it', async () => {
    const { benchBase } = await import('../services/benchCommunity.mjs');
    await withBase(undefined, () => assert.equal(benchBase(), 'https://bench.cubric.studio'));
    await withBase('http://127.0.0.1:8787/', () => assert.equal(benchBase(), 'http://127.0.0.1:8787'));
    await withBase('off', () => assert.equal(benchBase(), null));
});

const SUITE = 'abcdef012345';
const SCORES = {
    suite: SUITE,
    models: [
        { preset: 'deepinfra', model: 'acme/agent-pick', runs: 9, passed: 24, cases: 28, perChat: 0.0036 },
        { preset: 'ollama', model: 'acme/agent-pick', runs: 4, passed: 10, cases: 28, perChat: 0 },
    ],
};

test('communityScores: one GET per suite a day; a failure is remembered ten minutes; null on any failure', async () => {
    const { communityScores, resetCommunityCache } = await import('../services/benchCommunity.mjs');
    const realNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    try {
        await withBase(BASE, async () => {
            resetCommunityCache();
            let calls = await withFetch(async () => reply(200, SCORES), async () => {
                assert.deepEqual(await communityScores(SUITE), SCORES);
                now += 23 * 3600_000;
                assert.deepEqual(await communityScores(SUITE), SCORES, 'still cached after 23 h');
            });
            assert.equal(calls.length, 1);
            assert.equal(calls[0].url, `${BASE}/v1/scores?suite=${SUITE}`);
            assert.ok(calls[0].init.signal, 'the 3 s timeout');
            calls = await withFetch(async () => reply(200, SCORES), async () => {
                now += 2 * 3600_000;
                await communityScores(SUITE);
            });
            assert.equal(calls.length, 1, 'read again after 24 h');

            resetCommunityCache();
            calls = await withFetch(async () => { throw new TypeError('fetch failed'); }, async () => {
                assert.equal(await communityScores(SUITE), null, 'a dead host is null, never a throw');
                now += 9 * 60_000;
                assert.equal(await communityScores(SUITE), null);
            });
            assert.equal(calls.length, 1, 'a failure is not retried for ten minutes');
            calls = await withFetch(async () => reply(200, SCORES), async () => {
                now += 2 * 60_000;
                assert.deepEqual(await communityScores(SUITE), SCORES);
            });
            assert.equal(calls.length, 1, 'and is tried again after them');

            // Each bad answer is null (and a fresh cache so each one is actually asked).
            for (const handler of [async () => reply(500, {}), async () => reply(200, null), async () => reply(200, { models: 'no' }), async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } })]) {
                resetCommunityCache();
                await withFetch(handler, async () => assert.equal(await communityScores(SUITE), null));
            }
        });
        await withBase('off', async () => {
            resetCommunityCache();
            const calls = await withFetch(async () => reply(200, SCORES), async () => assert.equal(await communityScores(SUITE), null));
            assert.equal(calls.length, 0, 'off means no network at all');
        });
    } finally { Date.now = realNow; }
});

test('communityScores: keeps only well-formed rows with at least 3 runs, and never asks for a suite that is not a hash', async () => {
    const { communityScores, resetCommunityCache } = await import('../services/benchCommunity.mjs');
    await withBase(BASE, async () => {
        resetCommunityCache();
        const dirty = { suite: SUITE, models: [
            SCORES.models[0],
            { preset: 'deepinfra', model: 'two-runs', runs: 2, passed: 9, cases: 28, perChat: null },
            { preset: 'custom', model: 'not-a-preset', runs: 5, passed: 9, cases: 28, perChat: null },
            { preset: 'openai', model: 'over', runs: 5, passed: 30, cases: 28, perChat: null },
            { preset: 'openai', model: 'no-cases', runs: 5, passed: 0, cases: 0, perChat: null },
            { preset: 'openai', model: 42, runs: 5, passed: 1, cases: 28, perChat: null },
            { preset: 'openai', model: 'bad-cost', runs: 5, passed: 1, cases: 28, perChat: 'free' },
            { preset: 'openai', model: 'no-cost', runs: 5, passed: 1, cases: 28, perChat: null },
            null,
        ] };
        await withFetch(async () => reply(200, dirty), async () => {
            const got = await communityScores(SUITE);
            assert.deepEqual(got.models.map((m) => m.model), ['acme/agent-pick', 'no-cost']);
        });
        resetCommunityCache();
        const calls = await withFetch(async () => reply(200, SCORES), async () => {
            assert.equal(await communityScores('../../etc'), null);
            assert.equal(await communityScores(undefined), null);
        });
        assert.equal(calls.length, 0);
    });
});

test('withCommunity: a row gets communityTest by preset AND exact model id, on the current suite; the rest are untouched', async () => {
    const { withCommunity, resetCommunityCache } = await import('../services/benchCommunity.mjs');
    const { suiteHash } = await import('../services/agentBench.mjs');
    const suite = suiteHash();
    const rows = () => [
        { id: 'acme/agent-pick', contextWindow: null, agentTest: null },
        { id: 'acme/Agent-Pick', contextWindow: null, agentTest: null },
        { id: 'other', contextWindow: null, agentTest: { passed: 1, cases: 2, runs: 1, perChat: 0 } },
    ];
    await withBase(BASE, async () => {
        resetCommunityCache();
        let asked = null;
        await withFetch(async (url) => { asked = url; return reply(200, { suite, models: SCORES.models }); }, async () => {
            const merged = await withCommunity('deepinfra', rows());
            assert.equal(asked, `${BASE}/v1/scores?suite=${suite}`, 'asked for the suite THIS app ships');
            assert.deepEqual(merged, [
                { id: 'acme/agent-pick', contextWindow: null, agentTest: null, communityTest: { passed: 24, cases: 28, runs: 9, perChat: 0.0036, suiteHash: suite } },
                { id: 'acme/Agent-Pick', contextWindow: null, agentTest: null },
                { id: 'other', contextWindow: null, agentTest: { passed: 1, cases: 2, runs: 1, perChat: 0 } },
            ]);
            // The same model id on Ollama is another row of the service: it reads its own.
            const local = await withCommunity('ollama', rows());
            assert.deepEqual(local[0].communityTest, { passed: 10, cases: 28, runs: 4, perChat: 0, suiteHash: suite });
        });
        // A connection that is not one of the four presets never even asks.
        resetCommunityCache();
        const calls = await withFetch(async () => reply(200, SCORES), async () => {
            assert.deepEqual(await withCommunity('custom', rows()), rows());
        });
        assert.equal(calls.length, 0);
        // The service down: today's rows, unchanged.
        resetCommunityCache();
        await withFetch(async () => { throw new TypeError('fetch failed'); }, async () => {
            assert.deepEqual(await withCommunity('deepinfra', rows()), rows());
        });
    });
});

test('localGpu: the machine\'s card as { name, vramGb }, or null when it cannot be read', async () => {
    const { localGpu } = await import('../services/benchCommunity.mjs');
    const gpu = await localGpu();
    if (gpu === null) return;
    assert.equal(typeof gpu.name, 'string');
    assert.ok(gpu.name.length > 0 && gpu.name.length <= 80);
    assert.ok(Number.isInteger(gpu.vramGb) && gpu.vramGb >= 0 && gpu.vramGb <= 512);
});
