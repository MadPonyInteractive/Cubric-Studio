/**
 * text-only-op.test.cjs — a video dropped on Seedance 2.0 / Wan 3.0 made no chip (2026-10-02).
 *
 * `isTextOnlyOp` judged an op by what it REQUIRES. `ref2v` and `ref2v_ms` require nothing
 * (every reference slot is optional) yet take nine images, three videos and three audio
 * clips, so they read as text-only. The prompt box then treated a staged chip on `ref2v` as
 * media a text op cannot hold, and `_pickFallbackOp` (which only looked at ops that REQUIRE
 * media) moved the box to `i2v`, whose prune deleted the video. Fabio: "none of the cloud
 * models that take video create a chip when I drag a video to the prompt box".
 *
 * Text-only now means what every caller asks: the op declares no image or video slot.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const SEEDANCE2 = { id: 'seedance-2-cloud', mediaType: 'video', supportedOps: ['t2v', 'i2v', 'ref2v'],
    capabilities: { audio: true, endFrame: true } };

test('an op with only optional reference slots is NOT text-only', async () => {
    const { isTextOnlyOp } = await import('../js/data/commandRegistry.js');
    assert.strictEqual(isTextOnlyOp('ref2v'), false, 'ref2v takes images, videos and audio');
    assert.strictEqual(isTextOnlyOp('ref2v_ms'), false, 'ref2v_ms takes images, videos and audio');
    // Unchanged: no image/video slot at all. t2v_ms's only slot is audio.
    assert.strictEqual(isTextOnlyOp('t2v'), true);
    assert.strictEqual(isTextOnlyOp('t2v_ms'), true);
    assert.strictEqual(isTextOnlyOp('t2i'), true);
    assert.strictEqual(isTextOnlyOp('i2v'), false);
});

test('the text-only op a video model drops to is t2v, never ref2v', async () => {
    const { pickTextOnlyOp } = await import('../js/data/commandRegistry.js');
    assert.strictEqual(pickTextOnlyOp('video', SEEDANCE2, { imageCount: 0, videoCount: 0 }), 't2v');
    const refOnly = { id: 'minimax-h3-ref2va', mediaType: 'video', supportedOps: ['ref2v_ms'], capabilities: { audio: true } };
    assert.strictEqual(pickTextOnlyOp('video', refOnly, { imageCount: 0, videoCount: 0 }), null,
        'a reference-only card has no text op to drop to');
});
