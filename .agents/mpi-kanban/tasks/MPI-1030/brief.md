# MPI-1030 - H3 ref2v runs the reference encode twice per generation

## Symptom

One `ref2v_ms` / `minimax-h3-ref2va` run (2026-10-06, `got prompt` 06:58:51Z, one image
ref 2048x1664 + one 4 s 640x640 video ref with sound) loaded VideoVAE, AudioVAE and
`MiniMaxH3TEModel_ ... 25140MB Staged` twice, all inside `MpiH3References`:

| pass | VAE encodes | text encoder |
|---|---|---|
| 1 | 06:58:54 -> 06:59:18 (24.6 s) | 06:59:19 -> 06:59:46 (27.2 s) |
| 2 | 06:59:46 -> 07:00:12 (25.7 s) | 07:00:12 -> 07:00:54, died on aimdo error 1450 (MPI-1029) |

## Cause

Not positive/negative (the guiders are `BasicGuider`, no negative), not one per reference
(core encodes every reference in one call), and the node does not reload itself. The
graph `comfy_workflows/minimax_h3_r2va.json` has TWO `MpiH3References` by design (MPI-687):

- `#330 Input_Refs` - stage-1 width/height (half the output), `ref_image_size: match`,
  feeds the stage-1 guider and the stage-1 latent.
- `#688 Refine_Refs` - refine width/height (2x stage 1), `ref_image_size: max`, feeds
  the refine guider only (its latent output is unused).

Each calls core `MiniMaxH3ReferenceToVideo.execute` once: VAE-encode every reference,
then one Qwen3-VL forward over references + prompt (`clip.encode_from_tokens_scheduled`).

Why the second one is a full 25 GB disk read, not a warm reuse:

- Dynamic VRAM keeps every weight it reads from the file as a PINNED RAM copy and casts
  from that pin on the next forward (`comfy/ops.py` `handle_pin`: `if pin is not None`
  -> no file read). The pin budget is 40% of RAM on Windows - `Enabled pinned memory
  26124.0` in this log - and the encoder is 25,140 MB, so it nearly all fits.
- Each refs node feeds an `MpiClearVram` (#765, #766). It is an `OUTPUT_NODE`, so
  ComfyUI's `ux_friendly_pick_node` runs it the moment it is ready - straight after its
  refs node. `unload_all_models()` -> `model_unload` -> `detach()` -> dynamic
  `unpatch_model` -> `partially_unload_ram(1e32)` + `partially_unload(1e32)` throws away
  the pins AND the VRAM pages, so the other refs node reads the whole file again.
- Both refs nodes run before stage-1 sampling (both are ready at once and each blocks an
  output node). Which goes first varies per engine process (`list(good_outputs)` is set
  order). In this run the image encode took 2.1 s then 3.0 s, so stage 1 ran first and the
  crash was in the refine's encode.

Preview and continue runs pay for an encode they never use. The app never prunes the
graph; it only flips `MpiStageLatents` widgets, and that node blocks DOWNSTREAM only. The
two clears are output roots, so a preview run (stage 1 only) still runs `Refine_Refs`
through #766, and a continue run (refine only) still runs `Input_Refs` through #765.

## What actually differs between the two encodes

Only IMAGE references. Core hands Qwen each image at the node's reference size
(`ref_items.append({"type": "image", "data": resized})`) and Qwen keeps up to 12.8 MP, so
this run's 2048x1664 image is ~3,328 vision tokens on the refine (`max`, full size) against
roughly (stage-1 pixel area / 1024) on stage 1 (`match`) - ~396 at a 1664x960 output (the
run's output size is not in the log). Different conditioning, on purpose: MPI-687
measured `max` on the refine as a colour/identity win (green eyes stay green).

Identical in both nodes: the prompt text; every reference VIDEO (`adapt_canvas` uses the
video's own size, trimmed by `length`, same in both) and its soundtrack; every standalone
audio (VAE latent, and only a label in Qwen). So:

- no image refs -> the second encode is a byte-for-byte repeat (TE + every VAE encode);
- image refs -> the TE pass is genuinely different; the video/audio VAE re-encodes are
  still repeats (~23 s here for one 4 s clip; refs run 2-15 s).

## Options (decision needed)

All of A is bit-identical output - same inputs, same weights, only where the bytes come
from and which unused encode is skipped. B changes output.

- **A1 - one clear after BOTH encodes, not one after each.** Keeps the pinned encoder
  between the two forwards, so the second reads (nearly) nothing from disk. Graph-only.
  The clear must still land before stage-1 sampling. The pin budget (26,124 MB) is ~2.3 GB
  short of encoder + both VAEs (28,393 MB), so expect a few GB re-read, not zero. By the
  code; not yet measured.
- **A2 - run each encode only when its stage runs** (preview: stage-1 only; continue:
  refine only). Needs the clears off the output-root position, or an encode node that
  takes the run mode.
- **A3 - stop re-encoding what is identical**: the refine reuses stage 1's video/audio
  latents always, and stage 1's text-encoder output when no image ref survives. Node
  change. ~23 s here per 4 s video ref.
- **B - one TE pass for both stages.** The refine keeps its `max` VAE latents but uses
  stage 1's Qwen output. Removes the second TE forward on every run and shortens the refine
  context. Changes the refine's conditioning, and nobody knows whether MPI-687's colour win
  came from Qwen seeing the big image or from the `max` latents: needs an A/B and an
  eye/ear test.
- **Not these:** deleting `Refine_Refs` reverts MPI-687; deleting #765/#766 outright
  leaves the encoder's pins and VRAM pages in place when stage-1 sampling starts, which
  is the clean start those clears exist to buy.

## Ship rules for any of it

Node changes ship committed -> pushed -> pinned in `dev_configs/node_lock.json`
(`/mpi-nodes-sync`), new inputs appended at the END with defaults (MpiNodes
`update-node.md`); the graph is regenerated by
`comfy_workflows/scripts/workflow_generation/generate_h3.py`.
