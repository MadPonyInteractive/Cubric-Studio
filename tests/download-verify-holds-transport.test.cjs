'use strict';

// MPI-1121 — a local dep stays transport-live through its sha256 verify.
//
// The downloader's 'end' handler drops the dep from _activeDownloaders before it hashes
// the file. The reconciler skips only deps the transport holds, so in that window it saw
// all bytes in, settled the dep complete, and the model announced "installed" while the
// `.cubricdl` marker was still on disk. Live 2026-10-13: ILL Anime toasted 21 s before its
// resumed 6.9 GB re-hash finished, the client's one re-sync read it NOT installed, and it
// stayed missing from the picker until the Model Library re-synced.
//
// This drives the REAL FileDownloader against a local server and reads
// _isDepTransportLive at the moment the marker is cleared, i.e. after the verify passed
// and before the dep's status settles: the last instant of the window.
// Run: node tests/download-verify-holds-transport.test.cjs

const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const fs = require('fs-extra');

const dm = require('../routes/downloadManager.js');
const { FileDownloader, _isDepTransportLive } = dm;

const BODY = crypto.randomBytes(64 * 1024);
const BODY_SHA = crypto.createHash('sha256').update(BODY).digest('hex');

function storeDep({ id, modelId, ...transport }) {
    const store = dm._installStore;
    store.registerModelJob({ modelId, engine: 'local', deps: [{ depId: id, type: 'checkpoints', transport }] });
    store.transitionModel(modelId, 'downloading', 'test');
    store.transitionDep(id, 'downloading', 'test');
    return store.depJob(id);
}

function startServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(BODY.length) });
        res.end(req.method === 'HEAD' ? undefined : BODY);
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Record _isDepTransportLive(depId) every time a `.cubricdl` marker is removed.
function watchMarkerClear(depId) {
    const seen = [];
    const realRemove = fs.remove;
    fs.remove = function (p, ...rest) {
        if (String(p).endsWith('.cubricdl')) seen.push(_isDepTransportLive(depId));
        return realRemove.call(this, p, ...rest);
    };
    return { seen, restore: () => { fs.remove = realRemove; } };
}

async function run({ id, sha }) {
    const server = await startServer();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi-1121-'));
    const localPath = path.join(dir, `${id}.safetensors`);
    const depJob = storeDep({
        id,
        modelId: `${id}-model`,
        url: `http://127.0.0.1:${server.address().port}/w.bin`,
        localPath,
        sha256Expected: sha,
        status: 'downloading',
        downloadedBytes: 0,
        totalBytes: 0,
    });
    const watch = watchMarkerClear(id);
    try {
        await new FileDownloader(depJob, localPath).download();
        const deadline = Date.now() + 15_000;
        while (depJob.status === 'downloading' && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 50));
        }
    } finally {
        watch.restore();
        server.close();
        await fs.remove(dir);
    }
    return { depJob, seen: watch.seen };
}

async function main() {
    {
        const { depJob, seen } = await run({ id: 'mpi1121-pass', sha: BODY_SHA });
        assert.equal(depJob.status, 'complete', `dep ended ${depJob.status}: ${depJob.error || ''}`);
        assert.ok(seen.length > 0, 'the marker was never cleared');
        assert.equal(seen[0], true,
            'verify passed but the dep read NOT transport-live: the reconciler can settle it early');
        assert.equal(_isDepTransportLive('mpi1121-pass'), false, 'still held after it completed');
        console.log('  ok  a verified dep is held until its status settles, then released');
    }
    {
        const { depJob } = await run({ id: 'mpi1121-mismatch', sha: '0'.repeat(64) });
        assert.equal(depJob.status, 'failed', `dep ended ${depJob.status}`);
        assert.equal(_isDepTransportLive('mpi1121-mismatch'), false, 'a failed verify leaked the hold');
        console.log('  ok  a failed verify releases the hold');
    }
    console.log('\n2 passed');
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
