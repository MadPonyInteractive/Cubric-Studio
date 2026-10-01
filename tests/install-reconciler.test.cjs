'use strict';

// Contract tests for routes/install/reconciler.js (MPI-276 Phase 3, G11).
// Run: node tests/install-reconciler.test.cjs

const assert = require('node:assert/strict');
const { createInstallStore } = require('../routes/install/installStore.js');
const { createReconciler, ORPHAN_MS } = require('../routes/install/reconciler.js');

// ── Harness ─────────────────────────────────────────────────────────────────────

// MPI-513 D4: the reconciler settles DEPS only. Moving a model to a terminal state
// (and broadcasting it) belongs to the one model-level rollup the host injects as
// `onSettled`. The rig records every call, and `rollup` lets a test stand in a minimal
// rollup when it needs the model to actually settle (e.g. to observe the prune).
function makeRig(installedTruth = new Map(), { rollup, transportLive = new Set() } = {}) {
    let clock = 1000;
    const events = [];
    const store = createInstallStore({
        broadcast: (event, data) => events.push({ event, data }),
        logger: { info() {}, warn() {}, error() {} },
        now: () => clock,
    });
    // Count every model transition the RECONCILER makes (the rollup's own are excluded).
    let inRollup = false;
    const reconcilerModelMoves = [];
    const realTransitionModel = store.transitionModel;
    store.transitionModel = (modelId, to, reason) => {
        if (!inRollup) reconcilerModelMoves.push({ modelId, to, reason });
        return realTransitionModel(modelId, to, reason);
    };
    const settledCalls = [];
    // Mutable truth map the reconciler queries; tests flip entries then re-run.
    const truth = new Map(installedTruth);
    const rec = createReconciler({
        store,
        checkInstalled: async () => truth,
        isTransportLive: (depId) => transportLive.has(depId),
        onSettled: (info) => {
            settledCalls.push(info);
            if (rollup) { inRollup = true; try { rollup(store); } finally { inRollup = false; } }
        },
        now: () => clock,
        logger: { info() {}, warn() {}, error() {} },
    });
    return {
        store, rec, events, truth, settledCalls, reconcilerModelMoves, transportLive,
        tick: (ms) => { clock += ms; },
        now: () => clock,
        snapshots: () => events.filter(e => e.event === 'download:snapshot'),
    };
}

// Minimal stand-in for downloadManager's _checkModelJobsComplete: all deps complete →
// done; any failed → failed. Only used where a test needs the model to settle.
function stubRollup(store) {
    for (const j of store.allModelJobs()) {
        if (store.MODEL_TERMINAL.has(j.status)) continue;
        if (j.deps.some(d => d.status === 'failed')) store.transitionModel(j.modelId, 'failed', 'rollup');
        else if (j.deps.every(d => d.status === 'complete')) store.transitionModel(j.modelId, 'done', 'rollup');
    }
}

function register(store, modelId, deps, engine = 'local') {
    const job = store.registerModelJob({ modelId, engine, deps });
    store.transitionModel(modelId, 'downloading', 'test start');
    return job;
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); } catch (err) {
        failed += 1;
        console.log(`  FAIL  ${name}\n        ${err.message.split('\n')[0]}`);
        return;
    }
    passed += 1;
    console.log(`  ok  ${name}`);
}

(async () => {
    // ── missed-terminal heal (MPI-254/255 shape) ─────────────────────────────────
    await test('all-bytes-in dep with missed terminal SSE settles to complete', async () => {
        const { store, rec } = makeRig();
        register(store, 'ill-anime', [
            { depId: 'base', type: 'model', totalBytes: 1000, downloadedBytes: 1000 },
        ]);
        store.transitionDep('base', 'downloading', 'test');
        // bytes all in but status stuck at downloading (lost models:install-complete)
        assert.equal(store.depJob('base').status, 'downloading');
        await rec.reconcileOnce();
        assert.equal(store.depJob('base').status, 'complete');
    });

    await test('a dep the transport still holds is never settled, even with all bytes in', async () => {
        // Local sha256 verify: the file is byte-complete and the downloader is still
        // hashing it. Settling here would announce an install whose verify can still fail.
        const { store, rec, settledCalls } = makeRig(new Map([['w', true]]), { transportLive: new Set(['w']) });
        register(store, 'm', [{ depId: 'w', type: 'model', totalBytes: 1000, downloadedBytes: 1000 }]);
        store.transitionDep('w', 'downloading', 'test');
        await rec.reconcileOnce();
        assert.equal(store.depJob('w').status, 'downloading');
        assert.equal(settledCalls.length, 0);
    });

    await test('truth-installed dep settles even without full byte count', async () => {
        const { store, rec, truth } = makeRig();
        // two deps; only 'weight' is truth-installed so the model does NOT fully
        // settle+prune, letting us observe the settled dep directly.
        register(store, 'm', [
            { depId: 'weight', type: 'model', totalBytes: 0, downloadedBytes: 0 },
            { depId: 'other', type: 'model', totalBytes: 500, downloadedBytes: 100 },
        ]);
        store.transitionDep('weight', 'downloading', 'test');
        store.transitionDep('other', 'downloading', 'test');
        truth.set('weight', true); // volume says it's there
        await rec.reconcileOnce();
        assert.equal(store.depJob('weight').status, 'complete');
        assert.equal(store.depJob('other').status, 'downloading'); // not settled
    });

    // ── one model-level writer (MPI-513 D4) ──────────────────────────────────────
    await test('settled deps are handed to onSettled; the reconciler never moves the model', async () => {
        const { store, rec, settledCalls, reconcilerModelMoves } = makeRig();
        register(store, 'm', [
            { depId: 'a', type: 'model', totalBytes: 500, downloadedBytes: 500 },
            { depId: 'b', type: 'model', totalBytes: 500, downloadedBytes: 500 },
        ]);
        store.transitionDep('a', 'downloading', 't');
        store.transitionDep('b', 'downloading', 't');
        reconcilerModelMoves.length = 0; // the rig's own register() moves don't count
        await rec.reconcileOnce();
        assert.equal(store.depJob('a').status, 'complete');
        assert.equal(store.depJob('b').status, 'complete');
        assert.equal(settledCalls.length, 1, 'the rollup runs once, after the pass settled deps');
        assert.deepEqual(reconcilerModelMoves, [], 'no model transition from the reconciler');
        assert.equal(store.modelJob('m').status, 'downloading', 'the rollup, not the reconciler, settles the model');
    });

    await test('an INSTALLING job (nodes extracting) is never rolled to done (MPI-317 F4 root)', async () => {
        // Local model, zips all down, nodes extracting: every dep is complete and on disk,
        // so the old step 3 moved it installing -> done mid-extract, with no
        // download:complete broadcast and the transport still working.
        const { store, rec, truth, reconcilerModelMoves } = makeRig();
        register(store, 'm', [
            { depId: 'w', type: 'model', totalBytes: 500, downloadedBytes: 500 },
            { depId: 'n', type: 'custom_nodes', totalBytes: 10, downloadedBytes: 10 },
        ]);
        store.transitionDep('w', 'complete', 't');
        store.transitionDep('n', 'complete', 't');
        store.transitionModel('m', 'installing', 't');
        truth.set('w', true);
        truth.set('n', true);
        reconcilerModelMoves.length = 0;
        await rec.reconcileOnce();
        assert.deepEqual(reconcilerModelMoves, []);
        assert.equal(store.modelJob('m').status, 'installing');
    });

    await test('prune runs AFTER the rollup, so a model it settled this pass is confirmed + pruned', async () => {
        const { store, rec, truth } = makeRig(new Map(), { rollup: stubRollup });
        register(store, 'p', [{ depId: 'x', type: 'model', totalBytes: 100, downloadedBytes: 100 }]);
        truth.set('x', true);
        await rec.reconcileOnce();       // settles dep → rollup: model done → confirmed → pruned
        assert.equal(store.modelJob('p'), undefined);
    });

    await test('model with a still-pending custom_node does NOT roll to done', async () => {
        const { store, rec } = makeRig();
        register(store, 'm', [
            { depId: 'w', type: 'model', totalBytes: 500, downloadedBytes: 500 },
            { depId: 'node', type: 'custom_nodes' },
        ]);
        store.transitionDep('w', 'downloading', 't');
        await rec.reconcileOnce();
        // weight settled, but node pending → model stays downloading (adapter owns nodes)
        assert.equal(store.depJob('w').status, 'complete');
        assert.equal(store.modelJob('m').status, 'downloading');
    });

    // ── orphan fail (research/01 §3-C live-evidence shape) ────────────────────────
    await test('orphan: deps fail WITH a reason and the model goes through the rollup', async () => {
        // The old store-only model fail sent no download:failed and told the transport
        // nothing. Failing the deps with a reason and handing over to the rollup gives
        // the user the same failure, with words, that every other failure path does.
        const { store, rec, tick, settledCalls, reconcilerModelMoves } = makeRig();
        const job = register(store, 'ghost', [{ depId: 'x', type: 'model', totalBytes: 1000, downloadedBytes: 0 }]);
        job.registeredAt = 1000;                  // host stamps this at register
        tick(ORPHAN_MS + 1);
        reconcilerModelMoves.length = 0;
        await rec.reconcileOnce();
        const dep = store.depJob('x');
        assert.equal(dep.status, 'failed');
        assert.equal(typeof dep.error, 'string');
        assert.ok(dep.error.length > 0, 'the failed dep carries a reason for download:failed');
        assert.deepEqual(reconcilerModelMoves, [], 'the model moves only in the rollup');
        assert.equal(settledCalls.length, 1);
    });

    await test('orphan + rollup ends with the model failed', async () => {
        const { store, rec, tick } = makeRig(new Map(), { rollup: stubRollup });
        const job = register(store, 'ghost', [{ depId: 'x', type: 'model', totalBytes: 1000, downloadedBytes: 0 }]);
        job.registeredAt = 1000;
        tick(ORPHAN_MS + 1);
        await rec.reconcileOnce();
        assert.equal(store.modelJob('ghost').status, 'failed');
    });

    await test('a job waiting in the transport queue is NOT an orphan, however long it waits', async () => {
        // LOCAL_DOWNLOAD_CONCURRENCY is 3: a 4th model's deps sit `queued` with 0 bytes
        // behind three big downloads for minutes. That is a queue, not an orphan.
        const { store, rec, tick } = makeRig(new Map(), { transportLive: new Set(['x']) });
        const job = register(store, 'waiting', [{ depId: 'x', type: 'model', totalBytes: 1000, downloadedBytes: 0 }]);
        job.registeredAt = 1000;
        tick(ORPHAN_MS * 10);
        await rec.reconcileOnce();
        assert.equal(store.depJob('x').status, 'queued');
        assert.equal(store.modelJob('waiting').status, 'downloading');
    });

    await test('fresh job within grace window is NOT failed', async () => {
        const { store, rec, tick } = makeRig();
        const job = register(store, 'fresh', [{ depId: 'x', type: 'model', totalBytes: 1000, downloadedBytes: 0 }]);
        job.registeredAt = 1000;
        tick(ORPHAN_MS - 5000); // still inside grace
        await rec.reconcileOnce();
        assert.equal(store.modelJob('fresh').status, 'downloading');
    });

    await test('job making byte progress is never failed even if stale-ish', async () => {
        const { store, rec, tick } = makeRig();
        const job = register(store, 'slow', [{ depId: 'x', type: 'model', totalBytes: 10_000, downloadedBytes: 200 }]);
        job.registeredAt = 1000;
        tick(ORPHAN_MS + 10_000);
        await rec.reconcileOnce();
        assert.equal(store.modelJob('slow').status, 'downloading'); // has progress → not orphan
    });

    // ── never resurrect terminal jobs (invariant #3) ─────────────────────────────
    await test('terminal (cancelled) job is never resurrected by reconcile', async () => {
        const { store, rec, truth } = makeRig();
        register(store, 'c', [{ depId: 'x', type: 'model', totalBytes: 100, downloadedBytes: 100 }]);
        store.transitionModel('c', 'cancelled', 'user');
        truth.set('x', true); // even if disk now shows it — do not un-cancel
        await rec.reconcileOnce();
        // model is terminal; either still cancelled or pruned, but NEVER done/downloading
        const j = store.modelJob('c');
        if (j) assert.equal(j.status, 'cancelled');
    });

    // ── snapshot version strictly increases on mutation ──────────────────────────
    await test('snapshot broadcast fires and version increases when a pass mutates', async () => {
        const { store, rec, snapshots } = makeRig();
        register(store, 'v', [{ depId: 'x', type: 'model', totalBytes: 100, downloadedBytes: 100 }]);
        store.transitionDep('x', 'downloading', 't');
        const before = store.version();
        await rec.reconcileOnce();
        assert.ok(store.version() > before, 'version bumped');
        assert.ok(snapshots().length >= 1, 'snapshot broadcast');
    });

    await test('idle pass (no active jobs) does not broadcast or run the rollup', async () => {
        const { store, rec, snapshots, settledCalls } = makeRig();
        // no jobs registered
        const r = await rec.reconcileOnce();
        assert.deepEqual(r, { settled: [], failed: [], pruned: [] });
        assert.equal(snapshots().length, 0);
        assert.equal(settledCalls.length, 0);
        void store;
    });

    await test('checkInstalled throwing skips the pass without mutating', async () => {
        let clock = 1000;
        const store = createInstallStore({ broadcast() {}, logger: { info() {}, warn() {}, error() {} }, now: () => clock });
        store.registerModelJob({ modelId: 'e', engine: 'local', deps: [{ depId: 'x', type: 'model', totalBytes: 100, downloadedBytes: 100 }] });
        store.transitionModel('e', 'downloading', 't');
        store.transitionDep('x', 'downloading', 't');
        const rec = createReconciler({
            store,
            checkInstalled: async () => { throw new Error('wrapper down'); },
            now: () => clock,
            logger: { info() {}, warn() {}, error() {} },
        });
        const before = store.version();
        const r = await rec.reconcileOnce();
        assert.deepEqual(r, { settled: [], failed: [], pruned: [] });
        assert.equal(store.version(), before); // no mutation
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
})().catch(err => { console.error(err); process.exit(1); });
