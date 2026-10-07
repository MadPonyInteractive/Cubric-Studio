# MPI-1036 - plan

`brief.md` carries the decisions and the numbers; this is the running plan.

**Verify mode:** user-ux

Verification is Fabio's eyes on edited clips, plus measured timings for the mask path.

## Current State

2026-10-06: card opened, nothing built. Next action: Phase 1 on the bench, Fabio at the graph.

## Phase 1 - The hidden instructions, on the bench

**Verify:** Fabio judges each option on 2-3 real clips; the winning instruction text for every
option x {photo, no photo} is written into `brief.md`.

Bench copy of `comfy_workflows/minimax_h3_r2va.json`: the clip as `<Video 1>`, the photo as
`<Picture 1>`. Draft the four options' instructions, two variants each, each ending in "keep
everything else the same". Today's drift (half-applied recolour, a changed dress cut) is the
bar to beat.

Swap the person also gets an A/B on the akatz-ai Character Swap LoRA (`brief.md`): same
clip, seed and 4-5 s shot, base vs +LoRA, each with turbo on and off. Background held and
identity taken from the photo are what it is judged on. Repeat on Swap the head to see
whether the LoRA helps or fights it.

## Phase 2 - The mask path, on the bench

**Verify:** a small-region edit stitched back into the untouched source at source resolution,
and its time against the same edit unmasked.

SAM3 mask in-graph for now -> `InpaintCropImproved` -> H3 -> `InpaintStitchImproved`, as the
Bernini bench did (MPI-711). Mask frame count and rate must match the source, or the stitch
refuses. Grow / fill holes stay upstream in the mask step, never in this graph (MPI-711 decision).

## Phase 3 - Wire the Flow

**Verify:** the `/mpi-add-flow` playbook's own checks, then Fabio runs each option in the app.

Run `/mpi-add-flow`. Fields: clip, optional photo, the picker, the user's extra words, the
optional mask step from MPI-715 (its Phase 1 transport is a hard dependency; its gizmo can
follow). Behind the H3 licence gate. Long-clip warning, no cap.

## Phase 4 - Flow graphics

**Verify:** Fabio approves the tile and hero.

Run `/mpi-flow-graphics`.

## Remaining Work

- [ ] Phase 1 - hidden instructions benched
- [ ] Phase 2 - mask path benched and timed
- [ ] Phase 3 - Flow wired
- [ ] Phase 4 - graphics

## Completed

## Plan Drift
