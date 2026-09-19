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
    const { listRemoteModels } = await import('../services/llmEngines.mjs');
    let auth = null;
    const restore = stubUpstream(async (url, init) => { auth = init.headers.Authorization; assert.equal(url, `${DI_URL}/models`); return okJson(CATALOGUE); });
    try {
        const models = await listRemoteModels({ presetId: 'deepinfra', baseURL: `${DI_URL}/`, key: 'k1' });
        assert.equal(auth, 'Bearer k1');
        assert.deepEqual(models.map((m) => m.id), ['deepseek-ai/DeepSeek-V4-Flash-0731', 'alpha/vision-model', 'zeta/chat-model']);
        assert.deepEqual(models[0], { id: 'deepseek-ai/DeepSeek-V4-Flash-0731', contextWindow: 1048576, vision: false, recommendedFor: ['agent'] });
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
            { id: 'a-model', contextWindow: null, vision: null, recommendedFor: [] },
            { id: 'b-model', contextWindow: 8192, vision: null, recommendedFor: [] },
        ]);
    } finally { restore(); }
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
        assert.equal(upstreamCalls, 1, 'only the Ollama request reaches an upstream');
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
    try {
        for (const [engine, name] of [
            [new DeepInfraEngine('k', 'https://api.example/v1', { id: 'deepinfra', name: 'DeepInfra' }), 'DeepInfra'],
            [new OllamaEngine('http://localhost:11434'), 'Ollama'],
        ]) {
            engine.timeoutMs = 25;
            const err = await engine.chat({ model: 'm', messages: [] }).then(() => null, (e) => e);
            assert.ok(err, `${name}: the call resolved instead of timing out`);
            assert.equal(err.code, 'TIMEOUT', `${name}: ${err.message}`);
            assert.match(err.message, /did not answer within/);
        }
    } finally { global.fetch = real; }
});
