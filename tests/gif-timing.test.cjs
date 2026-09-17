// MPI-772: the frame-list math behind the GIF timing and output tools.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

let T;
before(async () => {
    T = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'components', 'Organisms',
        'MpiToolOptionsGifTiming', 'gifTiming.js')).href);
});

const frames = ['a', 'b', 'c', 'd', 'e'].map((hash, i) => ({ hash, delay: 10 + i }));

test('fps -> delay: whole hundredths, floor 2, clamped to 0.1-50 fps', () => {
    assert.equal(T.fpsToDelay(16), 6);
    assert.equal(T.fpsToDelay(10), 10);
    assert.equal(T.fpsToDelay(0.33), 303);
    assert.equal(T.fpsToDelay(50), 2);
    assert.equal(T.fpsToDelay(500), 2);
    assert.equal(T.fpsToDelay(0.01), 1000);
    assert.equal(T.fpsToDelay('x'), 1000);
    assert.equal(Math.round(T.delayToFps(6) * 10) / 10, 16.7);
});

test('trim keeps the inclusive range, clamped, in either order', () => {
    assert.deepEqual(T.timingEdit('trim', frames, { in: 1, out: 3 }).frames.map(f => f.hash), ['b', 'c', 'd']);
    assert.deepEqual(T.timingEdit('trim', frames, { in: 3, out: 1 }).frames.map(f => f.hash), ['b', 'c', 'd']);
    assert.deepEqual(T.timingEdit('trim', frames, { in: -4, out: 99 }).frames.map(f => f.hash), ['a', 'b', 'c', 'd', 'e']);
});

test('speed sets one delay on every frame and keeps order; reverse flips order and keeps delays', () => {
    const sped = T.timingEdit('speed', frames, { fps: 16 }).frames;
    assert.deepEqual(sped.map(f => f.delay), [6, 6, 6, 6, 6]);
    assert.deepEqual(sped.map(f => f.hash), ['a', 'b', 'c', 'd', 'e']);
    const rev = T.timingEdit('reverse', frames).frames;
    assert.deepEqual(rev.map(f => `${f.hash}${f.delay}`), ['e14', 'd13', 'c12', 'b11', 'a10']);
    assert.deepEqual(frames.map(f => f.hash), ['a', 'b', 'c', 'd', 'e'], 'input list untouched');
});

test('loop and output only return their own field', () => {
    assert.deepEqual(T.timingEdit('loop', frames, { loop: 3 }), { loop: 3 });
    assert.deepEqual(T.timingEdit('loop', frames, { loop: -1 }), { loop: 0 });
    assert.deepEqual(T.timingEdit('output', frames, { maxEdge: 320, colours: 64, transparent: false, edgeColour: '#ff00ff' }),
        { output: { maxEdge: 320, colours: 64, edgeColour: null } });
    assert.deepEqual(T.timingEdit('output', frames, { maxEdge: 1, colours: 999, transparent: true, edgeColour: '#FF00ff' }),
        { output: { maxEdge: 16, colours: 256, edgeColour: '#FF00ff' } });
    assert.equal(T.timingEdit('output', frames, { transparent: true, edgeColour: 'red' }).output.edgeColour, '#000000');
    assert.throws(() => T.timingEdit('nope', frames), /unknown GIF timing tool/);
});
