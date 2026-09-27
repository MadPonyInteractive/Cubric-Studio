'use strict';

/**
 * MPI-949 — Gallery stacks, the pure half (js/data/stackModel.js).
 *
 * A stack is a card with `type: 'stack'`, `members` in click order and no history of
 * its own; members keep their cards and carry `stackId`. These pin who may be stacked,
 * where the stack sits (it borrows the first member's createdAt), that unstacking hands
 * the archive scope back, and that a load repairs membership from `stack.members`.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let S;

test.before(async () => {
    S = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'data', 'stackModel.js')).href);
});

const card = (id, itemPatch = {}, patch = {}) => ({
    id, type: itemPatch.type || 'image', createdAt: `2026-09-2${id.length}T00:00:00Z`,
    selectedIndex: 0, history: [{ id: `${id}-v1`, type: 'image', ...itemPatch }], ...patch,
});
const img = id => card(id);
const vid = id => card(id, { type: 'video' });
const gif = id => card(id, { gif: { frames: 3 } });
const audio = id => card(id, { type: 'audio' });
const scene = id => card(id, { splatPath: 'x.ply' });
const stackOf = (id, members, patch = {}) => ({ id, type: 'stack', kind: 'image', members, history: [], selectedIndex: 0, ...patch });

test('who may be stacked: two or more stills, or two or more videos', () => {
    assert.strictEqual(S.stackCreateBlockReason([img('a'), img('b')]), null);
    assert.strictEqual(S.stackCreateBlockReason([vid('a'), vid('b'), vid('c')]), null);
    assert.strictEqual(S.stackCreateBlockReason([img('a')]), 'too-few');
    assert.strictEqual(S.stackCreateBlockReason([]), 'too-few');
    assert.strictEqual(S.stackCreateBlockReason([img('a'), vid('b')]), 'mixed-kinds');
    assert.strictEqual(S.stackCreateBlockReason([img('a'), stackOf('s', ['x'])]), 'contains-stack');
    for (const odd of [gif('g'), audio('au'), scene('sc')]) {
        assert.strictEqual(S.stackCreateBlockReason([img('a'), odd]), 'unsupported-kind', odd.id);
    }
    for (const reason of ['too-few', 'contains-stack', 'unsupported-kind', 'mixed-kinds']) {
        assert.ok(S.STACK_BLOCK_INFO[reason], `no status-bar text for ${reason}`);
    }
});

test('kind is read from the selected ITEM, not group.type', () => {
    const videoGroupShowingAStill = card('a', { type: 'image' }, { type: 'video' });
    assert.strictEqual(S.stackableKind(videoGroupShowingAStill), 'image');
    assert.strictEqual(S.stackableKind({ id: 'e', type: 'image', history: [] }), null);
});

test('a new stack borrows the first-clicked member\'s slot and scope', () => {
    const a = img('aaa'), b = img('b');
    const f = S.stackFields([a, b]);
    assert.deepStrictEqual(f.members, ['aaa', 'b']);
    assert.strictEqual(f.kind, 'image');
    assert.strictEqual(f.createdAt, a.createdAt);
    assert.strictEqual(f.archived, false);
    assert.strictEqual(S.stackFields([img('a', {}), img('b')], { name: 'X' }).name, 'X');
    const archived = S.stackFields([{ ...img('a'), archived: true }, { ...img('b'), archived: true }]);
    assert.strictEqual(archived.archived, true);
});

test('stack, then unstack: members point at the stack, then come back with its scope', () => {
    const groups = [img('a'), img('b'), img('c')];
    const stack = { ...stackOf('s', ['b', 'a']), archived: true };
    const stacked = S.applyStack(groups, stack);
    assert.strictEqual(stacked.length, 4);
    assert.deepStrictEqual(stacked.filter(g => g.stackId === 's').map(g => g.id).sort(), ['a', 'b']);
    assert.strictEqual(stacked.find(g => g.id === 'c').stackId, undefined);
    assert.strictEqual(groups[0].stackId, undefined, 'input mutated');

    const back = S.applyUnstack(stacked, 's');
    assert.deepStrictEqual(back.map(g => g.id), ['a', 'b', 'c']);
    assert.ok(back.every(g => !('stackId' in g)));
    assert.strictEqual(back.find(g => g.id === 'a').archived, true);
    assert.strictEqual(back.find(g => g.id === 'c').archived, undefined, 'non-member touched');
    assert.strictEqual(S.applyUnstack(stacked, 'a'), stacked, 'unstack of a non-stack must be a no-op');
});

test('removing members: a stack of one stays, a stack of none goes', () => {
    const stacked = S.applyStack([img('a'), img('b')], stackOf('s', ['a', 'b']));
    const one = S.applyRemoveMembers(stacked, 's', ['a']);
    assert.deepStrictEqual(one.find(g => g.id === 's').members, ['b']);
    assert.ok(!('stackId' in one.find(g => g.id === 'a')));
    assert.strictEqual(one.find(g => g.id === 'b').stackId, 's');

    const none = S.applyRemoveMembers(one, 's', ['b']);
    assert.strictEqual(none.find(g => g.id === 's'), undefined);
    assert.ok(none.every(g => !g.stackId));
    assert.strictEqual(S.applyRemoveMembers(stacked, 's', ['zzz']), stacked, 'unknown id must be a no-op');
});

test('adding members fills a result stack, never steals from another stack', () => {
    let groups = [stackOf('s', [], { expected: 3 }), img('a'), { ...img('b'), stackId: 'other' }];
    groups = S.applyAddMembers(groups, 's', ['a', 'b', 'nope', 's']);
    assert.deepStrictEqual(groups.find(g => g.id === 's').members, ['a']);
    assert.strictEqual(groups.find(g => g.id === 'a').stackId, 's');
    assert.strictEqual(groups.find(g => g.id === 'b').stackId, 'other');
    const again = S.applyAddMembers(groups, 's', ['a']);
    assert.strictEqual(again, groups, 're-adding a member must be a no-op');
});

test('a result stack starts empty and filling, and settles to a plain stack or to nothing', () => {
    const f = S.resultStackFields({ kind: 'video', name: 'Fox · Upscale', expected: 3 });
    assert.deepStrictEqual(f, { kind: 'video', members: [], name: 'Fox · Upscale', customName: null, archived: false, expected: 3 });
    assert.ok(!('createdAt' in f), 'createItemGroup dates it now; it must not borrow a slot');

    const filled = [stackOf('s', ['a'], { expected: 3 }), { ...img('a'), stackId: 's' }];
    const settled = S.applySettleResultStack(filled, 's');
    assert.ok(!('expected' in settled.find(g => g.id === 's')), 'expected must go');
    assert.deepStrictEqual(settled.find(g => g.id === 's').members, ['a'], 'members kept');

    const empty = S.applySettleResultStack([stackOf('s', [], { expected: 3 }), img('b')], 's');
    assert.deepStrictEqual(empty.map(g => g.id), ['b'], 'a result stack that got nothing is dropped');

    const plain = [stackOf('s', ['a']), img('a')];
    assert.strictEqual(S.applySettleResultStack(plain, 's'), plain, 'a stack not filling is untouched');
    assert.strictEqual(S.applySettleResultStack(plain, 'a'), plain, 'a non-stack is untouched');
});

test('expandStacks: a stack becomes its members in stack order, other cards stay put', () => {
    const groups = [img('a'), img('b'), img('c'), stackOf('s', ['c', 'a', 'gone'])];
    const out = S.expandStacks([img('b'), groups[3]], groups).map(g => g.id);
    assert.deepStrictEqual(out, ['b', 'c', 'a'], 'a dead member id is skipped');
    assert.deepStrictEqual(S.expandStacks([stackOf('e', [])], groups), []);
});

test('sanitize: a healthy project is returned untouched', () => {
    const groups = S.applyStack([img('a'), img('b'), img('c')], stackOf('s', ['a', 'b']));
    const out = S.sanitizeStacks(groups);
    assert.strictEqual(out.changed, false);
    assert.strictEqual(out.groups, groups);
});

test('sanitize: dead members pruned, empty stacks dropped, a filling stack kept', () => {
    const groups = [
        stackOf('s1', ['gone', 'a']),         // a deleted member
        stackOf('s2', ['gone2']),             // nothing left
        stackOf('s3', [], { expected: 4 }),   // a Gallery run still filling it
        { ...img('a'), stackId: 's1' },
    ];
    const { groups: out, changed } = S.sanitizeStacks(groups);
    assert.strictEqual(changed, true);
    assert.deepStrictEqual(out.find(g => g.id === 's1').members, ['a']);
    assert.strictEqual(out.find(g => g.id === 's2'), undefined);
    assert.ok(out.find(g => g.id === 's3'));
});

test('sanitize: stack.members wins over a stale or orphan stackId', () => {
    const groups = [
        stackOf('s', ['a', 'b']),
        img('a'),                                // listed, back-pointer missing
        { ...img('b'), stackId: 'wrong' },       // listed, back-pointer wrong
        { ...img('c'), stackId: 'missing' },     // orphan: its stack is gone
        { ...img('d'), stackId: 's' },           // claims s, s does not list it
    ];
    const { groups: out } = S.sanitizeStacks(groups);
    const by = id => out.find(g => g.id === id);
    assert.strictEqual(by('a').stackId, 's');
    assert.strictEqual(by('b').stackId, 's');
    assert.ok(!('stackId' in by('c')));
    assert.ok(!('stackId' in by('d')));
});

test('sanitize: a card in two stacks stays in the first; a stack inside a stack is pruned', () => {
    const groups = [stackOf('s1', ['a']), stackOf('s2', ['a', 's1', 'b']), img('a'), img('b')];
    const { groups: out } = S.sanitizeStacks(groups);
    assert.deepStrictEqual(out.find(g => g.id === 's1').members, ['a']);
    assert.deepStrictEqual(out.find(g => g.id === 's2').members, ['b']);
    assert.strictEqual(out.find(g => g.id === 'a').stackId, 's1');
});

test('step versions: every member moves one, clamped to its own history', () => {
    const three = (id, sel) => ({ ...card(id), selectedIndex: sel, history: [{ id: `${id}1` }, { id: `${id}2` }, { id: `${id}3` }], stackId: 's' });
    const groups = [three('a', 2), three('b', 0), { ...card('c'), stackId: 's' }, three('x', 2), stackOf('s', ['a', 'b', 'c'])];
    const back = S.applyStepVersions(groups, 's', -1);
    assert.deepStrictEqual(back.moved.map(g => g.id), ['a']);
    assert.strictEqual(back.groups.find(g => g.id === 'a').selectedIndex, 1);
    assert.strictEqual(back.groups.find(g => g.id === 'b').selectedIndex, 0);
    assert.strictEqual(back.groups.find(g => g.id === 'x').selectedIndex, 2, 'a card outside the stack never moves');
    const on = S.applyStepVersions(groups, 's', 1);
    assert.deepStrictEqual(on.moved.map(g => g.id), ['b']);
    const none = S.applyStepVersions([three('a', 0), stackOf('s', ['a'])], 's', -1);
    assert.strictEqual(none.moved.length, 0);
    assert.strictEqual(S.applyStepVersions(groups, 'nope', 1).groups, groups);
});

test('header stats: every member version, under the stack id', () => {
    const s = stackOf('s', ['a', 'b']);
    const out = S.stackStatsGroup(s, [img('a'), img('b'), img('x'), s]);
    assert.strictEqual(out.id, 's');
    assert.deepStrictEqual(out.history.map(h => h.id), ['a-v1', 'b-v1']);
});
