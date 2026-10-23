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

test('an empty edit prompt is written from the boxes; a typed one, or t2i, is not', () => {
    const tiger = { x: 0.26, y: 0.27, w: 0.2, h: 0.43, desc: 'Sneaking Tiger', name: 'Tiger' };
    assert.equal(withLayoutBoxes(FLUX3, ' ', [tiger, { ...FOX, name: 'fox' }], 'edit').split(' [')[0],
        'In <Tiger>: Sneaking Tiger. In <fox>: red fox sitting. Keep everything else in the picture exactly the same.');
    // A typed edit with no keep clause gets the keep line (Fabio, 2026-10-20); one with a clause is left as typed.
    assert.match(withLayoutBoxes(FLUX3, 'Add a tiger', [tiger], 'edit'), /^Add a tiger\. Keep everything else in the picture exactly the same\. \[/);
    assert.match(withLayoutBoxes(FLUX3, 'Add a tiger. Keep the forest unchanged.', [tiger], 'edit'), /^Add a tiger\. Keep the forest unchanged\. \[/);
    assert.match(withLayoutBoxes(FLUX3, 'Add a tiger, leave the rest the same', [tiger], 'edit'), /^Add a tiger, leave the rest the same \[/);
    assert.match(withLayoutBoxes(FLUX3, '', [tiger], 't2i'), /^ \[/);
});

test('the edit enhancer gets each box as words, never coordinates, and is told the pictures lack it', async () => {
    const { editPlacementInput } = await import('../js/data/layoutBoxes.js');
    const out = editPlacementInput('the <tigger> sneaks up', [
        { x: 0.74, y: 0.01, w: 0.26, h: 0.78, desc: 'A Bengal tiger ', name: 'tigger' },
        { ...FOX, name: 'fox' },
    ]);
    assert.equal(out, 'the <tigger> sneaks up\n\nPLACEMENT (where each thing goes in the edited image; the attached images do not show it):\n'
        + '<tigger>: A Bengal tiger, on the right of the frame, at middle height.\n'
        + '<fox>: red fox sitting, on the left of the frame, near the bottom.');
    assert.doesNotMatch(out, /\d{2,}|bbox|LOCKED/);
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

test('the button shows on every FLUX.3 op, on no other model; the run always records its boxes', async () => {
    const { visibleControlIds, PROMPT_BOX_CONTROLS } =
        await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    for (const op of FLUX3.supportedOps) assert.ok(visibleControlIds(FLUX3, op, {}).includes('boxes'), op);
    assert.ok(!visibleControlIds(KREA2, 't2i', {}).includes('boxes'));

    // Injected even empty (the sidecar describes the run); only t2i/edit reach the prompt,
    // which commandExecutor gates on modelTakesBoxes (tested above).
    const ctrl = PROMPT_BOX_CONTROLS.boxes;
    const probe = (value) => ctrl.getInjectionParams.call({ ...ctrl, value });
    assert.deepEqual(probe([FOX]), { Layout_Boxes: [FOX] });
    assert.deepEqual(probe([]), { Layout_Boxes: [] });
    assert.deepEqual(probe(undefined), { Layout_Boxes: [] });
});

test('a box save goes to every model that takes boxes on the op (FLUX.3 -> MOSS keeps them)', async () => {
    const { PROMPT_BOX_CONTROLS } = await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    const { Events } = require('../js/events.js');
    const ctrl = PROMPT_BOX_CONTROLS.boxes;
    const saved = async (opName) => {
        const seen = [];
        const off = Events.on('settings:model:update', (e) => { if (e.key === 'boxes') seen.push(`${e.modelId}/${e.opName}`); });
        ctrl.setValue.call({ ...ctrl, _opts: { model: FLUX3, opName } }, [FOX]);
        await new Promise((r) => setTimeout(r, 350));
        off();
        return seen.sort();
    };
    assert.deepEqual(await saved('t2i'), ['flux3-klein/t2i', 'moss-image/t2i']);
    assert.deepEqual(await saved('edit'), ['flux3-klein/edit']);
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

test('named boxes: the name is the id the prompt cites, an empty desc reads as the name', async () => {
    const { layoutRows, boxName, uniqueBoxName } = await import('../js/data/layoutBoxes.js');
    const rows = layoutRows([
        { ...FOX, name: 'fox' },
        { x: 0, y: 0, w: 0.5, h: 0.5, desc: '', name: 'old_tree' },
        { x: 0, y: 0, w: 0.1, h: 0.1, desc: 'legacy' },
        { x: 0, y: 0, w: 0.1, h: 0.1, desc: 'twin', name: 'fox' },
    ]);
    assert.deepEqual(rows.map((r) => r.id), ['fox', 'old_tree', 'obj_3', 'fox_4']);
    assert.equal(rows[1].desc, 'old tree');
    assert.equal(boxName('  big cat! '), 'big_cat');
    assert.equal(boxName('2 dogs'), 'dogs');
    assert.equal(boxName('!!'), '');
    assert.equal(uniqueBoxName('cat', [{ name: 'cat' }, { name: 'cat_2' }]), 'cat_3');
    assert.equal(uniqueBoxName('box', [{ name: 'box1' }]), 'box2');
});

test('Reuse brings back the boxes the run used: names, descs and all', async () => {
    const { resolveControlDefaults, reconcileControlsFromInjection } = await import('../js/components/Organisms/MpiPromptBox/PromptBoxControls.js');
    const { buildPromptReuseSettings } = await import('../js/utils/promptReuse.js');
    const ran = [{ ...FOX, name: 'fox' }, { x: 0.6, y: 0.1, w: 0.3, h: 0.3, desc: '', name: 'tree' }];
    // The project's copy is 300 ms debounced, so it can lag the run: the sidecar must
    // still record what ran.
    const buckets = resolveControlDefaults(FLUX3, 'edit', {});
    assert.deepEqual(buckets.op.boxes, [], 'fixture guard: the project holds no boxes');
    reconcileControlsFromInjection(buckets, { Layout_Boxes: ran, Width: 1024, Height: 1024 }, FLUX3, 'edit', {});
    assert.deepEqual(buckets.op.boxes, ran);
    const reuse = buildPromptReuseSettings({ generationSettings: { controlState: { shared: buckets.shared, op: buckets.op } } }, FLUX3);
    assert.deepEqual(reuse.opUpdates.boxes, ran);
});

test('a box moved after Enhance drops the enhancement; a Reuse keeps its own (Fabio, 2026-10-20)', async () => {
    const { buildPromptReusePayload } = await import('../js/utils/promptReuse.js');
    const ran = [{ ...FOX, name: 'fox' }];
    const payload = buildPromptReusePayload({ prompt: 'A red fox, enhanced.', sourcePrompt: 'the <fox>', generationSettings: { injectionParams: { Layout_Boxes: ran } } });
    assert.deepEqual(payload.enhanced, { positive: 'A red fox, enhanced.', boxes: ran }, 'the enhancement travels with the boxes it ran with');

    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../js/components/Organisms/MpiPromptBox/MpiPromptBox.js'), 'utf8');
    assert.match(src, /onChange: \(boxes\) => \{[^}]*_dropIfBoxesMoved\(\);/, 'a box drawn, moved or removed checks the enhancement');
    assert.match(src, /el\.getRunPayload = \(\) => \{\s*\/\/[^\n]*\n\s*_dropIfBoxesMoved\(\);/, 'Run re-checks before it reads the enhancement');
    assert.match(src, /boxes: _boxKey\(enhanced\.boxes\)/, 'a Reuse records the card`s boxes, not the ones on screen before it restores them');
    // The sync every prompt edit runs must NOT check boxes: a Reuse injects the prompt before its boxes.
    const sync = src.slice(src.indexOf('function _syncEnhancedState()'), src.indexOf('const _closeEnhanceDialog'));
    assert.doesNotMatch(sync, /_boxesNow|_boxKey/);
});

// MPI-1253 (Fabio, 2026-10-23): reused after a restart, the boxes came back over a blank frame.
test('the layout picture rides the run as Layout_Guide, Reuse lays it back, the graph never gets it', async () => {
    const { buildPromptReusePayload } = await import('../js/utils/promptReuse.js');
    const guide = '/project-file?path=C%3A%2FP%2FMedia%2Fbazaar.png';
    const payload = buildPromptReusePayload({ prompt: 'A cover', generationSettings: { injectionParams: { Layout_Boxes: [FOX], Layout_Guide: guide } } });
    assert.equal(payload.injectionParams.Layout_Guide, guide);

    const read = (p) => require('node:fs').readFileSync(require('node:path').join(__dirname, '..', p), 'utf8');
    assert.match(read('js/components/Organisms/MpiPromptBox/MpiPromptBox.js'), /if \(_layoutLocked\(\)\) injectionParams\.Layout_Guide = _boxesGuide;/, 'Cue records the picture on a t2i layout run');
    assert.match(read('js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js'), /setBoxesGuide\?\.\(payload\.injectionParams\?\.Layout_Guide\)/, 'Reuse settings lays it back, or clears it');
    assert.match(read('js/services/commandExecutor.js'), /delete params\.Layout_Guide;/, 'never a graph param');
    // And with no Reuse at all: a reload or restart lays it back from the project.
    const box = read('js/components/Organisms/MpiPromptBox/MpiPromptBox.js');
    assert.match(box, /getSharedSettings\(state\.currentProject, 'image'\)\.boxesGuide/, 'mount reads the saved picture');
    assert.match(box, /function _setBoxesGuide\(url\) \{[^}]*sharedUpdates: \{ boxesGuide: url \}/, 'every set or Remove picture saves it');
});

// MPI-1253 (Fabio, 2026-10-23): a reused moodboard prompt survived Create boxes on Tokyo.
test('Create boxes replaces the prompt whatever wrote it, as Reuse does', () => {
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../js/components/Organisms/MpiPromptBox/MpiPromptBox.js'), 'utf8');
    assert.match(src, /_boxesCtrl\(\)\?\.setValue\(found\.boxes\);[\s\S]{0,400}if \(found\.caption\) \{\s*_writeMode\(found\.caption, 'positive'\);/, 'no typed-prompt exception');
    assert.doesNotMatch(src, /_autoCaption/);
});

test('agents send boxes by name: describe_model lists them, the run gets the panel`s list, a bad one is refused', () => {
    const { namedParamsFor, resolveNamedParams } = require('../js/data/generationControls.js');
    assert.equal(namedParamsFor(FLUX3, 't2i').boxes, true);
    assert.equal(namedParamsFor(FLUX3, 'edit').boxes, true);
    assert.equal(namedParamsFor(KREA2, 't2i').boxes, undefined);
    const r = resolveNamedParams(null, FLUX3, 't2i', { boxes: [{ ...FOX, name: 'red fox' }] });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.injectionParams.Layout_Boxes, [{ x: 0.05, y: 0.55, w: 0.3, h: 0.4, desc: 'red fox sitting', name: 'red_fox' }]);
    assert.equal('Layout_Boxes' in resolveNamedParams(null, FLUX3, 't2i', {}).injectionParams, false, 'unasked: the panel`s boxes never ride an agent run');
    for (const bad of [[], [{ x: 0, y: 0, w: 2, h: 1 }], [{ x: 0, y: 0, w: 0, h: 0.5 }], 'fox']) {
        assert.equal(resolveNamedParams(null, FLUX3, 't2i', { boxes: bad }).code, 'INVALID_BOXES', JSON.stringify(bad));
    }
    assert.equal(resolveNamedParams(null, KREA2, 't2i', { boxes: [FOX] }).code, 'INVALID_BOXES');
    // Pinned (a project passed): the panel's saved boxes run unsent; sent ones still win.
    const project = { modelSettings: { 'flux3-klein': { operations: { t2i: { boxes: [{ ...FOX, name: 'fox' }] } } } } };
    const { getOpSettings } = require('../js/data/projectModel.js');
    assert.equal(getOpSettings(project, 'flux3-klein', 't2i').boxes?.length, 1, 'fixture matches the project shape');
    assert.equal(resolveNamedParams(project, FLUX3, 't2i', {}).injectionParams.Layout_Boxes[0].name, 'fox');
    assert.equal(resolveNamedParams(project, FLUX3, 't2i', { boxes: [{ ...FOX, name: 'cat' }] }).injectionParams.Layout_Boxes[0].name, 'cat');
});
