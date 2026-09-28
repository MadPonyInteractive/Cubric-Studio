/**
 * MPI-967 — `fitsHardware`, the rule behind the Libraries' "Fits my GPU" filter.
 *
 * A model fits when the card reaches the VRAM table's floor AND system RAM covers the
 * spill at THAT card's VRAM. Pinned on synthetic models (weights 0, so only the floor and
 * the overrides move) plus the rounding that keeps a 16GB card reporting ~15.99 in.
 */
const test = require('node:test');
const assert = require('assert');
const { fitsHardware, tradeTable, ramNeededGb } = require('../js/data/modelConstants/footprint.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const NO_WEIGHTS = { dependencies: [] };                  // floor = MIN_FLOOR 8, RAM need 0
const H3_LIKE = { dependencies: [], minVramGb: 12 };      // measured floor override

test('VRAM below the floor never fits, at or above it does', () => {
    assert.strictEqual(fitsHardware(NO_WEIGHTS, 'local', 6, 64), false);
    assert.strictEqual(fitsHardware(NO_WEIGHTS, 'local', 8, 64), true);
    assert.strictEqual(fitsHardware(H3_LIKE, 'local', 8, 64), false, 'minVramGb override is the floor');
    assert.strictEqual(fitsHardware(H3_LIKE, 'local', 12, 64), true);
});

test('a card reporting just under its size still meets a floor of that size', () => {
    assert.strictEqual(fitsHardware({ dependencies: [], minVramGb: 16 }, 'local', 15.99, 64), true);
});

test('no GPU found fits nothing; unknown RAM is not held against the model', () => {
    assert.strictEqual(fitsHardware(NO_WEIGHTS, 'local', null, 64), false);
    assert.strictEqual(fitsHardware(NO_WEIGHTS, 'local', 0, 64), false);
    assert.strictEqual(fitsHardware(NO_WEIGHTS, 'local', 24, null), true);
});

test('RAM is judged at the machine\'s own VRAM, not the nearest table row', () => {
    // The heaviest local model: its spill at a floor-level card is real RAM.
    const heavy = MODELS.filter(m => !m.provider)
        .map(m => ({ m, t: tradeTable(m, 'local') }))
        .sort((a, b) => b.t.totalWeights - a.t.totalWeights)[0];
    const vram = heavy.t.vramFloor;
    const need = ramNeededGb(heavy.t.totalWeights, vram);
    assert.ok(need > 0, `${heavy.m.id} must spill at its floor for this test to mean anything`);
    assert.strictEqual(fitsHardware(heavy.m, 'local', vram, need), true, 'exactly the need fits');
    assert.strictEqual(fitsHardware(heavy.m, 'local', vram, need - 4), false, 'one RAM step short does not');
    // More VRAM means less spill, so the same RAM that was short now fits.
    const moreVram = vram + 16;
    assert.ok(ramNeededGb(heavy.t.totalWeights, moreVram) <= need - 4);
    assert.strictEqual(fitsHardware(heavy.m, 'local', moreVram, need - 4), true);
});
