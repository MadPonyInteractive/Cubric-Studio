// MPI-1115. The landing bell counts the dev-update posts this user has not
// acknowledged. Three promises that break silently:
//   1. a fresh install meets the newest 3 posts, never the whole feed of 20;
//   2. an acknowledged post stays gone across refreshes, and the stored list never
//      outgrows the feed;
//   3. an offline fetch leaves the bell as it was, never empties it or seeds it.

const assert = require('node:assert');
const test = require('node:test');

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};

const feed = (n) => Array.from({ length: n }, (_, i) => ({ id: String(100 - i), at: '2026-10-12T10:00:00Z', text: `post ${i}`, images: [] }));
let _response;
globalThis.fetch = async () => _response();
const serve = (posts) => { _response = async () => ({ ok: true, json: async () => ({ ok: true, posts }) }); };

test('reconcileAcked: first run seeds all but the newest 3; later drops ids that left the feed', async () => {
    const { reconcileAcked } = await import('../js/services/devUpdatesService.js');
    const posts = feed(5);
    assert.deepStrictEqual(reconcileAcked(posts, null), ['97', '96']);
    assert.deepStrictEqual(reconcileAcked(posts, ['100', '1']), ['100']);
    assert.deepStrictEqual(reconcileAcked([], null), []);
});

test('the bell: 3 unread on a fresh install, acknowledge, new post, offline', async () => {
    const svc = await import('../js/services/devUpdatesService.js');
    const { state } = await import('../js/state.js');
    const { Events } = await import('../js/events.js');
    // MPI-1321: posts that land after the boot fetch are announced (the shell toasts them).
    const arrived = [];
    Events.on('dev-updates:arrived', ({ posts }) => arrived.push(posts.map((p) => p.id)));

    serve(feed(20));
    await svc.refreshDevUpdates();
    assert.deepStrictEqual(state.devUpdates.map((p) => p.id), ['100', '99', '98']);
    assert.deepStrictEqual(arrived, [], 'the boot fetch is the bell, never a toast');

    svc.acknowledgeDevUpdate('99');
    assert.deepStrictEqual(state.devUpdates.map((p) => p.id), ['100', '98']);

    // Fabio posts again: the feed slides by one, the newest is unread, 99 stays read.
    serve([{ id: '101', at: '2026-10-12T11:00:00Z', text: 'new', images: [] }, ...feed(19)]);
    await svc.refreshDevUpdates();
    assert.deepStrictEqual(state.devUpdates.map((p) => p.id), ['101', '100', '98']);
    assert.deepStrictEqual(arrived, [['101']], 'only the new post is announced');
    await svc.refreshDevUpdates();
    assert.deepStrictEqual(arrived, [['101']], 'the same feed again announces nothing');
    const acked = JSON.parse(store.get('mpi_dev_updates_acked'));
    assert.ok(acked.every((id) => Number(id) >= 82), 'ids that left the feed are pruned');

    // Offline: nothing changes.
    _response = async () => { throw new Error('offline'); };
    await svc.refreshDevUpdates();
    assert.deepStrictEqual(state.devUpdates.map((p) => p.id), ['101', '100', '98']);

    svc.acknowledgeAllDevUpdates();
    assert.deepStrictEqual(state.devUpdates, []);
});
