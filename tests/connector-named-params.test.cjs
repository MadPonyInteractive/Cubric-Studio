'use strict';

/**
 * MPI-547 — the v1 named params on `POST /connector/generate` (ratio, qualityTier,
 * turbo, styleSelect, stylization, seed) plus the Phase-1 resolver they and
 * `PromptBoxControls.js` both call now instead of each carrying their own copy
 * (`js/data/generationControls.js`).
 *
 * Route-level tests drive the REAL router the way `tests/agent-generation-relay.
 * test.cjs` does — a real socket, a fake renderer subscribed over SSE — because a
 * named param that resolves through to the WRONG model or the wrong operation is
 * exactly the kind of bug that returns `ok:true` and only shows up in the app
 * (MPI-546's validation.md). The invalid-value paths need no renderer at all: they
 * fail before dispatch, at the route's own static validation.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

const connectorRoutes = require('../routes/connector');
const { resolveRatioDimensions, resolveNamedParams } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

// ── Phase 1 — the extracted resolver, no project/model object involved ──────

test('resolveRatioDimensions: krea2 at 1k vs 2k matches the pre-extraction pixels', () => {
    assert.deepEqual(
        resolveRatioDimensions('krea2', { orientation: 'portrait', qualityTier: '1k', ratioLabel: '1:1' }),
        { width: 1024, height: 1024, orientation: 'portrait' },
    );
    assert.deepEqual(
        resolveRatioDimensions('krea2', { orientation: 'portrait', qualityTier: '2k', ratioLabel: '1:1' }),
        { width: 1472, height: 1472, orientation: 'portrait' },
    );
});

test('resolveRatioDimensions: a second model family (LTX) matches its own table', () => {
    assert.deepEqual(
        resolveRatioDimensions('ltx', { orientation: 'portrait', qualityTier: 'medium', ratioLabel: '1:1' }),
        { width: 512, height: 512, orientation: 'portrait' },
    );
    assert.deepEqual(
        resolveRatioDimensions('ltx', { orientation: 'landscape', qualityTier: 'high', ratioLabel: '16:9' }),
        { width: 1216, height: 704, orientation: 'landscape' },
    );
});

test('resolveRatioDimensions: an unmatched label is the honest zero, never a guess', () => {
    assert.deepEqual(
        resolveRatioDimensions('krea2', { qualityTier: '1k', ratioLabel: 'not-a-ratio' }),
        { width: 0, height: 0 },
    );
    assert.deepEqual(resolveRatioDimensions('krea2', {}), { width: 0, height: 0 });
});

// ── Phase 2 — POST /connector/generate static validation ────────────────────

async function startServer() {
    const app = express();
    app.use(express.json());
    app.use(connectorRoutes);
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address();
    return {
        base: `http://127.0.0.1:${port}`,
        stop: () => new Promise((resolve) => server.close(resolve)),
    };
}

/** A fake renderer — same shape as tests/agent-generation-relay.test.cjs. */
async function fakeRenderer(base) {
    const ac = new AbortController();
    const res = await fetch(`${base}/connector/jobs/stream`, { signal: ac.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    async function readFrame() {
        for (;;) {
            const idx = buffer.indexOf('\n\n');
            if (idx !== -1) {
                const raw = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);
                const event = /^event: (.+)$/m.exec(raw)?.[1];
                const data = /^data: (.+)$/m.exec(raw)?.[1];
                return { event, data: data ? JSON.parse(data) : null };
            }
            const { value, done } = await reader.read();
            if (done) throw new Error('stream closed before a frame arrived');
            buffer += decoder.decode(value, { stream: true });
        }
    }

    const hello = await readFrame();
    assert.equal(hello.event, 'connected');
    return { readFrame, close: () => ac.abort() };
}

const postJson = (url, body) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
}).then((r) => r.json().then((json) => ({ status: r.status, json })));

// A model with a ratio + quality-tier axis, a turbo toggle and a style rack
// (`js/data/modelConstants/models.js` id 'krea2').
const KREA2 = { modelId: 'krea2', operation: 't2i' };
// A model with NO turbo toggle and NO style rack, but batch enabled on t2i
// (`batchOps: ['t2i']`) and no quality-tier axis at all — the mirror image of
// krea2, so every "this model does not support X" path has a real fixture.
const SDXL = { modelId: 'sdxl-realistic', operation: 't2i' };

test('ratio: a bogus label is a named error, not a silent fallback', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...KREA2, ratio: 'not-a-ratio' });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_RATIO');
    } finally { await stop(); }
});

test('ratio: a valid label reaches the renderer job input intact', async () => {
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base);
    try {
        const pending = postJson(`${base}/connector/generate`, { ...KREA2, ratio: '9:16' });
        const frame = await renderer.readFrame();
        assert.equal(frame.data.input.ratio, '9:16');
        await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
        assert.equal((await pending).json.ok, true);
    } finally { renderer.close(); await stop(); }
});

test('qualityTier: a tier this model does not declare is a named error', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...KREA2, qualityTier: '4k' }); // krea2 only has 1k/2k
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_QUALITY_TIER');
    } finally { await stop(); }
});

test('qualityTier: a model with no tier axis at all names that in the error', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...SDXL, qualityTier: '1k' });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_QUALITY_TIER');
    } finally { await stop(); }
});

test('turbo: a non-boolean value is a named error', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...KREA2, turbo: 'yes' });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_TURBO');
    } finally { await stop(); }
});

test('turbo: a model with no turbo toggle is a named error, even with a real boolean', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...SDXL, turbo: true });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_TURBO');
    } finally { await stop(); }
});

test('turbo: a valid boolean on a model that has the toggle reaches the job input', async () => {
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base);
    try {
        const pending = postJson(`${base}/connector/generate`, { ...KREA2, turbo: true });
        const frame = await renderer.readFrame();
        assert.equal(frame.data.input.turbo, true);
        await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
        assert.equal((await pending).json.ok, true);
    } finally { renderer.close(); await stop(); }
});

test('styleSelect: an out-of-range index is a named error', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...KREA2, styleSelect: 999 });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_STYLE_SELECT');
    } finally { await stop(); }
});

// Live (Fabio, 2026-09-19): "make an image of a cowgirl riding a bull" died on
// `styleSelect must be an integer 0-10`. The rack is only ever SEEN as names — the
// `params.styles` list describe_model hands out — so a caller naming one is reading the
// only thing it was given. The index must reach the RENDERER, not just the validator.
test('styleSelect: a style named by its label resolves to its index, all the way to the job input', async () => {
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base);
    try {
        const labels = MODELS.find((m) => m.id === 'krea2').styleLoraLabels;
        assert.equal(labels[1], 'Dark Brush', 'the rack this test names');

        for (const [name, index] of [['Dark Brush', 1], ['dark brush', 1], ['  MidJourney ', 10]]) {
            // Settle the request BEFORE asserting: a failed assertion mid-loop would
            // otherwise leave the post hanging and the runner with it.
            const pending = postJson(`${base}/connector/generate`, { ...KREA2, styleSelect: name });
            const frame = await renderer.readFrame();
            const dispatched = frame.data.input.styleSelect;
            await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
            const { json } = await pending;
            assert.equal(dispatched, index, `"${name}" reached the renderer as its index`);
            assert.equal(json.ok, true);
        }
    } finally { renderer.close(); await stop(); }
});

test('styleSelect: a name that is not in the rack is still a named error', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...KREA2, styleSelect: 'Oil Painting' });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_STYLE_SELECT');
    } finally { await stop(); }
});

test('styleSelect: a model with no style rack is a named error, even at index 0', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...SDXL, styleSelect: 0 });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_STYLE_SELECT');
    } finally { await stop(); }
});

test('stylization: out of the 0..1 range is a named error', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...KREA2, stylization: 1.5 });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_STYLIZATION');
    } finally { await stop(); }
});

// MPI-876 phase 2 (Fabio, 2026-09-22): a batch runs as ONE job only where the model's
// images 2+ come back clean — the SDXL family's t2i and the cloud models. Elsewhere it is
// refused by name so the caller queues N submits instead.
test('batch: a clean-batching model carries batch to the renderer', async () => {
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base);
    try {
        const pending = postJson(`${base}/connector/generate`, { ...SDXL, batch: 4 });
        const frame = await renderer.readFrame();
        assert.equal(frame.data.input.batch, 4);
        await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
        assert.equal((await pending).json.ok, true);
    } finally { renderer.close(); await stop(); }
});

test('batch: refused by name where images 2+ artefact, and above the cap', async () => {
    const { base, stop } = await startServer();
    try {
        for (const [body, code] of [
            [{ modelId: 'boogu-edit-high', operation: 'edit', batch: 2 }, 'BATCH_UNSUPPORTED'],
            [{ modelId: 'chroma-flash', operation: 't2i', batch: 2 }, 'BATCH_UNSUPPORTED'],
            [{ ...SDXL, batch: 5 }, 'INVALID_BATCH'],
        ]) {
            const { status, json } = await postJson(`${base}/connector/generate`, body);
            assert.equal(status, 400, body.modelId);
            assert.equal(json.error.code, code, body.modelId);
        }
    } finally { await stop(); }
});

test('agentCanBatch: SDXL family t2i and the cloud, nothing else', () => {
    const { agentCanBatch } = require('../js/data/generationControls.js');
    const can = MODELS.flatMap((m) => (m.supportedOps || [])
        .filter((op) => agentCanBatch(m, op)).map((op) => `${m.id}:${op}`));
    assert.deepEqual(can.sort(), [
        'flux-schnell-cloud:t2i', 'ill-anime-beauty:t2i', 'ill-anime:t2i', 'pony-mix:t2i',
        'sdxl-nsfw:t2i', 'sdxl-realistic:t2i',
        'veo-31-cloud:i2v', 'veo-31-cloud:t2v', 'veo-31-fast-cloud:i2v', 'veo-31-fast-cloud:t2v',
    ]);
});

test('batch: a project saved at batch 3 still runs an unasked agent submit at batch 1', () => {
    const sdxl = MODELS.find((m) => m.id === SDXL.modelId);
    assert.ok(sdxl, 'fixture guard: sdxl-realistic is still a shipped model');

    const project = { shared: { image: { batch: 3 } } };
    const result = resolveNamedParams(project, sdxl, 't2i', {});

    assert.equal(result.ok, true);
    assert.equal(result.injectionParams.Input_Batch_Size, 1);
});

test('seed: a non-integer is a named error', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { ...KREA2, seed: 1.5 });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'INVALID_SEED');
    } finally { await stop(); }
});

test('seed: negative or out of the uint32 range is a named error', async () => {
    const { base, stop } = await startServer();
    try {
        const neg = await postJson(`${base}/connector/generate`, { ...KREA2, seed: -1 });
        assert.equal(neg.status, 400);
        assert.equal(neg.json.error.code, 'INVALID_SEED');

        const tooBig = await postJson(`${base}/connector/generate`, { ...KREA2, seed: 2 ** 32 });
        assert.equal(tooBig.status, 400);
        assert.equal(tooBig.json.error.code, 'INVALID_SEED');
    } finally { await stop(); }
});

test('seed: a valid explicit seed reaches the job input', async () => {
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base);
    try {
        const pending = postJson(`${base}/connector/generate`, { ...KREA2, seed: 42 });
        const frame = await renderer.readFrame();
        assert.equal(frame.data.input.seed, 42);
        await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
        assert.equal((await pending).json.ok, true);
    } finally { renderer.close(); await stop(); }
});

test('an unresolvable modelId with a named param is UNKNOWN_MODEL, not a silent pass-through', async () => {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}/connector/generate`,
            { modelId: 'not-a-real-model', operation: 't2i', ratio: '1:1' });
        assert.equal(status, 400);
        assert.equal(json.error.code, 'UNKNOWN_MODEL');
    } finally { await stop(); }
});

test('no named params at all: the job input is byte-identical to the pre-MPI-547 shape', async () => {
    // Pins the MPI-546-era shape tests/agent-generation-relay.test.cjs asserts —
    // a caller who never touches the v1 params must see NO new keys appear.
    const { base, stop } = await startServer();
    const renderer = await fakeRenderer(base);
    try {
        const pending = postJson(`${base}/connector/generate`, { ...KREA2, positive: 'a lone rider at dusk' });
        const frame = await renderer.readFrame();
        assert.deepEqual(frame.data.input, {
            modelId: 'krea2',
            operation: 't2i',
            positive: 'a lone rider at dusk',
            negative: '',
            injectionParams: {},
        });
        await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
        assert.equal((await pending).json.ok, true);
    } finally { renderer.close(); await stop(); }
});

// ── Phase 3 — per-model + turbo settings apply for THIS run only ────────────

test('resolveNamedParams never writes the project it reads (turbo:true, deep-equal before/after)', () => {
    const krea2 = MODELS.find((m) => m.id === 'krea2');
    assert.ok(krea2, 'fixture guard: krea2 is still a shipped model');

    const project = {
        modelSettings: {
            krea2: { styleSelect: 3, stylization: 0.7, qualityTier: '2k', operations: {} },
        },
        shared: { image: { ratioSelector: { selectedRatio: '1:1', orientation: 'portrait' }, batch: 1 } },
    };
    const before = JSON.parse(JSON.stringify(project));

    const result = resolveNamedParams(project, krea2, 't2i', { turbo: true });

    assert.equal(result.ok, true);
    assert.equal(result.injectionParams.Input_is_Turbo, true);
    // The project's OWN saved settings ride along unpersisted — decision #1,
    // plan.md: an agent quietly flipping turbo on must never leak into a later
    // manual Cue press.
    assert.equal(result.injectionParams['Input_Style_Selector.selector'], 3);
    assert.deepEqual(project, before, 'resolving a named param must not mutate the project it read');
});
