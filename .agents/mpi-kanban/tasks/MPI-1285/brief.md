# MPI-1285 brief: H3 Fast Motion control and the upscale tiers

## Design (Fabio, 2026-10-25, MPI-1135 brainstorm)

- **Fast Motion OFF** = today's two-pass workflow (half-size stage 1 + 3D latent upscale + refine),
  every tier as now, with **sol-attn** added (+ EasyCache on non-turbo, already there).
- **Fast Motion ON**:
  - **Very Low / Low / Medium**: ONE pass at the target size, no stage 2. The **Preview button is
    disabled** (nothing to preview).
  - **High / Very High / 2K / 4K**: stage 1 = a single pass at the native size (1344x768 /
    768x1344); stage 2 = an UPSCALE to the tier's size (3D upscaler node 419 in `target dimensions`
    mode) + refine. These are the only Fast Motion tiers with a second stage, so Preview stays on
    for them: Preview renders stage 1 first and stage 2 later, as today.
  - Factors from 1344x768 (16:9): High 1664x960 ~1.24x, Very High 1920x1088 ~1.42x, 2K 2560x1472
    ~1.9x, **4K = two hops** (2K first, then ~1.5x; 2.85x in one jump is too far for the upscaler).
  - The refine pass at the target size is split by **time chunks, never spatial tiles** (512 tiles
    gave the grid texture in MPI-1135 Step 0). It must fit 10 s and 15 s on 16 GB: measure first.
- **sol-attn always on, both switch states** (MPI-1135 Phase 2: it looks better, and -15% turbo,
  -30% with EasyCache non-turbo). Veda is out.

- 1:1 and 21:9 stage-1 base = the Medium cell of the same ratio (768x768, 1536x640) (Fabio: yes).
- The time-chunked refine ALREADY EXISTS and is measured on 16 GB: `MpiWindowedSampler`, see
  `docs/models/h3/windowing.md` (window ceiling read from the stage-2 target size). Reuse it, no new bench.

## Open
- Whether the native-base upscale still loses on fast motion is untested: Phase 1's losing upscale
  drew the motion at 672x384, this one draws it at 1344x768 (the winning "none" clip).
