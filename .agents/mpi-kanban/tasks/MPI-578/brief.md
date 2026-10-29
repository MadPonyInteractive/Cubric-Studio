# MPI-578 - Upscale Video Flow: LTX 2.5 tiled upscale + MiniMax H3

## Merged 2026-10-29 (Fabio): ONE card for the video upscale Flow

MPI-688 (add H3 to the Upscale Video Flow) is folded in here; that card is closed as merged.
The Upscale Video Flow (`ltx-upscale`) gets **two upscalers**:

1. **LTX 2.5 tile upscale - TEST FIRST.** Route B below (Refine + Restore under the tiled
   Native Resolution workflow). This is the open question: how good is it, on AI-generated
   clips, against today's LTX 2.3 Flow. Route A (the 2.5 latent upscaler swap) stays as the
   cheap fallback if Route B loses or is too heavy.
2. **MiniMax H3 upscale - INTEGRATE.** The H3 latent upscaler
   (`minimax_h3_latent_upscaler_3d_bf16.safetensors`, `MinimaxH3LatentUpscaler3D`) already
   ships inside our three H3 workflows (`minimax_h3_r2va`, `minimax_h3_r2va_singularity`,
   `minimax_h3_fl2va`), so this is wiring an existing pass into the Flow, not research.
   Notes and measured traps: § "MiniMax H3 (from MPI-688)" at the end of this brief.

State on 2026-10-29: the Flow still runs LTX 2.3 (`ltx-2.3-spatial-upscaler-x2-1.1`,
`requiredModels: ltx-23-balanced`). The engine-bump block below is CLEARED - LTX 2.5 landed
(MPI-1095 done). The H3 2K refiner from NVIDIA (MPI-1348) was rejected; it is not this card.

## Re-scoped 2026-10-18 (Fabio): this is THE card for the Upscale Video Flow on LTX 2.5

The shipped Flow is **Upscale Video** (`ltx-upscale` in `js/data/flowsRegistry.js`,
`comfy_workflows/ltx_video_upscale.json`, op `ltxVideoUpscale`): LTX 2.3 re-renders a clip at 2x.
Fabio wants LTX 2.5's **Refine + Restore** to either REPLACE that Flow's engine or sit BESIDE it
(a second mode / second Flow). Decide on a side-by-side bench, same clips. This card now holds
two candidate routes for the same Flow:

1. **Route A - the 2.5 latent upscalers + DiffVAE** (the original card, below). A weight swap in
   today's graph, if the header check passes.
2. **Route B - Refine + Restore under Native Resolution** (new, from the video below). A
   different mechanism: video-to-video IC-LoRAs that regenerate real detail, run in overlapping
   tiles so the output can reach full HD, 4K or 8K on one GPU.

Both need LTX 2.5 itself first: MPI-1095 lands the 2.5 base model.

### Route B sources

- Refine (on HF as "Refine Details"): `Lightricks/LTX-2.5-22b-IC-LoRA-Refine-Details`
- Restore: `Lightricks/LTX-2.5-22b-IC-LoRA-Restore`
- Native Resolution workflow (tiled 4K/8K):
  `Lightricks/ComfyUI-LTXVideo` `example_workflows/2.5/LTX-2.5_V2V_TiledFusion_Native_4K_8K.json`
- Refine and Restore workflow: same folder, `LTX-2.5_V2V_TiledFusion_Upscale.json`
- Docs: docs.ltx.io, open-source-model / vfx-post-production / native-resolution and
  refine-and-restore
- Not the same file as `LTX-2.5-22b-IC-LoRA-Pixel-Spatial-Upscaler`, which the original card
  warns against. Check the Refine Details model card before assuming they differ in mechanism.

### What the video showed (Matt Hallett, "LTX Refine & Restore with Native Resolution",
2026-09-29, youtube.com/watch?v=ghtjOP32SDI; watched from transcript + description only)

- **Refine** took 512px aerial footage to 4K with invented, plausible detail, not blur. On a 1K
  AI generation it added texture and partly fixed a fast-motion mess (a smeared helmet).
- **Restore** cleans old, low-res archive video. A third LTX LoRA (color) colourised three
  archive clips in one pass. Best archive result: Restore at full strength + **30% Refine**.
- **Settings:** three tile sizes (VRAM and quality similar across them, smaller is slower),
  canvas left at HD, output full HD / 4K / 8K. He tests at full HD first; 8K is "overnight".
- **Hardware:** RTX 5090 + 128 GB system RAM, "even that is pushing it". NVFP4 and int8 builds
  of the model exist; int8 text encoder is enough. Our users' GPU is the limit, so this needs a
  warning, not a cap.
- **Failure modes, all from tiling:** each tile sees only part of the frame, so the prompt must
  stay generic ("aerial video"). A specific prompt forces its subject into tiles that do not
  contain it. Seen: two people merged into one (a woman became the man beside her), camo
  helmets read as beach hats, smoke trails read as lights. Fewer tiles allow a more specific
  prompt.
- **Workflow:** the Lightricks graph is a subgraph; unpack it to reach the IC-LoRA loaders and
  their strengths, and chain a second IC-LoRA loader to mix Refine and Restore.

### Open questions for the bench

- REPLACE or ADD: does Route B beat today's 2.3 Flow on AI-generated clips (the real use), not
  only on archive footage? Is it too slow / heavy to be the only option?
- The Flow's prompt: Route B wants a generic prompt; does the Flow write one for the user?
- Restore and colourise may be a separate Flow ("Restore old video") rather than an upscale
  setting.

## Route A - the original card (LTX 2.5 latent upscalers)

~~Blocked on the ComfyUI engine bump.~~ Cleared 2026-10-29: LTX 2.5 landed (MPI-1095).

## The job

MPI-568 shipped an LTX **2.3** spatial upscale op. This card moves it to 2.5's
upscalers once the engine supports them. Fabio's sequencing, 2026-08-19: ship v1
on 2.3 now, bump later.

## Order of work

1. **Read the safetensors header first.** Confirm
   `post_upsample_res_blocks.0.conv2.bias` and the `config` fields
   (`spatial_upsample`, `temporal_upsample`, `spatial_scale`,
   `rational_resampler`, `mid_channels`). Everything downstream assumes this and
   nobody has checked it. 30 seconds; it decides whether this is a weight swap or
   node work.
2. **Re-run the VAE round-trip arm on the 2.5 DiffVAE.** This outranks the
   upscaler itself - see the card description. `warp_arms.py` from MPI-568's
   scratchpad is the instrument.
3. **Re-run the sigma ladder** on both source classes and re-pick the default.
4. **Re-measure peak VRAM.** MPI-568's numbers: 14.9-15.9 GB of 16.4 across
   sources from 0.41 to 1.03 Mpx, i.e. the transformer dominates and source size
   barely moves it. Confirm that still holds - 2.5's DiffVAE adds a decode stage
   and may not be free.

## Do not re-open without new evidence

The detail transfer and its evidence gate, the split radius, and the temporal
upscaler are all CLOSED NEGATIVE on MPI-568 for reasons that are properties of
the method rather than of 2.3. Read that card's plan before reviving any of them.

## Blocked by

Nothing since 2026-10-29 (was: the ComfyUI engine bump). Bench evaluation additionally needs
`/mpi-bump-local-comfy`; shipping needs `/mpi-bump-engine`.

## MiniMax H3 (from MPI-688, merged 2026-10-29)

### Why now

H3 gained a latent upscaler on 2026-09-04: `Comfyui_Minimax_h3_latent_Upscaler`
(`MinimaxH3LatentUpscaler3D`), installed on the bench at
`G:\ComfyUi\ComfyUI\custom_nodes\Comfyui_Minimax_h3_latent_Upscaler` @ `d7c01b9`.
Weights live in `latent_upscale_models` (`minimax_h3_latent_upscaler_3d_bf16.safetensors`).

Measured on the bench, 3-second clip, 608x352 -> 2x -> 1216x704: the upscale pass
produced better output than a native 1344x768 generation, and faster. Turbo applied to
the refine leg specifically gave **+20-30% detail** and **1-2.5 points less shadow crush**
over the same 3-sigma refine without it.

### The shape is already in the repo

`comfy_workflows/ltx_video_upscale.json` (29 nodes) is **latent space**, not pixel:

```
LatentUpscaleModelLoader -> LTXVLatentUpsampler -> SamplerCustomAdvanced + ManualSigmas
```

The H3 path is the same shape with `MinimaxH3LatentUpscaler3D` in the upsampler slot,
`LTXVConcatAVLatent` / `LTXVSeparateAVLatent` already appear in BOTH the LTX upscale graph
and the H3 workflows, and the refine is a partial-denoise pass from ~0.90 sigma either way.

### Scope

1. `Upscale Video` flow (`ltx-upscale` in `js/data/flowsRegistry.js:672`, MPI-584) accepts an
   H3 clip as well as an LTX one. The capability ships twice — as this Flow and as the
   History video Upscale dropdown plugin entry — and both read the same `upscale.fields`,
   so keep them in step.
2. Sweep the flows/workflows that use H3. Their graphs become **generation pass + upscale
   pass** and **drop `Input_Single_Pass`**, matching the LTX two-pass shape.

### Known traps (measured, not assumed)

- **i2v/fl2va conditioning does NOT survive an upscale.** `MiniMaxH3ImageToVideo` VAE-encodes
  its keyframe at the FIRST stage's width/height, while `PackedLayout`
  (`comfy/ldm/minimax/model.py:341`) sizes the keyframe cond rows off the TARGET grid —
  "sharing the target spatial grid". A 2x upscale raises
  `value tensor of shape [209, 96] cannot be broadcast to indexing result of shape [836, 96]`
  inside `SamplerCustomAdvanced` (4x the tokens, anchor still at 1x).
  Fix: a SECOND conditioning built at the upscaled dimensions. `MpiH3ImageToVideo` (MPI-687)
  exists so that costs one node instead of a boolean lattice.
- **ref2v is NOT affected.** Refs carry their own grid (`_frame_grid(blk["latent_h"],
  blk["latent_w"])`, model.py:369) and pack between text and targets, so they are
  independent of the target resolution. Only keyframes share the target grid.
- **The upscaler works from the LATENT**, `w_lat = w_px // 16`, then aligns to 32 px in
  pixel space with `round()` (half-to-even). At scale 2.0, `floor(a / 16) * 32` reproduces
  it exactly (verified 32..4096, 0 mismatches). At other scales no simple expression does —
  use the node's `target dimensions` mode and feed the same number to both sides instead.
- **The resolution table needs a decision.** Only 3 of 14 rows halve onto the 32 grid, so
  exact 2x from a table row is usually impossible. Working proposal, not yet agreed:
  `stage1_MP = max(floor, target_MP / 4)` with the upscaler in `target dimensions` mode —
  leaves the table unchanged, keeps scale <= 2.0, worst aspect error 4.55%. The floor
  (0.2 MP in the test runs) is a quality judgement the user owns.
