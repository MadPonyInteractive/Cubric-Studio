'use strict';

/**
 * MPI-1236 — adding an Ollama Cloud model from Settings, no terminal.
 *
 * Pins the two things that fail quietly: the cloud NAME the local app answers to (a wrong
 * suffix pulls nothing and the row never appears), and that only a name ollama.com's own
 * catalogue lists reaches `ollama pull`. The upstream is a stubbed `fetch`: nothing leaves
 * the machine and the developer's Ollama is never touched.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The logger resolves its file at load: keep this run out of the developer's app.log.
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-cloud-'));

const llmRouter = require('../routes/llm');

const okJson = (body, status = 200) => ({ ok: status < 400, status, statusText: 'x', json: async () => body });

// ollama.com/api/tags-shaped: one model that cannot call tools, one tagged, one that sees.
const CATALOGUE = {
    models: [
        { name: 'minimax-m3.1-flash', capabilities: ['completion', 'thinking', 'tools'] },
        { name: 'gpt-oss:20b', capabilities: ['completion', 'tools'] },
        { name: 'kimi-k2.6', capabilities: ['vision', 'completion', 'tools'] },
        { name: 'chat-only', capabilities: ['completion'] },
    ],
};

/** Route every request but the test server's own to `upstream(url, init)`. */
function stubUpstream(upstream) {
    const real = global.fetch;
    global.fetch = (url, init) => (String(url).startsWith('http://127.0.0.1') ? real(url, init) : upstream(String(url), init));
    return () => { global.fetch = real; };
}

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

test('ollamaCloudName: :cloud on a bare name, -cloud on a tag', async () => {
    const { ollamaCloudName } = await import('../services/llmEngines.mjs');
    assert.equal(ollamaCloudName('minimax-m3.1-flash'), 'minimax-m3.1-flash:cloud');
    assert.equal(ollamaCloudName('gpt-oss:20b'), 'gpt-oss:20b-cloud');
    assert.equal(ollamaCloudName('deepseek-v4.1-flash:1017'), 'deepseek-v4.1-flash:1017-cloud');
});

test('ollamaCloudAgentModels: only models that call tools, by cloud name, vision kept, sorted', async () => {
    const { ollamaCloudAgentModels } = await import('../services/llmEngines.mjs');
    assert.deepEqual(ollamaCloudAgentModels(CATALOGUE), [
        { id: 'gpt-oss:20b-cloud', vision: false },
        { id: 'kimi-k2.6:cloud', vision: true },
        { id: 'minimax-m3.1-flash:cloud', vision: false },
    ]);
    assert.deepEqual(ollamaCloudAgentModels(null), []);
});

test('GET /llm/ollama/cloud: the catalogue, which are added, and who is signed in', async () => {
    const restore = stubUpstream(async (url, init) => {
        if (url === 'https://ollama.com/api/tags') return okJson(CATALOGUE);
        if (url.endsWith(':11434/')) return okJson('Ollama is running');
        if (url.endsWith('/api/me')) { assert.equal(init.method, 'POST'); return okJson({ name: 'fabio' }); }
        if (url.endsWith('/api/tags')) return okJson({ models: [{ name: 'gpt-oss:20b-cloud' }, { name: 'gemma4:12b' }] });
        throw new Error(`unexpected ${url}`);
    });
    try {
        await withServer(async (base) => {
            const body = await (await fetch(`${base}/llm/ollama/cloud`)).json();
            assert.equal(body.ok, true);
            assert.equal(body.signedIn, true);
            assert.equal(body.account, 'fabio');
            assert.deepEqual(body.models.map((m) => [m.id, m.added]), [
                ['gpt-oss:20b-cloud', true], ['kimi-k2.6:cloud', false], ['minimax-m3.1-flash:cloud', false],
            ]);
        });
    } finally { restore(); }
});

test('GET /llm/ollama/cloud: signed out hands back the sign-in link', async () => {
    const restore = stubUpstream(async (url) => {
        if (url === 'https://ollama.com/api/tags') return okJson(CATALOGUE);
        if (url.endsWith(':11434/')) return okJson('Ollama is running');
        if (url.endsWith('/api/me')) return okJson({ error: 'unauthorized', signin_url: 'https://ollama.com/connect?name=pc' }, 401);
        if (url.endsWith('/api/tags')) return okJson({ models: [] });
        throw new Error(`unexpected ${url}`);
    });
    try {
        await withServer(async (base) => {
            const body = await (await fetch(`${base}/llm/ollama/cloud`)).json();
            assert.equal(body.signedIn, false);
            assert.equal(body.signinUrl, 'https://ollama.com/connect?name=pc');
        });
    } finally { restore(); }
});

test('POST /llm/ollama/cloud/add: a name the catalogue does not list never reaches a pull', async () => {
    let pulled = false;
    const restore = stubUpstream(async (url) => {
        if (url === 'https://ollama.com/api/tags') return okJson(CATALOGUE);
        if (url.endsWith('/api/pull')) pulled = true;
        throw new Error(`unexpected ${url}`);
    });
    try {
        await withServer(async (base) => {
            for (const id of ['gemma4:31b', 'chat-only:cloud', undefined]) {
                const res = await fetch(`${base}/llm/ollama/cloud/add`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
                });
                const body = await res.json();
                assert.equal(body.ok, false, `${id} must be refused`);
            }
        });
        assert.equal(pulled, false);
    } finally { restore(); }
});
