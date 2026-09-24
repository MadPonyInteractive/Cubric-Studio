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

const { resolveMask, bindMaskedSource, maskedGenerationOpts, countMaskAreas, ONE_AREA_OPS } = require('../js/shell/agentDispatch.js');
const { setMaskReader, clearMaskReader, activeMask } = require('../js/shell/activeMask.js');
const { COMMANDS } = require('../js/data/commandRegistry.js');
const { state } = require('../js/state.js');

const MASK = 'data:image/png;base64,iVBORw0KGgo=';
// The picture the mask was painted over. A mask is a region OF an image, so the two
// always travel together (MPI-877 round 2).
const SRC = '/project-file?path=C:/p/Media/t2i_003.png';
// And the card that picture belongs to: a masked edit is that card's next version
// (MPI-877 round 3).
const GROUP_ID = '204f6a5b-08d0-4815-b6f5-3bc6fe215138';
const PAINTED = { dataUrl: MASK, url: SRC, groupId: GROUP_ID };
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

// -- A masked edit is the card's NEXT VERSION, not a new card --------------------
//
// Live, 2026-09-22, round 2 of this card: the edit finally rendered — right op, right
// picture, right mask — and landed in the gallery as `edit_003`, while the workspace
// Fabio was watching, mask still on screen, drew no latents and no result. Dispatch had
// no card to name, so every agent submit was `scope: 'gallery'`. A Cue press in that same
// workspace sends `existingGroup` + `scope: 'groupHistory'`.

const CARD = { id: GROUP_ID, name: 't2i_003', history: [] };

test('a masked submit lands in the history of the card the mask was painted on', () => {
    state.currentProject = { itemGroups: [{ id: 'other' }, CARD] };
    const opts = maskedGenerationOpts(resolveMask('kleinEdit', PAINTED).maskGroupId);
    assert.deepEqual(opts, { existingGroup: CARD, scope: 'groupHistory', groupId: GROUP_ID });
    // The LIVE group, not a copy: generationService re-reads history off the project, and
    // `_reportDone` reports the group it is handed.
    assert.equal(opts.existingGroup, CARD);
    state.currentProject = null;
});

test('a maskless submit still goes to the gallery, as every agent generation always has', () => {
    state.currentProject = { itemGroups: [CARD] };
    assert.equal(maskedGenerationOpts(resolveMask('t2i', null).maskGroupId), null);
    // Pixels with no card are the round-2 shape of this reader; they must not route.
    assert.equal(maskedGenerationOpts(resolveMask('edit', { dataUrl: MASK, url: SRC }).maskGroupId), null);
    state.currentProject = null;
});

test('the card is gone or another project is open: the run falls back to the gallery', () => {
    // Deleted mid-run, or the agent opened another project between paint and submit.
    // `generationService` cancels a groupHistory completion whose group no longer exists,
    // so routing at a card that is not there would throw the render away.
    state.currentProject = { itemGroups: [{ id: 'other' }] };
    assert.equal(maskedGenerationOpts(GROUP_ID), null);
    state.currentProject = null;
    assert.equal(maskedGenerationOpts(GROUP_ID), null, 'no project open must not throw');
});

// -- A MASKLESS edit of the card the user is standing in is its next version too ------
//
// MPI-890 live read 2, 2026-09-22: the agent knew the open entry, edited it whole-picture
// in one pass as asked — and the result landed as a new gallery card while the workspace
// Fabio was watching drew no latents. The shapes below are the REAL ones: an entry's
// filePath as `projectFileUrlBusted` writes it, and the agent's media url as
// `agentLoop._projectFileUrl` sends it. MPI-890's first red was a check fed a made-up shape.

test.describe('workspaceGenerationOpts', () => {
    const { workspaceGenerationOpts } = require('../js/shell/agentDispatch.js');
    const ABS = 'C:\\Users\\Fabio\\Documents\\Cubric Vision\\Projects\\Anime Kids and Dog\\Media\\inpaint_005.png';
    const ENTRY = { id: 'i4', filePath: `/project-file?path=${encodeURIComponent(ABS)}&v=1790062432237` };
    const OPEN = { id: GROUP_ID, name: 't2i_003', type: 'image', history: [{ id: 'i1', filePath: '/project-file?path=x' }, ENTRY] };
    const agentUrl = (abs) => `/project-file?path=${encodeURIComponent(abs)}`;
    const standIn = (page) => {
        state.currentProject = { itemGroups: [{ id: 'other', history: [] }, OPEN] };
        state.currentPage = page;
        state.currentParams = { groupId: GROUP_ID };
    };
    const reset = () => { state.currentProject = null; state.currentPage = null; state.currentParams = {}; };

    test('editing an entry of the open card lands in that card, where the latents draw', () => {
        standIn('group-history');
        const opts = workspaceGenerationOpts([{ role: 'inputImage', url: agentUrl(ABS) }]);
        assert.deepEqual(opts, { existingGroup: OPEN, scope: 'groupHistory', groupId: GROUP_ID });
        assert.equal(opts.existingGroup, OPEN, 'the LIVE group, as the masked route hands it');
        reset();
    });

    // MPI-891 (D4) reversed this: it used to make a new card. The edit is that card's next
    // version wherever the user stands, and `_followWork` opens the card to show it.
    test('in the gallery, the same edit still lands in its own card', () => {
        standIn('gallery');
        const opts = workspaceGenerationOpts([{ role: 'inputImage', url: agentUrl(ABS) }], 'image');
        assert.equal(opts?.groupId, GROUP_ID);
        reset();
    });

    test('a picture no card owns goes to the gallery', () => {
        standIn('group-history');
        const other = ABS.replace('inpaint_005', 't2i_009');
        assert.equal(workspaceGenerationOpts([{ role: 'inputImage', url: agentUrl(other) }]), null);
        // The open entry used only as a REFERENCE: the picture being edited is the first item.
        assert.equal(workspaceGenerationOpts([
            { role: 'inputImage', url: agentUrl(other) },
            { role: 'inputImage2', url: agentUrl(ABS) },
        ]), null);
        assert.equal(workspaceGenerationOpts([]), null, 'a t2i has no picture to route by');
        reset();
    });

    test('the submit routes by it, and never renames the card it adds to', () => {
        const src = fs.readFileSync(path.join(repoRoot, 'js', 'shell', 'agentDispatch.js'), 'utf8');
        assert.match(src, /maskedGenerationOpts\(mask\.maskGroupId\) \|\| workspaceGenerationOpts\(mediaItems, model\.mediaType/);
        // Live read 2 named its result "Dawn sky with red eyes": routed into the open card,
        // that name would have replaced "Boy fishing flat cartoon".
        assert.match(src, /_reportDone\(jobId, done, historyOpts \? undefined : input\.cardName/);
    });
});

test('resolveMask carries the card alongside the mask and its picture', () => {
    const r = resolveMask('kleinEdit', PAINTED);
    assert.equal(r.maskGroupId, GROUP_ID);
    // A refusal hands back nothing to route with either.
    assert.equal(resolveMask('inpaint', null).maskGroupId, null);
});

test('the workspace publishes the card id, not just the pixels and their picture', () => {
    // The seam the live bug sat in: dispatch can only route to a card the READER names.
    // Asserted on the line, not by mounting a Block — this file is renderer-free.
    const reader = fs.readFileSync(
        path.join(repoRoot, 'js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js'), 'utf8',
    ).split('\n').find((l) => l.includes('return url ? { dataUrl, url'));
    assert.ok(reader?.includes('groupId: _group.id'),
        'the History workspace stopped publishing the card its mask belongs to');

    // And that dispatch still SENDS it. `maskedGenerationOpts` returning the right object
    // is worth nothing if the enqueue call goes back to the gallery placeholder alone —
    // which is exactly the shape the live bug had.
    const enqueue = fs.readFileSync(path.join(repoRoot, 'js/shell/agentDispatch.js'), 'utf8')
        .split('\n').find((l) => l.includes("scope: 'gallery', tempId, placeholderGroup"));
    assert.ok(enqueue?.includes('historyOpts ||'),
        'the submit no longer prefers the masked card over a new gallery card');
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

// ── One painted area per run on the ops that crop one box ────────────────────

/** A white-on-black RGBA grid with the given filled rectangles [x, y, w, h]. */
function grid(w, h, rects) {
    const px = new Uint8ClampedArray(w * h * 4);
    for (const [rx, ry, rw, rh] of rects) {
        for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) px[(y * w + x) * 4] = 255;
    }
    return px;
}

test('countMaskAreas counts separate areas, merges a stroke gap, ignores specks', () => {
    assert.equal(countMaskAreas(grid(96, 64, []), 96, 64), 0);
    assert.equal(countMaskAreas(grid(96, 64, [[10, 10, 20, 20]]), 96, 64), 1);
    assert.equal(countMaskAreas(grid(96, 64, [[2, 2, 15, 15], [75, 2, 15, 15]]), 96, 64), 2, 'both top corners');
    assert.equal(countMaskAreas(grid(96, 64, [[10, 10, 10, 10], [21, 10, 10, 10]]), 96, 64), 1, 'a one-cell gap is one stroke');
    assert.equal(countMaskAreas(grid(96, 64, [[10, 10, 20, 20], [80, 50, 1, 1]]), 96, 64), 1, 'a speck is not an area');
});

test('several painted areas refuse the one-box ops and pass detail', () => {
    for (const op of ONE_AREA_OPS) {
        assert.equal(resolveMask(op, PAINTED, 2).error?.code, 'MASK_SEVERAL_AREAS', `"${op}" ran on two areas`);
        assert.equal(resolveMask(op, PAINTED, 1).error, undefined, `"${op}" refused one area`);
        assert.equal(resolveMask(op, PAINTED, null).error, undefined, `"${op}" refused an unreadable count`);
    }
    assert.equal(resolveMask('detail', PAINTED, 3).error, undefined, 'detail works each area on its own');
});
