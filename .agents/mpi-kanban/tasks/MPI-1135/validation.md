# MPI-1135 validation

## Step 0: upscale arms on our H3 (2026-10-25, Fabio)

Side-by-sides: `C:/AI/Mpi/_private/mpi1135-clips/sbs/` (`step0_<shot>_<seed>.mp4` full,
`_detail.mp4` middle 640 px per panel at true pixels; three passes, one per arm's audio).
Times and VRAM: `research/results.md`.

| arm | Shot A s (seed 1/2) | Shot C s (seed 1/2) | verdict |
|---|---|---|---|
| none | 125 / 127 | 162 / 164 | **wins on quality at 1344x768**: less tearing, fewer texture errors (Fabio, 3 of 4 judged) |
| ours | 114 / 113 | 115 / 94 | fastest; drafts at 672x384, which is the likely source of its tearing at this size |
| benji (MMH3 + LMS 0.70, denoise 0.30) | 140 / 142 | 210 / 210 | "absolute crap in every one" |

- Fabio: ours pushed to 2K output beats everything on quality. 2K ours drafts at 1344x768,
  the same as none, so the expected product shape is **none as the draft, ours's 3D upscale +
  refine as an optional "2K" step on the SAME draft** (not yet verified that the two drafts are
  identical, nor that the 2688x1536 refine fits 32 GB: the bugged first none run did it and
  failed at 31.1 GB). 4K: open, likely a pixel-space or tiled upscaler.
- Benji gets one more go in Phase 1, the way he runs it: **on Singularity H3**, refine denoise
  **0.485** (Fabio's read of his workflow). Fabio's risk: identity likely dies at that strength.
- Fabio (2026-10-25): the Upscale Video Flow needs a new version, with an H3 variant and an
  LTX 2.5 variant (may deprecate LTX 2.3's). Because H3's upscaler works on latents, his lean is
  2K / 4K as a resolution choice on the H3 generation that triggers the upscale stage. The
  Flow-vs-ours-at-2K test is NOT run unless he asks for it during the tests.
- Shot C seed 2 (Fabio): ours about as good as none and much faster. The ours graphs for the
  two seeds differ only in the seed (diffed), so the quality match is seed luck. The time is not:
  ours seed 1 (115 s) was the first ref2va clip and paid the model switch from fl2va; seed 2
  (94 s) is ours's real speed on Shot C, against none at ~163 s.
  Even there, **motion is still better on none** (Fabio). So none wins every Step 0 look on
  quality or motion; ours only wins speed.
- **Step 0b verdict (Fabio, 2026-10-25): benji DROPPED, no more runs.** Both 0.485 runs (our
  model and Singularity) were bad. His own videos look better than ours, so our copy of his setup
  is likely wrong or incomplete, not his method. Only the upscale phase was his: our stage 1
  stayed the shipped one (half-size draft at 672x384, ~0.26 MP, turbo 8 steps), while his refine
  targets 1.5-2.0 MP (brief.md) and his Veda run drafted at 0.7 MP (whether his upscale run
  used the same draft size is unconfirmed). Tile size (512) was our pick, and the setup
  came from a screenshot, not his workflow file.

## Benji's real workflow vs our copy (2026-10-25)

Source: `MinimaxH3_R2V-2Stage-VEDA.json` (Fabio's download, kept at
`C:/AI/Mpi/_private/mpi1135-benji/`, outside git). Traced link by link. Our "benji" arm copied
only the upscale node; everything that feeds it differed:

| | ours ("benji" arm) | Benji's file |
|---|---|---|
| Model | ours ref2va / Singularity **v2** | Singularity **v1.3** int8 (note in the file points to a fl2va+ref2va hybrid for normal use) |
| Turbo | 8-step ref2v turbo v1.0, beta 10, euler | **4-step ref2v turbo v0.1** at 1.0, beta **8**, res_multistep, shift 12/3 |
| Extra LoRA | none | **realism-people `r34l1sm` at 0.7**, trigger `r34l1sm , ultra realistic video.` prefixed to every prompt |
| Draft size | **672x384** (0.26 MP) | **1152x640** (0.7 MP) |
| Final size | 1344x768 | **1664x928** (1.5 MP) |
| Refine model | base model, **turbo OFF** (our shipped switch), shift 12/0.5, + LMS 0.70 | the **whole stage-1 chain, turbo ON** + realism + Veda, shift 12/3, + LMS 0.70 |
| Refine steps | beta 2, denoise 0.30 (Step 0b: 0.485) | beta 2, denoise **0.30** |
| Spatial tiles | 512x512 (our pick) -> 6 tiles with seams | tile = the full output size -> **one tile**, no spatial split |
| Temporal anchor | 1.0 | 0.999 |
| Refs | as uploaded | resized to the draft size with `nvidia_rtx_vsr` (ref 1 crop, ref 2 1024 pad) |
| Speed/memory | none | Sage attention, Veda sparse attention, chunked feed-forward, tiled VAE decode |
| Length | 4 s | 15 s |

Most likely causes of our bad benji clips: a 2-step refine on a NON-turbo model (cannot finish
denoising in 2 steps), 512 tiles (the dotted / grid texture), and a 0.26 MP draft. His 0.30 is
the denoise, so Step 0b's 0.485 was further from his setup, not closer. The realism LoRA and its
trigger are part of his look and are not in anything we ship (licence unknown).
