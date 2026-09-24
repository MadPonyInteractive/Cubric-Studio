'use strict';

/**
 * agent-view-follow.test.cjs — MPI-891, the agent moves the view to where its work renders.
 *
 * Fabio, 2026-09-22: "If the agent is going to perform something like an edit to an image,
 * that needs to happen in the history workspace ... so that the user can see the latents
 * coming in." And for Flows: the user must SEE it run. The guard is the whole job: never
 * yank the view mid-gesture, and never for work the user did not ask for in that turn.
 *
 * Pure logic — no renderer, no canvas, no GPU.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { followBlocker, followTarget, workspaceGenerationOpts } = require('../js/shell/agentDispatch.js');
const { state } = require('../js/state.js');

const IDLE = { pointerHeld: false, overlayDepth: 0, canvasMode: 'none' };
const abs = (name) => `C:\\Users\\Fabio\\Documents\\Cubric\\Agent tests\\Media\\${name}.png`;
const url = (name) => `/project-file?path=${encodeURIComponent(abs(name))}`;
const IMAGE_CARD = { id: 'g-img', type: 'image', history: [{ id: 'i1', filePath: url('t2i_001') }, { id: 'i2', filePath: `${url('edit_002')}&v=1` }] };
const OPEN_CARD = { id: 'g-open', type: 'image', history: [{ id: 'o1', filePath: url('t2i_009') }] };
const stand = (page, groupId = null) => {
    state.currentProject = { itemGroups: [OPEN_CARD, IMAGE_CARD] };
    state.currentPage = page;
    state.currentParams = groupId ? { groupId } : {};
};
const reset = () => { state.currentProject = null; state.currentPage = null; state.currentParams = {}; };

test.describe('followBlocker — never mid-gesture (D2)', () => {
    test('idle, or only comparing: the view may move', () => {
        assert.equal(followBlocker(IDLE), null);
        assert.equal(followBlocker({ ...IDLE, canvasMode: 'compare' }), null);
        assert.equal(followBlocker({ ...IDLE, canvasMode: null }), null, 'no canvas mounted');
    });

    test('a held button, an open overlay, or a working canvas tool each keep it still', () => {
        assert.equal(followBlocker({ ...IDLE, pointerHeld: true }), 'pointer-held');
        assert.equal(followBlocker({ ...IDLE, overlayDepth: 1 }), 'overlay-open');
        for (const mode of ['mask', 'paint', 'composite', 'crop']) {
            assert.equal(followBlocker({ ...IDLE, canvasMode: mode }), `canvas-${mode}`);
        }
    });
});

test.describe('followTarget — where the view goes, and when (D1)', () => {
    const history = { groupId: 'g-img' };

    test('an edit that lands in a card opens that card; a new card or a Flow opens the gallery', () => {
        stand('gallery');
        assert.deepEqual(followTarget({ follow: true }, history, IDLE), { page: 'group-history', params: { groupId: 'g-img' } });
        stand('group-history', 'g-open');
        assert.deepEqual(followTarget({ follow: true }, null, IDLE), { page: 'gallery', params: {} });
        reset();
    });

    test('already there: nothing to do', () => {
        stand('group-history', 'g-img');
        assert.equal(followTarget({ follow: true }, history, IDLE), null);
        stand('gallery');
        assert.equal(followTarget({ follow: true }, null, IDLE), null);
        reset();
    });

    test('no follow (a wake, a carry, a CLI agent) never moves anything', () => {
        stand('gallery');
        assert.equal(followTarget({}, history, IDLE), null);
        assert.equal(followTarget({ follow: false }, history, IDLE), null);
        reset();
    });

    test('mid-gesture it stays, even for work the user just asked for', () => {
        stand('group-history', 'g-open');
        assert.equal(followTarget({ follow: true }, null, { ...IDLE, canvasMode: 'mask' }), null);
        assert.equal(followTarget({ follow: true }, null, { ...IDLE, overlayDepth: 1 }), null);
        reset();
    });
});

test.describe('workspaceGenerationOpts — an edit lands in the card that owns the picture (D4)', () => {
    test('an entry of a card that is NOT open routes to that card, with the gallery on screen', () => {
        stand('gallery');
        const opts = workspaceGenerationOpts([{ role: 'inputImage', url: url('edit_002') }], 'image');
        assert.equal(opts?.existingGroup, IMAGE_CARD, 'the LIVE group');
        assert.deepEqual({ scope: opts.scope, groupId: opts.groupId }, { scope: 'groupHistory', groupId: 'g-img' });
        reset();
    });

    test('a clip made from a still is a new card, not a video entry in the image card', () => {
        stand('gallery');
        assert.equal(workspaceGenerationOpts([{ role: 'inputImage', url: url('t2i_001') }], 'video'), null);
        reset();
    });

    test('a picture no card owns (a copied attachment) still goes to the gallery', () => {
        stand('gallery');
        assert.equal(workspaceGenerationOpts([{ role: 'inputImage', url: '/project-file?path=C%3A%2Ftmp%2Fcubric-agent%2Fatt_1.png' }], 'image'), null);
        reset();
    });
});

test('dispatch navigates BEFORE it enqueues, on both the model and the Flow path', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'shell', 'agentDispatch.js'), 'utf8');
    assert.match(src, /_followWork\(input, historyOpts\);\s*const queued = enqueueGeneration\(/);
    assert.match(src, /_followWork\(input, null\);\s*const queued = submitFlowGeneration\(/);
});

test('the connector forwards follow only as a literal true', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'connector.js'), 'utf8');
    assert.match(src, /if \(req\.body\?\.follow === true\) input\.follow = true;/);
});
