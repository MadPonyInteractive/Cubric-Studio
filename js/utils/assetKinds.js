/**
 * MPI-749 — what KIND of asset a gallery card is showing.
 *
 * One table, and a new kind is ONE row here: the card's corner icon, the filter panel's
 * row, its tooltip text and the grid predicate all read it. Adding one (GIF, MIDI,
 * stems…) is a checklist in docs/gallery-filters.md § Adding a media kind.
 *
 * Row ORDER is match precedence — first match wins, so a kind that is a special case of
 * another sits above it. `panelOrder` is separate: the order the panel lists the rows and
 * its tooltip names them (PANEL_KINDS).
 *
 * Kind is read from an ITEM (the card's selected history item), never `group.type`:
 * a video group can hold an image item, and the icon has to match what the card
 * paints. A 3D Scene is deliberately not a fourth media type — it is an image item
 * carrying `splatPath` (projectModel.js, MPI-623) — so it must match before the type
 * rows, and `image` is the catch-all that has to stay last.
 *
 * `badge` = the card shows a corner icon. Unmarked means "just a picture"; audio's
 * waveform already says audio. `label` names the panel row, `singular` the chip's
 * tooltip, `icon` a key in js/utils/icons.js (tests/asset-kinds.test.cjs fails on a
 * missing one — renderIcon would fall back silently).
 *
 * No imports: `MpiGalleryGrid.js` reaches utils by absolute browser path, which Node
 * cannot resolve, so the rule lives here to stay testable (tests/asset-kinds.test.cjs).
 */
export const ASSET_KINDS = Object.freeze([
    { kind: 'scene', label: '3D Scenes', singular: '3D Scene', icon: 'cube',  badge: true,  panelOrder: 5, match: (item) => !!item?.splatPath },
    { kind: 'video', label: 'Videos',    singular: 'Video',    icon: 'video', badge: true,  panelOrder: 3, match: (item) => item?.type === 'video' },
    { kind: 'audio', label: 'Audio',     singular: 'Audio',    icon: 'audio', badge: false, panelOrder: 4, match: (item) => item?.type === 'audio' },
    // MPI-759: a GIF is an image item, never a fourth media `type` — same precedent
    // as the 3D Scene's `splatPath`. MPI-768 items carry a truthy `gif` field; a
    // legacy import has none but a `filePath` ending `.gif` (matched
    // case-insensitively). Either is enough — the field's inner shape never matters
    // here.
    { kind: 'gif',   label: 'GIFs',      singular: 'GIF',      icon: 'gif',   badge: true,  panelOrder: 2, match: (item) => !!item?.gif || (item?.type === 'image' && /\.gif$/i.test(item?.filePath || '')) },
    { kind: 'image', label: 'Images',    singular: 'Image',    icon: 'image', badge: false, panelOrder: 1, match: () => true },
]);

/** ASSET_KINDS in the order the filter panel lists them and its tooltip names them. */
export const PANEL_KINDS = Object.freeze([...ASSET_KINDS].sort((x, y) => x.panelOrder - y.panelOrder));

/** The ASSET_KINDS row for one history item; `null` and unknown types land on `image`. */
export function kindOfItem(item) {
    return ASSET_KINDS.find(k => k.match(item));
}
