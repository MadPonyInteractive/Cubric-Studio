/**
 * flow-media-ctx.test.cjs — Task 1 verification for MPI-1101 Phase 3a.
 *
 * Verifies:
 * 1. `flowMediaCtx` builds the correct Set from mediaItems.
 * 2. `flowRunLegs` skips a `when: { media: 'image1', present: false }` leg when
 *    image1 IS given and keeps it when image1 is absent.
 * 3. A `present: true` leg hides when the role is absent.
 *
 * Run: node --test tests/flow-media-ctx.test.cjs
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const esm = p => import('file://' + path.join(__dirname, '..', p).replace(/\\/g, '/'));

// ── flowMediaCtx ────────────────────────────────────────────────────────────

test('flowMediaCtx: roles with url or filePath are present', async () => {
    const { flowMediaCtx } = await esm('js/data/flowsRegistry.js');
    const ctx = flowMediaCtx([
        { role: 'image1', url: '/some/path.png' },
        { role: 'image2', filePath: '/other.png' },
        { role: 'mask' },                        // no url → absent
        { role: 'ref', url: '' },                 // empty string → absent
    ]);
    assert.ok(ctx.media instanceof Set, 'media is a Set');
    assert.ok(ctx.media.has('image1'), 'image1 present');
    assert.ok(ctx.media.has('image2'), 'image2 present');
    assert.ok(!ctx.media.has('mask'), 'mask absent (no url/filePath)');
    assert.ok(!ctx.media.has('ref'), 'ref absent (empty url)');
});

test('flowMediaCtx: null / empty input is safe', async () => {
    const { flowMediaCtx } = await esm('js/data/flowsRegistry.js');
    assert.deepEqual([...flowMediaCtx(null).media], []);
    assert.deepEqual([...flowMediaCtx([]).media], []);
    assert.deepEqual([...flowMediaCtx(undefined).media], []);
});

// ── flowRunLegs: media-gated legs ───────────────────────────────────────────

/**
 * A minimal synthetic flow: leg 1 = always, leg 2 = only when image1 is absent.
 * This models the "make seamless t2i" leg that runs when no picture is given.
 */
function _makeFlow() {
    return {
        id: 'test-media-ctx',
        operation: 'opAlways',
        chain: [
            {
                operation: 'opNoImage',
                when: { media: 'image1', present: false },
            },
            {
                operation: 'opWithImage',
                when: { media: 'image1', present: true },
            },
        ],
    };
}

test('flowRunLegs: present:false leg is SKIPPED when image1 is given', async () => {
    const { flowRunLegs, flowMediaCtx } = await esm('js/data/flowsRegistry.js');
    const flow = _makeFlow();
    const mediaItems = [{ role: 'image1', url: '/img.png' }];
    const ctx = flowMediaCtx(mediaItems);
    const run = { mediaItems };
    const legs = flowRunLegs(flow, run, ctx);
    const ops = legs.map(l => l.operation);
    assert.ok(ops.includes('opAlways'), 'leg 1 always runs');
    assert.ok(!ops.includes('opNoImage'), 'present:false leg is skipped when image1 given');
    assert.ok(ops.includes('opWithImage'), 'present:true leg runs when image1 given');
});

test('flowRunLegs: present:false leg RUNS when image1 is absent', async () => {
    const { flowRunLegs, flowMediaCtx } = await esm('js/data/flowsRegistry.js');
    const flow = _makeFlow();
    const ctx = flowMediaCtx([]);
    const run = { mediaItems: [] };
    const legs = flowRunLegs(flow, run, ctx);
    const ops = legs.map(l => l.operation);
    assert.ok(ops.includes('opAlways'), 'leg 1 runs');
    assert.ok(ops.includes('opNoImage'), 'present:false leg runs when image1 absent');
    assert.ok(!ops.includes('opWithImage'), 'present:true leg is skipped when image1 absent');
});

test('flowRunLegs: backward compat — no ctx treats all roles as absent (present:true legs hidden)', async () => {
    const { flowRunLegs } = await esm('js/data/flowsRegistry.js');
    const flow = _makeFlow();
    const run = {};
    const legs = flowRunLegs(flow, run);
    const ops = legs.map(l => l.operation);
    assert.ok(ops.includes('opNoImage'), 'present:false runs with no ctx');
    assert.ok(!ops.includes('opWithImage'), 'present:true is skipped with no ctx');
});
