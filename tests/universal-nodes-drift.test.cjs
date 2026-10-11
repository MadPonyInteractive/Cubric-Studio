'use strict';

// MPI-1071 — a bumped volume node must actually reach the Pod. Fabio, 2026-10-11: MpiNodes
// pinned at 945484f, his Pod still ran the old commit. The connect-time ensure saw the
// drifted folder as not installed and asked the wrapper to install it WITHOUT `force`, so
// the wrapper answered `already_installed` (the folder exists) and never re-cloned:
// "universal nodes still absent after 60s: ComfyUI-MpiNodes". Drives the REAL
// ensureUniversalNodesOnVolume against a stub wrapper on localhost.

require('./helpers/sandbox-roots.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const file = require.resolve('../routes/downloadManager');
require.cache[file] = { id: file, filename: file, loaded: true, exports: { broadcastEngineEvent: () => {} } };

const remoteEngine = require('../routes/remoteEngine');
let wrapperBase = '';
remoteEngine.proxyUrl = () => wrapperBase;
remoteEngine.getWrapperToken = async () => 'tok';
const { setRemoteMode } = require('../routes/remotePodState');
const { getPinnedNodeCommit } = require('../routes/shared');
const remoteModels = require('../routes/remoteModels');

const ID = 'ComfyUI-MpiNodes';
const deps = remoteModels._universalVolumeNodeDeps();
const pinned = getPinnedNodeCommit(ID);

// Every universal folder is on the volume; MpiNodes is at an OLD commit.
const commits = Object.fromEntries(deps.map((d) => [d.filename, getPinnedNodeCommit(d.id) || 'x']));
commits[deps.find((d) => d.id === ID).filename] = 'old0000';
const installs = [];

const stub = express();
stub.use(express.json());
stub.get('/wrapper/manifest', (_req, res) => res.json({
    nodes: Object.entries(commits).map(([filename, commit]) => ({ filename, commit })),
}));
stub.post('/wrapper/models/status', (req, res) => {
    const results = {};
    for (const m of req.body.models) results[m.id] = { deps: m.deps.map((d) => ({ id: d.id, installed: true })) };
    res.json({ results });
});
// The real wrapper short-circuits on folder-exists unless `force` is set.
stub.post('/wrapper/models/install', (req, res) => {
    installs.push(req.body);
    if (!req.body.force) return res.json({ status: 'already_installed', id: req.body.id });
    const dep = deps.find((d) => d.id === req.body.id);
    commits[dep.filename] = req.body.commit;
    res.status(202).json({ status: 'started', id: req.body.id });
});
stub.get('/wrapper/queue', (_req, res) => res.json({ queue_running: [], queue_pending: [] }));
stub.post('/wrapper/restart-comfy', (_req, res) => res.json({}));

const server = stub.listen(0);
test.before(async () => {
    await new Promise((r) => server.once('listening', r));
    wrapperBase = `http://127.0.0.1:${server.address().port}`;
    setRemoteMode({ active: true, podId: 'pod-drift' });
});
test.after(() => server.close());

test('a drifted volume node is re-cloned at the pinned commit (force), not skipped', async () => {
    assert.ok(pinned, 'MpiNodes must be pinned by commit in node_lock.json');
    const out = await remoteModels.ensureUniversalNodesOnVolume();
    assert.deepEqual(installs.map((b) => [b.id, b.force, b.commit]), [[ID, true, pinned]]);
    assert.deepEqual(out.installed, [ID]);
    assert.deepEqual(out.failed, []);
});
