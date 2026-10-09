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

const STYLE = 'Flat toon shading, warm palette.';

function harness({ holeFrac = 0.25, inside = false, frontFrac = 0.3, failInpaint = false, z = new Float32Array(8).fill(2),
    described = { ok: true, via: 'comfy', text: `: ${STYLE}` } } = {}) {
    const log = [], calls = { enqueue: [], lift: [], post: [], layers: [], saved: [], blobs: [], poses: [], describe: [], inside: [] };
    const w = 4, h = 2;
    const io = {
        klein: { id: 'klein-9b' },
        inside: (view, renderer, pos) => { calls.inside.push(pos); return inside; },
        describe: async (args) => { calls.describe.push(args); log.push('describe'); return described; },
        render: (view, renderer, pose, size) => {
            log.push(`render ${size.w}x${size.h}`);
            calls.poses.push(pose);
            return { w, h, rgba: new Uint8ClampedArray(w * h * 4), mask: new Uint8ClampedArray(w * h * 4), z, frontFrac, record: RECORD,
                holeFrac: typeof holeFrac === 'function' ? holeFrac(calls.poses.length - 1) : holeFrac };
        },
        encodePng: async () => new Blob(['png']),
        blobToDataUrl: async (blob) => { calls.blobs.push(blob); return 'data:x;base64,AA=='; },
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
    const view = { addLayer: (l) => calls.layers.push(l), groundAt: () => 0.5 };
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
    assert.equal(lift.ground, '0,1,0,0.5', 'the ground 0.5 under a camera at the origin, level');
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

test('a camera standing inside fills with INTERIOR + the pano\'s style, asked once a scene', async () => {
    const { takePicture, INTERIOR, STYLE_ASK } = await esm('js/services/scene/scenePicture.js');
    const sceneItem = { ...SCENE_ITEM, filePath: pf('C:/P/Media/pano1.png'), scenePath: pf('C:/P/Media/.meta/once.scene.json') };
    const t = harness({ inside: true });
    await takePicture({ ...t.ctx, sceneItem }, t.io);
    assert.deepEqual(t.calls.inside, [POSE.pos], 'asked where the camera stands');
    assert.deepEqual(t.calls.describe, [{ imagePath: sceneItem.filePath, question: STYLE_ASK }], 'the PANO is described');
    assert.equal(t.calls.enqueue[0].config.positive, `${INTERIOR} The style of the picture: ${STYLE}`, 'stray lead punctuation dropped');
    assert.deepEqual(t.steps.slice(0, 3), ['render', 'style', 'fill']);
    const again = harness({ inside: true });
    await takePicture({ ...again.ctx, sceneItem }, again.io);
    assert.equal(again.calls.describe.length, 0, 'the same scene is not described twice');
    assert.equal(again.calls.enqueue[0].config.positive, `${INTERIOR} The style of the picture: ${STYLE}`);
});

test('inside, a frame that sees nothing outside fills with ROOM + style: INTERIOR\'s openings made a white doorway', async () => {
    const { takePicture, ROOM } = await esm('js/services/scene/scenePicture.js');
    const t = harness({ inside: true, frontFrac: 0.004 });
    await takePicture({ ...t.ctx, sceneItem: { ...SCENE_ITEM, scenePath: pf('C:/P/Media/.meta/room.scene.json') } }, t.io);
    assert.equal(t.calls.enqueue[0].config.positive, `${ROOM} The style of the picture: ${STYLE}`);
});

test('outside, the describer is never asked', async () => {
    const { takePicture } = await esm('js/services/scene/scenePicture.js');
    const t = harness({ inside: false });
    await takePicture({ ...t.ctx, sceneItem: { ...SCENE_ITEM, scenePath: pf('C:/P/Media/.meta/out.scene.json') } }, t.io);
    assert.equal(t.calls.describe.length, 0);
});

test('a describer that fails stops the fill before Klein, and says where it is picked', async () => {
    const { takePicture } = await esm('js/services/scene/scenePicture.js');
    const t = harness({ inside: true, described: { ok: false, via: 'endpoint', error: 'No API key.' } });
    await assert.rejects(takePicture({ ...t.ctx, sceneItem: { ...SCENE_ITEM, scenePath: pf('C:/P/Media/.meta/fail.scene.json') } }, t.io),
        /style could not be read \(No API key\)\. Check Remote > Language Models/);
    assert.equal(t.calls.enqueue.length, 0, 'no fill in the wrong style');
});

// renderPicture writes -z where a hole is a real surface seen from behind; sceneLift fits the
// fill to those and still keeps them. Only inside does that surface bound the fill: outside, a
// back face is an object's far side and the fill paints what lies beyond it.
test('the known depth keeps the back faces\' -z inside only', async () => {
    const { takePicture } = await esm('js/services/scene/scenePicture.js');
    const z = new Float32Array([2, 2, -3, -3, 0, 0, 2, -1]);
    const sent = async (inside) => {
        const t = harness({ inside, z });
        await takePicture(t.ctx, t.io);
        const blob = t.calls.blobs.find(b => b.type === 'application/octet-stream');
        return [...new Float32Array(await blob.arrayBuffer())];
    };
    assert.deepEqual(await sent(true), [2, 2, -3, -3, 0, 0, 2, -1]);
    assert.deepEqual(await sent(false), [2, 2, 0, 0, 0, 0, 2, 0]);
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

// Build here (plan 0b): six square views from where the camera stands, each filled into the
// scene like Take picture's fill. Wrong here, the room has a gap no picture can fill, a build
// lands stray pictures on the card, or Stop leaves Klein running view after view.
test('Build here: six views round the camera, front first, each filled into a layer, no entry', async () => {
    const { buildHere, BUILD_MM, INTERIOR } = await esm('js/services/scene/scenePicture.js');
    const { PITCH_MAX } = await esm('js/services/scene/sceneViewer.js');
    const t = harness({ inside: true, holeFrac: (i) => (i === 3 ? 0 : 0.4) }); // the 4th view needs nothing
    const at = [];
    const sceneItem = { ...SCENE_ITEM, scenePath: pf('C:/P/Media/.meta/build.scene.json') };
    const layers = await buildHere({ ...t.ctx, sceneItem, onStep: (s, a) => at.push(`${a.view}/${a.of} ${s}`) }, t.io);
    const Q = Math.PI / 2;
    assert.deepEqual(t.calls.poses.map(p => [p.yaw, p.pitch]),
        [[0.5, 0], [0.5 + Q, 0], [0.5 + 2 * Q, 0], [0.5 + 3 * Q, 0], [0.5, PITCH_MAX], [0.5, -PITCH_MAX]]);
    for (const p of t.calls.poses) assert.deepEqual({ pos: p.pos, roll: p.roll, mm: p.mm }, { pos: POSE.pos, roll: 0, mm: BUILD_MM });
    assert.ok(t.log.filter(l => l.startsWith('render')).every(l => l === 'render 1024x1024'), 'square views');
    assert.deepEqual(t.log.filter(l => !l.startsWith('render')), ['describe', ...Array(5).fill(['inpaint', 'sceneLift']).flat()],
        'the style asked once, then a fill + lift per view with holes, no clean-up, nothing saved');
    assert.equal(t.calls.saved.length, 0);
    assert.deepEqual(t.calls.inside, [POSE.pos], 'one inside/outside answer for the whole spot');
    assert.equal(layers.length, 5);
    assert.equal(t.calls.layers.length, 5, 'each fill meshed in before the next view renders');
    for (const { config, opts } of t.calls.enqueue) {
        assert.deepEqual(opts, { deferCommit: true });
        assert.equal(config.positive, `${INTERIOR} The style of the picture: ${STYLE}`);
    }
    for (const l of t.calls.lift) assert.ok(Math.abs(l.fovX - 96.7325) < 1e-3, `fovX ${l.fovX}`);
    assert.deepEqual(at.slice(0, 4), ['1/6 render', '1/6 style', '1/6 fill', '1/6 lift']);
    assert.ok(at.includes('4/6 render') && !at.includes('4/6 fill'));
});

test('Build here: Stop lets the running view finish and starts no other', async () => {
    const { buildHere } = await esm('js/services/scene/scenePicture.js');
    const t = harness();
    const stop = new AbortController();
    await assert.rejects(buildHere({ ...t.ctx, signal: stop.signal, onStep: (s) => { if (s === 'lift') stop.abort(); } }, t.io), /cancelled/);
    assert.equal(t.calls.poses.length, 1);
    assert.equal(t.calls.layers.length, 1, 'the view that was running still lands');
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
    assert.equal(fillPrompt(false, '  Forest. '), `${GENERIC} In the large empty areas: Forest.`);
    assert.equal(fillPrompt(false, ''), GENERIC);
    assert.equal(fillPrompt(false, undefined), GENERIC);
});

// Asked per frame, the switch misfired inside the cottage: the side views see mostly nothing (the
// pano never saw those walls), read as outside, and GENERIC painted an open courtyard (session 38).
test('insideAt: six views round the spot, more pano seen from behind than from the front, holes ignored', async () => {
    const { insideAt, BUILD_MM } = await esm('js/services/scene/scenePicture.js');
    const seen = [];
    const at = (fracs) => {
        let i = 0;
        return insideAt({}, {}, [1, 2, 3], (view, renderer, pose, size) => {
            seen.push({ pos: pose.pos, mm: pose.mm, size });
            return fracs[i++];
        });
    };
    // the cottage: the facade from behind, then mostly nothing round the sides -> inside
    assert.equal(at([{ backFrac: 0.7, frontFrac: 0.2 }, { backFrac: 0.1, frontFrac: 0 }, { backFrac: 0.05, frontFrac: 0.05 },
        { backFrac: 0.1, frontFrac: 0 }, { backFrac: 0.3, frontFrac: 0 }, { backFrac: 0, frontFrac: 0.1 }]), true);
    assert.equal(seen.length, 6);
    assert.ok(seen.every(s => s.mm === BUILD_MM && s.size.w === 48 && s.size.h === 48 && s.pos.join() === '1,2,3'));
    // behind the well: its back in one view, the village's fronts all round -> outside
    seen.length = 0;
    assert.equal(at([{ backFrac: 0.4, frontFrac: 0.5 }, { backFrac: 0, frontFrac: 0.9 }, { backFrac: 0, frontFrac: 0.8 },
        { backFrac: 0, frontFrac: 0.9 }, { backFrac: 0, frontFrac: 0.3 }, { backFrac: 0.1, frontFrac: 0.8 }]), false);
});

// The real behind_well build's DOWN view (session 37's manifest, layer 5): a camera at world
// (0.08, 0.28, 1.45), y down, looking down; the ground under it at 0.508 (`groundAt`, measured).
test('groundPlane: the ground in the shot\'s camera frame - the down view sees it 0.228 ahead', async () => {
    const { groundPlane } = await esm('js/services/scene/scenePicture.js');
    const w2c = [-0.991, 0, 0.135, -0.117, 0.135, 0.021, 0.991, -1.453, -0.003, 1.0, -0.021, -0.25, 0, 0, 0, 1];
    const asked = [];
    const [nx, ny, nz, d] = groundPlane({ w2c }, (x, z) => { asked.push([x, z]); return 0.508; }).split(',').map(Number);
    assert.ok(Math.abs(asked[0][0] - 0.08) < 0.01 && Math.abs(asked[0][1] - 1.45) < 0.01, `asked at the camera's spot, got ${asked[0]}`);
    assert.ok(Math.abs(nz - 1) < 0.01 && Math.abs(nx) < 0.01 && Math.abs(ny) < 0.03, 'world down is the view axis');
    assert.ok(Math.abs(d - 0.228) < 0.005, `the camera is 0.228 above the ground, got ${d}`);
    assert.equal(groundPlane({ w2c }, () => 0.2), '', 'a camera under the ground gets no plane');
});
