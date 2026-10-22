'use strict';
// MPI-1232: denoiseDefaultFor returns the tile-aware default, and resolveNamedParams
// uses it so the agent path and the PromptBox slider share one contract.

const assert = require('node:assert/strict');
const test = require('node:test');

const { denoiseDefaultFor, resolveNamedParams } = require('../js/data/generationControls.js');
const { PROMPT_CONTROL_DEFAULTS } = require('../js/data/promptControlDefaults.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const KREA2 = MODELS.find((m) => m.id === 'krea2');

test('denoiseDefaultFor: tiles on returns tilesDenoise (0.3), off returns op default (0.2)', () => {
    assert.equal(denoiseDefaultFor('upscale', true),  PROMPT_CONTROL_DEFAULTS.tilesDenoise,
        'tiles on → tilesDenoise');
    assert.equal(denoiseDefaultFor('upscale', false), PROMPT_CONTROL_DEFAULTS.denoise,
        'tiles off → plain denoise default');
    assert.equal(PROMPT_CONTROL_DEFAULTS.tilesDenoise, 0.3, 'tilesDenoise is 0.3');
    assert.equal(PROMPT_CONTROL_DEFAULTS.denoise, 0.2, 'plain denoise default is 0.2');
});

test('denoiseDefaultFor: non-upscale op with tilesOn=false returns that op\'s default', () => {
    // `detail` op has its own commandRegistry default (0.3). With tiles false, that wins.
    const result = denoiseDefaultFor('detail', false);
    assert.ok(typeof result === 'number' && result >= 0 && result <= 1, 'returns a valid denoise');
    // Tiles on should still return tilesDenoise (0.3).
    assert.equal(denoiseDefaultFor('detail', true), PROMPT_CONTROL_DEFAULTS.tilesDenoise);
});

test('resolveNamedParams: no saved denoise, tiles on → Denoise 0.3; tiles off → 0.2', () => {
    const onResult = resolveNamedParams(null, KREA2, 'upscale', { tiles: true, upscaleFactor: 1 });
    assert.equal(onResult.ok, true);
    assert.equal(onResult.injectionParams.Denoise, PROMPT_CONTROL_DEFAULTS.tilesDenoise,
        'tiles on, no saved → 0.3');

    const offResult = resolveNamedParams(null, KREA2, 'upscale', { tiles: false, upscaleFactor: 1.5 });
    assert.equal(offResult.ok, true);
    assert.equal(offResult.injectionParams.Denoise, PROMPT_CONTROL_DEFAULTS.denoise,
        'tiles off, no saved → 0.2');
});

test('resolveNamedParams: saved denoise wins over tiles default', () => {
    const project = {
        shared: { image: { useTiles: true } },
        modelSettings: { krea2: { operations: { upscale: { denoise: 0.55 } } } },
    };
    const r = resolveNamedParams(project, KREA2, 'upscale', {});
    assert.equal(r.ok, true);
    assert.equal(r.injectionParams.Denoise, 0.55, 'saved 0.55 wins over tilesDenoise 0.3');
});

test('resolveNamedParams: asked denoise wins over tiles default', () => {
    const r = resolveNamedParams(null, KREA2, 'upscale', { tiles: true, upscaleFactor: 1, denoise: 0.4 });
    assert.equal(r.ok, true);
    assert.equal(r.injectionParams.Denoise, 0.4, 'asked 0.4 wins over tilesDenoise 0.3');
});
