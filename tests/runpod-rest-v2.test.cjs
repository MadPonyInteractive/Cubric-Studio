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

// A FLOOR, never allowedCudaVersions: v2 matches that list exactly, so ['13.0'] refused
// every 13.1+ host with the stock text (MPI-595 B1, 2026-09-28).
test('createPod: CUDA driver floor goes under gpu.minCudaVersion, never the exact list', async () => {
  const spec = {
    name: 'cubric-vision', imageName: 'img', containerDiskInGb: 40,
    gpuTypeIds: ['NVIDIA GeForce RTX 5090'], gpuCount: 1, minCudaVersion: '13.0',
    ports: ['8889/http'], env: { CUBRIC_TOKEN: 't' }, dataCenterIds: ['EU-RO-1'],
  };
  const req = await captureRequest(() => client.createPod('key', spec));
  assert.deepEqual(req.body.gpu, { id: 'NVIDIA GeForce RTX 5090', count: 1, minCudaVersion: '13.0' });
  assert.equal(req.body.gpu.allowedCudaVersions, undefined);
  assert.equal(req.body.minCudaVersion, undefined);
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

// ── GPU catalogue (MPI-894: off GraphQL) ───────────────────────────────────────
//
// Payloads follow the openapi's GpuType / DataCenter schemas. The renderer reads the old
// GraphQL shape, so the translation is what these pin down.

const V2_GPUS = [
  { id: 'NVIDIA GeForce RTX 5090', name: 'RTX 5090', memory: 32, secure: true, community: true,
    price: { secure: 0.89, community: 0.69 }, availability: 'LOW',
    dataCenters: [{ id: 'EU-RO-1', name: 'EU Romania 1', availability: 'HIGH' },
      { id: 'US-TX-3', name: 'US Texas 3', availability: 'LOW' }] },
  // Offered in EU-RO-1 (the DC call lists it) but absent from the CUDA-scoped call there.
  { id: 'NVIDIA L4', name: 'L4', memory: 24, secure: true, community: false,
    price: { secure: 0.43, community: 0 }, availability: 'NONE' },
];
const V2_DCS = [
  { id: 'EU-RO-1', name: 'EU Romania 1', networkVolumeTypes: ['STANDARD'],
    gpuAvailability: [{ id: 'NVIDIA GeForce RTX 5090', name: 'RTX 5090', availability: 'HIGH' },
      { id: 'NVIDIA L4', name: 'L4', availability: 'HIGH' }] },
  { id: 'US-TX-3', name: 'US Texas 3', networkVolumeTypes: [] },
];

/** Stub fetch by path; record every URL. */
async function withCatalog(fn, status = 200) {
  const real = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const body = String(url).includes('/catalog/gpus') ? { gpus: V2_GPUS } : { dataCenters: V2_DCS };
    return new Response(JSON.stringify(body), { status });
  };
  try {
    return { result: await fn(), urls };
  } finally {
    globalThis.fetch = real;
  }
}

test('gpuTypes: GET /catalog/gpus scoped like a create, translated to the picker shape', async () => {
  const { result, urls } = await withCatalog(() => client.gpuTypes('key'));
  const u = new URL(urls[0]);
  assert.equal(u.origin + u.pathname, `${BASE}/catalog/gpus`);
  assert.equal(u.searchParams.get('include'), 'AVAILABILITY');
  assert.equal(u.searchParams.get('product'), 'POD');
  assert.equal(u.searchParams.get('cloud'), 'SECURE');
  assert.equal(u.searchParams.get('minCudaVersion'), '13.0', 'stock must be scoped by the create\'s CUDA floor');
  assert.deepEqual(result[0], {
    id: 'NVIDIA GeForce RTX 5090', displayName: 'RTX 5090', memoryInGb: 32,
    secureCloud: true, communityCloud: true, securePrice: 0.89,
  });
});

test('availability: per-DC stock comes from the scoped gpus call, not the DC catalogue', async () => {
  const { result, urls } = await withCatalog(() => client.availability('key'));
  assert.equal(urls.length, 2);
  assert.ok(urls.every(x => x.startsWith(BASE)), 'no call leaves REST v2');
  const eu = result.dataCenters.find(d => d.id === 'EU-RO-1');
  const tx = result.dataCenters.find(d => d.id === 'US-TX-3');
  assert.equal(eu.storageSupport, true);
  assert.equal(tx.storageSupport, false, 'no network volume types = no storage');
  assert.deepEqual(eu.gpuAvailability.find(g => g.gpuTypeId === 'NVIDIA GeForce RTX 5090'),
    { gpuTypeId: 'NVIDIA GeForce RTX 5090', available: true, stockStatus: 'High' });
  assert.deepEqual(eu.gpuAvailability.find(g => g.gpuTypeId === 'NVIDIA L4'),
    { gpuTypeId: 'NVIDIA L4', available: false, stockStatus: null },
    'REGRESSION: a card the DC offers but no >=13.0 host has read as in stock');
  assert.deepEqual(tx.gpuAvailability,
    [{ gpuTypeId: 'NVIDIA GeForce RTX 5090', available: true, stockStatus: 'Low' }]);
  assert.equal(result.gpuTypes.length, 2);
});

test('a refused catalogue read throws, so the route answers 502 instead of an empty picker', async () => {
  await assert.rejects(withCatalog(() => client.availability('key'), 401), /http 401/);
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
