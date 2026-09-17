'use strict';

/**
 * MPI-800 — media staging into the engine input/ folder.
 *
 * MpiNodes 1.2.13+ loads a path only when it resolves inside ComfyUI's input/, output/
 * or temp/, and the app's media lives in project folders. `stageMediaFile` puts each
 * injected file into `<input>/mpi_staged/` (hardlink, copy when a link is impossible)
 * and `POST /comfy/stage-media` hands the staged path back to the renderer.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Resolved once at module load, so point them at scratch BEFORE requiring the router
// (same redirect as tests/engine-import-failure.test.cjs).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi800-'));
process.env.APP_USER_DATA = TMP;
process.env.CUBRIC_ENGINE_ROOT = TMP;

const fsx = require('fs-extra');
const comfyRouter = require('../routes/comfy');
const { getComfyPath } = require('../routes/platformEngine');

const { stageMediaFile } = comfyRouter;
const INPUT = path.join(TMP, 'input');
const PROJECT = path.join(TMP, 'Projects', 'demo', 'Media');
fs.mkdirSync(PROJECT, { recursive: true });

function source(name, body) {
    const p = path.join(PROJECT, name);
    fs.writeFileSync(p, body);
    return p;
}

test('a project file is hardlinked into input/mpi_staged and reused', async () => {
    const src = source('t2i_001.PNG', 'pixels');
    const staged = await stageMediaFile(src, INPUT);

    assert.equal(path.dirname(staged), path.join(INPUT, 'mpi_staged'));
    assert.match(path.basename(staged), /^[0-9a-f]{16}\.png$/, 'hashed name, lower-case extension');
    assert.equal(fs.statSync(staged).ino, fs.statSync(src).ino, 'same file on disk — a link, not a copy');

    assert.equal(await stageMediaFile(src, INPUT), staged, 'a re-run reuses the staged file');
    assert.equal(fs.readdirSync(path.join(INPUT, 'mpi_staged')).length, 1);
});

test('an edited source gets a new staged name', async () => {
    const src = source('t2i_002.png', 'v1');
    const first = await stageMediaFile(src, INPUT);
    const later = new Date(Date.now() + 5000);
    fs.writeFileSync(src, 'v2 longer');
    fs.utimesSync(src, later, later);
    const second = await stageMediaFile(src, INPUT);
    assert.notEqual(second, first);
    assert.equal(fs.readFileSync(second, 'utf8'), 'v2 longer');
});

test('a file that cannot be linked (another volume) is copied whole', async () => {
    const src = source('clip.mp4', 'frames');
    const realLink = fsx.link;
    fsx.link = async () => { throw Object.assign(new Error('cross-device link'), { code: 'EXDEV' }); };
    try {
        const staged = await stageMediaFile(src, INPUT);
        assert.equal(fs.readFileSync(staged, 'utf8'), 'frames');
        assert.notEqual(fs.statSync(staged).ino, fs.statSync(src).ino, 'a copy, not a link');
        assert.deepEqual(fs.readdirSync(path.dirname(staged)).filter((f) => f.endsWith('.part')), [],
            'no half-written file left behind');
    } finally {
        fsx.link = realLink;
    }
});

test('a path already inside input/ is injected as-is', async () => {
    fs.mkdirSync(path.join(INPUT, 'mpi_staged'), { recursive: true });
    const inside = path.join(INPUT, 'mpi_staged', 'mpi_staged_abc.png');
    fs.writeFileSync(inside, 'mask');
    assert.equal(await stageMediaFile(inside, INPUT), inside);
});

test('a missing source is ENOENT, not a staged file', async () => {
    await assert.rejects(stageMediaFile(path.join(PROJECT, 'gone.png'), INPUT), { code: 'ENOENT' });
});

test('POST /comfy/stage-media answers with the staged path, 404 and 400', async () => {
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use(comfyRouter);
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (route, body) => fetch(base + route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    try {
        const engineInput = getComfyPath(TMP, 'input');
        const src = source('route.webp', 'img');

        const ok = await post('/comfy/stage-media', { path: src });
        const okBody = await ok.json();
        assert.equal(ok.status, 200);
        assert.equal(path.dirname(okBody.path), path.join(engineInput, 'mpi_staged'),
            'staged under the ENGINE input/ folder');
        assert.ok(fs.existsSync(okBody.path));

        const missing = await post('/comfy/stage-media', { path: path.join(PROJECT, 'nope.png') });
        assert.equal(missing.status, 404);

        const relative = await post('/comfy/stage-media', { path: 'Media/t2i_001.png' });
        assert.equal(relative.status, 400);

        const dataUrl = await post('/comfy/stage-media-data-url',
            { dataUrl: `data:image/png;base64,${Buffer.from('mask').toString('base64')}` });
        const dataBody = await dataUrl.json();
        assert.equal(path.dirname(dataBody.path), path.join(engineInput, 'mpi_staged'),
            'painted masks are staged beside the files, so the start-up sweep clears both');
    } finally {
        server.close();
    }
});

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
