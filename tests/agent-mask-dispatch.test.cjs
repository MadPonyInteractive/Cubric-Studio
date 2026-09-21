'use strict';

/**
 * agent-mask-dispatch.test.cjs — MPI-877, the agent and the user's painted mask.
 *
 * The failure this file exists to stop, live 2026-09-21: Fabio asked for a boy's
 * REFLECTION to turn demonic. The agent ran a maskless edit, which repainted the whole
 * subject; talked itself into `inpaint`; was refused with MASK_UNSUPPORTED; and told him
 * to run it himself — with the mask already painted and on screen.
 *
 * Both halves failed SILENTLY in their own way, which is why they are pinned here rather
 * than left to a prompt rule. Dispatch carried no `maskDataUrl` at all, so a masked-capable
 * op ran whole-image and reported `ok: true`; and the `requiresMask` refusal never asked
 * whether a mask existed, so it was unreachable-by-construction rather than conditional.
 *
 * Pure logic — no renderer, no canvas, no GPU.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { resolveMask, bindMaskedSource } = require('../js/shell/agentDispatch.js');
const { setMaskReader, clearMaskReader, activeMask } = require('../js/shell/activeMask.js');
const { COMMANDS } = require('../js/data/commandRegistry.js');

const MASK = 'data:image/png;base64,iVBORw0KGgo=';
// The picture the mask was painted over. A mask is a region OF an image, so the two
// always travel together (MPI-877 round 2).
const SRC = '/project-file?path=C:/p/Media/t2i_003.png';
const PAINTED = { dataUrl: MASK, url: SRC };
const repoRoot = path.join(__dirname, '..');

// ── The registry these tests are written against ──────────────────────────────

test('exactly the ops that declare requiresMask are the ones a missing mask refuses', () => {
    const declared = Object.keys(COMMANDS).filter((k) => COMMANDS[k].requiresMask);
    assert.deepEqual(declared.sort(), ['detail', 'inpaint'],
        'a new requiresMask op needs a line in the agent masking doc too');
    for (const op of Object.keys(COMMANDS)) {
        const refused = !!resolveMask(op, null).error;
        assert.equal(refused, !!COMMANDS[op].requiresMask,
            `"${op}": the refusal must follow requiresMask, nothing else`);
    }
});

// ── Half 1: the mask is ATTACHED, on every op ─────────────────────────────────

test('a painted mask is carried through for an op that does not require one', () => {
    // The whole point of the card. `commandExecutor.js` injects Input_Mask with no model
    // and no op check, so an `edit` with a mask is a LOCALISED edit — on every local model
    // that has the op, not just Krea 2.
    for (const op of ['edit', 'kleinEdit', 'krea2Edit', 'i2i']) {
        assert.equal(resolveMask(op, PAINTED).maskDataUrl, MASK, `"${op}" dropped the mask`);
        assert.equal(resolveMask(op, PAINTED).maskUrl, SRC, `"${op}" dropped the mask's own picture`);
        assert.equal(resolveMask(op, PAINTED).error, undefined);
    }
});

test('no mask painted: the key is absent, never a null, and the op still runs', () => {
    const r = resolveMask('edit', null);
    assert.equal(r.error, undefined, 'edit is not a requiresMask op — it must still run');
    assert.equal(r.maskDataUrl, null);
    // The dispatch spreads on truthiness (`...(mask.maskDataUrl ? {...} : {})`), so an
    // empty string must land the same as a null rather than reaching the executor.
    assert.equal(resolveMask('edit', { dataUrl: '', url: SRC }).maskDataUrl, null);
});

// ── Half 2: the refusal is CONDITIONAL, and actionable ────────────────────────

test('a requiresMask op RUNS once the user has painted', () => {
    for (const op of ['inpaint', 'detail']) {
        const r = resolveMask(op, PAINTED);
        assert.equal(r.error, undefined, `"${op}" was refused with a mask in hand`);
        assert.equal(r.maskDataUrl, MASK);
        assert.equal(r.maskUrl, SRC);
    }
});

test('a requiresMask op with no mask is refused, and told to ask for one', () => {
    for (const op of ['inpaint', 'detail']) {
        const r = resolveMask(op, null);
        assert.equal(r.error?.code, 'MASK_UNSUPPORTED');
        assert.equal(r.maskDataUrl, null, 'a refusal must not hand back a mask to run');
        // Actionable in-turn: it names the tool and what to do, so the agent asks rather
        // than handing the whole job back.
        assert.match(r.error.message, /paint/i);
        assert.match(r.error.message, /Mask tool/i);
        // The exact wording that sent Fabio away. It must never come back.
        assert.doesNotMatch(r.error.message, /cannot supply/i);
        // "History" is our name for that workspace and appears nowhere on screen.
        // Fabio, live 2026-09-21: "most users will never know what history means".
        assert.doesNotMatch(r.error.message, /History/i);
        assert.match(r.error.message, /gallery/i);
    }
});

// ── The bridge: the workspace publishes a reader, dispatch reads it ───────────

test('the mask slot: published, read, withdrawn', () => {
    const reader = () => PAINTED;
    assert.equal(activeMask(), null, 'nothing mounted means no mask');
    setMaskReader(reader);
    assert.deepEqual(activeMask(), PAINTED);
    clearMaskReader(reader);
    assert.equal(activeMask(), null);
});

test('a replaced workspace destroying LATE cannot blank the live one', () => {
    // navigation.js destroys the previous block before mounting the next, but a `destroy()`
    // is async: if `clearMaskReader` took no argument, an old block finishing its teardown
    // after the new one mounted would silently leave the agent with no mask at all.
    const old = () => ({ dataUrl: 'data:image/png;base64,OLD', url: '/project-file?path=old.png' });
    const fresh = () => PAINTED;
    setMaskReader(old);
    setMaskReader(fresh);
    clearMaskReader(old);
    assert.deepEqual(activeMask(), PAINTED, 'the late teardown blanked the live reader');
    clearMaskReader(fresh);
});

test('a reader that throws reads as no mask, never as a failed dispatch', () => {
    setMaskReader(() => { throw new Error('canvas gone'); });
    assert.equal(activeMask(), null);
    setMaskReader(null);
    assert.equal(activeMask(), null, 'a non-function must not be called');
    // Pixels with no picture are the failure this pairing exists to stop, so they
    // read as no mask rather than as a mask that can land anywhere.
    setMaskReader(() => ({ dataUrl: MASK }));
    assert.equal(activeMask()?.url, undefined);
    setMaskReader(null);
});

// -- The mask and its picture are ONE thing ------------------------------------
//
// Live, 2026-09-21, five runs across two models: the mask came off the open card at
// 768x1024 and the agent edited the chat ATTACHMENT it had been handed, a 512x682
// thumbnail rendition. `InpaintCropImproved` asserts the two match, so every run died
// before rendering a pixel:
//   AssertionError: Mask dimensions do not match image dimensions.
//   Expected torch.Size([682, 512]), got torch.Size([1024, 768])
// Nothing bound them: the mask came from the workspace and the image from whatever the
// model named. A correct attachment would have broken the same way the moment the user
// painted on a different card.

const ATTACHMENT = '/project-file?path=C:/p/agent/att_564c16a9.webp';   // 512x682
const REFERENCE = '/project-file?path=C:/p/Media/ref.png';

test('a masked edit runs on the picture the mask was painted over', () => {
    const items = [{ role: 'inputImage', url: ATTACHMENT, mediaType: 'image' }];
    const bound = bindMaskedSource(items, SRC);
    assert.equal(bound[0].url, SRC, 'the edited slot still points at the attachment');
    assert.equal(items[0].url, ATTACHMENT, 'the caller\'s own array was mutated');
});

test('only the edited slot moves - the reference images are the model\'s', () => {
    // kleinEdit takes up to three images and injection is ORDINAL: rewriting a reference
    // would change which picture is the edit and which is the look to copy.
    const items = [
        { role: 'inputImage', url: ATTACHMENT, mediaType: 'image' },
        { role: 'inputImage2', url: REFERENCE, mediaType: 'image' },
        { role: 'inputImage3', url: ATTACHMENT, mediaType: 'image' },
    ];
    const bound = bindMaskedSource(items, SRC);
    assert.deepEqual(bound.map((i) => i.url), [SRC, REFERENCE, ATTACHMENT]);
    assert.deepEqual(bound.map((i) => i.role), ['inputImage', 'inputImage2', 'inputImage3']);
});

test('no mask painted: the model\'s media is dispatched exactly as it sent it', () => {
    const items = [{ role: 'inputImage', url: ATTACHMENT, mediaType: 'image' }];
    assert.equal(bindMaskedSource(items, null), items, 'a maskless dispatch must not be rewritten');
    assert.equal(bindMaskedSource(items, undefined), items);
});

test('the model already named the mask\'s own picture: nothing is touched', () => {
    const items = [{ role: 'inputImage', url: SRC, mediaType: 'image' }];
    const bound = bindMaskedSource(items, SRC);
    assert.equal(bound[0], items[0], 'an item that needs no change is not copied');
});

test('an op with no image slot filled cannot be broken by a mask', () => {
    assert.deepEqual(bindMaskedSource([], SRC), []);
});

// ── The downstream contract: the key name is the whole interface ──────────────

test('maskDataUrl is still the name generationService and commandExecutor read', () => {
    // These two lines are what turn `config.maskDataUrl` into the graph's Input_Mask.
    // Nothing in this repo fails if the key is renamed on one side only — the mask just
    // stops arriving, silently, exactly as it did before this card.
    // Asserted as booleans, never with assert.match on the file: a failing match prints
    // the whole 90 KB module into the test output.
    const read = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8').split('\n');
    const destructure = read('js/services/generationService.js').find((l) => l.includes('} = config;'));
    assert.ok(destructure?.includes('maskDataUrl'),
        'generationService no longer destructures maskDataUrl off the dispatch config');
    const inject = read('js/services/commandExecutor.js')
        .some((l) => l.includes("params['Input_Mask'] = payload.maskDataUrl"));
    assert.ok(inject, 'commandExecutor no longer injects maskDataUrl as Input_Mask');
});
