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
