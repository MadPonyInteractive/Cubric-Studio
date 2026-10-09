/**
 * MPI-623 P1: the camera path's points (scenePath.js) - a path starts where the pano was shot,
 * a double press adds nothing, removing down to the start clears it.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const esm = (p) => import(pathToFileURL(path.join(__dirname, '..', p)).href);

test('the first point starts the path at the pano\'s centre, then where the camera is', async () => {
    const { addPoint, PATH_START } = await esm('js/services/scene/scenePath.js');
    const a = addPoint([], [1, 0, 2], 0.25);
    assert.deepEqual(a, [[...PATH_START], [1, 0, 2]]);
    const b = addPoint(a, [1, 0.1, 3], 0.25);
    assert.deepEqual(b, [[0, 0, 0], [1, 0, 2], [1, 0.1, 3]]);
    assert.deepEqual(a, [[0, 0, 0], [1, 0, 2]], 'the old path is not changed');
});

test('a point on top of the last one is a double press: nothing added', async () => {
    const { addPoint, MIN_GAP } = await esm('js/services/scene/scenePath.js');
    const a = addPoint([], [1, 0, 2], 0.25);
    assert.equal(addPoint(a, [1, 0, 2 + MIN_GAP * 0.25 * 0.9], 0.25), a);
    assert.equal(addPoint(a, [1, 0, 2 + MIN_GAP * 0.25 * 1.1], 0.25).length, 3, 'just past the gap counts');
    assert.deepEqual(addPoint([], [0, 0, 0], 0.25), [[0, 0, 0]], 'a press at the centre only starts it');
});

test('removing the last point; down to the start clears the path', async () => {
    const { addPoint, removeLast } = await esm('js/services/scene/scenePath.js');
    const p = addPoint(addPoint([], [1, 0, 2], 0.25), [2, 0, 2], 0.25);
    assert.deepEqual(removeLast(p), [[0, 0, 0], [1, 0, 2]]);
    assert.deepEqual(removeLast(removeLast(p)), []);
    assert.deepEqual(removeLast([]), []);
});

test('P2 frames: 81 frames from the pano centre to the last point, evenly spaced, facing the way they go', async () => {
    const { pathFrames, FRAMES } = await esm('js/services/scene/scenePath.js');
    assert.deepEqual(pathFrames([]), []);
    assert.deepEqual(pathFrames([[0, 0, 0]]), [], 'the start alone is no path');
    const f = pathFrames([[0, 0, 0], [0, 0, 2]]);
    assert.equal(f.length, FRAMES);
    assert.deepEqual(f[0].pos, [0, 0, 0], 'frame 0 is the pano itself');
    assert.ok(Math.abs(f.at(-1).pos[2] - 2) < 1e-9, 'the last frame is the last point');
    for (let i = 0; i < FRAMES; i++) {
        assert.ok(Math.abs(f[i].pos[2] - (2 * i) / (FRAMES - 1)) < 1e-6, `frame ${i} at constant speed`);
        assert.ok(Math.abs(f[i].yaw) < 1e-9, 'facing +z, the way it goes');
    }
});

test('P2 frames: a bend turns the heading smoothly, through every point, at constant speed', async () => {
    const { pathFrames } = await esm('js/services/scene/scenePath.js');
    const pts = [[0, 0, 0], [0, 0, 1], [1, -0.1, 1], [1, -0.1, 3]];
    const f = pathFrames(pts, 401);
    for (const p of pts) assert.ok(f.some(q => Math.hypot(...q.pos.map((v, i) => v - p[i])) < 0.01), `passes through ${p}`);
    assert.ok(Math.abs(f[0].yaw) < 0.15, 'starts facing +z (the curve swings a little wide before the bend)');
    assert.ok(Math.abs(f[150].yaw - Math.PI / 2) < 0.35, 'half way along the +x leg (s = 1.5 of 4) it faces +x');
    assert.ok(Math.abs(f.at(-1).yaw) < 0.15, 'ends facing +z');
    const step = (i) => Math.hypot(...f[i + 1].pos.map((v, c) => v - f[i].pos[c]));
    for (let i = 0; i < 400; i++) {
        assert.ok(Math.abs(step(i) - step(0)) < step(0) * 0.02, `frame ${i} step even`);
        let d = f[i + 1].yaw - f[i].yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        assert.ok(Math.abs(d) < 0.05, `frame ${i} turns smoothly (${d})`);
    }
});

test('P2 frames: a straight climb keeps the last heading', async () => {
    const { pathFrames } = await esm('js/services/scene/scenePath.js');
    const f = pathFrames([[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
    assert.ok(f.every(q => Number.isFinite(q.yaw)));
    assert.ok(Math.abs(f[10].yaw - Math.PI / 2) < 0.1, 'early: facing +x');
});
