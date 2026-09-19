'use strict';

/**
 * MPI-830 — `POST /connector/gif/{make,edit,cutout,to-video}`.
 *
 * Driven the way `tests/connector-named-params.test.cjs` drives the generate
 * route: a real socket with a fake renderer subscribed over SSE, because the
 * whole point of these four routes is that they reach the RENDERER — a payload
 * that arrives mangled comes back `ok: true` and only shows up in the app.
 * The rejection paths need no renderer at all; they fail at the route's own
 * static validation, before dispatch.
 *
 * What is deliberately NOT tested here: the fps bounds, the size-preset enum
 * and the crop geometry. Those belong to `routes/gifMaker.js` and
 * `routes/gifTransform.js` and are tested there — this route validates SHAPE
 * and passes the rest through, so asserting them here would pin a rule to two
 * files at once.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

const connectorRoutes = require('../routes/connector');
const connectorGifRoutes = require('../routes/connectorGif');

async function startServer() {
    const app = express();
    app.use(express.json());
    app.use(connectorRoutes);
    app.use(connectorGifRoutes);
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address();
    return {
        base: `http://127.0.0.1:${port}`,
        stop: () => new Promise((resolve) => server.close(resolve)),
    };
}

/** A fake renderer — same shape as tests/connector-named-params.test.cjs. */
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

/**
 * Send a body, let the fake renderer answer `ok: true`, and hand back the JOB
 * the renderer saw. That job is the contract: it is the only thing the app ever
 * gets from a caller.
 */
async function captureJob(path, body) {
    const { base, stop } = await startServer();
    try {
        const renderer = await fakeRenderer(base);
        const pending = postJson(`${base}${path}`, body);
        const frame = await renderer.readFrame();
        assert.equal(frame.event, 'job');
        await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: { itemId: 'i1' } });
        const { status, json } = await pending;
        renderer.close();
        return { job: frame.data, status, json };
    } finally {
        await stop();
    }
}

/** A body that must be rejected before any renderer is involved. */
async function expectBadRequest(path, body, needle) {
    const { base, stop } = await startServer();
    try {
        const { status, json } = await postJson(`${base}${path}`, body);
        assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`);
        assert.equal(json.ok, false);
        assert.equal(json.error.code, 'BAD_REQUEST');
        if (needle) assert.match(json.error.message, needle);
        return json;
    } finally {
        await stop();
    }
}

// ── make ────────────────────────────────────────────────────────────────────

test('make: still cards reach the renderer as gif.make with the ids in order', async () => {
    const { job, json } = await captureJob('/connector/gif/make', { itemIds: ['a', 'b', 'c'] });
    assert.equal(job.capability, 'gif.make');
    assert.deepEqual(job.input.itemIds, ['a', 'b', 'c']);
    assert.equal(json.ok, true);
});

test('make: a video card carries fps and the trim pair through', async () => {
    const { job } = await captureJob('/connector/gif/make',
        { videoItemId: 'v1', fps: 12, sizePreset: '480xauto', loop: 3, trimIn: 1.5, trimOut: 4 });
    assert.equal(job.capability, 'gif.make');
    assert.equal(job.input.videoItemId, 'v1');
    assert.equal(job.input.fps, 12);
    assert.equal(job.input.sizePreset, '480xauto');
    assert.equal(job.input.loop, 3);
    assert.deepEqual([job.input.trimIn, job.input.trimOut], [1.5, 4]);
});

test('make: the two sources are exclusive — both, or neither, is a 400', async () => {
    await expectBadRequest('/connector/gif/make', { itemIds: ['a', 'b'], videoItemId: 'v1' }, /not both/);
    await expectBadRequest('/connector/gif/make', {}, /not neither/);
});

test('make: one still card is not a GIF, and a bad id in the list is caught', async () => {
    await expectBadRequest('/connector/gif/make', { itemIds: ['only-one'] }, /two or more/);
    await expectBadRequest('/connector/gif/make', { itemIds: ['a', ''] }, /two or more/);
});

test('make: a video source without fps is refused before the round trip', async () => {
    await expectBadRequest('/connector/gif/make', { videoItemId: 'v1' }, /fps/);
});

test('make: a lone trim edge is refused — they are a pair in clip-seconds', async () => {
    await expectBadRequest('/connector/gif/make', { videoItemId: 'v1', fps: 12, trimIn: 2 }, /pair/);
    await expectBadRequest('/connector/gif/make', { videoItemId: 'v1', fps: 12, trimOut: 4 }, /pair/);
});

// ── edit ────────────────────────────────────────────────────────────────────

test('edit: every knob asked for reaches the renderer, and nothing else does', async () => {
    const { job } = await captureJob('/connector/gif/edit',
        { itemId: 'g1', fps: 8, loop: 0, trim: { in: 2, out: 9 } });
    assert.equal(job.capability, 'gif.edit');
    assert.deepEqual(job.input, { itemId: 'g1', fps: 8, loop: 0, trim: { in: 2, out: 9 } });
});

test('edit: loop 0 is a real value, not an absent one', async () => {
    // `0` = play forever. A truthiness check would drop it and the GIF would
    // keep whatever loop it had, silently.
    const { job } = await captureJob('/connector/gif/edit', { itemId: 'g1', loop: 0 });
    assert.equal(job.input.loop, 0);
});

test('edit: a call that asks for nothing is a 400, not a no-op entry', async () => {
    await expectBadRequest('/connector/gif/edit', { itemId: 'g1' }, /at least one edit/);
});

test('edit: itemId is required and must be a real string', async () => {
    await expectBadRequest('/connector/gif/edit', { fps: 8 }, /itemId/);
    await expectBadRequest('/connector/gif/edit', { itemId: '   ', fps: 8 }, /itemId/);
});

test('edit: an object knob sent as a scalar is a 400', async () => {
    await expectBadRequest('/connector/gif/edit', { itemId: 'g1', crop: 5 }, /crop/);
    await expectBadRequest('/connector/gif/edit', { itemId: 'g1', resize: 'big' }, /resize/);
    await expectBadRequest('/connector/gif/edit', { itemId: 'g1', trim: [2, 9] }, /trim/);
});

// ── cutout ──────────────────────────────────────────────────────────────────

test('cutout: background needs no prompt', async () => {
    const { job } = await captureJob('/connector/gif/cutout', { itemId: 'g1', method: 'background' });
    assert.equal(job.capability, 'gif.cutout');
    assert.equal(job.input.method, 'background');
    assert.equal(job.input.prompt, undefined);
});

test('cutout: by name carries the prompt, adjust and invert through', async () => {
    const { job } = await captureJob('/connector/gif/cutout',
        { itemId: 'g1', method: 'name', prompt: 'robot', adjust: { grow: 4, fillHoles: true }, invert: true });
    assert.equal(job.input.prompt, 'robot');
    assert.deepEqual(job.input.adjust, { grow: 4, fillHoles: true });
    assert.equal(job.input.invert, true);
});

test('cutout: by name without a prompt is a 400 — SAM3 tracks nothing unnamed', async () => {
    await expectBadRequest('/connector/gif/cutout', { itemId: 'g1', method: 'name' }, /prompt is required/);
});

test('cutout: an unknown method names the ones that exist', async () => {
    const json = await expectBadRequest('/connector/gif/cutout', { itemId: 'g1', method: 'colour' });
    assert.match(json.error.message, /background/);
    assert.match(json.error.message, /name/);
});

test('cutout: invert must be a boolean, never a truthy string', async () => {
    await expectBadRequest('/connector/gif/cutout', { itemId: 'g1', method: 'background', invert: 'yes' }, /boolean/);
});

// ── to-video ────────────────────────────────────────────────────────────────

test('to-video: the background colour reaches the renderer', async () => {
    const { job } = await captureJob('/connector/gif/to-video', { itemId: 'g1', background: '#101014' });
    assert.equal(job.capability, 'gif.to-video');
    assert.equal(job.input.itemId, 'g1');
    assert.equal(job.input.background, '#101014');
});

test('to-video: itemId is required, and a non-string background is a 400', async () => {
    await expectBadRequest('/connector/gif/to-video', {}, /itemId/);
    await expectBadRequest('/connector/gif/to-video', { itemId: 'g1', background: 0x101014 }, /background/);
});

// ── the shared envelope ─────────────────────────────────────────────────────

test('every verb answers APP_UNAVAILABLE when no window is listening', async () => {
    const { base, stop } = await startServer();
    try {
        const bodies = [
            ['/connector/gif/make', { itemIds: ['a', 'b'] }],
            ['/connector/gif/edit', { itemId: 'g1', fps: 8 }],
            ['/connector/gif/cutout', { itemId: 'g1', method: 'background' }],
            ['/connector/gif/to-video', { itemId: 'g1' }],
        ];
        for (const [path, body] of bodies) {
            const { status, json } = await postJson(`${base}${path}`, body);
            assert.equal(status, 200, `${path} should not 400 on a well-formed body`);
            assert.equal(json.ok, false);
            assert.equal(json.error.code, 'APP_UNAVAILABLE', path);
        }
    } finally {
        await stop();
    }
});
