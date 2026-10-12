# MPI-1101 brainstorm (Fabio, 2026-10-12) - running record

## Settled

- **A Flow, not an Image-workspace tool** (Fabio: another tool would pollute the workspace).
  Steps: 01 Inputs · 02 Edges · 03 Generate.
- **02 Edges**: the picture with FOUR handles, one per side; each sets how far in from its edge is
  repainted, in % of that side, default 10% every side (= a full tile). Top + bottom to 0 = left-right
  only (the 360 pano case: its poles must never join); left + right to 0 = top-bottom only.
- **03 Generate**: a Tiles slider 1-4 under the result. 1 = the result alone; above 1 it repeats on the
  joined axes only: left-right = a wide strip, top-bottom = a tall column, both = a grid.
  Proposed (not yet confirmed): the grid counts per side (2 = 2x2); the same slider on 02 to see the
  broken source seam before a run.
- **No new ComfyUI nodes**: the roll is a lossless pixel shift the app can do (sharp); the repaint is a
  masked inpaint of a band round the centred seam; then roll back. After a roll by n/2 the original's
  leading-edge strip lands at [n/2, n/2 + lo*n) and its trailing-edge strip at [n/2 - hi*n, n/2):
  band = [n/2 - hi*n, n/2 + lo*n).
- **One model, not a picker** (Fabio): add others only if it fails a lot. WHICH one is decided by a
  bench (option B): Klein 9B (Fabio's pick, fast, proven on Outpaint) vs Krea 2 (the model the 360
  Pano Flow's seam passes actually run - `flow_pano360.json` nodes 22 / 58, roll + seam mask +
  partial denoise 0.45 / 0.55, with the 360 LoRA).

## The bench (`bench/`) - WAITING for Fabio's go (the GPU blocks everyone else)

`bench/run_bench.sh` under the GPU lease (command in its header): 2 Klein t2i sources (stone, fabric)
+ 16 repaints = 4 sources x {klein9b, krea2 turbo} x seeds {42, 7}, each through the app's own
inpaint branch (`Input_wf_type` 5), then CPU post: roll back, wrap metric (step across the wrap /
mean neighbour step, ~1 = seamless), max change outside the band (must be 0), tiled contact sheets
`sheet_<source>.jpg` in `G:/ComfyUi/ComfyUI/output/mpi1101/`.

Sources: the broken-wrap pano `X2.3 references/convertTo360Pano_001.png` (8K, wrap 6.3x; 1.8x once
benched at 2048x1024, left-right only), a hand-held jar photo (`Big Photos Test/imported_001.jpg`,
1024x768, both), stone + fabric (1024, both). Bands: 20% of the frame (pano), 35% (cross).
CPU halves dry-run 2026-10-12 with stand-in images: titles exist in both graphs, outside-band change
0, wrap metric unchanged on an unpainted result, sheets lay out.

- **Windows along the seam** (Fabio, B): the inpaint branch squares the mask's box and samples it at
  1024, so one pass would repaint an 8K pano's 4096-tall seam at a quarter resolution. The app cuts
  the band into ~1024-long windows, repaints them in order (each sees the last one's result) and
  stitches each back; a short seam is one window. Progress shows "2 of 5" like chained Flow steps.

- **Prompt** (Fabio, B): a baked instruction ("Continue the picture seamlessly across this area, ...")
  plus an optional field joined after it, the Outpaint pattern; empty works. The bench now sends the
  instruction alone (what a user gets by default).
- **Agent's calls** (Fabio, 2026-10-12: the pano prototype already answers the recipe, stop asking):
  the Tiles grid counts per side (2 = 2x2, 4 = 4x4); the same slider on 02 Edges shows the source
  tiled (handles hidden above 1); dev-gated until Fabio's eye test, as every new Flow.

## Prior art Fabio linked (read 2026-10-12, shallow clones only, nothing installed)

- **spinagon/ComfyUI-seamless-tiling** (GPL-3.0, last commit 2026-02-12): `Seamless Tile` swaps every
  `Conv2d`'s padding to circular (x, y or both). That makes a CONV model (SD1.5 / SDXL UNet) generate
  natively tileable pictures. Klein and Krea 2 are transformers (patch embed, global attention, RoPE):
  their convs are the patchify stride=kernel ones with no padding, so the patch does nothing to them.
  `Make Circular VAE` / `Circular VAE Decode` do the same to the VAE: works for any conv VAE, but only
  smooths the decode; it cannot make mismatched latents meet. `Offset Image` = our roll.
- **SparknightLLC/ComfyUI-MakeSeamlessTexture** (no LICENSE file in the repo despite pyproject naming
  one: do not copy code, ideas only): no model at all. Half Shift / Radial Mask = roll by half and
  crossfade toward the edges (ghosts a double image in the fade); Mirrored Collage (visible symmetry);
  a Pre-Processor that flattens large-scale LIGHTING (luminance / periodic Gaussian blur, clamped
  0.25-4x) - a texture lit from one side still shows banding when tiled even with a perfect seam; a
  Tiled Preview with optional seam markers. Its own README: Klein 4B + circular VAE "may still produce
  seams and uneven lighting".
- Bench gained a free CPU arm: `half_shift_blend` (our own code, the Half Shift idea), the no-model
  baseline on every sheet. Dry-run wrap: pano 1.8 -> 1.1, stand-in textures ~1.0-1.5.

## Open

- Nothing in the design. The bench (model pick) waits for Fabio's go.
