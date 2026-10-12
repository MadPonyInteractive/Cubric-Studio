'use strict';
/**
 * MPI-1113 — the internal `engine:assets` heal stuck in Cue > Transfers as
 * "Download 100%" after a Pod connect.
 *
 * Two holes, both closed here:
 *  1. A no-op install (every dep already on the volume) settles INSIDE the
 *     /download/start handler, so its SSE download:complete can reach the renderer
 *     before the POST body (MPI-395). `_firePost` then adopted the body with a forced
 *     'downloading', reviving the finished job at 100% forever.
 *  2. Silence lived in renderer memory only, so a reload mid-heal restored the job
 *     from the server snapshot with no mark. It is now a fact on the SERVER job.
 *
 * Runs the REAL _startRemoteDownload with every wrapper call stubbed, plus a fake
 * SSE client on the real stream route — no Pod, no network, no port.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1113-' + process.pid);
require('./helpers/sandbox-roots.cjs');
require('../routes/remotePodLifecycle').remoteVolumeFreeBytes = async () => null;

const remoteModels = require('../routes/remoteModels.js');
const dm = require('../routes/downloadManager.js');

// Every dep is already on the volume — the engine:assets shape ("fetching nothing").
remoteModels.remoteModelsCheck = async (models) => {
    const results = {};
    for (const m of models || []) {
        const deps = (m.deps || []).map(d => ({ id: d.id, installed: true }));
        results[m.id] = { deps, installed: true };
    }
    return { results };
};
remoteModels.remoteActiveInstallIds = async () => new Set();
remoteModels.remoteInstallDep = async () => { throw new Error('nothing should be fetched'); };
remoteModels.openInstallEventStream = () => ({ abort() {} });
remoteModels._isImageResident = () => false;

// A fake renderer on the real SSE route, collecting every broadcast.
const events = [];
const streamRoute = dm.router.stack.find(l => l.route && l.route.path === '/comfy/downloads/stream');
streamRoute.route.stack[0].handle(
    { on() {} },
    {
        setHeader() {}, flushHeaders() {},
        write(payload) {
            const m = /^event: (\S+)\ndata: (.*)\n/m.exec(payload);
            if (m) events.push({ event: m[1], data: JSON.parse(m[2]) });
        },
    });

test.after(() => {
    dm._remoteDepIds.clear();
    dm._teardownRemoteEventStreamIfIdle();
    dm._installStore.clear();
});

const makeRes = () => {
    const r = { code: 200, body: null, order: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; r.order = events.length; return r; };
    return r;
};
const deps = (p) => [{ id: `${p}-a`, type: 'checkpoints', filename: `${p}-a.safetensors`, size: '1 GB' }];

test('a silent no-op heal: the job, its snapshot and its completion all say silent', async () => {
    const res = makeRes();
    await dm._startRemoteDownload('engine:mpi1113-silent', deps('s'), res, true);

    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.job.silent, true, 'the POST body must carry silent (the client adopts it)');

    const complete = events.find(e => e.event === 'download:complete' && e.data.modelId === 'engine:mpi1113-silent');
    assert.ok(complete, 'a no-op install settles inside the handler');
    assert.strictEqual(complete.data.silent, true, 'the server stamps silent onto the completion');
    // The ordering hole 1 rides on: completion is broadcast after the body is written, but
    // on a separate connection, so the renderer can see either first (MPI-395).
    assert.ok(events.indexOf(complete) >= res.order, 'expected completion after res.json');

    // A reload re-reads the job from the snapshot: the flag must survive it.
    const snap = dm._installStore.snapshot().jobs.find(j => j.modelId === 'engine:mpi1113-silent');
    assert.strictEqual(snap.silent, true, 'the snapshot must carry silent across a renderer reload');
});

test('a user install is not silent', async () => {
    const res = makeRes();
    await dm._startRemoteDownload('mpi1113-loud', deps('l'), res);
    assert.strictEqual(res.body.job.silent, false);
    const complete = events.find(e => e.event === 'download:complete' && e.data.modelId === 'mpi1113-loud');
    assert.ok(complete);
    assert.strictEqual(complete.data.silent, undefined);
    const snap = dm._installStore.snapshot().jobs.find(j => j.modelId === 'mpi1113-loud');
    assert.strictEqual(snap.silent, false);
});

test('a live job unioned with a loud registration is announced', () => {
    const store = dm._installStore;
    const dep = { depId: 'mpi1113-u', type: 'checkpoints', seedBytes: 1 };
    const job = store.registerModelJob({ modelId: 'mpi1113-union', engine: 'local', deps: [dep], silent: true });
    assert.strictEqual(job.silent, true);
    store.registerModelJob({ modelId: 'mpi1113-union', engine: 'local', deps: [dep] });
    assert.strictEqual(job.silent, false);
});

test('the client never revives a job an SSE terminal already settled', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'services', 'downloadService.js'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const fire = src.slice(src.indexOf('async _firePost('));
    const adopt = fire.slice(0, fire.indexOf("status: 'downloading', indeterminate: false"));
    assert.match(adopt, /if \(cur && cur\.status === 'downloading'\)/,
        "_firePost must adopt the POST body only while the job is still 'downloading' — "
        + 'a download:complete that landed first must win (MPI-1113)');
    assert.doesNotMatch(src, /_silentJobs/, 'silence is a field on the job, not renderer memory (MPI-1113)');
    assert.match(src, /isSilentJob\(modelId\) \{\s*return state\.downloadJobs\.some\(j => j\.modelId === modelId && j\.silent === true\)/,
        'Transfers reads silence off the job');
});
