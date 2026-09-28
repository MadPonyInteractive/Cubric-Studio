'use strict';

/**
 * MPI-968 — `fit` on GET /connector/models. `runs` came from the trade table's nearest
 * row, which is flagged whenever a VRAM is known, so a model floored at 16GB read
 * `runs: true` on a 12GB card and MPI-916's best/runsHere skip in agentLoop never fired.
 * It is the Library's `fitsHardware` rule now, and the RAM is the machine's own point.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { modelFit } = require('../routes/connector');
const fp = require('../js/data/modelConstants/footprint.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const FLOOR_16 = { dependencies: [], minVramGb: 16 };

test('a model floored above the card does not run on it', () => {
    const fit = modelFit(fp, FLOOR_16, 'local', { vramGb: 12, ramGb: 64 });
    assert.equal(fit.floorVramGb, 16);
    assert.equal(fit.runs, false);
    assert.equal(modelFit(fp, FLOOR_16, 'local', { vramGb: 15.99, ramGb: 64 }).runs, true);
});

test('RAM is the need at the machine\'s own VRAM, and short RAM does not run', () => {
    const heavy = MODELS.filter((m) => !m.provider)
        .map((m) => ({ m, t: fp.tradeTable(m, 'local') }))
        .sort((a, b) => b.t.totalWeights - a.t.totalWeights)[0];
    const vram = heavy.t.vramFloor + 4;                       // off the table's rows
    const need = fp.ramNeededGb(heavy.t.totalWeights, vram);
    assert.ok(need > 0, `${heavy.m.id} must spill at ${vram}GB for this to mean anything`);
    const fit = modelFit(fp, heavy.m, 'local', { vramGb: vram, ramGb: need });
    assert.equal(fit.ramGbAtYourVram, need);
    assert.equal(fit.runs, true);
    assert.equal(modelFit(fp, heavy.m, 'local', { vramGb: vram, ramGb: need - 4 }).runs, false);
});

test('a cloud model carries no fit, so a small card never reads runsHere: false on it', () => {
    const cloud = MODELS.find((m) => m.provider);
    assert.ok(cloud, 'the registry should carry a cloud model');
    assert.equal(modelFit(fp, cloud, 'local', { vramGb: 6, ramGb: 16 }), null);
});

test('unknown VRAM runs nothing and has no RAM figure', () => {
    const fit = modelFit(fp, { dependencies: [] }, 'local', { vramGb: null, ramGb: 64 });
    assert.equal(fit.runs, false);
    assert.equal(fit.ramGbAtYourVram, null);
});
