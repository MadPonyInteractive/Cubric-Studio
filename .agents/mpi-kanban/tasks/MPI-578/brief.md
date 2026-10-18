# MPI-578 - Upscale Video Flow on LTX 2.5

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

**Blocked on the ComfyUI engine bump.** Do not start before it lands.

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

The ComfyUI engine bump. Bench evaluation additionally needs
`/mpi-bump-local-comfy`; shipping needs `/mpi-bump-engine`.
