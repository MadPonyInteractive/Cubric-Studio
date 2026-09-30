'use strict';

/**
 * no-engine-gate.test.cjs — MPI-856, the cloud-only user.
 *
 * A user who skipped the ComfyUI install and has no Pod can open projects and run cloud
 * models, so every ENGINE action has to be refused somewhere they cannot miss. That place
 * is `ensureServerRunning`: every workflow run starts there. Held down here:
 *
 * 1. With no engine it refuses with `NO_ENGINE_CODE` after ONE warning, never the
 *    "ComfyUI failed to start" error, and never asks the server to start ComfyUI.
 * 2. A boot auto-start (background) refuses silently.
 * 3. A user WITH an engine pays nothing: skip off returns before any request.
 * 4. Enhance / Describe fall from `comfy` to the endpoint backend only when there is no engine.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { localEngine } = require('../js/services/comfyController.js');
const { hasNoEngine, NO_ENGINE_CODE } = require('../js/services/engineGate.js');
const { runnableBackend } = require('../js/services/llmService.js');
const { state } = require('../js/state.js');
const { Events } = require('../js/events.js');

/** Run `fn` with a stub server; report every URL it asked for and every toast it raised. */
async function withStubs({ skip, needsInstall = true }, fn) {
    const realFetch = global.fetch;
    const urls = [];
    const toasts = { warning: 0, error: 0 };
    global.fetch = async (url) => {
        urls.push(String(url));
        const body = String(url).startsWith('/engine/version-check') ? { needsInstall } : {};
        return { ok: true, status: 200, json: async () => body };
    };
    const offs = [
        Events.on('ui:warning', () => { toasts.warning += 1; }),
        Events.on('ui:error', () => { toasts.error += 1; }),
    ];
    state.runpodConfig = { ...(state.runpodConfig || {}), skipLocalEngine: skip };
    try {
        return { result: await fn(), urls, toasts };
    } finally {
        global.fetch = realFetch;
        offs.forEach(off => off());
    }
}

test('no engine: ensureServerRunning refuses with the code and one warning, never starts ComfyUI', async () => {
    const { result, urls, toasts } = await withStubs({ skip: true }, () =>
        localEngine.ensureServerRunning().then(() => null, err => err));
    assert.ok(result instanceof Error, 'it must reject');
    assert.equal(result.code, NO_ENGINE_CODE);
    assert.deepEqual(toasts, { warning: 1, error: 0 });
    assert.ok(!urls.some(u => u.startsWith('/comfy/')), `asked the engine anyway: ${urls.join(', ')}`);
});

test('no engine, background start: refuses without a toast', async () => {
    const { result, toasts } = await withStubs({ skip: true }, () =>
        localEngine.ensureServerRunning({ background: true }).then(() => null, err => err));
    assert.equal(result?.code, NO_ENGINE_CODE);
    assert.deepEqual(toasts, { warning: 0, error: 0 });
});

test('skip on but the engine IS installed: not refused', async () => {
    const { result } = await withStubs({ skip: true, needsInstall: false }, () => hasNoEngine());
    assert.equal(result, false);
});

test('engine user (skip off): no request at all, not refused', async () => {
    const { result, urls } = await withStubs({ skip: false }, () => hasNoEngine());
    assert.equal(result, false);
    // `/log` is clientLogger flushing an earlier test's lines, not the gate asking.
    assert.deepEqual(urls.filter(u => u !== '/log'), []);
});

test('Enhance / Describe backend: comfy falls to endpoint only with no engine', async () => {
    assert.equal((await withStubs({ skip: true }, () => runnableBackend('comfy'))).result, 'endpoint');
    assert.equal((await withStubs({ skip: false }, () => runnableBackend('comfy'))).result, 'comfy');
    assert.equal((await withStubs({ skip: true }, () => runnableBackend('ollama'))).result, 'ollama');
});
