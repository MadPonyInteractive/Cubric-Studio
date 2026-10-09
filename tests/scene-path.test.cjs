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
