// MPI-917 Phase 1 — mix recipe schema, validator and helpers.
//
// Things that fail silently if they regress:
//
//   1. validateMix accepting a malformed recipe — the render would use undefined
//      fields and produce a corrupt file or a silent crash.
//   2. validateMix allowing a crossfade on the last video clip — mixDuration
//      would subtract a crossfade that leads nowhere, reporting the wrong length.
//   3. validateMix allowing a crossfade longer than an adjacent clip — ffmpeg
//      would see a negative clip length or zero-length output.
//   4. mixDuration subtracting the last clip's crossfade — the mix would be
//      reported as shorter than it actually is.
//   5. resolveSolo making a muted+soloed track audible — a DAW user who silences
//      a track by muting it before soloing would unexpectedly hear it.
//   6. resolveSolo not muting non-solo tracks — the solo button would have no
//      effect.
//
// Each validateMix test checks ONE named error code.

'use strict';

const test   = require('node:test');
const assert = require('node:assert');

const load = () => import('../js/data/mixRecipe.js');

// ── Fixture helpers ───────────────────────────────────────────────────────────

function clip(overrides = {}) {
    return {
        id: 'cl1', itemId: 'item1', start: 0, in: 0, out: 5,
        volumeDb: 0, fadeIn: 0, fadeOut: 0, loop: false,
        ...overrides,
    };
}

function track(overrides = {}) {
    return {
        id: 'tr1', name: 'Voice', kind: 'audio', volumeDb: 0, pan: 0,
        mute: false, solo: false,
        clips: [clip()],
        ...overrides,
    };
}

function validRecipe(overrides = {}) {
    return {
        v: 1,
        videoLane: [],
        tracks: [track()],
        master: { volumeDb: 0 },
        ...overrides,
    };
}

// ── validateMix: acceptance ───────────────────────────────────────────────────

test('validateMix: a well-formed recipe is accepted', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe());
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.errors, []);
});

test('validateMix: videoAudio track kind is accepted', async () => {
    const { validateMix } = await load();
    assert.strictEqual(validateMix(validRecipe({ tracks: [track({ kind: 'videoAudio' })] })).ok, true);
});

test('validateMix: videoLane with a cut join is accepted', async () => {
    const { validateMix } = await load();
    assert.strictEqual(
        validateMix(validRecipe({
            videoLane: [{ itemId: 'v1', in: 0, out: 3, join: 'cut' }],
        })).ok, true);
});

test('validateMix: videoLane with a valid crossfade join is accepted', async () => {
    const { validateMix } = await load();
    // 0.5 s crossfade between a 3 s and a 4 s clip — valid
    const result = validateMix(validRecipe({
        videoLane: [
            { itemId: 'v1', in: 0, out: 3, join: { crossfade: 0.5 } },
            { itemId: 'v2', in: 0, out: 4, join: 'cut' },
        ],
    }));
    assert.strictEqual(result.ok, true,
        `unexpected errors: ${result.errors.map(e => e.code).join(', ')}`);
});

// ── validateMix: rejection with named errors ──────────────────────────────────

test('validateMix: null is rejected with not-an-object', async () => {
    const { validateMix } = await load();
    const result = validateMix(null);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'not-an-object'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: wrong v is rejected with bad-version', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({ v: 2 }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-version'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: missing master is rejected with bad-master', async () => {
    const { validateMix } = await load();
    const r = validRecipe();
    delete r.master;
    const result = validateMix(r);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-master'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: non-number master.volumeDb is rejected with bad-master-volume', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({ master: { volumeDb: 'loud' } }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-master-volume'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: non-array tracks is rejected with bad-tracks', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({ tracks: 'bad' }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-tracks'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: invalid track kind is rejected with bad-track-kind', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({ tracks: [track({ kind: 'midi' })] }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-track-kind'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: non-boolean mute is rejected with bad-track-mute', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({ tracks: [track({ mute: 1 })] }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-track-mute'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: non-boolean solo is rejected with bad-track-solo', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({ tracks: [track({ solo: 0 })] }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-track-solo'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: non-array videoLane is rejected with bad-video-lane', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({ videoLane: 'nope' }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-video-lane'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: video clip without itemId is rejected with bad-video-clip-item-id', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({
        videoLane: [{ in: 0, out: 3, join: 'cut' }],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-video-clip-item-id'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: video clip with invalid join shape is rejected with bad-video-clip-join', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({
        videoLane: [{ itemId: 'v1', in: 0, out: 3, join: { crossfade: 'slow' } }],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-video-clip-join'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: clip without itemId is rejected with bad-clip-item-id', async () => {
    const { validateMix } = await load();
    const c = clip();
    delete c.itemId;
    const result = validateMix(validRecipe({ tracks: [track({ clips: [c] })] }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-clip-item-id'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: clip with negative fadeIn is rejected with bad-clip-fade-in', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({
        tracks: [track({ clips: [clip({ fadeIn: -0.5 })] })],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-clip-fade-in'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: clip with negative fadeOut is rejected with bad-clip-fade-out', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({
        tracks: [track({ clips: [clip({ fadeOut: -1 })] })],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'bad-clip-fade-out'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

// ── validateMix: crossfade constraints ───────────────────────────────────────

test('validateMix: crossfade on the last video clip is rejected with video-crossfade-on-last', async () => {
    const { validateMix } = await load();
    // One-clip lane: there is no next clip to fade into
    const result = validateMix(validRecipe({
        videoLane: [{ itemId: 'v1', in: 0, out: 5, join: { crossfade: 1 } }],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'video-crossfade-on-last'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: crossfade on the last of a multi-clip lane is rejected with video-crossfade-on-last', async () => {
    const { validateMix } = await load();
    const result = validateMix(validRecipe({
        videoLane: [
            { itemId: 'v1', in: 0, out: 5, join: 'cut' },
            { itemId: 'v2', in: 0, out: 4, join: { crossfade: 1 } },  // last clip
        ],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'video-crossfade-on-last'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: crossfade >= this clip duration is rejected with video-crossfade-too-long', async () => {
    const { validateMix } = await load();
    // This clip is 2 s but crossfade is 3 s — impossible
    const result = validateMix(validRecipe({
        videoLane: [
            { itemId: 'v1', in: 0, out: 2, join: { crossfade: 3 } },
            { itemId: 'v2', in: 0, out: 5, join: 'cut' },
        ],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'video-crossfade-too-long'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

test('validateMix: crossfade >= next clip duration is rejected with video-crossfade-too-long', async () => {
    const { validateMix } = await load();
    // Next clip is 1 s but crossfade is 2 s — impossible
    const result = validateMix(validRecipe({
        videoLane: [
            { itemId: 'v1', in: 0, out: 5, join: { crossfade: 2 } },
            { itemId: 'v2', in: 0, out: 1, join: 'cut' },
        ],
    }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(e => e.code === 'video-crossfade-too-long'),
        `codes: ${result.errors.map(e => e.code).join(', ')}`);
});

// ── mixDuration ───────────────────────────────────────────────────────────────

test('mixDuration: empty recipe is 0 seconds', async () => {
    const { mixDuration } = await load();
    assert.strictEqual(mixDuration({ videoLane: [], tracks: [] }), 0);
});

test('mixDuration: video lane without crossfades sums clip durations', async () => {
    const { mixDuration } = await load();
    assert.strictEqual(mixDuration({
        videoLane: [
            { itemId: 'v1', in: 0, out: 3, join: 'cut' },
            { itemId: 'v2', in: 0, out: 4, join: 'cut' },
        ],
        tracks: [],
    }), 7);
});

test('mixDuration: crossfades shorten the total duration', async () => {
    const { mixDuration } = await load();
    // 5 s + 4 s − 1 s crossfade = 8 s
    assert.strictEqual(mixDuration({
        videoLane: [
            { itemId: 'v1', in: 0, out: 5, join: { crossfade: 1 } },
            { itemId: 'v2', in: 0, out: 4, join: 'cut' },
        ],
        tracks: [],
    }), 8);
});

test('mixDuration: crossfade on the last clip is NOT subtracted', async () => {
    const { mixDuration } = await load();
    // A recipe that validation would reject — but mixDuration must not
    // silently shorten the total if it ever sees this shape.
    assert.strictEqual(mixDuration({
        videoLane: [
            { itemId: 'v1', in: 0, out: 5, join: { crossfade: 2 } },  // last clip
        ],
        tracks: [],
    }), 5);  // 5 s, not 3 s
});

test('mixDuration: two back-to-back crossfades both shorten', async () => {
    const { mixDuration } = await load();
    // 3 + 3 + 3 − 0.5 − 0.5 = 8
    assert.strictEqual(mixDuration({
        videoLane: [
            { itemId: 'v1', in: 0, out: 3, join: { crossfade: 0.5 } },
            { itemId: 'v2', in: 0, out: 3, join: { crossfade: 0.5 } },
            { itemId: 'v3', in: 0, out: 3, join: 'cut' },
        ],
        tracks: [],
    }), 8);
});

test('mixDuration: track clips extending past video lane set the duration', async () => {
    const { mixDuration } = await load();
    assert.strictEqual(mixDuration({
        videoLane: [{ itemId: 'v1', in: 0, out: 5, join: 'cut' }],
        tracks: [{
            id: 'tr1', name: 'Music', kind: 'audio', volumeDb: 0, pan: 0,
            mute: false, solo: false,
            clips: [clip({ start: 0, in: 0, out: 10 })],
        }],
    }), 10);
});

test('mixDuration: clip with non-zero start contributes start + length', async () => {
    const { mixDuration } = await load();
    assert.strictEqual(mixDuration({
        videoLane: [],
        tracks: [{
            id: 'tr1', name: 'SFX', kind: 'audio', volumeDb: 0, pan: 0,
            mute: false, solo: false,
            clips: [clip({ start: 7, in: 0, out: 3 })],
        }],
    }), 10);
});

// ── resolveSolo ───────────────────────────────────────────────────────────────

test('resolveSolo: no solo — tracks keep their own mute state', async () => {
    const { resolveSolo } = await load();
    const result = resolveSolo([
        { id: 'a', mute: false, solo: false },
        { id: 'b', mute: true,  solo: false },
    ]);
    assert.strictEqual(result[0].effectiveMute, false);
    assert.strictEqual(result[1].effectiveMute, true);
});

test('resolveSolo: one solo mutes every non-solo track', async () => {
    const { resolveSolo } = await load();
    const result = resolveSolo([
        { id: 'a', mute: false, solo: true  },
        { id: 'b', mute: false, solo: false },
        { id: 'c', mute: true,  solo: false },
    ]);
    assert.strictEqual(result[0].effectiveMute, false, 'solo track must not be muted');
    assert.strictEqual(result[1].effectiveMute, true,  'non-solo must be muted when solo exists');
    assert.strictEqual(result[2].effectiveMute, true,  'already-muted non-solo stays muted');
});

test('resolveSolo: muted + soloed track stays muted, its solo still mutes the others', async () => {
    const { resolveSolo } = await load();
    const result = resolveSolo([
        { id: 'a', mute: true,  solo: true  },  // muted AND soloed
        { id: 'b', mute: false, solo: false },   // should be muted by the solo above
    ]);
    assert.strictEqual(result[0].effectiveMute, true,
        'mute wins: a muted+soloed track must stay silent');
    assert.strictEqual(result[1].effectiveMute, true,
        "track a's solo must still suppress non-solo track b");
});

test('resolveSolo: multiple solos — only non-solo tracks are muted', async () => {
    const { resolveSolo } = await load();
    const result = resolveSolo([
        { id: 'a', mute: false, solo: true  },
        { id: 'b', mute: false, solo: true  },
        { id: 'c', mute: false, solo: false },
    ]);
    assert.strictEqual(result[0].effectiveMute, false);
    assert.strictEqual(result[1].effectiveMute, false);
    assert.strictEqual(result[2].effectiveMute, true);
});

test('resolveSolo: does not mutate the input tracks', async () => {
    const { resolveSolo } = await load();
    const tracks = [{ id: 'a', mute: false, solo: true }, { id: 'b', mute: false, solo: false }];
    const before = tracks.map(t => ({ ...t }));
    resolveSolo(tracks);
    assert.deepStrictEqual(tracks[0], before[0]);
    assert.deepStrictEqual(tracks[1], before[1]);
});

test('resolveSolo: output carries all original track fields', async () => {
    const { resolveSolo } = await load();
    const tracks = [{ id: 'tr1', name: 'Voice', mute: false, solo: false, volumeDb: -3 }];
    const result = resolveSolo(tracks);
    assert.strictEqual(result[0].id, 'tr1');
    assert.strictEqual(result[0].name, 'Voice');
    assert.strictEqual(result[0].volumeDb, -3);
});
