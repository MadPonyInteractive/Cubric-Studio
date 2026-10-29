# MPI-1336 plan: the window primitive (Infinite Video + windowed Video Edit)

Member of MPI-1134 (Phase 4). Requirements: `research/video-edit-window-needs.md`.
Method notes: `research/motion-context-v2-video.md`, `../MPI-1335/research/viggle-animate.md`,
`../MPI-1134/research/obvpm-bridging.md`.

## Current State (2026-10-29, Infinite video 3)

- **Tail mask SHIPPED in MpiNodes `3ef5c5d`**, pinned via Strip Node Packs 6's pin `4d8b87e` (MPI-1343),
  which sits on top of it. Optional inputs, so unwired graphs are unchanged.
  `MpiH3MaskedPrefix` optional `tail_latent` + `tail_frames`: writes the next clip's first steps into the
  target's end, masked, video + audio. Raises when (total - tail steps) % 5 != 0 (VAE period-5 packing) or
  the target length is not divisible by 3 (audio clock): bridges must be 39+51k frames, **192 = 8 s** is the
  first that holds 39 + 39 with room. Test `tests/test_h3_bridge.py` (6 cases). README/changelog rows NOT
  written: both files claimed by two MpiNodes peers; add the row when they release.
- **Bridging bench DONE, 2 runs** (`research/bench-2026-10-29-bridging.md`): drift CURED (backdrop 86-99 over
  25 s, no trend, vs chain 69 + brown + 16x speckle); held ends exact. But roots do not align on Singularity
  (ref2va pins no frame; openings differ 33-39/255), so every bridge hard-cuts into the next root. A short
  bridge prompt ALSO cut after the head; the full scene prompt fixed that. **Next action:** pin each root's
  first frame (video-only 1-step head on MpiH3MaskedPrefix, phase-exact) to one start frame, re-run r1, r2,
  b0, b1 with the scene prompt. Awaiting Fabio's go.
- Run detail (`bench/run_bridge.py r1 r2 b0 b1`, log `bench/run_bridge.log`): root 0 =
  bench 2's `inf_A_w0` (same seed/line), roots r1, r2 at 124 frames, bridges b0, b1 at 192 frames
  (39 held + 114 new + 39 held), short bridge prompt. Assembly r0 + b0[39:153] + r1 + b1[39:153] + r2 =
  600 frames (25 s); `bench/bridge_seams.py` measures backdrop corners / speckle on it AND on the
  6-window chain the same way. Output `input/mpi1336/bridged_inf.mp4`.

## Earlier state (2026-10-29, handoff)

- Bench 1 DONE (Video Edit case, 1344x768, 3 windows): **latent path (arm A) wins** - invisible
  joins, no drift; pixel path drifts -9 % by window 3. `research/bench-2026-10-29-chain.md`.
- Bench 2 DONE (Infinite Video, Singularity v2, static sheriff, 3 windows, arm A): joins invisible, but
  the backdrop steps ~3.5 % darker at EACH join (-6 % over 3 windows); nothing pins a ref2v chain.
  Long Infinite Video needs a colour anchor or bridging. `research/bench-2026-10-29-infinite.md`.
- 6-window chain DONE: drift compounds and speeds up (backdrop -27 %, brown, speckled noise by window
  6 ~23 s) while every join stays clean and the face holds. Plain chaining is good for ~3 windows
  (~13 s) on a static shot. The reference image was in every window and did not stop it. Next bench:
  re-anchoring - grade-match to window 1, and bridging (roots from the reference).
- 2K per window, partial answer from New H3 Upscaler 1 (MPI-1348, closed): a 124-frame window refined to
  2560x1408 through the shipped fl2va stage 2 FITS the 4060 Ti 16 GB (peak 15.6-16.0 GB whole card,
  MpiWindowedSampler 2 x 73 frames, refine ~12.7 min + stage 1 at 1280x704 ~4.5 min).
  `../MPI-1348/research/results.md`. Still open: a chained window (prefix held) through that refine,
  and RAM.
- Next: 22-frame context row (node change first), 2K per window + RAM (local 16 GB only), resume
  after cancel, longer chain (6+ windows) to see if drift keeps compounding. Scripts in `research/bench/`.
- Video Edit's graph changed after bench 1 (soundtrack into H3 via nodes 300-303, pad up / cut back
  via 30, 305-314, 123, 130; `../MPI-1335/research/lipbench/P1_padup.json`). Windowed: each window
  feeds H3 its own audio slice; pad-up on the LAST window only. Re-bench Video Edit on that graph.
- Peers: Video Edit Flow Issues 3 (MPI-1335) tests the winner; New H3 Upscaler 1 (MPI-1348) refines
  our chained latents to test seams after a 2K refine and has the local GPU now - ask before using it.

## What the research already settles (2026-10-29)

- **Motion Context V2 is what we already own.** `MpiH3MaskedPrefix` (ComfyUi-MpiNodes `h3.py`)
  writes the prior clip's encoded tail, video AND audio, into the head of the target latent and
  masks it out of sampling. Context lengths 39 / 90 / 141 frames (the only ones on both the 17k+5
  grid and the 40 Hz audio clock). It ships in Extend Video's H3 arm (`flow_h3_extend.json`, with
  `MpiH3EncodeAV`). No need to buy or download the Gumroad workflow.
- **`MpiWindowedSampler` is not a chaining method.** It windows a REFINE over a latent that is
  fully resident (`docs/models/h3/windowing.md`): it cuts sampling peak, not clip-length memory,
  and its windows cannot disagree because motion was decided upstream. It stays as a refine
  tool; it is not a bench arm.
- **Viggle five_frame_anchor** is the pixel-path variant of the same idea (decode, re-encode the
  last 5 frames), on a different model. Its useful part for us is the loop: one chunk resident,
  each chunk's latent checkpointed to disk, resume after a crash or cancel.
- **Known risk: chained extends drift** on static shots (OBVPM research: colour/contrast creep
  after ~6 extends, pixel path worse). Video Edit is less exposed: every window re-reads its own
  slice of the source video, which pins the content.

## Bench (needs Fabio's go; local 16 GB card, no rented GPU)

Two arms, both `MpiH3MaskedPrefix`, windows of 124 frames (5.17 s), context 39 frames
(advance 85 frames per window):
- **A, latent path:** the sampled latent's tail feeds the next window directly, no VAE round trip.
- **B, pixel path:** decode, `MpiH3EncodeAV` the tail, feed it (today's Extend Video route).

Cases:
1. **Video Edit (v2v swap):** a 15 s speech clip, 3 windows, each fed its source-video slice and
   its frame-aligned audio slice; last window padded up and cut back. Measure: output length ==
   input, seam visibility (frame-difference spike at each join vs the clip's mean), mouth lag per
   window vs the source, output audio at the joins.
2. **Infinite Video (ref2v):** one reference, a static talking shot (worst drift case),
   3 windows. Measure colour/brightness drift first window vs last.
3. **Memory:** each case at 1344x768 and at 1920x1088. Peak VRAM and RAM per window. That's
   Fabio's "2K may fit on 16 GB in 5 s windows" question.
4. **Resume:** cancel during window 2; the rerun must start at window 2 from the saved latent.

Run on the local bench under `gpu_lease.py`, never the user's app. Time: unmeasured; rough guess
2-4 min per 1344 window and more at 2K, about 1-2 GPU hours in total. No money spent.
Done when: a table per arm x case x size, plus the seam clips for Fabio's eye and ear.

## Then

Build the window loop (window plan, per-window source + audio slice, prefix, checkpoint, resume,
pad-and-cut on the last window) as one shared primitive. Video Edit (MPI-1335) uses it first;
the Infinite Video Flow next. Lip sync on ONE window (MPI-1335 step 2b) runs before any of this
ships, because windows repeat whatever one pass gets wrong.

## Next: bridging bench (Fabio's go, 2026-10-29; colour match REJECTED)

Fabio by eye: the chain broke at the END of window 3 with JPEG-like artefacts, and every window after
inherited and amplified them. Colour matching cannot fix texture, so it is dropped. Method source:
`../MPI-1134/research/obvpm-bridging.md` (technique 2).

- **Shape:** roots = independent windows from the reference, SAME seed + duration + canvas (same
  noise gives the same framing); bridges = windows whose HEAD is the previous root's tail and whose
  TAIL is the next root's head, both masked, so only the middle is sampled. No frame is ever more
  than one hop from a clean root, so an artefact cannot spread past its two bridges, and one bad
  root is redone alone.
- **Engine gap:** `MpiH3MaskedPrefix` only masks the HEAD. A bridge needs a head AND tail mask
  (the noise mask is per frame, so a tail option on our own node is the likely route, in
  ComfyUi-MpiNodes via /mpi-nodes-sync). `ComfyUI-H3-Motion-Context` on the bench is GPL-3: ideas
  only, never copied.
- **Where it can break the flow (Fabio's question):** (1) roots all restart from the reference
  pose and framing, so a shot where the subject MOVES through space (walks off, camera travels)
  gives bridges two very different states to join: a teleport or hard cut. Bridging is for
  held/static shots; moving shots drift less and suit plain chaining (the "static shot" switch).
  (2) A detailed bridge prompt makes H3 hard-cut at the start; too little room makes it hard-cut at
  the end (OBVPM: a 6-8 s beat needed a 12 s bridge). Keep bridge prompts short ("single
  continuous shot, no cuts; he says: <line>"). (3) Roots render first, so the video does not grow
  in time order while it runs. (4) With one user prompt, roots repeat the same action; each root
  needs its own beat (an LLM split of the prompt).
- **Bench:** sheriff, 3 roots + 2 bridges, Singularity, same settings as bench 2; compare the backdrop
  per window against the 6-window chain, and the joins by eye. Window sizing per bridge (124 vs
  more frames) to be set after reading the masking code.

## Fabio's decision (2026-10-29, later): a generation setting, never a Flow; NO upscale phase

Infinite Video is NOT a Flow. It is part of generation: a prompt-box toggle plus a number input for how long the video should be (it REPLACES the duration
slider while on; the slider itself caps at 15 s for every video model, Fabio 2026-10-29 - H3's
trained range tops out at 15.1 s, MpiH3Length),
adopted by every model and Flow that runs MiniMax H3, so no job in the app is time-limited. UI and
wiring to be brainstormed with Fabio later; "the Infinite Video Flow" elsewhere in this plan means this.
Every finding goes to research here AND to `docs/models/h3/windowing.md`, written so it carries over to
making LTX 2.5 infinite later.

Infinite Video generates its windows at the base size and stops. Upscaling is the Upscaler Flow's job
(H3 upscaler coming there, already windowed, so any length works on small cards, just slowly). Reason:
an upscale pass is one more place to drift and to show seams. So "2K per window" and "a chained window
through the refine" are NOT Infinite Video questions; they matter only for Video Edit (MPI-1335).

## Fabio's direction (2026-10-29)

- Static camera + still character is where chained extends drift (OBVPM research). The fix we
  already have on paper is **bridging** (`../MPI-1134/research/obvpm-bridging.md` technique 2:
  render roots, then fill the clips in between from both neighbours' context). Possibly a user
  switch ("static shot" boolean) that picks bridging over plain chaining; best approach TBD
  after the bench.
- The Infinite Video case runs on Singularity v2 (what ships), not 1.3 as in the video.
- Add a 22-frame context row (the video's value) next to our 39: does the off-step audio drift?

## Open questions (not blockers)

- Is Motion Context V2's "max" mode on its Multi-Track Editor node something beyond a latent
  prefix? Only the paid workflow says; skipped unless arm A shows seams.
- A refine pass after chaining shows seams (Motion Context author). If 2K does not fit as a single
  pass per window, Video Edit needs a per-window refine with the prefix held, an untested case.
