'use strict';

/**
 * MPI-749 — the gallery filter contract shared by the grid predicate and the panel.
 * Pins the MPI-678 ordering (scope gates before every filter), the AND flags, that
 * Oldest is not "filtered", and that a hidden kind stays listed with no cards.
 * MPI-785 — card marks replace the heart; a legacy `favourite: true` reads as a dot.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let F;
let ICONS;

test.before(async () => {
    F = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'galleryFilter.js')).href);
    ({ ICONS } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'utils', 'icons.js')).href));
});

const sort = (patch = {}) => ({ ...F.DEFAULT_GALLERY_SORT, ...patch });
const IMG = { type: 'image' };
const VID = { type: 'video' };
const SCENE = { type: 'image', splatPath: 'scene.ply' };

test('the archive scope gates before every filter', () => {
    const archivedDot = { archived: true, favourite: 'dot' };
    assert.strictEqual(F.matchesGallerySort(archivedDot, VID, sort({ marks: ['dot'] })), false);
    assert.strictEqual(F.matchesGallerySort(archivedDot, VID, sort({ scope: 'archived', marks: ['dot'] })), true);
    assert.strictEqual(F.matchesGallerySort({}, VID, sort({ scope: 'archived' })), false);
});

test('marked videos: hidden kinds and the marks list AND together', () => {
    const s = sort({ hiddenKinds: ['image', 'audio', 'scene'], marks: ['square'] });
    assert.strictEqual(F.matchesGallerySort({ favourite: 'square' }, VID, s), true);
    assert.strictEqual(F.matchesGallerySort({ favourite: false }, VID, s), false);
    assert.strictEqual(F.matchesGallerySort({ favourite: 'square' }, IMG, s), false);
});

test('several marks are ORed: a card shows when its mark is any of them', () => {
    const s = sort({ marks: ['dot', 'triangle'] });
    assert.strictEqual(F.matchesGallerySort({ favourite: 'dot' }, IMG, s), true);
    assert.strictEqual(F.matchesGallerySort({ favourite: 'triangle' }, IMG, s), true);
    assert.strictEqual(F.matchesGallerySort({ favourite: 'square' }, IMG, s), false);
    assert.strictEqual(F.matchesGallerySort({}, IMG, s), false);
});

test('markOf: a legacy heart (true) is a dot; false, junk and missing are unmarked', () => {
    assert.strictEqual(F.markOf({ favourite: true }), 'dot');
    assert.strictEqual(F.markOf({ favourite: 'triangle' }), 'triangle');
    for (const g of [{ favourite: false }, { favourite: 'heart' }, {}, null, undefined]) {
        assert.strictEqual(F.markOf(g), null);
    }
    assert.strictEqual(F.matchesGallerySort({ favourite: true }, IMG, sort({ marks: ['dot'] })), true);
});

test('every mark is complete, and its icon exists', () => {
    assert.deepStrictEqual(F.CARD_MARKS.map(m => m.id), ['dot', 'square', 'triangle']);
    for (const m of F.CARD_MARKS) {
        assert.ok(m.label && m.singular, `${m.id} needs label and singular`);
        assert.ok(ICONS[m.icon], `${m.id}: icon '${m.icon}' is not in js/utils/icons.js`);
        assert.strictEqual(F.markIcon(m.id), m.icon);
    }
    assert.strictEqual(F.markIcon(null), 'mark_none');
    assert.ok(ICONS.mark_none);
});

test('byGalleryOrder sorts by createdAt, newest or oldest first', () => {
    const groups = [{ id: 'b', createdAt: '2026-01-02' }, { id: 'a', createdAt: '2026-01-01' }, { id: 'c', createdAt: '2026-01-03' }];
    assert.deepStrictEqual([...groups].sort(F.byGalleryOrder('newest')).map(g => g.id), ['c', 'b', 'a']);
    assert.deepStrictEqual([...groups].sort(F.byGalleryOrder('oldest')).map(g => g.id), ['a', 'b', 'c']);
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
    assert.strictEqual(F.isGalleryFiltered(sort({ marks: ['dot'] })), true);
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
    assert.strictEqual(F.describeGalleryFilter(sort({ hiddenKinds: ['image', 'audio'], marks: ['triangle', 'dot'] })), 'GIFs, Videos, 3D Scenes · Dots, Triangles');
    assert.strictEqual(F.describeGalleryFilter(sort({ marks: ['square'], previews: true })), 'Squares · Previews');
    assert.strictEqual(F.describeGalleryFilter(sort({ hiddenKinds: ['scene', 'video', 'audio', 'gif', 'image'] })), 'No types');
    assert.strictEqual(F.describeGalleryFilter(sort({ previews: true })), 'Previews');
    const s = sort({ hiddenKinds: ['image'] });
    const listed = F.listedKinds([{ group: {}, item: VID }, { group: {}, item: IMG }], s);
    assert.strictEqual(F.describeGalleryFilter(s, listed), 'Videos');
});

test('the default sort cannot be mutated through a shared reference', () => {
    assert.ok(Object.isFrozen(F.DEFAULT_GALLERY_SORT));
    assert.ok(Object.isFrozen(F.DEFAULT_GALLERY_SORT.hiddenKinds));
    assert.ok(Object.isFrozen(F.DEFAULT_GALLERY_SORT.marks));
});
