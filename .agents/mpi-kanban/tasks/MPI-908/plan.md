# MPI-908 Plan - Mascots on empty and one-off states

Under umbrella MPI-846. Picks agreed with Fabio 2026-09-25 (brief in session a28366d2).
Clips at `assets/mascot/{key}/{clip}.webm`. Studio has NO usable `failed` clip (i2v_016
archived) and no "landing no projects" clip (i2v_042 deleted) - hence the picks below.

## Current State

**(bae9042a, 2026-09-25) Later 2 (update ready) BUILT + Fabio VERIFIED live:** Fabio's
calls: dialog ONLY (Settings plate stays bare), play once then hold, 96px. `MpiOkCancel` gained
a `mascot: {key, clip}` prop (icon slot, wins over `icon`); `mascotLoop` gained `{ once }` (drops
`loop`) + the `update-ready` crop; `promptUpdate` passes Studio update-ready. Spec
`tests/desktop/update-ready-mascot.spec.js` green (forces the real prompt via localStorage
`mpi_dev_force_update`). Overlays does NOT queue modals (request shows at once), so no onShow
play hook is needed. types.js NOT updated - peer b01d20f2 holds it (component JSDoc documents
the prop). Next: job cancelled (last item).

**(bae9042a) PLAN COMPLETE. Later 3 (job cancelled) BUILT + Fabio VERIFIED (local model). Known
gap, Fabio "not a big issue": does not play for CLOUD models, cause not investigated.** option A, gallery only.
`activeGenerations.cancel` now emits `byUser: true` (the only Stop path; other cancelled emits are
placeholder teardown). MpiGalleryBlock holds Stopped placeholders in `_cancelledPlaceholders`
(in `_leadingGroups`, so every setGroups keeps them); grid card `setCancelled` plays the op's
`cancelled` once (idle position), emits `cancel-shown` on ended/error -> block removes card. Late
complete clears it via `_rebuildAfterEnd`. Spec `tests/desktop/cancelled-mascot.spec.js` green.
After Fabio verifies: mpi-end-session closes MPI-908.

**(2bd5efc2, 2026-09-25) Later 1 (RunPod connecting) VERIFIED:** RunPod connecting band in
heroCrew.js (`_buildBand`/`_paintBand`/`_syncConnecting`, driven by the `remote:connection`
payload; `state.remoteEnginePhase` only on mount), landing.css band rules. Queue `transition`
flag REMOVED again (Fabio: no transition between loops; only success gets one). Band +
`connected` VERIFIED live (CPU + GPU pod). Next: update ready, then job cancelled. MPI-907 closed.

**HANDOFF STATE (2026-09-25).** Fabio after a full app restart: "It's looking good, your
changes" and the 320px no-results is right (Phase 2 empty states: VERIFIED). Phase 1 agent
fail not yet seen live post-restart. Next, in order:
0. **(b13c4313, handoff) Items 1-5 ALL DONE + Fabio VERIFIED** (validation.md): double frame,
   reply marker (declined path proven by tests only - his live ask was substituted, not
   declined), DESIGN.md + docs, GIF re-cuts, and MPI-907 toasts (STILLS per mascot by Fabio's
   call, verified in the component gallery; MPI-907 is ready to close). Remaining mascot work:
   this card's "Later" (job cancelled on a card, update ready, RunPod connecting x4 +
   connected) and MPI-906 Phases 3-5 (parked). Ask Fabio which next. Old notes below.
1. **Double-frame on swap (Fabio, NOT from this card - from the MPI-777 flicker fix):** hovering
   a landing mascot, and some agent-chat swaps, show the new clip ONE FRAME ON TOP of the old.
   Cause: `heroCrew.js` `handOverClip` keeps the old clip live until the new one's NEXT frame,
   so both alpha clips show at once; invisible at a rest-frame swap, visible on a mid-clip
   interrupt (hover = greet, transition:false). Hypothesis to try: hidden clip at
   `opacity: 0.001` instead of 0 (keeps the video layer drawn, so the 0->1 blank frame cannot
   happen) in landing.css `.mpi-landing__crew-clip`, MpiAgentChat.css `.mpi-agent-chat__crew-clip`,
   MpiGalleryGrid.css `.mpi-group-card__mascot-clip`; then `handOverClip` swaps both classes in
   the SAME frame (drop the rVFC/250ms/WeakMap machinery). PROVE on screencast frames: temp
   probe `tests/desktop/zz-flicker-probe.spec.js` (UNTRACKED, never commit; run with env
   PROBE_OUT=<dir>), scratchpad `analyse.py` (count spikes/blinks - it read 0/0 on the
   BEFORE run, too blunt for overlapping poses) and `strip.py <dir> 6` (crop strip around 6
   live flips -> strip.png, LOOK at it). Before-run frames: scratchpad `probe-before/`
   (session a28366d2 scratchpad; may be evicted). Run before + after, compare strips.
2. **Reply marker (approved by Fabio):** the agent declining IN WORDS with no tool failing
   ("no Z Image Turbo") must play heads-up. Add a small marker the agent sets on its reply
   (agentLoop.mjs; mind tests/agent-prompt-budget.test.cjs - tools ~16.95k/17.2k, system
   9.49k/9.8k bytes) and have MpiAgentChat set `_turnFailed` from it.
3. **DESIGN.md § Mascot rules (approved):** op's mascot per spot (not "Studio alone"), animated
   WebM clips via heroCrew/mascotClipQueue/mascotLoop (not flat PNGs), no-results 320px by
   Fabio's call (the 64px cap no longer holds for it). Also docs/mascot-placement.md spot map
   (agent fail row, empty states, generating card) and docs/shell.md handOverClip paragraph.
4. **Re-stage cleaned GIFs:** Fabio fixed leftover background bits in some GIFs in the
   Vision project `Cubric Studio GIFs`, marked with the circle/dot mark. Find them (project.json
   marks, cubric-vision-project-files skill), re-point `docs/mascot-gif-manifest.md` at any new
   filenames, `node scripts/stage-mascot-clips.mjs --only <slug>`, then `--verify`.
5. Then MPI-907 toasts.

Phases 1 + 2 built and green (2026-09-25). Built:
Cosmo `headsUp`/`gaveUp` states + `_cosmoNotice` in MpiAgentChat.js; agentLoop.mjs `generate`
gained an optional `redo` arg and the agent:tool frames carry `redo` / `refused`; heroCrew.js
`handOverClip` stale-drop fix (see validation.md); `js/utils/mascotLoop.js` (one looping clip,
cropped by `object-view-box`) used by projectUI.js, MpiGalleryGrid.js, MpiModelManager.js,
MpiFlowLibrary.js, MpiMediaPicker.js. Close-out: update docs/mascot-placement.md spot map
(agent fail row is new; Studio has no failed clip) and DESIGN.md § Mascot rules is stale
("Studio alone", "flat png poses") - ask before editing DESIGN.md. Next after Fabio's check: MPI-907 toasts.
Fabio is cleaning white bits out of some GIFs in the
`Cubric Studio GIFs` project and marking each fixed card with a circle mark: once he says
so, re-point `docs/mascot-gif-manifest.md` at any new filenames and re-run
`node scripts/stage-mascot-clips.mjs --only <slug>`.

## Phases

### Phase 1: Cosmo notices a failure (agent chat)

`MpiAgentChat.js`. Cosmo's queue gets two play-once states, cutting in without a transition,
then handing back to what he is doing:
- `heads-up` (lifts his head off like a sign): an agent tool fails (`agent:tool` status
  failed / `agent:result` not ok), an agent-run job errors (`generation:error`), or the agent
  REDOES a generation - a `generate` starting after a `look` in a turn that already generated.
- `cancelled` (walks off without his head, shrugs): the turn dies (`agent:error`).

### Phase 2: Empty states

A single looping clip each, no swap; reduced motion holds the first frame.
- Landing, no projects (`projectUI.js` x2, greet PNG) -> `studio/peek`.
- Gallery "No cards match" (`MpiGalleryGrid.js`, idle PNG) -> `no-results`: the filtered
  kind's mascot when exactly one kind is on, else Studio.
- Model Library / Flow Library "No ... match" -> `studio/no-results`, small.
- Media picker: empty project -> `studio/peek`; filtered to nothing -> `studio/no-results`.

### Later (not this stretch)

Job cancelled on a card, update ready, RunPod connecting x4 + connected.

## Verification

**Verify mode:** user-ux

Desktop specs: agent-chat stays green + a case per trigger; a new empty-state spec. Then
Fabio checks each spot live.

## Completed

## Remaining Work

Phases 1-2, then Later.

## Plan Drift

- 2026-09-25: Fabio pulled the agent fail spot in here (it had no card) and put empty
  states ahead of MPI-906's remaining waiting spots.
