# MPI-757 - GIF workspace: frames, cut-out, Make GIF, GIF Maker

Umbrella created 2026-09-14, redesigned in a brainstorm with Fabio on 2026-09-14/15. Every
decision below is his and is not re-opened in the member cards. Large plan written 2026-09-15 on top
of that design: it adds investigation, file ownership and parallel batches, and changes no decision.

**The member cards stay on the board.** This card carries no code. Each member closes when its
phase lands; this umbrella closes when the last one does, and its `validation.md` then records
the ordering and anything left behind.

## Current State

**2026-09-19 (session `5e86d76c`) — READ THIS FIRST.** MPI-771 is `doing`/`in-progress`.

**Both of Fabio's passes are BUILT.** The consistency audit shipped earlier today (findings 1,
3, 4, 5 built, 2 closed with no change, master red-then-green `756cf0e0` → `3efcdc9f`). His
SECOND pass — five more items — is now built too, under
[## Remaining Work](#remaining-work) → "Fabio's SECOND pass", each marked DONE with what it
cost.

**THE ONLY THING LEFT IS FABIO'S EYE PASS ON THE WHOLE WORKSPACE.** Nothing closes before it.
He has not yet looked at Cut-out's strip, the new `Mask Preview` section, the output preview,
Shift-select on the frame strip, or Space playing in Cut-out.

Four of the five carry a spec that was PROVEN RED on the pre-fix file before it was believed
(`gif-workspace.spec.js` → "gif second pass"); the fifth is panel order and is his to judge.

- **4** — the GIF stage joined the shared context menu (Save frame as image / Reverse frames /
  Clear all masks). PASSED by Fabio: *"Menus are good, and context looks good."*
- **3** — `gifReverse` and `gifSaveFrame`, the two rail buttons whose whole panel was a sentence
  and an Apply, are gone from the rail, the registry and both panels.
- **1** — Cut-out mounts the same canvas and the same `MpiMaskStrip` as the Mask Brush, so it has
  opacity / invert / B-W / clear at last. Fabio's rule held: masked = what disappears, so the
  canvas is fed the flipped bitmap through a display override. Detail under finding 1.
- **2** — *"I don't care about timing anymore. Leave it as it is."* Do not re-raise.
- **5** — the GIF output tool has the GIF Maker's preview pane, off a new `POST /gif/preview`
  that runs the same `buildGif()` Apply runs.

Also found and fixed on the way, by Fabio: **Space was bound twice** — `canvas.pan.start` and
`video.playPause` are two ids on one key and `hotkeyManager` buckets by `type:key`, so one press
both panned and played. Pre-existing in the Mask Brush; Cut-out inherited it by becoming a canvas
tool. The bar stands its play hotkey down while a canvas tool is up.

Owed: Fabio's eye pass on the whole workspace, Cut-out's strip in particular.

**Do not try to green `gif-timing.spec.js`, `gif-transform.spec.js` or `gif-cutout.spec.js` test
2** — all three are red at HEAD from a peer's frame-store bug, proven, message `922a3667`. See
`## Plan Drift`.

Shipped this session (committed at handoff):
- Mask and Clear span the panel (`__row--split`); the colour **Pick** button has an authored
  `eyedropper` icon.
- **Root cause, not a symptom fix:** `MpiButton` renders `label` ONLY in icon mode — its plain-text
  branch reads `text` — so Pick drew as an empty grey box. The icon is what puts it in the mode that
  renders the label. Swept all 230 `MpiButton` uses: it was the ONLY `label`-without-icon call site.
- **`MpiCheckbox` never rendered `data-info`**, so `info` was dropped for every checkbox in the app.
  Exactly one of 21 call sites passed it (the edges switch), so the primitive fix lights up one
  control. That switch is now labelled **Background only** with Fabio's own wording.
- **The mask colour REVERSED, by Fabio (2026-09-19), and he is right:** a GIF cut-out run WRITES the
  mask, so it is committed and wears white (new `--mask-fill` token). `--accent-ok` in the image
  canvas is the PENDING colour — a detect result waiting on Add/Subtract, or an Adjust preview
  waiting on Apply — and `MpiCanvas` recolours only those layers. `MpiFrameStrip`'s `--edited` dot and
  trim-range bars stay green: status marks, not masks. Rule rewritten in `docs/masking-sam3-gif.md`.

Two shared-tree hazards this session, both PEER-caused, both worth knowing:
- **`6da64611` (MPI-810/812) left `gif-cutout.spec.js` test 2 red** and it is not MPI-771's doing:
  restoring all eight of my files to HEAD reproduces it exactly. `POST /gif-cutout/apply` dies on
  `Input file is missing: <output>/projects/.../Media/.gif-frames/<hash>.png` while the run's own
  `projects/` dir is EMPTY — the `APP_DOCUMENTS` move and the frame store disagree. Message
  `077abd3b` filed. The other six gif specs pass.
- **That same commit swept this session's unfinished assertions onto master**, so master asserted the
  Pick icon before the icon existed. The block has since MOVED into test 1 (a render check belongs
  there, and it stays runnable while test 2 is blocked). Message `6be62b6a` filed. Also
  `styles/01_base.css` was committed wholesale by `15c236f0` (MPI-736) with this card's `--mask-fill`
  line inside it. Commit by pathspec on this tree; peers are not doing it.

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
- **2026-09-15 ~19:50Z: Batch 1 LANDED, NOT COMMITTED.** MPI-768 `done`. MPI-759 `doing/validating`:
  every automated check green, but the hover-tour VRAM number was NOT RUN (the MPI-633 rigs no longer
  exist); Fabio decides rebuild vs waive. The integrator fixed `tests/gallery-filter.test.cjs` drift.
  Evidence: each card's `validation.md`. `server.js` must be committed BY HUNK: MPI-774's uncommitted
  `agentRoutes` lines in it are not ours.
- **2026-09-16:** Batch 1 committed (2b246b47). MPI-759 `done`: Fabio waived the hover-tour VRAM
  number for v1; the real-world check is his 93-asset mascot GIF project after MPI-757 finishes.
- **2026-09-16 ~09:45Z: Batch 2 DONE and committed at handoff.** MPI-769 `done` (Fabio approved the strip
  in his app). MPI-770 `done`; after his check, Make GIF holds each still for 1 s. MPI-771 engine half
  verified live (30 real frames through the mounted routes gave 30 masks); the card stays `doing` for its UI
  half. Integration fixed `buildGif` (see drift), mounted both routes, registered `gifCutoutSam3`, and
  added `tests/desktop/gif-make.spec.js` (real app, no stubs). Evidence: each card's `validation.md`.
- **2026-09-16 ~09:50Z: Batch 3 dispatched** (session bfa79224): MPI-771 UI half, MPI-773 and MPI-760
  server halves (both moved todo -> doing, `files.json` lists both halves), plus a fourth worker for
  the reopened MPI-759 (Fabio: GIF cards do not play on hover in his app). `js/components/types.js` and
  `js/shell/preloadStyles.js` are under a live MPI-774 claim, so the MPI-771 worker does NOT edit them:
  the orchestrator adds those two registration hunks at integration and tells MPI-774.
- **2026-09-16 ~11:05Z: Batch 3 integrated, NOT COMMITTED.** All four halves landed and every automated
  check is green (evidence in each card's `validation.md`). The three routes are mounted in `server.js`.
  MPI-773 and MPI-760 stay `doing/in-progress` for their UI halves. MPI-771 and the reopened MPI-759 are
  `doing/validating` with attention: they need Fabio's eye check (MPI-771: mask a real mascot GIF by name
  on the local engine, then on RunPod with his go; MPI-759: hover a GIF card after a reload).
  **Landed at handoff after MPI-774 released its claim (was blocked):** the `MpiToolOptionsGifCutout` registration hunks, plus the PromptBox `gif` line and the `js/events.js` payload comment. History of the block: (a `preloadStyles.js`
  line; the typedef plus `setMaskTint`/`setMaskOverlay` lines in `types.js`, text in MPI-771's worker
  report and `validation.md`). `guard-claim` refuses both files while MPI-774's claim 4a387ed9 is live.
  Messages bb83d121 and 9aec0dd9 (the PromptBox `gif` line) are open to MPI-774. Commit Batch 3 by
  pathspec, `server.js` by hunk.
- **2026-09-16 ~11:30Z: Fabio's eye check, both FAILED/REDIRECTED. Batch 3 committed at handoff.**
  (a) MPI-759: after an app RESTART, previously made GIFs still do not play on hover in the gallery.
  They DO loop in the project (landing) cards and the history cards. So the `assetKinds` fix covered a
  real bug but not his case: his Make GIF cards carry `gif` in the sidecar, so they already classify as
  `gif`. The hover path itself fails for them in the real app while the spec passes. Root cause unknown.
  (b) MPI-771 cut-out: Fabio redirected the design (Decision 14 below). His screenshots also show
  cut-out entries listing `?×?` dimensions (no `pixelDimensions` on the `/gif-cutout/apply` item), a
  black `gif_003` thumbnail, and a mask with holes where the woman and the dog overlap.
- **2026-09-16 ~12:20Z (session cc23c073): MPI-759 fixed again, NOT COMMITTED.** The hover `<img>` carries
  the poster's `mpi-group-card__thumb` class, so the poster's "hide until loaded" rule held it at opacity 0;
  proven on a copy of Fabio's real card (1 distinct frame -> 2). One CSS selector + an opacity assertion
  (red first). Also `/gif/entry` and `/gif-cutout/apply` stamped `pixelDimensions {0,0}` (the `?×?`):
  both read the first frame now (`frameDimensions`). Evidence: MPI-759 and MPI-771 `validation.md`.
  Waiting on Fabio's reload + hover. Decision 14 details agreed; Phase 3b below is the build.
- **2026-09-16 ~12:55Z: Phase 3b BUILT, NOT COMMITTED, all automated checks green** (MPI-771 `validation.md`).
  Waiting on Fabio's user-ux check in his app (Ctrl+R picks the code up). Then: RunPod check with his go,
  land the `types.js` hunk when MPI-737 releases it, ask about `.claude/rules/` component maps at close-out,
  then Phase 4.
- **2026-09-16 ~13:10Z: Fabio's check (after Ctrl+R only, NOT a restart).** MPI-759: hover PLAYS in his
  app — confirmed, close it at close-out. MPI-771: works but the experience "wasn't that great". To fix
  next, root cause first (his screenshots: `GIF Tests` project, `imported_015`, 30 frames 320x320):
  1. **BUG — trim bar collapsed + staged frame changes.** Sequence: Track Single Frame, then Track All
     ("logo"), then Mask Brush: the control bar's trim range shrank to ~4-5 frames, play did nothing, and
     the strip pill showed "8 frame changes" he never meant to make. Suspect a hotkey/pointer path in
     brush mode staging strip deletes or moving trim handles (the canvas and the strip/control bar share
     keys and drags). A staged change also EMPTIES every mask (`gifFrameMasks.sync`), which may be why
     his fixes vanished. **Likely source of the "8 frame changes" (Fabio, follow-up):** he click-dragged
     the strip, as users will, which REORDERS frames (staged); his cursor then hit the pill's Update, which
     rewrote the entry and dropped every mask. Decide: strip drag should scrub, not reorder, at least while
     a mask tool is up; and a save that would discard masks must not be one stray click.
  2. **UX — no Apply where he expected one.** In Mask Brush he pressed the strip pill's APPLY and got
     gif_005 = the same frames, no mask (that pill saves the staged frame list). Only Cut-out's "Cut out"
     bakes masks. Make the commit obvious from the brush (e.g. a Cut out action there) and keep the
     strip pill from reading as the mask's Apply.
  3. **Move the strip's Update/Apply pill up** — it covers the right end of the strip.
  4. **Cut-out mode: the frame should FILL the stage** (a 320px GIF shows tiny; `MpiGifViewer`'s img only
     shrinks). Zoom already works in Mask Brush (MpiCanvas); Cut-out needs fit, not zoom.
  5. **Play/Pause is blocked in Mask Brush** (deliberate: playing would reload the canvas every frame);
     step works. Fabio was unsure — decide with him (e.g. play the frames with the mask overlay, no canvas).
  6. gif_005 lists `?×?`: `routes/gif.js`'s dims fix is SERVER code, which Ctrl+R does not reload. An app
     restart is needed for route changes; tell him, then re-check.
- **2026-09-16 ~15:10Z (session d58ac006): all six findings FIXED, NOT COMMITTED, automated checks
  green** (MPI-771 `validation.md`). Fabio's calls: 1a (drag scrubs; hold 300 ms then drag
  reorders; Discard; masks follow their frames), 2b (a note in the GIF Mask Brush, no second Cut
  out), 3a (Play in the Mask Brush plays frames under the tint). The trim collapse was
  `attachViewer()` running before frames loaded, not the brush. **Next:** Fabio re-checks after a
  FULL app restart (local engine), then RunPod with his go; `types.js` hunk still waits on
  MPI-737's claim (`tasks/MPI-771/types-hunk.md`). Same session dispatched MPI-656 Phase 1 (board
  batch, Fabio "dispatch minus 715"); MPI-558 and MPI-560 Phase 1 were found already landed.
- **2026-09-17 (Fabio's second check, session d58ac006): scrub works; FOUR new issues, nothing fixed yet.**
  1. **Hold-drag shows a "copy" and the thumb runs AHEAD of the mouse.** Two suspects, verify both
     with a REAL-mouse Electron probe (hold 400 ms, move slowly), not synthetic events:
     (a) math: `MpiFrameStrip._onMove` reorders at half a slot (`Math.round(dx/SLOT)`) but moves the
     thumb a FULL slot and then resets `_drag.startX`, so the thumb travels ~2x the mouse. Fix:
     keep the lift point, `target = liftIndex + round(totalDx / SLOT)`.
     (b) the "copy" reads like Chromium's NATIVE drag ghost: during native DnD no mousemove/mouseup
     fire, so `_drag` can stay stuck in `thumb` mode and every later mouse move keeps reordering.
     `mousedown` never calls `preventDefault()` and nothing cancels `dragstart`.
  2. **Discard stuck at "18 frame changes"** (worked once, not the second time). Fits 1b: a stuck
     `_drag` re-stages on the next mouse move/up right after Discard. Add a `dragstart`
     preventDefault + reset `_drag` on `dragend`/`blur`, then re-test Discard.
  3. **Discard did not remove two brushed masks.** By design Discard only reverts FRAME changes;
     ask Fabio whether he expects it to revert masks too (masks have Clear + Ctrl+Z per frame).
  4. **GIF preview button does nothing while the Mask Brush is up** (`setPreview` refuses in edit):
     disable the control bar's preview button while the viewer is editing (Fabio's call).
  Nothing else changed since the 15:10Z bullet; all of it is still NOT COMMITTED until this handoff.
- **2026-09-17 ~09:40Z (session 93c7703f): 1 and 2 REPRODUCED, root causes proven, no code changed yet.**
  Probe: isolated Electron, CDP mouse (`window.mouse`), 30 frames; scripts in that session's scratchpad `probe/`.
  (a) Math: a 140 px hold-drag (2 slots) moved the thumb 4 slots; its centre sat 140 px AHEAD of the cursor.
  (b) Native drag: a scrub that STARTS in empty track begins a text selection (`selectstart` on the track).
  When the selection spans the strip (scrub dragged up into the viewer, or Ctrl+A), a hold-drag fires
  `dragstart` on the thumb (the "copy" ghost). Then only `dragend` arrives, never `mouseup`, so `_drag`
  stays in `thumb` (the lift stays painted) and hovering with no button keeps reordering (2 -> 6 changes
  before the Discard click). Cause: the strip never owns its press. Fix: `pointerdown` + `preventDefault` +
  pointer capture on the track + `pointercancel` (MpiTrimBar's idiom), blur the focused input (hotkeys skip
  while typing), reorder by `liftIndex + round(totalDx / SLOT)`. Specs move to real `window.mouse` input:
  the synthetic MouseEvents in gif-workspace.spec.js could never start a native drag.
- **2026-09-17 ~09:50Z (session 93c7703f): 1, 2 and 4 FIXED as above, NOT COMMITTED, automated checks
  green** (MPI-771 `validation.md`: specs 5/5, 5 bites red, regression 14/14, node 1267/0, lint clean).
  Item 3: Fabio chose **a**, Discard stays frames-only (documented in `docs/video-player.md`). Fix 4: the
  viewer emits `'edit-change'`, the control bar disables its preview button. Also fixed a race in
  gif-workspace.spec.js (read the card count before the stubbed save rendered). **Fabio VERIFIED the
  local check ("1").** Left on MPI-771: RunPod with his go; the `types.js` hunk (MPI-737 in doing, file
  dirty). At close-out ask about `.claude/rules/`: the new `'edit-change'` event is component wiring.
  **Next for the umbrella:** Phase 4 (MPI-772, then MPI-773 UI half), then Phase 5 (MPI-760 UI half).
  Still to ask Fabio: close member card MPI-524 on commit 2ce60ea5 (MPI-558 Phase 1 already done).
- **2026-09-17 ~10:56Z (session 9b06fc0e): MPI-772 BUILT and auto-verified, NOT COMMITTED.** Fabio: "go",
  closed MPI-524 (done on 2ce60ea5), and gave a standing go to rent a Pod for MPI-771's RunPod check.
  One panel `MpiToolOptionsGifTiming` (5 modes) + `gifTiming.js`; every Apply -> `_saveGifEntry('new')`.
  Evidence: MPI-772 `validation.md` (node 4/4, GIF desktop set 11/11, bite red, lint, node suite).
  MPI-772 is `doing/validating` only for two registration hunks on peer-claimed files (`types.js`:
  MPI-532 + MPI-774; `preloadStyles.js`: MPI-774 claim 91f0ea6b, message c772b0a1): text in
  `tasks/MPI-772/types-hunk.md`. Also fixed an MPI-771 bug found on the way: the strip pill was ALWAYS
  visible (`display:flex` beat `[hidden]`); MPI-771 `validation.md`. **Next:** MPI-773 UI half, then the
  MPI-771 RunPod check (go given), then Phase 5.
- **2026-09-17 ~11:22Z (session 9b06fc0e): MPI-773 UI half BUILT and auto-verified, NOT COMMITTED. Phase 4
  done.** Crop = `MpiToolOptionsCrop` over a new crop kind in `MpiGifViewer` (+ `MpiCanvas.setCropRect`),
  Resize / Save frame / GIF to Video = new `MpiToolOptionsGifTransform`; `/gif/crop` takes `outW/outH`.
  Block: one `_postGifEntry` lands every GIF result; a GIF opens with NO tool. Fixed on the way: a video
  Snapshot made TWO cards since MPI-723 (addGroup + `media:imported`). Evidence: MPI-773 `validation.md`.
  MPI-772 and MPI-773 are both `doing/validating` only for parked `types.js` / `preloadStyles.js` hunks
  (each card's `types-hunk.md`). `preloadStyles.js`: this session and MPI-774 had BOTH claimed it and each
  waited on the other (message 550b11f3); released to MPI-774 at 11:03Z, reply a550e772 asks it to add
  the three lines. **Next:** MPI-771 RunPod check (Fabio's standing go, 2026-09-17), then Phase 5
  (MPI-760 UI half). Commit Phase 4 at handoff/close-out by pathspec.
- **2026-09-17 ~12:40Z (session 14adfdd8): RunPod check PASSED, Phase 5 BUILT and auto-verified, NOT
  COMMITTED. Every phase is now built.** Phase 4 was committed in f372b7f4; MPI-774's 88cfe347 carried the
  two GIF `preloadStyles.js` lines, so only `types.js` hunks remain (MPI-771/772/773/760 `types-hunk.md`,
  MPI-774 claim 91f0ea6b, message 7a760e11). RunPod: Fabio's own app, RTX 2000 Ada, "logo" tracked and
  cut on the Pod (proof = the Pod's container log serving the temp mask PNGs; `app.log` cannot prove
  remote: `[comfy]` is the LOCAL engine and every instance shares that log). MPI-760: GIF Maker label,
  Apply -> `/gif/maker` -> new GIF card (MPI-760 `validation.md`). Found in Fabio's screenshot and fixed:
  the header ENTRIES count never refetched after a GIF tool Apply (nor video crop/reverse, combine,
  crop/paint/place): `_persistGroup` now emits `history:stats-dirty` when the history's files change.
  Pod `avb48jl48yrzgy` DELETED (Fabio confirmed ~12:45Z). **Fabio's call (2026-09-17): close-out waits
  for HIS OWN UI pass over the whole GIF workspace** (what works, what does not); fix what he finds first.
  **Next:** Fabio's UI pass (give him a plain do-X/see-Y list from § Verification's end-to-end steps +
  GIF Maker + the header count); land the four `types.js` hunks once MPI-774 releases the file (its
  claim a4c0f2d7 re-listed it, message 7a760e11 re-addressed to session 047d6088); then close-out
  (ask Fabio about `.claude/rules/` maps).
- **2026-09-17 ~14:00Z (session c01e2406): Fabio's UI pass found the cut-out results unusable. Root
  causes proven on his `test` project (GIF Tests), no code yet.** (a) `/gif-cutout/apply` builds with
  the SOURCE entry's `output` (`edgeColour: null` = opaque), so every cut pixel was flattened to black;
  gif_009's SAM3 robot mask was actually clean (77% transparent, rebuilt transparent in scratch). (b) He
  applied Transparent to gif_010, whose mask kept 99% of the frame. (c) Prompt "Background" + no Invert
  keeps the background; SAM3's background mask stops short of the frame edge (the dashed border; the
  source has no dark border). (d) `Number(null)` stores `colours: 0` (gif.js, gifCutout.js,
  gifTransform.js). Fabio's calls: **Decision 15** below (BiRefNet + By colour), By colour also in
  the IMAGE mask tools, bench on 8188 may be used for the raw->API sync. Build tracked on MPI-771
  (checklist). `js/services/commandExecutor.js` (the runner) is under MPI-774's claim a4c0f2d7:
  message 4463a29e asks for the two-part hunk or a release.
- **2026-09-17 ~14:00Z (session c01e2406): GIF half BUILT, NOT COMMITTED, automated checks green except
  the one step the runner blocks** (MPI-771 `validation.md`). BiRefNet graph proven on the bench (30 masks,
  16 s). By colour default tolerance 16 measured on Fabio's frames. Image-workspace By colour dispatched to
  a frontend worker (owns MpiCanvasViewer/, MpiToolOptionsMaskColour/, MpiHistoryTools.js,
  MpiMaskDetectRow/, tests/desktop/mask-colour.spec.js, docs/masking-tools.md); its new component's
  `preloadStyles.js` / `types.js` lines get parked like the others. MPI-774 = Desktop tab "Agent 9".
  **Next:** land the runner hunk (or get it landed), re-run `gif-cutout.spec.js` to 4/4, integrate the
  worker, then give Fabio the do-X/see-Y list (full app restart: server routes changed).
- **2026-09-17 ~15:00Z (session c01e2406): ALL BUILT AND AUTO-VERIFIED, NOT COMMITTED.** Runner hunk
  landed here after MPI-774's claim went complete; gif-cutout spec 4/4; image By colour integrated (the
  worker's first spec bypassed the UI; Block registration + a null-colour crash fixed on review; real-UI
  spec 1/1). MPI-771 `doing/validating`, attention: Fabio's app check after a FULL restart. Node suite
  6 red = MPI-800's in-flight path-loader sweeps (message d71d7044 asks it to migrate the new graph).
  **Next:** Fabio's check; then the whole-workspace UI list from the 12:54Z handoff; types.js /
  preloadStyles lines when free; close-out asks about `.claude/rules/` (new `maskColour` tool, panel
  `settings` payload, `history:stats-dirty` emit).
- **2026-09-17 ~15:40Z: Fabio's app check (after restart).** By colour WORKS. Remove background FAILED:
  modal "Cut-out failed: [ComfyUIController] Media staging failed for Input_Video: HTTP 404" (app.log
  15:36:12Z `[comfy] gif cutout track workflow failed`). Unproven lead: MPI-800 (session 0d43f404, in
  flight, uncommitted) is rewriting media staging (`routes/comfy.js`, `comfyController.js`: stage into the
  engine input/ folder, MpiNodes 1.2.16 Upload loaders) and Fabio just updated MpiNodes, so the temp
  `Media/.gif-cutout-tmp/*.mkv` path may no longer be stageable; SAM3 (same path) likely fails too. Root
  cause first: read the staging route that 404s and MPI-800's plan before touching anything; message
  d71d7044 already told MPI-800 about the new graph. Fabio asked why "video": the frames are encoded to
  one temp lossless video (E7) so the tracker gets one frame per GIF frame. Also: Fabio loved the colour
  picker and asked for card **MPI-801** (Alt-held colour picker in the image Paint tools), created `todo/idea`.
- **2026-09-18 ~10:4xZ (session 813f42f5): the 404 was a STALE SERVER, not a bug — and Fabio's next
  pass found three more.** Root cause of `Media staging failed for Input_Video: HTTP 404`: the error
  text was literally `HTTP 404`, so the body was not JSON. A harness mounting HEAD's `routes/comfy.js`
  proved the three shapes — missing file -> 404 **JSON** `media not found: <path>`; real file -> 200
  staged into `input/mpi_staged/`; unknown route -> 404 **HTML**, the only shape that prints `HTTP 404`.
  So the running main process predated MPI-800's `ee034559` while the renderer (served from the tree)
  already had `_stageLocalMedia`. MPI-800 said the same in message `bccdc4e6`; verified, not trusted.
  Fabio's app booted 17/09 20:49 local, after `ee034559` and the graph migration `b9f1d756`, so no
  restart was needed — and he confirmed Background AND By name now work (sidecar `gif_016`,
  `method: birefnet`, 2026-09-18T10:01:13Z). **SAM3 hits the identical path** (both graphs are
  `MpiLoadVideoUpload` titled `Input_Video`); both were broken, both fixed by the restart.
- **2026-09-18 (same session): three By-colour defects found and FIXED, not committed.** Measured on
  a real frame of his `gif_016` (320x320, **77.7% transparent**, corner `#c8c6c8` at **alpha 0**):
  1. `cornerColour()` read RGB and ignored alpha, so an already-cut clip defaulted to the colour the
     OLD mask hid — invisible on screen, and at tol 16/32/64 it keyed 536/985/4786 px of the bot's
     dark outline. Now returns null; no default, the run says "Pick the colour to remove first".
  2. `keepMask` keys every alpha-0 pixel out, so on a cut clip the KEEP side is the whole subject at
     every tolerance — which is why "it kept selecting the whole bot" and the slider looked dead. By
     colour now tints what it REMOVES; `#tint-note` states the tinted side per method (Fabio picked
     this over a bare label, knowing it makes the three methods differ on purpose).
  3. "Cleared it with the brush, then it would not mask again": the brush writes a full-frame
     `subtract` that survives every re-mask BY DESIGN (his 2026-09-16 call), so it ate each new mask.
     Added `GifFrameMasks.clear()/clearAll()` + `viewer.clearFrameMasks()` + **Clear This Frame** /
     **Clear All** (they also wipe the live canvas when that frame is open in the brush).
  Also: docs/masking-sam3-gif.md `MpiLoadVideo` -> `MpiLoadVideoUpload` (message `2c3de183`), and the
  image tools' null-colour paths guarded. Green: lint clean; `node --test` colour-key + gif-frame-masks
  + gif-cutout + mask-colour + mask-tool-registry **63/63**; desktop `gif-cutout` + `mask-colour` **5/5**.
  **Unresolved, needs his eyes:** he reported the Background tint covering the BACKGROUND while the cut
  kept the robot. Code says tint = luma of the mask = what stays, and both graphs emit a foreground
  mask, so that combination should be impossible — not reproducible here, no fix invented. One
  screenshot of the tint right after Background finishes settles it.
  **Next:** Fabio re-checks By colour + Clear + the tint note, then the whole-workspace UI list.
- **2026-09-18 ~11:3xZ (session 813f42f5): Fabio's second pass — 3 more fixed, 5 OPEN.** He confirmed
  Remove background, By name, Clear This Frame / Clear All and the tint note all work.
  **Fixed here (uncommitted at the time of writing):**
  - *"By colour does nothing on an opaque GIF"* — `_scheduleRekey()` returned early while
    `_lastScope` was null, so picking a colour and dragging Tolerance to 81 changed nothing and
    read as a dead slider. It now says **"Press Mask All or Mask This Frame to apply this colour"**
    after the same 250 ms pause, and the picker + Tolerance `info` say it too. His call: the hint,
    NOT an auto-run.
  - *"Mask one frame, Cut out, get an empty GIF"* — `getCutMasks()` handed every unmasked frame a
    1x1 BLACK PNG ("nothing kept"), so the untouched frames came back fully transparent. Now WHITE:
    an untouched frame comes through unchanged.
  - *"No way to delete a frame in the strip, Backspace does nothing"* — it needs a SELECTION
    (Ctrl-click), which nothing on screen says. Each thumb now carries `data-info`, so the status
    bar spells out click / drag / hold-drag / Ctrl-click + Backspace on hover.
  **Still OPEN, in his priority order:**
  1. **Context menu on a strip thumbnail** — right-click -> Delete frame / Clear this frame's mask.
     `MpiContextMenu.show({x, y, items, onSelect})` already exists (`Compounds/MpiContextMenu`).
     He asked for BOTH this and the hover info; only the hover info landed.
  2. **Trim reads as useless.** After Apply the preview and Play still show every frame, and the
     selected range is only legible as numbers. `_handleGifTimingApply` DOES trim into a new entry
     and toasts "Move the trim handles in the control bar first" when the range is untouched, so the
     likely truth is he never saw the range. Needs the in/out range drawn ON the strip.
  3. **Gallery hover-play with several history entries** — his screenshot shows the first frame
     apparently sitting behind the playing one (an `imported_015` card with a second image showing
     through). Not investigated at all.
  4. **A status-bar `info` pass over every GIF control** — he wants each one to say what it does.
     `[data-info]` is the channel (`js/shell/statusBar.js` hover delegation).
  5. Still unexplained from his first pass: the Background tint appearing over the BACKGROUND while
     the cut kept the robot. One screenshot of the tint settles it.
  **Answered for him, no code:** *edge colour* = GIF alpha is 1-bit, so a soft edge's partial alpha
  must become fully on or off; `edgeColour` is the colour those edge pixels blend into first, which
  is how you kill the halo (set it to the background the GIF will sit on). `edgeColour: null` = an
  opaque build. *Apply* on any GIF timing/output tool = `_saveGifEntry('new', ...)`, i.e. a NEW
  entry every time — which is why his entry list grew.
  Green for this step: lint clean; `node --test` colour-key + gif-frame-masks + gif-cutout **19/19**;
  desktop `gif-cutout` **4/4**.
  **Next:** the 5 open items above, in that order.
- **2026-09-18 ~13:2xZ (session 78c4c827): four of the five open items DONE, one is his call.**
  Uncommitted at the time of writing. Green: lint clean; `npm test` **1344 pass / 0 fail / 1 skip**;
  desktop `gif-workspace` (2, one NEW), `gif-cutout` (2), `gif-timing`, `gif-make`, `gif-maker`,
  `gif-transform`, `gif-maker`, `mask-colour`, `history-modes`, `gallery-gif-hover` — **11 specs green**.
  1. **Strip context menu LANDED.** Right-click a thumb -> **Delete frame** / **Clear this frame's
     mask**. An Organism may import a Compound (4-tier rule), so it calls `MpiContextMenu.show()`
     directly — the shell's `ui:context-menu` hop exists only for same-tier callers. Right-clicking
     inside a Ctrl-click selection acts on the whole selection ("Delete 3 frames"); anywhere else on
     that one frame. Delete shares `_deleteIndices()` with the Backspace hotkey, so both stage the
     same edit and the >=1-frame floor holds; it greys out when it would empty the strip. Clear greys
     out with no mask on the frame. It emits `clear-frame-mask { index, viewerIndex }` — masks are
     keyed by the VIEWER's position, which diverges from the staged index after a reorder.
  2. **Trim is legible.** `frameStrip.el.setRange()` paints the control bar's handles ON the strip:
     frames Apply would DROP are dimmed + greyscaled, an edge bar sits at in and at out (so a full
     range still shows the handles instead of nothing). The Block feeds it from the same
     `range-change` the panel note reads, and re-applies after `setFrames`/`commit` — `setFrameCount`
     fires its `range-change` while the strip still holds the PREVIOUS list, so the first paint was
     clamped to the old length. **Why he "saw every frame after Apply": he never moved the handles.**
     Traced, not guessed — `timingEdit('trim')` slices correctly, and with an untouched range Apply
     ALWAYS refuses with the toast, so it can never silently write an untrimmed entry (`gif-timing`
     proves a real 1..3-of-6 trim gives a 3-page GIF). The note now says **"All N frames are selected
     — drag the handles"** up front instead of "Keeps frames 0 to N-1", which read as if it would trim.
  3. **Gallery hover artefact ROOT-CAUSED and fixed.** Proven in a static harness over the REAL
     stylesheets (scratchpad `gifart/`, before/after screenshots): the GIF hover overlay inherits the
     VIDEO overlay's `object-fit: cover` while the poster under it is `contain`, and the poster is
     never hidden. A video overlay is opaque so that is free; a **cut-out GIF is transparent**, so the
     poster showed through its holes at a different scale — the "first frame behind the playing one".
     Fix is CSS only in `MpiGalleryGrid.css`: `--gif` overlay -> `contain`, and
     `.mpi-group-card__media:has(> .--gif.--hover-video-ready) > .--loaded { opacity: 0 }`. Dropping
     the overlay un-matches the `:has()`, so there is nothing to undo on demote (`:has()` is already
     a 53-use idiom here). **NOTE: his card was `imported_015` — if that GIF is OPAQUE this fix does
     not explain his screenshot and it needs another look.**
  4. **`[data-info]` pass done, with ONE thing left to him.** Gaps found and filled: the control bar's
     **trim handles had no info at all** (the very control he could not read) and nor did the frame
     counter. Everything else was already covered — every GifTiming / GifTransform / GifCutout /
     Gif field and button, the strip pill, play/step/preview. **Left to him:** the tool RAIL. Its
     `info` is the floating TOOLTIP text as well as the status bar's, so a sentence there hangs a
     paragraph off a 24px icon, and every rail in the app (image, video, gif) is a bare name. I wrote
     the sentences, saw they broke 3 specs that select rail buttons by `[data-info="Trim"]`, and
     REVERTED rather than impose a look on his UI. A split (`data-tip` short for the tooltip,
     `data-info` long for the status bar) is ~3 lines + 4 spec selectors if he wants it.
  5. **Background tint polarity: still unexplained, still needs his screenshot.** Nothing invented.
  Also landed: the parked `types-hunk.md` registration lines, now that MPI-774's claim no longer
  covers them — `MpiToolOptionsMaskColour.css` in `preloadStyles.js`, a new `MpiToolOptionsMaskColourProps`
  typedef, and `MpiFrameStrip` / `MpiGifViewer` / `MpiToolOptionsGifCutout` typedefs rewritten against
  the code AS IT IS (not the 2026-09-16 hunk text, which predates BiRefNet, By colour and Clear).
  `types-hunk.md` deleted. Docs: `docs/gif.md` (strip gestures + the Trim contract), `docs/gallery.md`
  (the hover pair).
- **2026-09-18 ~13:5xZ: Fabio's pass — 3 of 4 PASS, Backspace is a REAL open bug.** His words: context
  menu works, Trim works ("I like the green indicators"), multi-entry gallery cards no longer display
  incorrectly. **"Backspace still doesn't delete an item."** So the previous session's read — that it
  was only undiscoverable — was WRONG; it is broken for him, and the context menu is now the only
  working delete. **What has been ELIMINATED (probe source: session scratchpad
  `backspace-probe.js`, run as a throwaway `tests/desktop/zz-backspace-probe.spec.js`, deleted after —
  do NOT look for it in the tree):**
  - A REAL `keyboard.press('Backspace')` (not the synthetic `dispatchEvent` every existing spec uses)
    DOES delete a Ctrl-clicked frame in a clean workspace: 5 thumbs -> 4.
  - It still works with a TOOL PANEL open (Speed): 4 -> 3, `activeElement` `BODY.page-group-history`.
  - The keydown reaches window un-prevented; `gif.frame.delete` is `backspace`/DOWN with no `when`
    gate; the `isTyping` block only bites for a textarea / contenteditable / text input, and the
    strip's own `pointerdown` calls `document.activeElement.blur()` before selecting anyway.
  So the mechanism is sound and the fault is CONDITIONAL on something his session has and the fixture
  does not. **Next session: bisect it with him in ONE question before touching code — when he
  Ctrl-clicks a thumb, does it get the orange selection ring?** Ring = the hotkey path; no ring = the
  Ctrl-click/selection path (and the two need completely different fixes). Worth checking against his
  real GIF: a long strip where the thumb is OUTSIDE the rendered window (`VIEW_RADIUS` 40), a second
  live MpiFrameStrip from a previous mount still bound to the hotkey, or a keyboard layout / IME
  sending something other than `Backspace`. Read the live `app.log` and have him reload rather than
  guessing again.
  **Next:** the Backspace bug (above), his answer on the rail `data-tip` split, his tint screenshot.
- **2026-09-18 ~14:5xZ (session b3d5499a): all four open items CLOSED in code, NOT COMMITTED, every
  automated check green** (MPI-771 `validation.md` has the full record).
  1. **Backspace ROOT-CAUSED.** Fabio confirmed the orange ring, so selection was never at fault.
     `hotkeyManager._normalizeKey()` prepends held modifiers, so Backspace-with-Ctrl-still-down is
     `control+backspace`; the registry had only bare `backspace`, and `_handle` returns at the
     handlers lookup before any gate or handler. Selecting REQUIRES holding Ctrl, so the documented
     gesture was the one that could not work — and every earlier elimination passed because each
     pressed Backspace alone. Fix: three ids (bare / `.ctrl` / `.shift`, the `uiZoom.in.plus`/`.equal`
     idiom) bound to one `_deleteSelection`. hotkeyManager is UNCHANGED — normalising modifiers is
     right for every other binding. The spec press now carries `ctrlKey: true` and was proven RED on
     the pre-fix files (restored from HEAD by copy, never `git stash` — shared tree).
  2. **Rail descriptions: Fabio said yes, on the status bar, no floating tooltips.** The two channels
     are the REVERSE of the earlier session's assumption: the rail's own `mouseover` tooltip reads the
     `.mpi-history-tools__btn` WRAP, while statusBar.js resolves `closest('[data-info]')` and finds the
     inner MpiButton first, never reaching the wrap. So the sentence goes on MpiButton `info` and the
     name stays on the wrap. Every existing spec selector targets the wrap by name and still matches —
     the "3 specs break" note was about the other assignment.
  3. **ONE tint rule: THE TINT IS WHAT GOES**, all three methods (`flip = !_invert`), and the
     per-method `#tint-note` badge is deleted. Fabio: "it is a cutout, so anything that is masked
     should go away". The mask stays white=KEEP internally (`applyMaskAlpha` writes it into alpha),
     so only the display flipped — no server, sidecar or brush change.
  4. **The Background-tint mystery is CLOSED, no screenshot needed.** Never a polarity bug: under the
     old "tinted = what stays" rule, Background + Invert ON tints the background AND keeps it, and
     Fabio read the tint the natural way. Rule 3 makes that reading correct.
  Also: the strip thumb's `[data-info]` never mentioned Ctrl-click (the context-menu rewrite dropped
  it), which is why he never found the gesture — it now names Ctrl-click and Backspace.
  **NOT automated:** the tint POLARITY has no assertion; the specs check a tint is present, not which
  side it covers. Deliberate, and stated in `validation.md`.
- **2026-09-18 ~15:4xZ (same session): scope consolidation + the toast, NOT COMMITTED, all checks
  green.** Fabio, on seeing the four buttons: two verbs (**Mask**, **Clear**) and an All / Frame /
  **Selected** `MpiRadioGroup`, so Selected exists without a fifth and sixth button. Selected is the
  strip's Ctrl-click set: the strip gained `selection-change { indices, viewerIndices }` +
  `el.getSelection()`, the Block forwards to the panel's `el.setSelection()` and seeds it at mount.
  VIEWER positions, since masks are keyed by the viewer's order. `_runTrack` takes `all` /
  `{idx,hash}` / `{list}` and a narrower scope lands frame by frame, because `setTrackMasks`
  replaces the whole list. The re-key TOAST is deleted (it fired on every paused slider drag); the
  picker and Tolerance `info` lines carry it instead. **Found while building:** MpiRadioGroup paints
  `is-active` before the owner can refuse, so a busy-refused scope click left the button and
  `_scope` disagreeing — the scope radio locks with the method radio now. The new spec caught it.
  **Investigated, NOT built — needs Fabio's scope call:** he asked for the image workspace's mask
  display controls here. The GIF Mask Brush ALREADY mounts `MpiMaskStrip` (invert, B/W view,
  opacity, clear) and `MpiGifViewer` implements all of it. The gap is only the CUT-OUT TINT, a
  read-only preview overlay at a fixed `--accent-heat` 0.45 with no controls.
- **2026-09-18 ~16:1xZ (same session): the mask is ONE COLOUR everywhere now, NOT COMMITTED.**
  Fabio: *"why is one pink and the other one black or white? I am saying why for the USER."* The
  answer was in `MpiCanvas`: `MASK_AUTO_FILL` (= `--accent-ok`) is what the IMAGE canvas paints a
  mask that came from a DETECT RUN — hand-painted is white, inverted black, B/W view white-on-black.
  A SAM3 / BiRefNet / colour-key mask is that same concept, so both tint surfaces (viewer stage +
  every strip thumbnail) moved to `--accent-ok` at 0.7, MpiMaskStrip's own default. CSS + one doc
  line; no logic. Both `MpiRadioGroup` pickers also span the panel at MpiButton `sm` padding, scoped
  through a `__picker` class rather than the shared primitive. **Still NOT full parity and it is
  structural:** the strip's B/W view / invert / opacity drive `MpiCanvas`, and outside the Mask
  Brush there IS no canvas — the Cut-out preview is a CSS overlay on an `<img>`. Fabio's call.
  **Next:** Fabio's eye pass; his call on the tint controls; then push (master's CI is red on one
  unrelated agent-chat test, `.husky/pre-push` refuses while it is); the three parked `types.js`
  hunks for MPI-760/772/773 are now landable — `types.js` carries no claim; then close-out (ask
  about `.claude/rules/` maps: the new `selection-change` event and `setSelection` are wiring).
- **Next action (superseded, kept for the record):** MPI-759 root cause in the real app first (he can reload for you; read
  `%APPDATA%\Cubric Vision\logs\app.log` filtered, never drive `:3000`). Then redesign the MPI-771 UI half
  per Decision 14 (plan it with Fabio before coding: it needs a per-frame mask layer and brush). Phase 4
  waits until the cut-out design settles.

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
| 14 | (2026-09-16, after the first cut-out eye check) Cut-out gets a different system. Drop the count input (the 0-3 object chips replace it). Object numbers may not stay the same object from frame to frame, so a track is not the final mask. Offer **Track All** and **Track Single Frame**; the user then steps frame to frame and fixes the mask with a **mask brush** (a separate tool), e.g. where the woman and the dog overlap. Agreed details (chat, same day): each frame's mask is two layers, the track underneath and brush add/erase on top; a re-track replaces only the track, brush fixes survive; the brush also works with no track (paint a mask from scratch); edited frames get a strip marker; Mask Adjust stays one setting for all frames; Ctrl+Z as in image masking. |
| 15 | (2026-09-17, after his UI pass; **reverses the "No BiRefNet" half of 11**) Cut-out gets three mask methods feeding the same track layer: **Remove background** (BiRefNet, the shipped `birefnet` engine asset, default), **By name** (SAM3), **By colour** (key colour, tolerance, only-touching-edges; no GPU). By colour also lands in the image mask tools. Cut out always saves a transparent GIF. |

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

### 2026-09-19 (late) — Fabio's SECOND pass on the finished workspace. ALL FIVE ARE BUILT.

He passed the context menus ("Menus are good, and context looks good") and closed Timing. These
five came after. Every one was already root-caused in code when written, and every one is now
built — session `5e86d76c`, 2026-09-19. Each carries what it actually cost below.

**Proof:** a new `gif-workspace.spec.js` test, "gif second pass", covers 1, 2, 4 and 5, and each
of those four was PROVEN RED first by putting just its own file back to `HEAD` and watching that
assertion fail (`swap.py`, one file at a time — reverting the frame strip alone kills item 1 at
`['3']`, the mask strip + projectService kills item 2, the control bar kills item 5, and a
surgical revert of `_setTint`'s body alone kills item 4). Item 3 is panel order and has no
assertion worth writing; it is Fabio's to look at.

**One spec had to change, not just be added:** `gif-cutout.spec.js:1151` asserted
*"Space must not play in Cut-out — it pans"*, which is the exact rule item 5 reverses. It now
asserts the narrowed one: the Mask Brush keeps Space, Cut-out plays with it.

1. **Shift-select on the frame strip, for consistency with the rest of the app.**
   `MpiFrameStrip.js:398` treats Shift as a SYNONYM for Ctrl — `const modifier = e.ctrlKey ||
   e.metaKey || e.shiftKey`, and `:457` toggles that ONE index either way. There is no anchor and
   no range. **Copy `MpiHistoryList.js:199-213`**, which is the canonical version and already
   solves the subtle part: a first Shift-click with no prior selection anchors at the ACTIVE
   entry, not at a stale `_anchor` that defaults to 0. `MpiGalleryGrid.js:1408` is the same
   shape. Ctrl stays a toggle; Shift becomes a range from the anchor.
   **DONE.** The pointerdown now splits `modifier` into `range` (Shift) and `toggle`
   (Ctrl/Cmd), and pointerup grew a `_rangeSelect(idx)` walking `_anchor` → `idx` inclusive.
   Ctrl is unchanged and re-anchors; a plain click clears and anchors. **One thing the item did
   not predict:** the plain-click branch never repainted — it emitted `frame-select` and let the
   Block call back into `setCurrentIndex`, which EARLY-RETURNS when the index has not moved. So
   clicking the frame you were already on left the old selection painted on screen. That is a
   pre-existing hole the range work exposed; `_renderWindow()` in that branch closes it.
2. **The mask DISPLAY toggles must be shared between Cut-out and the Mask Brush** — invert
   (the black mask) and B/W view. Both already mount `MpiMaskStrip` with `dest: 'mask'`, so they
   already share the `mask` settings key; the bug is WHEN it is read.
   **Cause:** `MpiMaskStrip` reads `getToolSettings(state.currentProject, 'mask')` once, at
   MOUNT, and writes through `settings:tool:update`, which
   `projectService.js:128` DEBOUNCES BY 300 ms (`_QUEUE_DEBOUNCE_MS`) before it reaches
   `state.currentProject`. Switching rail tools destroys and remounts the strip, so a toggle
   followed by a tool switch inside 300 ms reads the OLD value back. Fix the read, not the
   debounce — a global debounce change touches every tool's settings.
   **DONE, by fixing the READ.** `projectService` exports `getPendingToolSettings(toolKey)`
   — the queue's un-flushed partial — and `MpiMaskStrip` layers it over `getToolSettings` at
   mount. The 300 ms debounce every other tool relies on is untouched. The spec clicks invert and
   switches tools in ONE synchronous task, so not a millisecond of the debounce can elapse: that
   is the real window, and it was red before this.
3. **Cut-out panel order.** Below Mask Adjust: a `Mask Preview` section label, then the strip's
   controls (invert, view mask, clear, opacity), and **Cut out LAST, below all of it.** Today
   the panel mounts `#cutout-slot` and then the strip, so Cut out sits above the controls. The
   strip is one mount — move it above `#cutout-slot` and give it the label; `MpiToolOptionsGifCutout`
   already has a `__section-label` class used by "Tracked objects" and "Mask Adjust".
   **DONE.** `#strip-slot` moved above `#cutout-slot` inside a
   `mpi-tool-options-gif-cutout__section` carrying a `Mask Preview` label; no CSS was needed,
   `__section` already draws the rule and the spacing. **Folded in while the file was open:**
   message `e93c9db7` (MPI-736) — Stop's `variant` goes `danger` → `primary`, because Stop is a
   cancel and `--accent-err` is a real red now. Its twin `MpiMaskDetectRow.js:81` already landed.
4. **BUG — the whole canvas flashes WHITE for a split second** when playback leaves a masked
   run of frames and enters an unmasked one.
   **Cause, in `_setTint(url, luma)` (`MpiGifViewer.js`):** the first line is
   `classList.toggle('--luma', !!url && luma)`, so on a null url `--luma` (`mask-mode:
   luminance`) is removed while `--visible` is still on AND the previous frame's `mask-image` is
   still set. For that moment the element falls back to `mask-mode: alpha` over an OPAQUE B/W
   mask — alpha 255 everywhere — so the whole overlay paints `--mask-fill` at 0.7. The
   `transition: opacity var(--t-fast)` on the hide is what stretches it into a visible flash.
   Fix the ORDER (hide before un-luma-ing, and do not clear `mask-image` mid-fade), not the
   symptom. `_render()` at `:248` is the per-frame caller.
   **DONE.** `_setTint(null)` now hides and NOTHING else: `--luma` and the mask image stay
   exactly as they are until the next mask replaces them, so the fade never runs in
   `mask-mode: alpha` over an opaque bitmap. The non-null path sets bitmap and mode together
   before showing. A spec cannot catch a transition in the act, so the guard asserts the DOM
   state the flash comes FROM — a hidden tint that still carries both.
5. **Space should PLAY in Cut-out, and only pan in the Mask Brush** — and it is possible.
   `MpiGifControlBar` currently stands the play hotkey down for ANY canvas tool, which is too
   broad. `InputController.js:231-254`: the mousedown chain ends in an `else` that PANS, and the
   mask branch needs `mask.paintEnabled`. Cut-out mounts the strip with `brush: false`, which
   calls `setMaskPaintEnabled(false)` — **so a plain left-drag already pans in Cut-out, with no
   Space at all.** Space is only load-bearing where the tool owns the drag: the Mask Brush
   (painting) and Crop (`crop.isCroppingMode && !isSpacePressed`). So the gate is not "a canvas
   tool is up", it is "the canvas tool owns the drag" — have the viewer report that (e.g.
   `edit-change` carrying whether the tool paints) and gate the hotkey on it.
   **DONE.** `MpiGifViewer` tracks `_paintEnabled` and `edit-change` now carries `ownsDrag`
   (`crop || paintEnabled`); `MpiGifControlBar` gates the play hotkey on that instead of on
   `_editing`, and keeps the preview-button disable on `editing`. **The trap:** the strip mounts
   AFTER `enterMode`, so the value known when the tool opens is stale — `setMaskPaintEnabled`
   re-emits. `_exitEdit` resets `_paintEnabled` to the canvas default or a Cut-out visit would
   leave the NEXT tool's Space dead.

### 2026-09-19 — CONSISTENCY AUDIT: the GIF workspace against the rest of the app

Fabio, 2026-09-19: *"This whole workspace just seems like it got invented from nothing... So many
inconsistencies with the rest of the app."* He is right. Every finding below is verified in code,
not asserted. Do NOT reopen what he has passed (the tint rule, the rail
descriptions, the scope consolidation, the white mask, full-width Mask/Clear, the Pick icon).

**Status: this whole section is CLOSED** (session `7bbff4d4`, 2026-09-19). Findings 1, 3, 4 and 5
are built, lint-clean and spec-proven; finding 2 was closed by Fabio with no change. The
blocked-on-a-question and not-started notes that stood here are gone — the boxes under each
finding carry what it actually cost. What came NEXT is his second pass, above.

- **Finding 4 — DONE.** `MpiGifViewer` emits `gif-viewer:context-menu` (the `MpiVideoViewer:205` /
  `MpiCanvasViewer:2063` shape: the viewer reports the gesture, the Block owns the items). The
  Block's `isGif` branch builds Save frame as image / Reverse frames / Clear all masks, the last
  disabled with no masks. Frame-scoped verbs stay on `MpiFrameStrip`'s own menu.
- **Finding 3 — DONE for the two panels that were only an Apply.** `gifReverse` and `gifSaveFrame`
  are gone from `GIF_TOOLS`, `TOOL_OPTIONS_REGISTRY`, `_GIF_TIMING_TOOLS`, `_GIF_TRANSFORM_TOOLS`,
  `TOOL_LABELS` and both panels' own `TOOLS` tables. `timingEdit('reverse')` and the Block's
  `saveFrame` handler are untouched — the menu calls them. `gifTrim` keeps its panel: its note is
  real UI, not just an Apply.
- Proof: a new `gif-workspace.spec.js` test asserts the menu, that Reverse sends the same
  `mode: 'new'` `/gif/entry` body with reversed hashes, and the Clear all masks dead/live states.
  PROVEN RED first with `MpiGifViewer.js` + `MpiGroupHistoryBlock.js` restored from HEAD.
  `gif-timing.spec.js` and `gif-transform.spec.js` were rewritten onto the right-click; both are
  red at HEAD for the peer reason in `## Plan Drift`, so they cannot confirm it yet.

1. **Cut-out is the only mask-producing tool in the app with no `MpiMaskStrip`.** Counts: GifCutout
   0, GifTiming 0, GifTransform 0. Every image mask tool mounts it — Brush, Colour, Detect, Points,
   Text, Adjust, Composite, Paint — because MPI-371 built it as "the shared bottom strip of every
   mask tool". The GIF Mask Brush only has it because `gifMaskBrush: MpiToolOptionsMaskBrush` IS the
   image panel. **Fix:** Cut-out calls `viewer.el.enterMode('mask')` and mounts
   `MpiMaskStrip({ viewer, brush: false })`, exactly as Detect/Points/Text do. Opacity, invert and
   B/W then work identically because it is the same component on the same canvas.
   - The blocker is real but small: `MpiGifViewer`'s `setMaskBwView`/`setMaskOpacity`/`setMaskInverted`
     all funnel to `_canvas?.`, which is null outside an edit mode, and the Cut-out preview is a CSS
     overlay (`.mpi-gif-viewer__mask-tint`), not a canvas. `enterMode('mask')` is what mounts it.
   - Snag to solve, not to hand back: Cut-out's tint shows the **adjusted** mask (grow / fill-holes /
     invert via `distanceField`), while `_loadEditFrame` loads the stored one. `MpiCanvas` already has
     `beginMaskAdjust` / `previewMaskAdjust` / `applyMaskAdjust` / `hasMaskAdjustPreview`, which is how
     `MpiToolOptionsMaskAdjust` shows a preview AND mounts the strip in the image workspace. Copy that
     shape. Its preview draws in `MASK_AUTO_FILL` green, which is correct and consistent: a pending
     adjustment IS a proposal (see the colour rule below).
   - **NOT a blocker — I raised it twice and was wrong.** "Two Inverts on one panel": the strip's is an
     ICON-ONLY button whose tooltip already reads "Invert mask display"; Cut-out's is a LABELLED
     checkbox under Mask Adjust. Different shape, different place. Do not ask Fabio about it again.
   - **BUILT 2026-09-19 (session `7bbff4d4`), option (c).** Fabio re-confirmed the rule when
     asked: *"Everything that's masked is what's supposed to disappear in any world."* So the
     canvas is handed the already-flipped bitmap.
     The trap that forced the choice: the canvas can only ever draw the mask REGION.
     `setMaskInverted` is NOT a geometric complement — `MpiCanvas.js:972` recolours `maskCanvas`
     to `MASK_INVERT_FILL` (pure black). There is no display flag that shows the complement, so
     "the highlight marks what disappears" has to come from the BITMAP.
     Shape: `MpiGifViewer.setCutoutPreview(url)` — a display override that feeds `setMaskBase()`
     while the canvas is up and `_setTint()` while the GIF plays, so play/pause never changes
     what the highlight means. `_loadEditFrame()` honours it (and skips the brush layers: the
     override is already composed). `_exitEdit()` clears it, or the Mask Brush would inherit a
     flipped mask. Read-only by construction: `getCutMasks()` reads `_masks`, `brush: false`
     disarms painting, `_dirty` only a stroke sets.
     The strip's **Clear** routes to `clearFrameMasks(index)` under the override — with no brush
     layer to erase with, clearing the canvas alone would repaint from a store that still holds
     the mask and read as a dead button.
     **Consequence worth knowing:** Cut-out is a canvas tool now, so the built-`.gif` preview
     toggle is disabled in it exactly as in the Mask Brush, and the stage shows one frame until
     you press Play. `gif-cutout.spec.js` asserted the old behaviour and was updated.
2. **Timing is already ONE panel wearing FIVE rail buttons.** `gifTrim`, `gifSpeed`, `gifReverse`,
   `gifLoop`, `gifOutput` all map to `MpiToolOptionsGifTiming`. The image rail never splits one panel
   five ways: its shared panels are two DESTINATIONS (`maskAdjust`/`paintAdjust`,
   `maskComp`/`paintComp`) — one control set pointed at another layer. **Fold Timing into one tool.**
   Open question Fabio was asked and had not answered when the session ended: one rail button, or a
   group with the empty modes folded in? His steer so far points at one button.
   - **CLOSED — Fabio, 2026-09-19: "I don't care about timing anymore. Leave it as it is."**
     Timing keeps its group (Trim / Speed / Loop count, three modes since Reverse left for the
     context menu). No further change. Do not re-raise it.
3. **Panels that are nothing but an Apply.** `gifReverse` (`MpiToolOptionsGifTiming.js` TOOLS table)
   has no controls at all — one `desc` sentence and Apply. `gifTrim`'s controls live in the control
   bar, so its panel is near-empty too. Apply itself is NOT the anomaly: Crop, Resize, Mask Adjust,
   Composite and the image GIF Maker all end in Apply.
4. **The canvas context menu is a shared surface the GIF STAGE never joined** (Fabio, 2026-09-19).
   The video workspace reverses from a right-click: `MpiGroupHistoryBlock.js:3348-3358` offers
   *Reverse video & audio* / *Reverse video* / *Reverse audio* → `_handleReverseVideo()`.
   `MpiContextMenu` is already used by the gallery, history list, media slot, canvas viewer, video
   viewer AND `MpiFrameStrip` (the GIF strip's delete-frame / clear-mask menu). The GIF STAGE has
   none. **Several of the one-button Timing tools belong there instead of on the rail** — Reverse is
   the obvious first one, and it is exactly how the video workspace already does it.
5. **BUILT 2026-09-19.** New `POST /gif/preview` (routes/gif.js) runs the SAME `buildGif()` the
   Apply runs — a preview from a second encoder would be a decoration — to ONE file per project,
   `Media/.gif-preview/preview.gif`, overwritten each call and mtime-busted (E5). No sidecar, no
   sequenced name, no sweep; it MUST stay one file, because nothing references a preview so the
   frame sweep could never collect a second. `MpiToolOptionsGifTiming` carries the pane in
   `output` mode only and REMOVES it in the other three (MPI-382: a class carrying `display`
   outranks `[hidden]`). Encoder injected by the Block, the `MpiToolOptionsGif` division. The
   badge goes stale on a settings change rather than the pane clearing — the last build is what
   the next is compared against. Original finding, for the record:
   **The GIF output tool has no preview; the video workspace's GIF Maker does** (Fabio, 2026-09-19).
   `exportGif` → `MpiToolOptionsGif` carries a real preview pane — `__preview`, `__preview-frame`,
   `#gif-preview-img`, `#gif-preview-empty` ("No preview yet"), a spinner, and a **Generate preview**
   button that runs a real ffmpeg encode — plus size presets, fps and loop count. The GIF workspace's
   own `gifOutput` mode rebuilds the .gif with none of that. **Give the GIF output the GIF Maker's
   shape**, preview included, rather than inventing a third one.

**Method note for whoever picks this up:** audit the image and video workspaces FIRST, then build.
This session answered Fabio's points one at a time and had to be corrected twice — once on the mask
colour, once on recommending a second set of mask-display controls on the CSS overlay. Both
corrections came from him reading the other workspaces. `TOOL_OPTIONS_REGISTRY` and `GIF_TOOLS` /
`IMAGE_TOOLS` / `VIDEO_TOOLS` in `MpiHistoryTools.js` are the two maps that make the comparison cheap.

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

- [x] **MPI-768 GIF frames store and builder.** `services/gifFrames.js` per E1-E5: content-addressed
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
- [x] **MPI-759 GIF as its own gallery asset kind.** Row `gif` above `image` (match `item.gif` OR an
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

- [x] **MPI-769 GIF history workspace.** Per-kind table `{ image, video, gif }` -> viewer + tool list
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
- [x] **MPI-770 Make GIF from selected images.** Context-menu entry beside `combine`
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
- [x] **MPI-771 (engine half) cut-out graph, runner, alpha apply.** Probe `/object_info` on the
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

- [x] **MPI-771 (UI half) Cut-out tool group.** (automated green 2026-09-16; user-ux open) Mask by name (text + count, chips to keep or drop),
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
- [x] **MPI-773 (server half) transform and GIF to Video routes.** `routes/gifTransform.js`: Crop
  (one rectangle, every frame) and Resize (one size) -> new frames -> new entry.
  `routes/gifToVideo.js`: frames + delays -> constant 30 fps h264 MP4 at frame size (even
  dimensions), frames repeated to hold each delay, transparent areas filled with a background colour
  (default black), sidecar + `writeVideoDerivatives` (`services/ffmpegThumb.js:256`), precedent
  `routes/videoReverse.js`. Ownership: `routes/gifTransform.js` (new), `routes/gifToVideo.js` (new),
  `tests/gif-transform.test.cjs` (new). Briefings: root-cause, kanban, dos_and_donts. **Verify:**
  `node --test "tests/gif-transform.test.cjs"`: crop 9:16 then GIF to Video on three 3 s frames gives a
  30 fps MP4 of about 9 s with even dimensions, poster and proxy written, and a sampled video pixel
  matches the source frame within codec tolerance (not a 256-colour palette value).
- [x] **MPI-760 (server half) GIF Maker route.** `routes/gifMaker.js`: a video item + fps + trim range
  -> full-resolution frames through `services/gifFrames.js` -> built `.gif` at the size preset -> a
  new GIF item and sidecar (a new card, decision 13). `routes/videoGif.js` stays as the preview
  encoder. Ownership: `routes/gifMaker.js` (new), `tests/gif-maker.test.cjs` (new). Briefings:
  root-cause, kanban, dos_and_donts. **Verify:** `node --test "tests/gif-maker.test.cjs"`: a 2 s
  test clip at 10 fps with a 0.5-1.5 s trim gives 10 full-resolution frames, delays 10, the `.gif`
  longest edge at the preset.

Phase 3 verify mode: `user-ux` for MPI-771; the server halves `auto`.

## Phase 3b: cut-out redesign (Decision 14, serial, this session)

One coherent flow across the viewer, two panels and the canvas layer model, so no batch.

- **E9 - the track is a BASE layer in `MaskManager`.** `mask = (base OR manual) AND NOT subtract`.
  `setBaseFromDataURL()` converts the engine's greyscale mask (luma) to alpha and is a LOAD (no undo
  entry). A dab already writes both manual and subtract, so erase removes track pixels and paint
  restores them with no new rule. `clear()` with a base fills subtract instead of only wiping, one undo
  entry. Image mode never sets a base, so its behaviour and the `_buildCompositeFromTemp` twin are
  unchanged. Live display for free: the canvas draws `maskCanvas`.
- **E10 - `MpiGifViewer` owns the per-frame masks** (`Organisms/MpiGifViewer/gifFrameMasks.js`):
  track URL per frame position, brush layers (working-res PNG data URLs) per edited position, keyed to
  the frame-list signature (a reorder clears them, as the track already required). Offline compose goes
  through a headless `MaskManager` so there is ONE compositor. Edit mode mounts `MpiCanvas` over the
  frame (loads the frame, then base/manual/subtract), keeps the view across frame steps, pauses and
  blocks playback. The viewer implements the `MpiMaskStrip` surface, so the Mask Brush tool is the
  image-mode `MpiToolOptionsMaskBrush` unchanged, under mode `gifMaskBrush` (not in `_MASK_TOOLS`).
  Emits `masks-change` for the strip overlay + edited markers.
- **E11 - Track Single Frame** is the same graph and runner on a one-frame source video; its mask
  replaces that position's track. The chips re-dispatch the LAST scope (all or that frame).
- Cut out sends the track URL for untouched frames and a composed B/W PNG for edited ones; a frame
  with neither gets an empty (black) mask.

- [x] E9 base layer + `MpiCanvas` passthrough. **Verify:** desktop spec pixel checks (base shows,
  erase removes it, paint restores, clear hides it and Ctrl+Z brings it back).
- [x] E10 viewer store + edit mode + strip surface; Mask Brush rail entry; strip markers.
- [x] Cut-out panel: count input gone, Track All / Track Single Frame, masks from the viewer.
- [x] `tests/desktop/gif-cutout.spec.js` updated + a brush round trip (paint on one frame with no
  track, Cut out, that frame's alpha follows the stroke); `npm run lint:components`; node suite.
- [x] Docs: `docs/masking.md` (base layer), `docs/masking-undo.md` (a load), `docs/masking-sam3-gif.md`
  (tool group rewritten). **types.js typedefs PENDING** (MPI-737 claim): `tasks/MPI-771/types-hunk.md`.
- [ ] user-ux: Fabio fixes an overlap on a real GIF (local engine, then RunPod with his go).

Ownership: `MaskManager.js`, `MpiCanvas.js`, `Organisms/MpiGifViewer/`, `Organisms/MpiFrameStrip/`,
`Organisms/MpiToolOptionsGifCutout/`, `Organisms/MpiToolOptionsMaskBrush/` (doc only),
`Compounds/MpiHistoryTools/MpiHistoryTools.js`, `Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js`,
`js/components/types.js`, `tests/desktop/gif-cutout.spec.js`, `tests/desktop/history-modes.spec.js`,
`tests/desktop/gif-workspace.spec.js`, the three docs above.

## Phase 4: timing tools, then transform UI (serial)

Serial by decision: both edit the same tables in `MpiGroupHistoryBlock.js` and `MpiHistoryTools.js`.

- [x] **MPI-772 GIF timing tools and output.** (auto-verified 2026-09-17; two hunks parked) Trim (control bar in/out), Speed (0.1-50 fps),
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
- [x] **MPI-773 (UI half) transform and export tools.** (auto-verified 2026-09-17; two hunks parked) Crop (reuse `MpiToolOptionsCrop` if
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

- [x] **MPI-760 (UI half) Export GIF becomes GIF Maker.** (auto-verified 2026-09-17; types.js hunk parked; no open-card offer, toast like the other new-card tools) Labels `Export GIF` -> `GIF Maker`
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

- 2026-09-19 (second pass, item 1): **the frame strip's plain-click branch never repainted**, and
  no item said so. It emits `frame-select` and lets the Block call back into `setCurrentIndex`,
  which EARLY-RETURNS when the index has not moved — so clicking the frame you were already on
  cleared `_selection` in memory and left the old thumbs painted selected. Pre-existing; only
  visible once a Shift range could put a selection on frames you were not standing on. The strip
  paints its own selection now. If another selection path is ever added here, it owns its
  `_renderWindow()` — do not rely on the Block's round trip.
- 2026-09-19 (second pass, item 5): **an existing spec asserted the rule being reversed.**
  `gif-cutout.spec.js:1151` read *"Space must not play in Cut-out — it pans"*, written the same
  morning from Fabio's first statement of the rule; his second pass narrows it. It was UPDATED,
  not deleted. Worth expecting whenever a rule he gave earlier in the day is refined later.

- 2026-09-19 (finding 1): **`756cf0e0` turned master red and it was MINE** — the only red on
  master, every run before it green. `gif-cutout.spec.js` test 2, "frame 0: the brushed corner
  is still kept", 255 expected / 0 found, ×3. Root cause: **`_editIdx` does not mean "the frame
  on the canvas", it means "the canvas holds this frame's real layers and may be saved back".**
  Cut-out's canvas holds neither under the display override, so claiming `_editIdx` let a
  landing `setTrackMask` → `_refreshEditBase()` → `_saveEdit()` write EMPTY brush layers over a
  real fix. It has to stay `-1` in BOTH places it can be claimed — `_loadEditFrame`'s override
  branch AND `setCutoutPreview()`, because `enterMode('mask')` runs before the first preview
  arrives, so the mount already took the normal branch. Fixed in `3efcdc9f`.
- 2026-09-19: **three attempts to write a guard that actually fails**, worth not repeating.
  (1) Asserting the strip's `--edited` dot PASSES under the bug: the dot survives, it is the
  mask's CONTENTS that are emptied — the assertion has to be a PIXEL of the composed mask.
  (2) A non-null `getFrameMaskURL()` passes too, for the same reason. (3) The sequence needs
  EVERY frame masked before stepping: the override is per frame, so stepping onto an unmasked
  frame nulls it and the normal load path puts the brush layers back, hiding the bug. Proven by
  running the guard against `git show 756cf0e0:MpiGifViewer.js`.

- 2026-09-19 (consistency audit, finding 1): **the `setMaskInverted` plan does not work and the
  finding DOES have an open question.** `MpiCanvas.js:972` recolours the mask layer BLACK
  (`MASK_INVERT_FILL`); it does not draw the complement. So mounting the shared strip on the
  canvas necessarily displays the mask itself — "what STAYS" — and there is no display flag that
  makes the canvas show "what GOES". That reverses Fabio's 2026-09-19 tint rule, so it is his
  call, not an implementation detail. Three options written up under `## Remaining Work`.
- 2026-09-19 (consistency audit): **three gif desktop specs are red at HEAD from a peer bug, not
  two.** `gif-timing.spec.js` fails at its FIRST Apply and `gif-transform.spec.js` at its Crop
  assertion, both because an entry references a `.gif-frames/<hash>.png` that is gone. Proven at
  HEAD with every MPI-771 file restored by `git show`. In `gif-timing` the death is at
  `routes/gif.js:215`, AFTER the same request's own `frameExists()` gate at `:151` passed — so
  the frame was there and was swept underneath it. Message `922a3667` extends `077abd3b` to
  MPI-810 with the evidence and points at the three `sweepGifFrames()` call sites. **MPI-771 does
  not fix it** (handoff constraint), and it is why findings 3/4 could only be proven through the
  stubbed `gif-workspace.spec.js`.
- 2026-09-15: MPI-749 landed `done` before planning; MPI-759's `blocked` maturity is stale.
- 2026-09-15: brief corrections found by investigation: the context menu lives in
  `MpiGalleryGrid.js`, not `MpiGalleryBlock.js` (770 edits both); `MpiHistoryTools` is a Compound;
  the hotkey registry is `js/managers/hotkeyRegistry.js`; `operationRegistry.js` /
  `operation_registry.json` are not hand-edited (E8); `add-from-cards` must copy frames (E4).
- 2026-09-15: server halves of 771, 773 and 760 moved one batch earlier (disjoint files); the UI
  order is unchanged.
- 2026-09-15 (Batch 1): MPI-768 serves frame and thumb URLs through the existing `/project-file`
  route, not a dedicated one (E3). `output.edgeColour: null` means an opaque build with no explicit
  alpha flatten: MPI-772 must flatten transparent pixels onto a chosen background and pin it with a
  pixel assertion (memory `tools/image-alpha-flatten.md`); MPI-770's transparent padding meets it first.
- 2026-09-15 (Batch 1): the MPI-633 VRAM rigs were deleted at that card's close-out and the desktop
  harness runs `--disable-gpu`, so MPI-759's hover-tour number was not produced. Any later Verify that
  needs VRAM needs a new instrument.
- 2026-09-15 (Batch 1): the new kind row broke `tests/gallery-filter.test.cjs` fixtures (in neither
  worker's ownership); the orchestrator fixed both lines at integration.
- 2026-09-16 (Batch 2): the edgeColour gap was worse than recorded, and it is CLOSED, not left for
  MPI-772. MPI-770's pixel test showed transparent pixels in the built `.gif` replaying the PREVIOUS
  frame, and a list mixing RGB and RGBA PNGs dropped a frame. The orchestrator fixed `buildGif` as
  integrator: opaque builds flatten onto black; transparent builds skip ffmpeg's frame diffing and
  clear each frame before the next (disposal 2). Both halves bite-checked against the pre-fix code.
  `docs/gif.md` records it. MPI-772's GIF output tool can still offer a background colour.
- 2026-09-16 (Batch 2): **E8 was wrong.** `tests/text-op-completion.test.cjs` fails a suite whose
  op is missing from `operationRegistry.js` / `operation_registry.json`, and feature commits add
  their own rows (MPI-620, MPI-747). The orchestrator added `gifCutoutSam3` at `1.6.0`; later new
  ops do the same. `gifCutoutSam3` also joined `SAVES_NOTHING` in `tests/flow-output-filename.test.cjs`.
- 2026-09-16 (Batch 2): the MPI-771 worker's first pass lacked E7's frames -> temp video source (the
  live track used an existing MP4), so the worker went back to add it.
- 2026-09-16 (Fabio, after his eye check): Make GIF holds each still 1 s (delay 100), not 10 fps. 10 fps
  flashed unrelated images (a seizure risk). Decision 8 (no prompt) stands.
- 2026-09-16 (Batch 3): Fabio reports GIF cards do not play on hover in the gallery, which is decision 5
  and MPI-759's own Verify ("hover mounts it"). MPI-759 reopened (done -> doing) and a fourth Batch 3
  worker owns the fix; its footprint (gallery grid, renditions) is disjoint from the other three.
- 2026-09-16 (Batch 3): orchestrator review sent two workers back. MPI-760: `480xauto`/`autox480` name a
  WIDTH/HEIGHT (videoGif.js), not a longest-edge cap, so the route derives `buildGif`'s box from the
  frame aspect. MPI-773: per-frame delay rounding to 30 fps drifted (delay 5 +33%, delay 7 -5%), so it
  now rounds the running total. Both got a test that was red first.
- 2026-09-16 (Batch 3): the MPI-759 root cause was `assetKinds.js` matching `.gif` against the wrapped
  `/project-file?path=` URL. The import chain also dropped the upload's `gif` field (fixed in
  `mediaUploadService.js`, `mediaImportService.js`, the gallery drop emitter and `docs/events.md`).
- 2026-09-16 (Batch 3): the new cut-out group made two gif-rail assertions stale (`history-modes.spec.js`,
  `gif-workspace.spec.js`: 0 -> 1 slot); the orchestrator fixed both. MPI-773/760 UI halves must update
  them again when they add tools.
- 2026-09-16 (Batch 3): the MPI-771 spec reaches a real Cut out by faking only the GPU: it patches
  `getEngine().runWorkflow`/`httpBase` in the page and serves masks from a Node HTTP stub. Later GIF
  specs that need an engine result can reuse that seam.
- 2026-09-16 (Batch 3): `tests/desktop/media-import-outside-gallery.spec.js` fails intermittently in long
  desktop runs (a ~15 s whole-server stall; details in MPI-759 `validation.md`). Not this work; reported.
- 2026-09-16 (Fabio's first cut-out check): E10's "a reorder clears them" was wrong. A mask
  describes its frame's pixels, so a staged reorder/delete now carries the masks (`order` ->
  `gifFrameMasks.remap()`); a plain strip drag scrubs and only a held thumb reorders.
- 2026-09-17 (MPI-772): the Trim tool needed `MpiGifControlBar.js` (`getRange()`, and a
  `range-change` when a new frame count resets the handles), outside Phase 4's ownership line; folded
  in. The loop remap already lives in `buildGif`, so Loop only writes `gif.loop`. Timing tools edit the
  VIEWER's list, so staged strip changes are saved with them. The rail now has 3 gif groups; the
  rail-count assertions moved 1 -> 3 (MPI-773 moves them again).
- 2026-09-17 (MPI-772): the strip pill was on screen whenever a GIF opened: `display:flex` beat
  `[hidden]`, and every spec asserted the attribute. Fixed in `MpiFrameStrip.css`; pill specs assert
  `checkVisibility()`. New panels with a `[hidden]` row need the same override.
- 2026-09-17 (MPI-773): Crop needed `MpiCanvas.js` (`setCropRect`: `crop` is not on the element) and
  `routes/gifTransform.js` (`outW/outH` for RESOLUTION), outside Phase 4's UI ownership; folded in.
  `MpiToolOptionsResize` was NOT reused: its preview runs a ComfyUI workflow. With Crop on the gif rail,
  the Block's "no prompt -> crop" default would have opened every GIF in crop mode; a GIF now opens with
  no tool. `/gif/crop` and `/gif/resize` return a new CARD shape but land as a history entry, like the
  cut-out. `tests/desktop/crop-resize-output.spec.js` is flaky on HEAD (not ours).
- 2026-09-16 (Batch 2): `routes/gifMake.js` writes its own sidecar and returns a raw descriptor
  (the `/combine-videos` precedent) rather than going through `/gif/entry`.
- 2026-09-17 (Phase 5): GIF Maker drops the Save-As path entirely and does not "offer to open" the new
  card (no shared confirm primitive; toast like Snapshot / Save frame / GIF to Video). The tool stays in
  the video rail's `export` group. Discovered and folded in: the stale header ENTRIES count (fix in
  `_persistGroup`, proof in `gif-transform.spec.js`).

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
