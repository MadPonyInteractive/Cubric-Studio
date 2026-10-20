'use strict';

/**
 * flux3-boxes.test.cjs — MPI-1181.
 *
 * Boxes: the user draws boxes over the output frame, stored as fractions; the app appends
 * them to the prompt as FLUX.3's layout table (what core `Flux3LayoutPrompt` does: prompt,
 * a space, `[{id, bbox:[y_min,x_min,y_max,x_max] on 0-1000, desc}]`). No box node in the graph.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { withLayoutBoxes, modelTakesBoxes } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const FLUX3 = MODELS.find((m) => m.id === 'flux3-klein');
const KREA2 = MODELS.find((m) => m.id === 'krea2');
const FOX = { x: 0.05, y: 0.55, w: 0.3, h: 0.4, desc: 'red fox sitting' };

test('the table is Flux3LayoutPrompt`s: yxyx on 0-1000, obj_N in order, appended last', () => {
    const out = withLayoutBoxes(FLUX3, 'A meadow <obj_1> with a fox <obj_2>.',
        [{ x: 0, y: 0, w: 1, h: 1, desc: 'meadow' }, FOX]);
    assert.equal(out, 'A meadow <obj_1> with a fox <obj_2>. '
        + '[{"id":"obj_1","bbox":[0,0,1000,1000],"desc":"meadow"},{"id":"obj_2","bbox":[550,50,950,350],"desc":"red fox sitting"}]');
});

test('out-of-frame values clamp to the grid', () => {
    const out = withLayoutBoxes(FLUX3, 'x', [{ x: -0.1, y: 0.9, w: 0.5, h: 0.5, desc: '' }]);
    assert.match(out, /"bbox":\[900,0,1000,400\]/);
});

test('no boxes, or a model without a format: the prompt is untouched', () => {
    assert.equal(withLayoutBoxes(FLUX3, ' hi ', []), 'hi');
    assert.equal(withLayoutBoxes(KREA2, 'hi', [FOX]), 'hi');
});

test('FLUX.3 takes boxes on t2i and edit only; other models never', () => {
    assert.ok(modelTakesBoxes(FLUX3, 't2i'));
    assert.ok(modelTakesBoxes(FLUX3, 'edit'));
    assert.ok(!modelTakesBoxes(FLUX3, 'i2i'));
    assert.ok(!modelTakesBoxes(KREA2, 't2i'));
});

test('the button shows on every FLUX.3 op, on no other model; sends only where it works', async () => {
    const { visibleControlIds, PROMPT_BOX_CONTROLS } =
        await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    for (const op of FLUX3.supportedOps) assert.ok(visibleControlIds(FLUX3, op, {}).includes('boxes'), op);
    assert.ok(!visibleControlIds(KREA2, 't2i', {}).includes('boxes'));

    const ctrl = PROMPT_BOX_CONTROLS.boxes;
    const probe = (enabled, value) => ctrl.getInjectionParams.call({ ...ctrl, enabled, value });
    assert.deepEqual(probe(true, [FOX]), { Layout_Boxes: [FOX] });
    assert.deepEqual(probe(true, []), {});
    assert.deepEqual(probe(false, [FOX]), {});
});

test('an enhanced box prompt keeps its own table; nothing is appended twice', () => {
    const enhanced = 'A fox <obj_1> in a meadow <meadow_1>. [{"id":"obj_1","bbox":[550,50,950,350],"desc":"fox"},{"id":"meadow_1","bbox":[0,0,1000,1000],"desc":"meadow"}]';
    assert.equal(withLayoutBoxes(FLUX3, enhanced, [FOX]), enhanced);
    // A caption that merely ends in brackets is not a table.
    assert.match(withLayoutBoxes(FLUX3, 'A sign reading [SALE]', [FOX]), /\[SALE\] \[\{"id":"obj_1"/);
});

test('reconcile: the user`s box wins, a re-planned twin takes its id, cited extras stay (BFL bbox.py)', async () => {
    const { layoutRows, reconcileBoxes, upsamplingInput } = await import('../js/data/layoutBoxes.js');
    const locked = layoutRows([FOX]);
    assert.ok(upsamplingInput('a fox', locked).startsWith('ORIGINAL PROMPT:\na fox\n\nLOCKED BOUNDING-BOX ANNOTATIONS'));
    const answer = 'Photo of a red fox <fox_1> beside a tree <tree_1> and a ghost <ghost_1>. '
        + JSON.stringify([
            { id: 'fox_1', bbox: [552, 50, 950, 352], desc: 'Red fox, rust coat.' },
            { id: 'tree_1', bbox: [0, 600, 900, 950], desc: 'Old oak.' },
            { id: 'ghost_1', bbox: [0, 0, 0.5, 0.5], desc: 'bad box' },
            { id: 'cloud_1', bbox: [0, 0, 200, 300], desc: 'not cited' },
        ]);
    const out = reconcileBoxes(answer, locked);
    const cut = out.indexOf(' [');
    const caption = out.slice(0, cut);
    const rows = JSON.parse(out.slice(cut + 1));
    assert.match(caption, /red fox <obj_1>/);
    assert.deepEqual(rows.map((r) => r.id), ['obj_1', 'tree_1']);
    assert.deepEqual(rows[0].bbox, [550, 50, 950, 350], 'the user`s coordinates, not the plan`s');
    assert.equal(rows[0].desc, 'Red fox, rust coat.', 'the upsampler`s richer desc');
});
