'use strict';

// The History workspace's media rule. MPI-351 once collapsed an image run to the
// selected entry, because one persisted, INVISIBLE rail chip (state.promptMedia,
// re-injected on every mount) owned Input_Image run after run: upscale_002-005 and
// upscale_007 all recorded a two-hour-old kleinEdit output while a fresh crop was
// the active entry. MPI-721 (image) and MPI-1015 (video) fixed it structurally: the
// open entry is itself a pinned, numbered chip, the box persists nothing for
// 'history', and the strip goes to dispatch as-is, so nothing a run consumes is
// off-screen.
//
// Video (MPI-1015): the clip is a chip only on an op that takes a video (the
// reference ops), or the frame its tag swapped it for; on a picture-animating op it
// is no chip and is not sent (Fabio: a clip that is ALWAYS an input is the problem,
// and Wan bills a reference clip's seconds).
//
// Mirrored from source: js/components/Blocks/MpiGroupHistoryBlock/
// MpiGroupHistoryBlock.js  _syncEntryChip + _generationFromPromptPayload.
// The real thing runs in tests/desktop/video-history-strip.spec.js.

const assert = require('node:assert/strict');
const test = require('node:test');

// --- op media-input contract stub (mirrors commandRegistry) ---
const SLOTS = {
    upscale: [{ key: 'inputImage', mediaType: 'image' }],
    i2v:     [{ key: 'startFrame', mediaType: 'image' }, { key: 'endFrame', mediaType: 'image' }],
    ref2v:   [{ key: 'inputImage', mediaType: 'image' }, { key: 'inputVideo', mediaType: 'video' }],
};
const getCommandMediaInputs = (op) => SLOTS[op] || [];

// --- the pinned chip under test (`_syncEntryChip`) ---
function pinFor({ isVideo, item, operation, clipFrame = null }) {
    if (!isVideo) return item?.filePath ? { url: item.filePath } : null;
    if (clipFrame && clipFrame.entryId !== item?.id) clipFrame = null;
    const takesVideo = getCommandMediaInputs(operation).some(s => s.mediaType === 'video');
    return !item?.filePath || !takesVideo ? null
        : clipFrame ? { url: clipFrame.url, mediaType: 'image', swappable: true }
        : { url: item.filePath, mediaType: 'video', swappable: true };
}
// `_generationFromPromptPayload`: the strip IS the media, no prepend, no discard.
const dispatchMedia = (mediaItems) => mediaItems;

const crop  = { id: 'c', filePath: 'Media/crop_011.png' };
const clip  = { id: 'v', filePath: 'Media/i2v_ms_024.mp4' };
const frame = { entryId: 'v', url: 'Media/frame-reference_001.png' };

test('image history: the open entry is always the pinned chip', () => {
    assert.deepEqual(pinFor({ isVideo: false, item: crop, operation: 'upscale' }), { url: crop.filePath });
});

test('video history: on a reference op the clip is the pinned chip, swappable', () => {
    assert.deepEqual(pinFor({ isVideo: true, item: clip, operation: 'ref2v' }),
        { url: clip.filePath, mediaType: 'video', swappable: true });
});

test('video history: a swapped clip is the frame, as a picture', () => {
    assert.deepEqual(pinFor({ isVideo: true, item: clip, operation: 'ref2v', clipFrame: frame }),
        { url: frame.url, mediaType: 'image', swappable: true });
});

test('video history: another entry drops the swapped frame and pins its own clip', () => {
    const other = { id: 'w', filePath: 'Media/i2v_ms_025.mp4' };
    assert.equal(pinFor({ isVideo: true, item: other, operation: 'ref2v', clipFrame: frame }).url, other.filePath);
});

test('video history: a picture-animating op takes no clip, swapped or not', () => {
    assert.equal(pinFor({ isVideo: true, item: clip, operation: 'i2v' }), null);
    assert.equal(pinFor({ isVideo: true, item: clip, operation: 'i2v', clipFrame: frame }), null);
});

test('both kinds: what the strip holds is what the run is sent', () => {
    const strip = [{ mediaType: 'video', url: clip.filePath }, { mediaType: 'image', url: 'Media/ref.png' }];
    assert.deepEqual(dispatchMedia(strip), strip);
});
