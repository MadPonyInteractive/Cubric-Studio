'use strict';

/**
 * flux3-recipe.test.cjs — MPI-1181.
 *
 * FLUX.3's enhancer recipe carries BFL's own prompt-upsampler system prompts verbatim
 * (Apache-2.0): `t2v` = BFL t2i plus one Stage 1 adapter paragraph, `i2i` = BFL i2i plus one adapter sentence, because our
 * enhancer reads a description of each reference instead of seeing it. Edit and inpaint ask
 * for `i2i`; a recipe without it falls back to t2v.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const RESEARCH = path.join(__dirname, '../.agents/mpi-kanban/tasks/MPI-1181/research');
const PUP = JSON.parse(fs.readFileSync(path.join(RESEARCH, 'bfl_pup_prompts.json'), 'utf8'));
// The edit mode uses BFL's prompt for an EXTERNAL model writing the caption (their README).
const EXT = JSON.parse(fs.readFileSync(path.join(RESEARCH, 'bfl_pup_prompts_external_vlm.json'), 'utf8'));

test('the system prompts are BFL`s, byte for byte', async () => {
    const { getRecipe } = await import('../js/data/recipes/registry.js');
    const r = getRecipe('flux-3');
    assert.equal(r.status, 'draft');
    // t2v = BFL t2i plus one adapter paragraph before the last line (Stage 1, 2026-10-20).
    // ...and ONE sentence restated, because its ban quoted the phrases it banned (2026-10-20).
    const quotedBan = 'never "this image shows", "we can see" or "is visible".';
    assert.ok(PUP.t2i.includes(quotedBan), 'BFL`s sentence moved: re-check the restatement');
    const t2i = PUP.t2i.replace(quotedBan, 'stating what is there and what it does, never what can be seen.')
        .replace(/Output only the caption\.\s*$/, '').trimEnd();
    assert.ok(r.modes.t2v.systemPrompt.startsWith(t2i));
    assert.ok(r.modes.t2v.systemPrompt.endsWith('Output only the caption.'));
    const body = EXT.i2i.replace(/Output only the instruction\.\s*$/, '').trimEnd();
    assert.ok(r.modes.i2i.systemPrompt.startsWith(body));
    assert.ok(r.modes.i2i.systemPrompt.trimEnd().endsWith('Output only the instruction.'));
    assert.ok(r.modes.i2i.systemPrompt.includes('sequence \\n inside'), 'BFL`s literal backslash-n survives');
    assert.equal(r.modes.i2i.seesPictures, true);
});

test('edit and inpaint ask for i2i; a recipe without it falls back to t2v', async () => {
    const { recipeModeForOp, resolveMode } = await import('../js/services/llmService.js');
    assert.equal(recipeModeForOp('edit'), 'i2i');
    assert.equal(recipeModeForOp('inpaint'), 'i2i');
    assert.equal(recipeModeForOp('detail'), 't2v');
    assert.equal(resolveMode('flux-3', 'i2i'), 'i2i');
    assert.equal(resolveMode('qwen-image-2.1', 'i2i'), 't2v');
});

test('the images reach the enhancer as ordinal lines under the request', async () => {
    const { withImageLooks } = await import('../js/data/recipes/registry.js');
    assert.equal(withImageLooks('red swimsuit', []), 'red swimsuit');
    const out = withImageLooks('swap them', [{ text: 'A woman.' }, { text: 'A  beach.\nSunny.' }]);
    assert.equal(out, 'swap them\n\nThe attached images, in order:\nThe first image: A woman.\nThe second image: A beach. Sunny.');
    const long = withImageLooks('x', [{ text: 'w '.repeat(500) }]);
    assert.ok(long.split(' ').length < 175, 'one look is capped');
});

test('t2v_bbox is BFL`s t2i_bbox, byte for byte; no i2i_bbox (a blind enhancer cannot box a picture)', async () => {
    const { getRecipe, RECIPE_MODES, validateRecipe } = await import('../js/data/recipes/registry.js');
    const r = getRecipe('flux-3');
    assert.ok(RECIPE_MODES.includes('t2v_bbox'));
    assert.equal(r.modes.t2v_bbox.systemPrompt, PUP.t2i_bbox);
    assert.equal(r.modes.i2i_bbox, undefined);
    assert.deepEqual(validateRecipe(r), []);
});
