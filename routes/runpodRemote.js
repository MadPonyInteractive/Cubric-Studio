/**
 * routes/runpodRemote.js — RunPod REST + GraphQL client and HTTP routes.
 *
 * Backend client for the RunPod remote engine (MPI-64). Talks to:
 *   - REST  https://api.runpod.io/v2      — Pod / network-volume / template CRUD (MPI-806: migrated from rest.runpod.io/v1 which retires 2026-11-15)
 *   - GraphQL https://api.runpod.io/graphql — GPU catalog + data-center availability
 *
 * The user's API key is NEVER stored here and NEVER logged. It is fetched on demand
 * from the main process via the fork bridge (see getRunPodApiKey in remoteEngine.js),
 * held only for the duration of a single call. The wrapper token is likewise secret.
 *
 * Routes exposed (all renderer -> Express; Express attaches the key server-side):
 *   GET  /runpod/account/validate     — does the stored key authenticate?
 *   GET  /runpod/gpu-availability      — datacenters + gpuTypes + stockStatus (picker)
 *   POST /runpod/pods                  — create a Pod
 *   POST /runpod/pods/:id/start        — start/resume
 *   POST /runpod/pods/:id/stop         — stop
 *   DELETE /runpod/pods/:id            — delete
 *   GET  /runpod/pods/:id              — status
 *   GET  /runpod/volumes               — list network volumes
 *   POST /runpod/volumes               — create network volume
 *   DELETE /runpod/volumes/:id         — delete network volume
 *   PATCH /runpod/volumes/:id          — grow network volume ({ size } only)
 *   POST /runpod/templates             — create template
 */

'use strict';

const express = require('express');
const router = express.Router();
const logger = require('./logger');

const REST = 'https://api.runpod.io/v2';
const GQL = 'https://api.runpod.io/graphql';

// Cloudflare fronts the RunPod proxy AND the API; default fetch UA can be blocked
// (HTTP 403 error 1010). Send a browser UA on all calls. (Verified MPI-64.)
const { UA } = require('./remoteHeaders');

// --- low-level client (key passed in, never stored/logged) ------------------

async function _rest(apiKey, method, path, body) {
  const res = await _safeFetch(`${REST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

// Redact any RunPod API key that might appear in an error/URL before it can be
// logged or surfaced. The key prefix is `rpa_`; also scrub `api_key=` query values.
function redactSecret(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/api_key=[^&\s"']+/gi, 'api_key=[REDACTED]')
    .replace(/rpa_[A-Za-z0-9_-]{8,}/g, 'rpa_[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9_.-]{8,}/g, 'Bearer [REDACTED]');
}

function sanitizePodJson(pod) {
  if (!pod || typeof pod !== 'object') return pod;
  const out = { ...pod };
  if (out.env && typeof out.env === 'object') {
    out.env = Object.fromEntries(
      Object.entries(out.env).map(([key, value]) => [key, redactSecret(String(value))])
    );
  }
  return out;
}

// Wrap a fetch so a thrown error never carries the key (GraphQL passes it in the
// URL query, which would otherwise land in err.message -> app.log -> bug report).
async function _safeFetch(url, opts) {
  try {
    return await fetch(url, opts);
  } catch (err) {
    const e = new Error(redactSecret(err && err.message ? err.message : String(err)));
    e.code = err && err.code;
    throw e;
  }
}

async function _graphql(apiKey, query, variables) {
  // Key via Authorization header (NOT the URL) so it cannot leak through a URL in
  // an error or log. RunPod GraphQL accepts the bearer header.
  const res = await _safeFetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const json = await res.json();
  return json;
}

// --- v1 → v2 spec translation ------------------------------------------------
//
// MPI-806: v2 pod-create body is nested (gpu/cpu/mounts objects) while the app
// builds the spec in the flat v1 shape internally (shared with the GraphQL create
// path). Translate at the REST boundary so every call site is unaffected.
//
// v1 → v2 field renames:
//   imageName            → image
//   containerDiskInGb    → disk
//   gpuTypeIds:[id]      → gpu.id
//   gpuCount             → gpu.count
//   allowedCudaVersions  → gpu.allowedCudaVersions
//   minMemoryInGb        → gpu.minRamPerGpu
//   computeType:'CPU' +
//   cpuFlavorIds:[id]    → cpu.id
//   vcpuCount            → cpu.vcpuCount
//   networkVolumeId +
//   volumeMountPath      → mounts.network[{volumeId, path}]
//   dataCenterIds        → dataCenterIds (unchanged)
function _toV2PodSpec(spec) {
  const body = {};
  if (spec.name !== undefined) body.name = spec.name;
  if (spec.imageName !== undefined) body.image = spec.imageName;
  if (spec.containerDiskInGb !== undefined) body.disk = spec.containerDiskInGb;
  if (spec.ports !== undefined) body.ports = spec.ports;
  if (spec.env !== undefined) body.env = spec.env;
  if (spec.dataCenterIds !== undefined) body.dataCenterIds = spec.dataCenterIds;

  if (Array.isArray(spec.gpuTypeIds) && spec.gpuTypeIds.length) {
    body.gpu = { id: spec.gpuTypeIds[0] };
    if (spec.gpuCount !== undefined) body.gpu.count = spec.gpuCount;
    if (Array.isArray(spec.allowedCudaVersions) && spec.allowedCudaVersions.length) {
      body.gpu.allowedCudaVersions = spec.allowedCudaVersions;
    }
    if (typeof spec.minMemoryInGb === 'number') body.gpu.minRamPerGpu = spec.minMemoryInGb;
  }

  if (spec.computeType === 'CPU' && Array.isArray(spec.cpuFlavorIds) && spec.cpuFlavorIds.length) {
    body.cpu = { id: spec.cpuFlavorIds[0], vcpuCount: spec.vcpuCount };
  }

  if (spec.networkVolumeId) {
    body.mounts = {
      network: [{ volumeId: spec.networkVolumeId, path: spec.volumeMountPath || '/workspace' }],
    };
  }

  return body;
}

// --- client functions (exported for remoteEngine.js + tests) ----------------

const client = {
  // v2 GET /v2/pods — probes the authenticated key; list wraps as {"pods":[...]}
  async validate(apiKey) {
    const r = await _rest(apiKey, 'GET', '/pods');
    return { valid: r.ok, status: r.status };
  },

  async gpuTypes(apiKey, dataCenterId) {
    // `memoryInGb` is GPU VRAM. System/container RAM is NOT a GpuType field —
    // it rides on the cheapest offering via `lowestPrice.minMemory` (GB). We
    // flatten it to top-level `minMemory`/`minVcpu` so the picker reads it like
    // `securePrice`.
    //
    // Without a `dataCenterId`, `lowestPrice` returns the GLOBAL floor across all
    // clouds/DCs — which badly under-reports RAM (e.g. A4500 reads 29GB when the
    // EU-RO-1 Secure-Cloud listing has 62GB). When a DC is selected we scope the
    // input to that DC + `secureCloud:true`, so the RAM matches what the user
    // actually rents. The no-DC global call is the back-compat fallback.
    const priceInput = dataCenterId
      ? `input:{gpuCount:1, dataCenterId:${JSON.stringify(dataCenterId)}, secureCloud:true}`
      : `input:{gpuCount:1}`;
    const q = `query { gpuTypes { id displayName memoryInGb secureCloud communityCloud securePrice
      lowestPrice(${priceInput}) { minMemory minVcpu } } }`;
    const d = await _graphql(apiKey, q);
    const gpus = (d.data && d.data.gpuTypes) || [];
    return gpus.map((g) => ({
      ...g,
      minMemory: (g.lowestPrice && typeof g.lowestPrice.minMemory === 'number') ? g.lowestPrice.minMemory : null,
      minVcpu: (g.lowestPrice && typeof g.lowestPrice.minVcpu === 'number') ? g.lowestPrice.minVcpu : null,
    }));
  },

  async dataCenters(apiKey) {
    const q = `query { dataCenters { id name storageSupport
      gpuAvailability { available gpuTypeId stockStatus } } }`;
    const d = await _graphql(apiKey, q);
    return (d.data && d.data.dataCenters) || [];
  },

  // Combined picker payload: Secure-Cloud GPUs with per-DC availability + stock.
  // Pass `dataCenterId` to get per-DC RAM (lowestPrice scoped to that DC).
  async availability(apiKey, dataCenterId) {
    const [gpus, dcs] = await Promise.all([
      client.gpuTypes(apiKey, dataCenterId),
      client.dataCenters(apiKey),
    ]);
    return { gpuTypes: gpus, dataCenters: dcs };
  },

  async createPod(apiKey, spec) {
    // MPI-293: RunPod's gateway intermittently answers a create with a transient
    // 502/503/504 (proxy blip, NOT a real reject/out-of-stock). Surfaced raw, it
    // aborts the whole connect and can leave a bare Pod. A 4xx (enum lag, stock,
    // schema) is a real reject and must NOT retry — only gateway 5xx do.
    // ponytail: fixed 2-retry with short linear backoff; enough for a proxy blip.
    // MPI-806: translate internal v1-format spec to v2 nested format before sending.
    const v2spec = _toV2PodSpec(spec);
    let r;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      r = await _rest(apiKey, 'POST', '/pods', v2spec);
      if (r.ok || r.status < 502 || r.status > 504) return r;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
    return r;
  },
  // MPI-159: GraphQL create fallback for GPUs the REST create enum rejects (the
  // REST `gpuTypeIds` enum lags the GraphQL catalogue the picker lists from, so a
  // pickable card like "NVIDIA RTX PRO 4500 Blackwell" 400s on REST POST /pods).
  // GraphQL `podFindAndDeployOnDemand` takes `gpuTypeId` as a FREE STRING (no enum)
  // — the same id the picker already has — and the console uses this same mutation.
  // REST manages the resulting Pod (shared id namespace), so only CREATE moves to
  // GraphQL; get/start/stop/delete stay REST. Adapts the GraphQL shape ({data}|{errors},
  // always HTTP 200) to the same {ok,status,json:{id}} the REST createPod returns, so
  // the caller (_createPodInternal) treats both paths identically.
  //
  // `spec` is the REST POST /pods spec; this translates it to the GraphQL input shape:
  //   gpuTypeIds:[id]→gpuTypeId, dataCenterIds:[dc]→dataCenterId, env obj→[{key,value}],
  //   ports:['8889/http']→'8889/http' (comma-string), + cloudType:SECURE.
  async createPodGraphql(apiKey, spec) {
    const input = {
      cloudType: 'SECURE',
      name: spec.name,
      imageName: spec.imageName,
      gpuCount: spec.gpuCount || 1,
      containerDiskInGb: spec.containerDiskInGb,
      ports: Array.isArray(spec.ports) ? spec.ports.join(',') : spec.ports,
      env: Object.entries(spec.env || {}).map(([key, value]) => ({ key, value: String(value) })),
    };
    if (Array.isArray(spec.gpuTypeIds) && spec.gpuTypeIds.length) input.gpuTypeId = spec.gpuTypeIds[0];
    if (Array.isArray(spec.dataCenterIds) && spec.dataCenterIds.length) input.dataCenterId = spec.dataCenterIds[0];
    if (spec.networkVolumeId) input.networkVolumeId = spec.networkVolumeId;
    if (spec.volumeMountPath) input.volumeMountPath = spec.volumeMountPath;
    if (typeof spec.volumeInGb === 'number') input.volumeInGb = spec.volumeInGb;
    // MPI-160: system-RAM floor. Live-proven honored on this GraphQL mutation
    // (200GB → SUPPLY_CONSTRAINT, 90/none → create). RunPod places only on a host
    // with >= this much system RAM.
    if (typeof spec.minMemoryInGb === 'number') input.minMemoryInGb = spec.minMemoryInGb;
    // MPI-188: driver-floor placement filter. RunPod lands the Pod only on a host
    // whose driver supports one of these CUDA versions — guards the "driver too
    // old" ComfyUI boot crash. Threaded the same way as minMemoryInGb above.
    if (Array.isArray(spec.allowedCudaVersions) && spec.allowedCudaVersions.length) {
      input.allowedCudaVersions = spec.allowedCudaVersions;
    }
    const mutation = `mutation($input: PodFindAndDeployOnDemandInput!) {
      podFindAndDeployOnDemand(input: $input) { id desiredStatus imageName machineId }
    }`;
    const d = await _graphql(apiKey, mutation, { input });
    if (d && Array.isArray(d.errors) && d.errors.length) {
      const message = d.errors.map((e) => (e && e.message) || String(e)).filter(Boolean).join('; ');
      // HTTP-200 GraphQL error → present as a non-ok REST-shaped result so the caller's
      // existing reject path reads it. 500 = generic server/stock; the message carries
      // the real reason (out-of-stock vs unsupported) for _createRejectReason.
      return { ok: false, status: 500, json: { error: message, errors: d.errors } };
    }
    const pod = d && d.data && d.data.podFindAndDeployOnDemand;
    if (!pod || !pod.id) {
      return { ok: false, status: 500, json: { error: 'GraphQL create returned no pod id' } };
    }
    return { ok: true, status: 200, json: { id: pod.id, desiredStatus: pod.desiredStatus } };
  },
  // MPI-806: v1 POST /pods/{id}/start → v2 POST /v2/pods/{id}/action {action:'start'}
  async startPod(apiKey, id) {
    return _rest(apiKey, 'POST', `/pods/${id}/action`, { action: 'start' });
  },
  // MPI-806: v1 POST /pods/{id}/stop → v2 POST /v2/pods/{id}/action {action:'stop'}
  async stopPod(apiKey, id) {
    return _rest(apiKey, 'POST', `/pods/${id}/action`, { action: 'stop' });
  },
  async deletePod(apiKey, id) {
    return _rest(apiKey, 'DELETE', `/pods/${id}`);
  },
  async getPod(apiKey, id) {
    return _rest(apiKey, 'GET', `/pods/${id}`);
  },
  // List the account's Pods. v2 GET /v2/pods wraps as {"pods":[...]} (v1 was bare array).
  // Callers unwrap via Array.isArray(r.json) || r.json.pods — both shapes handled.
  async listPods(apiKey) {
    return _rest(apiKey, 'GET', '/pods');
  },
  // MPI-806: v1 /networkvolumes → v2 /network-volumes (hyphen added)
  async listVolumes(apiKey) {
    return _rest(apiKey, 'GET', '/network-volumes');
  },
  // MPI-806: v1 /networkvolumes → v2 /network-volumes; dataCenterId → dataCenter
  async createVolume(apiKey, spec) {
    // v1 spec uses dataCenterId; v2 uses dataCenter — translate at the boundary
    const v2spec = { ...spec };
    if (v2spec.dataCenterId !== undefined && v2spec.dataCenter === undefined) {
      v2spec.dataCenter = v2spec.dataCenterId;
      delete v2spec.dataCenterId;
    }
    return _rest(apiKey, 'POST', '/network-volumes', v2spec);
  },
  async deleteVolume(apiKey, id) {
    return _rest(apiKey, 'DELETE', `/network-volumes/${id}`);
  },
  // MPI-762: grow a volume. RunPod refuses a size not larger than the current one.
  async updateVolume(apiKey, id, size) {
    return _rest(apiKey, 'PATCH', `/network-volumes/${id}`, { size });
  },
  async createTemplate(apiKey, spec) {
    return _rest(apiKey, 'POST', '/templates', spec);
  },
};

// --- routes -----------------------------------------------------------------
// These are mounted in server.js. They require a key-resolver injected by
// remoteEngine.js (so this module never reaches into the fork bridge directly).

let _getApiKey = async () => null;

function setApiKeyResolver(fn) {
  if (typeof fn === 'function') _getApiKey = fn;
}

async function _withKey(res, handler) {
  const key = await _getApiKey();
  if (!key) {
    return res.status(400).json({ error: 'no_api_key', message: 'RunPod API key not set' });
  }
  try {
    return await handler(key);
  } catch (err) {
    logger.error('runpod', 'RunPod request failed', err);
    return res.status(502).json({ error: 'runpod_unreachable', message: 'RunPod request failed' });
  }
}

router.get('/runpod/account/validate', (req, res) =>
  _withKey(res, async (key) => res.json(await client.validate(key))));

router.get('/runpod/gpu-availability', (req, res) =>
  _withKey(res, async (key) => {
    // Optional ?dataCenterId scopes GPU RAM (lowestPrice) to that DC; omitted =
    // global floor (back-compat). See gpuTypes() for why this matters.
    const dcId = typeof req.query.dataCenterId === 'string' ? req.query.dataCenterId : undefined;
    res.json(await client.availability(key, dcId));
  }));

router.post('/runpod/pods', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.createPod(key, req.body);
    res.status(r.ok ? 200 : r.status).json(r.json);
  }));

router.post('/runpod/pods/:id/start', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.startPod(key, req.params.id);
    res.status(r.ok ? 200 : r.status).json(r.json);
  }));

router.post('/runpod/pods/:id/stop', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.stopPod(key, req.params.id);
    res.status(r.ok ? 200 : r.status).json(r.json);
  }));

router.delete('/runpod/pods/:id', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.deletePod(key, req.params.id);
    res.status(r.ok ? 200 : r.status).json(r.json);
  }));

// READ-ONLY inventory of every Pod on the account. `client.listPods` already existed but
// was reachable only from inside the orphan sweep, so nothing could ANSWER "what is running
// right now" — and the only `/runpod/pods` verb was POST, which CREATES. On 2026-08-10 that
// gap cost real money: an agent looking for a list called the create endpoint, made stray
// Pods, and then could not delete them because it had no way to learn their ids. Deleting
// needs seeing first; this is the seeing half.
router.get('/runpod/pods', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.listPods(key);
    const pods = Array.isArray(r.json) ? r.json : (r.json && (r.json.pods || r.json.data)) || [];
    res.status(r.ok ? 200 : r.status).json({
      count: pods.length,
      costPerHrTotal: pods.reduce((sum, p) => sum + (Number(p.cost ?? p.costPerHr) || 0), 0), // v2 `cost` (MPI-806)
      pods: pods.map((p) => sanitizePodJson(p)),
    });
  }));

router.get('/runpod/pods/:id', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.getPod(key, req.params.id);
    res.status(r.ok ? 200 : r.status).json(sanitizePodJson(r.json));
  }));

router.get('/runpod/volumes', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.listVolumes(key);
    if (!r.ok) return res.status(r.status).json(r.json);
    // MPI-806: v2 wraps as {networkVolumes:[...]}; v1 returned bare array.
    // Renderer reads vol.dataCenterId but v2 uses vol.dataCenter — add alias.
    const raw = Array.isArray(r.json)
      ? r.json
      : (r.json && (r.json.networkVolumes || r.json.volumes)) || [];
    const vols = raw.map((v) =>
      v && v.dataCenter !== undefined && v.dataCenterId === undefined
        ? { ...v, dataCenterId: v.dataCenter }
        : v,
    );
    res.status(200).json({ networkVolumes: vols });
  }));

router.post('/runpod/volumes', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.createVolume(key, req.body);
    res.status(r.ok ? 200 : r.status).json(r.json);
  }));

router.delete('/runpod/volumes/:id', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.deleteVolume(key, req.params.id);
    res.status(r.ok ? 200 : r.status).json(r.json);
  }));

// MPI-762: grow a volume. Only a whole-number size reaches RunPod (its cap is 4000 GB);
// RunPod refuses one not larger than the current size, so grow-only is enforced there.
router.patch('/runpod/volumes/:id', (req, res) => {
  const size = req.body?.size;
  if (!Number.isInteger(size) || size <= 0 || size > 4000) {
    return res.status(400).json({ error: 'invalid_size', message: 'Size must be a whole number of GB from 1 to 4000.' });
  }
  return _withKey(res, async (key) => {
    const r = await client.updateVolume(key, req.params.id, size);
    res.status(r.ok ? 200 : r.status).json(r.json);
  });
});

router.post('/runpod/templates', (req, res) =>
  _withKey(res, async (key) => {
    const r = await client.createTemplate(key, req.body);
    res.status(r.ok ? 200 : r.status).json(r.json);
  }));

module.exports = { router, client, setApiKeyResolver, redactSecret };
