# MPI-1015 — The video screen works like the image screen

## Why

Fabio's 2.0 smoke (2026-10-04). The video history screen is a different app from the image one:
no `+` card, a Start/End frame panel instead of the strip, and a model list cut to models that
animate a picture, so MiniMax H3 Reference (installed, local, `['ref2v_ms']` only) never shows
and a reference model can take nothing but the open clip. Fabio: do it all before 2.0, and
retire the Start/End frame panel and Continue video Extend / New shot ("we already have
Combine"). No deadline; consistency is the point.

Surface map (read-only sweep, claims re-checked 2026-10-04): the panel is only
`MpiToolOptionsPrompt` + its mount; Extend/New shot is its two buttons -> HB handlers ->
`generationService` extend post-step -> `/extend-video`, with NO test and NO agent mention;
the right-click "Set as start/end frame" writes PromptBox chips and does not need the panel;
Combine (`/combine-videos`) stays untouched. Abbreviations: HB = `MpiGroupHistoryBlock.js`,
PB = `MpiPromptBox.js`.

## Phases

### Phase 1: the strip and reference models on the video screen

- HB `stageMedia: !isVideo` -> always on: the `+` card and the visible strip, as image history.
  The picker's "Add to history" toggle stays image-only (`_addPickedEntry` builds images).
- Model list: video takes every model with an op that takes media (`!isTextOnlyOp`), the same
  rule image history uses (MPI-955). H3 Reference, Seedance 2.0 and Wan 3.0 `ref2v` appear.
- Op list: `(requiresImages??0)>0 || (requiresVideo??0)>0` hides `ref2v`/`ref2v_ms` (they
  require 0). Replace with `!isTextOnlyOp(key)` at all three twins: HB `_opOptions`, PB
  `_opChoices`, PB `_pickOpForModel`.
- The open clip is a pinned chip, as the open picture is on the image screen: shown on a
  reference op, not shown and not sent on a picture-animating op (it takes pictures). It never
  drives the op auto-pick. Drop the `videoCount` floor of 1 (the image floor went in MPI-721 for
  the same reason).
- **Fabio 2026-10-04: the clip chip toggles.** Its tag reads "Video 1" (the model's own tag
  word: H3 says "Picture"/"Video"); a click swaps it to the FRAME UNDER THE PLAYHEAD as a
  picture ("Image 1"), captured at the click so the chip shows exactly what is sent; a click on
  it again goes back to the clip. A video reference bills its seconds on Wan, so the clip must
  not be forced in.
- Run path: `_generationFromPromptPayload` sends the strip's role-assigned media for video too
  (today it keeps only `startFrame`/`endFrame` images, silently dropping ref2v pictures).
- `+` upload card accepts every kind the op takes (today image only, so a video file could not
  be added as a reference from disk); a pick keeps the tile's own kind, as now.
- Start/end frames on picture-animating models: the strip's existing Start frame / Last frame
  pill (MPI-466), same as the gallery. Right-click "Set as start / end frame" stays and fills
  the strip.

### Phase 2: retire the panel and Extend / New shot

- Delete `js/components/Organisms/MpiToolOptionsPrompt/` (js + css), its import and mount
  (HB ~1150-1157), `preloadStyles.js` entry, `types.js` typedef.
- Delete Extend / New shot: HB `prompt-box-tools:*` listeners + `_captureLastFrameMedia`
  (~3894-3977), the `extend`/`sourceItemId` run params, `generationService` extend typedef +
  post-step (~905-914, ~1515-1640) and its now-unused import, the `/extend-video` route
  (`routes/videoConcat.js` ~213-344), and helpers left with no caller
  (`captureLastFrameAccurate`, `MpiVideoSurface.lastFrameIndex`/`captureFrameCanvas`: grep first).
- `_modelHasFrameOps` / `_firstFrameOp` (dead `v2v` branch) -> `_hasPromptOps()`.
- KEEP: Combine and everything it uses; `_continuationOp` (Reuse); old entries' "extended from"
  line in the history list (old projects still carry `extendedFrom`); the LTX Extend Video Flow.

### Phase 3: docs, notes, tests

- Docs: `docs/workspaces.md`, `docs/generation-lifecycle.md`, `docs/PROJECT.md`,
  `docs/video-player.md`, `docs/project-integrity.md`; `docs/releases/UNRELEASED.md` line
  (Extend / New shot gone: make the shot, then Combine).
- `.claude/rules/` (components, component-mounts, component-events-organisms,
  component-events-blocks, component-state) name the panel: Fabio said yes 2026-10-04.
- Tests below.

## Verification

**Verify mode:** user-ux

- New `tests/desktop/video-history-strip.spec.js`, RED on HEAD first: a video group shows the
  `+` card and no panel; H3 Reference is in its model picker; on a ref2v op the clip is Video 1
  and a `+` picture lands as Image 1, both in the run config; on i2v a `+` picture is the Start
  frame and right-click "Set as start frame" lands a chip; no Extend / New shot.
- `tests/history-current-entry-owns-media.test.cjs` updated to the new rule.
- Green: `prompt-box-video-ref`, `media-picker-to-history`, `history-modes`,
  `history-prompt-model`, `media-picker-cards`, every `history-*` and `prompt-box-*` desktop
  spec; `npm test`; eslint.
- Fabio's look: open a video, `+` a picture, run H3 Reference with it; animate a picture from
  the strip; right-click Set as start frame.

## Current State

Fabio's go 2026-10-04 with the clip-chip toggle (Video 1 <-> current frame as Image 1), yes to
keeping right-click Set as start/end frame, yes to the rule files.

ALL THREE PHASES BUILT AND GREEN, committed + pushed in session 7ad19928's handoff commit; card
`doing`/`validating`. Only Fabio's look is left (verify mode user-ux), in a fresh session: open
a video, `+` a picture, run H3 Reference with it (local, $0); animate a picture from the strip;
right-click Set as start frame. His "1" closes the card (CI green on the commit first). The
next session ALSO gets a message from a peer who found two bugs (Fabio, 2026-10-04): read it
before the look; a bug on this card's surface folds in here, anything else per Discovered work.

How it works (HB = MpiGroupHistoryBlock): `_syncEntryChip` pins the clip (`mediaType:'video',
swappable`) only when `activeOperation` has a video slot, else unpins; `_clipFrame` holds the
swapped frame; `_pinnedKey` stops re-pinning an unchanged chip. It re-runs on every
`operation-change`. PB renders a swappable pinned chip's tag as a button emitting
`pinned-swap` -> HB `_swapClipChip` (frame via `_captureFrameUpload`, shared with
`_setFrameFromVideo`). Video stacks swap each member's clip in via `buildCueAllJobItems`.

## Completed

- Phase 1 (2026-10-04): model list `_modelTakesMedia` for both kinds; op filters by
  `isTextOnlyOp` in HB `_opOptions`, PB `_opChoices`, PB `_pickOpForModel` (an EMPTY history
  box lands on the model's first media op, so i2v before ref2v); video floor of 1 dropped;
  `stageMedia: true`; "Add to history" image-only; run path sends the strip as is.
- Phase 2 (2026-10-04): panel folder + preload + typedef, PromptBox role APIs, extend post-step,
  `/extend-video`, concat `inputRanges`, `captureLastFrameAccurate`, `lastFrameIndex` deleted.
- Phase 3 (2026-10-04): five docs, five rule files, UNRELEASED, mirror unit test.

## Plan Drift

- 2026-10-04: a video card opens on the model's first media op in ITS order (i2v before ref2v),
  not the first AVAILABLE one, or every Seedance/Wan card would open on ref2v with the clip
  pinned (billed seconds on Wan) and a `+` picture would land as a reference, not a start frame.
- 2026-10-04: skipped the `+` upload card taking a video file from disk (it imports the slot's
  kind only, as in the gallery); drag-drop and picking a video card already add clips.
- Spec gotcha: drive the model through the real picker (`ui:open-model-picker` + tile click).
  `promptBox.setModel()` alone never reaches the Block's `_adoptModel`, so HB keeps the old
  model and re-picks its op (read as "the swap unpins itself" for a debugging round).
- 2026-10-04: KEPT `MpiVideoSurface.captureFrameCanvas` (no caller now): MPI-715's plan names
  it as its frame-accurate building block. Also deleted what the panel alone used: PromptBox
  `getMediaByRole`/`removeMediaByRole`/`swapMediaRoles` and the concat service's `inputRanges`.
- 2026-10-04: the mirror test mirrored MPI-351's collapse, dead since MPI-721; rewritten to
  mirror `_syncEntryChip` + the as-is dispatch.
