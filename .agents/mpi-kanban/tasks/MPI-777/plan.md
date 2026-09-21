# MPI-777 - Animated mascots in the app: shared clip queue, landing crew, prompt box ledge

Directions and the why: `brief.md`. Spot map and clip ids: `docs/mascot-placement.md` (moved into
this repo 2026-09-20, with the roll records and `docs/mascot-gif-manifest.md`). Re-grep every code
pointer below before editing; they were read 2026-09-16.

## Current State

- Card created 2026-09-16 from MadPony-Identity MPI-78. **UNBLOCKED 2026-09-20** — see the
  drift note. Of the four things that blocked it, three have landed: MPI-760 and MPI-771 are
  `done/complete`, the whole set is cut out (103 GIFs in the Vision project
  `Cubric Studio GIFs`, 84 background-free), and the 19 transition clips exist. Only the alpha
  WebM export is still missing, and **that no longer gates the work** — see below.
- The app still shows stills: `assets/mascot/{key}/{pose}.webp`, one per character, staged by
  MPI-766. `heroCrew.js` `_poseSrc(key, pose)` is the only code that knows a file there, and its
  comment already expects animated alpha loops to replace the stills.
- **Phase 2 is BUILT (2026-09-21): `js/utils/mascotClipQueue.js`, 8 unit tests green.**
  It is DOM-free behind a `paint` callback, matching `createPreviewClipPlayer`, so it drives a
  still, a GIF or an alpha WebM without knowing which. Nothing is wired to it yet.
- **Next action: Phase 1, the assets.** The clips exist and were measured 2026-09-21 — see the
  drift note. They need downscaling before placement whatever the format decision is.

### Why the order changed (Fabio, 2026-09-20)

The queue does not care what format it plays. `_poseSrc` is two lines behind every mascot
asset and every call site goes through it, so the spot map, the pools, the interrupt
transitions and the teardown can all be built and unit-tested against the stills that ship
today — then pointed at the GIFs, and at WebM later if the format decision goes that way.
Building the queue first also means the format is chosen after somebody has watched the
system move, rather than before.

**The one design constraint this imposes, and it is load-bearing:** a GIF in an `<img>`
cannot report when it ended, so the queue must be driven by a DURATION CLOCK, not by a
media `ended` event. That is not a compromise — the clip facts above already give exact
durations (3s = 73 frames, 5s = 124 frames, at 24fps), and a duration clock is the only
design that works for all three of a still (instant), a GIF (known length) and a WebM
(which could use `ended` but does not need to). Do not design Phase 2 around `ended`; it
would work today only if the format decision went one way, and it silently forecloses it.

## Clip facts (from MPI-78)

- 768x768, 24fps, flat light grey background (removed by the SAM3 cut-out). 3s clips are 73
  frames, 5s clips 124. Idles, job cancelled, search no results, engine starting and landing no
  projects are 5s; the rest are 3s.
- Every state clip and full-body scenario clip of a mascot opens and closes on the **same rest
  frame**, so swapping clips at a clip's end never jumps. Mid-clip swaps do jump.
- Generating card clips each loop on themselves but do not share that rest frame.
- Standing clips have a thin floor bar under the feet that Fabio removes in the app before
  export.
- Head peeks are head-only and cut by their bottom edge. Prompt's and Audio's end higher than
  they start: fine, because peeks play once.

## Settled (Fabio, 2026-09-16)

- **Format: WebM, VP9 with alpha**, as MPI-766's brief already set. Not GIF: GIF alpha is one bit.
- **Background removal is MPI-757's SAM3 cut-out**, not BiRefNet (BiRefNet takes too much VRAM,
  worst on batches of images). The route for a mascot clip: GIF Maker turns the clip into a GIF
  card (MPI-760), the SAM3 cut-out with video tracking cuts its full-colour frames into alpha
  (MPI-771, decision 11). MPI-757's "no background removal on video" (its decision 1) is the
  rejected BiRefNet Remove Background on video (MPI-758); it does not stop this route.

  **CORRECTION, measured 2026-09-20 (MadPony-Identity MPI-78).** The whole mascot set was cut out
  with **BiRefNet on this exact route** — `POST /connector/gif/cutout` with `method: "background"`,
  `adjust {"grow": -1}` — on a 16 GB 4060 Ti: **87 GIFs, 3426 frames, 40.8 min, zero failures**,
  with GPU memory sampled twice mid-run at **5,076 MiB** (samples, not an instrumented peak).

  Be precise about what that does and does not kill. `background` reaches BiRefNet through
  `runGifCutoutTrack()`, which feeds it `Input_Video` — the frames are encoded into a source video
  first (`POST /gif-cutout/source`), so this is **not** the "batch of images" path the concern
  above is about. That concern is untested here and may well hold on its own path. What the
  measurement does establish is that the sentence is **misleading for the GIF route, which is the
  only route this card uses**: on it, BiRefNet is comfortable, not a VRAM problem.

  So background removal here is **a real choice, not a settled constraint**. SAM3 `name` tracks a
  named subject and keeps all four tracked slots; BiRefNet `background` takes no prompt and did the
  whole set in one pass. Both are live: MPI-760 and MPI-771 are `done`/`complete`, and MPI-859
  (composing cut-out methods, commit `a6c423db`) is `doing`/`validating` — shipped as code, card
  not yet closed.

  One caveat that is NOT about VRAM and does decide some clips: BiRefNet looks for a single salient
  subject, and it struggled on the multi-object scenes (the connecting set, with Studio plus a
  desk, laptop, tower and two cables). Those are where the hand-fixes went. SAM3 by name may be the
  better tool for those specifically — untested.
  **Gap:** the cut-out frames keep full alpha, but MPI-757's outputs are the `.gif` (one-bit
  alpha) and GIF to Video (h264 MP4, no alpha). Nothing yet writes the frames as a VP9 alpha WebM
  (`-c:v libvpx-vp9 -pix_fmt yuva420p`): an export in the GIF workspace or a script.
- **Hover interrupts play a transition first.** A clip swap can only happen cleanly at a clip's
  end, so a hover would otherwise wait up to 5s behind an idle. Instead, a hover plays a short
  (about 1s) transition graphic at once, like a ninja smoke puff, and the swap happens under it.
  Details under Phase 2.

## Open decisions (Fabio's)

1. Flows: which Flows get a mascot, where, on what trigger.
2. Where the Prompt mascot appears (prompt tools are merging into this app).
3. Empty gallery: keep the head peek there too, or the still it uses today.
4. Whether the prompt box ledge replaces the 48px Studio in `MpiAgentChat.js` (~44-94) or both
   stay.
   **ANSWERED by MPI-843 (Fabio, 2026-09-20): neither.** The 48px Studio goes, and the agent
   ledge is NOT on the prompt box. The agent panel gets its own ledge, docked above its own
   input: Cosmo at 32px, the working mascot sliding in beside him, plus a persistent 20px
   Cosmo in the panel header. Agent mode leaves `MpiPromptBox` entirely (the toggle becomes a
   third top-bar button), so Phase 4's "Agent mode" bullet below moves to the panel ledge.
   Drawing: `tasks/MPI-843/research/chat-merged.html`; decisions: `tasks/MPI-843/validation.md`.
5. How often "now and then" is for the ledge visits.

## Implementation

### Phase 1: assets — RUNS AFTER PHASE 2 (see Current State, 2026-09-20)

- [ ] Stage the cut-out clips per character under `assets/mascot/{key}/`, named by state
      (e.g. `idle-1`, `greet-2`, `happy-1`, `peek`). Clip ids per state are in `docs/mascot-placement.md`'s
      clip index. Keep the stills as the reduced-motion and first-paint fallback.
- [ ] Close the alpha WebM gap (Settled, above). Then, per clip: GIF Maker -> cut-out ->
      VP9 alpha WebM. Transitions skip the cut-out and ship as plain WebM on black.
      **The cut-out step is already done for the whole set** (2026-09-20, BiRefNet, see the
      correction under Settled): 103 finished GIFs in the Vision project `Cubric Studio GIFs`,
      84 of them background-free. So this step is a **conversion** of existing cut-out frames,
      not a fresh cut-out pass — unless a clip needs re-cutting, in which case SAM3 `name` and
      BiRefNet `background` are both available and neither is ruled out.
- [ ] Check the combined weight of `assets/mascot/` against the portable build.

### Phase 2: shared clip queue — **STARTS HERE** (2026-09-20)

Built against the stills, format-agnostic behind `_poseSrc`, and driven by a duration clock
rather than a media `ended` event — see Current State for why that is not optional.

- [x] One small utility (a slot bound to one element): a pool of clips per state, `random`
      (no immediate repeat) or `ordered`, `loop` or play-once, and a request for the next state
      that takes effect when the current clip ends, unless it is an interrupt (next item).
- [x] **Transition on interrupt.** A request that cannot wait (hover) plays a transition
      overlay at once on a layer above the mascot. At the overlay's densest moment the mascot
      underneath swaps to the requested clip's first frame (the shared rest frame), then the
      overlay clears and the clip plays. The transition is picked at random from the mascot's own
      three. Requests that can wait still swap at a clip's end.
      The transition clips come from MadPony-Identity MPI-78 with their swap time: three per
      mascot, 1s each, rendered on black, so they need no cut-out. Composite them with
      `mix-blend-mode: screen`, which drops the black and keeps soft smoke edges that a SAM3 mask
      would harden.
- [x] Preload a slot's pools and the transitions so the first swap never shows a blank frame.
- [x] Reduced motion: the slot shows the still and never plays.
- [x] Tear down cleanly (timers, listeners) when the owning component unmounts.
- **Verify:** a unit test that a random pool never repeats back to back, a play-once clip hands
  back to the rest pool, a waiting request starts only at the end of the current clip, and an
  interrupt starts the transition at once and swaps at its swap time.

### Phase 3: landing hero crew on the queue

- [ ] `js/shell/heroCrew.js`: rest pool = idle x3 random; hover = random of the two greets;
      ambient = the existing random greet every few seconds on a resting member; click = random
      of the two happy clips. Hover and click go through a transition. Drop `GREET_FOR_MS` /
      `HAPPY_FOR_MS`: clips play to their end.
- [ ] No walking clips on the landing.
- **Verify:** `user-ux`, Fabio on the landing.

### Phase 4: prompt box ledge

- [ ] A ledge layer on the top edge of `MpiPromptBox`
      (`js/components/Organisms/MpiPromptBox/`), bottom-aligned, with the CSS that hides the lower
      part of a head peek behind the box edge.
- [ ] Agent mode: Studio on the ledge for the whole mode. Idle x3 at rest, agent listening while
      the user types, agent thinking while the agent works, agent answer ready when the reply
      lands, then back to idle.
      **MOVED by MPI-843 (open decision 4):** same states, but on the agent PANEL's ledge, not
      the prompt box's. The prompt box has no agent mode any more.
- [ ] Other modes: on model selection, the selected model's mascot (image -> Vision, video ->
      Video) plays its head peek once and leaves. Afterwards it returns now and then at a random
      spot inside a fixed central zone, clear of the image chips and the operation buttons.
- **Verify:** `user-ux`, Fabio in each mode.

### Phase 5: the rest of the spot map

- [ ] Generating card, float latent window, toasts, landing with no projects, engine starting,
      Model Library queued install, History peek, job cancelled, update available, filter with no
      match (MPI-749), gallery scope empty. Clip per spot and the rules for each
      (the float latent window gets getting ready then working, nothing else; waiting spots use
      the working clip) are in `docs/mascot-placement.md`.
- [ ] Flows, once Fabio specifies them.

## Completed

(none yet)

## Remaining Work

Everything above. Blocked on MPI-757 for Phase 1; Phases 2-5 depend on Phase 1 and on the Open
decisions they name.

## Plan Drift

- **2026-09-20 — unblocked, and Phase 1 and Phase 2 swap places.** The card sat `blocked` on
  four things; three landed while it sat there (MPI-760 and MPI-771 closed, the set cut out,
  the transitions rolled), and the fourth — the alpha WebM export — turned out not to gate
  anything. Fabio's call: build the queue first, against the stills, because `_poseSrc` makes
  the queue format-agnostic and the format is better chosen after the motion can be seen.
  Phase 1 (assets) is now the step AFTER Phase 2, and it is a conversion of existing cut-out
  frames rather than a fresh cut-out pass. **Phase numbers were left alone on purpose** —
  other cards and docs reference them, and renaming them to match a new order would break
  those references for no gain. Read the order off `## Current State`, not off the numbers.
- **2026-09-20 — the alpha WebM export still has no card.** It is named in Settled and in
  Phase 1 and it exists nowhere else. It is not needed to start, but it IS needed to finish
  Phase 1 if the format decision stays WebM. Whoever reaches Phase 1 should raise it with
  Fabio rather than assume it exists.

## Verification

**Verify mode:** `user-ux` (the motion and the placement are Fabio's call).

- Phase 2 unit test passes.
- Run in an isolated instance (`npm run app:isolated`), never on `:3000`.
- Fabio checks the landing crew, the prompt box ledge in agent mode and in image and video modes,
  and reduced motion.

## Preservation Notes

- `docs/mascot-placement.md` owns spot and clip choices, **and it now lives in this repo**
  (moved 2026-09-20). Record a decision made here straight into it — there is no longer a second
  copy in MadPony-Identity to keep in step. That repo keeps only the source artwork
  (`plates/`, `sheets/`) and the MPI-78 card's history.
