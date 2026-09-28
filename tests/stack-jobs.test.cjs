'use strict';

/**
 * MPI-949 Phase 4 — a stack's batch Apply in the History workspace (js/data/stackJobs.js).
 *
 * One job per target member, each landing as THAT member's next version, with the rail's
 * params unchanged — except a Resize, which sends a rule and gets a size per member.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let J;

test.before(async () => {
    J = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'data', 'stackJobs.js')).href);
});

const member = (id, items, selectedIndex = items.length - 1) => ({
    id, type: 'image', selectedIndex,
    history: items.map((p, i) => ({ id: `${id}-v${i + 1}`, filePath: p })),
});
const three = () => [
    member('a', ['C:/p/a1.png', 'C:/p/a2.png']),
    member('b', ['C:/p/b1.png']),
    member('c', ['C:/p/c1.png', 'C:/p/c2.png'], 0),
];

test('targets: every member with a file, or only the picked ones', () => {
    const ms = three();
    assert.deepStrictEqual(J.stackTargets(ms).map(m => m.id), ['a', 'b', 'c']);
    assert.deepStrictEqual(J.stackTargets(ms, [2, 0]).map(m => m.id), ['c', 'a']);
    assert.deepStrictEqual(J.stackTargets(ms, [7]).map(m => m.id), []);
    const noFile = { id: 'x', selectedIndex: 0, history: [{ id: 'x1' }] };
    assert.deepStrictEqual(J.stackTargets([...ms, noFile]).map(m => m.id), ['a', 'b', 'c']);
});

test('upscale: one job per member on its CURRENT version, landing on that member', () => {
    const params = { Upscale_Factor: 2, Upscale_Using_Model: true, Upscale_Model: 'x.pth' };
    const { jobs, skipped } = J.stackToolJobs(three(), {
        operation: 'imageUpscale', mediaType: 'image', injectionParams: params, resolveUrl: p => `u:${p}`,
    });
    assert.strictEqual(skipped, 0);
    assert.strictEqual(jobs.length, 3);
    assert.deepStrictEqual(jobs.map(j => j.config.mediaItems[0].url), ['u:C:/p/a2.png', 'u:C:/p/b1.png', 'u:C:/p/c1.png']);
    assert.deepStrictEqual(jobs.map(j => j.config.mediaItems[0].id), ['a-v2', 'b-v1', 'c-v1']);
    for (const j of jobs) {
        assert.deepStrictEqual(j.config.injectionParams, params);
        assert.deepStrictEqual(j.config.model, { id: null, mediaType: 'image' });
        assert.strictEqual(j.opts.scope, 'groupHistory');
        assert.strictEqual(j.opts.groupId, j.opts.existingGroup.id);
    }
    assert.deepStrictEqual(jobs.map(j => j.opts.groupId), ['a', 'b', 'c']);
});

test('a picked subset gives exactly its jobs', () => {
    const ms = three();
    const { jobs } = J.stackToolJobs(J.stackTargets(ms, [1, 2]), { operation: 'removeBackground', mediaType: 'image', injectionParams: { Input_Bg_Use_Color: false } });
    assert.deepStrictEqual(jobs.map(j => j.opts.groupId), ['b', 'c']);
});

test('resize: the rule becomes each member\'s own size; a member with no size is skipped', () => {
    const params = { rule: { kind: 'longEdge', value: 1024 }, keep_proportion: 'crop', divisible_by: 2 };
    const dims = { a: { w: 4000, h: 3000 }, b: { w: 1080, h: 1920 } };
    const { jobs, skipped } = J.stackToolJobs(three(), { operation: 'resize', mediaType: 'image', injectionParams: params, dims });
    assert.strictEqual(skipped, 1);
    assert.deepStrictEqual(jobs.map(j => j.config.injectionParams), [
        { keep_proportion: 'crop', divisible_by: 2, width: 1024, height: 768 },
        { keep_proportion: 'crop', divisible_by: 2, width: 576, height: 1024 },
    ]);
    const pct = J.stackToolJobs(three().slice(0, 1), { operation: 'resize', mediaType: 'image', injectionParams: { rule: { kind: 'percent', value: 50 } }, dims });
    assert.deepStrictEqual(pct.jobs[0].config.injectionParams, { width: 2000, height: 1500 });
});

test('video: the saved trim rides along, a whole-clip trim does not', () => {
    const v = (id, trim) => ({ id, type: 'video', selectedIndex: 0, history: [{ id: `${id}1`, filePath: `C:/p/${id}.mp4`, duration: 10, trim }] });
    const { jobs } = J.stackToolJobs([v('a', { in: 1, out: 4 }), v('b', { in: 0, out: 10 }), v('c')], {
        operation: 'videoUpscale', mediaType: 'video', injectionParams: { Upscale_Factor: 2 },
    });
    assert.deepStrictEqual(jobs.map(j => j.config.mediaItems[0].trim), [{ in: 1, out: 4 }, undefined, undefined]);
    assert.ok(jobs.every(j => j.config.mediaItems[0].mediaType === 'video'));
});

test('a plugin\'s declared inputs reach every job', () => {
    const { jobs } = J.stackToolJobs(three(), { operation: 'pluginUp', mediaType: 'image', inputs: { positive: 'sharp' } });
    assert.ok(jobs.every(j => j.config.positive === 'sharp'));
});

test('crop: a dragged box is kept, the rest get the centred box, sizes round DOWN inside the picture', () => {
    const dims = { a: { w: 4000, h: 3000 }, b: { w: 1080, h: 1920 } };
    // b-v1 is b's current version; a-v1 is NOT a's current (a-v2 is), so its box is ignored.
    const saved = new Map([['b-v1', { x: 0, y: 100, w: 540, h: 960 }], ['a-v1', { x: 0, y: 0, w: 16, h: 16 }]]);
    const { crops, skipped } = J.stackCropRects(three(), { ratio: 9 / 16, divisibleBy: 16, saved, dims });
    assert.strictEqual(skipped, 1, 'c has no size and no dragged box');
    assert.deepStrictEqual(crops.map(c => [c.member.id, c.item.id, c.rect]), [
        ['a', 'a-v2', { x: 1160, y: 4, w: 1680, h: 2992 }],
        ['b', 'b-v1', { x: 6, y: 100, w: 528, h: 960 }],
    ]);
    for (const { member, rect } of crops) {
        const d = dims[member.id];
        assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= d.w && rect.y + rect.h <= d.h, `${member.id} inside`);
        assert.ok(rect.w % 16 === 0 && rect.h % 16 === 0);
    }
});
