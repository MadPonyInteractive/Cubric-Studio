'use strict';

// MPI-894 — two remote bugs found in the MPI-595 smoke, 2026-09-28 (app.log 19:18-20:24Z).
//
// 1. POD IDENTITY. The renderer read the user's saved GPU PICKER as the connected Pod's
//    card. A Pod made over HTTP (/remote/pod/create — the smoke runner, an outside agent)
//    never touches the picker, so every connect said "RTX 2000 Ada", the hot-store VRAM
//    cap and the MPI-200 arch came from the wrong card, and the MPI-539 download-Pod
//    guard missed a CPU Pod and staged weights onto it. The server now records the
//    tracked Pod's card and everything reads that.
//
// 2. HOT-STORE 524. Each ensure held one HTTP request open for a whole volume->disk copy;
//    RunPod's proxy cuts a request at ~100 s (524), the copy kept the wrapper's one lock,
//    and stage-on-connect sent one such request PER MODEL (a 524 every ~2 min), with the
//    user's own gen queued behind. Now the wrapper queues (`async`) and the app polls.
//    The wrapper half is pinned by mpi-ci/cubric-vision-pod/wrapper/test_hot_store_async.py.

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi894-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const { client } = require('../routes/runpodRemote');
const { router, _createPodInternal } = require('../routes/remotePodLifecycle');
const { getRemoteMode, setRemoteMode } = require('../routes/remotePodState');

const PICKER = 'NVIDIA RTX 2000 Ada Generation'; // what Fabio's Settings had saved
const RENTED = 'NVIDIA GeForce RTX 5090';        // what the runner actually rented

client.listPods = async () => ({ ok: true, status: 200, json: [] });
client.listVolumes = async () => ({ ok: true, status: 200, json: [] });
client.deletePod = async () => ({ ok: true, status: 200, json: {} });
client.createPod = async () => ({ ok: true, status: 201, json: { id: 'pod-894' } });
client.getPod = async () => ({ ok: true, status: 200, json: {} });
client.gpuTypes = async () => [
    { id: PICKER, displayName: 'RTX 2000 Ada', memoryInGb: 16 },
    { id: RENTED, displayName: 'RTX 5090', memoryInGb: 32 },
];

test('a create records the rented card and the CPU flag on the server', async () => {
    await _createPodInternal('key', { gpuTypeId: RENTED, volumeId: 'v', datacenter: 'EU-RO-1', wait: false });
    assert.equal(getRemoteMode().gpuTypeId, RENTED);
    assert.equal(getRemoteMode().noGpu, false);

    await _createPodInternal('key', { gpuTypeId: '__cpu__', volumeId: 'v', datacenter: 'EU-RO-1', wait: false });
    assert.equal(getRemoteMode().gpuTypeId, '__cpu__');
    assert.equal(getRemoteMode().noGpu, true);

    setRemoteMode({ active: false, noGpu: false, gpuTypeId: null });
    assert.equal(getRemoteMode().gpuTypeId, null, 'a disconnect must forget the card');
});

test('/remote/pod/specs names the TRACKED Pod, not the caller\'s picker', async () => {
    const app = express();
    app.use(router);
    const srv = app.listen(0);
    try {
        const port = srv.address().port;
        const specs = () => fetch(`http://127.0.0.1:${port}/remote/pod/specs?gpuTypeId=${encodeURIComponent(PICKER)}`)
            .then(r => r.json());

        setRemoteMode({ active: true, podId: 'pod-894', noGpu: false, gpuTypeId: RENTED });
        const got = await specs();
        assert.notEqual(got.gpuName, PICKER,
            'REGRESSION: the badge named the saved picker instead of the rented Pod');
        assert.ok([RENTED, 'RTX 5090'].includes(got.gpuName), JSON.stringify(got));

        setRemoteMode({ active: true, podId: 'pod-894', noGpu: true, gpuTypeId: '__cpu__' });
        assert.equal((await specs()).gpuName, 'No GPU (download)');

        // No Pod tracked: the picker is the only thing to go on.
        setRemoteMode({ active: false, noGpu: false, gpuTypeId: null });
        assert.ok([PICKER, 'RTX 2000 Ada'].includes((await specs()).gpuName));
    } finally {
        srv.close();
    }
});

// --- renderer -------------------------------------------------------------------------

// state.runpodConfig persists on change; give it somewhere to go.
const _ls = new Map();
globalThis.localStorage = {
    getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
    setItem: (k, v) => _ls.set(k, String(v)),
    removeItem: (k) => _ls.delete(k),
    clear: () => _ls.clear(),
};

/** Route fetch by URL fragment; records hot-store bodies. */
function stubFetch(mode, hotStore) {
    const posts = [];
    globalThis.fetch = async (url, opts = {}) => {
        const u = String(url);
        const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
        if (u.includes('/remote/mode')) return reply(mode);
        if (u.includes('/remote/ws-token')) return reply({});
        if (u.includes('/remote/pod/specs')) return reply({ vramGb: 32 });
        if (u.includes('/remote/hot-store/ensure')) {
            const body = JSON.parse(opts.body);
            posts.push(body);
            return reply(hotStore(body, posts));
        }
        return reply({}, 404);
    };
    return posts;
}

async function load() {
    const { remoteEngineClient } = await import('../js/services/remoteEngineClient.js');
    const { state } = await import('../js/state.js');
    const ce = await import('../js/services/commandExecutor.js');
    return { remoteEngineClient, state, ...ce };
}

test('arch follows the connected Pod, the picker only when none is connected', async () => {
    const { remoteEngineClient, state } = await load();
    state.runpodConfig = { ...state.runpodConfig, gpuType: PICKER };
    remoteEngineClient._active = true;
    remoteEngineClient._gpuType = RENTED;
    assert.equal(remoteEngineClient.archSync('remote'), 'blackwell',
        'REGRESSION: a 5090 Pod resolved the Ada picker\'s arch');
    assert.equal(await remoteEngineClient.arch('remote'), 'blackwell');
    remoteEngineClient._active = false;
    assert.equal(remoteEngineClient.archSync('remote'), 'modern', 'no Pod: the picker decides');
    remoteEngineClient._gpuType = null;
});

test('stage-on-connect sends ONE queued request for the whole set', async () => {
    const { state, prefetchInstalledModels } = await load();
    state.runpodConfig = { ...state.runpodConfig, gpuType: PICKER, stageOnConnect: true };
    state.s_installedModelIds = ['klein-4b', 'klein-9b'];
    const posts = stubFetch(
        { active: true, noGpu: false, gpuTypeId: RENTED },
        (b) => (b.dryRun ? { async: true, pending: b.files.length } : { async: true }),
    );
    await prefetchInstalledModels();

    const real = posts.filter(b => !b.dryRun);
    assert.equal(real.length, 1, `REGRESSION: one ensure per model (${real.length}) — each one 524s past ~100 s`);
    assert.equal(real[0].async, true, 'the prefetch must ask the wrapper to queue, not block');
    const keys = real[0].files.map(f => `${f.type}/${f.filename}`);
    assert.ok(keys.length > 0, 'the klein pair must have stageable weights');
    assert.equal(new Set(keys).size, keys.length, 'a weight shared by two models is queued once');
});

// MPI-1052 — the toast said "staging 18 models" with 3 on the volume: every cloud model
// sits in the installed set and has nothing to stage.
test('stage-on-connect counts only models with weights to stage', async () => {
    const { state, prefetchInstalledModels } = await load();
    const { Events } = await import('../js/events.js');
    const said = [];
    const off = Events.on('ui:info', ({ message }) => said.push(message));
    state.runpodConfig = { ...state.runpodConfig, stageOnConnect: true };
    stubFetch(
        { active: true, noGpu: false, gpuTypeId: RENTED },
        (b) => (b.dryRun ? { async: true, pending: b.files.length } : { async: true }),
    );
    await prefetchInstalledModels(['klein-4b', 'flux-schnell-cloud', 'seedream-4-cloud']);
    off();
    assert.equal(said.length, 1);
    assert.match(said[0], /staging 1 model to fast disk/, `REGRESSION: cloud models counted — ${said[0]}`);
});

test('stage-on-connect stays off a CPU Pod even when the picker says GPU', async () => {
    const { state, prefetchInstalledModels } = await load();
    state.runpodConfig = { ...state.runpodConfig, gpuType: PICKER, stageOnConnect: true };
    state.s_installedModelIds = ['klein-4b'];
    const posts = stubFetch({ active: true, noGpu: true, gpuTypeId: '__cpu__' }, () => ({ async: true, pending: 1 }));
    await prefetchInstalledModels();
    assert.equal(posts.length, 0, 'REGRESSION: staged onto a download-mode Pod (MPI-539, 2026-09-28 19:19Z)');
});

test('stage-on-connect stays lazy on a wrapper that cannot queue', async () => {
    const { state, prefetchInstalledModels } = await load();
    state.runpodConfig = { ...state.runpodConfig, stageOnConnect: true };
    state.s_installedModelIds = ['klein-4b'];
    const posts = stubFetch({ active: true, noGpu: false, gpuTypeId: RENTED }, () => ({ pending: 3 }));
    await prefetchInstalledModels();
    assert.equal(posts.filter(b => !b.dryRun).length, 0,
        'an old wrapper would hold one request open for the whole set');
});

test('a gen queues its files with priority and polls until they land', async () => {
    const { remoteEngineClient, _ensureRemoteHotStore } = await load();
    let polls = 0;
    const posts = stubFetch({}, (b) => {
        if (!b.dryRun) return { async: true };
        polls += 1;
        return { async: true, pending: polls === 1 ? b.files.length : 0 };
    });
    remoteEngineClient._active = true;
    remoteEngineClient._noGpu = false;
    remoteEngineClient._gpuType = RENTED;
    await _ensureRemoteHotStore('klein-4b', null);
    const real = posts.filter(b => !b.dryRun);
    assert.equal(real.length, 1);
    assert.equal(real[0].async, true);
    assert.equal(real[0].priority, true, 'a gen must jump a stage-on-connect prefetch');
    assert.equal(polls, 2, 'one dryRun up front, one poll that saw the files land');

    // A Stop ends the wait at once instead of sitting out the 3 min cap.
    polls = 0;
    stubFetch({}, (b) => (b.dryRun ? { async: true, pending: 1 } : { async: true }));
    const t0 = Date.now();
    await _ensureRemoteHotStore('klein-4b', null, AbortSignal.abort());
    assert.ok(Date.now() - t0 < 1500, 'an aborted gen must not keep polling');

    // A download-mode Pod is never staged onto (MPI-539), whatever the picker says.
    remoteEngineClient._noGpu = true;
    const none = stubFetch({}, () => ({ async: true, pending: 1 }));
    await _ensureRemoteHotStore('klein-4b', null);
    assert.equal(none.length, 0);
    remoteEngineClient._active = false;
    remoteEngineClient._noGpu = false;
    remoteEngineClient._gpuType = null;
});

// MPI-1057 — a Flow run carries `modelId: null` and names its models in `flowModelIds`.
// It staged nothing and loaded H3 (~44 GB) off the network volume while the connect
// prefetch copied the same files (Video Edit, 2026-10-10). A Flow stages its models' sets.
test('a Flow run stages the models it names, and skips the slots its leg does not run', async () => {
    const { remoteEngineClient, _ensureRemoteHotStore } = await load();
    const posts = stubFetch({}, (b) => (b.dryRun ? { async: true, pending: 0 } : { async: true }));
    remoteEngineClient._active = true;
    remoteEngineClient._noGpu = false;
    remoteEngineClient._gpuType = RENTED;

    await _ensureRemoteHotStore(null, 'flow_op', undefined, ['klein-4b', null]);
    assert.ok(posts.length > 0, 'REGRESSION: a Flow run staged nothing (modelId is null on every Flow)');
    const flowFiles = posts[0].files.map(f => `${f.type}/${f.filename}`).sort();

    const single = stubFetch({}, (b) => (b.dryRun ? { async: true, pending: 0 } : { async: true }));
    await _ensureRemoteHotStore('klein-4b', null);
    assert.deepEqual(flowFiles, single[0].files.map(f => `${f.type}/${f.filename}`).sort(),
        'a Flow stages the same set the model would');

    const none = stubFetch({}, () => ({ async: true, pending: 1 }));
    await _ensureRemoteHotStore(null, 'flow_op', undefined, [null]);
    assert.equal(none.length, 0, 'a leg that runs no model stages nothing');
    remoteEngineClient._active = false;
    remoteEngineClient._gpuType = null;
});

// MPI-1051 — with "Stage all models on connect" on, a model installed mid-session is
// staged when its install finishes, not at the next connect.
test('an install complete stages just that model, and only with the toggle on', async () => {
    const { state, prefetchInstalledModels } = await load();
    const pod = { active: true, noGpu: false, gpuTypeId: RENTED };
    const queue = (b) => (b.dryRun ? { async: true, pending: b.files.length } : { async: true });
    const staged = (posts) => posts.filter(b => !b.dryRun).flatMap(b => b.files.map(f => `${f.type}/${f.filename}`)).sort();

    state.runpodConfig = { ...state.runpodConfig, stageOnConnect: true };
    state.s_installedModelIds = ['klein-4b'];
    let posts = stubFetch(pod, queue);
    await prefetchInstalledModels();
    const alone = staged(posts);
    assert.ok(alone.length > 0);

    state.s_installedModelIds = ['klein-4b', 'klein-9b'];
    posts = stubFetch(pod, queue);
    await prefetchInstalledModels(['klein-4b']);
    assert.deepEqual(staged(posts), alone, 'the installed model only, not every model on the volume');

    state.runpodConfig = { ...state.runpodConfig, stageOnConnect: false };
    posts = stubFetch(pod, queue);
    await prefetchInstalledModels(['klein-4b']);
    assert.equal(posts.length, 0, 'toggle off = stage lazily on first gen');

    // SOURCE-READ: downloadService cannot import in bare node. The model-level complete
    // must hand its modelId over, after the re-sync and past the silent-job return (a
    // drift/engine-asset heal or an already-installed re-verify installed nothing new).
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'js/services/downloadService.js'), 'utf8');
    const handler = src.slice(src.indexOf("addEventListener('download:complete'"), src.indexOf("addEventListener('download:failed'"));
    const silentAt = handler.indexOf('if (silent) return;');
    const stageAt = handler.indexOf('prefetchInstalledModels([data.modelId])');
    assert.ok(silentAt > handler.indexOf('reSyncInstalledModels().then('), 'the silent return sits in the re-sync callback');
    assert.ok(stageAt > silentAt, 'REGRESSION: an install complete no longer stages its model');
});
