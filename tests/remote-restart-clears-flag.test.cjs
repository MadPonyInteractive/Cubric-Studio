'use strict';

// MPI-1057 — the connect-time universal-node install restarts the Pod's ComfyUI itself,
// and must SAY so. Fabio, 2026-10-11: the node installs had broadcast
// `comfy:needs-restart`, the backend then restarted ComfyUI at 07:34:04, and his first
// Cue at 07:38 still toasted "Loading new nodes - restarting the remote engine" and
// restarted it again. The renderer clears its flag on `comfy:restarted {remote:true}`
// (downloadService); this pins that the backend sends it after a successful restart and
// not after a failed one. Drives the REAL ensureUniversalNodesOnVolume against a stub
// wrapper on localhost.

require('./helpers/sandbox-roots.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const events = [];
const file = require.resolve('../routes/downloadManager');
require.cache[file] = { id: file, filename: file, loaded: true, exports: { broadcastEngineEvent: (event, data) => events.push({ event, data }) } };

const remoteEngine = require('../routes/remoteEngine');
let wrapperBase = '';
remoteEngine.proxyUrl = () => wrapperBase;
remoteEngine.getWrapperToken = async () => 'tok';
const { setRemoteMode } = require('../routes/remotePodState');
const remoteModels = require('../routes/remoteModels');

const wrapper = { installed: new Set(), restartStatus: 200, restarts: 0 };
const stubApp = express();
stubApp.use(express.json());
stubApp.post('/wrapper/models/status', (req, res) => {
    const results = {};
    for (const m of req.body.models) {
        results[m.id] = { deps: m.deps.map((d) => ({ id: d.id, installed: wrapper.installed.has(d.id) })) };
    }
    res.json({ results });
});
stubApp.post('/wrapper/models/install', (req, res) => { wrapper.installed.add(req.body.id); res.status(202).json({ status: 'started', id: req.body.id }); });
stubApp.get('/wrapper/queue', (_req, res) => res.json({ queue_running: [], queue_pending: [] }));
stubApp.post('/wrapper/restart-comfy', (_req, res) => { wrapper.restarts++; res.status(wrapper.restartStatus).json({}); });

const server = stubApp.listen(0);
test.before(async () => {
    await new Promise((r) => server.once('listening', r));
    wrapperBase = `http://127.0.0.1:${server.address().port}`;
    setRemoteMode({ active: true, podId: 'pod-r1' });
});
test.after(() => server.close());

const restartedEvents = () => events.filter((e) => e.event === 'comfy:restarted');

test('a restart after the universal install broadcasts comfy:restarted (remote)', async () => {
    assert.ok(remoteModels._universalVolumeNodeDeps().length > 0, 'no universal volume nodes to install');
    const out = await remoteModels.ensureUniversalNodesOnVolume();
    assert.ok(out.installed.length > 0);
    assert.equal(wrapper.restarts, 1);
    assert.deepEqual(restartedEvents().map((e) => e.data), [{ remote: true }]);
});

test('a failed restart says nothing, so the next generation still restarts', async () => {
    wrapper.installed.clear();
    wrapper.restartStatus = 500;
    events.length = 0;
    await remoteModels.ensureUniversalNodesOnVolume();
    assert.equal(restartedEvents().length, 0);
});
