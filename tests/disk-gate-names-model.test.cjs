'use strict';
/**
 * MPI-1158 — a disk-full refusal must say WHICH install it refused.
 *
 * Both gates (local disk, Pod volume) said "this model" and logged no id. On 2026-10-16 a
 * true Pod refusal for Krea 2 (uninstalled 30 minutes earlier, so it needed its own 12.57 GiB
 * transformer: "need 15.9 GB, have 14.1 GB") was read as a FALSE one for Krea 2 NSFW, pressed
 * 8 s later, and a session went hunting a gate bug that did not exist. Only the netlog's
 * request body length (11233 bytes = the krea2 request) told the two apart.
 *
 * Runs the REAL handler / _startRemoteDownload with statfs, the volume free space and every
 * wrapper call stubbed — no Pod, no network, nothing written to disk.
 */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1158-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const fs = require('fs-extra');
require('../routes/netCheck').checkOnline = async () => true;
const remoteModels = require('../routes/remoteModels.js');
remoteModels.isRemoteActive = () => false; // the local handler stays on the local path
require('../routes/remotePodLifecycle').remoteVolumeFreeBytes = async () =>
    ({ freeBytes: 1e9, usedBytes: 199e9, totalBytes: 200e9 });
const dm = require('../routes/downloadManager.js');
const logger = require('../routes/logger');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { resolveFullUniverse } = require('../js/data/modelConstants/resolveModelDeps.js');
const { DEPS } = require('../js/data/modelConstants/dependencies.js');
const { FLOWS, flowDepKey } = require('../js/data/flowsRegistry.js');

fs.statfs = async () => ({ bavail: 1, bsize: 4096, blocks: 1e6 }); // 4 KB free
remoteModels.remoteModelsCheck = async (models) => ({
    results: Object.fromEntries(models.map(m => [m.id, {
        deps: m.deps.map(d => ({ id: d.id, installed: false })),
    }])),
});
remoteModels.remoteActiveInstallIds = async () => new Set();
remoteModels._isImageResident = () => false;

const warnings = [];
const realWarn = logger.warn;
logger.warn = (cat, msg) => { warnings.push(msg); return realWarn.call(logger, cat, msg); };

test.after(async () => {
    logger.warn = realWarn;
    dm._teardownRemoteEventStreamIfIdle();
    await dm.cancelAllDownloads();
    await fs.remove(process.env.CUBRIC_MODELS_ROOT);
});

const makeRes = () => {
    const r = { code: 200, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};
const start = dm.router.stack
    .find(l => l.route && l.route.path === '/comfy/models/download/start')
    .route.stack[0].handle;

const model = MODELS.find(m => m.id === 'krea2-nsfw');
const deps = (engine) => resolveFullUniverse(model, null, engine).map(id => DEPS[id]).filter(Boolean);

const assertNamed = (res, name, id) => {
    assert.equal(res.code, 400, 'the gate must still refuse');
    assert.ok(res.body?.error?.includes(`install ${name} —`),
        `REGRESSION (MPI-1158): the toast does not name ${name}: ${res.body?.error}`);
    assert.ok(warnings.some(w => w.includes('blocked') && w.includes(id)),
        `REGRESSION (MPI-1158): the log line does not name ${id}: ${warnings.join(' | ')}`);
};

test('the local disk-full refusal names the model', async () => {
    warnings.length = 0;
    const res = makeRes();
    await start({ body: { modelId: model.id, dependencies: deps('local') } }, res);
    assertNamed(res, 'Krea 2 NSFW', 'krea2-nsfw');
});

test('the Pod volume refusal names the model', async () => {
    warnings.length = 0;
    const res = makeRes();
    await dm._startRemoteDownload(model.id, deps('remote'), res);
    assertNamed(res, 'Krea 2 NSFW', 'krea2-nsfw');
});

test('a Flow install is named by its title, not its job key', async () => {
    warnings.length = 0;
    const flow = FLOWS[0];
    const key = flowDepKey(flow.id);
    const res = makeRes();
    await dm._startRemoteDownload(key, [{ id: `mpi1158-${process.pid}`, type: 'diffusion_models',
        filename: `diffusion_models/mpi1158-${process.pid}.safetensors`, url: 'http://127.0.0.1:9/x', size: '5GB' }], res);
    assertNamed(res, flow.title, key);
});
