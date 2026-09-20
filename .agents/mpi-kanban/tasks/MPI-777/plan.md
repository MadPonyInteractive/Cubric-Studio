# MPI-777 - Animated mascots in the app: shared clip queue, landing crew, prompt box ledge

Directions and the why: `brief.md`. Spot map and clip ids:
`../MadPony-Identity/production/cubric-mascots/animations/placement.md`. Re-grep every code
pointer below before editing; they were read 2026-09-16.

## Current State

- Card created 2026-09-16 from MadPony-Identity MPI-78. **Blocked** until the clips are cut out
  and converted, which needs MPI-757's GIF Maker and SAM3 cut-out (MPI-760, MPI-771 still open)
  plus an alpha WebM export, and until the transition clips exist (MPI-78).
- The app still shows stills: `assets/mascot/{key}/{pose}.webp`, one per character, staged by
  MPI-766. `heroCrew.js` `_poseSrc(key, pose)` is the only code that knows a file there, and its
  comment already expects animated alpha loops to replace the stills.
- Next action once unblocked: Phase 1 (the alpha WebM export first).

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

### Phase 1: assets

- [ ] Stage the cut-out clips per character under `assets/mascot/{key}/`, named by state
      (e.g. `idle-1`, `greet-2`, `happy-1`, `peek`). Clip ids per state are in `placement.md`'s
      clip index. Keep the stills as the reduced-motion and first-paint fallback.
- [ ] Close the alpha WebM gap (Settled, above). Then, per clip: GIF Maker -> SAM3 cut-out ->
      VP9 alpha WebM. Transitions skip the cut-out and ship as plain WebM on black.
- [ ] Check the combined weight of `assets/mascot/` against the portable build.

### Phase 2: shared clip queue

- [ ] One small utility (a slot bound to one element): a pool of clips per state, `random`
      (no immediate repeat) or `ordered`, `loop` or play-once, and a request for the next state
      that takes effect when the current clip ends, unless it is an interrupt (next item).
- [ ] **Transition on interrupt.** A request that cannot wait (hover) plays a transition
      overlay at once on a layer above the mascot. At the overlay's densest moment the mascot
      underneath swaps to the requested clip's first frame (the shared rest frame), then the
      overlay clears and the clip plays. The transition is picked at random from the mascot's own
      three. Requests that can wait still swap at a clip's end.
      The transition clips come from MadPony-Identity MPI-78 with their swap time: three per
      mascot, 1s each, rendered on black, so they need no cut-out. Composite them with
      `mix-blend-mode: screen`, which drops the black and keeps soft smoke edges that a SAM3 mask
      would harden.
- [ ] Preload a slot's pools and the transitions so the first swap never shows a blank frame.
- [ ] Reduced motion: the slot shows the still and never plays.
- [ ] Tear down cleanly (timers, listeners) when the owning component unmounts.
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
      the working clip) are in `placement.md`.
- [ ] Flows, once Fabio specifies them.

## Completed

(none yet)

## Remaining Work

Everything above. Blocked on MPI-757 for Phase 1; Phases 2-5 depend on Phase 1 and on the Open
decisions they name.

## Plan Drift

(none yet)

## Verification

**Verify mode:** `user-ux` (the motion and the placement are Fabio's call).

- Phase 2 unit test passes.
- Run in an isolated instance (`npm run app:isolated`), never on `:3000`.
- Fabio checks the landing crew, the prompt box ledge in agent mode and in image and video modes,
  and reduced motion.

## Preservation Notes

- `placement.md` in MadPony-Identity owns spot and clip choices. When a decision is made here,
  record it there too, or tell a MadPony-Identity session to.
