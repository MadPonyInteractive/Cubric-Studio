# MPI-1331 validation

## Why

Fabio's 13 s masked hat edit ran at 768p on a 768-wide source. Node 63 sized the masked crop at the
Resolution's short edge (768), and `InpaintCropImproved` always resizes to that size, so a ~600 px area of
the source was upscaled to 768 for H3 to render, with no detail gained.

## Change

- New node 230 `Source side the crop covers`: the `MpiMaskSquareBbox` side x1.25 (node 54's
  `context_from_mask_extend_factor`), capped at the frame's short edge, rounded to /32.
- Node 63 = max(512, min(quality size, node 230)). 576p is unchanged (always 512).
- Same edit in the builder (`MPI-1036/research/bench/flow_graph.py`), the API file and the raw LiteGraph
  file (hand-edited: no local ComfyUI for `sync-raw-workflows.mjs`). Node 63 sits only behind the lazy
  `MpiIfElse` 61/62 and node 54, so the whole-frame route still never runs SAM3.

## Evidence (agent)

- Builder output == shipped API for nodes 63 and 230.
- Both expressions run through MpiNodes' own `safe_math`: square 480 on 768x1365 -> 608 at 768p/960p/1080p
  (was 768/960/1088); square 900 on 1080x1920 -> 768/960/1088 (unchanged); 576p -> 512 in every case.
- `npm test`: 3800 tests, 0 fail.

## Not yet checked

- A real masked run at 768p+ on a GPU (the raw file has not been loaded in a ComfyUI frontend either).

## Real masked run (2026-10-29, session "Video Edit Flow Issues 2", Fabio's RTX PRO 4500 Pod)

`ref2v_004` (640x1152, 5.9 s), What to change = 5, target `hair`, "Her hair is bright red.", 768p, SHIPPED graph.
Card `MPI-1331 masked 768p hair` (flowVideoEdit_005, project "MPI-1335 lip bench"). Script: `research/masked_768.py`.

- Ran clean in 216 s (whole-frame 768p on the same clip: ~456 s). Output 640x1152, 141 frames = the source.
- Hair red, everything outside the square kept as filmed (frame check).
- The source's short edge is 640, under the 768p size: node 230 capped the crop, nothing upscaled. Not
  measured directly (no node read-out), inferred from the output and the run time.
- Pod RAM read 58.9 of 62 GB (95%), VRAM 97%, mid-run on a 5 s clip: the masked route's RAM is a problem
  well below 13 s. Goes to windowing (MPI-1336 / MPI-1335).
- Mouth (the hair square covers the face): corr 0.50 with the source, best lag -8 frames; H3 redraws the
  mouth without the soundtrack. MPI-1335's soundtrack fix covers this route too (bench S1).
- Raw LiteGraph file still never loaded in a ComfyUI frontend.
