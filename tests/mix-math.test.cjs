// MPI-917 Phase 1 — shared audio maths for the Mix workspace.
//
// These numbers must agree between the Web Audio live preview and the ffmpeg
// render (plan § "Preview vs render must agree"). Wrong values produce a mix
// that sounds different from the render, and since both engines share this
// module a regression breaks both in the same direction and can go unnoticed.
//
// Things worth guarding:
//
//   1. dbToGain round-trips dB (a typo in the exponent base is catastrophic).
//   2. panGains mono centre: −3.01 dB per channel (W3C equal-power law).
//   3. panGains stereo: full 2×2 matrix — cross-feed into L on a left pan must
//      be present; dropping it makes the render disagree with the Web Audio
//      preview (which follows the W3C StereoPannerNode cross-feed algorithm).
//   4. fadeGainAt midpoint: −6.02 dB (linear = ffmpeg afade curve=tri).
//   5. ffmpegPanExpr emits cross-feed terms correctly.
//
// The require()-from-CJS test covers the routes/ loading contract (connector.js:80).

'use strict';

const test   = require('node:test');
const assert = require('node:assert');

// The routes/ precedent: require() a .js ES module directly from a .cjs file.
const mixMathSync = require('../js/data/mixMath.js');

const load = () => import('../js/data/mixMath.js');

const DB_TOLERANCE = 0.02; // dB

function gainToDb(g) { return 20 * Math.log10(g); }

/**
 * Parse a `pan=stereo|c0=<expr>|c1=<expr>` string into a 2×2 gain matrix by
 * evaluating each expression with unit test inputs.  Handles constants (0),
 * bare channels (c0, c1), scaled channels (0.707*c0), and sums (c0+0.707*c1).
 */
function evalPanFilter(expr) {
    const parts = expr.split('|');
    const c0src = parts[1];  // "c0=<expr>"
    const c1src = parts[2];  // "c1=<expr>"

    function evalExpr(src, inL, inR) {
        // Strip "c0=" or "c1=" prefix
        const e = src.replace(/^c[01]=/, '');
        let total = 0;
        for (const raw of e.split('+')) {
            const t = raw.trim();
            if (t === '0')  continue;
            if (t === 'c0') { total += inL; continue; }
            if (t === 'c1') { total += inR; continue; }
            const m = t.match(/^([\d.e+\-]+)\*(c[01])$/);
            if (m) {
                const coeff = parseFloat(m[1]);
                total += coeff * (m[2] === 'c0' ? inL : inR);
            }
        }
        return total;
    }

    // ll: outL when inL=1, inR=0 — lr: outL when inL=0, inR=1
    // rl: outR when inL=1, inR=0 — rr: outR when inL=0, inR=1
    return {
        ll: evalExpr(c0src, 1, 0),
        lr: evalExpr(c0src, 0, 1),
        rl: evalExpr(c1src, 1, 0),
        rr: evalExpr(c1src, 0, 1),
    };
}

// ── require()-from-CJS (routes/ contract) ────────────────────────────────────

test('mixMath can be require()d from a .cjs file', () => {
    assert.strictEqual(typeof mixMathSync.dbToGain,           'function');
    assert.strictEqual(typeof mixMathSync.panGains,           'function');
    assert.strictEqual(typeof mixMathSync.fadeGainAt,         'function');
    assert.strictEqual(typeof mixMathSync.ffmpegPanExpr,      'function');
    assert.strictEqual(typeof mixMathSync.LIMITER_CEILING_DB, 'number');
});

// ── dbToGain ─────────────────────────────────────────────────────────────────

test('dbToGain(0) is unity', async () => {
    const { dbToGain } = await load();
    assert.ok(Math.abs(dbToGain(0) - 1) < 1e-9);
});

test('dbToGain(-6) round-trips to −6 dB', async () => {
    const { dbToGain } = await load();
    assert.ok(Math.abs(gainToDb(dbToGain(-6)) - (-6)) < DB_TOLERANCE);
});

test('LIMITER_CEILING_DB is negative and its gain is below unity', async () => {
    const { dbToGain, LIMITER_CEILING_DB } = await load();
    assert.ok(LIMITER_CEILING_DB < 0, 'ceiling must be below 0 dBFS');
    assert.ok(dbToGain(LIMITER_CEILING_DB) < 1, 'ceiling gain must be below unity');
});

// ── panGains — mono ───────────────────────────────────────────────────────────

test('panGains: centre mono gives −3.01 dB per channel', async () => {
    const { panGains } = await load();
    const { ll, rl, lr, rr } = panGains(0, 1);
    // For mono lr = rr = 0 (no second input channel)
    assert.ok(Math.abs(lr) < 1e-9, `lr should be 0, got ${lr}`);
    assert.ok(Math.abs(rr) < 1e-9, `rr should be 0, got ${rr}`);
    const LdB = gainToDb(ll);
    const RdB = gainToDb(rl);
    assert.ok(Math.abs(LdB - (-3.0103)) < DB_TOLERANCE,
        `ll: expected −3.01 dB, got ${LdB.toFixed(4)} dB`);
    assert.ok(Math.abs(RdB - (-3.0103)) < DB_TOLERANCE,
        `rl: expected −3.01 dB, got ${RdB.toFixed(4)} dB`);
});

test('panGains: mono hard left (p=−1) sends all signal to L, R is silent', async () => {
    const { panGains } = await load();
    const { ll, lr, rl, rr } = panGains(-1, 1);
    assert.ok(Math.abs(ll - 1) < 1e-9, `ll should be 1, got ${ll}`);
    assert.ok(Math.abs(lr)     < 1e-9, `lr should be 0, got ${lr}`);
    assert.ok(Math.abs(rl)     < 1e-9, `rl should be 0, got ${rl}`);
    assert.ok(Math.abs(rr)     < 1e-9, `rr should be 0, got ${rr}`);
});

test('panGains: mono hard right (p=1) sends all signal to R, L is silent', async () => {
    const { panGains } = await load();
    const { ll, lr, rl, rr } = panGains(1, 1);
    assert.ok(Math.abs(ll)     < 1e-9, `ll should be 0, got ${ll}`);
    assert.ok(Math.abs(lr)     < 1e-9, `lr should be 0, got ${lr}`);
    assert.ok(Math.abs(rl - 1) < 1e-9, `rl should be 1, got ${rl}`);
    assert.ok(Math.abs(rr)     < 1e-9, `rr should be 0, got ${rr}`);
});

// ── panGains — stereo ─────────────────────────────────────────────────────────

test('panGains: stereo centre is unity with no cross-feed', async () => {
    const { panGains } = await load();
    const { ll, lr, rl, rr } = panGains(0, 2);
    assert.ok(Math.abs(ll - 1) < 1e-9, `ll should be 1, got ${ll}`);
    assert.ok(Math.abs(lr)     < 1e-9, `lr (cross-feed L←R) should be 0 at centre, got ${lr}`);
    assert.ok(Math.abs(rl)     < 1e-9, `rl (cross-feed R←L) should be 0 at centre, got ${rl}`);
    assert.ok(Math.abs(rr - 1) < 1e-9, `rr should be 1, got ${rr}`);
});

test('panGains: stereo hard left — inL and inR both fold to L, R is silent', async () => {
    // W3C: p=-1, x=0; outL = inL + inR·cos(0) = inL + inR; outR = inR·sin(0) = 0
    const { panGains } = await load();
    const { ll, lr, rl, rr } = panGains(-1, 2);
    assert.ok(Math.abs(ll - 1) < 1e-9, `ll should be 1 (inL → outL), got ${ll}`);
    assert.ok(Math.abs(lr - 1) < 1e-9, `lr should be 1 (inR → outL), got ${lr}`);
    assert.ok(Math.abs(rl)     < 1e-9, `rl should be 0 (nothing → outR), got ${rl}`);
    assert.ok(Math.abs(rr)     < 1e-9, `rr should be 0 (inR → outR is silent), got ${rr}`);
});

test('panGains: stereo hard right — inL and inR both fold to R, L is silent', async () => {
    // W3C: p=1, x=1; outL = inL·cos(π/2) = 0; outR = inR + inL·sin(π/2) = inR + inL
    const { panGains } = await load();
    const { ll, lr, rl, rr } = panGains(1, 2);
    assert.ok(Math.abs(ll)     < 1e-9, `ll should be 0 (inL → outL is silent), got ${ll}`);
    assert.ok(Math.abs(lr)     < 1e-9, `lr should be 0, got ${lr}`);
    assert.ok(Math.abs(rl - 1) < 1e-9, `rl should be 1 (inL → outR), got ${rl}`);
    assert.ok(Math.abs(rr - 1) < 1e-9, `rr should be 1 (inR → outR), got ${rr}`);
});

test('panGains: stereo p=−0.5 matches the W3C formula', async () => {
    // W3C: p=-0.5, x = -0.5+1 = 0.5
    //   outL = inL + inR·cos(0.5·π/2) = inL + inR·cos(π/4)
    //   outR = inR·sin(π/4)
    const { panGains } = await load();
    const { ll, lr, rl, rr } = panGains(-0.5, 2);
    const expected_lr = Math.cos(0.5 * Math.PI / 2); // cos(π/4) = √2/2 ≈ 0.7071
    const expected_rr = Math.sin(0.5 * Math.PI / 2); // sin(π/4) = √2/2 ≈ 0.7071
    assert.ok(Math.abs(ll - 1)           < 1e-9, `ll should be 1, got ${ll}`);
    assert.ok(Math.abs(lr - expected_lr) < 1e-9, `lr should be ${expected_lr}, got ${lr}`);
    assert.ok(Math.abs(rl)               < 1e-9, `rl should be 0, got ${rl}`);
    assert.ok(Math.abs(rr - expected_rr) < 1e-9, `rr should be ${expected_rr}, got ${rr}`);
});

// ── fadeGainAt ───────────────────────────────────────────────────────────────

test('fadeGainAt: outside any fade the gain is unity', async () => {
    const { fadeGainAt } = await load();
    const clip = { start: 0, in: 0, out: 10, fadeIn: 1, fadeOut: 1 };
    assert.ok(Math.abs(fadeGainAt(5, clip) - 1) < 1e-9);
});

test('fadeGainAt: start of a fade-in clip has gain 0', async () => {
    const { fadeGainAt } = await load();
    const clip = { start: 0, in: 0, out: 5, fadeIn: 2, fadeOut: 0 };
    assert.ok(Math.abs(fadeGainAt(0, clip)) < 1e-9);
});

test('fadeGainAt: midpoint of a linear fade gives −6.02 dB (gain = 0.5)', async () => {
    const { fadeGainAt } = await load();
    // Fade-in of 2 s — midpoint is at t = 1
    const clip = { start: 0, in: 0, out: 10, fadeIn: 2, fadeOut: 0 };
    const gain = fadeGainAt(1, clip);
    assert.ok(Math.abs(gain - 0.5) < 1e-9, `expected 0.5, got ${gain}`);
    const dB = gainToDb(gain);
    assert.ok(Math.abs(dB - (-6.0206)) < DB_TOLERANCE,
        `expected −6.02 dB, got ${dB.toFixed(4)} dB`);
});

test('fadeGainAt: midpoint of a fade-out gives gain 0.5', async () => {
    const { fadeGainAt } = await load();
    // 4 s clip, 2 s fade out: fade out spans t=2..4, midpoint t=3
    const clip = { start: 0, in: 0, out: 4, fadeIn: 0, fadeOut: 2 };
    assert.ok(Math.abs(fadeGainAt(3, clip) - 0.5) < 1e-9);
});

test('fadeGainAt: clip with non-zero start offsets correctly', async () => {
    const { fadeGainAt } = await load();
    // Clip at t=10 with 2 s fade-in — midpoint is t=11
    const clip = { start: 10, in: 0, out: 8, fadeIn: 2, fadeOut: 0 };
    assert.ok(Math.abs(fadeGainAt(11, clip) - 0.5) < 1e-9);
});

// ── ffmpegPanExpr ─────────────────────────────────────────────────────────────

test('ffmpegPanExpr: format starts with pan=stereo|', async () => {
    const { ffmpegPanExpr } = await load();
    assert.ok(ffmpegPanExpr(0, 1).startsWith('pan=stereo|'));
    assert.ok(ffmpegPanExpr(0, 2).startsWith('pan=stereo|'));
});

test('ffmpegPanExpr: mono centre — equal gains, both outputs from c0', async () => {
    const { ffmpegPanExpr } = await load();
    const { ll, lr, rl, rr } = evalPanFilter(ffmpegPanExpr(0, 1));
    // Mono: both outputs from the single input channel; gains equal at −3.01 dB
    assert.ok(Math.abs(gainToDb(ll) - (-3.0103)) < DB_TOLERANCE, `ll dB: ${gainToDb(ll)}`);
    assert.ok(Math.abs(gainToDb(rl) - (-3.0103)) < DB_TOLERANCE, `rl dB: ${gainToDb(rl)}`);
    assert.ok(Math.abs(lr) < 1e-9, `no second input channel for mono, lr=${lr}`);
    assert.ok(Math.abs(rr) < 1e-9, `no second input channel for mono, rr=${rr}`);
});

test('ffmpegPanExpr: stereo centre — unity, no cross-feed', async () => {
    const { ffmpegPanExpr } = await load();
    const { ll, lr, rl, rr } = evalPanFilter(ffmpegPanExpr(0, 2));
    assert.ok(Math.abs(ll - 1) < 1e-4, `ll should be 1, got ${ll}`);
    assert.ok(Math.abs(lr)     < 1e-4, `no cross-feed at centre, lr=${lr}`);
    assert.ok(Math.abs(rl)     < 1e-4, `no cross-feed at centre, rl=${rl}`);
    assert.ok(Math.abs(rr - 1) < 1e-4, `rr should be 1, got ${rr}`);
});

test('ffmpegPanExpr: stereo hard left — full fold to L, R silent', async () => {
    const { ffmpegPanExpr } = await load();
    const { ll, lr, rl, rr } = evalPanFilter(ffmpegPanExpr(-1, 2));
    assert.ok(Math.abs(ll - 1) < 1e-4, `inL → outL at unity, ll=${ll}`);
    assert.ok(Math.abs(lr - 1) < 1e-4, `inR → outL at unity (cross-feed), lr=${lr}`);
    assert.ok(Math.abs(rl)     < 1e-4, `outR is silent, rl=${rl}`);
    assert.ok(Math.abs(rr)     < 1e-4, `outR is silent, rr=${rr}`);
});

test('ffmpegPanExpr: stereo hard right — full fold to R, L silent', async () => {
    const { ffmpegPanExpr } = await load();
    const { ll, lr, rl, rr } = evalPanFilter(ffmpegPanExpr(1, 2));
    assert.ok(Math.abs(ll)     < 1e-4, `outL is silent, ll=${ll}`);
    assert.ok(Math.abs(lr)     < 1e-4, `outL is silent, lr=${lr}`);
    assert.ok(Math.abs(rl - 1) < 1e-4, `inL → outR at unity (cross-feed), rl=${rl}`);
    assert.ok(Math.abs(rr - 1) < 1e-4, `inR → outR at unity, rr=${rr}`);
});

test('ffmpegPanExpr: stereo p=−0.5 matches the W3C formula', async () => {
    const { ffmpegPanExpr } = await load();
    const { ll, lr, rl, rr } = evalPanFilter(ffmpegPanExpr(-0.5, 2));
    const expected_lr = Math.cos(0.5 * Math.PI / 2);
    const expected_rr = Math.sin(0.5 * Math.PI / 2);
    assert.ok(Math.abs(ll - 1)           < 1e-4, `ll should be 1, got ${ll}`);
    assert.ok(Math.abs(lr - expected_lr) < 1e-4,
        `lr should be ${expected_lr.toFixed(4)}, got ${lr}`);
    assert.ok(Math.abs(rl)               < 1e-4, `rl should be 0, got ${rl}`);
    assert.ok(Math.abs(rr - expected_rr) < 1e-4,
        `rr should be ${expected_rr.toFixed(4)}, got ${rr}`);
});

// The parser above accepts what we wrote; only ffmpeg says what ffmpeg accepts.
// A hard pan silences a row, and a bare `c1=0` fails the render at filter init.
test('ffmpegPanExpr: every expression parses in the real ffmpeg', async () => {
    const { execFile } = require('node:child_process');
    const { promisify } = require('node:util');
    const { ffmpegPath } = require('../services/ffmpegBinary');
    const { ffmpegPanExpr } = await load();
    for (const channels of [1, 2]) {
        const layout = channels === 1 ? 'mono' : 'stereo';
        for (const p of [-1, -0.5, 0, 0.5, 1]) {
            const expr = ffmpegPanExpr(p, channels);
            await promisify(execFile)(ffmpegPath, ['-v', 'error', '-f', 'lavfi',
                '-i', `sine=f=440:d=0.1,aformat=channel_layouts=${layout}`, '-af', expr, '-f', 'null', '-']);
        }
    }
});
