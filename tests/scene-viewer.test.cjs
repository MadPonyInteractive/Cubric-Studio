'use strict';

// MPI-623 — the Scene viewer's pure half (js/services/scene/sceneViewer.js), ported from spike
// 0a whose renderer matched shots.py (IoU >= 0.9995). Wrong here, the viewer and the picture
// drift apart silently: a sibling URL that misses the suffix rule loads nothing, a seam column
// not duplicated tears the pano at u = 0, a lens read off the height changes with the window.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('a manifest names its siblings by suffix, keeping the folder', async () => {
    const { sceneFileUrl } = await esm('js/services/scene/sceneViewer.js');
    const manifest = `/project-file?path=${encodeURIComponent('C:\\P\\Media\\.meta\\abc.scene.json')}`;
    assert.equal(sceneFileUrl(manifest, 'pano.png'), `/project-file?path=${encodeURIComponent('C:\\P\\Media\\.meta\\abc.scene.pano.png')}`);
    assert.equal(sceneFileUrl(manifest, 'pano_depth.f32'), `/project-file?path=${encodeURIComponent('C:\\P\\Media\\.meta\\abc.scene.pano_depth.f32')}`);
    assert.throws(() => sceneFileUrl('/project-file?path=x.png', 'pano.png'), /not a scene manifest/);
});

test('the pano grid: one vertex per cell at its depth, the seam column doubled', async () => {
    const { panoGrid } = await esm('js/services/scene/sceneViewer.js');
    const w = 8, h = 4, depth = new Float32Array(w * h).fill(2);
    depth[1 * w + 4] = 5; // a cell in the centre column, just above the horizon
    const { position, dir, index } = panoGrid(depth, w, h);
    assert.equal(position.length, (w + 1) * h * 3);
    assert.equal(index.length, (h - 1) * w * 6);
    assert.ok(Math.max(...index) < (w + 1) * h);
    for (let i = 0; i < h; i++) {
        const a = (i * (w + 1)) * 3, b = (i * (w + 1) + w) * 3;
        assert.deepEqual([...position.slice(b, b + 3)], [...position.slice(a, a + 3)], `row ${i} seam`);
    }
    for (let k = 0; k < position.length; k += 3) {
        const len = Math.hypot(position[k], position[k + 1], position[k + 2]);
        assert.ok(Math.abs(len - 2) < 1e-5 || Math.abs(len - 5) < 1e-5, 'every vertex sits at its depth');
        near(Math.hypot(dir[k], dir[k + 1], dir[k + 2]), 1);
    }
    // The pano's centre column is ahead of the start pose: spot +Z, which is world +Z.
    const c = (1 * (w + 1) + 4) * 3;
    assert.ok(position[c + 2] > 4 && Math.abs(position[c]) < 2, `centre column ahead: ${[...position.slice(c, c + 3)]}`);
});

test('fly: W goes along the yaw, D to its right, Q/E down/up, all level', async () => {
    const { flyStep, START_POSE, FLY_SPEED } = await esm('js/services/scene/sceneViewer.js');
    const at = (held, pose = START_POSE) => flyStep(pose, new Set(held), 1).pos;
    assert.deepEqual(at(['forward']).map(v => +v.toFixed(6)), [0, 0, FLY_SPEED]);
    assert.deepEqual(at(['right']).map(v => +v.toFixed(6)), [FLY_SPEED, 0, 0]);
    assert.deepEqual(at(['left', 'right']).map(v => +v.toFixed(6)), [0, 0, 0]);
    assert.deepEqual(at(['up']).map(v => +v.toFixed(6)), [0, FLY_SPEED, 0]);
    const turned = { ...START_POSE, yaw: Math.PI / 2, pitch: 1 };
    assert.deepEqual(at(['forward'], turned).map(v => +v.toFixed(6)), [FLY_SPEED, 0, 0], 'pitch never lifts a forward move');
});

test('look: drag right turns right, pitch stops short of straight up', async () => {
    const { flyLook, START_POSE, LOOK_RATE } = await esm('js/services/scene/sceneViewer.js');
    near(flyLook(START_POSE, 100, 0).yaw, 100 * LOOK_RATE);
    near(flyLook(START_POSE, 0, -100).pitch, 100 * LOOK_RATE);
    assert.ok(flyLook(START_POSE, 0, -1e6).pitch < Math.PI / 2);
});

test('the camera sits at the pose in the y-down world, lens across the frame width', async () => {
    const { applyPose } = await esm('js/services/scene/sceneViewer.js');
    const { PerspectiveCamera, Vector3 } = await esm('node_modules/three/build/three.module.js');
    const cam = new PerspectiveCamera(60, 16 / 9, 0.05, 1000);
    applyPose(cam, { pos: [1, 2, 3], yaw: 0, pitch: 0, mm: 24 });
    const p = new Vector3().setFromMatrixPosition(cam.matrixWorld);
    near(p.x, 1); near(p.y, -2); near(p.z, 3);
    near(cam.fov, 45.7473, 1e-3); // the spike's 24 mm at 16:9: 2 atan(18 / (24 * 16/9))
    cam.aspect = 1; applyPose(cam, { pos: [0, 0, 0], yaw: 0, pitch: 0, mm: 24 });
    near(cam.fov, 73.7398, 1e-3); // a square frame of the same lens is taller, not narrower
    assert.equal(cam.matrixAutoUpdate, false);
});

// ── Rule C's inputs (spike 0a parity rests on these matching shots.py) ──────────────────

test('a depth edge is a 3x3 spread over 5% of the depth; the flag drops on its vertices', async () => {
    const { depthEdges, panoGrid } = await esm('js/services/scene/sceneViewer.js');
    const w = 8, h = 4, depth = new Float32Array(w * h).fill(2);
    for (let i = 0; i < h; i++) depth[i * w + 5] = depth[i * w + 6] = depth[i * w + 7] = 4; // a step between columns 4 and 5
    const tear = depthEdges(depth, w, h);
    assert.deepEqual([...tear.slice(w, 2 * w)], [0, 0, 0, 0, 1, 1, 0, 0], 'both sides of the step, nothing else');
    assert.equal(depthEdges(depth, w, h, 1.5)[w + 4], 0, 'a manifest rtol over the spread keeps it a surface');
    const { edge, src } = panoGrid(depth, w, h, { texW: 32 });
    assert.equal(edge[1 * (w + 1) + 4], 0);
    assert.equal(edge[1 * (w + 1) + 2], 1);
    // src is the vertex's texel in the TEXTURE (4 texels a cell here), the seam column unwrapped
    assert.deepEqual([...src.slice((1 * (w + 1) + w) * 2, (1 * (w + 1) + w) * 2 + 2)], [(w + 0.5) * 4, 1.5 * 4]);
});

test('the sky band turns sky cells next to a silhouette into edges, wrapping the seam', async () => {
    const { panoGrid } = await esm('js/services/scene/sceneViewer.js');
    const w = 16, h = 8, sky = 10, depth = new Float32Array(w * h).fill(sky);
    for (let i = 4; i < h; i++) depth[i * w + 0] = 3; // one solid column at the seam, lower half
    const at = (e, i, j) => e[i * (w + 1) + j];
    const plain = panoGrid(depth, w, h, { sky }).edge, banded = panoGrid(depth, w, h, { sky, skyBand: 2 }).edge;
    assert.equal(at(plain, 1, 13), 1, 'band 0: far sky is a surface');
    assert.equal(at(banded, 5, 14), 0, 'two columns left of the seam, beside the silhouette');
    assert.equal(at(banded, 5, 13), 1, 'three columns away is outside the band');
    assert.equal(at(banded, 1, 13), 1, 'rows above the band stay sky');
});

test('window faces come last, so they draw with the material that opens their back faces', async () => {
    const { panoGrid } = await esm('js/services/scene/sceneViewer.js');
    const w = 8, h = 4, depth = new Float32Array(w * h).fill(2);
    const none = panoGrid(depth, w, h);
    assert.equal(none.windowStart, none.index.length);
    // rows 1-2, columns 7..1 across the seam: cells (1,7) (1,0) give 2 cells x 2 faces each
    const { index, windowStart } = panoGrid(depth, w, h, { windows: [{ rows: [1, 3], cols: [7, 2] }] });
    assert.equal(index.length - windowStart, 4 * 3);
    const sorted = (a) => [...a].sort((x, y) => x - y);
    assert.deepEqual(sorted(index), sorted(none.index), 'the same faces, reordered');
    const VW = w + 1;
    assert.deepEqual([...index.slice(windowStart, windowStart + 3)], [1 * VW + 0, 2 * VW + 0, 1 * VW + 1]);
});

test('a fill layer: kept pixels back-projected through its w2c, faces only over kept corners', async () => {
    const { layerGrid } = await esm('js/services/scene/sceneViewer.js');
    const w = 4, h = 3, z = new Float32Array(w * h).fill(2), rgba = new Uint8ClampedArray(w * h * 4).fill(7);
    z[w * 2 + 3] = 0; // the bottom-right pixel is not kept
    // OpenCV camera 1 unit along world +X, looking down world +Z (identity rotation)
    const w2c = [1, 0, 0, -1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const g = layerGrid({ w, h, w2c, fx: 2, cx: 2, cy: 1.5 }, z, rgba);
    assert.equal(g.position.length, (w * h - 1) * 3);
    // pixel (1, 1): x = (1.5 - 2) / 2 * 2 = -0.5, y = 0; world = camera + (x, y, z)
    near(g.position[5 * 3], 0.5); near(g.position[5 * 3 + 1], 0); near(g.position[5 * 3 + 2], 2);
    assert.deepEqual([...g.src.slice(5 * 2, 5 * 2 + 2)], [1.5, 1.5]);
    assert.equal(g.index.length, ((w - 1) * (h - 1) * 2 - 1) * 3, 'one face lost to the dropped corner');
    assert.equal(g.color[0], 7);
});

// ── Take picture's camera: the picture a pose takes must land back where it was seen ──────

test('the ground: the median drop straight below the pano camera, which the eye height scales', async () => {
    const { groundBelow, panoGrid } = await esm('js/services/scene/sceneViewer.js');
    const w = 64, h = 40, eye = 0.8;
    // a flat floor `eye` below the camera: each cell's depth is eye / cos(angle from straight down)
    const depth = new Float32Array(w * h);
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
        const ph = (i + 0.5) / h * Math.PI;
        depth[i * w + j] = ph > Math.PI / 2 + 0.05 ? eye / -Math.cos(ph) : 50;
    }
    near(groundBelow(depth, w, h), eye, 1e-5);
    const { position } = panoGrid(depth, w, h); // and the grid puts that floor at world y = +eye (y-down)
    near(position[((h - 1) * (w + 1)) * 3 + 1], eye, 1e-5);
});

test('Klein picture sizes: ~1 MP at the aspect, sides a multiple of 16', async () => {
    const { pictureSize } = await esm('js/services/scene/sceneViewer.js');
    assert.deepEqual(pictureSize('16:9'), { w: 1360, h: 768 }, 'the size Klein edit returns');
    assert.deepEqual(pictureSize('9:16'), { w: 768, h: 1360 });
    assert.deepEqual(pictureSize('1:1'), { w: 1024, h: 1024 });
    const wide = pictureSize('2.39:1');
    assert.ok(wide.w % 16 === 0 && wide.h % 16 === 0 && Math.abs(wide.w / wide.h - 2.39) < 0.06, JSON.stringify(wide));
});

test('roll: held keys turn it; roll > 0 tilts the camera right, the centre ray unmoved', async () => {
    const { flyStep, applyPose, layerCamera, layerGrid, START_POSE, ROLL_SPEED } = await esm('js/services/scene/sceneViewer.js');
    const { PerspectiveCamera } = await esm('node_modules/three/build/three.module.js');
    near(flyStep(START_POSE, new Set(['rollRight']), 1).roll, ROLL_SPEED);
    near(flyStep(START_POSE, new Set(['rollLeft', 'rollRight']), 1).roll, 0);
    // A 3x3 picture at depth 2 from a turned, rolled pose, back-projected through its own record.
    const pose = { pos: [1, 2, 3], yaw: Math.PI / 2, pitch: 0, roll: Math.PI / 2, mm: 24 };
    const cam = new PerspectiveCamera(50, 1, 1e-4, 100);
    applyPose(cam, pose);
    const rec = layerCamera(cam, pose.mm, 3, 3);
    const g = layerGrid(rec, new Float32Array(9).fill(2), new Uint8ClampedArray(36));
    const at = (k) => [...g.position.slice(k * 3, k * 3 + 3)];
    // centre pixel: 2 units along the pose's forward (spot +X at yaw 90), the world y-down
    at(4).forEach((v, i) => near(v, [3, -2, 3][i], 1e-5));
    // the pixel right of centre: rolled 90 degrees right, the frame's right is world DOWN (+y)
    const right = at(5);
    assert.ok(right[1] > -2 + 1e-3 && Math.abs(right[2] - 3) < 1e-5, `right of centre dips: ${right}`);
});
