'use strict';
/**
 * tests/scene-convert.test.cjs — MPI-623 (A9). `POST /project-media/:id/scene` stores a
 * `sceneConvert` result as the item's scene: both files fetched over /view (a fake engine
 * here), the manifest naming them by suffix, `scenePath` on the sidecar LAST. The item is the
 * NEW card the queued run landed (`convertToPano`), never the source picture.
 *
 * Run: node --test tests/scene-convert.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const H = 8;
const DEPTH = new Float32Array(2 * H * H).map((_, i) => 1 + (i % 7));
DEPTH[5] = 20;  // the sky dome: twice the farthest real depth, as MpiPanoDepth writes it

function listen(app) {
    return new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
}

async function fixture() {
    const engine = express();
    engine.get('/view', (req, res) => {
        if (req.query.filename === 'pano.png') return res.send(PNG);
        if (req.query.filename === 'depth.f32') return res.send(Buffer.from(DEPTH.buffer));
        if (req.query.filename === 'odd.f32') return res.send(Buffer.alloc(12));
        res.status(404).end();
    });
    const app = express();
    app.use(express.json());
    app.use(require('../routes/projects.js'));
    const [es, as] = [await listen(engine), await listen(app)];
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'mpi623-scene-'));
    const metaDir = path.join(folder, 'Media', '.meta');
    await fs.outputJson(path.join(metaDir, 'item1.json'), { id: 'item1', filePath: 'x.png' });
    const view = (f) => `http://127.0.0.1:${es.address().port}/view?filename=${f}&type=output&subfolder=scenes`;
    const post = (body) => fetch(`http://127.0.0.1:${as.address().port}/project-media/p1/scene?folderPath=${encodeURIComponent(folder)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const close = async () => { es.close(); as.close(); await fs.remove(folder); };
    return { metaDir, view, post, close };
}

test('a converted pano lands as manifest + suffix-named siblings, scenePath last', async () => {
    const f = await fixture();
    try {
        const res = await f.post({ itemId: 'item1', imageUrl: f.view('pano.png'), depthUrl: f.view('depth.f32') });
        const data = await res.json();
        assert.equal(res.status, 200, JSON.stringify(data));
        const manifest = await fs.readJson(path.join(f.metaDir, 'item1.scene.json'));
        assert.deepEqual(manifest, { version: 1, pano: { image: 'pano.png', depth: 'pano_depth.f32', w: 2 * H, h: H, sky: 20 }, layers: [] });
        assert.deepEqual(await fs.readFile(path.join(f.metaDir, 'item1.scene.pano.png')), PNG);
        assert.equal((await fs.stat(path.join(f.metaDir, 'item1.scene.pano_depth.f32'))).size, DEPTH.byteLength);
        const sidecar = await fs.readJson(path.join(f.metaDir, 'item1.json'));
        assert.equal(sidecar.scenePath, data.scenePath);
        assert.equal(decodeURIComponent(data.scenePath.split('path=')[1]), path.join(f.metaDir, 'item1.scene.json'));
        // Every file the set owns rides the companion convention (delete, sweep, copy).
        const { DERIVATIVE_RE } = require('../routes/projects.js');
        for (const name of await fs.readdir(f.metaDir)) {
            if (name !== 'item1.json') assert.equal(DERIVATIVE_RE.exec(name)?.[1], 'item1', name);
        }
    } finally { await f.close(); }
});

test('a failed save leaves a plain image card: no scenePath, no stray companions', async () => {
    const f = await fixture();
    try {
        const res = await f.post({ itemId: 'item1', imageUrl: f.view('pano.png'), depthUrl: f.view('odd.f32') });
        assert.equal(res.status, 500);
        assert.match((await res.json()).error, /not a 2:1 float32 grid/);
        assert.deepEqual(await fs.readdir(f.metaDir), ['item1.json']);
        assert.equal((await fs.readJson(path.join(f.metaDir, 'item1.json'))).scenePath, undefined);
    } finally { await f.close(); }
});

test('an unknown or unsafe item id never mints a sidecar', async () => {
    const f = await fixture();
    try {
        for (const itemId of ['nope', '../item1']) {
            const res = await f.post({ itemId, imageUrl: f.view('pano.png'), depthUrl: f.view('depth.f32') });
            assert.equal(res.status, 404, itemId);
        }
        assert.deepEqual(await fs.readdir(f.metaDir), ['item1.json']);
    } finally { await f.close(); }
});

// MoGe belongs to the 3D Scene plugin (not an engineAsset): an unrelated uninstall
// must not reclaim it, and the plugin's own uninstall must.
test('the scene-convert plugin owns moge-vitl, ships in a release build (2.1), and the GC guards see it', async () => {
    const { pathToFileURL } = require('node:url');
    const reg = await import(pathToFileURL(path.resolve('js/data/pluginsRegistry.js')).href);
    const plugin = reg.getPlugin('scene-convert');
    assert.deepEqual(plugin.requiredDeps, ['moge-vitl']);
    for (const id of ['scene-convert', 'scene-path']) assert.ok(!reg.getPlugin(id).devOnly, `${id} is listed in a release build`);
    const dm = require('../routes/downloadManager.js');
    assert.ok(dm._pluginRequiredDepIds('krea2').has('moge-vitl'));
    assert.ok(!dm._pluginRequiredDepIds(reg.pluginDepKey('scene-convert')).has('moge-vitl'));
});

// Fabio 2026-10-12: Convert makes a NEW card (the source stays an editable picture) and runs
// as a normal queued generation, so it shows in the queue and the status bar.
test('convertToPano queues sceneConvert and stores the scene on the LANDED card, not the source', async () => {
    const { pathToFileURL } = require('node:url');
    const { convertToPano } = await import(pathToFileURL(path.resolve('js/services/scene/sceneConvert.js')).href);
    const source = { id: 'src1', filePath: '/project-file?path=pano.png' };
    const landed = { item: { id: 'new1' }, group: { id: 'g-new' } };
    const posts = [];
    const realFetch = global.fetch;
    global.fetch = async (url, init) => { posts.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ success: true, scenePath: 'SP' }) }; };
    try {
        let config;
        const out = await convertToPano({ id: 'p1', folderPath: 'C:/x' }, source, (c, cb) => {
            config = c;
            cb.onComplete({ ...landed, outputUrls: ['/view?tex'], depthUrl: '/view?depth' });
            return true;
        });
        assert.equal(config.operation, 'sceneConvert');
        assert.deepEqual(config.mediaItems.map(m => [m.url, m.role]), [[source.filePath, 'inputImage']]);
        assert.equal(posts.length, 1);
        assert.match(posts[0].url, /^\/project-media\/p1\/scene\?/);
        assert.deepEqual(posts[0].body, { itemId: 'new1', imageUrl: '/view?tex', depthUrl: '/view?depth' });
        assert.equal(out.item.scenePath, 'SP');
        assert.equal(source.scenePath, undefined, 'the source card is never touched');

        posts.length = 0;
        await assert.rejects(convertToPano({ id: 'p1', folderPath: 'C:/x' }, source, (c, cb) => { cb.onCancel(); return true; }),
            (err) => err.cancelled === true);
        await assert.rejects(convertToPano({ id: 'p1', folderPath: 'C:/x' }, source, (c, cb) => { cb.onComplete({ ...landed, outputUrls: ['/view?tex'] }); return true; }),
            /without its picture or depth/);
        await assert.rejects(convertToPano({ id: 'p1', folderPath: 'C:/x' }, source, () => null), /did not start/);
        assert.equal(posts.length, 0, 'no scene save after a cancel, a missing depth or a refused enqueue');
    } finally { global.fetch = realFetch; }
});

// Fabio 2026-10-12: a 4K pano skips the upscale, so the run is MoGe alone; the bar sat on
// "Starting 0%" for the whole run. The depth node pulses and switches the bar to the label.
test('the depth node pulses the status bar under "Converting"', async () => {
    const { pathToFileURL } = require('node:url');
    const { buildWeightMap } = await import(pathToFileURL(path.resolve('js/services/progressAggregator.js')).href);
    const g = JSON.parse(fs.readFileSync(path.resolve('comfy_workflows/scene_convert.json'), 'utf8'));
    const depthId = Object.keys(g).find(id => g[id].class_type === 'MpiPanoDepth');
    assert.equal(buildWeightMap(g).nodes[depthId].kind, 'singleShot');
    const exec = fs.readFileSync(path.resolve('js/services/commandExecutor.js'), 'utf8');
    assert.match(exec, /PULSE_KINDS = new Set\(\['imageUpscale', 'singleShot'\]\)/);
    assert.match(exec, /IMMEDIATE_WORK_KINDS = new Set\(\[[^\]]*'singleShot'/);
    assert.match(exec, /const indeterminate = PULSE_KINDS\.has\(nodeKind\);[\s\S]{0,300}if \(indeterminate\) _beginSampling\(\);/);
    const { COMMANDS } = await import(pathToFileURL(path.resolve('js/data/commandRegistry.js')).href);
    assert.equal(COMMANDS.sceneConvert.progressLabel, 'Converting');
});

test('the queue hands Output_Depth through to the caller', () => {
    const exec = fs.readFileSync(path.resolve('js/services/commandExecutor.js'), 'utf8');
    const gen = fs.readFileSync(path.resolve('js/services/generationService.js'), 'utf8');
    assert.match(exec, /=== 'output_depth'/);
    assert.match(exec, /depthUrl: depthOutputUrl/);
    assert.match(gen, /outputUrls: urls, depthUrl: outputInfo\.depthUrl \|\| null/);
});
