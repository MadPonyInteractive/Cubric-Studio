# MPI-1191 H3 side (2026-10-24, read-only research agent; nothing run)

- Core `MiniMaxH3AddGuide` (`comfy_extras/nodes_minimax_h3.py:166-240`, v0.42.1): `frame_idx` = PIXEL
  frame at 24 fps, negative = `frame_count + idx`, out of range raises. 1-4 frames = one picture; 5+ =
  a clip cropped to 17k+5. Cover-crops centre. **No strength**: anchors are hard condition tokens
  re-injected every step. Chain N nodes = N anchors. Position is continuous (`cursor + 5/3 * idx`,
  `comfy/ldm/minimax/model.py:376-386`): any index is legal for a single picture.
- `MiniMaxH3ImageToVideo` puts first at 0 and last at F-1 AND hands both to the Qwen3-VL tokenizer;
  AddGuide pictures are NOT seen by Qwen. Keep the i2v node for first/last.
- Shipped: `minimax_h3_fl2va.json` (two `MpiH3ImageToVideo` #472 S1 / #485 refine; `Input_Start_Frame`
  #217, `Input_End_Frame` #219; `Input_Duration` #212 whole seconds -> `MpiH3Length` #213; refine =
  `MpiWindowedSampler` #532, sigmas 0.9035 -> 0 in 3 steps). `minimax_h3_r2va.json` (references).
- **Stale claim fixed:** `flow_h3_extend.json` has NO AddGuide (#970 "no guide"): a 39-frame guide clip
  crashed in MPI-591 (arms C/D, `MPI-591/plan.md:377-384`); a single frame-0 guide worked. So the
  brief's "already used by H3 Extend", `MPI-1134/research/h3-addguide-keyframes.md:9` and the comment
  at `universal_workflows.js:86` are stale.
- Weights: only fl2va and ref2va. ref2va + AddGuide at frame 0 held (MPI-1033, SSIM 0.755 vs 0.52).
  **Mid-clip anchors are unproven on both**; only outside evidence = a tutorial, 4 anchors over 10 s.
- Length grid n%17==5 at 24 fps; 15 s -> 362 frames = top of the trained range (124-362). No local 15 s
  run on record (124 frames at 1664x960 = 8m22s). No record found of a 20 s Cosmo H3 video.
- Stage 2 needs the anchors too (refine starts at sigma 0.90): chain after #472 and after #485.
- **Trap: `MpiWindowedSampler` passes full conditioning to each window** (`sampler.py:369-399`), so
  absolute anchor indices likely land wrong from window 2 on, silently. Windows at `medium` > 243
  frames, `high` > 90 frames; `low` never windows. Restrict tiers or fix the sampler.
- Two-model Flow precedent: `flowsRegistry.js:582` `models:['ltx-23-balanced','minimax-h3']`,
  negative hidden on H3 (:621), `universal_workflows.js:89-108` `byModel`. Needs its own "Powered by
  MiniMax H3" row. ModelDef `minimax-h3` `models.js:1501` (id is load-bearing for the licence gate).
- Simplest build: copy fl2va; keep first/last on the i2v node; new MpiNodes `MpiH3AddGuides` (twin of
  `MpiLTXVAddGuides`): up to 6-8 middle images, skips blanks (core AddGuide would anchor the 1x1 empty
  picture), places middle key i at `round(i*(F-1)/(N-1))`, one per stage.
- Bench: mid anchors hold? 3/5/8 anchors + min spacing; line art; 15 s time/VRAM at low/medium; turbo
  LoRA; windowed refine placement.
