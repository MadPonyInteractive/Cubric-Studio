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

// Fabio, 2026-09-20: asked for "1K", expecting 1920x1088, and got 1664x960. The agent was
// handed tier NAMES only and picked `high` off the name; full HD is `very_high`. `tierSizes`
// gives it the pixels. Pinned on the two cells of that turn, and on every model: a size is
// only ever listed for a tier and a ratio the op advertises.
test('tierSizes gives the real pixels per tier and ratio, so a named resolution is matched on numbers', () => {
    const h3 = MODELS.find((m) => m.id === 'minimax-h3');
    const p = namedParamsFor(h3, 't2v_ms');
    assert.equal(p.tierSizes.high['16:9'], '1664x960');
    assert.equal(p.tierSizes.very_high['16:9'], '1920x1088');
    assert.equal(p.tierSizes.very_high['9:16'], '1088x1920');

    for (const [m, op] of PAIRS) {
        const q = namedParamsFor(m, op);
        const where = `${m.id}/${op}`;
        for (const [tier, sizes] of Object.entries(q.tierSizes)) {
            assert.ok(q.qualityTiers.includes(tier), `${where} sizes a tier it does not advertise: ${tier}`);
            for (const [label, size] of Object.entries(sizes)) {
                assert.ok(q.ratios.includes(label), `${where} sizes a ratio it does not advertise: ${label}`);
                assert.match(size, /^\d+x\d+$/, where);
            }
        }
        if (q.qualityTiers.length && q.ratios.length) {
            assert.deepEqual(Object.keys(q.tierSizes).sort(), [...q.qualityTiers].sort(), `${where} leaves a tier unsized`);
        }
    }
});

// Fabio, 2026-09-17: an agent's Klein edit landed in a 1:1 card while the image was
// 832x1248. The op sizes its own output, but the project's saved ratio was injected anyway,
// and the card took its size from that. Unset ratio = the project's, only where one applies.
test("the project's saved ratio is injected only on an op that takes a ratio", () => {
    const { modelShowsRatio } = require('../js/data/commandRegistry.js');
    const ratioSelector = { selectedRatio: '1:1', orientation: 'portrait' };
    const project = { shared: { image: { ratioSelector }, video: { ratioSelector } } };
    let sized = 0;
    let ratioed = 0;
    for (const [m, op] of PAIRS) {
        const where = `${m.id}/${op}`;
        const r = resolveNamedParams(project, m, op, {});
        assert.equal(r.ok, true, where);
        if (modelShowsRatio(m, op)) {
            if (r.injectionParams.Width) ratioed += 1;
            continue;
        }
        sized += 1;
        for (const k of ['Width', 'Height', 'Ratio_Label']) assert.equal(r.injectionParams[k], undefined, `${where} injects ${k}`);
    }
    assert.ok(sized > 0 && ratioed > 0, 'both kinds of op are in the registry');
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
