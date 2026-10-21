'use strict';

/**
 * flux3-edit-size.test.cjs — MPI-1216.
 *
 * A FLUX.3 edit with Custom size off used to render at picture 1 rescaled to exactly 1 MP, so
 * 768x1376 came back 752x1360 and every edit drifted. generate_flux3.py now routes that
 * latent to picture 1's own size (each side /16, shrunk only past the largest 4K-tier area).
 * This walks the shipped graph and runs its two MpiMath expressions on real sizes.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const G = require('../comfy_workflows/flux3_t2i.json');
const { MODELS } = require('../js/data/modelConstants/models.js');

const byTitle = (t) => Object.keys(G).find((k) => G[k]._meta.title === t);
const src = (link) => G[link[0]];

// The two expression forms the generator writes: `A if C else B`, sqrt/floor from math.
function py(expr, a, b) {
    const js = expr.replace(/\b(sqrt|floor)\(/g, 'Math.$1(');
    const m = js.match(/^(.*) if (.*) else (.*)$/);
    const body = m ? `(${m[2]}) ? (${m[1]}) : (${m[3]})` : js;
    return Function('a', 'b', `return ${body};`)(a, b);
}

function editLatent() {
    const custom = byTitle('Input_custom_size');
    const cmp = Object.keys(G).find((k) => G[k].class_type === 'MpiBooleanCompare'
        && G[k].inputs.a[0] === custom);
    const sel = Object.values(G).find((n) => n.class_type === 'MpiIfElse' && n.inputs.boolean[0] === cmp);
    return { sel, hasMask: G[cmp].inputs.b };
}

test('custom size off, no mask: latent comes from picture 1, not the 1 MP references', () => {
    const { sel, hasMask } = editLatent();
    const pick = src(sel.inputs.false);
    assert.equal(pick.class_type, 'MpiIfElse');
    assert.deepEqual(pick.inputs.boolean, hasMask);
    assert.equal(src(pick.inputs.true).class_type, 'MpiFlux3References'); // mask keeps refs latent
    const latent = src(pick.inputs.false);
    assert.equal(latent.class_type, 'EmptyFlux2LatentImage');
    // Input_Image (MpiLoadImage) outputs 2/3 = the loaded picture's width/height.
    assert.deepEqual(src(latent.inputs.width).inputs.a, [byTitle('Input_Image'), 2]);
    assert.deepEqual(src(latent.inputs.height).inputs.a, [byTitle('Input_Image'), 3]);
});

function outSize(w, h) {
    const { sel } = editLatent();
    const latent = src(src(sel.inputs.false).inputs.false);
    const [W, H] = [latent.inputs.width, latent.inputs.height].map((l) => src(l));
    const scale = src(W.inputs.b);
    const s = py(scale.inputs.math_expression, w, h);
    return [py(W.inputs.math_expression, w, s), py(H.inputs.math_expression, h, s)];
}

test('sizes already on the /16 grid come back unchanged', () => {
    assert.deepEqual(outSize(768, 1376), [768, 1376]);
    assert.deepEqual(outSize(752, 1360), [752, 1360]);
    assert.deepEqual(outSize(2944, 2944), [2944, 2944]);
});

test('off-grid sizes round to /16', () => {
    assert.deepEqual(outSize(571, 1021), [576, 1024]);
});

test('a photo past the 4K tier shrinks to its largest area, aspect kept', () => {
    const tiers = MODELS.find((m) => m.id === 'flux3-klein').ratios['4k'].portrait;
    const cap = Math.max(...tiers.map((r) => r.w * r.h));
    const [w, h] = outSize(6000, 4000);
    assert.ok(w * h <= cap * 1.01, `${w}x${h} over the 4K area`);
    assert.ok(w * h > cap * 0.97, `${w}x${h} shrank too far`);
    assert.ok(Math.abs(w / h - 1.5) < 0.01);
});
