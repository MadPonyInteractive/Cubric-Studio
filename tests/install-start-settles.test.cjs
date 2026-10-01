'use strict';
/**
 * MPI-513 — a start whose every dep is ALREADY on disk settles to `done`.
 *
 * No transport event will ever arrive for it (nothing downloads), so the start route
 * must run the model-level rollup itself. The old reconciler rolled such a store job to
 * done on its own; once it stopped writing models (D4, one model-level writer), a
 * re-install — or a restart right after a download finished — sat `downloading`
 * forever. Found live on an isolated instance, 2026-10-01.
 *
 * Runs the REAL /comfy/models/download/start handler against a sandbox models root.
 */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi513-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const fs = require('fs-extra');
// checkOnline is destructured at load — stub it BEFORE the require below.
require('../routes/netCheck').checkOnline = async () => true;
require('../routes/remoteModels').isRemoteActive = () => false;
const dm = require('../routes/downloadManager.js');

const start = dm.router.stack
    .find(l => l.route && l.route.path === '/comfy/models/download/start')
    .route.stack[0].handle;

const makeRes = () => {
    const r = { code: 200, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};

test.after(async () => {
    await dm.cancelAllDownloads();
    await fs.remove(process.env.CUBRIC_MODELS_ROOT);
});

test('a start with every dep already on disk settles done, not downloading forever', async () => {
    const id = `mpi513-${process.pid}`;
    const dep = { id, type: 'diffusion_models', filename: `diffusion_models/${id}.safetensors`, url: 'http://127.0.0.1:9/x', size: '1MB' };
    await fs.outputFile(path.join(process.env.CUBRIC_MODELS_ROOT, dep.filename), Buffer.alloc(1024));

    const res = makeRes();
    await start({ body: { modelId: `${id}-model`, dependencies: [dep] } }, res);

    assert.equal(res.code, 200);
    assert.equal(res.body.job.deps[0].status, 'complete', 'the on-disk dep registers complete');
    const job = dm._installStore.modelJob(`${id}-model`);
    assert.equal(job && job.status, 'done',
        'REGRESSION (MPI-513): nothing will ever download, so the start route must settle the job');
});
