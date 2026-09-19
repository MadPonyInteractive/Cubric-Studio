'use strict';

/**
 * MPI-830 — `js/shell/gifJobs.js`, the renderer half of the connector's GIF
 * surface.
 *
 * The handlers are orchestration: find the card, do the frame-list math, pick
 * ONE route, land the result as a card or a history entry. Every one of those
 * steps is a place where a wrong turn still answers `ok: true` — the wrong
 * route, a `loop: 0` dropped as falsy, a new card where the UI would have added
 * an entry. So the whole module runs here against a stubbed `fetch` and a real
 * `state`, and the assertions are on the REQUESTS it makes and the project it
 * leaves behind.
 *
 * Not covered here, deliberately: `gif.cutout`'s engine leg. `runGifCutoutTrack`
 * reaches `getEngine()` and a real ComfyUI, so the honest proof is a live run in
 * the app — its guards (unknown item, not a GIF) are tested, the graph is not.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

let gifJobs;
let state;

/** Every request the module made this test, in order. */
let calls = [];
/** url -> the `{ success: ... }` body the stub answers with. */
let replies = {};

const realFetch = globalThis.fetch;

function installFetch() {
    globalThis.fetch = async (url, options = {}) => {
        const body = options.body ? JSON.parse(options.body) : null;
        calls.push({ url, body });
        const reply = typeof replies[url] === 'function' ? replies[url](body) : replies[url];
        return {
            ok: true,
            json: async () => reply ?? { success: true },
        };
    };
}

/** A GIF card in the open project, plus whatever else the test needs beside it. */
function seedProject(extraGroups = []) {
    state.currentProject = {
        name: 'Test',
        folderPath: 'C:/projects/test',
        itemGroups: [
            {
                id: 'grp-gif',
                type: 'image',
                name: 'A GIF',
                createdAt: '2026-09-19T00:00:00.000Z',
                selectedIndex: 0,
                open: false,
                favourite: false,
                archived: false,
                customName: null,
                history: [{
                    id: 'gif-1',
                    type: 'image',
                    filePath: 'C:/projects/test/Media/a.gif',
                    gif: {
                        frames: [{ hash: 'h1', delay: 10 }, { hash: 'h2', delay: 10 }, { hash: 'h3', delay: 10 }],
                        loop: 0,
                        output: { maxEdge: 1024, colours: 256, edgeColour: null },
                    },
                }],
            },
            ...extraGroups,
        ],
    };
}

const stillGroup = (id) => ({
    id: `grp-${id}`, type: 'image', name: id, createdAt: '2026-09-19T00:00:00.000Z',
    selectedIndex: 0, open: false, favourite: false, archived: false, customName: null,
    history: [{ id, type: 'image', filePath: `C:/projects/test/Media/${id}.png`, gif: null }],
});

const videoGroup = (id) => ({
    id: `grp-${id}`, type: 'video', name: id, createdAt: '2026-09-19T00:00:00.000Z',
    selectedIndex: 0, open: false, favourite: false, archived: false, customName: null,
    history: [{ id, type: 'video', filePath: `C:/projects/test/Media/${id}.mp4` }],
});

/** A raw sidecar descriptor, the shape every `/gif/*` route answers with. */
const landed = (id, frames = 3) => ({
    success: true,
    item: {
        id,
        filePath: `C:/projects/test/Media/${id}.gif`,
        thumbPath: null,
        operation: 'gif-edit',
        displayName: id,
        pixelDimensions: { w: 100, h: 100 },
        gif: { frames: Array.from({ length: frames }, (_, i) => ({ hash: `n${i}`, delay: 10 })), loop: 0 },
    },
});

const call = (url) => calls.find(c => c.url === url);

test.before(async () => {
    installFetch();
    gifJobs = await import('../js/shell/gifJobs.js');
    ({ state } = await import('../js/state.js'));
});

test.beforeEach(() => {
    calls = [];
    replies = { '/update-project': { success: true } };
    seedProject();
});

test.after(() => {
    globalThis.fetch = realFetch;
});

// ── the guards every verb shares ────────────────────────────────────────────

test('no open project: every verb says so instead of throwing', async () => {
    state.currentProject = null;
    for (const [cap, input] of [
        ['gif.make', { itemIds: ['a', 'b'] }],
        ['gif.edit', { itemId: 'gif-1', fps: 8 }],
        ['gif.cutout', { itemId: 'gif-1', method: 'background' }],
        ['gif.to-video', { itemId: 'gif-1' }],
    ]) {
        const res = await gifJobs.runGifJob(cap, input);
        assert.equal(res.ok, false, cap);
        assert.equal(res.error.code, 'NO_PROJECT', cap);
    }
    assert.equal(calls.length, 0, 'nothing should have been posted');
});

test('an id that is in no card names the id, not "nothing eligible"', async () => {
    const res = await gifJobs.runGifJob('gif.edit', { itemId: 'nope', fps: 8 });
    assert.equal(res.error.code, 'UNKNOWN_ITEM');
    assert.match(res.error.message, /nope/);
});

test('a still image is not a GIF, and says which item', async () => {
    seedProject([stillGroup('still-1')]);
    for (const cap of ['gif.edit', 'gif.cutout', 'gif.to-video']) {
        const res = await gifJobs.runGifJob(cap, { itemId: 'still-1', fps: 8, method: 'background' });
        assert.equal(res.error.code, 'NOT_A_GIF', cap);
        assert.match(res.error.message, /still-1/, cap);
    }
});

test('a failing route comes back as its own message, never a bare "failed"', async () => {
    replies['/gif/entry'] = { success: false, error: 'unknown frame hash: h9' };
    const res = await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', fps: 8 });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'RUNTIME_ERROR');
    assert.match(res.error.message, /unknown frame hash: h9/);
});

// ── make ────────────────────────────────────────────────────────────────────

test('make from stills posts the ids and lands a NEW card', async () => {
    seedProject([stillGroup('s1'), stillGroup('s2')]);
    replies['/gif/make'] = landed('made-1');
    const before = state.currentProject.itemGroups.length;

    const res = await gifJobs.runGifJob('gif.make', { itemIds: ['s1', 's2'] });

    assert.equal(res.ok, true);
    assert.deepEqual(call('/gif/make').body, { folderPath: 'C:/projects/test', itemIds: ['s1', 's2'] });
    assert.equal(state.currentProject.itemGroups.length, before + 1);
    // `addGroupToProject` APPENDS; the gallery's own prepend is a view order.
    const made = state.currentProject.itemGroups.find(g => g.id === res.output.groupId);
    assert.equal(made.history[0].id, 'made-1');
    assert.equal(res.output.itemId, 'made-1');
    assert.equal(res.output.frames, 3);
});

test('make from stills checks every id BEFORE posting', async () => {
    seedProject([stillGroup('s1')]);
    const res = await gifJobs.runGifJob('gif.make', { itemIds: ['s1', 'ghost'] });
    assert.equal(res.error.code, 'UNKNOWN_ITEM');
    assert.match(res.error.message, /ghost/);
    assert.equal(call('/gif/make'), undefined, 'the route must not be reached');
});

test('make from a video posts its full-res path and the trim pair', async () => {
    seedProject([videoGroup('v1')]);
    replies['/gif/maker'] = landed('made-2');

    const res = await gifJobs.runGifJob('gif.make',
        { videoItemId: 'v1', fps: 12, sizePreset: '480xauto', loop: 3, trimIn: 1.5, trimOut: 4 });

    assert.equal(res.ok, true);
    assert.deepEqual(call('/gif/maker').body, {
        folderPath: 'C:/projects/test',
        sourcePath: 'C:/projects/test/Media/v1.mp4',
        fps: 12,
        sizePreset: '480xauto',
        loop: 3,
        trimIn: 1.5,
        trimOut: 4,
    });
});

test('make from a video refuses an image card by name', async () => {
    seedProject([stillGroup('s1')]);
    const res = await gifJobs.runGifJob('gif.make', { videoItemId: 's1', fps: 12 });
    assert.equal(res.error.code, 'WRONG_TYPE');
    assert.match(res.error.message, /is a image, not a video/);
    assert.equal(call('/gif/maker'), undefined);
});

// ── edit ────────────────────────────────────────────────────────────────────

test('edit with only timing goes to /gif/entry as a NEW entry on the same card', async () => {
    replies['/gif/entry'] = landed('edit-1');
    const before = state.currentProject.itemGroups.length;

    const res = await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', fps: 8 });

    const body = call('/gif/entry').body;
    assert.equal(body.mode, 'new');
    assert.equal(body.sourceItemId, 'gif-1');
    assert.equal(body.sourceGroupId, 'grp-gif');
    // The card gained a history entry; the gallery gained no card.
    assert.equal(state.currentProject.itemGroups.length, before);
    const group = state.currentProject.itemGroups.find(g => g.id === 'grp-gif');
    assert.equal(group.history.length, 2);
    assert.equal(group.history[1].id, 'edit-1');
    assert.equal(res.output.groupId, 'grp-gif');
});

test('edit: fps becomes the delay gifTiming would write, on every frame', async () => {
    replies['/gif/entry'] = landed('edit-2');
    await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', fps: 8 });
    // 100 / 8 = 12.5 -> 13 hundredths, the Speed panel's own rounding.
    assert.deepEqual(call('/gif/entry').body.frames.map(f => f.delay), [13, 13, 13]);
});

test('edit: trim keeps the named frames, inclusive', async () => {
    replies['/gif/entry'] = landed('edit-3');
    await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', trim: { in: 1, out: 2 } });
    assert.deepEqual(call('/gif/entry').body.frames.map(f => f.hash), ['h2', 'h3']);
});

test('edit: loop 0 is sent, not dropped as falsy', async () => {
    replies['/gif/entry'] = landed('edit-4');
    await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', loop: 0 });
    assert.equal(call('/gif/entry').body.loop, 0);
});

test('edit: an edgeColour is a transparent build, null is an opaque one', async () => {
    replies['/gif/entry'] = landed('edit-5');
    await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', output: { edgeColour: '#112233' } });
    assert.equal(call('/gif/entry').body.output.edgeColour, '#112233');

    calls = [];
    await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', output: { edgeColour: null, colours: 64 } });
    assert.equal(call('/gif/entry').body.output.edgeColour, null);
    assert.equal(call('/gif/entry').body.output.colours, 64);
});

test('edit: crop goes to /gif/crop, carrying the timing edits with it', async () => {
    replies['/gif/crop'] = landed('edit-6');
    await gifJobs.runGifJob('gif.edit',
        { itemId: 'gif-1', fps: 8, crop: { x: 1, y: 2, width: 30, height: 40, fill: '#000000' } });

    const body = call('/gif/crop').body;
    assert.equal(call('/gif/entry'), undefined, 'one route per call');
    assert.deepEqual([body.x, body.y, body.w, body.h], [1, 2, 30, 40]);
    assert.equal(body.fill, '#000000');
    assert.deepEqual(body.frames.map(f => f.delay), [13, 13, 13]);
});

test('edit: crop resolution is outW/outH, the names the route takes', async () => {
    replies['/gif/crop'] = landed('edit-7');
    await gifJobs.runGifJob('gif.edit',
        { itemId: 'gif-1', crop: { x: 0, y: 0, width: 50, height: 50, outWidth: 512, outHeight: 512 } });
    const body = call('/gif/crop').body;
    assert.equal(body.outW, 512);
    assert.equal(body.outH, 512);
});

test('edit: resize goes to /gif/resize', async () => {
    replies['/gif/resize'] = landed('edit-8');
    await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', resize: { width: 320, height: 240 } });
    const body = call('/gif/resize').body;
    assert.equal(body.width, 320);
    assert.equal(body.height, 240);
});

test('edit: crop AND resize in one call is refused before anything is written', async () => {
    const res = await gifJobs.runGifJob('gif.edit', {
        itemId: 'gif-1',
        crop: { x: 0, y: 0, width: 10, height: 10 },
        resize: { width: 320, height: 240 },
    });
    assert.equal(res.error.code, 'BAD_REQUEST');
    assert.match(res.error.message, /not both/);
    assert.equal(calls.length, 0);
});

test('edit: an empty frame list re-extracts rather than posting an empty GIF', async () => {
    // An empty `frames` is a 400 from every /gif/ route, so the module must
    // never send one. A stored list that is empty means the store never
    // filled: try the extraction, and fail by name when it cannot.
    state.currentProject.itemGroups[0].history[0].gif.frames = [];
    replies['/gif/ensure-frames'] = { success: true, gif: { frames: [], loop: 0 } };
    const res = await gifJobs.runGifJob('gif.edit', { itemId: 'gif-1', fps: 8 });
    assert.equal(res.error.code, 'NOT_A_GIF');
    assert.equal(call('/gif/entry'), undefined, 'no entry may be written');
});

// ── to-video ────────────────────────────────────────────────────────────────

test('to-video lands a NEW video card and leaves the GIF alone', async () => {
    replies['/gif/to-video'] = {
        success: true,
        item: {
            id: 'vid-1', filePath: 'C:/projects/test/Media/a.mp4', thumbPath: null,
            operation: 'gif-to-video', displayName: 'a', pixelDimensions: { w: 100, h: 100 },
            duration: 0.3, fps: 10,
        },
    };
    const before = state.currentProject.itemGroups.length;

    const res = await gifJobs.runGifJob('gif.to-video', { itemId: 'gif-1', background: '#101014' });

    assert.equal(res.ok, true);
    assert.equal(res.output.type, 'video');
    const body = call('/gif/to-video').body;
    assert.equal(body.background, '#101014');
    assert.equal(body.itemId, 'gif-1');
    assert.deepEqual(body.frames.map(f => f.hash), ['h1', 'h2', 'h3']);

    assert.equal(state.currentProject.itemGroups.length, before + 1);
    assert.equal(state.currentProject.itemGroups.find(g => g.id === res.output.groupId).type, 'video');
    // The GIF card is untouched: one entry, still the one it started with.
    assert.equal(state.currentProject.itemGroups.find(g => g.id === 'grp-gif').history.length, 1);
});

test('to-video without a background sends no background field at all', async () => {
    replies['/gif/to-video'] = { success: true, item: { id: 'vid-2', filePath: 'x.mp4' } };
    await gifJobs.runGifJob('gif.to-video', { itemId: 'gif-1' });
    assert.equal('background' in call('/gif/to-video').body, false);
});

// ── frames on demand ────────────────────────────────────────────────────────

test('a legacy GIF with no frames store is extracted, then used', async () => {
    // A GIF imported before MPI-768 has `gif: null`. Deciding "is this a GIF"
    // on the frames store would refuse it and make `/gif/ensure-frames`
    // unreachable — the file is what decides.
    seedProject();
    state.currentProject.itemGroups[0].history[0].gif = null;
    replies['/gif/ensure-frames'] = {
        success: true,
        gif: { frames: [{ hash: 'x1', delay: 7 }, { hash: 'x2', delay: 7 }], loop: 2 },
    };
    replies['/gif/to-video'] = { success: true, item: { id: 'vid-3', filePath: 'x.mp4' } };

    const res = await gifJobs.runGifJob('gif.to-video', { itemId: 'gif-1' });

    assert.equal(res.ok, true);
    assert.deepEqual(call('/gif/ensure-frames').body, { folderPath: 'C:/projects/test', itemId: 'gif-1' });
    // The EXTRACTED frames are what the verb then works on.
    assert.deepEqual(call('/gif/to-video').body.frames, [{ hash: 'x1', delay: 7 }, { hash: 'x2', delay: 7 }]);
});

test('a card that is no GIF at all never reaches ensure-frames', async () => {
    seedProject([stillGroup('still-1')]);
    const res = await gifJobs.runGifJob('gif.to-video', { itemId: 'still-1' });
    assert.equal(res.error.code, 'NOT_A_GIF');
    assert.equal(call('/gif/ensure-frames'), undefined);
});

test('a .gif whose frames cannot be extracted says so, and lands nothing', async () => {
    seedProject();
    state.currentProject.itemGroups[0].history[0].gif = null;
    replies['/gif/ensure-frames'] = { success: true, gif: { frames: [], loop: 0 } };
    const res = await gifJobs.runGifJob('gif.to-video', { itemId: 'gif-1' });
    assert.equal(res.error.code, 'NOT_A_GIF');
    assert.equal(call('/gif/to-video'), undefined);
});

// ── the capability map ──────────────────────────────────────────────────────

test('GIF_HANDLERS names exactly the four capabilities the routes dispatch', () => {
    assert.deepEqual(
        Object.keys(gifJobs.GIF_HANDLERS).sort(),
        ['gif.cutout', 'gif.edit', 'gif.make', 'gif.to-video'],
    );
});
