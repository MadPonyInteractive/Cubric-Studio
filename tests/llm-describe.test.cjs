'use strict';

/**
 * MPI-737 — POST /llm/describe (remote vision model) and the endpoint branch
 * of POST /llm/enhance.
 *
 * All upstream calls are intercepted by a stubbed global.fetch, so nothing
 * leaves the machine and no key is spent.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Keep this run out of the developer's app.log.
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-desc-'));

const llmRouter = require('../routes/llm');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Spin up a test server with the LLM router. Returns base URL. */
async function withServer(fn) {
    const app = express();
    app.use(express.json());
    app.use(llmRouter);
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
        return await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

/** Intercept non-localhost fetch calls with `upstream`. */
function stubUpstream(upstream) {
    const real = global.fetch;
    global.fetch = (url, init) =>
        String(url).startsWith('http://127.0.0.1') ? real(url, init) : upstream(String(url), init);
    return () => { global.fetch = real; };
}

/** Build a fake ok JSON response. */
const okJson = (body) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body, text: async () => JSON.stringify(body) });

/** Build a fake error response (non-ok). */
const errJson = (status, body) => ({ ok: false, status, statusText: 'Error', json: async () => body, text: async () => JSON.stringify(body) });

/** Stub the fork bridge (main process answers for get-endpoint-profile-request). */
async function withBridge(answer, fn) {
    const prevSend = process.send;
    process.send = (msg) => {
        setImmediate(() => process.emit('message', { ...answer, type: `${msg.type}-response`, id: msg.id }));
    };
    try { return await fn(); } finally {
        if (prevSend === undefined) delete process.send;
        else process.send = prevSend;
    }
}

/** Set DEEPINFRA_API_KEY for the duration of `fn`. */
async function withEnvKey(value, fn) {
    const prev = process.env.DEEPINFRA_API_KEY;
    if (value === undefined) delete process.env.DEEPINFRA_API_KEY;
    else process.env.DEEPINFRA_API_KEY = value;
    try { return await fn(); } finally {
        if (prev === undefined) delete process.env.DEEPINFRA_API_KEY;
        else process.env.DEEPINFRA_API_KEY = prev;
    }
}

/** Write a small JPEG (10x10 white) to a temp path and return the path. */
async function makeTmpJpeg(tag = '') {
    const sharp = require('sharp');
    const p = path.join(os.tmpdir(), `llm-desc-test${tag}-${Date.now()}.jpg`);
    await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 255, b: 255 } } })
        .jpeg().toFile(p);
    return p;
}

/** Write a large synthetic PNG using sharp to test downscale (> 1 MP). */
async function makeLargePng() {
    const sharp = require('sharp');
    const p = path.join(os.tmpdir(), `llm-desc-large-${Date.now()}.png`);
    await sharp({
        create: { width: 1500, height: 1000, channels: 3, background: { r: 120, g: 80, b: 200 } },
    }).png().toFile(p);
    return p;
}

// ── Describe model constants ──────────────────────────────────────────────────

const DI_URL = 'https://api.deepinfra.com/v1/openai';

// ── Tests ─────────────────────────────────────────────────────────────────────

test('POST /llm/describe: image_url content part reaches the endpoint', async () => {
    const imgPath = await makeTmpJpeg('url-check');
    let sentMessages = null;
    const restore = stubUpstream(async (_url, init) => {
        sentMessages = JSON.parse(init.body).messages;
        return okJson({ choices: [{ message: { content: 'A white square.' } }], usage: null });
    });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'some/vision-model', imagePath: imgPath }),
            });
            const body = await res.json();
            assert.equal(body.ok, true, `describe failed: ${JSON.stringify(body)}`);
        }));
        assert.ok(sentMessages, 'fetch was not called');
        // Find the user message and its content array
        const userMsg = sentMessages.find((m) => m.role === 'user');
        assert.ok(userMsg, 'no user message sent');
        const content = Array.isArray(userMsg.content) ? userMsg.content : [];
        const imgPart = content.find((p) => p.type === 'image_url');
        assert.ok(imgPart, 'no image_url content part in user message');
        assert.ok(imgPart.image_url.url.startsWith('data:image/jpeg;base64,'), 'image_url is not a JPEG data URL');
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: downscaled image is <= 1 MP', async () => {
    const imgPath = await makeLargePng();
    let sentUrl = null;
    const restore = stubUpstream(async (_url, init) => {
        const msgs = JSON.parse(init.body).messages;
        const userContent = msgs.find((m) => m.role === 'user')?.content || [];
        const imgPart = userContent.find((p) => p.type === 'image_url');
        if (imgPart) sentUrl = imgPart.image_url.url;
        return okJson({ choices: [{ message: { content: 'A purple rectangle.' } }], usage: null });
    });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'some/vision-model', imagePath: imgPath }),
            });
            const body = await res.json();
            assert.equal(body.ok, true, `describe failed: ${JSON.stringify(body)}`);
        }));
        assert.ok(sentUrl, 'no image_url found in sent messages');
        // Decode the base64 JPEG and check dimensions via sharp
        const b64 = sentUrl.replace('data:image/jpeg;base64,', '');
        const buf = Buffer.from(b64, 'base64');
        const sharp = require('sharp');
        const meta = await sharp(buf).metadata();
        assert.ok(
            (meta.width || 0) * (meta.height || 0) <= 1_000_000,
            `sent image is ${meta.width}x${meta.height} (${(meta.width||0)*(meta.height||0)} px), exceeds 1 MP`,
        );
        // Dimensions must be multiples of 16
        assert.equal((meta.width || 0) % 16, 0, `width ${meta.width} is not a multiple of 16`);
        assert.equal((meta.height || 0) % 16, 0, `height ${meta.height} is not a multiple of 16`);
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: default instruction comes from image_descriptor.json node 38', async () => {
    const imgPath = await makeTmpJpeg('node38');
    let sentMessages = null;
    const restore = stubUpstream(async (_url, init) => {
        sentMessages = JSON.parse(init.body).messages;
        return okJson({ choices: [{ message: { content: 'Description here.' } }], usage: null });
    });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'some/model', imagePath: imgPath }),
            });
            const body = await res.json();
            assert.equal(body.ok, true, `describe failed: ${JSON.stringify(body)}`);
        }));
        // Read the actual node 38 value from the workflow to compare
        const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'comfy_workflows', 'image_descriptor.json'), 'utf8'));
        const rawNode38 = wf['38']?.inputs?.value || '';
        // Extract system content
        const sysMatch = rawNode38.match(/<\|im_start\|>system\n([\s\S]*?)<\|im_end\|>/);
        const expectedSystem = sysMatch ? sysMatch[1].trim() : '';
        // The system message must match node 38's system prompt
        const sysMsg = sentMessages?.find((m) => m.role === 'system');
        assert.ok(sysMsg, 'no system message sent (default instruction not applied)');
        assert.equal(sysMsg.content, expectedSystem, 'system prompt does not match node 38');
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: a question replaces the default instruction (no system message)', async () => {
    const imgPath = await makeTmpJpeg('question');
    let sentMessages = null;
    const restore = stubUpstream(async (_url, init) => {
        sentMessages = JSON.parse(init.body).messages;
        return okJson({ choices: [{ message: { content: 'It is a cat.' } }], usage: null });
    });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'some/model', imagePath: imgPath, question: 'What animal is this?' }),
            });
            const body = await res.json();
            assert.equal(body.ok, true, `describe failed: ${JSON.stringify(body)}`);
        }));
        // With a question: no system message; question is the user text part
        const sysMsg = sentMessages?.find((m) => m.role === 'system');
        assert.equal(sysMsg, undefined, 'system message sent despite question being provided');
        const userMsg = sentMessages?.find((m) => m.role === 'user');
        const textPart = (Array.isArray(userMsg?.content) ? userMsg.content : []).find((p) => p.type === 'text');
        assert.equal(textPart?.text, 'What animal is this?', 'question not sent as user text part');
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: NO_PROFILE when connection is not found', async () => {
    const imgPath = await makeTmpJpeg('noprofile');
    const restore = stubUpstream(async () => { throw new Error('should not reach upstream'); });
    try {
        await withEnvKey(undefined, () => withBridge({ profile: null, key: null }, () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'unknown', modelId: 'x', imagePath: imgPath }),
            });
            const body = await res.json();
            assert.equal(body.ok, false);
            assert.equal(body.error.code, 'NO_PROFILE');
        })));
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: NO_KEY when key is missing for a hosted profile', async () => {
    const imgPath = await makeTmpJpeg('nokey');
    const restore = stubUpstream(async () => { throw new Error('should not reach upstream'); });
    try {
        await withEnvKey(undefined, () => withBridge(
            { profile: { id: 'openrouter', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1' }, key: null },
            () => withServer(async (base) => {
                const res = await fetch(`${base}/llm/describe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ profileId: 'openrouter', modelId: 'x', imagePath: imgPath }),
                });
                const body = await res.json();
                assert.equal(body.ok, false);
                assert.equal(body.error.code, 'NO_KEY');
            }),
        ));
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: ENDPOINT_ERROR when upstream fails', async () => {
    const imgPath = await makeTmpJpeg('endpointerr');
    const restore = stubUpstream(async () => errJson(500, { error: { message: 'Internal server error' } }));
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'x', imagePath: imgPath }),
            });
            const body = await res.json();
            assert.equal(body.ok, false);
            assert.equal(body.error.code, 'ENDPOINT_ERROR');
        }));
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: NOT_VISION when 4xx message names image input', async () => {
    const imgPath = await makeTmpJpeg('notvision');
    const restore = stubUpstream(async () => errJson(400, { error: { message: 'This model does not support image input.' } }));
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'text-only-model', imagePath: imgPath }),
            });
            const body = await res.json();
            assert.equal(body.ok, false);
            assert.equal(body.error.code, 'NOT_VISION');
        }));
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: BAD_IMAGE when the file does not exist', async () => {
    const restore = stubUpstream(async () => { throw new Error('should not reach upstream'); });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'x', imagePath: '/tmp/no-such-file-ever.jpg' }),
            });
            const body = await res.json();
            assert.equal(body.ok, false);
            assert.equal(body.error.code, 'BAD_IMAGE');
        }));
    } finally {
        restore();
    }
});

test('POST /llm/describe: BAD_REQUEST for missing profileId', async () => {
    await withServer(async (base) => {
        const res = await fetch(`${base}/llm/describe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId: 'x', imagePath: '/tmp/x.jpg' }),
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.error.code, 'BAD_REQUEST');
    });
});

// ── endpoint branch of /llm/enhance ──────────────────────────────────────────

test('POST /llm/enhance endpoint branch: raw modelId is forwarded (no MODEL_REGISTRY lookup)', async () => {
    let sentModel = null;
    const restore = stubUpstream(async (_url, init) => {
        sentModel = JSON.parse(init.body).model;
        return okJson({ choices: [{ message: { content: 'Enhanced prompt here.' } }], usage: null });
    });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/enhance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    backend: 'endpoint',
                    profileId: 'deepinfra',
                    modelId: 'google/gemma-4-26B-A4B-it',
                    prompt: 'a cat on a mat',
                }),
            });
            const body = await res.json();
            assert.equal(body.ok, true, `enhance (endpoint) failed: ${JSON.stringify(body)}`);
            assert.equal(body.backend, 'deepinfra', 'backend must name the profile, not a hardcoded value');
        }));
        assert.equal(sentModel, 'google/gemma-4-26B-A4B-it', 'raw modelId was not forwarded to the endpoint');
    } finally {
        restore();
    }
});

test('POST /llm/enhance endpoint branch: NO_PROFILE when connection is not found', async () => {
    const restore = stubUpstream(async () => { throw new Error('should not reach upstream'); });
    try {
        await withEnvKey(undefined, () => withBridge({ profile: null, key: null }, () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/enhance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backend: 'endpoint', profileId: 'nope', modelId: 'x', prompt: 'hi' }),
            });
            const body = await res.json();
            assert.equal(body.ok, false);
            assert.equal(body.error.code, 'NO_PROFILE');
        })));
    } finally {
        restore();
    }
});

test('POST /llm/enhance: the retired deepinfra backend and a missing backend are refused, not defaulted', async () => {
    // Before Phase 4 both ran on DeepInfra through defaultBackend(); the pick is the user's now.
    const restore = stubUpstream(async () => { throw new Error('should not reach upstream'); });
    try {
        await withServer(async (base) => {
            for (const backend of ['deepinfra', undefined]) {
                const res = await fetch(`${base}/llm/enhance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ backend, prompt: 'hi' }),
                });
                const body = await res.json();
                assert.equal(body.ok, false);
                assert.match(body.error, /'endpoint' or 'ollama'/);
            }
        });
    } finally {
        restore();
    }
});

// ── Engine honest backend label ───────────────────────────────────────────────

test('DeepInfraEngine reports honest backend when constructed with a profile', async () => {
    const { DeepInfraEngine } = await import('../services/llmEngines.mjs');
    const profile = { id: 'openrouter', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1' };
    const engine = new DeepInfraEngine('key', 'https://openrouter.ai/api/v1', profile);
    assert.equal(engine.backend, 'openrouter', 'backend should be the profile id');
});

test('DeepInfraEngine without profile still reports deepinfra backend (legacy path)', () => {
    const { DeepInfraEngine } = require('../services/llmEngines.mjs');
    const engine = new DeepInfraEngine('key', 'http://stub');
    assert.equal(engine.backend, 'deepinfra');
});

test('RECOMMENDED_REMOTE_MODELS: deepinfra has enhance and describe entries', async () => {
    const { RECOMMENDED_REMOTE_MODELS, recommendedModel } = await import('../services/llmEngines.mjs');
    const di = RECOMMENDED_REMOTE_MODELS.deepinfra || [];
    const enhanceEntries = di.filter((r) => r.jobs.includes('enhance'));
    const describeEntries = di.filter((r) => r.jobs.includes('describe'));
    assert.ok(enhanceEntries.length > 0, 'no enhance entries for deepinfra');
    assert.ok(describeEntries.length > 0, 'no describe entries for deepinfra');
    // Enhance ids must match MODEL_REGISTRY deepInfraId values
    const { MODEL_REGISTRY } = await import('../services/llmEngines.mjs');
    const registryIds = new Set(MODEL_REGISTRY.filter((m) => m.deepInfraId).map((m) => m.deepInfraId));
    for (const entry of enhanceEntries) {
        assert.ok(registryIds.has(entry.id), `enhance entry ${entry.id} not in MODEL_REGISTRY`);
    }
    // recommendedModel helper must find enhance and describe
    assert.ok(recommendedModel('deepinfra', 'enhance'), 'recommendedModel("deepinfra","enhance") returned empty');
    assert.ok(recommendedModel('deepinfra', 'describe'), 'recommendedModel("deepinfra","describe") returned empty');
});

test('listRemoteModels: vision models are included (chat tag present, no filter change needed)', async () => {
    const { listRemoteModels } = await import('../services/llmEngines.mjs');
    // Catalogue with a model that has both 'chat' and 'vision' tags
    const catalogue = { data: [
        { id: 'alpha/chat-only', metadata: { tags: ['chat'], context_length: 8192 } },
        { id: 'beta/vision-chat', metadata: { tags: ['chat', 'vision', 'vlm'], context_length: 32768 } },
        { id: 'gamma/image-gen', metadata: { tags: ['image-gen'] } },
    ]};
    const restore = stubUpstream(async () => okJson(catalogue));
    try {
        const models = await listRemoteModels({ presetId: 'openai', baseURL: 'https://api.openai.com/v1', key: 'k' });
        const ids = models.map((m) => m.id);
        assert.ok(ids.includes('beta/vision-chat'), 'vision model filtered out — check tag filter');
        assert.ok(!ids.includes('gamma/image-gen'), 'image-gen model not filtered');
        const visionModel = models.find((m) => m.id === 'beta/vision-chat');
        assert.equal(visionModel.vision, true, 'vision flag not set for vlm-tagged model');
    } finally {
        restore();
    }
});

// ── Integration fixes (MPI-737 orchestrator, 2026-09-16) ─────────────────────

test('POST /llm/describe: a gallery /project-file?path= URL resolves to the file', async () => {
    // The right-click path sends an item's filePath, which is a /project-file URL.
    const imgPath = await makeTmpJpeg('project-file');
    const restore = stubUpstream(async () => okJson({ choices: [{ message: { content: 'A white square.' } }], usage: null }));
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const imageRef = `/project-file?path=${encodeURIComponent(imgPath.replace(/\\/g, '/'))}`;
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'some/vision-model', imagePath: imageRef }),
            });
            const body = await res.json();
            assert.equal(body.ok, true, `a /project-file URL must resolve: ${JSON.stringify(body)}`);
        }));
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('POST /llm/describe: a relative path is BAD_IMAGE, never resolved against the cwd', async () => {
    const restore = stubUpstream(async () => { throw new Error('should not reach upstream'); });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/describe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: 'deepinfra', modelId: 'x', imagePath: 'package.json' }),
            });
            const body = await res.json();
            assert.equal(body.ok, false);
            assert.equal(body.error.code, 'BAD_IMAGE');
        }));
    } finally {
        restore();
    }
});

test('no model picked: describe and enhance fall to the connection\'s recommended model', async () => {
    const { recommendedModel } = await import('../services/llmEngines.mjs');
    const imgPath = await makeTmpJpeg('default-model');
    const sent = [];
    const restore = stubUpstream(async (_url, init) => {
        sent.push(JSON.parse(init.body).model);
        return okJson({ choices: [{ message: { content: 'ok' } }], usage: null });
    });
    try {
        await withEnvKey('test-key', () => withServer(async (base) => {
            const post = (route, body) => fetch(`${base}${route}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            }).then((r) => r.json());
            assert.equal((await post('/llm/describe', { profileId: 'deepinfra', imagePath: imgPath })).ok, true);
            assert.equal((await post('/llm/enhance', { backend: 'endpoint', profileId: 'deepinfra', prompt: 'a cat' })).ok, true);
        }));
        assert.deepEqual(sent, [recommendedModel('deepinfra', 'describe'), recommendedModel('deepinfra', 'enhance')]);
    } finally {
        restore();
        fs.rmSync(imgPath, { force: true });
    }
});

test('a keyless connection (Ollama /v1) never borrows DEEPINFRA_API_KEY and sends no Authorization', async () => {
    const ollama = { id: 'ollama', name: 'Ollama', baseURL: 'http://localhost:11434/v1' };
    let seen = null;
    const restore = stubUpstream(async (url, init) => {
        seen = { url, auth: init.headers.Authorization };
        return okJson({ choices: [{ message: { content: 'ok' } }], usage: null });
    });
    try {
        await withEnvKey('must-not-leave-deepinfra', () => withBridge({ profile: ollama, key: null }, () => withServer(async (base) => {
            const res = await fetch(`${base}/llm/enhance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backend: 'endpoint', profileId: 'ollama', modelId: 'gemma3:12b', prompt: 'hi' }),
            });
            const body = await res.json();
            assert.equal(body.ok, true, `keyless enhance failed: ${JSON.stringify(body)}`);
        })));
        assert.ok(seen.url.startsWith('http://localhost:11434/v1/'), `wrong host: ${seen.url}`);
        assert.equal(seen.auth, undefined, 'a keyless connection sent an Authorization header');
    } finally {
        restore();
    }
});
