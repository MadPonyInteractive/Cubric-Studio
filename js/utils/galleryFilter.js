/**
 * MPI-749 — the gallery filter/sort contract, shared by the grid predicate and the filter
 * panel so the two can never disagree. MPI-785: the media picker runs the same contract on
 * its own local sort object.
 *
 * `gallerySort` = { order, scope, hiddenKinds, marks, previews }:
 * - `scope` gates FIRST and is subtractive (MPI-678): an archived group is absent
 *   from the active gallery whatever else is set, and the active ones from the archive.
 * - `hiddenKinds` is an EXCLUSION list, so a kind added to ASSET_KINDS later shows by
 *   default instead of vanishing from every filtered gallery.
 * - `marks` is an "only" list of CARD_MARKS ids: a card shows when its mark is one of them.
 * - `previews` is an "only" flag. Marks and previews are ANDed on top of the kinds.
 * - `order` hides nothing, so it never counts as filtered.
 *
 * Relative import only, so Node can load it (tests/gallery-filter.test.cjs).
 */
import { PANEL_KINDS, kindOfItem } from './assetKinds.js';

export const DEFAULT_GALLERY_SORT = Object.freeze({
    order: 'newest',
    scope: 'active',
    hiddenKinds: Object.freeze([]),
    marks: Object.freeze([]),
    previews: false,
});

/**
 * The shapes a card can be marked with (MPI-785, replacing the heart). `group.favourite`
 * holds the mark id, or `false` for none. A click marks `dot`; holding the button picks
 * another. `icon` is a key in js/utils/icons.js, `label` the filter panel row, `singular`
 * the shape menu's tooltip.
 */
export const CARD_MARKS = Object.freeze([
    { id: 'dot',      label: 'Dots',      singular: 'Dot',      icon: 'mark_dot' },
    { id: 'square',   label: 'Squares',   singular: 'Square',   icon: 'mark_square' },
    { id: 'triangle', label: 'Triangles', singular: 'Triangle', icon: 'mark_triangle' },
]);

/** Icon key for a mark id; `mark_none` for an unmarked card. */
export function markIcon(mark) {
    return CARD_MARKS.find(m => m.id === mark)?.icon || 'mark_none';
}

/** The card's mark id, or null. A pre-MPI-785 project stored the heart as `true`: a dot. */
export function markOf(group) {
    const fav = group?.favourite;
    if (fav === true) return 'dot';
    return CARD_MARKS.some(m => m.id === fav) ? fav : null;
}

function _inScope(group, sort) {
    return !!group?.archived === (sort.scope === 'archived');
}

/** Does this card (its group + selected history item) show under `sort`? */
export function matchesGallerySort(group, item, sort) {
    if (!_inScope(group, sort)) return false;
    if (sort.hiddenKinds?.includes(kindOfItem(item).kind)) return false;
    if (sort.marks?.length && !sort.marks.includes(markOf(group))) return false;
    if (sort.previews && item?.stage !== 'preview') return false;
    return true;
}

/** Sort comparator for groups under `order` — the grid and the media picker share it. */
export function byGalleryOrder(order) {
    return (a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return order === 'newest' ? tb - ta : ta - tb;
    };
}

/** True when something is hidden — the FILTER button's heat dot. */
export function isGalleryFiltered(sort) {
    return !!(sort.hiddenKinds?.length || sort.marks?.length || sort.previews);
}

/**
 * Tooltip text for a filtered gallery: the kinds still SHOWN, then the marks, then
 * previews (`Videos, 3D Scenes · Dots, Squares`). Pass the panel's listed kinds so a kind
 * the project has no cards of is not named; defaults to every kind, in panel order.
 */
export function describeGalleryFilter(sort, kinds = PANEL_KINDS) {
    const parts = [];
    if (sort.hiddenKinds?.length) {
        parts.push(kinds.filter(k => !sort.hiddenKinds.includes(k.kind)).map(k => k.label).join(', ') || 'No types');
    }
    if (sort.marks?.length) {
        parts.push(CARD_MARKS.filter(m => sort.marks.includes(m.id)).map(m => m.label).join(', '));
    }
    if (sort.previews) parts.push('Previews');
    return parts.join(' · ');
}

/**
 * The kind rows the filter panel lists, in panel order (PANEL_KINDS): kinds with a card in the
 * CURRENT scope, plus any kind currently hidden so it can always be switched back on.
 * `entries` = [{ group, item }], `item` being the group's selected history item.
 */
export function listedKinds(entries, sort) {
    const present = new Set(entries.filter(e => _inScope(e.group, sort)).map(e => kindOfItem(e.item).kind));
    return PANEL_KINDS.filter(k => present.has(k.kind) || sort.hiddenKinds?.includes(k.kind));
}
