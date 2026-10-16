'use strict';

// MPI-1157 — POST /comfy/models/uninstall answers at once and finishes in the background.
// It used to answer only after every wrapper delete plus the orphan sweep: 191 s for
// Krea 2 on a busy Pod (2026-10-16), holding one of Chromium's six sockets to the app
// server the whole time. The result now rides the broadcasts the renderer listens to:
// `download:uninstalled` on success, `download:uninstall-failed` when nothing could be
// uninstalled. Drives the REAL route over a stubbed wrapper, with a fake stream client.

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1157-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const remoteModels = require('../routes/remoteModels.js');
const dm = require('../routes/downloadManager.js');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { resolveFullUniverse } = require('../js/data/modelConstants/resolveModelDeps.js');
const { DEPS } = require('../js/data/modelConstants/dependencies.js');
const { getUniversalWorkflowDepIds } = require('../routes/shared.js');

const MODEL = MODELS.find(m => m.id === 'boogu-edit-balanced');
const UNIVERSAL = new Set(getUniversalWorkflowDepIds());
const DELETABLE = resolveFullUniverse(MODEL, null, 'remote').filter(id => !UNIVERSAL.has(id));

let remote = true;
let checkThrows = false;
let releaseDelete = null;   // set while the first wrapper delete is held open
remoteModels.isRemoteActive = () => remote;
remoteModels.remoteModelsCheck = async (models) => {
    if (checkThrows) throw new Error('proxy 502');
    const results = {};
    for (const m of models || []) {
        const deps = (m.deps || []).map(d => ({ ...d, installed: false }));
        results[m.id] = { deps, installed: false };
    }
    return { results };
};
remoteModels.remoteUninstallDep = async (dep) => {
    if (releaseDelete === undefined) await new Promise(r => { releaseDelete = r; });
    return { status: 'deleted', id: dep.id };
};

// The shared stream's view of this channel: every broadcast written to one fake client.
function listen(t) {
    const events = [];
    const detach = dm.attachEvents({
        write(payload) {
            const name = /^event: (.+)$/m.exec(payload)?.[1];
            const data = /^data: (.+)$/m.exec(payload)?.[1];
            if (name) events.push({ name, data: data ? JSON.parse(data) : null });
        },
    });
    t.after(detach);
    return events;
}

async function serve(t) {
    const app = express();
    app.use(express.json());
    app.use(dm.router);
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    t.after(() => server.close());
    return `http://127.0.0.1:${server.address().port}/comfy/models/uninstall`;
}

const post = (url, body) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

const body = { modelId: MODEL.id, dependencies: DELETABLE.map(id => DEPS[id]), deleteFiles: true };

test('the route answers while the wrapper delete is still running, then broadcasts the result', async (t) => {
    const url = await serve(t);
    const events = listen(t);
    remote = true;
    checkThrows = false;
    releaseDelete = undefined;   // hold the first delete open

    const res = await post(url, body);
    assert.equal(res.status, 202, 'answers before the uninstall finishes');
    assert.deepEqual(await res.json(), { success: true, started: true, modelId: MODEL.id });
    assert.equal(typeof releaseDelete, 'function', 'the delete is still in flight when the answer lands');
    assert.ok(!events.some(e => e.name === 'download:uninstalled'), 'no result before the work is done');

    releaseDelete();
    const out = await dm._uninstallRuns.get(MODEL.id);
    assert.equal(out.success, true);
    const done = events.find(e => e.name === 'download:uninstalled');
    assert.ok(done, 'the result rides download:uninstalled');
    assert.equal(done.data.modelId, MODEL.id);
    assert.deepEqual(done.data.removed.map(r => r.depId).sort(), [...DELETABLE].sort());
});

test('an uninstall that cannot run broadcasts download:uninstall-failed, never download:uninstalled', async (t) => {
    const url = await serve(t);
    const events = listen(t);
    remote = true;
    checkThrows = true;   // the Pod is still warming up
    releaseDelete = null;

    const res = await post(url, body);
    assert.equal(res.status, 202);
    await dm._uninstallRuns.get(MODEL.id);
    checkThrows = false;

    const failed = events.find(e => e.name === 'download:uninstall-failed');
    assert.ok(failed, 'the failure is broadcast so the renderer can end its row and toast');
    assert.equal(failed.data.modelId, MODEL.id);
    assert.equal(failed.data.reason, 'wrapper-unreachable');
    assert.match(failed.data.message, /starting up/);
    assert.ok(!events.some(e => e.name === 'download:uninstalled'), 'nothing was uninstalled');
});

test('the LOCAL twin answers at once and broadcasts its result the same way', async (t) => {
    const url = await serve(t);
    const events = listen(t);
    remote = false;   // sandboxed models root: every dep is already absent

    const res = await post(url, body);
    assert.equal(res.status, 202);
    const out = await dm._uninstallRuns.get(MODEL.id);
    remote = true;

    assert.equal(out.success, true);
    const done = events.find(e => e.name === 'download:uninstalled');
    assert.ok(done, 'local result rides the same broadcast');
    assert.equal(done.data.removed.length, 0);
    assert.ok(done.data.keptModelFiles.length > 0
        && done.data.keptModelFiles.every(k => k.reason === 'already-absent'));
});

test('a malformed request is still refused synchronously', async (t) => {
    const url = await serve(t);
    const res = await post(url, { modelId: MODEL.id });
    assert.equal(res.status, 400);
});
