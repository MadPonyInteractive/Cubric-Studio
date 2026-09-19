'use strict';

const test = require('node:test');
const assert = require('node:assert');

/**
 * MPI-736 round 9 — a node portalled to document.body inherits from `:root`, never from
 * the trigger that opened it, so every picker's selected row drew the shared cream even
 * when the workspace around its trigger was orange. `inheritAccent` is the one helper the
 * four portalled pickers call at OPEN time.
 *
 * The second test is the load-bearing one: the same Dropdown instance can be reopened in a
 * different workspace, so an accent that is no longer above the trigger must be REMOVED,
 * not left behind. A helper that only ever sets would leave a video-orange list opening in
 * an audio Flow.
 */

/** Minimal stand-ins — the helper only touches `closest` and `dataset`. */
const anchorIn = (accent) => ({ closest: () => (accent ? { dataset: { accent } } : null) });
const portal = () => ({ dataset: {} });

test('inheritAccent copies the nearest [data-accent] above the trigger', async () => {
    const { inheritAccent } = await import('../js/utils/dom.js');

    const list = portal();
    inheritAccent(list, anchorIn('video'));
    assert.strictEqual(list.dataset.accent, 'video');
});

test('inheritAccent CLEARS a stale accent when the trigger no longer sits under one', async () => {
    const { inheritAccent } = await import('../js/utils/dom.js');

    const list = portal();
    inheritAccent(list, anchorIn('video'));
    inheritAccent(list, anchorIn(null));
    assert.ok(!('accent' in list.dataset),
        'a reopened picker must not keep the previous workspace colour');
});

test('inheritAccent survives a missing or detached trigger', async () => {
    const { inheritAccent } = await import('../js/utils/dom.js');

    const list = portal();
    assert.doesNotThrow(() => inheritAccent(list, null));
    assert.doesNotThrow(() => inheritAccent(list, {}));
    assert.ok(!('accent' in list.dataset));
});
