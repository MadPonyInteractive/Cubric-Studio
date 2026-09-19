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
 * `badge` = the card shows a corner icon. EVERY kind carries one (Fabio, 2026-09-19,
 * MPI-736 round 7) — this used to be false for `image` and `audio` on the argument that
 * an unmarked card means "just a picture" and audio's waveform already says audio, and
 * that is deliberately reversed: the chip is now how a card states its media type, so
 * leaving two kinds silent left the statement half-made. `label` names the panel row,
 * `singular` the chip's tooltip, `icon` a key in js/utils/icons.js
 * (tests/asset-kinds.test.cjs fails on a missing one — renderIcon would fall back
 * silently). `type` is the media slot the kind can fill — the media picker opens an
 * image slot on the `image`-typed kinds (MPI-785).
 *
 * `accent` is a `[data-accent]` value from styles/01_base.css, written onto the card's
 * corner chip by MpiGalleryGrid and onto the filter panel's kind rows by
 * galleryFilterPanel.js, so each rebinds `--accent-heat` for itself and the colour already
 * in those rules follows. It is the MEDIA TYPE's family colour: Vision rose for a still
 * image, Video orange for a video, Audio green for sound.
 *
 * A GIF is `vision`, not `video` (Fabio, 2026-09-19): *"I know they're animated, but
 * they're still images."* The split is by what the thing IS, not by whether it moves. A 3D
 * Scene is `vision` for the same reason — it makes pictures — and gets its own hue and
 * mascot only when the app does real 3D models. A future element card, one card holding
 * several media types at once, takes `studio` cream: no single family hue is true of it.
 *
 * No imports: `MpiGalleryGrid.js` reaches utils by absolute browser path, which Node
 * cannot resolve, so the rule lives here to stay testable (tests/asset-kinds.test.cjs).
 */

/**
 * Every `filePath` the client ever sees is wrapped by the server as
 * `/project-file?path=<encoded abs path>` — `projectFileUrlBusted` (routes/projects.js)
 * appends `&v=<mtime>` to it for every upload/import, so the raw string NEVER ends in
 * `.gif`: it ends in the cache-bust digits. A legacy `.gif` import's `gif` field is also
 * routinely absent client-side (the shared `media:imported` listener does not carry it
 * through — MPI-759 follow-up), which made the filename fallback below the ONLY thing
 * standing between a real imported GIF and the plain `image` row, and it was matching
 * against the wrapper string instead of the path it wraps — so it never fired for a
 * single real card, only for the bare-path shape unit tests hand-wrote (verified
 * 2026-09-16: MPI-759 reopened). Decode the `path=` query value first; fall back to the
 * raw string for anything not shaped like the wrapper (a bare path, already-decoded, or
 * absent).
 */
function _underlyingPath(filePath) {
    const m = /[?&]path=([^&]+)/.exec(filePath || '');
    if (!m) return filePath || '';
    try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
}

export const ASSET_KINDS = Object.freeze([
    { kind: 'scene', label: '3D Scenes', singular: '3D Scene', icon: 'cube',  type: 'image', badge: true, accent: 'vision', panelOrder: 5, match: (item) => !!item?.splatPath },
    { kind: 'video', label: 'Videos',    singular: 'Video',    icon: 'video', type: 'video', badge: true, accent: 'video',  panelOrder: 3, match: (item) => item?.type === 'video' },
    { kind: 'audio', label: 'Audio',     singular: 'Audio',    icon: 'audio', type: 'audio', badge: true, accent: 'audio',  panelOrder: 4, match: (item) => item?.type === 'audio' },
    // MPI-759: a GIF is an image item, never a fourth media `type` — same precedent
    // as the 3D Scene's `splatPath`. MPI-768 items carry a truthy `gif` field; a
    // legacy import has none but a `filePath` ending `.gif` (matched
    // case-insensitively). Either is enough — the field's inner shape never matters
    // here.
    { kind: 'gif',   label: 'GIFs',      singular: 'GIF',      icon: 'gif',   type: 'image', badge: true, accent: 'vision', panelOrder: 2, match: (item) => !!item?.gif || (item?.type === 'image' && /\.gif$/i.test(_underlyingPath(item?.filePath))) },
    { kind: 'image', label: 'Images',    singular: 'Image',    icon: 'image', type: 'image', badge: true, accent: 'vision', panelOrder: 1, match: () => true },
]);

/** ASSET_KINDS in the order the filter panel lists them and its tooltip names them. */
export const PANEL_KINDS = Object.freeze([...ASSET_KINDS].sort((x, y) => x.panelOrder - y.panelOrder));

/**
 * The ASSET_KINDS row for one history item; `null` and unknown types land on `image`.
 * That catch-all is why a caller painting the corner chip must check it HAS an item
 * first — now every row carries `badge: true`, an empty card would otherwise claim to
 * be an image (MpiGalleryGrid.js `_render()`).
 */
export function kindOfItem(item) {
    return ASSET_KINDS.find(k => k.match(item));
}
