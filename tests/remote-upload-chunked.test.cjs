'use strict';

// MPI-1057 — a user LoRA over 2 GiB could not reach a Pod: the upload read the whole file
// into one Buffer ("File size (10268001040) is greater than 2 GiB", Fabio's 10.27 GB
// sulphur LoRA), and one multi-GB request would also outlive RunPod's ~100 s proxy cut.
// Uploads now go up in 32 MiB slices to /wrapper/upload/chunk. This drives the REAL
// uploaders against a stub wrapper on localhost: slices in order, none over the cap, a
// failed slice retried alone, bytes identical on arrival. The wrapper half is pinned by
// mpi-ci/cubric-vision-pod/wrapper/test_upload_chunk.py.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

process.env.CUBRIC_MODELS_ROOT = path.join(os.tmpdir(), 'mpi1057-' + process.pid);
require('./helpers/sandbox-roots.cjs');

// remoteModels destructures these at load, so patch them before it is required.
const remoteEngine = require('../routes/remoteEngine');
let base = '';
remoteEngine.proxyUrl = () => base;
remoteEngine.getWrapperToken = async () => 'tok';
const { setRemoteMode } = require('../routes/remotePodState');
const remoteModels = require('../routes/remoteModels');

const SLICE = 32 * 1024 * 1024;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

test('a file larger than one slice goes up in order, retries a failed slice alone, lands intact', async (t) => {
    const posts = [];
    const files = new Map();
    let failOnce = true;
    const app = express();
    app.post('/wrapper/upload/chunk', express.raw({ type: '*/*', limit: '64mb' }), (req, res) => {
        const q = req.query;
        const offset = Number(q.offset);
        const total = Number(q.total);
        posts.push({ ...q, len: req.body.length, auth: req.headers.authorization });
        if (offset > 0 && failOnce) { failOnce = false; return res.status(502).send('bad gateway'); }
        const key = `${q.kind}/${q.type || ''}/${q.filename}`;
        const have = files.get(key) || Buffer.alloc(0);
        if (offset > have.length) return res.status(409).json({ error: 'offset_gap' });
        const next = Buffer.concat([have.subarray(0, offset), req.body]);
        files.set(key, next);
        if (next.length < total) return res.json({ received: next.length, done: false });
        res.json({ name: q.filename, type: q.kind === 'model' ? q.type : 'input', path: `/v/${key}`, bytes: total, done: true });
    });
    const server = app.listen(0);
    t.after(() => server.close());
    base = `http://127.0.0.1:${server.address().port}`;
    setRemoteMode({ active: true, podId: 'pod-1057' });

    // Two full slices + a 5-byte tail; each MiB carries its own byte so order matters.
    const total = 2 * SLICE + 5;
    const data = Buffer.alloc(total);
    for (let i = 0; i < total; i += 1024 * 1024) data.fill(i / (1024 * 1024), i, Math.min(i + 1024 * 1024, total));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1057-up-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const local = path.join(dir, 'big.safetensors');
    fs.writeFileSync(local, data);

    const out = await remoteModels.remoteUploadModel(local, 'loras', 'sub\\big.safetensors');
    assert.equal(out.done, true);
    assert.equal(out.type, 'loras');
    assert.equal(sha(files.get('model/loras/big.safetensors')), sha(data), 'bytes arrive identical');
    assert.ok(posts.every(p => p.len <= SLICE), 'no request carries more than one slice');
    assert.ok(posts.every(p => p.auth === 'Bearer tok'), 'every slice is authed');
    assert.deepEqual(posts.map(p => p.offset), ['0', String(SLICE), String(SLICE), String(2 * SLICE)],
        'the failed slice is resent at its own offset, not from zero');
    assert.ok(posts.every(p => p.filename === 'big.safetensors' && p.total === String(total)));

    // Inputs (video/audio, .latent) share the path, under a bare basename.
    const clip = path.join(dir, 'clip.mp4');
    fs.writeFileSync(clip, 'vid');
    const inp = await remoteModels.remoteUploadInput(clip, 'clip.mp4');
    assert.equal(inp.type, 'input');
    assert.equal(files.get('input//clip.mp4').toString(), 'vid');
});
