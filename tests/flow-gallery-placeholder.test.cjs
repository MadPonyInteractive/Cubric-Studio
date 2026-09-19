/**
 * flow-gallery-placeholder.test.cjs — MPI-827.
 *
 * A flow run was invisible in the Gallery: it IS a `scope: 'gallery'` gen, it DOES
 * enter `_myGenIds`, and `preview:frame` DOES reach MpiGalleryBlock — but
 * `submitFlowGeneration` passed no `placeholderGroup`, so `_placeholdersForFirst()`
 * had nothing to mount and the latent landed nowhere. Withholding it was deliberate
 * (MPI-306) and the premise expired: Apply was removed, so a flow result commits on
 * completion anyway, and an AGENT-dispatched flow has no overlay at all.
 *
 * Source contracts — `submitFlowGeneration` reaches `enqueueGeneration` and the real
 * queue, which bare Node cannot stand up.
 *
 * NOT TESTABLE HERE, stated rather than skipped in silence: that the card actually
 * appears and its latents paint. That is Fabio's check, from the agent, standing in
 * the Gallery (MPI-827 plan.md § Verification).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = p => path.join(__dirname, '..', p);
const read = p => fs.readFileSync(repo(p), 'utf8');

test('a flow run carries a gallery placeholder, unconditionally', () => {
    const src = read('js/services/flowService.js');

    // THE fix. Without a group in opts there is no card for the latent to paint on.
    assert.match(src, /const opts = \{\s*\n\s*scope: 'gallery',\s*\n\s*tempId,\s*\n\s*placeholderGroup,\s*\n\s*\};/);

    // ALWAYS — not gated on whether a flow overlay happens to be open. The result
    // commits to the gallery on completion regardless, so the placeholder is simply
    // where that card is going to be, and an agent-run flow has no overlay to check.
    const build = src.slice(src.indexOf('const placeholderGroup = {'),
        src.indexOf('const opts = {'));
    assert.ok(build.length > 0, 'the placeholder must be built before opts');
    assert.ok(!/\bif\b/.test(build),
        'the placeholder is unconditional — no overlay-is-open branch');

    // The shape MpiGalleryBlock renders: `isGenerating` is what makes the grid draw
    // it as a running card, and the id must be the tempId the latent routes by.
    assert.match(build, /id: tempId,/);
    assert.match(build, /isGenerating: true,/);
    assert.match(build, /name: 'Generating\.\.\.',/);
    assert.match(build, /type: flow\.mediaType \|\| 'image',/);
});

test('the placeholder matches the shape agentDispatch already builds', () => {
    const flow = read('js/services/flowService.js');
    const agent = read('js/shell/agentDispatch.js');

    // One shape, two producers. A field the grid needs that only one of them sets is
    // exactly the bug MPI-827 fixed, in the other direction. Either spelling counts —
    // agentDispatch writes `width,` shorthand off locals, flowService writes `width:`.
    const block = (src) => src.slice(src.indexOf('placeholderGroup = {'),
        src.indexOf('isGenerating: true,', src.indexOf('placeholderGroup = {')));
    for (const key of ['id', 'type', 'name', 'history', 'selectedIndex', 'width', 'height']) {
        const has = new RegExp(`\\b${key}\\s*[:,]`);
        assert.match(block(flow), has, `flowService placeholder is missing ${key}`);
        assert.match(block(agent), has, `agentDispatch placeholder is missing ${key}`);
    }
    for (const src of [flow, agent]) assert.match(src, /isGenerating: true,/);
});

test('exactly one preview player owns a flow run\'s frames', () => {
    // previewClipPlayer's invariant: AT MOST ONE player per generation may set
    // ownsFrames, or one revokes blobs the other is still looping. A flow run is
    // gallery-scope and now mounts a gallery placeholder, so the grid's player is its
    // owner — which only holds while the flow pane's own player does NOT own.
    const owners = ['js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js',
        'js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js',
        'js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js',
        'js/shell/floatLatentBridge.js']
        .filter(p => /ownsFrames:\s*true/.test(read(p)));

    assert.deepStrictEqual(owners.sort(), [
        'js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js',
        'js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js',
    ], 'the Flow pane and the float bridge must never own frames — they overlap the other two');
});

test('the chained leg still reuses leg 1 tempId, and says why that is safe now', () => {
    const src = read('js/services/flowService.js');

    // Unchanged by MPI-827, and load-bearing: leg 2 builds its own placeholder under
    // the SAME tempId. That cannot collide with leg 1's landed card, because a
    // committed card takes a real group id from the media commit, never the tempId.
    assert.match(src, /const tempId = _leg\.tempId \|\| crypto\.randomUUID\(\)/);

    // The MPI-306 "no placeholder, it would be noise" comment must not survive the
    // code it described — a comment that lies is what sends the next reader wrong.
    assert.ok(!/Still\s*\n?\s*\/\/ NO gallery placeholder/.test(src));
    assert.ok(!/No gallery placeholder \(MPI-306\)/.test(src));
});
