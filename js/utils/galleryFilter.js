/**
 * MPI-749 — the gallery filter/sort contract, shared by the grid predicate and the
 * filter panel so the two can never disagree.
 *
 * `gallerySort` = { order, scope, hiddenKinds, favourites, previews }:
 * - `scope` gates FIRST and is subtractive (MPI-678): an archived group is absent
 *   from the active gallery whatever else is set, and the active ones from the archive.
 * - `hiddenKinds` is an EXCLUSION list, so a kind added to ASSET_KINDS later shows by
 *   default instead of vanishing from every filtered gallery.
 * - `favourites` / `previews` are "only" flags, ANDed on top of the kinds.
 * - `order` hides nothing, so it never counts as filtered.
 *
 * Relative import only, so Node can load it (tests/gallery-filter.test.cjs).
 */
import { ASSET_KINDS, kindOfItem } from './assetKinds.js';

export const DEFAULT_GALLERY_SORT = Object.freeze({
    order: 'newest',
    scope: 'active',
    hiddenKinds: Object.freeze([]),
    favourites: false,
    previews: false,
});

function _inScope(group, sort) {
    return !!group?.archived === (sort.scope === 'archived');
}

/** Does this card (its group + selected history item) show under `sort`? */
export function matchesGallerySort(group, item, sort) {
    if (!_inScope(group, sort)) return false;
    if (sort.hiddenKinds?.includes(kindOfItem(item).kind)) return false;
    if (sort.favourites && group?.favourite !== true) return false;
    if (sort.previews && item?.stage !== 'preview') return false;
    return true;
}

/** True when something is hidden — the FILTER button's heat dot. */
export function isGalleryFiltered(sort) {
    return !!(sort.hiddenKinds?.length || sort.favourites || sort.previews);
}

/**
 * Tooltip text for a filtered gallery: the kinds still SHOWN, then the flags
 * (`3D Scenes, Videos · Favs`). Pass the panel's listed kinds so a kind the project
 * has no cards of is not named; defaults to the whole table.
 */
export function describeGalleryFilter(sort, kinds = ASSET_KINDS) {
    const parts = [];
    if (sort.hiddenKinds?.length) {
        parts.push(kinds.filter(k => !sort.hiddenKinds.includes(k.kind)).map(k => k.label).join(', ') || 'No types');
    }
    if (sort.favourites) parts.push('Favs');
    if (sort.previews) parts.push('Previews');
    return parts.join(' · ');
}

/**
 * The kind rows the filter panel lists, in table order: kinds with a card in the
 * CURRENT scope, plus any kind currently hidden so it can always be switched back on.
 * `entries` = [{ group, item }], `item` being the group's selected history item.
 */
export function listedKinds(entries, sort) {
    const present = new Set(entries.filter(e => _inScope(e.group, sort)).map(e => kindOfItem(e.item).kind));
    return ASSET_KINDS.filter(k => present.has(k.kind) || sort.hiddenKinds?.includes(k.kind));
}
