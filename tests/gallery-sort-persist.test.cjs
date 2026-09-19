'use strict';

// MPI-826. The gallery's sort ORDER survives a restart; its scope and filters do not.
//
// Every other gallery view setting round-trips through Storage — `gallerySizeLevel`,
// `galleryShowInfo`, `galleryVolume` — and `gallerySort` was the one that did not, so
// "oldest first" lasted until the app closed.
//
// The split is the point, and it is the half a future change is most likely to get
// wrong. MPI-678 kept this key in memory because `scope: 'archived'` and the three
// filters can each empty the grid, and nobody should relaunch into a gallery that
// looks wiped. `order` empties nothing. So persisting the whole object would reopen
// the defect MPI-678 closed, and these cases fail if anyone does.

const assert = require('node:assert/strict');
const test = require('node:test');

const KEY = 'mpi_gallery_sort_order';

/** Fresh globals + a fresh module graph. `state.js` is a singleton; a cached copy leaks. */
async function load(seed = {}) {
    const store = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    globalThis.fetch = async () => ({ ok: true });        // clientLogger is fire-and-forget
    const bust = `?t=${Math.random()}`;
    const { state } = await import(`../js/state.js${bust}`);
    return { state, raw: () => store.get(KEY), store };
}

test('the sort order is restored from the store on boot', async () => {
    const { state } = await load({ [KEY]: 'oldest' });
    assert.equal(state.gallerySort.order, 'oldest', 'the stored order is what the gallery opens on');
    // The rest comes from DEFAULT_GALLERY_SORT regardless of what is on disk.
    assert.equal(state.gallerySort.scope, 'active');
    assert.deepEqual(state.gallerySort.hiddenKinds, []);
    assert.deepEqual(state.gallerySort.marks, []);
    assert.equal(state.gallerySort.previews, false);
});

test('changing the sort writes the order, and ONLY the order', async () => {
    const { state, raw, store } = await load();

    state.gallerySort = {
        ...state.gallerySort,
        order: 'oldest',
        scope: 'archived',
        hiddenKinds: ['video'],
        marks: ['dot'],
        previews: true,
    };

    assert.equal(JSON.parse(raw()), 'oldest', 'the order reached localStorage');
    // MPI-678: a scope or a filter restored invisibly at boot reads as an empty gallery.
    const written = [...store.keys()].join(',');
    assert.ok(!written.includes('scope'), `scope must not be persisted — wrote: ${written}`);
    assert.equal(store.size, 1, `only the order key may be written — wrote: ${written}`);
});

test('a fresh or corrupt store opens on newest', async () => {
    const fresh = await load();
    assert.equal(fresh.state.gallerySort.order, 'newest');

    // `byGalleryOrder` implements exactly two orders; anything else must heal, not
    // leave the grid sorted by a comparator that does not exist.
    const corrupt = await load({ [KEY]: 'sideways' });
    assert.equal(corrupt.state.gallerySort.order, 'newest');
});
