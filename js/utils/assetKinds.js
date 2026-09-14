/**
 * MPI-749 — what KIND of asset a gallery card is showing.
 *
 * One ordered table, first match wins. The card's corner icon and the filter panel's
 * rows both come from it, so a new kind is one row here.
 *
 * Kind is read from an ITEM (the card's selected history item), never `group.type`:
 * a video group can hold an image item, and the icon has to match what the card
 * paints. A 3D Scene is deliberately not a fourth media type — it is an image item
 * carrying `splatPath` (projectModel.js, MPI-623) — so it must match before the type
 * rows, and `image` is the catch-all that has to stay last.
 *
 * `badge` = the card shows a corner icon. Unmarked means "just a picture"; audio's
 * waveform already says audio.
 *
 * No imports: `MpiGalleryGrid.js` reaches utils by absolute browser path, which Node
 * cannot resolve, so the rule lives here to stay testable (tests/asset-kinds.test.cjs).
 */
export const ASSET_KINDS = Object.freeze([
    { kind: 'scene', label: '3D Scenes', singular: '3D Scene', icon: 'cube',  badge: true,  match: (item) => !!item?.splatPath },
    { kind: 'video', label: 'Videos',    singular: 'Video',    icon: 'video', badge: true,  match: (item) => item?.type === 'video' },
    { kind: 'audio', label: 'Audio',     singular: 'Audio',    icon: 'audio', badge: false, match: (item) => item?.type === 'audio' },
    { kind: 'image', label: 'Images',    singular: 'Image',    icon: 'image', badge: false, match: () => true },
]);

/** The ASSET_KINDS row for one history item; `null` and unknown types land on `image`. */
export function kindOfItem(item) {
    return ASSET_KINDS.find(k => k.match(item));
}
