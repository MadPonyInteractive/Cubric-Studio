'use strict';
/**
 * MPI-756 — the LOCAL disk-full gate must not bill a dep for bytes its retry resumes.
 *
 * The gate summed `totalBytes || seedBytes` for every queued dep. A marker-blessed partial
 * on disk is resumed in place (MPI-317/427), so its bytes are already inside the free figure
 * statfs reports AND billed again as new download — the remote twin of the Pod refusal
 * "need 13.3 GB, have 12.0 GB free" for the dep whose own partial filled the volume. A dep
 * job created after a restart never passes the reset branch that credits the partial, so
 * `downloadedBytes` could not be the answer either: the gate reads the partial itself.
 *
 * Runs the REAL /comfy/models/download/start handler against a sandbox models root, with
 * statfs and the online check stubbed. MB-sized fixtures, no real disk pressure.
 */
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi756-' + process.pid);
require('./helpers/sandbox-roots.cjs');

const fs = require('fs-extra');
// Both are read through their module objects at call time, except checkOnline, which
// downloadManager destructures at load — so it is stubbed BEFORE the require below.
require('../routes/netCheck').checkOnline = async () => true;
require('../routes/remoteModels').isRemoteActive = () => false;
const { markDownloadInProgress } = require('../routes/downloadCompletion');
const dm = require('../routes/downloadManager.js');

const MB = 1024 ** 2;
const FREE = 5 * MB;
fs.statfs = async () => ({ bavail: FREE / 4096, bsize: 4096, blocks: 1e6 });

const start = dm.router.stack
    .find(l => l.route && l.route.path === '/comfy/models/download/start')
    .route.stack[0].handle;

const makeRes = () => {
    const r = { code: 200, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};

let n = 0;
const dep = () => {
    const p = `mpi756-${process.pid}-${++n}`;
    // Closed port: a download the gate lets through fails fast with zero bytes.
    return { id: p, type: 'diffusion_models', filename: `diffusion_models/${p}.safetensors`, url: 'http://127.0.0.1:9/x', size: '10MB' };
};

const install = async (d) => {
    const res = makeRes();
    await start({ body: { modelId: `${d.id}-model`, dependencies: [d] } }, res);
    return res;
};

test.after(async () => {
    await dm.cancelAllDownloads();
    await fs.remove(process.env.CUBRIC_MODELS_ROOT);
});

test("a queued dep's resumable partial is credited against its retry", async () => {
    const d = dep();
    const localPath = path.join(process.env.CUBRIC_MODELS_ROOT, d.filename);
    await fs.outputFile(localPath, Buffer.alloc(8 * MB));
    await markDownloadInProgress(localPath);
    // 10MB dep, 8MB already on disk, 5MB free: the resume needs 2.1MB with margin.
    const res = await install(d);
    assert.notEqual(
        res.code, 400,
        `REGRESSION (MPI-756): the retry was billed for bytes it resumes — ${res.body?.error}`,
    );
});

test('nothing on disk and no room still refuses (the gate still works)', async () => {
    const res = await install(dep());
    assert.equal(res.code, 400, 'a 10.5MB need with 5MB free must be refused');
    assert.match(res.body?.error || '', /Not enough disk space/);
});
