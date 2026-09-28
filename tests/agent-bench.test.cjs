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
