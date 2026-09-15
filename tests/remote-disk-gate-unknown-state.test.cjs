'use strict';
/**
 * MPI-752 — the remote disk-full gate must bill only bytes KNOWN to be missing.
 *
 * `_startRemoteDownload` asks the Pod which deps are already on the volume before it
 * gates. When that answer is missing — `remoteModelsCheck` threw (a busy wrapper 524s),
 * or `foldBackWrapperStatus` dropped a short answer — `statusResults` is empty and every
 * dep lands in `toInstall`. Sending those is harmless (the wrapper answers
 * already_installed), but the gate summed the same list, so files ALREADY on the volume
 * were billed as new downloads. The shape that matters: MiniMax H3 Reference is 50.1GB,
 * 28.8GB of it shared with MiniMax H3, so on a volume that already holds H3 it needs ~21GB
 * and an unknown-state bill asks for all 50. (A live Pod refusal of that kind was reported;
 * its log line had rotated out, so this is the proven mechanism, not a proven replay.)
 *
 * Unknown install state must bill nothing — the same never-false-block rule the gate
 * already applies to unknown free space. Runs the REAL _startRemoteDownload with every
 * wrapper call stubbed — no Pod, no network, no port, no local disk.
 */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi752-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const GB = 1e9;
// 30GB free on a 150GB volume — room for the transformer, not for the whole model.
require('../routes/remotePodLifecycle').remoteVolumeFreeBytes = async () =>
    ({ freeBytes: 30 * GB, usedBytes: 120 * GB, totalBytes: 150 * GB });

const remoteModels = require('../routes/remoteModels.js');
const dm = require('../routes/downloadManager.js');

let statusCheck = null;
remoteModels.remoteModelsCheck = async (models) => statusCheck(models);
remoteModels.remoteActiveInstallIds = async () => new Set(dm._remoteDepIds);
remoteModels.remoteInstallDep = async (dep) => ({ status: 'started', id: dep.id });
remoteModels.openInstallEventStream = () => ({ abort() {} });
remoteModels._isImageResident = () => false;

const volumeHas = (ids) => async (models) => ({
    results: Object.fromEntries(models.map(m => [m.id, {
        deps: m.deps.map(d => ({ id: d.id, installed: ids.includes(d.id) })),
    }])),
});

test.afterEach(() => {
    dm._remoteInstallQueue.length = 0;
    dm._remoteDepIds.clear();
});
test.after(() => dm._teardownRemoteEventStreamIfIdle());

const makeRes = () => {
    const r = { code: 200, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};

// Unique ids per scenario: _depJobs is module-level and a cached status would leak.
let n = 0;
const h3RefShape = () => {
    const p = `mpi752-${++n}`;
    return {
        modelId: p,
        encoder: { id: `${p}-encoder`, type: 'text_encoders', filename: `text_encoders/${p}.safetensors`, url: 'https://x/e', size: '24.55GB' },
        transformer: { id: `${p}-transformer`, type: 'diffusion_models', filename: `diffusion_models/${p}.safetensors`, url: 'https://x/t', size: '19.53GB' },
    };
};

const install = async (modelId, deps) => {
    const res = makeRes();
    await dm._startRemoteDownload(modelId, deps, res);
    return res;
};

test('a shared dep already on the volume is not billed (positive control)', async () => {
    const { modelId, encoder, transformer } = h3RefShape();
    statusCheck = volumeHas([encoder.id]);
    const res = await install(modelId, [encoder, transformer]);
    assert.equal(res.code, 200, `refused a 20.5GB need with 27.9GB free: ${res.body?.error}`);
    assert.equal(res.body?.success, true);
});

test('nothing on the volume and no room still refuses (the gate still works)', async () => {
    const { modelId, encoder, transformer } = h3RefShape();
    statusCheck = volumeHas([]);
    const res = await install(modelId, [encoder, transformer]);
    assert.equal(res.code, 400, 'a 46.3GB need with 27.9GB free must be refused');
    assert.match(res.body?.error || '', /Not enough disk space on the Pod volume/);
});

test('a failed status pre-check bills nothing instead of every dep', async () => {
    const { modelId, encoder, transformer } = h3RefShape();
    statusCheck = async () => { throw new Error('wrapper status 524'); };
    const res = await install(modelId, [encoder, transformer]);
    assert.equal(
        res.code, 200,
        `REGRESSION (MPI-752): unknown install state was billed as missing — ${res.body?.error}`,
    );
});

test('a short status answer (fold-back dropped the model) bills nothing', async () => {
    const { modelId, encoder, transformer } = h3RefShape();
    statusCheck = async () => ({ results: {} });
    const res = await install(modelId, [encoder, transformer]);
    assert.equal(res.code, 200, `a dropped status entry was billed as missing — ${res.body?.error}`);
});

test('a requirements-only node re-run is not billed as a download', async () => {
    // A node folder already on the volume goes back to the wrapper with requirementsOnly
    // so pip re-runs; no bytes move. Sized big here so billing it would flip the verdict.
    const { modelId, transformer } = h3RefShape();
    const node = { id: `${modelId}-node`, type: 'custom_nodes', filename: `${modelId}-node`, url: 'https://x/n', size: '20GB' };
    statusCheck = volumeHas([node.id]);
    const res = await install(modelId, [node, transformer]);
    assert.equal(res.code, 200, `a pip re-run was billed as 20GB of download — ${res.body?.error}`);
});

// MPI-756 — an install killed mid-download (Pod stop) leaves its bytes on the volume:
// `<dest>.part` from aria2, `<dest>.part.hfstage/` from the Hugging Face path. Those bytes
// are already inside the `used` the free figure subtracts, and the retry frees them before
// it writes (aria2 deletes the `.part`, the HF path rmtrees its stage), so billing the full
// size counts them twice. Live 2026-08-10: "need 13.3 GB, have 12.0 GB free" for the very
// dep whose 13.3GB partial was the thing filling the volume.
const GIB = 1024 ** 3;
const volumeHoldsLeftovers = (reclaim) => async (models) => ({
    results: Object.fromEntries(models.map(m => [m.id, {
        deps: m.deps.map(d => ({
            id: d.id, installed: false, partialBytes: 0,
            ...(d.id in reclaim ? { reclaimBytes: reclaim[d.id] } : {}),
        })),
    }])),
});

test("a dep's own stranded leftovers are credited against its retry", async () => {
    const { modelId, encoder, transformer } = h3RefShape();
    // The encoder's whole file is already staged on the volume from the killed install.
    statusCheck = volumeHoldsLeftovers({ [encoder.id]: 24.55 * GIB });
    const res = await install(modelId, [encoder, transformer]);
    assert.equal(
        res.code, 200,
        `REGRESSION (MPI-756): the retry was billed for bytes it reclaims — ${res.body?.error}`,
    );
});

test('a wrapper that reports no reclaimBytes credits nothing (old runtime)', async () => {
    const { modelId, encoder, transformer } = h3RefShape();
    statusCheck = volumeHoldsLeftovers({});
    const res = await install(modelId, [encoder, transformer]);
    assert.equal(res.code, 400, 'a 46.3GB need with 27.9GB free and no credit must be refused');
});
