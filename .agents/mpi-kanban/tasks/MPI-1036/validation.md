# MPI-1036 Validation

## Phase 1 - hidden instructions on the bench

Fabio approved the eight bench runs on 2026-10-08 ("very good results, I'm happy"); verdict and
numbers in `brief.md` § Fabio's verdict.

## Phase 2 - mask path on the bench

Passed on Fabio's eye test, 2026-10-08: the still square box (SAM3 -> `MpiMaskSquareBbox` pad 64)
with the akatz-ai swap LoRA, on horns and on remove; also the plain box re-timed by `resync.py`.
Every shape-mask paste failed (ghosting); the plain box drifted out of sync.

Measured, reproduce with the session scratchpad scripts (`mask_bench.py NAME`, `lag.py NAME`,
`compare_mask.py OUT NAME=path ...`) against `D:/WORK/Images/Outputs/mpi1036/`:

- Sync, mean frames off in the fast part (frames 5-34), `python lag.py M3_horns M3l_horns`:
  plain box 2.27, box + swap LoRA 0.00 (remove: 2.57 -> 0.00).
- Time, bench log "Prompt executed": box + LoRA 185 s vs whole frame 422 s (sampling 12.3 vs
  44 s/step) on a 576x1024, 73-frame clip.
- Drift inside the box vs source (`compare_mask.py`): plain box 5.09/255, box + LoRA 2.97/255.

Side-by-sides sent to Fabio: `box_horns_side_by_side.webm`, `box_remove_side_by_side.webm`,
`labelled_horns_side_by_side.webm` (session scratchpad).
