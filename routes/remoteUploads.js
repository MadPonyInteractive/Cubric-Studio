/**
 * remoteUploads.js — the Upload models backend (MPI-1057).
 *
 * A user LoRA or upscaler the Pod does not have goes up from the Upload models
 * overlay, normally on the cheap "No GPU - download only" Pod, once: the volume keeps
 * it. One SEQUENTIAL queue (a home uplink gains nothing from two at once), each job
 * sent in slices by remoteModels.remoteUploadModel. Progress rides the downloads SSE
 * stream (`/comfy/downloads/stream`) as `upload:snapshot` (every job, on each status
 * change and on stream connect) and `upload:progress` (one job's bytes, per slice).
 *
 * Uploads land FLAT by basename, matching the generate-time presence check
 * (remoteUploadModel). A file already on the Pod is refused, so a cancel can always
 * remove what it left behind without touching a finished copy.
 */
'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const logger = require('./logger');
const { _resolveLocalModelPath } = require('./remotePodState');

const router = express.Router();
const _require = createRequire(__filename);

const USER_TYPES = ['loras', 'upscale_models'];
const MODEL_EXTS = new Set(['.safetensors', '.ckpt', '.pt', '.bin', '.pth']);  // /comfy/list-files' set
const TERMINAL_TTL_MS = 60 * 1000;
const LIVE = new Set(['queued', 'uploading']);

// Lazy: remoteModels requires remotePodState, and downloadManager is huge.
const _rm = () => require('./remoteModels');
const _broadcast = (event, data) => require('./downloadManager').broadcastEngineEvent(event, data);

/** @type {Map<string, {id, type, filename, totalBytes, sentBytes, status, error}>} the wire shape */
const _jobs = new Map();
const _localPaths = new Map();
const _aborts = new Map();
const _runs = new Map();
let _draining = false;

function broadcastSnapshot() {
  _broadcast('upload:snapshot', { jobs: [..._jobs.values()] });
}

/** @type {Map<string, Function[]>} job id -> resolvers waiting for it to settle (uploadAndWait) */
const _waiters = new Map();

function _set(job, patch) {
  Object.assign(job, patch);
  broadcastSnapshot();
  if (!LIVE.has(job.status)) {
    for (const done of _waiters.get(job.id) || []) done(job);
    _waiters.delete(job.id);
  }
}

/**
 * MPI-1057: a generate-time upload (a LoRA under the GPU 1 GB limit) goes through this
 * same queue, so it shows in the Cue panel's Transfers with a bar and Cancel like an
 * overlay upload. Resolves with the settled job; a live job for the same file (the
 * overlay already sending it) is awaited instead of a second copy.
 * ponytail: one sequential queue, so a generation waits behind an overlay upload of
 * another file; a priority lane if that ever bites.
 */
function uploadAndWait(type, localPath, filename, size) {
  let job = [..._jobs.values()].find((j) => j.type === type && j.filename === filename && LIVE.has(j.status));
  if (!job) {
    // atGenerate (MPI-1076): the generation reports this upload's outcome, so the
    // renderer does not announce it a second time.
    job = { id: crypto.randomUUID(), type, filename, totalBytes: size, sentBytes: 0, status: 'queued', error: null, atGenerate: true };
    _jobs.set(job.id, job);
    _localPaths.set(job.id, localPath);
    broadcastSnapshot();
    _drain();
  }
  return new Promise((resolve) => {
    _waiters.set(job.id, [...(_waiters.get(job.id) || []), resolve]);
  });
}

function _expire(job) {
  setTimeout(() => {
    if (_jobs.get(job.id) === job) { _jobs.delete(job.id); broadcastSnapshot(); }
  }, TERMINAL_TTL_MS).unref();
}

/** Remove a model file (and its `.part`) from the volume. `rel` is relative to the bucket. */
function _deleteRemote(type, rel) {
  return _rm().remoteUninstallDep({ id: `upload/${rel}`, filename: `${type}/${rel}` });
}

async function _runJob(job) {
  const ac = new AbortController();
  _aborts.set(job.id, ac);
  _set(job, { status: 'uploading' });
  try {
    if (!_rm().isRemoteActive()) throw new Error('remote_inactive');
    logger.info('runpod', `upload ${job.type}/${job.filename}: starting, ${(job.totalBytes / 1e9).toFixed(2)} GB`);
    await _rm().remoteUploadModel(_localPaths.get(job.id), job.type, job.filename, {
      signal: ac.signal,
      onProgress: (sent) => {
        job.sentBytes = sent;
        _broadcast('upload:progress', { id: job.id, sentBytes: sent, totalBytes: job.totalBytes });
      },
    });
    logger.info('runpod', `upload ${job.type}/${job.filename}: complete`);
    _set(job, { status: 'complete', sentBytes: job.totalBytes });
  } catch (err) {
    if (ac.signal.aborted) {
      logger.info('runpod', `upload ${job.type}/${job.filename}: cancelled at ${(job.sentBytes / 1e9).toFixed(2)} GB`);
      _set(job, { status: 'cancelled' });
      await _deleteRemote(job.type, job.filename).catch((e) => logger.warn('runpod', `upload cancel cleanup of ${job.filename} failed: ${e.message}`));
    } else {
      logger.error('runpod', `upload ${job.type}/${job.filename} failed: ${err.message}`);
      _set(job, { status: 'failed', error: err.message });
    }
  } finally {
    _aborts.delete(job.id);
    _localPaths.delete(job.id);
    _expire(job);
  }
}

async function _drain() {
  if (_draining) return;
  _draining = true;
  try {
    for (let job; (job = [..._jobs.values()].find((j) => j.status === 'queued'));) {
      const run = _runJob(job);
      _runs.set(job.id, run);
      await run;
      _runs.delete(job.id);
    }
  } finally {
    _draining = false;
  }
}

/** Cancel a queued or running job; resolves once it has settled (and cleaned up). */
async function _cancel(job) {
  if (job.status === 'queued') {
    _set(job, { status: 'cancelled' });
    _localPaths.delete(job.id);
    _expire(job);
  } else if (job.status === 'uploading') {
    _aborts.get(job.id)?.abort();
    await _runs.get(job.id);
  }
}

/** Every model file in the local folders for one bucket: `[{ rel, sizeBytes }]`, the union /comfy/list-files lists. */
async function listLocalModels(type) {
  const { getSearchedModelsRoots, getExtraModelFolders } = require('./shared');
  const roots = [
    ...(await getSearchedModelsRoots()).map((r) => path.join(r, type)),
    ...((await getExtraModelFolders())[type] || []),
  ];
  const out = [];
  const seen = new Set();
  const walk = async (dir, root) => {
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(full, root); continue; }
      if (!MODEL_EXTS.has(path.extname(e.name).toLowerCase())) continue;
      const rel = path.relative(root, full).replace(/\\/g, '/');
      const key = process.platform === 'win32' ? rel.toLowerCase() : rel;
      if (seen.has(key)) continue;  // active root first, so its copy wins (same as the dropdown)
      seen.add(key);
      out.push({ rel, sizeBytes: (await fs.promises.stat(full)).size });
    }
  };
  for (const root of roots) await walk(root, root);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/** Bucket-relative paths of the weights the app installs itself: deleting one here would leave its install state lying. */
function _managedRels(type) {
  const { DEPS } = _require('../js/data/modelConstants/dependencies.js');
  return new Set(Object.values(DEPS)
    .filter((d) => d && d.filename)
    .map((d) => _rm().wrapperDepPath(d))
    .filter((p) => p.type === type)
    .map((p) => p.filename));
}

const _gb = (b) => `${(b / 1e9).toFixed(1)} GB`;

/** Validate `type` and remote mode; responds itself and returns null on failure. */
function _check(type, res) {
  if (!USER_TYPES.includes(type)) { res.status(400).json({ error: 'type must be loras or upscale_models' }); return null; }
  if (!_rm().isRemoteActive()) { res.status(409).json({ error: 'remote_inactive' }); return null; }
  return type;
}

router.get('/remote/user-models', async (req, res) => {
  const type = _check(req.query.type, res);
  if (!type) return;
  try {
    const managed = _managedRels(type);
    const [local, remote] = await Promise.all([listLocalModels(type), _rm().remoteListModels(type)]);
    res.json({ success: true, local, remote: remote.map((f) => (managed.has(f.rel) ? { ...f, managed: true } : f)) });
  } catch (err) {
    logger.warn('runpod', `user-models list (${type}) failed: ${err.message}`);
    res.status(502).json({ error: err.message === 'runtime_too_old' ? 'runtime_too_old' : 'list_failed', message: err.message });
  }
});

router.get('/remote/uploads', (req, res) => {
  res.json({ success: true, jobs: [..._jobs.values()] });
});

router.post('/remote/uploads', async (req, res) => {
  const { type: rawType, files } = req.body || {};
  const type = _check(rawType, res);
  if (!type) return;
  if (!Array.isArray(files) || !files.length) return res.status(400).json({ error: 'files required' });
  try {
    const onPod = new Set((await _rm().remoteListModels(type)).filter((f) => !f.partial).map((f) => path.posix.basename(f.rel)));
    for (const n of _rm().podBakedModelNames(type)) onPod.add(path.posix.basename(n));
    const busy = new Set([..._jobs.values()].filter((j) => j.type === type && LIVE.has(j.status)).map((j) => j.filename));

    const accepted = [];
    const skipped = [];
    for (const rel of files) {
      const base = path.posix.basename(String(rel).replace(/\\/g, '/'));
      if (onPod.has(base)) { skipped.push({ rel, reason: 'already_on_pod' }); continue; }
      if (busy.has(base)) { skipped.push({ rel, reason: 'already_queued' }); continue; }
      const localPath = await _resolveLocalModelPath(type, rel);
      if (!localPath) { skipped.push({ rel, reason: 'not_found' }); continue; }
      busy.add(base);
      accepted.push({ base, localPath, size: (await fs.promises.stat(localPath)).size });
    }

    if (accepted.length) {
      // Same gate and margin as a remote install (MPI-542). Bytes a running upload has
      // already sent sit in its `.part`, so only what is left counts.
      const pending = [..._jobs.values()].filter((j) => LIVE.has(j.status)).reduce((s, j) => s + j.totalBytes - j.sentBytes, 0);
      const need = (accepted.reduce((s, a) => s + a.size, 0) + pending) * 1.05;
      const { remoteVolumeFreeBytes } = require('./remotePodLifecycle');
      const free = await remoteVolumeFreeBytes().catch(() => null);
      if (free && Number.isFinite(free.freeBytes) && free.freeBytes < need) {
        logger.warn('runpod', `upload blocked, volume full: need ${_gb(need)}, have ${_gb(free.freeBytes)}`);
        return res.status(400).json({
          error: 'volume_full',
          toast: true,
          message: `Not enough space on the Pod volume: ${_gb(need)} needed (5% margin included), ${_gb(free.freeBytes)} free of ${_gb(free.totalBytes)}.`,
        });
      }
    }

    const jobs = accepted.map((a) => {
      const job = { id: crypto.randomUUID(), type, filename: a.base, totalBytes: a.size, sentBytes: 0, status: 'queued', error: null };
      _jobs.set(job.id, job);
      _localPaths.set(job.id, a.localPath);
      return job;
    });
    if (jobs.length) { broadcastSnapshot(); _drain(); }
    res.json({ success: true, jobs, skipped });
  } catch (err) {
    logger.error('runpod', `upload queue (${type}) failed: ${err.message}`);
    res.status(502).json({ error: err.message === 'runtime_too_old' ? 'runtime_too_old' : 'upload_failed', message: err.message });
  }
});

router.post('/remote/uploads/:id/cancel', async (req, res) => {
  const job = _jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
  await _cancel(job);
  res.json({ success: true, job });
});

router.post('/remote/user-models/delete', async (req, res) => {
  const { type: rawType, filename } = req.body || {};
  const type = _check(rawType, res);
  if (!type) return;
  const rel = String(filename || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return res.status(400).json({ error: 'filename required' });
  if (_managedRels(type).has(rel)) {
    return res.status(409).json({ error: 'managed_by_app', message: 'The app installed this one. Remove it from its model instead.' });
  }
  try {
    const live = [..._jobs.values()].find((j) => j.type === type && j.filename === rel && LIVE.has(j.status));
    if (live) await _cancel(live);
    const out = await _deleteRemote(type, rel);
    if (out.status === 'unsupported') return res.status(502).json({ error: 'delete_failed', message: 'The Pod did not answer the delete.' });
    logger.info('runpod', `user model ${type}/${rel}: ${out.status} from the volume`);
    res.json({ success: true, status: out.status });
  } catch (err) {
    logger.error('runpod', `user model delete ${type}/${rel} failed: ${err.message}`);
    res.status(502).json({ error: 'delete_failed', message: err.message });
  }
});

module.exports = router;
module.exports.broadcastSnapshot = broadcastSnapshot;
module.exports.listLocalModels = listLocalModels;  // exported for tests
module.exports.uploadAndWait = uploadAndWait;
