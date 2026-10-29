# MPI-1336 plan: the window primitive (Infinite Video + windowed Video Edit)

Member of MPI-1134 (Phase 4). Requirements: `research/video-edit-window-needs.md`.
Method notes: `research/motion-context-v2-video.md`, `../MPI-1335/research/viggle-animate.md`,
`../MPI-1134/research/obvpm-bridging.md`.

## Current State (2026-10-29, handoff)

- Bench 1 DONE (Video Edit case, 1344x768, 3 windows): **latent path (arm A) wins** - invisible
  joins, no drift; pixel path drifts -9 % by window 3. `research/bench-2026-10-29-chain.md`.
- Next: Infinite Video case on Singularity v2 (static talking shot, drift), 22-frame context row,
  2K per window + RAM, resume after cancel. Scripts in `research/bench/`.
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
