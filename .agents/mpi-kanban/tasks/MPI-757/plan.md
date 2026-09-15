# MPI-757 - GIF workspace: frames, cut-out, Make GIF, GIF Maker

Umbrella created 2026-09-14, redesigned in a brainstorm with Fabio on 2026-09-14/15. Every
decision below is his and is not re-opened in the member cards. Large plan written 2026-09-15 on top
of that design: it adds investigation, file ownership and parallel batches, and changes no decision.

**The member cards stay on the board.** This card carries no code. Each member closes when its
phase lands; this umbrella closes when the last one does, and its `validation.md` then records
the ordering and anything left behind.

## Current State

**2026-09-15:** design settled, investigation done, no code written. Project mode:
`scalable-foundation`. Evidence for every fact below, with the corrections to what the
investigators got wrong: [research/2026-09-15-investigation.md](research/2026-09-15-investigation.md).

- **No engine blocker.** The shipped pin (ComfyUI v0.34.0, the local engine is at exactly that tag)
  carries `SAM3_VideoTrack` and `SAM3_TrackToMask`. No new MpiNodes node is needed: frames reach a
  graph as a temp video through `MpiLoadVideo`, which remote staging already handles.
- **GIF delays proven.** ffmpeg demuxer durations drift (asked 10,50,3,2,7, wrote 12,48,4,1,7,4 plus
  an extra frame). Exact delays come from a constant-rate two-pass-palette build followed by
  patching each frame's Graphic Control Extension. Reading: `sharp(...).metadata()` `delay`/`pages`
  and ffprobe `pkt_duration` both match a real block walk.
- **MPI-749 is `done`**, so MPI-759 is no longer waiting (its card still says `blocked`; the umbrella
  does not move members, `beginImplementation` fixes it when phase 1 starts).
- **Next action:** `mpi-continue` MPI-757 -> Batch 1 (MPI-768 + MPI-759) routes to
  `mpi-execute-parallel`.

## What we are building

GIF becomes its own kind with its own history workspace, the way image and video have theirs
(audio and other kinds will follow the same shape later). A GIF entry is full-colour frames plus
a frame list; the `.gif` is BUILT from them, so nothing downstream (video, saved frames, the
cut-out) ever passes through 256 colours.

## Decisions (Fabio)

| # | Decision |
|---|---|
| 1 | No background removal on video. GIF only. (MPI-758 closed as rejected; its `validation.md` keeps what it found.) |
| 2 | GIFs open in a dedicated GIF history workspace, a third mode beside image and video. Viewer and tool list come from one per-kind table so audio is a row later. |
| 3 | V1 tools: Crop, Resize, Trim, Speed, Reverse, Loop count, GIF output, Save frame as image, GIF to Video, and the cut-out. Reorder and delete frames happen on the strip. |
| 4 | Transparent output: on/off GIF alpha plus an **edge colour** that soft edges blend into before the cut. Edge colour lives in GIF output, not in the cut-out. |
| 5 | Gallery: still until hover, hover plays. GIF gets its own icon in the card chip and the filter panel. |
| 6 | Make GIF from a gallery selection: one click, click order, defaults, opens in the workspace. Plus a reorder capability (now the strip). |
| 7 | Frames are the source of truth, full-colour, content-addressed. Deleting frees frames nothing else uses. |
| 8 | Make GIF keeps full resolution with no prompt. The built `.gif` defaults to 1024 on the longest edge. |
| 9 | Frame strip: full app width, above the play button and scrub bar, current frame at the centre marker; it moves as you play or scrub. |
| 10 | Strip edits stage; **Update** rewrites the current entry, **Apply** saves a new one. |
| 11 | Cut-out = SAM3 by name with video tracking, Mask Adjust across frames, Invert, cut into alpha. No BiRefNet. No batching in v1: Fabio masks 15 s 24 fps videos with SAM3 with no memory issue. |
| 12 | The agent authors the SAM3 GIF graph itself, modelled on the existing SAM3 graph (explicit permission, 2026-09-15). |
| 13 | GIF Maker (video workspace) creates a new GIF card, not a history entry in the video card. |

## Members

| Card | What it is | Phase | Depends on |
|---|---|---|---|
| MPI-768 | GIF frames store and builder (server foundation) | 1 | nothing |
| MPI-759 | GIF as its own gallery asset kind | 1 | ~~MPI-749~~ (done) |
| MPI-769 | GIF history workspace (viewer, control bar, frame strip) | 2 | MPI-768, MPI-759 (kind row) |
| MPI-770 | Make GIF from selected images | 2 | MPI-768 |
| MPI-771 | GIF cut-out with SAM3 by name | 3 (engine half in 2) | MPI-769 (UI half), MPI-768 |
| MPI-772 | GIF timing tools and output | 4 | MPI-769 |
| MPI-773 | GIF transform and export tools | 4 (server half in 3), after MPI-772 | MPI-769 |
| MPI-760 | Export GIF becomes GIF Maker | 5 (server half in 3) | MPI-768, MPI-769 |
| ~~MPI-758~~ | Remove Background on video | closed | rejected 2026-09-15 |

## Phase order and why

1. **MPI-768 + MPI-759 in parallel.** Disjoint files: 768 is server routes and utils, 759 is the
   gallery grid and kind table. 759 matches legacy `.gif` items by extension, so it does not need
   768 to show the kind.
2. **MPI-769 + MPI-770 in parallel.** Both need 768's frame store and builder. 770 lives in the
   gallery (context menu, `MpiGalleryBlock`), 769 in the history block, so they do not collide.
   770 can land before 769 and simply open its card later.
3. **MPI-771 first of the tool cards**: Fabio rates the cut-out the most valuable v1 tool.
4. **MPI-772, then MPI-773.** Both add panels to `MpiHistoryTools.js` and handlers to
   `MpiGroupHistoryBlock.js`, as does 771. Run them one after another, or claim and stage by hunk.
5. **MPI-760 last.** It touches the same two files for the video mode, and its new card opens in
   769's workspace.

**What this plan adds to that order (no decision changed):** cards 771, 773 and 760 each split into
an **engine/server half** (new route files, graph, registries: none of the shared history files)
and a **UI half** (the history block and tool list). The server halves run one batch EARLY, beside
the phase before them, because their files are disjoint. The UI halves keep the settled serial
order 771 -> 772 -> 773 -> 760. A card enters `doing` when its first half starts and its `files.json`
lists BOTH halves.

## Engineering calls this plan makes

Not Fabio's decisions: defaults an implementing agent follows without stopping to ask. Changing one
needs evidence, recorded in `## Plan Drift`.

- **E1 Builder.** Two-pass palette as `routes/videoGif.js`, one GIF frame per list entry at a constant
  rate, then patch every GCE delay (a block walker, not a byte scan). Never write a delay under 2.
  Loop: the `routes/videoGif.js` total-plays remap. Edge colour: blend partial alpha into it, then
  cut alpha on/off, before palettegen. The proof commands are in the research file.
- **E2 Reader.** Frames: `ffmpeg -i in.gif -fps_mode passthrough %05d.png` (rgba). Delays and loop:
  `sharp(path, { animated: true }).metadata()`. Assert frame count == `pages` or fail loudly.
- **E3 One service, many routes.** `services/gifFrames.js` owns the store, extract, build, sweep and
  entry writes. `routes/gif.js` (MPI-768) exposes the core: ensure-frames for a legacy item, write
  an entry from a frame list (`update` rewrites, `new` adds), serve frame and thumbnail files.
  Every later feature gets its OWN route file (the `videoGif.js` / `videoReverse.js` precedent), so
  batch workers never share a route file. Mounting a route in `server.js` is one line: the batch
  orchestrator adds those after the workers finish.
- **E4 Sweep hooks.** The sweep reads EVERY sidecar in the project (archived included) and deletes
  frames none references. It runs from `DELETE /project-media/:projectId/:filename`
  (`routes/projects.js:1127`), `DELETE /delete-meta` (:2814) and after an entry Update.
  `add-from-cards` (:2046) copies the referenced frames and carries the `gif` field.
- **E5 Never rebuild a `.gif` under the same URL.** Chromium keeps decoded image data per URL
  (docs/gallery.md § Retention). Update writes a new sequenced file (`nextSequence`) and removes the
  old one.
- **E6 Control bar.** `MpiVideoControlBar` is seconds x fps over a `MpiVideoSurface` and takes no
  per-frame delays, so by MPI-769's own rule the GIF gets a sibling bar that looks identical, reusing
  the `MpiTrimBar` Compound for the in/out range.
- **E7 Cut-out input and math.** Server encodes the frame list to a temp video, one video frame per
  GIF frame, fed through `MpiLoadVideo` (remote staging unchanged). Masks come back as a PNG batch
  through the `runAutoMask`-style title capture (exact edges), unless the first real run shows the
  batch is too slow; then a mask video, recorded in drift. Mask Adjust across frames imports
  `managers/distanceField.js` server-side so preview and apply run the same math; Fill Holes uses
  `fillMaskHoles` (`services/imageComposite.js:42`).
- **E8 Op registration.** Hand-edit only `js/data/commandRegistry.js` and
  `js/data/modelConstants/universal_workflows.js` (precedent `autoMaskImg`). `operationRegistry.js`,
  `operation_registry.json` and release notes come from `/mpi-version-bump` (docs/versioning.md:200).

## Remaining Work

Every worker is briefed with the CLAUDE.md Critical Rules Snapshot, the `root-cause` and `kanban`
briefings, the briefings named on its task, this plan's Decisions + Engineering calls, and the
research file. Shared registration files `js/shell/preloadStyles.js` and `js/components/types.js`
were under a live MPI-774 claim on 2026-09-15: re-read `state/index.json` before a batch; if still
claimed, append by hunk and tell MPI-774 with `mpi-message`. `pending_file_states` from MPI-623,
MPI-573 and MPI-664 name `routes/projects.js`, `js/data/projectModel.js`, the gallery grid/block and
the two registries: provenance only (their work is committed); confirm with `git status` before
editing. Desktop specs always run with a private `--output=<scratchpad>` dir. Never drive the user's
`:3000`; a real generation goes through `npm run app:isolated` under the GPU lease.

## Parallel Batch: Phase 1 - frames store and gallery kind

- [ ] **MPI-768 GIF frames store and builder.** `services/gifFrames.js` per E1-E5: content-addressed
  `Media/.gif-frames/<sha256>.png` + per-frame thumbnail, extract (legacy lazy + at import),
  build, entry write (`update` / `new`), sweep. `routes/gif.js` core routes; mount it in `server.js`
  (only server.js editor in this batch). Import hook in `POST /project-media/:projectId/upload`
  (`routes/projects.js:1418`); sweep hooks per E4; `add-from-cards` frame copy. Sidecar `gif` field
  typedef in `js/data/projectModel.js`; upload-response passthrough beside `splatPath` (~:2302). New
  subsystem doc `docs/gif.md` (<=200 lines, listed in `docs/README.md`); contract changes in
  `docs/project-integrity.md`. Ownership: `services/gifFrames.js` (new), `routes/gif.js` (new),
  `server.js`, `routes/projects.js`, `js/data/projectModel.js`, `tests/gif-frames.test.cjs` (new),
  `docs/gif.md` (new), `docs/README.md`, `docs/project-integrity.md`. Briefings: root-cause, kanban,
  git, dos_and_donts. **Verify:** `node --test "tests/gif-frames.test.cjs"` proves build from a frame
  list with exact per-frame delays (block walk + sharp read-back), delay floor 2, extract round trip
  on a variable-delay GIF, dedup (identical frames written once), sweep deletes only unreferenced
  frames (an archived-card reference survives), Update writes a new `.gif` name, legacy `.gif`
  extracts lazily, add-from-cards copies frames; then `node --test "tests/*.test.cjs"` stays green.
- [ ] **MPI-759 GIF as its own gallery asset kind.** Row `gif` above `image` (match `item.gif` OR an
  image whose file ends `.gif`), badge on, a new 24-unit FILL icon (docs/gallery-filters.md § Adding
  a media kind). GIF cards never mount the `.gif` from the rendition ladder (the
  `pickImageRendition(..., { allowSource })` call at `MpiGalleryGrid.js:938`); hover mounts the file
  and leave / scroll-out / `_mediaHolds` demote it, riding `_promoteVideo` (:1046) and
  `_removeHoverVideo` (:1091). Measure a hover tour on the MPI-633 rig
  (`tasks/_archived/MPI-633/validation.md`), command beside the number. Ownership:
  `js/utils/assetKinds.js`, `js/utils/icons.js`, `js/utils/galleryRenditions.js`,
  `js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js`, `MpiGalleryGrid.css`,
  `tests/asset-kinds.test.cjs`, `tests/gallery-renditions.test.cjs`,
  `tests/desktop/gallery-gif-hover.spec.js` (new), `docs/gallery.md`, `docs/gallery-filters.md`.
  Briefings: components, events, state, root-cause, kanban. **Verify:**
  `node --test "tests/asset-kinds.test.cjs" "tests/gallery-renditions.test.cjs"` (both match paths,
  precedence, icon present); `npx playwright test --config=playwright.desktop.config.js
  tests/desktop/gallery-gif-hover.spec.js tests/desktop/gallery-renditions.spec.js
  tests/desktop/gallery-media-release.spec.js --output=<scratchpad>`: no GIF `src` mounted without a
  hover at every slider size, hover mounts it, leave removes it; `npm run lint:components` clean.

Phase 1 verify mode: `auto`.

## Parallel Batch: Phase 2 - workspace, Make GIF, cut-out engine

Orchestrator after the workers: mount `routes/gifMake.js` and `routes/gifCutout.js` in `server.js`.

- [ ] **MPI-769 GIF history workspace.** Per-kind table `{ image, video, gif }` -> viewer + tool list
  replacing `isVideo` (:252) and `TOOL_LISTS` (`Compounds/MpiHistoryTools/MpiHistoryTools.js:185`);
  a card opens in `gif` mode when its item's `kindOfItem` is `gif`. Respect the tier rule: the
  Compound cannot import the Block, so the tool lists stay keyed by kind in the Compound. GIF viewer
  (frames at viewer size, small decode cache, GIF preview toggle), sibling control bar per E6 in
  `#controls-mount`, full-width frame strip with centre marker, staged reorder/delete with the
  Update/Apply pill calling MPI-768's entry route. No PromptBox in `gif` mode. Frame-step and Delete
  hotkeys: the existing `video.frame.*` / `history.selection.delete` ids are scoped
  `Video Player` / `History` (`js/managers/hotkeyRegistry.js:269, :492`); widen their `when` or add
  `gif.*` ids. An empty-but-routed `gif` tool list. Ownership:
  `js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js` (+ `.css`),
  `js/components/Compounds/MpiHistoryTools/MpiHistoryTools.js`,
  `js/components/Compounds/MpiHistoryList/` (only if its `isVideo` prop needs a kind),
  new `js/components/Organisms/MpiGifViewer/`, `js/components/Organisms/MpiGifControlBar/`,
  `js/components/Organisms/MpiFrameStrip/` (tier is the card's call), `js/managers/hotkeyRegistry.js`,
  `js/shell/preloadStyles.js`, `js/components/types.js`, `tests/desktop/gif-workspace.spec.js` (new),
  `tests/desktop/history-modes.spec.js` (new), `docs/workspaces.md`, `docs/video-player.md`.
  Briefings: components, workspaces, events, state, root-cause, kanban. **Verify:**
  `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-workspace.spec.js
  tests/desktop/history-modes.spec.js --output=<scratchpad>`: a GIF card opens in `gif` mode with no
  PromptBox; play, step and scrub keep the strip's centre on the frame the counter shows; reorder +
  delete stage, Update rewrites the entry (new `.gif` name), Apply adds one; an image card and a
  video card still open with their own viewer, tool list and control bar (no spec covered this
  before). `npm run lint:components` clean. Then **user-ux**: Fabio eye-checks the strip.
- [ ] **MPI-770 Make GIF from selected images.** Context-menu entry beside `combine`
  (`MpiGalleryGrid.js:1455-1460`), enabled for 2+ cards whose selected items are all still images
  (not video, audio, 3D Scene or GIF), disabled reason in `info`; `targetIds` used as given.
  Handler in `MpiGalleryBlock.js` modelled on `grid.on('combine')` (:329): POST to the new route, then
  `createImageItem` + `createItemGroup` + `appendToHistory` + `addGroup` + `setGroups`, then
  `navigate(PAGE_GROUP_HISTORY, { groupId })`. `routes/gifMake.js` reads each item's full-res file,
  fits it inside the first image's size with transparent padding (sharp), writes frames through
  `services/gifFrames.js`, builds at 10 fps / 1024 / loop forever. Ownership:
  `js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js`,
  `js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js`, `routes/gifMake.js` (new),
  `tests/gif-make.test.cjs` (new), `docs/gallery-selection.md`. Briefings: components, events, state,
  root-cause, kanban. **Verify:** `node --test "tests/gif-make.test.cjs"`: three images of different
  sizes in a chosen order give one GIF sidecar whose frames follow that order, every frame is the
  first image's size with transparent padding (pixel check on the alpha), delays 10, loop 0; then a
  real run in `npm run app:isolated`: ctrl-click three cards -> Make GIF -> new card opens, plays on
  hover.
- [ ] **MPI-771 (engine half) cut-out graph, runner, alpha apply.** Probe `/object_info` on the
  isolated app's engine FIRST (memory `tool_comfy_schema_gate_before_workflow_sync`), then author
  `comfy_workflows/raw/gif_cutout_sam3.json` from `img_auto_mask.json`'s text branch:
  `MpiLoadVideo` (`Input_Video`) -> `SAM3_VideoTrack` (images + CLIPTextEncode from the SAM3
  checkpoint, `Input_Text_Prompt`) -> `SAM3_TrackToMask` (`Input_Object_Indices`) -> `Output_*`
  masks, and generate the API file with `node scripts/sync-raw-workflows.mjs`. Found objects and
  their chips need per-object output: `SAM3_TrackPreview` exists in the pin, read it first. Register
  per E8. Runner beside `runAutoMask` (`js/services/commandExecutor.js:918`), text rules from
  `js/utils/maskTextPrompt.js`. `routes/gifCutout.js`: temp track-source video (E7), Mask Adjust +
  Fill Holes + Invert across frames, mask into the alpha of the full-res frames -> new entry. Large
  GIF failure = clear warning, never a cap. Ownership: `comfy_workflows/raw/gif_cutout_sam3.json`
  (new), `comfy_workflows/gif_cutout_sam3.json` (generated), `js/data/commandRegistry.js`,
  `js/data/modelConstants/universal_workflows.js`, `js/services/commandExecutor.js`,
  `routes/gifCutout.js` (new), `tests/gif-cutout.test.cjs` (new), `docs/masking-sam3.md`. Briefings:
  comfy_injection, comfy_engine, root-cause, kanban. Worker type: `comfy-worker`. **Verify:**
  `node --test "tests/gif-cutout.test.cjs"` (alpha written from a synthetic mask batch, grow/shrink
  matches `distanceField.js` on the same input, Invert flips, frame store gains only the cut
  frames); `node --test "tests/*.test.cjs"` green; one real track of a real mascot GIF on the
  isolated app's local engine through the GPU lease returns one mask per frame. RunPod proof belongs
  to the UI half (it rents a GPU: Fabio's go).

Phase 2 verify mode: `user-ux` for MPI-769 only; the other two `auto`.

## Parallel Batch: Phase 3 - cut-out UI, transform and GIF Maker servers

Orchestrator after the workers: mount `routes/gifTransform.js`, `routes/gifToVideo.js` and
`routes/gifMaker.js` in `server.js`.

- [ ] **MPI-771 (UI half) Cut-out tool group.** Mask by name (text + count, chips to keep or drop),
  Mask Adjust set once for all frames with a current-frame preview reusing
  `MpiToolOptionsMaskAdjust`'s math, Invert, Cut out -> new entry via `routes/gifCutout.js`. Tint on
  the viewer and strip thumbnails so flicker shows while scrubbing. The mask lives until applied or
  the workspace is left (docs/masking.md); a canvas-layer mutation needs its UndoStack entry.
  Ownership: `MpiGroupHistoryBlock.js`, `Compounds/MpiHistoryTools/MpiHistoryTools.js`, new
  `js/components/Organisms/MpiToolOptionsGifCutout/`, `Organisms/MpiGifViewer/`,
  `Organisms/MpiFrameStrip/` (tint only), `js/shell/preloadStyles.js`, `js/components/types.js`,
  `tests/desktop/gif-cutout.spec.js` (new), `docs/gif.md`. Briefings: components, events, state,
  root-cause, kanban. **Verify:** `npx playwright test --config=playwright.desktop.config.js
  tests/desktop/gif-cutout.spec.js tests/desktop/history-modes.spec.js --output=<scratchpad>` (panel
  routes, chips toggle object indices, Apply adds an entry); `npm run lint:components`. Then
  **user-ux**: on a real mascot GIF Fabio masks the mascot by name, the ground shadow is not in the
  mask, Cut out gives a transparent background, scrubbing shows no edge flicker worth fixing, on the
  local engine AND on RunPod (Fabio's go to rent the Pod; RunPod cards run one at a time).
- [ ] **MPI-773 (server half) transform and GIF to Video routes.** `routes/gifTransform.js`: Crop
  (one rectangle, every frame) and Resize (one size) -> new frames -> new entry.
  `routes/gifToVideo.js`: frames + delays -> constant 30 fps h264 MP4 at frame size (even
  dimensions), frames repeated to hold each delay, transparent areas filled with a background colour
  (default black), sidecar + `writeVideoDerivatives` (`services/ffmpegThumb.js:256`), precedent
  `routes/videoReverse.js`. Ownership: `routes/gifTransform.js` (new), `routes/gifToVideo.js` (new),
  `tests/gif-transform.test.cjs` (new). Briefings: root-cause, kanban, dos_and_donts. **Verify:**
  `node --test "tests/gif-transform.test.cjs"`: crop 9:16 then GIF to Video on three 3 s frames gives a
  30 fps MP4 of about 9 s with even dimensions, poster and proxy written, and a sampled video pixel
  matches the source frame within codec tolerance (not a 256-colour palette value).
- [ ] **MPI-760 (server half) GIF Maker route.** `routes/gifMaker.js`: a video item + fps + trim range
  -> full-resolution frames through `services/gifFrames.js` -> built `.gif` at the size preset -> a
  new GIF item and sidecar (a new card, decision 13). `routes/videoGif.js` stays as the preview
  encoder. Ownership: `routes/gifMaker.js` (new), `tests/gif-maker.test.cjs` (new). Briefings:
  root-cause, kanban, dos_and_donts. **Verify:** `node --test "tests/gif-maker.test.cjs"`: a 2 s
  test clip at 10 fps with a 0.5-1.5 s trim gives 10 full-resolution frames, delays 10, the `.gif`
  longest edge at the preset.

Phase 3 verify mode: `user-ux` for MPI-771; the server halves `auto`.

## Phase 4: timing tools, then transform UI (serial)

Serial by decision: both edit the same tables in `MpiGroupHistoryBlock.js` and `MpiHistoryTools.js`.

- [ ] **MPI-772 GIF timing tools and output.** Trim (control bar in/out), Speed (0.1-50 fps),
  Reverse, Loop count (videoGif remap), GIF output (longest edge, colour limit, edge colour; rebuilds
  the `.gif` only). All call MPI-768's entry route with a new frame list or output settings: zero new
  frame files, no new route. Persistence pattern: `MpiToolOptionsGif` (`toolSettings`,
  `settings:tool:update`). Ownership: `MpiGroupHistoryBlock.js`, `MpiHistoryTools.js`, new
  `js/components/Organisms/MpiToolOptionsGifTiming/` (one panel reading `mode`, the maskAdjust
  pattern, or one per tool: the card's call), `js/shell/preloadStyles.js`, `js/components/types.js`,
  `tests/desktop/gif-timing.spec.js` (new), `docs/gif.md`. **Verify:** the spec applies each tool to
  a real GIF and checks the new entry's `.gif` with sharp metadata (frame count, every delay, loop;
  16 fps -> delay 6) and that the `Media/.gif-frames/` file count is unchanged;
  `npm run lint:components`.
- [ ] **MPI-773 (UI half) transform and export tools.** Crop (reuse `MpiToolOptionsCrop` if
  `MpiGifViewer` implements `setCropRatio` / `setCropRect`; confirm first against docs/crop.md),
  Resize, Save frame as image (current full-res frame -> image card, `_handleCropSnapshot` pattern
  :1760), GIF to Video (background colour field) -> video card. Ownership: `MpiGroupHistoryBlock.js`,
  `MpiHistoryTools.js`, `Organisms/MpiGifViewer/`, `Organisms/MpiToolOptionsCrop/` (only if it needs
  a kind-neutral hook), new tool panels under `js/components/Organisms/`, `js/shell/preloadStyles.js`,
  `js/components/types.js`, `tests/desktop/gif-transform.spec.js` (new), `docs/crop.md`,
  `docs/gif.md`. **Verify:** the spec runs three images -> Make GIF -> Crop 9:16 -> Speed 0.33 ->
  GIF to Video and gets a 1080x1920 30 fps MP4 card with poster and hover proxy, each image held
  about 3 s; Save frame gives a full-resolution image card; `npm run lint:components`.

Phase 4 verify mode: `auto`.

## Phase 5: GIF Maker UI

- [ ] **MPI-760 (UI half) Export GIF becomes GIF Maker.** Labels `Export GIF` -> `GIF Maker`
  (`MpiHistoryTools.js:180`, `TOOL_LABELS` :668), button `Export` -> `Apply`, KEEP mode and settings
  key `exportGif`. Apply calls `routes/gifMaker.js` with fps, trim (`_activeVideoTrim`) and size
  preset, then creates the new card (`_handleCropSnapshot` steps) and offers to open it. Preview
  stays. The `export` group question is the card's call. Ownership: `MpiGroupHistoryBlock.js`,
  `MpiHistoryTools.js`, `js/components/Organisms/MpiToolOptionsGif/`,
  `tests/desktop/gif-maker.spec.js` (new), `docs/gif.md`, `docs/video-player.md`. **Verify:** spec on
  a video card: the tool reads GIF Maker, Apply adds a GIF card to the gallery that opens in `gif`
  mode, the video card's history is unchanged, saved `toolSettings.exportGif` still load;
  `npm run lint:components`.

Phase 5 verify mode: `auto`.

## Plan Drift

- 2026-09-15: MPI-749 landed `done` before planning; MPI-759's `blocked` maturity is stale.
- 2026-09-15: brief corrections found by investigation: the context menu lives in
  `MpiGalleryGrid.js`, not `MpiGalleryBlock.js` (770 edits both); `MpiHistoryTools` is a Compound;
  the hotkey registry is `js/managers/hotkeyRegistry.js`; `operationRegistry.js` /
  `operation_registry.json` are not hand-edited (E8); `add-from-cards` must copy frames (E4).
- 2026-09-15: server halves of 771, 773 and 760 moved one batch earlier (disjoint files); the UI
  order is unchanged.

## Verification

**Verify mode:** user-ux

Per phase: 1 `auto`; 2 `user-ux` (MPI-769 strip); 3 `user-ux` (MPI-771 cut-out, local + RunPod);
4 `auto`; 5 `auto`.

End to end, before the umbrella closes:

- Three images -> Make GIF -> strip reorder + Update -> Cut-out -> Speed 0.33 fps -> GIF output with
  an edge colour -> Crop 9:16 -> GIF to Video: every step adds the expected entry or card, and the
  final MP4 frame pixels match the full-colour frames.
- Deleting every GIF card leaves `Media/.gif-frames/` empty; `Cleanup assets...` never touches it.
- A legacy `.gif` imported before this work is still on hover, plays on hover, and opens in `gif`
  mode with its frames extracted on first open.
- `node --test "tests/*.test.cjs"`, `npm run lint:components` and every new desktop spec green.

## Preservation Notes

- **Rule files need Fabio's permission** (CLAUDE.md rule 5): `.claude/rules/component-mounts.md`
  (new gif mounts, `exportGif` label), `component-events*.md` and `component-state.md` if wiring
  changes. Ask at close-out; the maps are refreshed with `mpic-update-component-map`.
- `docs/gif.md` is new: add it to `docs/README.md` and `.agents/mpi-kanban/project-knowledge-index.md`
  (a "GIF" topic) at close-out.
- The GIF delay proof and the investigator corrections live in `research/`; fold the durable parts
  into `docs/gif.md` when MPI-768 lands.
- Release: the new cut-out op needs `/mpi-version-bump` to write the registry pair and release notes.
- Later, not carded: animated WebP output for soft transparency; SAM3 masks beyond the cut-out;
  background removal on video (MPI-758 `validation.md`).
