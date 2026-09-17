'use strict';
// MPI-771: a Cut out opens a new entry; going back to the source entry must bring
// its masks back instead of making the user track again (Fabio, 2026-09-17).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let GifFrameMasks;
before(async () => {
    ({ GifFrameMasks } = await import(pathToFileURL(
        path.join(__dirname, '..', 'js', 'components', 'Organisms', 'MpiGifViewer', 'gifFrameMasks.js')).href));
});

const list = (...hashes) => hashes.map(hash => ({ hash }));

test('leaving a list stashes its masks; coming back restores them', () => {
    const m = new GifFrameMasks();
    const source = list('a', 'b');
    m.sync(source);
    m.setTrackAll(['track-a', 'track-b']);
    m.setEdits(1, { manual: 'brush-b', subtract: null, composed: 'comp-b' });

    assert.equal(m.sync(list('cut-a', 'cut-b')), true, 'leaving a masked list changes the store');
    assert.equal(m.hasAny(), false, 'the new entry starts with no masks');

    assert.equal(m.sync(source), true, 'returning restores');
    assert.equal(m.maskFor(0), 'track-a');
    assert.equal(m.maskFor(1), 'comp-b');
    assert.deepEqual(m.editedIndices(), [1]);
});

test('a list never masked changes nothing, and the stash is bounded', () => {
    const m = new GifFrameMasks();
    m.sync(list('x'));
    assert.equal(m.sync(list('y')), false, 'no masks on either side');
    for (let i = 0; i < 9; i++) {
        m.sync(list(`l${i}`));
        m.setTrackAll([`t${i}`]);
    }
    m.sync(list('fresh'));
    assert.equal(m.sync(list('l0')), false, 'the oldest of nine masked lists fell out of the stash');
    assert.equal(m.sync(list('l8')), true);
    assert.equal(m.maskFor(0), 't8');
});
