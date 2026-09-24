'use strict';

/**
 * cloud-executor.test.cjs — MPI-851.
 *
 * Two things are being held down here, and the second is the one that bites.
 *
 * 1. The CONTRACT. `runCloudCommand` is `runCommand`'s twin: the whole save / sidecar /
 *    gallery-card path below the dispatch is written against a generic `exec`, so a cloud
 *    generation only works if this head speaks exactly the same handle and callbacks.
 *
 * 2. The LANE INVARIANT. `generationStore.register()` takes a lane slot, and a job that
 *    never reaches a terminal phase holds it for the rest of the session — the wedge that
 *    reads as "QUEUED forever" with nothing running. `tests/lane-settle-on-bail.test.cjs`
 *    pins that for `commandExecutor`, where eleven bails had accumulated without it; this
 *    file is its twin for the new head, written BEFORE a twelfth can accumulate here.
 *
 * The provider is stubbed. Nothing in this file may make a real DeepInfra call: a real one
 * spends the user's money, and what it would prove (the price, the response shape) was
 * already measured for $0.68 and is pinned by `tests/deepinfra-pricing.test.cjs`.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runCloudCommand, cloudErrorMessage } = require('../js/services/cloudExecutor.js');
const { generationStore, PHASES } = require('../js/services/generationStore.js');
const { MODELS } = require('../js/data/modelConstants/models.js');
const PRICES = require('../dev_configs/deepinfra-prices.json');

const CLOUD_MODELS = MODELS.filter(m => m.provider);
const MODEL_ID = 'flux-schnell-cloud';

/** Run one dispatch against a stubbed provider and report how it ended. */
function dispatch(respond, payload = {}) {
    const realFetch = global.fetch;
    global.fetch = async (url, init) => respond(String(url), init);
    const exec = runCloudCommand({ genId: 'gen-1', modelId: MODEL_ID, operation: 't2i', positive: 'a cube', ...payload });
    return new Promise((resolve) => {
        exec.onComplete = (urls, info) => resolve({ outcome: 'complete', urls, info, exec });
        exec.onError = (err) => resolve({ outcome: 'error', err, exec });
    }).finally(() => { global.fetch = realFetch; });
}

/** The store's own record for a finished dispatch. */
const jobOf = (exec) => generationStore.byId(exec.jobId);

const OK_BODY = {
    ok: true,
    viewUrls: ['http://127.0.0.1:3000/deepinfra/output/abc.jpg?filename=abc.jpg'],
    cost: { usd: 0.0005, model: 'black-forest-labs/FLUX-1-schnell', at: '2026-09-20T00:00:00Z' },
    seed: 42,
};
const okResponse = () => ({ ok: true, status: 200, json: async () => OK_BODY });

// ── the happy path ───────────────────────────────────────────────────────────────────────

test('a successful generation completes with the provider URL and the TRUE cost', async () => {
    const { outcome, urls, info, exec } = await dispatch(okResponse);
    assert.equal(outcome, 'complete');
    assert.deepEqual(urls, OK_BODY.viewUrls);
    // The estimate is for the prompt box; what lands in the sidecar is what was billed.
    assert.equal(info.cost.usd, 0.0005);
    assert.equal(info.cost.provider, 'deepinfra');
    assert.equal(jobOf(exec).phase, PHASES.DONE);
});

test('it takes the CLOUD lane — a DeepInfra call must not hold the Pod slot', async () => {
    const { exec } = await dispatch(okResponse);
    assert.equal(jobOf(exec).lane, 'cloud');
    assert.equal(jobOf(exec).engine, 'cloud');
});

test('it dispatches through the app\'s own route, never straight at the provider', async () => {
    let seen = null;
    await dispatch((url) => { seen = url; return okResponse(); });
    // The key lives in the main process and there is no channel that hands it out, so a
    // renderer-side call to api.deepinfra.com could never be authenticated anyway — but
    // the reason it must not happen is that the route is also where the model id is
    // resolved, which is what stops any renderer path spending money at any model.
    assert.equal(seen, '/deepinfra/generate');
    assert.ok(!/deepinfra\.com/.test(seen), 'must not call the provider from the renderer');
});

test('the seed reaches the provider and rides back on the handle', async () => {
    let body = null;
    const { exec } = await dispatch((url, init) => { body = JSON.parse(init.body); return okResponse(); },
        { injectionParams: { Seed: 42, Width: 1024, Height: 512 } });
    assert.equal(body.seed, 42);
    assert.equal(body.width, 1024);
    assert.equal(body.height, 512);
    assert.equal(exec.seed, 42);
});

test('an UNSEEDED run records the seed the provider chose, not -1', async () => {
    // DeepInfra picks a seed when the body carries none and reports it back. Dropping it
    // is what made the first real generation land with seed -1 in its sidecar, which
    // leaves Reuse Prompt unable to reproduce the image it is offering to reuse.
    const { exec } = await dispatch(() => ({ ok: true, status: 200, json: async () => ({ ...OK_BODY, seed: 987654 }) }));
    assert.equal(exec.seed, 987654);
});

test('a batch of four reaches the provider as ONE call, and lands four cards', async () => {
    // The SDXL shape: the batch control already caps at 4, and DeepInfra's own
    // `num_images` maximum is 4. One call, four images, ONE bill — so the agent's confirm
    // (MPI-854) shows a batch total, and each card's sidecar carries its SHARE of the one
    // bill (Fabio, 2026-09-24): $0.002 for four is $0.0005 a card, never $0.002 on each.
    let body = null;
    const four = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].map(n => `http://127.0.0.1:3000/deepinfra/output/${n}`);
    const { urls, info } = await dispatch((url, init) => {
        body = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({ ...OK_BODY, viewUrls: four, cost: { ...OK_BODY.cost, usd: 0.002 } }) };
    }, { injectionParams: { Input_Batch_Size: 4 } });
    assert.equal(body.batch, 4);
    assert.deepEqual(urls, four);
    assert.equal(info.cost.usd, 0.0005);
});

test('a batch beyond what the endpoint accepts is clamped, not sent', async () => {
    // The cap is the endpoint's own published maximum, and the client is not the
    // authority on how much of the user's money one call may spend.
    let body = null;
    await dispatch((url, init) => { body = JSON.parse(init.body); return okResponse(); },
        { injectionParams: { Input_Batch_Size: 99 } });
    assert.equal(body.batch, 4);
});

test('the cloud model declares batch as REAL, on the op that has it', () => {
    const model = MODELS.find(m => m.id === MODEL_ID);
    assert.notEqual(model.capabilities?.batch, false, 'batch was switched off for a model that bills per image');
    assert.deepEqual(model.batchOps, ['t2i']);
    // The cap is no longer written on the ModelDef (MPI-853). It is read from the price
    // snapshot's copy of the endpoint's own `num_images` maximum, which is the only way
    // the other fifteen models could each be capped correctly — eleven have no native
    // batch at all, and Veo calls its own `sample_count`.
    const { batchFieldFor } = require('../js/data/modelConstants/deepinfraSizing.js');
    assert.equal(model.cloud.maxBatch, undefined, 'the hand-written cap should be gone');
    assert.deepEqual(batchFieldFor(model.cloud.endpointId), { field: 'num_images', max: 4 });
});

// ── every exit reaches a terminal, and says something useful ─────────────────────────────

test('a coded provider refusal settles the lane and reports actionable copy', async () => {
    const { outcome, err, exec } = await dispatch(() => ({
        ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'NO_KEY' } }),
    }));
    assert.equal(outcome, 'error');
    assert.equal(err.message, 'NO_KEY');
    assert.equal(jobOf(exec).phase, PHASES.ERROR);
    // "Something went wrong" is not a fix. The copy has to say where the key goes.
    assert.match(cloudErrorMessage('NO_KEY'), /Settings/);
});

test('an HTTP failure settles the lane', async () => {
    const { outcome, exec } = await dispatch(() => ({ ok: false, status: 500, json: async () => ({}) }));
    assert.equal(outcome, 'error');
    assert.equal(jobOf(exec).phase, PHASES.ERROR);
});

test('a transport failure settles the lane', async () => {
    const { outcome, exec } = await dispatch(() => { throw new Error('ECONNREFUSED'); });
    assert.equal(outcome, 'error');
    assert.equal(jobOf(exec).phase, PHASES.ERROR);
});

test('a model with no cloud endpoint refuses instead of dispatching', async () => {
    let dispatched = false;
    // Count the GENERATION route only: a failure also writes a client log, which is
    // itself a fetch, and counting every call would make this pass for the wrong reason.
    const { outcome, exec } = await dispatch((url) => {
        if (url === '/deepinfra/generate') dispatched = true;
        return okResponse();
    }, { modelId: 'sdxl-realistic' });
    assert.equal(outcome, 'error');
    assert.equal(dispatched, false, 'a local model must never reach the cloud route');
    assert.equal(jobOf(exec).phase, PHASES.ERROR);
});

test('every failure message names a non-billing cause where one is true', () => {
    // Failed calls are not billed, and a user who thinks they were will stop using the
    // feature. Verified against the account's usage page during the MPI-849 research.
    assert.match(cloudErrorMessage('CONTENT_FILTERED'), /not billed/);
    assert.match(cloudErrorMessage('PROVIDER_ERROR'), /not billed/);
    assert.match(cloudErrorMessage('NO_CREDIT'), /nothing was billed/);
});

test('an unknown code still returns copy rather than undefined', () => {
    assert.ok(cloudErrorMessage('SOMETHING_NEW').length > 0);
    assert.ok(cloudErrorMessage(undefined, 'a passed-through message').length > 0);
});

// ── structural: the lane invariant, held the way its commandExecutor twin is ─────────────

test('no exit from the dispatch body returns without settling the store job', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'cloudExecutor.js'), 'utf8');
    const lines = src.split(/\r?\n/);
    const from = lines.findIndex(l => l.includes('generationStore.register({'));
    const to = lines.findIndex(l => l.includes('exec.onComplete?.('));
    assert.ok(from > 0 && to > from, 'the dispatch body moved — re-anchor this test');

    let checked = 0;
    for (let i = from; i < to; i++) {
        if (!/\breturn;/.test(lines[i])) continue;
        checked++;
        // Safe either inline (`{ _settleCancelled(); return; }`) or with the settle on one
        // of the two lines above (`_settleError(...)` then a bare `return;`).
        const window = [lines[i], lines[i - 1] || '', lines[i - 2] || ''].join('\n');
        assert.match(window, /_settleError\(|_settleCancelled\(/,
            `cloudExecutor.js:${i + 1} returns without settling — the cloud lane wedges. Route it through _settleError/_settleCancelled.`);
    }
    // A scanner that finds nothing to check passes against any file at all.
    assert.ok(checked >= 5, `expected the bail returns to exist, found ${checked}`);
});

// ── the catalogue side of the contract ───────────────────────────────────────────────────

test('a cloud ModelDef declares nothing that the install machinery would answer for', () => {
    assert.ok(CLOUD_MODELS.length > 0, 'at least one cloud model must ship');
    for (const model of CLOUD_MODELS) {
        // An empty dep list reads as INSTALLED in two places by accident — `[].every()`
        // and the server's `allPresent` loop that never runs — so the shape must be
        // absent, not empty.
        assert.equal(model.dependencies, undefined, `${model.id} declares dependencies`);
        assert.equal(model.commonDeps, undefined, `${model.id} declares commonDeps`);
        assert.equal(model.engines, undefined, `${model.id} declares engines`);
        assert.equal(model.variants, undefined, `${model.id} declares variants`);
        // `installedOpsForContext` returns null for a model with no `operations`, which is
        // what makes the op strip fall back to supportedOps. Declare one and every op
        // disappears behind a dep cache that will never have an entry.
        assert.equal(model.operations, undefined, `${model.id} declares operations`);
        assert.ok(model.cloud?.endpointId, `${model.id} has no cloud endpoint`);
        assert.ok((model.supportedOps || []).length > 0, `${model.id} supports no operations`);
    }
});

test('every cloud model can be PRICED — its endpoint id is one the snapshot knows', () => {
    // The two halves of MPI-849 phase 1 meet here: MPI-850 prices by DeepInfra's own model
    // id, so a ModelDef naming an id the snapshot has never heard of would show a tile with
    // no price and dispatch anyway.
    for (const model of CLOUD_MODELS) {
        assert.ok(PRICES.models[model.cloud.endpointId],
            `${model.id} points at ${model.cloud.endpointId}, which is not in dev_configs/deepinfra-prices.json`);
    }
});

// ── the route: the only place the key is ever touched ────────────────────────────────────

/** The deepinfra router on an ephemeral port, the way the other route tests do it. */
async function routeServer() {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('../routes/deepinfra.js'));
    return new Promise(r => { const server = app.listen(0, '127.0.0.1', () => r(server)); });
}

async function post(server, body) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/deepinfra/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
}

test('with no connection resolvable, the route REFUSES with a code and spends nothing', async () => {
    // Two belts. There is no Electron main here, so `ask` resolves null and no key can be
    // found — but `resolveConnection` also falls back to DEEPINFRA_API_KEY, and a machine
    // with that set would otherwise make this test buy an image.
    const savedEnv = process.env.DEEPINFRA_API_KEY;
    delete process.env.DEEPINFRA_API_KEY;
    const realFetch = global.fetch;
    let upstreamCalled = false;
    const server = await routeServer();
    try {
        global.fetch = async (url, init) => {
            if (String(url).includes('api.deepinfra.com')) { upstreamCalled = true; throw new Error('the test must never call the provider'); }
            return realFetch(url, init);
        };
        const { json } = await post(server, { modelId: MODEL_ID, prompt: 'a cube' });
        assert.equal(json.ok, false);
        // NO_PROFILE when the connection itself is absent, NO_KEY when it exists without
        // one. Either is the honest answer; what matters is that it is CODED, so the UI
        // can say where the key goes instead of showing a generic failure.
        assert.ok(['NO_KEY', 'NO_PROFILE'].includes(json.error.code), `unexpected code ${json.error.code}`);
        assert.equal(upstreamCalled, false, 'a keyless request must never reach the provider');
    } finally {
        global.fetch = realFetch;
        if (savedEnv !== undefined) process.env.DEEPINFRA_API_KEY = savedEnv;
        server.close();
    }
});

test('the route resolves the endpoint from the MODEL ID, so a client cannot name one', async () => {
    const server = await routeServer();
    try {
        // A local model, and a model id that does not exist at all: both refused before
        // any key is resolved. The ModelDef is the whitelist — if the client could pass an
        // endpoint id, any renderer path could spend the user's money at any model on the
        // provider's catalogue.
        for (const modelId of ['sdxl-realistic', 'not-a-model', undefined]) {
            const { status, json } = await post(server, { modelId, prompt: 'x' });
            assert.equal(status, 400, `${modelId} was not refused`);
            assert.equal(json.ok, false);
            assert.equal(json.error.code, 'PROVIDER_ERROR');
        }
    } finally {
        server.close();
    }
});

test('an OVER-DELIVERY is clamped to the count asked for (MPI-875)', async () => {
    // Live on 2026-09-21: `google/nano-banana-2` answered a one-image request with the
    // same generation TWICE — byte-identical pixels, a fresh C2PA signature on each copy,
    // and one charge for the pair. Unclamped, the second copy becomes its own gallery card
    // (`generationService` builds one per url) carrying the WHOLE call's cost, which is
    // what made a single $0.067 run read as two.
    const savedEnv = process.env.DEEPINFRA_API_KEY;
    process.env.DEEPINFRA_API_KEY = 'not-a-real-key-the-provider-is-stubbed';
    const realFetch = global.fetch;
    const server = await routeServer();
    // The 1x1 PNG from DeepInfra's own published `out_example`.
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12PQz3wAAAJDAXkkWn+MAAAAAElFTkSuQmCC';
    try {
        global.fetch = async (url, init) => {
            if (!String(url).includes('api.deepinfra.com')) return realFetch(url, init);
            return new Response(JSON.stringify({
                images: [pixel, pixel],
                seed: 42,
                inference_status: { cost: 0.067257 },
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        };
        const { json } = await post(server, { modelId: MODEL_ID, prompt: 'a cube', batch: 1 });
        assert.equal(json.ok, true, `the route refused: ${json.error?.code}`);
        assert.equal(json.viewUrls.length, 1, 'the second delivery would have become a second card');
        // And the bill is the CALL's, which is why the extra card is wrong rather than
        // merely untidy: both cards would have carried this whole figure.
        assert.equal(json.cost.usd, 0.067257);

        const id = /output\/([^?]+)/.exec(json.viewUrls[0])[1];
        fs.rmSync(path.join(os.tmpdir(), 'cubric-deepinfra', id), { force: true });
    } finally {
        global.fetch = realFetch;
        if (savedEnv === undefined) delete process.env.DEEPINFRA_API_KEY;
        else process.env.DEEPINFRA_API_KEY = savedEnv;
        server.close();
    }
});

test('the route never hands the client anything from the upstream body', () => {
    // `routes/secretRedaction.js` is five regexes for key-shaped strings: it cannot scrub a
    // billing address, a postcode or a card last4, and DeepInfra's account-facing responses
    // carry all three. So the rule is structural — this file builds its own response object
    // and logs a STATUS, never a body.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'deepinfra.js'), 'utf8');
    const logged = src.match(/logger\.\w+\([^)]*\)/g) || [];
    assert.ok(logged.length > 0, 'the route logs nothing at all — re-anchor this test');
    for (const call of logged) {
        // A STATUS CODE is fine, and is the point: it is the one upstream fact that
        // carries no account detail. Everything that could carry one is banned by name.
        assert.ok(!/\bjson\b|err\.message|JSON\.stringify|bodyText|upstream\.text/.test(call),
            `a log line carries upstream content: ${call}`);
    }
    // And the response is BUILT, never echoed: picking `json.seed` by name is the safe
    // pattern (routes/remotePodLifecycle.js answers five named scalars from a fat upstream
    // object); spreading or forwarding the body is what leaks an address or a card last4.
    assert.ok(!/\.\.\.\s*json\b/.test(src), 'the upstream body is spread into a response');
    assert.ok(!/res\.json\(\s*json\b/.test(src), 'the upstream body is returned directly');
    const success = src.match(/res\.json\(\{\s*\n\s*ok: true,[\s\S]*?\n    \}\);/);
    assert.ok(success, 'the success response moved — re-anchor this test');
    const keys = [...success[0].matchAll(/^\s{8}(\w+)[:,]/gm)].map(m => m[1]);
    assert.deepEqual(keys.sort(), ['cost', 'ok', 'seed', 'viewUrls'],
        `the success response gained a field: ${keys.join(', ')}`);
});

// ── the seam itself ──────────────────────────────────────────────────────────────────────

test('generationService branches on provider BEFORE runCommand, not inside it', () => {
    // This one line is the whole integration, and it is the kind of line a refactor
    // "simplifies" away. Inside `runCommand` would be worse than wrong: it reaches
    // `comfyController.runWorkflow`, which calls `ensureServerRunning`, so a cloud
    // dispatch would cold-start a local ComfyUI on a machine that may have no GPU.
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'generationService.js'), 'utf8');
    assert.match(src, /const exec = \(model\.provider \? runCloudCommand : runCommand\)\(\{/,
        'the cloud seam is gone from generationService — a cloud model would dispatch to ComfyUI');
    assert.match(src, /import \{ runCloudCommand \}/, 'the cloud head is not imported');

    // And Run-locally must not reach a cloud job: routed local it lands in
    // `_findModelNotLocal`, hunting weights for a model whose point is having none.
    assert.match(src, /forceLocal: model\.provider \? false :/, 'a cloud job can still be forced local');

    // The intent lane must read the MODEL, or the store's lane and the service's lane
    // disagree — the MPI-213 phantom "1 RUNNING" that never drains.
    assert.match(src, /provider\) return 'cloud'/, '_laneOf does not know about cloud models');
});
