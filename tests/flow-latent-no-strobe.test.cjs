/**
 * flow-latent-no-strobe.test.cjs — MPI-591.
 *
 * The Flow pane rebuilt its <img> for EVERY live latent frame (`innerHTML = ''`, a new
 * element, fit on load). A new <img> is empty until its blob decodes, so between any
 * two frames the pane showed its own background. With a clip previewer painting at
 * 24 fps (H3's MpiVideoSamplingPreview, via previewClipPlayer) that is a full-pane
 * strobe, which Fabio flagged as a photosensitivity risk on Extend Video's first run.
 * The gallery card never did this: it decodes off-screen and swaps `src`.
 *
 * Source contract — MpiBaseFlow needs the full renderer to mount.
 *
 * NOT TESTABLE HERE: that the pane holds steady during a real run. That is Fabio's
 * check, watching Extend Video on H3 (MPI-591 validation.md).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
    path.join(__dirname, '..', 'js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js'), 'utf8');

function paintResultBody() {
    const start = src.indexOf('function _paintResult(');
    assert.ok(start > 0, '_paintResult exists');
    const end = src.indexOf('\n        }\n', start);
    return src.slice(start, end);
}

test('a latent already on screen is swapped in place, never rebuilt', () => {
    const body = paintResultBody();
    const swap = body.indexOf("classList.contains('mpi-base-flow__result-latent')");
    const rebuild = body.indexOf("innerHTML = ''");
    assert.ok(swap > 0, 'the on-screen latent is detected');
    assert.ok(rebuild > swap, 'the rebuild path comes after the swap branch');
    const branch = body.slice(swap, rebuild);
    assert.match(branch, /new Image\(\)/, 'the next frame decodes off-screen');
    assert.match(branch, /live\.src = url/, 'the element on screen takes the new src');
    assert.match(branch, /return;/, 'the swap branch never falls through to the rebuild');
});
