'use strict';

// MPI-806 — RunPod REST v1 → v2 migration.
//
// Asserts that every client function in routes/runpodRemote.js sends the
// correct v2 method, path and body. Assertions are derived from the v2
// OpenAPI spec (https://api.runpod.io/v2/openapi.json), not from reading
// back our own code. No live RunPod calls are made.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi806-'));

const { client, setApiKeyResolver } = require('../routes/runpodRemote');
setApiKeyResolver(async () => 'rpa_test_key');

const BASE = 'https://api.runpod.io/v2';

/** Stub globalThis.fetch for one call, return { url, method, body, headers }. */
async function captureRequest(fn) {
  const real = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, opts = {}) => {
    captured = {
      url: String(url),
      method: (opts.method || 'GET').toUpperCase(),
      body: opts.body ? JSON.parse(opts.body) : undefined,
      headers: opts.headers || {},
    };
    return new Response(JSON.stringify({}), { status: 200 });
  };
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
  return captured;
}

// ── Base URL ──────────────────────────────────────────────────────────────────

test('base URL is api.runpod.io/v2 (not rest.runpod.io/v1)', async () => {
  const req = await captureRequest(() => client.listPods('key'));
  assert.ok(req.url.startsWith(BASE), `expected ${BASE}, got ${req.url}`);
  assert.ok(!req.url.includes('rest.runpod.io'), `v1 host must not appear: ${req.url}`);
});

// ── Pod CRUD ──────────────────────────────────────────────────────────────────

test('createPod: POST /pods with v2 nested body', async () => {
  const spec = {
    name: 'test-pod',
    imageName: 'runpod/pytorch:latest',
    containerDiskInGb: 20,
    gpuTypeIds: ['NVIDIA RTX A4000'],
    gpuCount: 1,
    networkVolumeId: 'vol-abc',
    volumeMountPath: '/workspace',
  };
  const req = await captureRequest(() => client.createPod('key', spec));
  assert.equal(req.url, `${BASE}/pods`);
  assert.equal(req.method, 'POST');
  // v2 body is nested: gpu sub-object
  assert.ok(req.body.gpu, 'body.gpu must exist');
  assert.equal(req.body.gpu.id, 'NVIDIA RTX A4000');
  assert.equal(req.body.gpu.count, 1);
  // mounts.network array
  assert.ok(Array.isArray(req.body.mounts?.network), 'body.mounts.network must be an array');
  assert.equal(req.body.mounts.network[0].volumeId, 'vol-abc');
  assert.equal(req.body.mounts.network[0].path, '/workspace');
  // flat top-level name/image/disk
  assert.equal(req.body.name, 'test-pod');
  assert.equal(req.body.image, 'runpod/pytorch:latest');
  assert.equal(req.body.disk, 20);
  // v1 field names must NOT appear at top level
  assert.equal(req.body.imageName, undefined, 'imageName must be absent (v2 uses image)');
  assert.equal(req.body.networkVolumeId, undefined, 'networkVolumeId must be absent (v2 uses mounts)');
  assert.equal(req.body.containerDiskInGb, undefined, 'containerDiskInGb must be absent (v2 uses disk)');
  assert.equal(req.body.gpuTypeIds, undefined, 'gpuTypeIds must be absent (v2 uses gpu.id)');
});

// The two shapes _createPodInternal really sends besides the plain GPU one: a CPU
// download-mode Pod, and a GPU Pod carrying the MPI-188 CUDA driver floor. Per the
// v2 CreatePodRequest: exactly one of `gpu` / `cpu`, `cpu` requires id + vcpuCount,
// `allowedCudaVersions` lives under `gpu`.
test('createPod: CPU download-mode Pod sends cpu {id, vcpuCount} and no gpu', async () => {
  const spec = {
    name: 'cubric-vision', imageName: 'img:cpu', containerDiskInGb: 20,
    computeType: 'CPU', cpuFlavorIds: ['cpu3c'], vcpuCount: 4,
    networkVolumeId: 'vol-abc', volumeMountPath: '/workspace',
  };
  const req = await captureRequest(() => client.createPod('key', spec));
  assert.deepEqual(req.body.cpu, { id: 'cpu3c', vcpuCount: 4 });
  assert.equal(req.body.gpu, undefined, 'a CPU Pod must not carry gpu');
  assert.equal(req.body.computeType, undefined);
  assert.equal(req.body.cpuFlavorIds, undefined);
});

test('createPod: CUDA driver floor goes under gpu.allowedCudaVersions', async () => {
  const spec = {
    name: 'cubric-vision', imageName: 'img', containerDiskInGb: 40,
    gpuTypeIds: ['NVIDIA GeForce RTX 5090'], gpuCount: 1, allowedCudaVersions: ['13.0'],
    ports: ['8889/http'], env: { CUBRIC_TOKEN: 't' }, dataCenterIds: ['EU-RO-1'],
  };
  const req = await captureRequest(() => client.createPod('key', spec));
  assert.deepEqual(req.body.gpu, { id: 'NVIDIA GeForce RTX 5090', count: 1, allowedCudaVersions: ['13.0'] });
  assert.equal(req.body.allowedCudaVersions, undefined);
  assert.deepEqual(req.body.ports, ['8889/http']);
  assert.deepEqual(req.body.env, { CUBRIC_TOKEN: 't' });
  assert.deepEqual(req.body.dataCenterIds, ['EU-RO-1']);
});

test('createPod: system-RAM floor goes under gpu.minRamPerGpu', async () => {
  const spec = { gpuTypeIds: ['NVIDIA GeForce RTX 5090'], gpuCount: 1, minMemoryInGb: 80 };
  const req = await captureRequest(() => client.createPod('key', spec));
  assert.equal(req.body.gpu.minRamPerGpu, 80);
  assert.equal(req.body.minMemoryInGb, undefined);
});

test('startPod: POST /pods/{id}/action with action:start', async () => {
  const req = await captureRequest(() => client.startPod('key', 'pod-xyz'));
  assert.equal(req.url, `${BASE}/pods/pod-xyz/action`);
  assert.equal(req.method, 'POST');
  assert.deepEqual(req.body, { action: 'start' });
});

test('stopPod: POST /pods/{id}/action with action:stop', async () => {
  const req = await captureRequest(() => client.stopPod('key', 'pod-xyz'));
  assert.equal(req.url, `${BASE}/pods/pod-xyz/action`);
  assert.equal(req.method, 'POST');
  assert.deepEqual(req.body, { action: 'stop' });
});

test('deletePod: DELETE /pods/{id}', async () => {
  const req = await captureRequest(() => client.deletePod('key', 'pod-xyz'));
  assert.equal(req.url, `${BASE}/pods/pod-xyz`);
  assert.equal(req.method, 'DELETE');
});

test('getPod: GET /pods/{id}', async () => {
  const req = await captureRequest(() => client.getPod('key', 'pod-xyz'));
  assert.equal(req.url, `${BASE}/pods/pod-xyz`);
  assert.equal(req.method, 'GET');
});

test('listPods: GET /pods', async () => {
  const req = await captureRequest(() => client.listPods('key'));
  assert.equal(req.url, `${BASE}/pods`);
  assert.equal(req.method, 'GET');
});

// ── Network volumes — path MUST use hyphen (/network-volumes) ─────────────────

test('listVolumes: GET /network-volumes (hyphen, not /networkvolumes)', async () => {
  const req = await captureRequest(() => client.listVolumes('key'));
  assert.equal(req.url, `${BASE}/network-volumes`);
  assert.equal(req.method, 'GET');
  assert.ok(!req.url.includes('networkvolumes'), 'v1 path /networkvolumes must not appear');
});

test('createVolume: POST /network-volumes; dataCenterId translated to dataCenter', async () => {
  const spec = { name: 'vol', size: 50, dataCenterId: 'US-TX-3' };
  const req = await captureRequest(() => client.createVolume('key', spec));
  assert.equal(req.url, `${BASE}/network-volumes`);
  assert.equal(req.method, 'POST');
  // v2 uses dataCenter, not dataCenterId
  assert.equal(req.body.dataCenter, 'US-TX-3');
  assert.equal(req.body.dataCenterId, undefined, 'dataCenterId must be removed (v2 uses dataCenter)');
});

test('deleteVolume: DELETE /network-volumes/{id}', async () => {
  const req = await captureRequest(() => client.deleteVolume('key', 'vol-1'));
  assert.equal(req.url, `${BASE}/network-volumes/vol-1`);
  assert.equal(req.method, 'DELETE');
});

test('updateVolume: PATCH /network-volumes/{id} with size', async () => {
  const req = await captureRequest(() => client.updateVolume('key', 'vol-1', 80));
  assert.equal(req.url, `${BASE}/network-volumes/vol-1`);
  assert.equal(req.method, 'PATCH');
  assert.deepEqual(req.body, { size: 80 });
});

// ── API key is never leaked ────────────────────────────────────────────────────

test('API key appears only in Authorization header, never in URL or body', async () => {
  const req = await captureRequest(() => client.listPods('MY_SECRET_KEY'));
  assert.ok(!req.url.includes('MY_SECRET_KEY'), 'key must not appear in URL');
  const bodyStr = JSON.stringify(req.body || {});
  assert.ok(!bodyStr.includes('MY_SECRET_KEY'), 'key must not appear in body');
  // Header object uses the literal key name from _rest(); check both cases.
  const authHeader = req.headers.Authorization || req.headers.authorization || '';
  assert.ok(String(authHeader).includes('MY_SECRET_KEY'), 'key must be in Authorization header');
});
