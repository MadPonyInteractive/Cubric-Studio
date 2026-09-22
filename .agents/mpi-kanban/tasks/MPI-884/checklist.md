# MPI-884 - checklist

Root cause (proven, not inferred):

- [x] The staged attachment is byte-identical to the card's `.thumb.webp` - sha256
      `42f7e1039db1768e...` matches both
      `Anime Kids and Dog/Media/.meta/998f15b2-....thumb.webp` and that project's
      `.preview-assets/42f7e103....webp`. Card t2i_003 is 768x1024; the attachment is
      512x682. Nothing re-encoded it: the exact file travelled.
- [x] Not our downscaler. `saveAttachment` (services/agentTools.mjs:299) writes the posted
      bytes verbatim; `_addImageFile` (MpiAgentChat.js:634) FileReaders the dropped File
      verbatim.
- [x] The `<img>` a card drags IS the 512 rendition - `pickImageRendition`
      (js/utils/galleryRenditions.js:41) returns `item.thumbPath` for an unpromoted card
      (`boxPx` 0), and Chromium synthesises `dataTransfer.files` from that element's own
      image resource.
- [x] The real file rides the SAME drag: `MpiGalleryGrid` dragstart sets
      `application/mpi-media` with `filePath` (line 1196 and 1346). `MpiPromptBox`
      `_handleMediaDrop` reads it before `files`; `MpiAgentChat`'s drop handler only ever
      read `files`.

Fix:

- [x] `MpiAgentChat` drop reads `application/mpi-media` first and attaches the card's real
      file; `dataTransfer.files` stays the OS-file-drop path.
- [x] The decision (which dropped card yields a full-res image, which falls through) is a
      pure helper in `js/utils/mediaActions.js` so it can be tested.
- [x] A card whose real file is not a stageable still (`.gif`, a video/audio card, a
      `blob:` with no on-disk file) falls through unchanged - `saveAttachment` takes only
      JPEG/PNG/WebP, so routing a `.gif` at it would turn a working attachment into a
      staging error.
- [x] `tests/agent-attachment-full-res.test.cjs` green.
- [x] Full `npm test` green, lint green.
- [x] `docs/gallery.md` records that the in-app drag carries the thumbnail's BYTES, so any
      drop target reading `dataTransfer.files` gets the rendition.
