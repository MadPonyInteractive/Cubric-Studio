'use strict';

/**
 * MPI-949 — a stack survives the round trip through project.json.
 *
 * A stack owns no media, so its history is EMPTY by design. Before MPI-949 two things
 * deleted such a card: the reconciler drops any group whose hydrated history is empty
 * (and re-saves the project without it), and `serializeGroup` is a field whitelist that
 * would have dropped `kind`/`members`/`stackId` on every write. These pin both, the
 * membership repair on load, and that every removal leaves stacks consistent.
 *
 * `fetch` is stubbed for the whole file BEFORE any import, and anything it was not told
 * about throws — a unit test must never reach a running app (feedback: MPI-817).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const mod = (...p) => pathToFileURL(path.join(__dirname, '..', ...p)).href;

let hydration = {};
const fetchCalls = [];
globalThis.fetch = async (url, opts = {}) => {
    fetchCalls.push(String(url));
    if (url === '/load-meta-batch') {
        const { ids } = JSON.parse(opts.body);
        const items = Object.fromEntries(ids.map(id => [id, hydration[id] ?? { meta: null, exists: false }]));
        return { ok: true, status: 200, json: async () => ({ items }) };
    }
    if (String(url).startsWith('/delete-meta?')) return { ok: true, status: 200, json: async () => ({ success: true }) };
    if (String(url).startsWith('/list-media') || String(url).includes('media')) {
        return { ok: true, status: 200, json: async () => ({ files: [] }) };
    }
    throw new Error(`unexpected fetch in a unit test: ${url}`);
};

let reconcileAndHydrate, serializeGroup, removeGroupFromProject;

test.before(async () => {
    ({ reconcileAndHydrate } = await import(mod('js', 'managers', 'projectReconciler.js')));
    ({ serializeGroup } = await import(mod('js', 'services', 'projectService.js')));
    ({ removeGroupFromProject } = await import(mod('js', 'data', 'projectModel.js')));
});

const meta = id => ({ meta: { id, type: 'image', filePath: `Media/${id}.png` }, exists: true });
const onDisk = (id, patch = {}) => ({
    id, type: 'image', name: id, createdAt: '2026-09-27T00:00:00Z', selectedIndex: 0,
    open: false, favourite: false, archived: false, customName: null, history: [`${id}-v1`], ...patch,
});
const stackOnDisk = (id, members, patch = {}) => ({
    ...onDisk(id), type: 'stack', history: [], kind: 'image', members, ...patch,
});
const project = itemGroups => ({ folderPath: 'C:/fake/project', itemGroups });

test('serializeGroup: stack fields persist, an ordinary card keeps its old shape', () => {
    const plain = serializeGroup({ ...onDisk('a'), history: [{ id: 'a-v1' }] });
    for (const k of ['kind', 'members', 'stackId', 'expected']) assert.ok(!(k in plain), `plain card grew ${k}`);

    const member = serializeGroup({ ...onDisk('a'), stackId: 's' });
    assert.strictEqual(member.stackId, 's');

    const stack = serializeGroup(stackOnDisk('s', ['a', 'b'], { expected: 0 }));
    assert.deepStrictEqual(stack.members, ['a', 'b']);
    assert.strictEqual(stack.kind, 'image');
    assert.deepStrictEqual(stack.history, []);
    assert.ok(!('expected' in stack), 'a zero expected must not persist');
    assert.strictEqual(serializeGroup(stackOnDisk('s', [], { expected: 4 })).expected, 4);
});

test('reconcile: a healthy stack survives, unmodified, byte-identical after re-serialize', async () => {
    const groups = [stackOnDisk('s', ['a', 'b']), onDisk('a', { stackId: 's' }), onDisk('b', { stackId: 's' }), onDisk('c')];
    hydration = { 'a-v1': meta('a-v1'), 'b-v1': meta('b-v1'), 'c-v1': meta('c-v1') };
    const { project: out, wasModified } = await reconcileAndHydrate(project(groups));
    assert.strictEqual(wasModified, false);
    assert.deepStrictEqual(out.itemGroups.map(serializeGroup), groups);
});

test('reconcile: a member whose media is gone leaves its stack; an emptied stack goes', async () => {
    const groups = [
        stackOnDisk('s1', ['a', 'b']), onDisk('a', { stackId: 's1' }), onDisk('b', { stackId: 's1' }),
        stackOnDisk('s2', ['c']), onDisk('c', { stackId: 's2' }),
    ];
    hydration = { 'a-v1': meta('a-v1'), 'b-v1': { meta: { id: 'b-v1' }, exists: false }, 'c-v1': { meta: { id: 'c-v1' }, exists: false } };
    const { project: out, wasModified } = await reconcileAndHydrate(project(groups));
    assert.strictEqual(wasModified, true);
    const by = id => out.itemGroups.find(g => g.id === id);
    assert.deepStrictEqual(by('s1').members, ['a']);
    assert.strictEqual(by('a').stackId, 's1');
    assert.strictEqual(by('b'), undefined);
    assert.strictEqual(by('s2'), undefined, 'a stack with no members left must be dropped');
    assert.strictEqual(by('c'), undefined);
});

test('reconcile: an orphan stackId is cleared, so the card is not hidden forever', async () => {
    hydration = { 'a-v1': meta('a-v1') };
    const { project: out, wasModified } = await reconcileAndHydrate(project([onDisk('a', { stackId: 'gone' })]));
    assert.strictEqual(wasModified, true);
    assert.ok(!('stackId' in out.itemGroups[0]));
});

test('removing a stack unstacks; removing a member prunes it; the last member takes the stack', () => {
    const p = project([
        stackOnDisk('s', ['a', 'b'], { archived: true }),
        onDisk('a', { stackId: 's', archived: true }), onDisk('b', { stackId: 's', archived: true }), onDisk('c'),
    ]);
    const unstacked = removeGroupFromProject(p, 's').itemGroups;
    assert.deepStrictEqual(unstacked.map(g => g.id), ['a', 'b', 'c']);
    assert.ok(unstacked.every(g => !g.stackId));
    assert.strictEqual(unstacked.find(g => g.id === 'a').archived, true);

    const oneLeft = removeGroupFromProject(p, 'a').itemGroups;
    assert.deepStrictEqual(oneLeft.find(g => g.id === 's').members, ['b']);
    assert.strictEqual(oneLeft.find(g => g.id === 'a'), undefined);

    const none = removeGroupFromProject(project(oneLeft), 'b').itemGroups;
    assert.deepStrictEqual(none.map(g => g.id), ['c']);

    assert.deepStrictEqual(removeGroupFromProject(p, 'c').itemGroups.map(g => g.id), ['s', 'a', 'b']);
});

test('the fetch stub was the only network the file touched', () => {
    assert.ok(fetchCalls.every(u => u === '/load-meta-batch' || u.startsWith('/delete-meta?') || u.includes('media')), fetchCalls.join(', '));
});
