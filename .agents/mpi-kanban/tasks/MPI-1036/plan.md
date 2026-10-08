# MPI-1036 - plan

`brief.md` carries the decisions and the numbers; this is the running plan.

**Verify mode:** user-ux

Verification is Fabio's eyes on edited clips, plus measured timings for the mask path.

## Current State

2026-10-07: card in `doing`, Phase 1 bench ready; waiting on Fabio's runs.

- `G:/CubricModels/loras/minimax-h3/h3_character_swap_pro4500_1000.safetensors` - 155,110,320 B,
  sha256 `4b2a3f42...` matches the repo's `SHA256SUMS`.
- `G:/ComfyUi/ComfyUI/user/default/workflows/H3 Character Swap v1 Ref2VA.json` - akatz-ai's
  example, repointed at the weights we ship: text encoder #128 -> the heretic int8_convrot
  (theirs was nvfp4_awq, reverted by MPI-698 and not on the bench); turbo #145 -> our 8-step v1.0
  (theirs 4-step v0.1), so #144 "Int (Lightning LoRA)" 4 -> 8; swap LoRA #147 -> the `minimax-h3\`
  subfolder. 32 nodes, 35 links, 0 dangling. Turbo off by default (their switch #146).
- A/B: bypass #147 (Ctrl+B) for the base run; same seed (#129 fixed 904234), 4-5 s clip.

2026-10-07 evening: Phase 1 runs C, D, A, E, F, F_depth, F_lineart, G done on the bench (results +
timings in `brief.md`; outputs `D:/WORK/Images/Outputs/mpi1036/`, the bench saves there via
`--output-directory`; inputs `G:/ComfyUi/ComfyUI/input/mpi1036_*`; API builders in the session
scratchpad `charswap_*.py`). Proven: the swap LoRA helps a little (background + overlay kept);
a back view of the character is used; the performance-capture mode (F, raw clip, recipe-shaped
prompt) gives the picture's quality, not the clip's; background-only change (G) works.

2026-10-08: Fabio approved the bench results ("very good, I'm happy") - verdict in `brief.md`.
Wan Animate is no longer a comparison target (MPI-289 rejected).

2026-10-08 (Video edit 6): Phase 2 started on Fabio's pick. Clip: last 3 s of
`C:/Users/Fabio/Videos/Screen Recordings/new (3).mp4` (medium shot -> close-up), staged as
`G:/ComfyUi/ComfyUI/input/mpi1036_ears_last3s_24fps.mp4` (73 frames = 17k+5 at 24 fps, 576x1024,
sound). Edit: cat ears -> small demon horns, and remove them. Builder: session scratchpad
`mask_bench.py` (SAM3_Detect "cat ears" on `sam3.1_multiplex_fp16` -> InpaintCropImproved
512x512, expand 12, blend 16, context 1.6 -> H3 turbo 8-step -> InpaintStitchImproved, source
audio muxed). Mask + crop preview: both ears held in every frame, 75 s incl. SAM3 load.
Runs M_horns, M_remove (masked) and U_horns (whole frame, timing baseline) queued.
Then M2 (mask +32 px + ComposeColorMatch grade match), M3/M4 (Fabio's still square, padding
64/128, + grade match). All results + timings in `brief.md` § Phase 2. Side-by-sides sent to Fabio
(scratchpad `horns_side_by_side.webm`, `remove_side_by_side.webm`, built by `compare_mask.py`).
Fabio's eye test: shape-mask pastes FAIL (ghosting), the box drifted out of sync -> shape masking
dropped. Then the box + swap LoRA (M3l) locked sync (lag 0.00, no edge seam) on horns AND remove;
the camera line and re-sync add nothing on top. Videos `box_horns_side_by_side.webm`,
`box_remove_side_by_side.webm`. Fabio PASSED it (and the plain box re-timed by `resync.py`):
Phase 2 closed, recipe in `brief.md` § Phase 2 recipe, evidence in `validation.md`.

Fabio decided: the mask step is a TEXT field resolved by SAM3 in-graph, box round it - MPI-715 is
NOT a dependency. Next action: Phase 3 - wire the Flow with `/mpi-add-flow`. New parts it needs:
the swap LoRA as a dep, a shipped grade-match node (see `brief.md` § Phase 3 parts check).
Masked mode drops the hidden "no text" line. Also decided 2026-10-08 (`brief.md` § Decided):
video head swap is free once tested; clothing removal stays (own dropdown entry if it needs its
own wording, e.g. a supplied torso image).

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

Run `/mpi-add-flow`. Fields: clip, optional photo, the picker, the user's extra words, an
optional "what to change" TEXT field - filled = masked mode (SAM3 -> square box pad 64 -> H3 +
swap LoRA -> grade match -> stitch, with a hint that it is faster and keeps the rest as filmed),
empty = whole-frame edit. (MPI-715 dropped as a dependency, Fabio 2026-10-08.) Behind the H3
licence gate. Long-clip warning, no cap.

## Phase 4 - Flow graphics

**Verify:** Fabio approves the tile and hero.

Run `/mpi-flow-graphics`.

## Remaining Work

- [x] Phase 1 - hidden instructions benched (Fabio approved 2026-10-08)
- [x] Phase 2 - mask path benched and timed (square box + swap LoRA, Fabio passed 2026-10-08)
- [ ] Phase 3 - Flow wired
- [ ] Phase 4 - graphics

## Completed

## Plan Drift

- 2026-10-08: the talking/acting-clip test through mode F is DROPPED - Fabio: the Phase 1 dance
  runs already carried the face, expressions, mouthing the song in sync and the right audio, at
  a distance from the camera, so performance capture's face/lip-sync question is answered.
- 2026-10-08: Phase 2's shape-mask paste (the plan's InpaintCrop/Stitch round the SAM3 mask) FAILED
  on Fabio's eye (ghosting); the still square box + swap LoRA replaced it. The swap LoRA is no
  longer swap-only: it locks H3's timing to the source for every masked edit.
