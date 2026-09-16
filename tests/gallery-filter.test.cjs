'use strict';

/**
 * MPI-749 — the gallery filter contract shared by the grid predicate and the panel.
 * Pins the MPI-678 ordering (scope gates before every filter), the AND flags, that
 * Oldest is not "filtered", and that a hidden kind stays listed with no cards.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let F;

test.before(async () => {
    F = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'galleryFilter.js')).href);
});

const sort = (patch = {}) => ({ ...F.DEFAULT_GALLERY_SORT, ...patch });
const IMG = { type: 'image' };
const VID = { type: 'video' };
const SCENE = { type: 'image', splatPath: 'scene.ply' };

test('the archive scope gates before every filter', () => {
    const archivedFav = { archived: true, favourite: true };
    assert.strictEqual(F.matchesGallerySort(archivedFav, VID, sort({ favourites: true })), false);
    assert.strictEqual(F.matchesGallerySort(archivedFav, VID, sort({ scope: 'archived', favourites: true })), true);
    assert.strictEqual(F.matchesGallerySort({}, VID, sort({ scope: 'archived' })), false);
});

test('favourite videos: hidden kinds and the favourites flag AND together', () => {
    const s = sort({ hiddenKinds: ['image', 'audio', 'scene'], favourites: true });
    assert.strictEqual(F.matchesGallerySort({ favourite: true }, VID, s), true);
    assert.strictEqual(F.matchesGallerySort({ favourite: false }, VID, s), false);
    assert.strictEqual(F.matchesGallerySort({ favourite: true }, IMG, s), false);
});

test('a hidden kind hides by the selected ITEM, so hiding images keeps a splat', () => {
    const s = sort({ hiddenKinds: ['image'] });
    assert.strictEqual(F.matchesGallerySort({}, IMG, s), false);
    assert.strictEqual(F.matchesGallerySort({}, SCENE, s), true);
});

test('the previews flag keeps only preview-stage items', () => {
    const s = sort({ previews: true });
    assert.strictEqual(F.matchesGallerySort({}, { type: 'video', stage: 'preview' }, s), true);
    assert.strictEqual(F.matchesGallerySort({}, VID, s), false);
});

test('Oldest filters nothing and does not count as filtered', () => {
    assert.strictEqual(F.isGalleryFiltered(sort({ order: 'oldest' })), false);
    assert.strictEqual(F.matchesGallerySort({}, IMG, sort({ order: 'oldest' })), true);
    assert.strictEqual(F.isGalleryFiltered(F.DEFAULT_GALLERY_SORT), false);
    assert.strictEqual(F.isGalleryFiltered(sort({ hiddenKinds: ['audio'] })), true);
    assert.strictEqual(F.isGalleryFiltered(sort({ favourites: true })), true);
    assert.strictEqual(F.isGalleryFiltered(sort({ previews: true })), true);
});

test('listed kinds: present in the current scope, plus a hidden kind with no cards', () => {
    const entries = [
        { group: {}, item: VID },
        { group: {}, item: IMG },
        { group: { archived: true }, item: SCENE },
    ];
    const kinds = (s) => F.listedKinds(entries, s).map(k => k.kind);
    assert.deepStrictEqual(kinds(sort()), ['image', 'video']);
    assert.deepStrictEqual(kinds(sort({ hiddenKinds: ['audio'] })), ['image', 'video', 'audio']);
    assert.deepStrictEqual(kinds(sort({ scope: 'archived' })), ['scene']);
});

test('the description names the kinds still shown, then the flags', () => {
    assert.strictEqual(F.describeGalleryFilter(sort({ hiddenKinds: ['image', 'audio'], favourites: true })), 'GIFs, Videos, 3D Scenes · Favs');
    assert.strictEqual(F.describeGalleryFilter(sort({ hiddenKinds: ['scene', 'video', 'audio', 'gif', 'image'] })), 'No types');
    assert.strictEqual(F.describeGalleryFilter(sort({ previews: true })), 'Previews');
    const s = sort({ hiddenKinds: ['image'] });
    const listed = F.listedKinds([{ group: {}, item: VID }, { group: {}, item: IMG }], s);
    assert.strictEqual(F.describeGalleryFilter(s, listed), 'Videos');
});

test('the default sort cannot be mutated through a shared reference', () => {
    assert.ok(Object.isFrozen(F.DEFAULT_GALLERY_SORT));
    assert.ok(Object.isFrozen(F.DEFAULT_GALLERY_SORT.hiddenKinds));
});
