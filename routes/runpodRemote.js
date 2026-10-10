/**
 * routes/runpodRemote.js — RunPod REST client and HTTP routes.
 *
 * Backend client for the RunPod remote engine (MPI-64). Talks to REST
 * https://api.runpod.io/v2 only — Pod / network-volume / template CRUD (MPI-806: migrated
 * from rest.runpod.io/v1, which retires 2026-11-15) and the GPU + data-center catalogue
 * (MPI-894: moved off GraphQL, which RunPod retires in early 2027).
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

// The lowest CUDA version the Pod image runs on (MPI-188/189: one cu130 image, r580
// driver floor). Both the create (gpu.minCudaVersion) and the catalogue's stock query
// use it, so a card reads as in stock only where a create can land.
const POD_CUDA_FLOOR = '13.0';

// Cloudflare fronts the RunPod proxy AND the API; default fetch UA can be blocked
// (HTTP 403 error 1010). Send a browser UA on all calls. (Verified MPI-64.)
const { UA } = require('./remoteHeaders');

// --- low-level client (key passed in, never stored/logged) ------------------

async function _rest(apiKey, method, path, body, signal) {
  const res = await _safeFetch(`${REST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
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

// Wrap a fetch so a thrown error never carries the key (a key that ever lands in a
// URL would otherwise reach err.message -> app.log -> bug report).
async function _safeFetch(url, opts) {
  try {
    return await fetch(url, opts);
  } catch (err) {
    const e = new Error(redactSecret(err && err.message ? err.message : String(err)));
    e.code = err && err.code;
    throw e;
  }
}

// --- v1 → v2 spec translation ------------------------------------------------
//
// MPI-806: v2 pod-create body is nested (gpu/cpu/mounts objects) while the app
// builds the spec in the flat v1 shape internally. Translate at the REST boundary
// so every call site is unaffected.
//
// v1 → v2 field renames:
//   imageName            → image
//   containerDiskInGb    → disk
//   gpuTypeIds:[id]      → gpu.id
//   gpuCount             → gpu.count
//   minCudaVersion       → gpu.minCudaVersion  (a floor; v2's allowedCudaVersions is EXACT)
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
    if (spec.minCudaVersion) body.gpu.minCudaVersion = spec.minCudaVersion;
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

// --- GPU catalogue (MPI-894) -------------------------------------------------
//
// REST v2 /catalog/*, translated here into the shape the renderer has always read from
// GraphQL, so no renderer file knows the API changed. Stock is asked with the SAME filters
// a create sends (Secure Cloud, a Pod, the CUDA floor): a wider query reports stock on
// hosts a create can never land on — the "listed, then refused" loop of MPI-595 B1.
//
// v2's catalogue has NO system RAM or vCPU (live openapi, 2026-09-28), so the picker's
// per-DC RAM badge (`minMemory`) is gone; the create's gpu.minRamPerGpu floor still
// guarantees RAM.
const GPU_CATALOG = `/catalog/gpus?include=AVAILABILITY&product=POD&cloud=SECURE&minCudaVersion=${POD_CUDA_FLOOR}`;
const DC_CATALOG = '/catalog/datacenters?include=GPU_AVAILABILITY';
const STOCK = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }; // v2 NONE = unavailable

async function _catalog(apiKey, path, field) {
  const r = await _rest(apiKey, 'GET', path);
  if (!r.ok) throw new Error(`RunPod ${path.split('?')[0]} -> http ${r.status}`);
  return (r.json && r.json[field]) || [];
}

function _toPickerGpu(g) {
  return {
    id: g.id,
    displayName: g.name,
    memoryInGb: g.memory,
    secureCloud: g.secure,
    communityCloud: g.community,
    securePrice: g.price ? g.price.secure : null,
    maxCount: g.maxCount ? g.maxCount.secure : null, // GPUs per Pod, a ceiling not stock (1c tile)
  };
}

// Each DC's `gpuAvailability` as GraphQL shaped it. The DC catalogue says which cards a DC
// OFFERS, but its availability is scoped by neither cloud nor CUDA; the level comes from the
// gpus call, which is. A card offered there that the scoped call does not list has no host a
// create could use: unavailable, yet still listed so auto-retry can wait for it (MPI-110).
function _toPickerDcs(dcs, gpus) {
  const levels = new Map(dcs.map((dc) => [dc.id, new Map((dc.gpuAvailability || []).map((a) => [a.id, 'NONE']))]));
  for (const g of gpus) {
    for (const d of g.dataCenters || []) {
      if (levels.has(d.id)) levels.get(d.id).set(g.id, d.availability);
    }
  }
  return dcs.map((dc) => ({
    id: dc.id,
    name: dc.name,
    storageSupport: (dc.networkVolumeTypes || []).length > 0,
    gpuAvailability: [...levels.get(dc.id)].map(([gpuTypeId, level]) => ({
      gpuTypeId,
      available: !!STOCK[level],
      stockStatus: STOCK[level] || null,
    })),
  }));
}

// --- client functions (exported for remoteEngine.js + tests) ----------------

const client = {
  // v2 GET /v2/pods — probes the authenticated key; list wraps as {"pods":[...]}
  async validate(apiKey) {
    const r = await _rest(apiKey, 'GET', '/pods');
    return { valid: r.ok, status: r.status };
  },

  // `memoryInGb` is GPU VRAM.
  async gpuTypes(apiKey) {
    return (await _catalog(apiKey, GPU_CATALOG, 'gpus')).map(_toPickerGpu);
  },

  async dataCenters(apiKey) {
    return (await client.availability(apiKey)).dataCenters;
  },

  // Combined picker payload: GPUs + DCs with per-DC availability and stock.
  async availability(apiKey) {
    const [gpus, dcs] = await Promise.all([
      _catalog(apiKey, GPU_CATALOG, 'gpus'),
      _catalog(apiKey, DC_CATALOG, 'dataCenters'),
    ]);
    return { gpuTypes: gpus.map(_toPickerGpu), dataCenters: _toPickerDcs(dcs, gpus) };
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
  // MPI-1057: `timeoutMs` bounds the call. RunPod's API can hang on a Pod its host never
  // started (a DELETE took ~2 min on 2026-10-10), and a caller on a polled route must not.
  async getPod(apiKey, id, { timeoutMs } = {}) {
    return _rest(apiKey, 'GET', `/pods/${id}`, undefined, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined);
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

// A `?dataCenterId` the renderer still sends is ignored: it scoped GraphQL's per-DC RAM
// figure, which v2 does not have (MPI-894). Availability is per DC in the payload itself.
router.get('/runpod/gpu-availability', (req, res) =>
  _withKey(res, async (key) => res.json(await client.availability(key))));

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

module.exports = { router, client, setApiKeyResolver, redactSecret, POD_CUDA_FLOOR };
