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

test('clear() throws the brush layers away too, so a re-mask is not subtracted again', () => {
    const m = new GifFrameMasks();
    m.sync(list('a', 'b'));
    m.setTrackAll(['track-a', 'track-b']);
    // "Cleared it with the brush" = a full-frame subtract, which survives a re-mask
    // by design — the reason a real clear has to exist (Fabio, 2026-09-18).
    m.setEdits(0, { manual: null, subtract: 'wipe-a', composed: 'blank-a' });

    m.clear(0);
    assert.equal(m.maskFor(0), null, 'no track and no edits left');
    assert.equal(m.hasEdits(0), false);
    assert.equal(m.maskFor(1), 'track-b', 'the other frame is untouched');

    m.setTrack(0, 're-masked-a');
    assert.equal(m.maskFor(0), 're-masked-a', 'the re-mask survives; nothing subtracts it');

    m.clearAll();
    assert.equal(m.hasAny(), false);
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

// ── MPI-859: a method run PROPOSES; Add / Subtract commits it ────────────────
// Fabio, 2026-09-20: Background then By colour on one frame kept only the second,
// because every method replaced the track. A proposal is what makes them compose.

test('a proposal shows, but it is not mask content until it is committed', () => {
    const m = new GifFrameMasks();
    m.sync(list('a', 'b'));
    m.setCandidates([[0, 'cand-a']]);

    assert.equal(m.hasCandidates(), true);
    assert.equal(m.candidateAt(0), 'cand-a');
    assert.equal(m.overlayAt(0), 'cand-a', 'the proposal is what the user is being asked about');
    // The MPI-426 rule: an uncommitted run must not reach the cut, in either
    // direction — the answer may be Subtract as easily as Add.
    assert.equal(m.maskFor(0), null, 'the cut cannot see it');
    assert.equal(m.hasAny(), false, 'and it does not unlock Cut out');
});

test('a proposal outranks a committed mask on display only', () => {
    const m = new GifFrameMasks();
    m.sync(list('a', 'b'));
    m.setTrackAll(['track-a', 'track-b']);
    m.setCandidates([[0, 'cand-a']]);

    assert.equal(m.overlayAt(0), 'cand-a');
    assert.equal(m.overlayAt(1), 'track-b', 'a frame outside the run keeps what it had');
    assert.equal(m.maskFor(0), 'track-a', 'the cut still reads the committed mask');
    assert.deepEqual(m.overlay(2), ['cand-a', 'track-b']);

    // The stage draws BOTH layers - the frame's own mask in white, the proposal in
    // green over it (MPI-859) - so a run never hides the mask it is about to change.
    assert.equal(m.committedAt(0), 'track-a', 'the mask under a proposal is still shown');
    assert.equal(m.candidateAt(0), 'cand-a');
    assert.equal(m.committedAt(1), 'track-b');
    assert.equal(m.candidateAt(1), null, 'a frame outside the run proposes nothing');
    m.clearCandidates();
    assert.equal(m.candidateAt(0), null);
    assert.equal(m.committedAt(0), 'track-a', 'and backing a run out leaves the mask alone');
});

test('a run supersedes the last proposal; Clear backs one out', () => {
    const m = new GifFrameMasks();
    m.sync(list('a', 'b'));
    m.setCandidates([[0, 'first-a'], [1, 'first-b']]);
    m.setCandidates([[1, 'second-b']]);
    assert.deepEqual(m.candidateIndices(), [1], 'two live proposals would need two commit rows');
    assert.equal(m.candidateAt(0), null);

    assert.equal(m.clearCandidates(), true);
    assert.equal(m.clearCandidates(), false, 'nothing left to drop');

    m.setCandidates([[0, 'cand-a']]);
    m.clear(0);
    assert.equal(m.hasCandidates(), false, 'Clear throws the proposal away with the mask');
});

test('a proposal never outlives its frame list, but survives a reorder', () => {
    const m = new GifFrameMasks();
    const source = list('a', 'b');
    m.sync(source);
    m.setTrackAll(['track-a', 'track-b']);
    m.setCandidates([[0, 'cand-a']]);

    // A reorder is the same frames in another order, so the proposal follows its own.
    m.remap(list('b', 'a'), [1, 0]);
    assert.equal(m.candidateAt(1), 'cand-a', 'frame a moved to position 1 and took it along');

    m.setCandidates([[0, 'cand-again']]);
    m.sync(list('cut-a', 'cut-b'));
    assert.equal(m.hasCandidates(), false, 'the preview contract: it does not outlive the list');
    m.sync(list('b', 'a'));
    assert.equal(m.hasCandidates(), false, 'and it is never stashed, so it cannot come back');
    assert.equal(m.maskFor(0), 'track-b', 'the committed masks DID come back');
});
