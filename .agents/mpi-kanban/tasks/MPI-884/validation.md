# MPI-884 - validation

## The root cause, proven not inferred

The staged attachment is the card's thumbnail FILE - not a resize of the card, not a
re-encode. sha256 `42f7e1039db1768e6b3d7c4ad12b7af64574acff2b31b6ffc0b03143f2c37a36`, walked
across the whole projects root, matches in exactly two places:

```
C:\Users\Fabio\AppData\Roaming\Cubric Studio\agent\attachments\att_6ae33f4a.webp   512x682
C:\Users\Fabio\Documents\Cubric Vision\Projects\Anime Kids and Dog\Media\.meta\998f15b2-e0ba-42d9-be60-cb7531d23a67.thumb.webp
C:\Users\Fabio\Documents\Cubric Vision\Projects\Anime Kids and Dog\Media\.preview-assets\42f7e103….webp
```

The card is t2i_003, `pixelDimensions {"w":768,"h":1024}`, `thumbPathLg` undefined. The third
path is the content-addressed store `placeAsset` writes, so the thumbnail had already been
handed to a generation as a reference image.

Why it is the DRAG and nothing of ours:

| Suspect | Verdict |
|---|---|
| `saveAttachment` (services/agentTools.mjs:299) | writes the posted bytes verbatim - not it |
| `_addImageFile` (MpiAgentChat.js) | FileReaders the dropped File verbatim - not it |
| the dragged `<img>` | `pickImageRendition` (js/utils/galleryRenditions.js:41) returns `item.thumbPath` while `boxPx` is 0, i.e. the 512 `.thumb.webp` - **this** |

Chromium synthesises `dataTransfer.files` from the dragged `<img>`'s own image resource, so a
drop handler that reads `files` receives the rendition's bytes. The card's real path rides the
same drag in `application/mpi-media` (`MpiGalleryGrid` dragstart, lines 1196 and 1346).
`MpiPromptBox._handleMediaDrop` reads that payload first; `MpiAgentChat`'s drop only ever read
`files`.

## The fix

- `cardAttachmentSource()` in `js/utils/mediaActions.js` - the card's full-resolution file, or
  null when there is no stageable still (video/audio card, `.gif`, `blob:`, malformed).
- `MpiAgentChat._addCardMedia()` fetches it and hands `_addImageFile` a real `File`. The drop
  handler reads the card payload first and falls back to `dataTransfer.files` for OS file
  drops. Both are read before the first `await` - `dataTransfer` is emptied once the handler
  yields.
- The `.gif` exclusion is load-bearing: `saveAttachment` takes only JPEG/PNG/WebP, so routing
  a GIF card's real file at it would turn a working (small) attachment into a staging error.
  Those cards keep the old behaviour.

## Evidence

**`tests/agent-attachment-full-res.test.cjs` - 4/4 green.** Proven RED on the pre-fix handler:
with the old `files`-only drop restored, the ordering guard fails with *"the card payload is
the only thing naming the real file"*; restored, 4/4.

**Full suite:** `npm test` - 1752 tests, **0 fail**, exit 0.
**Lint:** eslint on all three changed files, `--max-warnings=0`, exit 0.

**Transport run for real, in Chromium** (static page over http on 127.0.0.1:47884, importing
the REAL `js/utils/mediaActions.js`, against a real 1,549,178-byte `t2i_003.png` served
through a `/project-file` that mirrors `res.sendFile`):

```
cardAttachmentSource.name: t2i_003.png
cardAttachmentSource.url endsWith .thumb.webp: false
blob.type: image/png
file.type passes _addImageFile guard: true
file.size: 1549178
dataUrl prefix: data:image/png;base64,
saveAttachment regex accepts it: true
decoded bytes: 1549178
ATTACHED PIXELS: 768x1024
```

768x1024, byte-for-byte the card's own file, where the bug staged 512x682.

## What is NOT covered

The drag GESTURE itself. Chromium's synthesis of `dataTransfer.files` from a dragged `<img>`
is the mechanism under test and Playwright cannot reproduce it, so the last step is a human
one: reload the running app, drag a gallery card onto the agent chat, and check the staged
file under `%APPDATA%\Cubric Studio\agent\attachments\` is the card's own size. The renderer
is served from the tree, so a reload picks this up with no rebuild.

Out of scope, carded nowhere yet: dragging a VIDEO card onto the chat still attaches its
poster frame as an image (the old `files` path), which is the same class of surprise. The
route already takes a video by reference (`routes/agent.js`), so the transport exists.
