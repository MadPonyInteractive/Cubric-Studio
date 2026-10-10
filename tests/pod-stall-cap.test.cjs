'use strict';

// MPI-1057 — a Pod RunPod never starts must not bill open-ended.
//
// Live 2026-10-10: two RTX PRO 6000 Pods in EU-RO-1 sat 4-8 min with an EMPTY RunPod system
// log (the host never started the container) while the app billed and the 5-min watchdog
// only hinted. Fabio's call: at 8 minutes the app deletes the Pod and says why.
//
// Pinned against the REAL routes (the RunPod client, key lookup and network pre-flight
// stubbed; the clock mocked):
//   1. A boot still not ready at 8 min is deleted, and /remote/comfy/status reports
//      `stalled` with that podId — and not one millisecond earlier.
//   2. Anything that ends the boot first (here Cancel's delete-active) disarms the cap.
//   3. The next boot clears the old `stalled` report.
//   4. getPod's timeout really aborts the request: RunPod's API hung on that Pod, and the
//      status route that calls it is polled.

const test = require('node:test');
const assert = require('node:assert/strict');

// Stub the helpers the lifecycle module destructures at require time — BEFORE requiring it.
const remoteEngine = require('../routes/remoteEngine');
remoteEngine.getRunPodApiKey = async () => 'key';
remoteEngine.setWrapperToken = async () => {};
remoteEngine.clearWrapperToken = async () => {};
require('../routes/netCheck').checkOnline = async () => true;

const { client } = require('../routes/runpodRemote');
const realGetPod = client.getPod;
const { router, STALL_CAP_MS } = require('../routes/remotePodLifecycle');

let nextPodId = 0;
const deleted = [];
client.listPods = async () => ({ ok: true, status: 200, json: [] });
client.listVolumes = async () => ({ ok: true, status: 200, json: [] });
client.createPod = async () => ({ ok: true, status: 201, json: { id: `pod${++nextPodId}` } });
client.deletePod = async (_key, id) => { deleted.push(id); return { ok: true, status: 204, json: {} }; };
client.getPod = async () => ({ ok: true, status: 200, json: { desiredStatus: 'RUNNING' } });
// The Pod's wrapper never answers: its container never started.
globalThis.fetch = async () => { throw new Error('connect ECONNREFUSED'); };

function call(path, method, body = {}) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
    };
    layer.route.stack[0].handle({ body }, res);
  });
}

const CREATE = { gpuTypeId: 'NVIDIA RTX PRO 6000 Blackwell Server Edition', volumeId: 'vol1', datacenter: 'EU-RO-1' };

// Let the stall-cap's async delete run to the end after the mocked clock fires it.
const settle = () => new Promise((r) => setImmediate(r));

test('the stall cap is 8 minutes', () => {
  assert.equal(STALL_CAP_MS, 8 * 60 * 1000);
});

test('a boot still not ready at 8 min is deleted and reported as stalled', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  deleted.length = 0;
  const created = await call('/remote/pod/create', 'post', CREATE);
  const podId = created.body.podId;
  assert.equal(created.body.starting, true);

  t.mock.timers.tick(STALL_CAP_MS - 1);
  await settle();
  assert.deepEqual(deleted, [], 'deleted before the cap');
  assert.equal((await call('/remote/comfy/status', 'get')).body.connecting, true);

  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(deleted, [podId], 'REGRESSION: a Pod that never started kept billing past 8 min');
  const status = (await call('/remote/comfy/status', 'get')).body;
  assert.equal(status.connecting, false);
  assert.equal(status.stalled && status.stalled.podId, podId, 'the renderer must be told why the connect ended');
});

test('a boot that ends first disarms the cap, and the next boot clears the old report', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  deleted.length = 0;
  const { body } = await call('/remote/pod/create', 'post', CREATE);
  assert.ok(!(await call('/remote/comfy/status', 'get')).body.stalled, 'a new boot clears the last stall');

  await call('/remote/pod/delete-active', 'post'); // Cancel
  assert.deepEqual(deleted, [body.podId]);
  t.mock.timers.tick(STALL_CAP_MS);
  await settle();
  assert.deepEqual(deleted, [body.podId], 'the cap fired on a boot that had already ended');
  assert.equal((await call('/remote/comfy/status', 'get')).body.stalled, null, 'the old stall report survived a new boot');
});

test('getPod with a timeout aborts a request RunPod never answers', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (_url, opts) => new Promise((_resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(opts.signal.reason));
  });
  try {
    const t0 = Date.now();
    await assert.rejects(realGetPod.call(client, 'key', 'pod', { timeoutMs: 50 }));
    assert.ok(Date.now() - t0 < 2000, 'the timeout did not bound the call');
  } finally {
    globalThis.fetch = saved;
  }
});
