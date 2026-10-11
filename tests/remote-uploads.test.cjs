'use strict';

// MPI-1057 — the Upload models backend: one sequential upload queue with progress
// and cancel, the local/Pod model lists, the volume free-space gate, the delete that
// refuses app-installed weights, and the 1 GB refusal of a generate-time upload on a
// GPU Pod. Drives the REAL routes against a stub wrapper on localhost.
// The wrapper's /wrapper/models/list is pinned by
// mpi-ci/cubric-vision-pod/wrapper/test_models_list.py.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1057u-' + process.pid);
require('./helpers/sandbox-roots.cjs');

// The two heavy neighbours, stubbed: the SSE broadcast and the volume free-space read.
const events = [];
let free = null;
const stub = (rel, exports) => {
    const file = require.resolve(rel);
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub('../routes/downloadManager', { broadcastEngineEvent: (event, data) => events.push({ event, data: JSON.parse(JSON.stringify(data)) }) });
stub('../routes/remotePodLifecycle', { router: express.Router(), remoteVolumeFreeBytes: async () => free });

const remoteEngine = require('../routes/remoteEngine');
let wrapperBase = '';
remoteEngine.proxyUrl = () => wrapperBase;
remoteEngine.getWrapperToken = async () => 'tok';
const { setRemoteMode } = require('../routes/remotePodState');
const { DEPS } = require('../js/data/modelConstants/dependencies.js');
const { wrapperDepPath } = require('../routes/remoteModels');
const uploadsRouter = require('../routes/remoteUploads');
const { router: forwardRouter } = require('../routes/remoteProxyForward');

const SLICE = 32 * 1024 * 1024;
const MANAGED = Object.values(DEPS).filter((d) => d && d.filename).map(wrapperDepPath).find((p) => p.type === 'loras').filename;

// ── stub wrapper ────────────────────────────────────────────────────────────
const wrapper = { posts: [], deletes: [], hold: null, remote: [] };
const stubApp = express();
stubApp.post('/wrapper/upload/chunk', express.raw({ type: '*/*', limit: '64mb' }), async (req, res) => {
    const q = req.query;
    wrapper.posts.push({ filename: q.filename, offset: Number(q.offset), len: req.body.length });
    if (wrapper.hold && q.filename === wrapper.hold.filename && Number(q.offset) > 0) await wrapper.hold.until;
    const end = Number(q.offset) + req.body.length;
    if (end < Number(q.total)) return res.json({ received: end, done: false });
    res.json({ name: q.filename, type: q.type, path: `/v/${q.filename}`, bytes: end, done: true });
});
stubApp.get('/wrapper/models/list', (req, res) => res.json({ success: true, type: req.query.type, files: wrapper.remote }));
stubApp.post('/wrapper/models/delete', express.json(), (req, res) => {
    wrapper.deletes.push(req.body);
    res.json({ status: 'deleted', id: req.body.id });
});

// ── the app under test ──────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(uploadsRouter);
app.use(forwardRouter);
let appBase = '';
const call = async (method, url, body) => {
    const res = await fetch(appBase + url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json() };
};
const settled = async () => {
    for (let i = 0; i < 200; i++) {
        const { json } = await call('GET', '/remote/uploads');
        if (!json.jobs.some((j) => j.status === 'queued' || j.status === 'uploading')) return json.jobs;
        await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('uploads never settled');
};

const ROOT = process.env.CUBRIC_MODELS_ROOT;
const put = (rel, size) => {
    const p = path.join(ROOT, 'loras', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.alloc(size, 7));
    return p;
};

const s1 = stubApp.listen(0);
const s2 = app.listen(0);
test.before(async () => {
    await Promise.all([new Promise((r) => s1.once('listening', r)), new Promise((r) => s2.once('listening', r))]);
    wrapperBase = `http://127.0.0.1:${s1.address().port}`;
    appBase = `http://127.0.0.1:${s2.address().port}`;
    setRemoteMode({ active: true, podId: 'pod-u1', noGpu: true });
});
test.after(() => { s1.close(); s2.close(); fs.rmSync(ROOT, { recursive: true, force: true }); });

test('lists local files with sizes and the Pod bucket, app-installed weights marked', async () => {
    put('sub/mine.safetensors', 11);
    put('notes.txt', 3);
    wrapper.remote = [
        { rel: MANAGED, size_bytes: 5, partial: false },
        { rel: 'half.safetensors', size_bytes: 9, partial: true },
    ];
    const { status, json } = await call('GET', '/remote/user-models?type=loras');
    assert.equal(status, 200);
    assert.deepEqual(json.local, [{ rel: 'sub/mine.safetensors', sizeBytes: 11 }], 'model files only, forward slashes');
    assert.deepEqual(json.remote, [
        { rel: MANAGED, sizeBytes: 5, partial: false, managed: true },
        { rel: 'half.safetensors', sizeBytes: 9, partial: true },
    ]);
    assert.equal((await call('GET', '/remote/user-models?type=checkpoints')).status, 400, 'user buckets only');
});

test('uploads run one at a time, report progress per slice, skip what the Pod has', async () => {
    events.length = 0;
    wrapper.posts.length = 0;
    put('a.safetensors', 2 * SLICE + 5);
    put('b.safetensors', 4);
    put('onpod.safetensors', 4);
    wrapper.remote = [{ rel: 'onpod.safetensors', size_bytes: 4, partial: false }];
    free = { freeBytes: 1e12, totalBytes: 1e12 };

    const { status, json } = await call('POST', '/remote/uploads', {
        type: 'loras', files: ['a.safetensors', 'sub\\b.safetensors', 'onpod.safetensors', 'nope.safetensors'],
    });
    assert.equal(status, 200);
    assert.deepEqual(json.jobs.map((j) => j.filename), ['a.safetensors', 'b.safetensors']);
    assert.deepEqual(json.skipped, [
        { rel: 'onpod.safetensors', reason: 'already_on_pod' },
        { rel: 'nope.safetensors', reason: 'not_found' },
    ]);

    const jobs = await settled();
    assert.deepEqual(jobs.map((j) => j.status), ['complete', 'complete']);
    assert.deepEqual(wrapper.posts.map((p) => p.filename),
        ['a.safetensors', 'a.safetensors', 'a.safetensors', 'b.safetensors'], 'b waits for a');
    const aId = json.jobs[0].id;
    assert.deepEqual(events.filter((e) => e.event === 'upload:progress' && e.data.id === aId).map((e) => e.data.sentBytes),
        [SLICE, 2 * SLICE, 2 * SLICE + 5]);
    const last = events.filter((e) => e.event === 'upload:snapshot').pop();
    assert.deepEqual(last.data.jobs.map((j) => j.status), ['complete', 'complete']);

    const again = await call('POST', '/remote/uploads', { type: 'loras', files: ['b.safetensors'] });
    assert.equal(again.json.jobs.length, 1, 'a finished upload is not "already queued"');
    await settled();
});

test('the free-space gate refuses a batch the volume cannot hold', async () => {
    put('c.safetensors', 1000);
    wrapper.remote = [];
    free = { freeBytes: 1000, totalBytes: 100e9 };  // 1000 < 1050 with the 5% margin
    const { status, json } = await call('POST', '/remote/uploads', { type: 'loras', files: ['c.safetensors'] });
    assert.equal(status, 400);
    assert.equal(json.error, 'volume_full');
    assert.match(json.message, /free of 100\.0 GB/);
    free = null;  // unknown free space never blocks
});

test('cancel stops a running upload and removes its .part; a queued one never starts', async () => {
    put('big.safetensors', SLICE + 10);
    put('next.safetensors', 3);
    wrapper.remote = [];
    wrapper.posts.length = 0;
    wrapper.deletes.length = 0;
    let release;
    wrapper.hold = { filename: 'big.safetensors', until: new Promise((r) => { release = r; }) };
    const { json } = await call('POST', '/remote/uploads', { type: 'loras', files: ['big.safetensors', 'next.safetensors'] });
    const [big, next] = json.jobs;
    while (!wrapper.posts.some((p) => p.offset > 0)) await new Promise((r) => setTimeout(r, 10));

    assert.equal((await call('POST', `/remote/uploads/${next.id}/cancel`)).json.job.status, 'cancelled');
    const res = await call('POST', `/remote/uploads/${big.id}/cancel`);
    assert.equal(res.json.job.status, 'cancelled', 'answers once the upload has settled');
    release();
    assert.deepEqual(wrapper.deletes.map((d) => [d.type, d.filename]), [['loras', 'big.safetensors']]);
    await settled();
    assert.ok(!wrapper.posts.some((p) => p.filename === 'next.safetensors'), 'the cancelled queued job never sent a byte');
    wrapper.hold = null;
});

test('delete removes a user file from the volume and refuses an app-installed one', async () => {
    wrapper.deletes.length = 0;
    const ok = await call('POST', '/remote/user-models/delete', { type: 'loras', filename: 'old/stray.safetensors' });
    assert.equal(ok.status, 200);
    assert.deepEqual(wrapper.deletes.map((d) => [d.type, d.filename]), [['loras', 'old/stray.safetensors']]);
    const managed = await call('POST', '/remote/user-models/delete', { type: 'loras', filename: MANAGED });
    assert.equal(managed.status, 409);
    assert.equal(managed.json.error, 'managed_by_app');
    assert.equal(wrapper.deletes.length, 1);
});

test('a generate-time upload over 1 GB is refused on a GPU Pod, not on the CPU Pod', async () => {
    const big = put('huge.safetensors', 8);
    const stat = fs.promises.stat;
    fs.promises.stat = async (p, ...rest) => {
        const s = await stat(p, ...rest);
        return p === big ? Object.assign(s, { size: 2e9 }) : s;
    };
    try {
        setRemoteMode({ active: true, noGpu: false });
        const gpu = await call('POST', '/remote/upload/model', { type: 'loras', filename: 'huge.safetensors' });
        assert.equal(gpu.status, 409);
        assert.equal(gpu.json.error, 'too_big_for_gpu');
        assert.match(gpu.json.message, /"huge\.safetensors" is 2\.0 GB/);
        const small = await call('POST', '/remote/upload/model', { type: 'loras', filename: 'b.safetensors' });
        assert.equal(small.status, 200, 'small LoRAs still go up at generate time');
        setRemoteMode({ active: true, noGpu: true });
        const cpu = await call('POST', '/remote/upload/model', { type: 'loras', filename: 'huge.safetensors' });
        assert.notEqual(cpu.json.error, 'too_big_for_gpu');
    } finally {
        fs.promises.stat = stat;
        setRemoteMode({ active: true, noGpu: true });
    }
});

test('a generate-time upload is a Transfers job, and its Cancel stops the generation quietly', async () => {
    put('sub/gen.safetensors', SLICE + 10);
    wrapper.posts.length = 0;
    events.length = 0;
    setRemoteMode({ active: true, noGpu: false });
    try {
        const ok = await call('POST', '/remote/upload/model', { type: 'loras', filename: 'sub/gen.safetensors' });
        assert.equal(ok.status, 200);
        const seen = events.filter((e) => e.event === 'upload:snapshot').flatMap((e) => e.data.jobs).filter((j) => j.filename === 'gen.safetensors');
        assert.deepEqual([...new Set(seen.map((j) => j.status))], ['queued', 'uploading', 'complete'], 'shown in Transfers like an overlay upload');

        put('gen2.safetensors', SLICE + 10);
        let release;
        wrapper.hold = { filename: 'gen2.safetensors', until: new Promise((r) => { release = r; }) };
        const pending = call('POST', '/remote/upload/model', { type: 'loras', filename: 'gen2.safetensors' });
        while (!wrapper.posts.some((p) => p.filename === 'gen2.safetensors' && p.offset > 0)) await new Promise((r) => setTimeout(r, 10));
        const { json } = await call('GET', '/remote/uploads');
        const row = json.jobs.find((j) => j.filename === 'gen2.safetensors' && j.status === 'uploading');
        await call('POST', `/remote/uploads/${row.id}/cancel`);
        release();
        const res = await pending;
        assert.equal(res.status, 409);
        assert.equal(res.json.error, 'upload_cancelled');
    } finally {
        wrapper.hold = null;
        setRemoteMode({ active: true, noGpu: true });
    }
});
