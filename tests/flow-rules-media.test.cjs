/**
 * flow-rules-media.test.cjs — MPI-1101 A3 (D4).
 *
 * `{ media }` joins `ruleHolds` — ONE evaluator for legs, operationBy, step and field
 * `hiddenWhen`, as the rules header promises.
 *
 * Rule shape: `{ media: '<role>', present: true|false }` — tests whether the named media
 * role currently holds a file. `present` omitted = `true` (role IS present).
 * Media context is supplied as `ctx = { media: Set<string> }`.
 *
 * Sections:
 *   1. `ruleHolds` — media rule holds / fails, `present: false`, no-ctx safety, array
 *   2. `hiddenFieldIds` — field hiddenWhen with a media rule
 *   3. `hiddenFieldIds` — step-shaped hiddenWhen with a media rule
 *   4. Combined: a rule array mixing a field clause and a media clause
 *   5. `legWanted`-equivalent via `ruleHolds`: the leg `when: { media }` shape
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const esm = p => import('file://' + path.join(ROOT, p).replace(/\\/g, '/'));

const registry = () => esm('js/data/flowsRegistry.js');
const fields  = () => esm('js/utils/declaredFields.js');

// ── 1. ruleHolds — media rules ──────────────────────────────────────────────

test('ruleHolds: { media, present } holds when the role IS in ctx.media', async () => {
    const { ruleHolds } = await registry();
    const ctx = { media: new Set(['image1', 'mask']) };

    // present: true (default) — role is present → holds
    assert.ok(ruleHolds({ media: 'image1' }, {}, ctx), 'present omitted = true: role present → holds');
    assert.ok(ruleHolds({ media: 'image1', present: true }, {}, ctx), 'present: true: role present → holds');
    assert.ok(ruleHolds({ media: 'mask' }, {}, ctx), 'second present role → holds');

    // role not in Set → fails
    assert.ok(!ruleHolds({ media: 'image2' }, {}, ctx), 'role absent → fails');
    assert.ok(!ruleHolds({ media: 'image2', present: true }, {}, ctx), 'present: true + absent → fails');
});

test('ruleHolds: { media, present: false } holds when the role is NOT present', async () => {
    const { ruleHolds } = await registry();
    const ctx = { media: new Set(['image1']) };

    // No picture in image2 → present:false holds
    assert.ok(ruleHolds({ media: 'image2', present: false }, {}, ctx), 'role absent + present:false → holds');
    assert.ok(!ruleHolds({ media: 'image1', present: false }, {}, ctx), 'role present + present:false → fails');
});

test('ruleHolds: missing or undefined ctx is safe — all present:true media rules fail', async () => {
    const { ruleHolds } = await registry();

    // No ctx at all — treat every role as absent
    assert.ok(!ruleHolds({ media: 'image1' }, {}), 'no ctx: present:true fails (role treated absent)');
    assert.ok(!ruleHolds({ media: 'image1' }, {}, {}), 'empty ctx: present:true fails');
    assert.ok(!ruleHolds({ media: 'image1' }, {}, { media: null }), 'ctx.media null: present:true fails');

    // present:false with no ctx → role is absent, so present:false holds
    assert.ok(ruleHolds({ media: 'image1', present: false }, {}), 'no ctx: present:false holds (role absent)');
    assert.ok(ruleHolds({ media: 'image1', present: false }, {}, {}), 'empty ctx: present:false holds');
});

test('ruleHolds: a media rule works inside a rule array (ALL must hold)', async () => {
    const { ruleHolds } = await registry();
    const ctx = { media: new Set(['image1']) };
    const values = { tiles: 2 };

    // Both hold
    assert.ok(
        ruleHolds([{ media: 'image1' }, { field: 'tiles', atLeast: 1 }], values, ctx),
        'media present + field holds → array holds',
    );

    // Media holds but field fails
    assert.ok(
        !ruleHolds([{ media: 'image1' }, { field: 'tiles', atLeast: 5 }], values, ctx),
        'media present + field fails → array fails',
    );

    // Field holds but media fails
    assert.ok(
        !ruleHolds([{ media: 'image2' }, { field: 'tiles', atLeast: 1 }], values, ctx),
        'media absent + field holds → array fails',
    );

    // Both hold with present:false (no picture)
    const ctxNoPic = { media: new Set() };
    assert.ok(
        ruleHolds([{ media: 'image1', present: false }, { field: 'tiles', atLeast: 1 }], values, ctxNoPic),
        'media absent (present:false) + field holds → array holds',
    );
});

// ── 2. hiddenFieldIds — field hiddenWhen with a media rule ──────────────────

test('hiddenFieldIds: { hiddenWhen: { media, present } } hides the field when the condition holds', async () => {
    const { hiddenFieldIds } = await fields();

    // field hidden when image1 IS present
    const decls = [
        { id: 'direction', hiddenWhen: { media: 'image1', present: false } }, // hidden when NO picture
        { id: 'edges',     hiddenWhen: { media: 'image1' } },                  // hidden when picture IS present (present defaults to true — that would hide when present, i.e. SHOW when absent — this tests the inverse)
    ];

    // With picture
    const withPic = hiddenFieldIds(decls, {}, [], { media: new Set(['image1']) });
    assert.ok(!withPic.has('direction'), 'direction visible when picture IS given');
    assert.ok(withPic.has('edges'), 'edges hidden when picture IS given');

    // Without picture
    const noPic = hiddenFieldIds(decls, {}, [], { media: new Set() });
    assert.ok(noPic.has('direction'), 'direction hidden when no picture');
    assert.ok(!noPic.has('edges'), 'edges visible when no picture');
});

test('hiddenFieldIds: backward compat — callers without ctx are unaffected', async () => {
    const { hiddenFieldIds } = await fields();

    // Existing field hiddenWhen still works with no ctx
    const decls = [
        { id: 'words', hiddenWhen: { field: 'flag', is: true } },
        { id: 'always', hidden: true },
    ];
    const result = hiddenFieldIds(decls, { flag: true });
    assert.ok(result.has('words'), 'field rule still works without ctx');
    assert.ok(result.has('always'), 'hidden:true still works');

    // A media hiddenWhen without ctx takes the safe path (role absent → present:true fails)
    const mediaDecl = [{ id: 'x', hiddenWhen: { media: 'image1' } }];
    assert.ok(!hiddenFieldIds(mediaDecl, {}).has('x'), 'media rule without ctx: present:true → not hidden (safe)');
    assert.ok(hiddenFieldIds(mediaDecl, {}, [], { media: new Set() }).has('x') === false, 'media rule, empty Set: not hidden');
});

// ── 3. hiddenFieldIds — step-shaped hiddenWhen with a media rule ─────────────

test('hiddenFieldIds: a step\'s hiddenWhen using { media } (the shape _visibleSteps will use)', async () => {
    const { hiddenFieldIds } = await fields();

    // A step hides when there is no picture (the Edges step in Make Seamless)
    const stepDecl = [{ id: 'edges-step', hiddenWhen: { media: 'image1', present: false } }];

    // No picture → step hidden
    const hidden = hiddenFieldIds(stepDecl, {}, [], { media: new Set() });
    assert.ok(hidden.has('edges-step'), 'step hidden when no picture');

    // Picture present → step visible
    const visible = hiddenFieldIds(stepDecl, {}, [], { media: new Set(['image1']) });
    assert.ok(!visible.has('edges-step'), 'step visible when picture given');
});

// ── 4. Combined field + media in one array ───────────────────────────────────

test('hiddenFieldIds: hiddenWhen array mixing field and media clauses', async () => {
    const { hiddenFieldIds } = await fields();

    // Hidden when BOTH hold: picture absent AND tiles >= 2
    const decls = [
        { id: 'x', hiddenWhen: [{ media: 'image1', present: false }, { field: 'tiles', atLeast: 2 }] },
    ];

    // Neither holds
    const noPicLowTiles = hiddenFieldIds(decls, { tiles: 1 }, [], { media: new Set() });
    assert.ok(!noPicLowTiles.has('x'), 'media absent + tiles too low → not hidden');

    // Media holds but field does not
    const noPicHighTiles = hiddenFieldIds(decls, { tiles: 3 }, [], { media: new Set() });
    assert.ok(noPicHighTiles.has('x'), 'both hold → hidden');

    // Both in the wrong direction
    const withPicHighTiles = hiddenFieldIds(decls, { tiles: 3 }, [], { media: new Set(['image1']) });
    assert.ok(!withPicHighTiles.has('x'), 'picture present → media clause fails → not hidden');
});

// ── 5. ruleHolds — the leg `when: { media }` shape ──────────────────────────
//
// `legWanted` is a private function called by `flowRunLegs`. Today `flowRunLegs` does not
// accept a ctx parameter (outside ownership for this task). This section tests `ruleHolds`
// directly with the exact shape a leg `when` would carry, to prove the evaluator is correct.
// The call sites that must be updated for full end-to-end wiring are listed in the report.

test('ruleHolds with the exact shape a leg `when: { media }` would carry', async () => {
    const { ruleHolds } = await registry();

    // "leg runs only when there is no picture in image1" (Make Seamless leg 1: T2I)
    const when = { media: 'image1', present: false };
    const ctxNoPic  = { media: new Set() };
    const ctxWithPic = { media: new Set(['image1']) };

    assert.ok(ruleHolds(when, {}, ctxNoPic),  'no picture → leg runs');
    assert.ok(!ruleHolds(when, {}, ctxWithPic), 'picture given → leg skipped');

    // "leg runs only when there IS a picture" (the direct-edit leg)
    const whenPic = { media: 'image1' };
    assert.ok(ruleHolds(whenPic, {}, ctxWithPic), 'picture given → direct-edit leg runs');
    assert.ok(!ruleHolds(whenPic, {}, ctxNoPic),  'no picture → direct-edit leg skipped');

    // Confirm ruleHolds is the SAME function re-exported by declaredFields.js
    const { ruleHolds: ruleHoldsFromFields } = await fields();
    assert.strictEqual(ruleHolds, ruleHoldsFromFields, 'one evaluator, two import paths');
});
