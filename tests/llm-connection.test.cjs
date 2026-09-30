'use strict';

/**
 * MPI-774 — the ONE remote LLM connection every job shares (MPI-737 consumes it).
 *
 * Pins the model list a job row reads (`listRemoteModels`: chat models only,
 * recommended first, the window from wherever the endpoint reports it) and the two
 * job-agnostic routes, `POST /llm/connection/probe` and `GET /llm/connection/models`.
 * The upstream is a stubbed `fetch`, so nothing leaves the machine and no key is spent.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The logger resolves its file at load: keep this run out of the developer's app.log.
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-conn-'));

const llmRouter = require('../routes/llm');

// MPI-965: the models route also asks the community service for scores. No test here is about that
// (the one that is switches it on for its own duration), and an unstubbed GET would reach the real one.
process.env.CUBRIC_BENCH_URL = 'off';

const DI_URL = 'https://api.deepinfra.com/v1/openai';

// A DeepInfra-shaped catalogue: tagged entries, an image model among them.
const CATALOGUE = {
    object: 'list',
    data: [
        { id: 'zeta/chat-model', metadata: { context_length: 131072, tags: ['chat'] } },
        { id: 'black-forest-labs/FLUX-2', metadata: { tags: ['image-gen'] } },
        { id: 'deepseek-ai/DeepSeek-V4-Flash-0731', metadata: { context_length: 1048576, tags: ['chat', 'reasoning'] } },
        { id: 'alpha/vision-model', metadata: { context_length: 65536, tags: ['chat', 'vision'] } },
    ],
};

/** Route requests for the upstream to `upstream(url, init)`; everything else is real. */
function stubUpstream(upstream) {
    const real = global.fetch;
    global.fetch = (url, init) => (String(url).startsWith('http://127.0.0.1') ? real(url, init) : upstream(String(url), init));
    return () => { global.fetch = real; };
}

const okJson = (body) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });

async function withServer(fn) {
    const app = express();
    app.use(express.json());
    app.use(llmRouter);
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
        return await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

/** Run `fn` with DEEPINFRA_API_KEY set to `value` (or removed when undefined). */
async function withEnvKey(value, fn) {
    const prev = process.env.DEEPINFRA_API_KEY;
    if (value === undefined) delete process.env.DEEPINFRA_API_KEY;
    else process.env.DEEPINFRA_API_KEY = value;
    try { return await fn(); } finally {
        if (prev === undefined) delete process.env.DEEPINFRA_API_KEY;
        else process.env.DEEPINFRA_API_KEY = prev;
    }
}

/** Stand in for the Electron main process on the fork bridge. */
async function withBridge(answer, fn) {
    const prevSend = process.send;
    process.send = (msg) => { setImmediate(() => process.emit('message', { ...answer, type: `${msg.type}-response`, id: msg.id })); };
    try { return await fn(); } finally {
        if (prevSend === undefined) delete process.send;
        else process.send = prevSend;
    }
}

test('listRemoteModels: chat models only, recommended first, window and vision from the catalogue', async () => {
    const { listRemoteModels, RECOMMENDED_REMOTE_MODELS } = await import('../services/llmEngines.mjs');
    let auth = null;
    const restore = stubUpstream(async (url, init) => { auth = init.headers.Authorization; assert.equal(url, `${DI_URL}/models`); return okJson(CATALOGUE); });
    try {
        const models = await listRemoteModels({ presetId: 'deepinfra', baseURL: `${DI_URL}/`, key: 'k1' });
        assert.equal(auth, 'Bearer k1');
        assert.deepEqual(models.map((m) => m.id), ['deepseek-ai/DeepSeek-V4-Flash-0731', 'alpha/vision-model', 'zeta/chat-model']);
        assert.deepEqual(models[0], { id: 'deepseek-ai/DeepSeek-V4-Flash-0731', contextWindow: 1048576, vision: false, tools: null, recommendedFor: ['agent'], recommendedNote: null,
            // MPI-912: the suite score and cost per chat ride along for the agent dropdown.
            agentTest: RECOMMENDED_REMOTE_MODELS.deepinfra.find((r) => r.id === 'deepseek-ai/DeepSeek-V4-Flash-0731').agentTest });
        // `recommendedNote` says why THIS one when a job has more than one recommendation.
        // Null unless the table gives a reason - DeepSeek V4 Flash deliberately has none.
        assert.equal(models[1].vision, true);
        assert.deepEqual(models[2].recommendedFor, []);
    } finally { restore(); }
});

test('listRemoteModels: an untagged catalogue (OpenAI, OpenRouter) is kept whole', async () => {
    const { listRemoteModels } = await import('../services/llmEngines.mjs');
    const restore = stubUpstream(async () => okJson({ data: [{ id: 'b-model', context_length: 8192 }, { id: 'a-model' }] }));
    try {
        const models = await listRemoteModels({ presetId: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', key: 'k' });
        assert.deepEqual(models, [
            { id: 'a-model', contextWindow: null, vision: null, tools: null, recommendedFor: [], recommendedNote: null, agentTest: null },
            { id: 'b-model', contextWindow: 8192, vision: null, tools: null, recommendedFor: [], recommendedNote: null, agentTest: null },
        ]);
    } finally { restore(); }
});

test('MPI-912: the Ollama connection and the Ollama enhancer dropdown flag the same local model', async () => {
    const { listRemoteModels } = await import('../services/llmEngines.mjs');
    // Ollama's own /v1/models shape: untagged, ids carry their tag.
    const restore = stubUpstream(async () => okJson({ data: [
        { id: 'huihui_ai/dolphin3-abliterated:latest', object: 'model' },
        { id: 'huihui_ai/gemma-4-abliterated:12b', object: 'model' },
    ] }));
    try {
        const models = await listRemoteModels({ presetId: 'ollama', baseURL: 'http://localhost:11434/v1', key: null });
        assert.deepEqual(models.filter((m) => m.installed !== false).map((m) => [m.id, m.recommendedFor]), [
            ['huihui_ai/gemma-4-abliterated:12b', ['enhance']],
            ['huihui_ai/dolphin3-abliterated:latest', []],
        ]);
    } finally { restore(); }
    await withServer(async (base) => {
        const { models } = await (await fetch(`${base}/llm/models`)).json();
        assert.deepEqual(models.filter((m) => m.recommended).map((m) => m.id), ['gemma-4-abliterated-12b']);
    });
});

test('MPI-941 Phase 11: Ollama rows carry tools and vision from /api/tags; unknown stays null', async () => {
    const { listRemoteModels } = await import('../services/llmEngines.mjs');
    const urls = [];
    const restore = stubUpstream(async (url) => {
        urls.push(url);
        if (url.endsWith('/api/tags')) return okJson({ models: [
            { name: 'ornith:9b', capabilities: ['completion', 'tools', 'thinking'] },
            { name: 'gemma4:12b', capabilities: ['completion', 'vision', 'tools'] },
            { name: 'dolphin:latest', capabilities: ['completion'] },
        ] });
        return okJson({ data: [{ id: 'ornith:9b' }, { id: 'gemma4:12b' }, { id: 'dolphin:latest' }, { id: 'old:7b' }] });
    });
    try {
        const models = await listRemoteModels({ presetId: 'ollama', baseURL: 'http://localhost:11434/v1/', key: null });
        assert.ok(urls.includes('http://localhost:11434/api/tags'), urls.join(', '));
        const by = Object.fromEntries(models.filter((m) => m.installed !== false).map((m) => [m.id, [m.tools, m.vision]]));
        assert.deepEqual(by, {
            'ornith:9b': [true, false], 'gemma4:12b': [true, true], 'dolphin:latest': [false, false],
            // Not in /api/tags (or an Ollama too old to report capabilities): unknown, never hidden.
            'old:7b': [null, null],
        });
        // The local scores ride along like DeepInfra's, and neither becomes the default agent.
        const ornith = models.find((m) => m.id === 'ornith:9b');
        assert.deepEqual([ornith.agentTest, ornith.recommendedFor], [{ passed: 16, cases: 26, runs: 1, perChat: 0 }, []]);
    } finally { restore(); }
    // /api/tags failing costs nothing but the flags.
    const restore2 = stubUpstream(async (url) => (url.endsWith('/api/tags')
        ? { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) }
        : okJson({ data: [{ id: 'ornith:9b' }] })));
    try {
        const models = await listRemoteModels({ presetId: 'ollama', baseURL: 'http://localhost:11434/v1', key: null });
        assert.equal(models.find((m) => m.id === 'ornith:9b').tools, null);
    } finally { restore2(); }
});

test('MPI-993: a recommended model the user\'s Ollama lacks is still listed, installed:false', async () => {
    const { listRemoteModels, RECOMMENDED_REMOTE_MODELS } = await import('../services/llmEngines.mjs');
    const restore = stubUpstream(async (url) => (url.endsWith('/api/tags')
        ? okJson({ models: [] })
        : okJson({ data: [{ id: 'huihui_ai/gemma-4-abliterated:12b' }, { id: 'qwen3.5:latest' }] })));
    try {
        const models = await listRemoteModels({ presetId: 'ollama', baseURL: 'http://localhost:11434/v1', key: null, vramGb: 16 });
        const absent = models.filter((m) => m.installed === false).map((m) => m.id).sort();
        const expected = RECOMMENDED_REMOTE_MODELS.ollama.filter((r) => !r.minVramGb || r.minVramGb <= 16)
            .map((r) => r.id).filter((id) => id !== 'huihui_ai/gemma-4-abliterated:12b').sort();
        assert.deepEqual(absent, expected);
        // An installed row carries no flag at all, so every other preset's rows are unchanged.
        assert.equal('installed' in models.find((m) => m.id === 'huihui_ai/gemma-4-abliterated:12b'), false);
        // The describe recommendation is the Image Describer plugin's own model, offered to download.
        const vl = models.find((m) => m.id === 'huihui_ai/qwen3-vl-abliterated:4b');
        assert.deepEqual([vl.installed, vl.recommendedFor, vl.vision], [false, ['describe'], null]);
        // Recommended first, installed or not.
        assert.equal(models.at(-1).id, 'qwen3.5:latest');
    } finally { restore(); }
});

test('MPI-993: a minVramGb recommendation only on a card that holds it; below, a plain row if installed', async () => {
    const { listRemoteModels } = await import('../services/llmEngines.mjs');
    const list = (data) => stubUpstream(async (url) => (url.endsWith('/api/tags') ? okJson({ models: [] }) : okJson({ data })));
    let restore = list([{ id: 'huihui_ai/gemma-4-abliterated:12b' }]);
    try {
        const at = async (vramGb) => listRemoteModels({ presetId: 'ollama', baseURL: 'http://localhost:11434/v1', key: null, vramGb });
        assert.equal((await at(16)).some((m) => m.id === 'gemma4:26b'), false, 'offered to a 16 GB card');
        assert.equal((await at(null)).some((m) => m.id === 'gemma4:26b'), false, 'offered when the card is unknown');
        // A 4090: offered, flagged for both jobs, and saying why.
        const big = (await at(24)).find((m) => m.id === 'gemma4:26b');
        assert.deepEqual([big.installed, big.recommendedFor, big.recommendedNote], [false, ['enhance', 'describe'], 'for 24 GB cards']);
        // Table order is preference: the 12B stays the enhance default on a big card too.
        assert.equal((await at(24)).find((m) => m.recommendedFor.includes('enhance')).id, 'huihui_ai/gemma-4-abliterated:12b');
    } finally { restore(); }
    // Installed on a small card anyway: listed, never flagged.
    restore = list([{ id: 'gemma4:26b' }]);
    try {
        const m = (await listRemoteModels({ presetId: 'ollama', baseURL: 'http://localhost:11434/v1', key: null, vramGb: 16 })).find((x) => x.id === 'gemma4:26b');
        assert.deepEqual([m.installed, m.recommendedFor], [undefined, []]);
    } finally { restore(); }
});

test('MPI-993: a job\'s first recommended row is the model the server runs for an empty pick', async () => {
    const { listRemoteModels, RECOMMENDED_REMOTE_MODELS, recommendedModel } = await import('../services/llmEngines.mjs');
    // Every DeepInfra recommendation listed, in reverse id order to prove the id sort is gone.
    const data = RECOMMENDED_REMOTE_MODELS.deepinfra.map((r) => ({ id: r.id, metadata: { tags: ['chat'] } })).reverse();
    const restore = stubUpstream(async () => okJson({ data }));
    try {
        const models = await listRemoteModels({ presetId: 'deepinfra', baseURL: DI_URL, key: 'k' });
        for (const job of ['enhance', 'describe', 'agent']) {
            const first = models.find((m) => m.recommendedFor.includes(job))?.id || '';
            assert.equal(first, recommendedModel('deepinfra', job), `${job}: the row shows one model and the server runs another`);
        }
    } finally { restore(); }
});

test('MPI-993: a hosted list is never appended to', async () => {
    const { listRemoteModels } = await import('../services/llmEngines.mjs');
    // DeepInfra's catalogue IS the whole offer.
    const restore2 = stubUpstream(async () => okJson({ data: [{ id: 'zeta/chat-model', metadata: { tags: ['chat'] } }] }));
    try {
        const models = await listRemoteModels({ presetId: 'deepinfra', baseURL: DI_URL, key: 'k' });
        assert.deepEqual(models.map((m) => m.id), ['zeta/chat-model']);
    } finally { restore2(); }
});

test('GET /llm/connection/models answers the list with the connection\'s key', async () => {
    let auth = null;
    const restore = stubUpstream(async (_url, init) => { auth = init.headers.Authorization; return okJson(CATALOGUE); });
    try {
        await withEnvKey('env-key', () => withServer(async (base) => {
            const body = await (await fetch(`${base}/llm/connection/models?profileId=deepinfra`)).json();
            assert.equal(body.ok, true);
            assert.equal(body.profileId, 'deepinfra');
            assert.equal(body.models.length, 3, 'the image model is filtered out');
            assert.deepEqual(body.models[0].recommendedFor, ['agent']);
        }));
        assert.equal(auth, 'Bearer env-key');
    } finally { restore(); }
});

test('MPI-965: GET /llm/connection/models merges the community score by preset and model id; the probe does not ask', async () => {
    const { resetCommunityCache } = await import('../services/benchCommunity.mjs');
    const { suiteHash } = await import('../services/agentBench.mjs');
    const suite = suiteHash();
    const BENCH = 'https://bench.example';
    const asked = [];
    const restore = stubUpstream(async (url) => {
        if (url.startsWith(BENCH)) {
            asked.push(url);
            return okJson({ suite, models: [
                { preset: 'deepinfra', model: 'zeta/chat-model', runs: 5, passed: 20, cases: 28, perChat: 0.002 },
                { preset: 'openai', model: 'alpha/vision-model', runs: 9, passed: 28, cases: 28, perChat: null },
            ] });
        }
        return okJson(CATALOGUE);
    });
    const prev = process.env.CUBRIC_BENCH_URL;
    process.env.CUBRIC_BENCH_URL = BENCH;
    resetCommunityCache();
    try {
        await withEnvKey('env-key', () => withServer(async (base) => {
            const probe = await (await fetch(`${base}/llm/connection/probe`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: 'deepinfra' }),
            })).json();
            assert.equal(probe.ok, true);
            assert.deepEqual(asked, [], 'the probe route never asks the community');

            const body = await (await fetch(`${base}/llm/connection/models?profileId=deepinfra`)).json();
            const by = Object.fromEntries(body.models.map((m) => [m.id, m.communityTest]));
            assert.deepEqual(by['zeta/chat-model'], { passed: 20, cases: 28, runs: 5, perChat: 0.002, suiteHash: suite });
            assert.equal(by['alpha/vision-model'], undefined, 'another preset\'s score for the same id is not this row\'s');
            assert.equal(by['deepseek-ai/DeepSeek-V4-Flash-0731'], undefined);
            assert.deepEqual(asked, [`${BENCH}/v1/scores?suite=${suite}`]);
            // Read again: the service is asked once a day, not once a panel.
            await (await fetch(`${base}/llm/connection/models?profileId=deepinfra`)).json();
            assert.equal(asked.length, 1);
        }));
        // The service down or off: today's rows, no communityTest key, and the answer does not fail.
        resetCommunityCache();
        const down = stubUpstream(async (url) => { if (url.startsWith(BENCH)) throw new TypeError('fetch failed'); return okJson(CATALOGUE); });
        try {
            await withEnvKey('env-key', () => withServer(async (base) => {
                const body = await (await fetch(`${base}/llm/connection/models?profileId=deepinfra`)).json();
                assert.equal(body.ok, true);
                assert.equal(body.models.length, 3);
                assert.ok(body.models.every((m) => !('communityTest' in m)));
            }));
        } finally { down(); }
    } finally {
        restore();
        process.env.CUBRIC_BENCH_URL = prev;
        resetCommunityCache();
    }
});

test('POST /llm/connection/probe reports reachability and the model count', async () => {
    const restore = stubUpstream(async () => okJson(CATALOGUE));
    try {
        await withEnvKey('env-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/connection/probe`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: 'deepinfra' }),
            });
            const body = await res.json();
            assert.equal(body.ok, true);
            assert.equal(body.modelCount, 3);
            assert.equal(typeof body.latencyMs, 'number');
        }));
    } finally { restore(); }
});

test('an upstream refusal is ENDPOINT_ERROR with its status', async () => {
    const restore = stubUpstream(async () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) }));
    try {
        await withEnvKey('bad-key', () => withServer(async (base) => {
            const body = await (await fetch(`${base}/llm/connection/models?profileId=deepinfra`)).json();
            assert.equal(body.ok, false);
            assert.equal(body.error.code, 'ENDPOINT_ERROR');
            assert.equal(body.error.status, 401);
        }));
    } finally { restore(); }
});

test('no profileId is a 400; an unknown connection is NO_PROFILE; a keyless hosted one is NO_KEY', async () => {
    let upstreamCalls = 0;
    const restore = stubUpstream(async () => { upstreamCalls++; return okJson(CATALOGUE); });
    try {
        await withEnvKey(undefined, () => withServer(async (base) => {
            const missing = await fetch(`${base}/llm/connection/models`);
            assert.equal(missing.status, 400);
            assert.equal((await missing.json()).error.code, 'BAD_REQUEST');

            await withBridge({ profile: null, key: null }, async () => {
                const body = await (await fetch(`${base}/llm/connection/models?profileId=nope`)).json();
                assert.equal(body.error.code, 'NO_PROFILE');
            });

            await withBridge({ profile: { id: 'openrouter', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1' }, key: null }, async () => {
                const body = await (await fetch(`${base}/llm/connection/models?profileId=openrouter`)).json();
                assert.equal(body.error.code, 'NO_KEY');
            });

            // Ollama's /v1 answers without a key, so it is asked.
            await withBridge({ profile: { id: 'ollama', name: 'Ollama', baseURL: 'http://localhost:11434/v1' }, key: null }, async () => {
                const body = await (await fetch(`${base}/llm/connection/models?profileId=ollama`)).json();
                assert.equal(body.ok, true);
            });
        }));
        // Two: its /v1/models and its /api/tags (MPI-941 Phase 11: the capabilities).
        assert.equal(upstreamCalls, 2, 'only the Ollama requests reach an upstream');
    } finally { restore(); }
});

test('POST /llm/ollama/unload frees every loaded model, and never errors', async () => {
    // The card holds TWO runtimes. Ollama keeps a model resident for five minutes after
    // the last request and a 12B agent model is ~8GB of 16 — so Release VRAM, which only
    // ever spoke to ComfyUI, freed nothing that mattered (seen live at 15.1/16.0 GB).
    const calls = [];
    const restore = stubUpstream(async (url, init) => {
        calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
        if (url.endsWith('/api/ps')) {
            return okJson({ models: [{ name: 'gemma-4-abliterated:12b' }, { name: 'qwen3-vl:4b' }] });
        }
        return okJson({});
    });
    try {
        await withServer(async (base) => {
            const body = await (await fetch(`${base}/llm/ollama/unload`, { method: 'POST' })).json();
            assert.equal(body.ok, true);
        });
        // `keep_alive: 0` on an empty chat is how Ollama evicts — there is no unload endpoint.
        const evicted = calls.filter(c => c.body?.keep_alive === 0).map(c => c.body.model);
        assert.deepEqual(evicted.sort(), ['gemma-4-abliterated:12b', 'qwen3-vl:4b']);
    } finally { restore(); }
});

test('MPI-993: GET /llm/ollama reports the recommended Ollama models; the pull route downloads nothing off the list', async () => {
    const restore = stubUpstream(async (url) => {
        if (url.endsWith('/api/tags')) return okJson({ models: [{ name: 'huihui_ai/gemma-4-abliterated:12b' }] });
        if (url.includes('registry.ollama.ai')) return okJson({ layers: [{ size: 3000 }, { size: 500 }] });
        return okJson({});
    });
    try {
        await withServer(async (base) => {
            const state = await (await fetch(`${base}/llm/ollama`)).json();
            // Keyed by the Remote row's own id, so MpiOllamaSetup finds the model the row shows.
            assert.deepEqual(state.models['huihui_ai/qwen3-vl-abliterated:4b'],
                { name: 'huihui_ai/qwen3-vl-abliterated:4b', downloaded: false, size: 3500, pull: null });
            assert.equal(state.models['huihui_ai/gemma-4-abliterated:12b'].downloaded, true);
            // The registry entries keep their keys: the Ollama enhancer row still reads them.
            assert.equal(state.models['gemma-4-abliterated-12b'].downloaded, true);
            // A name that is on no list never reaches `ollama pull` (refused before Ollama is started).
            const refused = await (await fetch(`${base}/llm/ollama/pull`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelId: 'someone/else:7b' }),
            })).json();
            assert.deepEqual(refused, { ok: false, error: 'No Ollama model for id: someone/else:7b' });
        });
    } finally { restore(); }
});

test('Release VRAM still succeeds when Ollama is not there at all', async () => {
    // Not installed, not running, nothing loaded — all mean "no VRAM of ours to free",
    // which is a SUCCESS for this button. An error here would surface as "Unload Failed"
    // on a machine that never had Ollama, and ComfyUI's release would look broken.
    const restore = stubUpstream(async () => { throw new Error('ECONNREFUSED'); });
    try {
        await withServer(async (base) => {
            const body = await (await fetch(`${base}/llm/ollama/unload`, { method: 'POST' })).json();
            assert.equal(body.ok, true);
            assert.equal(body.skipped, true);
        });
    } finally { restore(); }
});

test('the environment key never goes to a DeepInfra profile whose URL was edited', async () => {
    const restore = stubUpstream(async () => okJson(CATALOGUE));
    try {
        await withEnvKey('env-key', () => withServer(async (base) => {
            await withBridge({ profile: { id: 'deepinfra', name: 'DeepInfra', baseURL: 'https://evil.example/v1' }, key: null }, async () => {
                const body = await (await fetch(`${base}/llm/connection/models?profileId=deepinfra`)).json();
                assert.equal(body.error.code, 'NO_KEY');
            });
        }));
    } finally { restore(); }
});

// ---------------------------------------------------------------------------
// A chat call that never answers is a failure, not a wait (Fabio, live 2026-09-19)
// ---------------------------------------------------------------------------

// His `look` on a hosted describer sat on "Looking at image" with no error and no log
// line: neither engine passed a signal to fetch, so the only deadline was undici's own
// ~5 minutes, which says nothing a user can read. He gave it two minutes and killed the app.
test('a chat that never answers times out with a message that names the endpoint', async () => {
    const { DeepInfraEngine, OllamaEngine, REMOTE_CHAT_TIMEOUT_MS, OLLAMA_CHAT_TIMEOUT_MS } =
        await import('../services/llmEngines.mjs');

    assert.equal(REMOTE_CHAT_TIMEOUT_MS, 180_000, 'hosted deadline');
    assert.equal(OLLAMA_CHAT_TIMEOUT_MS, 600_000, 'local deadline: a cold 12B load alone is ~60s');

    const real = global.fetch;
    // Never resolves on its own — only the engine's signal can end it.
    global.fetch = (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal.reason));
    });
    // Ollama chat is `node:http`, not `fetch` (MPI-817: fetch drops a response whose headers
    // take over 300 s), so the stub above cannot hold it: a host that never answers can.
    // Pointed at localhost:11434, this test reached a REAL Ollama.
    const silent = require('node:http').createServer(() => { /* never answers */ });
    await new Promise((r) => silent.listen(0, '127.0.0.1', r));
    try {
        for (const [engine, name] of [
            [new DeepInfraEngine('k', 'https://api.example/v1', { id: 'deepinfra', name: 'DeepInfra' }), 'DeepInfra'],
            [new OllamaEngine(`http://127.0.0.1:${silent.address().port}`), 'Ollama'],
        ]) {
            engine.timeoutMs = 25;
            const err = await engine.chat({ model: 'm', messages: [] }).then(() => null, (e) => e);
            assert.ok(err, `${name}: the call resolved instead of timing out`);
            assert.equal(err.code, 'TIMEOUT', `${name}: ${err.message}`);
            assert.match(err.message, /did not answer within/);
        }
    } finally {
        global.fetch = real;
        silent.closeAllConnections();
        await new Promise((r) => silent.close(r));
    }
});
