'use strict';

// MPI-623 — Take picture's sequencer (js/services/scene/scenePicture.js, plan A5): ONE press,
// the jobs in order, every Klein job with `deferCommit` (none may land a card of its own), the
// lift fed the render's known depth, the fill saved as a layer and meshed live, ONE history
// entry at the end carrying the pose. Wrong here, a picture lands as stray gallery cards, its
// fill never joins the scene, or a failed fill still saves half a picture.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);
const pf = (p) => `/project-file?path=${encodeURIComponent(p)}`;

const PROJECT = { id: 'p1', folderPath: 'C:/P' };
const GROUP = { id: 'g1', history: [] };
const SCENE_ITEM = { id: 'pano1', scenePath: pf('C:/P/Media/.meta/pano1.scene.json') };
const POSE = { pos: [0.1, 0.2, 0.3], yaw: 0.5, pitch: -0.1, roll: 0.05, mm: 24 };
const RECORD = { w: 4, h: 2, w2c: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], fx: 2.6, fy: 2.6, cx: 2, cy: 1 };

function harness({ holeFrac = 0.25, backFrac = 0, failInpaint = false } = {}) {
    const log = [], calls = { enqueue: [], lift: [], post: [], layers: [], saved: [] };
    const w = 4, h = 2;
    const io = {
        klein: { id: 'klein-9b' },
        render: (view, renderer, pose, size) => {
            log.push(`render ${size.w}x${size.h}`);
            return { w, h, rgba: new Uint8ClampedArray(w * h * 4), mask: new Uint8ClampedArray(w * h * 4),
                z: new Float32Array(w * h).fill(2), holeFrac, backFrac, record: RECORD };
        },
        encodePng: async () => new Blob(['png']),
        blobToDataUrl: async () => 'data:x;base64,AA==',
        resolveMediaUrl: (u) => u,
        post: async (url, body) => {
            calls.post.push({ url, body });
            if (url.includes('place-preview-asset')) {
                const p = `C:/P/Media/.preview-assets/asset${calls.post.length}${body.ext}`;
                return { filePath: pf(p), absPath: p };
            }
            if (url.includes('scene-layer')) return { record: { image: 'layer0.png', depth: 'layer0_depth.f32', ...body.camera } };
            throw new Error(`unexpected POST ${url}`);
        },
        enqueue: (config, cb, opts) => {
            calls.enqueue.push({ config, opts });
            log.push(config.operation);
            setImmediate(() => (failInpaint && config.operation === 'inpaint'
                ? cb.onError(new Error('engine down'))
                : cb.onComplete({ item: { filePath: pf(`C:/P/Media/.preview-assets/${config.operation}.png`) } })));
            return true;
        },
        runSceneOp: (payload) => {
            calls.lift.push(payload);
            log.push(payload.op);
            const exec = {};
            setImmediate(() => exec.onResult({ imageUrl: null, depthUrl: 'http://127.0.0.1:1/view?filename=lift.f32' }));
            return exec;
        },
        loadLayer: async (manifestUrl, record) => ({ record, depth: new Float32Array(8), rgba: new Uint8ClampedArray(32), manifestUrl }),
        pixelsAt: async (url, pw, ph) => new Uint8ClampedArray(pw * ph * 4).fill(120),
        savePicture: async (project, group, blob, size, scenePose) => {
            calls.saved.push({ size, scenePose });
            log.push('save');
            return { group: { ...group, history: [{ id: 'new' }] }, entry: { id: 'new', scenePose } };
        },
    };
    const view = { addLayer: (l) => calls.layers.push(l) };
    const steps = [];
    const ctx = { project: PROJECT, group: GROUP, sceneItem: SCENE_ITEM, view, renderer: {}, pose: POSE, aspect: '16:9', onStep: (s) => steps.push(s) };
    return { io, ctx, log, calls, steps };
}

test('a frame with holes: inpaint -> lift -> layer -> clean-up -> one entry, no job lands a card', async () => {
    const { takePicture, GENERIC, POLISH } = await esm('js/services/scene/scenePicture.js');
    const t = harness();
    const out = await takePicture({ ...t.ctx, fillLine: 'More houses.' }, t.io);
    assert.deepEqual(t.steps, ['render', 'fill', 'lift', 'clean', 'save']);
    assert.deepEqual(t.log, ['render 1360x768', 'inpaint', 'sceneLift', 'kleinEdit', 'save']);
    for (const { config, opts } of t.calls.enqueue) {
        assert.equal(config.model.id, 'klein-9b');
        assert.deepEqual(opts, { deferCommit: true }, `${config.operation} must not land a card`);
        assert.equal(config.mediaItems.length, 1);
    }
    const [inpaint, edit] = t.calls.enqueue.map(c => c.config);
    assert.equal(inpaint.positive, `${GENERIC} In the large empty areas: More houses.`);
    assert.ok(inpaint.maskDataUrl.startsWith('data:'), 'the hole mask rides as maskDataUrl');
    assert.equal(inpaint.mediaItems[0].url, pf('C:/P/Media/.preview-assets/asset1.png'), 'inpaint fills the rendered frame');
    assert.equal(edit.positive, POLISH);
    assert.equal(edit.maskDataUrl, undefined);
    assert.equal(edit.mediaItems[0].url, pf('C:/P/Media/.preview-assets/inpaint.png'), 'clean-up runs on the FILLED frame');
    // the lift: the fill, the render's known depth as a local .f32, the lens as degrees
    const [lift] = t.calls.lift;
    assert.equal(lift.imagePath, pf('C:/P/Media/.preview-assets/inpaint.png'));
    assert.equal(lift.knownDepthPath, 'C:/P/Media/.preview-assets/asset2.f32');
    assert.ok(Math.abs(lift.fovX - 73.7398) < 1e-3, `fovX ${lift.fovX}`);
    // the layer: the fill's local path, the render's own camera, meshed into the live view
    const layerPost = t.calls.post.find(p => p.url.includes('scene-layer'));
    assert.match(layerPost.url, /^\/project-media\/p1\/scene-layer\?folderPath=C%3A%2FP$/);
    assert.deepEqual(layerPost.body, { itemId: 'pano1', imagePath: 'C:/P/Media/.preview-assets/inpaint.png',
        depthUrl: 'http://127.0.0.1:1/view?filename=lift.f32', camera: RECORD });
    assert.equal(t.calls.layers.length, 1);
    assert.equal(t.calls.layers[0].manifestUrl, SCENE_ITEM.scenePath);
    assert.equal(out.layer.image, 'layer0.png');
    // one entry, carrying the pose it was taken from
    assert.equal(t.calls.saved.length, 1);
    assert.deepEqual(t.calls.saved[0].size, { w: 1360, h: 768 });
    assert.deepEqual(t.calls.saved[0].scenePose, { ...POSE, aspect: '16:9', fillLine: 'More houses.' });
});

test('most of the frame seen from behind fills with the INTERIOR instruction', async () => {
    const { takePicture, INTERIOR } = await esm('js/services/scene/scenePicture.js');
    const t = harness({ backFrac: 0.6 });
    await takePicture(t.ctx, t.io);
    assert.equal(t.calls.enqueue[0].config.positive, INTERIOR);
});

test('no holes: no fill, no lift, no layer - the clean-up still runs (always on)', async () => {
    const { takePicture } = await esm('js/services/scene/scenePicture.js');
    const t = harness({ holeFrac: 0 });
    const out = await takePicture(t.ctx, t.io);
    assert.deepEqual(t.log, ['render 1360x768', 'kleinEdit', 'save']);
    assert.equal(t.calls.enqueue[0].config.mediaItems[0].url, pf('C:/P/Media/.preview-assets/asset1.png'));
    assert.equal(t.calls.layers.length, 0);
    assert.equal(out.layer, null);
});

test('a failed fill saves nothing and adds no layer', async () => {
    const { takePicture } = await esm('js/services/scene/scenePicture.js');
    const t = harness({ failInpaint: true });
    await assert.rejects(takePicture(t.ctx, t.io), /engine down/);
    assert.equal(t.calls.saved.length, 0);
    assert.equal(t.calls.layers.length, 0);
    assert.equal(t.calls.lift.length, 0);
});

test('the colour lock: a frame keeps its colours, a drifted edit returns to the frame\'s', async () => {
    const { colorLock } = await esm('js/services/scene/scenePicture.js');
    const n = 64, src = new Uint8ClampedArray(n * 4), edit = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
        src.set([40 + i, 90 + (i % 7) * 9, 200 - i, 255], i * 4);
        edit.set([Math.min(255, 70 + i), 120 + (i % 7) * 9, 230 - i, 255], i * 4); // brighter, bluer
    }
    const same = colorLock(src, src);
    assert.ok(same.every((v, k) => Math.abs(v - src[k]) <= 1), 'identity within 1/255');
    const mean = (a, c) => a.filter((_, k) => k % 4 === c).reduce((s, v) => s + v, 0) / n;
    const locked = colorLock(edit, src);
    for (const c of [0, 1, 2]) {
        assert.ok(Math.abs(mean(locked, c) - mean(src, c)) < 2, `channel ${c}: ${mean(locked, c)} vs ${mean(src, c)}`);
    }
    assert.ok(locked.filter((_, k) => k % 4 === 3).every(v => v === 255));
});

test('the fill line: trimmed, its full stop not doubled, empty adds nothing', async () => {
    const { fillPrompt, GENERIC } = await esm('js/services/scene/scenePicture.js');
    assert.equal(fillPrompt(0, '  Forest. '), `${GENERIC} In the large empty areas: Forest.`);
    assert.equal(fillPrompt(0, ''), GENERIC);
    assert.equal(fillPrompt(0.4, undefined), GENERIC);
});
