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

// The expression forms the generator writes: `A if C else B` (nested in parentheses), sqrt/floor.
function toJs(e) {
    e = e.trim();
    let depth = 0;
    const top = [];
    for (let i = 0; i < e.length; i++) {
        if (e[i] === '(') depth++;
        else if (e[i] === ')') depth--;
        else if (depth === 0 && (e.startsWith(' if ', i) || e.startsWith(' else ', i))) top.push(i);
    }
    if (top.length === 2) {
        const [i, j] = top;
        return `((${toJs(e.slice(i + 4, j))}) ? (${toJs(e.slice(0, i))}) : (${toJs(e.slice(j + 6))}))`;
    }
    if (/^\(.* if .*\)$/.test(e)) return toJs(e.slice(1, -1));
    return e.replace(/\b(sqrt|floor)\(/g, 'Math.$1(');
}
const py = (expr, a, b) => Function('a', 'b', `return ${toJs(expr)};`)(a, b);

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

// Picture 1 must reach the model at the output frame's exact size: at 1 MP it no longer lined
// up, so chained edits crept and a 2 MP Custom size frame re-drew the scene (Cosmo's 8:5 2K).
const refsNode = () => Object.values(G).find((n) => n.class_type === 'MpiFlux3References');

test('unmasked picture 1 is resized to the frame the latent is built from', () => {
    const refs = refsNode();
    assert.equal(refs.inputs.resolution, 'keep resolution');
    const sw = src(refs.inputs.ref_image_0);
    assert.equal(sw.class_type, 'MpiIfElse');
    const fit = src(src(sw.inputs.false).inputs.false);
    assert.equal(fit.class_type, 'ImageResizeKJv2');
    assert.deepEqual(fit.inputs.image, [byTitle('Input_Image'), 0]);
    assert.equal(fit.inputs.divisible_by, 16);
    const { sel } = editLatent();
    for (const [side, title] of [['width', 'Input_Width'], ['height', 'Input_Height']]) {
        const frame = src(fit.inputs[side]);
        assert.equal(frame.class_type, 'MpiIfElse');
        // Same switch as the latent: Custom size (no mask) -> Input_*, else picture 1's size.
        assert.deepEqual(frame.inputs.boolean, sel.inputs.boolean);
        assert.deepEqual(frame.inputs.true, [byTitle(title), 0]);
        assert.deepEqual(frame.inputs.true, src(sel.inputs.true).inputs[side]);
        assert.deepEqual(frame.inputs.false, src(src(sel.inputs.false).inputs.false).inputs[side]);
    }
});

test('a Custom size of another ratio keeps picture 1 at 1 MP (reframe, not crop)', () => {
    const pick = src(src(refsNode().inputs.ref_image_0).inputs.false);
    const reframe = src(pick.inputs.boolean);
    assert.equal(reframe.class_type, 'MpiBooleanCompare');
    assert.equal(reframe.inputs.mode, 'a_true_b_false');
    assert.deepEqual(reframe.inputs.a, editLatent().sel.inputs.boolean); // Custom size, no mask
    const same = src(reframe.inputs.b);
    const ratio = src(same.inputs.a);
    const keeps = (w, h, W, H) => Function('a', 'b', 'c', `return ${same.inputs.math_expression
        .replace('fabs', 'Math.abs')};`)(py(ratio.inputs.math_expression, w, h), W, H);
    assert.equal(keeps(1280, 800, 1792, 1120), true);   // Cosmo's 8:5 2K
    assert.equal(keeps(1088, 1920, 1080, 1920), true);  // within 2%
    assert.equal(keeps(1280, 800, 896, 1152), false);   // landscape -> portrait
    const oneMp = src(pick.inputs.true);
    assert.equal(oneMp.class_type, 'ImageScaleBy');
    assert.deepEqual(oneMp.inputs.image, [byTitle('Input_Image'), 0]);
    assert.equal(py(src(oneMp.inputs.scale_by).inputs.math_expression, 2048, 2048), 0.5);
});

// FLUX.3 runs each pass a touch warmer and more saturated, so chained edits drifted; no prompt
// clause moved it. An edit of ONE picture, same frame, is graded back to picture 1.
test('an unmasked edit of one picture is graded back to it; two pictures or a reframe are not', () => {
    const sel = Object.values(G).find((n) => n.class_type === 'MpiIfElse'
        && n.inputs.boolean[0] === byTitle('Input_Mask') && n.inputs.boolean[1] === 4);
    const grade = src(sel.inputs.false);
    assert.equal(grade.class_type, 'MpiGradeBack');
    assert.equal(src(grade.inputs.edited).class_type, 'VAEDecode');
    assert.deepEqual(grade.inputs.original, [byTitle('Input_Image'), 0]);
    const gate = src(grade.inputs.enabled);
    assert.deepEqual(gate.inputs.a, [byTitle('Input_Image_2'), 2]);
    assert.deepEqual(gate.inputs.c, [byTitle('Edit frame: reframe'), 0]);
    const on = (w2, h2, reframe) => Function('a', 'b', 'c', `return ${toJs(gate.inputs.math_expression)
        .replace(/\bFalse\b/g, 'false')};`)(w2, h2, reframe);
    assert.equal(on(1, 1, false), true);       // slot 2 blank (1x1), same frame
    assert.equal(on(1024, 1024, false), false); // a second picture: a composition
    assert.equal(on(1, 1, true), false);        // Custom size of another ratio
});

test('pictures 2-10 keep the old 1 MP scale; a blank slot stays 1x1', () => {
    const refs = refsNode();
    for (let slot = 1; slot <= 9; slot++) {
        const img = src(refs.inputs[`ref_image_${slot}`]);
        assert.equal(img.class_type, 'ImageScaleBy');
        assert.equal(G[img.inputs.image[0]].class_type, 'MpiLoadImage');
        const expr = src(img.inputs.scale_by).inputs.math_expression;
        assert.equal(py(expr, 1, 1), 1);
        assert.equal(py(expr, 2048, 2048), 0.5);
        assert.equal(py(expr, 1024, 1024), 1);
        assert.equal(py(expr, 64, 64), 8); // ImageScaleBy's ceiling
    }
});
