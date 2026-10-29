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
