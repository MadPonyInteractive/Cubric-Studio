'use strict';
/**
 * tests/scene-layer.test.cjs — MPI-623 (Take picture). `POST /project-media/:id/scene-layer`
 * appends a fill as a pinhole record to the item's scene: the fill copied from the project, the
 * lifted depth fetched over /view (a fake engine here), siblings by suffix, the manifest LAST.
 * Wrong here, a picture's fill never reaches the viewer, or a failed one leaves a manifest
 * naming files that do not exist.
 *
 * Run: node --test tests/scene-layer.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const W = 4, H = 3;
const DEPTH = new Float32Array(W * H).fill(2);
const CAMERA = { w: W, h: H, w2c: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], fx: 3, fy: 3, cx: 2, cy: 1.5 };
const PANO = { image: 'pano.png', depth: 'pano_depth.f32', w: 16, h: 8, sky: 20 };

function listen(app) {
    return new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
}

async function fixture() {
    const engine = express();
    engine.get('/view', (req, res) => {
        if (req.query.filename === 'lift.f32') return res.send(Buffer.from(DEPTH.buffer));
        if (req.query.filename === 'odd.f32') return res.send(Buffer.alloc(12));
        res.status(404).end();
    });
    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    const [es, as] = [await listen(engine), await listen(app)];
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi623-layer-'));
    const metaDir = path.join(folder, 'Media', '.meta');
    await fs.outputJson(path.join(metaDir, 'item1.json'), { id: 'item1', filePath: 'x.png' });
    await fs.outputJson(path.join(metaDir, 'item1.scene.json'), { version: 1, pano: PANO, layers: [] });
    const fill = path.join(folder, 'Media', '.preview-assets', 'fill.png');
    await fs.outputFile(fill, PNG);
    const view = (f) => `http://127.0.0.1:${es.address().port}/view?filename=${f}&type=output&subfolder=scenes`;
    const post = (body) => fetch(`http://127.0.0.1:${as.address().port}/project-media/p1/scene-layer?folderPath=${encodeURIComponent(folder)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const close = async () => { es.close(); as.close(); await fs.remove(folder); };
    return { folder, metaDir, fill, view, post, close };
}

test('two pictures append two numbered layers, the pano untouched', async () => {
    const f = await fixture();
    try {
        for (const n of [0, 1]) {
            const res = await f.post({ itemId: 'item1', imagePath: f.fill, depthUrl: f.view('lift.f32'), camera: CAMERA });
            const data = await res.json();
            assert.equal(res.status, 200, JSON.stringify(data));
            assert.equal(data.index, n);
            assert.deepEqual(data.record, { image: `layer${n}.png`, depth: `layer${n}_depth.f32`, ...CAMERA });
        }
        const manifest = await fs.readJson(path.join(f.metaDir, 'item1.scene.json'));
        assert.deepEqual(manifest.pano, PANO);
        assert.deepEqual(manifest.layers.map(l => l.image), ['layer0.png', 'layer1.png']);
        assert.deepEqual(await fs.readFile(path.join(f.metaDir, 'item1.scene.layer1.png')), PNG);
        assert.equal((await fs.stat(path.join(f.metaDir, 'item1.scene.layer1_depth.f32'))).size, DEPTH.byteLength);
        const { DERIVATIVE_RE } = require('../routes/projects.js');
        for (const name of await fs.readdir(f.metaDir)) {
            if (name !== 'item1.json') assert.equal(DERIVATIVE_RE.exec(name)?.[1], 'item1', name);
        }
    } finally { await f.close(); }
});

test('a depth of the wrong size leaves the manifest and the folder as they were', async () => {
    const f = await fixture();
    try {
        const res = await f.post({ itemId: 'item1', imagePath: f.fill, depthUrl: f.view('odd.f32'), camera: CAMERA });
        assert.equal(res.status, 500);
        assert.match((await res.json()).error, /not 4x3 float32/);
        assert.deepEqual((await fs.readJson(path.join(f.metaDir, 'item1.scene.json'))).layers, []);
        assert.deepEqual((await fs.readdir(f.metaDir)).sort(), ['item1.json', 'item1.scene.json']);
    } finally { await f.close(); }
});

test('no scene, an unsafe id, a fill outside the project or a bad camera is refused', async () => {
    const f = await fixture();
    try {
        const ok = { itemId: 'item1', imagePath: f.fill, depthUrl: f.view('lift.f32'), camera: CAMERA };
        const outside = path.join(os.tmpdir(), 'not-this-project.png');
        for (const [body, status] of [
            [{ ...ok, itemId: 'nope' }, 404],
            [{ ...ok, itemId: '../item1' }, 404],
            [{ ...ok, imagePath: outside }, 400],
            [{ ...ok, camera: { ...CAMERA, w2c: CAMERA.w2c.slice(1) } }, 400],
            [{ ...ok, camera: { ...CAMERA, fx: null } }, 400],
        ]) {
            const res = await f.post(body);
            assert.equal(res.status, status, JSON.stringify(body));
        }
        assert.deepEqual((await fs.readJson(path.join(f.metaDir, 'item1.scene.json'))).layers, []);
    } finally { await f.close(); }
});
