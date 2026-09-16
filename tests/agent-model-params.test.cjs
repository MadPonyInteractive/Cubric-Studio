'use strict';

/**
 * MPI-774 — `namedParamsFor` is what `GET /connector/models` tells an agent it may set
 * per op. It is only worth anything if it agrees with the validator that answers the
 * generate: every advertised value passes `resolveNamedParams`, and what it leaves out
 * is refused. Checked over EVERY shipped model and op, so a new model cannot drift.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { namedParamsFor, resolveNamedParams } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const PAIRS = MODELS.flatMap((m) => (m.supportedOps || []).map((op) => [m, op]));

test('every advertised param passes the validator, on every shipped model and op', () => {
    assert.ok(PAIRS.length > 20, 'the registry should carry real models');
    for (const [m, op] of PAIRS) {
        const p = namedParamsFor(m, op);
        const where = `${m.id}/${op}`;
        for (const ratio of p.ratios) {
            assert.equal(resolveNamedParams(null, m, op, { ratio }).ok, true, `${where} advertises ratio ${ratio}`);
        }
        for (const qualityTier of p.qualityTiers) {
            assert.equal(resolveNamedParams(null, m, op, { qualityTier }).ok, true, `${where} advertises tier ${qualityTier}`);
        }
        if (p.turbo) assert.equal(resolveNamedParams(null, m, op, { turbo: true }).ok, true, `${where} advertises turbo`);
        p.styles.forEach((_, i) => {
            assert.equal(resolveNamedParams(null, m, op, { styleSelect: i }).ok, true, `${where} advertises style ${i}`);
        });
    }
});

test('what is not advertised is refused', () => {
    for (const [m, op] of PAIRS) {
        const p = namedParamsFor(m, op);
        const where = `${m.id}/${op}`;
        if (!p.turbo) assert.equal(resolveNamedParams(null, m, op, { turbo: true }).code, 'INVALID_TURBO', where);
        if (!p.qualityTiers.length) assert.equal(resolveNamedParams(null, m, op, { qualityTier: 'medium' }).code, 'INVALID_QUALITY_TIER', where);
        if (!p.ratios.length) assert.equal(resolveNamedParams(null, m, op, { ratio: '1:1' }).code, 'INVALID_RATIO', where);
        if (!p.styles.length) assert.equal(resolveNamedParams(null, m, op, { styleSelect: 0 }).code, 'INVALID_STYLE_SELECT', where);
    }
});

test('the registry has both sides of each param, or the two tests above prove little', () => {
    const all = PAIRS.map(([m, op]) => namedParamsFor(m, op));
    for (const key of ['turbo']) {
        assert.ok(all.some((p) => p[key]) && all.some((p) => !p[key]), `${key} on some ops and off others`);
    }
    for (const key of ['ratios', 'qualityTiers', 'styles']) {
        assert.ok(all.some((p) => p[key].length) && all.some((p) => !p[key].length), `${key} on some ops and off others`);
    }
});
