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
- **Phase 1 is DONE (2026-09-21).** 95 of the 103 clips are staged as
  `assets/mascot/{key}/{state}.webm`, VP9 alpha, 13.7 MB for the whole set, built by
  `scripts/stage-mascot-clips.mjs` off the table in `docs/mascot-gif-manifest.md`. The stills
  stay as the fallback. The 8 unstaged are the documented spares, not unlabelled clips.
- **The single-copy risk is still OPEN, and Phase 1 did NOT close it.** A 303 MB git backup of
  the 103 originals into `MadPony-Identity` was built, rejected by Fabio and reverted on
  2026-09-21; the copies are deleted and the originals are untouched. The GIFs are only a middle
  step anyway — the masters are the video cards in the `Cubric Studio Mascots` project, 2.8 GB
  and 8,373 files on the same one machine. Whatever answers this is not a git commit, and it is
  not part of this card.
- **Phase 3 is BUILT and Fabio has seen it (2026-09-22): "the animations look good, and they
  are well connected."** The queue, the pools, the swap timing, the sizing and the footing are
  accepted. Two changes came out of that look — one done, one handed on:
  - *Done:* hover no longer plays a transition, only a click does. The queue took a
    per-request `transition` flag for it; the hover still interrupts, it just cuts straight
    to the greet.
  - *Done 2026-09-22 (Phase 3b):* **the transition overlay composites.** It painted a black
    square because the clips were opaque VP9 on black relying on `mix-blend-mode: screen`,
    which Chromium skips on a `<video>` it has promoted to its own layer. The blend is gone;
    `scripts/stage-mascot-clips.mjs` keys the black into an alpha plane instead
    (`a = max(r,g,b)`). 43.7% → 0.0% near-black over the mascot, validation.md § Round 3.
- **Phase 3b is BUILT and Fabio has LOOKED (2026-09-22): "everything looks great".** Three
  things came out of that look and are done - the puff now TAKES the character (he vanishes
  as it starts and fades back in under its densest moment, via a `--vanished` class on the
  member and a new `.mpi-landing__crew-body` wrapper that exists so the overlay is not
  hidden with him), the agent ledge is the HEAD PEEK clip bottom-aligned to the rule instead
  of a standing clip hung by the crew's constants, and its top is no longer sheared. A
  fourth is NOT mine: the agent introduces itself as "Cubric" and should say Cosmo
  (`services/agentLoop.mjs:1271`), which a live peer claims - message `8cd24a3c` sent, and
  told to Fabio. Evidence: validation.md § Round 4.
- **Phase 3b is VERIFIED (Fabio, 2026-09-22): "Everything looks good."** The vanish, the
  peek ledge and the unsheared top all seen. He asked about cycling the ledge between
  peeks: Cosmo has ONE approved peek (`i2v_068`; `i2v_063` was superseded by him on
  2026-09-16), so it stays a single loop - his call, "let's not get caught up in doing
  more". Do not re-raise. The Cubric->Cosmo prompt line is still the MPI-890 peer's
  (message 8cd24a3c re-targeted to the FILE 2026-09-22; Fabio says the successor is "Agent 36").
- **Phase 4A BUILT (2026-09-22), Fabio's look outstanding:** the agent panel's crew ledge in
  `MpiAgentChat.js` - the landing's `__ledge` reused at `--ledge-w: 115px` on a fixed 52px
  `__crew` row, a 20px `studio/logo` in the header (label now "Cosmo", per the drawing), and a
  guest slot for the NEWEST running generation (`generation:started` -> terminal events;
  mascot by `getCommandAccent`, verb by `getCommandProgressLabel`). Clips play only while
  the panel is open away from the landing (`_seen`/`_syncPlay`, both modes now). Evidence:
  validation.md § Phase 4A. **Next: 4B**, the prompt box ledge - blocked on the da9175f5
  claim on `MpiPromptBox.js/.css` (heartbeat 06:05Z, stale; message 2568a53a sent).
- **Fabio's look at 4A (2026-09-22): REWORK - "too boring".** Screenshot in the live app: the
  52px row with two small head peeks is not enough. His words, in order:
  1. The ledge must be **TALLER**. Cosmo has more clips rolled than any other mascot.
  2. It must play the **other animations** - the generating/working and agent-state clips
     (agent-thinking, agent-listening, agent-answer-ready, working, getting-ready, idle x3,
     happy, greet ...), not head peeks. "If we just go with head peeks, not much happens."
  3. **Full standing figures, FEET ON THE INPUT BOX**: the ground line where their feet stand
     sits on the composer's top rule. So frame by the FEET row (measure each clip's bottom
     alpha row), not the head row - the opposite of the landing peek.
  4. **Head peeks belong over the PROMPT BOX, "every now and then"** - i.e. that is 4B, not
     the panel. The panel should not use `peek` at all.
  What stays from 4A: the fixed-height row (just taller), the guest slot + its data source
  (newest running generation, `getCommandAccent`), `_seen`/`_syncPlay` gating, the header
  20px Cosmo, the spec's 0-play guard. Likely wants the shared `mascotClipQueue`
  (Phase 2) to rotate idle pools and state clips, as heroCrew does, instead of two loops.
- **Phase 4A REWORKED (2026-09-22), Fabio's look outstanding.** Full standing figures on a
  112px ledge, feet on the composer's top rule (measured per clip, `_FEET`), Cosmo driven by
  `mascotClipQueue` (idles + agent-listening, thinking, answer-ready, greet, happy), guest on
  its `working` clip. validation.md § Phase 4A rework. Not used for Cosmo, on purpose:
  `working`/`getting-ready` (those read as the guest's job / engine start) - add if Fabio
  wants them. **Open, same card:** the landing ledge's thinking swap flakes 6/20 on HEAD
  (play() not settling in 5s, probably behind heroCrew's clip warm-up) - undiagnosed.
  4B still blocked: no reply on message 2568a53a.
- **Fabio's look at the 4A rework (2026-09-22): "It looks good, though" - feet on the rule and
  the size are accepted. Four changes, for a FRESH session:**
  1. **Flicker on every clip swap** ("flickers to nothing for a few ms"), which the landing
     does not do. Hypothesis, unproven: `.mpi-agent-chat__crew-clip` has an opacity
     `transition` (200ms) so the a/b swap crossfades through a dim midpoint; the landing's
     `.mpi-landing__crew-clip` swap is instant. Compare the two CSS rules first, and whether
     `show()` fires before the next clip has a painted frame.
  2. **Click Cosmo -> a different animation, e.g. the explosion transition** as on the landing
     (`heroCrew` click = `happy` with a transition overlay; needs an fx layer + `paintTransition`
     and `TRANSITIONS` swapAtMs for studio: smoke 583, explosion 333, third 333).
  3. **Thinking/processing = the clip where he SITS AT THE KEYBOARD** (probably `working` or
     `connecting-laptop` - look at the studio clips, do not guess), not agent-thinking.
  4. **State-driven, not a rotation.** "Right now it is just going through all the animations,
     not leaving anything new for the user to check out." Different clips at different points
     of the conversation (looking at images, thinking, prompting...), and the GUEST should
     reflect what the agent is DOING: Lingo when it is writing a prompt, Prism when it is
     looking at images - not only the running generation's mascot. Source: the agent's own
     SSE (`agent:tool` label/name, `agent:working`, `agent:message`, `agent:result`) - map
     tool names to mascot + clip. Guests should vary too (working / getting-ready / heads-up /
     happy), not always one loop. Keep idle rotation for true rest only.
- **Phase 4A round 2 BUILT (2026-09-22, session 4b24af0e), Fabio's look outstanding:** all
  four asks + his fifth (the transition was not centred - lowered 60/620 on the landing and
  the panel, measured). Flicker = the clip's opacity transition, removed. Click = puff +
  cheer. Thinking = `studio/working` (keyboard). `agent:tool` drives Cosmo and the guest
  (look -> Prism, generate -> Lingo), job guests arrive/work/leave on how it ended.
  validation.md § Phase 4A round 2. Still open: landing thinking-swap flake, 4B claim,
  DOC DRIFT question (event map now also has agent:tool driving the crew).
- **Fabio's look at round 2 (2026-09-22): "it seems to be good" - BUT Cosmo still flickers
  on SOME swaps, not all.** Undiagnosed. The opacity fade is gone, so it is not that. Leads,
  unproven: (a) swaps between clips with a different `--feet` (working 582 vs 557) - the
  new clip is repositioned in the same frame it goes live?; (b) `working` does not share
  the rest frame (a desk), so its entry/exit is a real jump that reads as a flicker;
  (c) `show()` flips on play() resolve, which can come before a PAINTED frame - try
  `requestVideoFrameCallback` before flipping; (d) a `_probe` length cutting the tail.
  Find WHICH swaps flicker first (log from->to per swap, watch live) before fixing.
  Also fixed after his look: the guest timer read `29835225:08` when a job took the slot
  from a tool guest (clock never started) - spec regression, proved red on the old line.
- **Round 3 (2026-09-24, session "Mascots 12"): flicker ROOT CAUSE, proved on SCREENCAST
  frames of the real app** (a static-page rVFC count said "fixed" and Fabio still saw it -
  never trust that proxy again). A video going opacity 0 -> 1 draws NOTHING for one frame;
  dropping the old clip in the same frame left the mascot region at 0 px for one frame at
  ~half the swaps, landing AND panel. Fix = `handOverClip` (heroCrew.js, used by
  MpiAgentChat.js): the new clip shows on its first presented frame, the old one holds its
  last frame until the new one's NEXT frame (bounded 250ms for a window that is not drawing).
  Second cause, panel only: its nominal `ms` were 2200/1250 against real 5200/3000, so the
  first clips after opening cut mid-motion - set to the real lengths. Also: `_setLedge` seq
  guard (the landing flake). After: 0 blank frames, 0 double images over 84 swaps.
  validation.md § Round 3 flicker. **Next: Fabio looks again, panel + landing.**
- All three of the original Phase 3b items landed: the
  overlay composites (above), the crew labels carry the mascot names (Lingo, Prism, Cosmo,
  Reel, Vinyl — which narrows MPI-846's "chrome labels stay role nouns", recorded there and
  in `docs/shell.md`), and the landing agent slot lost the 48px still and the "Ask me
  anything" lettering for Cosmo peeking over the block's top rule with the composer on the
  line. Evidence: validation.md § Round 3.
- **"Some animations are cut off before they finish" (Fabio, 2026-09-22) was MEASURED and is
  not a bug.** Every clip that is allowed to finish plays to its end; the only two cuts are
  the deliberate interrupts, and Fabio's call on the naked one (hover) is that cutting
  straight in is fine, just never with a transition. No code changed. Do not re-open it on a
  hunch about clip lengths — the table is in validation.md § Round 3.
- **Next action: Phase 4**, the two ledges. Note the landing agent slot above is NOT one of
  them: it is the standalone chat on the landing. Phase 4 is the agent PANEL's ledge (Cosmo,
  per MPI-843) and the prompt box's. The `__ledge` block built for the landing is the
  obvious thing to lift for the panel's.
- **Then Phase 4**, the two ledges — the agent panel's (Cosmo, per MPI-843) and the prompt
  box's (the selected model's mascot peeking). Different surfaces, and the agent one still
  cannot show a failed state until Fabio re-rolls `i2v_016`.

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

### Phase 1: assets — DONE 2026-09-21 (ran after Phase 2, see Current State)

- [x] Stage the cut-out clips per character under `assets/mascot/{key}/`, named by state
      (e.g. `idle-1`, `greet-2`, `happy-1`, `peek`). Clip ids per state are in `docs/mascot-placement.md`'s
      clip index. Keep the stills as the reduced-motion and first-paint fallback.
- [x] Close the alpha WebM gap (Settled, above). Then, per clip: GIF Maker -> cut-out ->
      VP9 alpha WebM. Transitions skip the cut-out and ship as plain WebM on black.
      **The cut-out step is already done for the whole set** (2026-09-20, BiRefNet, see the
      correction under Settled): 103 finished GIFs in the Vision project `Cubric Studio GIFs`,
      84 of them background-free. So this step is a **conversion** of existing cut-out frames,
      not a fresh cut-out pass — unless a clip needs re-cutting, in which case SAM3 `name` and
      BiRefNet `background` are both available and neither is ruled out.
      **The "gap" was never a missing tool** — it is one ffmpeg invocation, and it now lives in
      `scripts/stage-mascot-clips.mjs`. The transitions are detected as opaque at staging time
      and encoded without an alpha plane, so no list of which ones they are has to be kept.
- [x] Check the combined weight of `assets/mascot/` against the portable build.
      13.7 MB of clips on top of the 15 MB `assets/` tree. As GIF the same set would have been
      ~57 MB, which is the other half of why the format went WebM.

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

### Phase 3: landing hero crew on the queue — BUILT 2026-09-22, Fabio's check outstanding

- [x] `js/shell/heroCrew.js`: rest pool = idle x3 random; hover = random of the two greets;
      ambient = the existing random greet every few seconds on a resting member; click = random
      of the two happy clips. Hover and click go through a transition. Drop `GREET_FOR_MS` /
      `HAPPY_FOR_MS`: clips play to their end.
- [x] No walking clips on the landing.
- **Verify:** `user-ux`, Fabio on the landing.

### Phase 3b: what Fabio asked for after seeing Phase 3 (2026-09-22)

- [x] Hover reaches the greet with no transition; only a click plays one.
- [x] **The transition overlay composites instead of painting a black square.** The black now
      comes off at STAGING time: `scripts/stage-mascot-clips.mjs` keys it into an alpha plane
      (`a = max(r,g,b)`, then the same unpremultiply every cut-out clip gets), and
      `.mpi-landing__crew-fx` carries no blend. Do not re-add one — Chromium will ignore it.
      `--verify` gained a keyed-clip branch, proven red on an unkeyed encode.
- [x] Crew labels carry the mascot names (Lingo, Prism, Cosmo, Reel, Vinyl). Recorded on
      MPI-846 by message and in `docs/shell.md`.
- [x] The landing agent slot: Cosmo peeks over the block's top rule and the composer sits on
      the line. He follows `currentPage` — this chat is mounted once at boot and never
      destroyed, so without that his clips would decode behind an open project for ever.
- **Verify:** `user-ux`, Fabio on the landing.

> **2026-09-24, on closing MPI-777 (Fabio):** 4B moved to MPI-909; Phase 5 split into MPI-906 (waiting spots), MPI-907 (toasts), MPI-908 (empty and one-off states); Flows stay undecided under MPI-846.

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

- **Phase 3 (2026-09-22)** — `js/shell/heroCrew.js` on the queue, plus the geometry in
  `styles/shell/landing.css` and the rewritten `docs/shell.md` § heroCrew.js. Evidence in
  `validation.md`; Fabio's look at the landing is still outstanding.
- **Phase 2 (2026-09-21)** — `js/utils/mascotClipQueue.js` + 8 unit tests, every rule proven RED
  on a broken version. No consumer until Phase 3.
- **Phase 1 (2026-09-21)** — `scripts/stage-mascot-clips.mjs` and the 95 staged clips under
  `assets/mascot/{key}/`, plus the originals backed up. Evidence in `validation.md`.

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

- **2026-09-21 — the clips, MEASURED.** This is the note `## Current State` pointed at from
  2026-09-21 and which was never actually written down; it lived only in handoff `4364eec5`.
  103 GIFs, 0.317 GB, **all 10 fps** (the source clips were 24), 98 at 768x768 plus four
  1536x640 and one 1920x768, median 2.5 MB, max 18.7 MB. 84 carry transparency and 19 are
  opaque — the opaque ones are the transitions and are MEANT to be, rendered on black and
  composited with `mix-blend-mode: screen`. The cut-out alpha is **1-bit**: no partial alpha
  value in any frame sampled. That confirms the 2026-09-16 WebM decision rather than reopening
  it.

- **2026-09-21 — Phase 1 shipped, and three things in the plan above were wrong.**
  1. *The 8 clips reading `mascot: "?"` never needed Fabio.* They are already resolved in
     `docs/mascot-gif-manifest.md` § Spares: `ref2v_001` and the three first gallery peeks
     (superseded by peek 2), plus four transition rolls beyond the 15 picks. Unassigned spares,
     not unnamed mascots. The handoff carried this as a question for Fabio; it was not one.
  2. *The missing alpha WebM exporter was not missing.* It is one ffmpeg invocation
     (`-c:v libvpx-vp9 -pix_fmt yuva420p`), measured at 1.4 s per clip. Three separate places
     recorded it as a blocker.
  3. *VRAM points the opposite way to the intuition.* Fabio's question — surely video is heavy
     on VRAM, and VRAM is what ComfyUI needs — turned out to favour WebM. Chromium holds a
     decoded animated GIF as GPU textures (~305 MiB for five mascots at the landing's draw
     size, 9 runs), while alpha VP9 is **software**-decoded (`VpxVideoDecoder`,
     `kIsPlatformVideoDecoder=false`) and measured ~13 MiB, inside the empty-window noise.
     CPU for that software decode: 0.7% vs GIF's 0.5%. This matters for Phase 3 specifically,
     because the queue preloads a slot's whole pool.

- **2026-09-21 — a rim Fabio caught by eye, which no test was looking for.** The first encode put
  a faint light outline around every character. It was not the codec and not the bitrate (crf 20
  was no better): scaling **straight** alpha smears body colour into the transparent ring.
  `premultiply → scale → unpremultiply` fixes it and makes the file smaller. `--verify` now
  guards it, and the guard was proven red (+7.26) on a deliberately un-premultiplied encode.
  The first version of that check used an absolute threshold and produced two false failures —
  an absolute threshold cannot tell a rim from honest antialiasing, because a light-edged
  character legitimately reads brighter than the page. It compares against a reference downscale
  instead.

- **2026-09-21 — the backup half of Phase 1 was built and thrown away, and the checklist item it
  was meant to tick is open again.** The plan treated "stage the clips" and "stop the 103 GIFs
  being single-copy" as one job. They are not. Staging produces 13.7 MB the app needs; the backup
  is 317 MB the app never touches, and Fabio rejected committing it. Two things were learned by
  being wrong about it:
  - *The 317 MB is not a bad export.* Dither on and off both give 3.94 MB for one 768x768 51-frame
    clip; 78% of opaque 2x2 pixel blocks are non-uniform. These are an AI video model's renders of
    vector art, so LZW has no runs and the palette fills with near-duplicate shades. 128 colours
    takes that clip to 1.16 MB with no visible change — the same reason the WebM set is 13.7 MB.
  - *The GIFs are the wrong thing to back up.* They are a middle step; the masters are the video
    cards in `Cubric Studio Mascots`, 2.8 GB and 8,373 files, on the same single machine. A
    backup card should aim at those, not at these.

  Do not re-attempt a git backup of the GIFs on this card.

- **2026-09-22 — Phase 3 met three things the plan did not describe, all measured.**
  1. *A clip is not a crop.* The `.webp` stills are tight crops of the character; a staged clip
     is a 620×620 **frame** with the character standing in rows 187-556 (370 tall, x ~170-448).
     Dropping a clip into the still's box drew every mascot at 0.60×. The fix is two constants
     in `landing.css` — `620/370` tall, hanging `64/370` below the floor — and they are safe to
     hardcode because the numbers are identical across all five mascots and every clip opens on
     the same rest frame. The member also needs an explicit `width`: it used to be sized by the
     `<img>`'s intrinsic width, and the contact shadow and floor glow are percentages of it.
  2. *One `<video>` blinks.* Assigning `src` to the visible element blanks it until the first
     frame decodes. Two stacked videos, the hidden one loading and starting before they trade,
     with a sequence guard so an overtaken `play()` promise cannot flip them back.
  3. *Clip lengths are per clip AND per mascot.* Vision's `idle-3` is 4.1s where Video's is
     5.2s. A hand-written table is 40 numbers a re-encode invalidates silently, so `_warm`
     reads `loadedmetadata` and writes the real value into the object the queue times against
     — the queue re-reads `clip.ms` at every `_enter`, so nothing in it had to change. The
     transitions' **swap** times are the exception: they are not derivable from the file, so
     `TRANSITIONS` copies `docs/mascot-transitions.md` § Picks and is the only copy.

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
