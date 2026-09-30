'use strict';

// MPI-971 Phase 3 (P-A) — an upscale may not make a picture past 16384 on the long edge
// (sharp's and ffmpeg's ceiling). The rail greys the factors past it and the executor
// refuses them for every producer; this pins the rule and the ops it guards.

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (rel) => import(pathToFileURL(path.join(__dirname, '..', ...rel.split('/'))).href);
const FACTORS = [1.5, 2, 3, 4];

test('a factor is refused only when the output passes 16384', async () => {
    const { upscaleRefusal, UPSCALE_MAX_EDGE } = await load('js/utils/upscaleLimit.js');
    assert.equal(UPSCALE_MAX_EDGE, 16384);
    const allowed = (w, h) => FACTORS.filter(f => !upscaleRefusal(w, h, f));
    // Within the engine cap: every factor, as before.
    assert.deepEqual(allowed(4096, 4096), FACTORS);
    assert.deepEqual(allowed(4096, 2304), FACTORS);
    // x1.5 lands exactly on the limit; x2 is past it.
    assert.deepEqual(allowed(10922, 7000), [1.5]);
    // A 12K or a 16K offers none, and says why in numbers.
    assert.deepEqual(allowed(12000, 8000), []);
    assert.deepEqual(allowed(16384, 16384), []);
    assert.match(upscaleRefusal(16384, 16384, 2), /16384x16384 at x2 would be 32768 px .* 16384/);
    // Portrait counts its long edge.
    assert.deepEqual(allowed(3000, 6000), [1.5, 2]);
});

test('the guard covers every op whose output is its input times the factor', async () => {
    const { commands } = await load('js/data/commandRegistry.js');
    const flagged = Object.keys(commands).filter(k => commands[k].enlarges).sort();
    // Changing this list means reading the graph: the factor must be Input_Upscale_Factor.
    assert.deepEqual(flagged, ['imageUpscale', 'upscale']);
});
