# MPI-1348 Checklist

Bench only (G:\ComfyUi). No shipped workflow is edited by this card; `flow_video_edit.json` is
off limits while Infinite video 1 (MPI-1336) benches. GPU: wait for Infinite video 1's lease to end.

- [x] Kijai rank-384 bf16 refiner LoRA (~5 GB) on the bench, under M:\CubricModels (needs Fabio's OK to download)
- [x] Graph arms built from the shipped `minimax_h3_fl2va.json` (draft 1280x704, out 2560x1408), seed 1348001:
  - [x] ship: shipped stage 2 (3D latent upscaler + 3-step windowed refine)
  - [x] regen: same upsampler, refiner LoRA, 3 Euler steps, cfg 1, sigmas [0.909375, 0.857143, 0.666667, 0]
  - [x] regenshsg (LoRA 1.0, shipped sigmas) and regen50 (LoRA 0.5) identity follow-ups
  - [ ] native 2k tier (not run)
- [x] Per arm: render seconds, peak VRAM, faces/hands (side-by-side sheets)
- [ ] Turbo LoRA on stage 1 (not run; ran with turbo on, the shipped default)
- [ ] Infinite video 1's asks (MPI-1336):
  - [ ] Seams (not run: only mattered if a variant won)
  - [x] Peak VRAM for one 124-frame window at 2K on 16 GB: fits, 15.6-16.0 GB
  - [ ] Refiner LoRA inside MpiWindowedSampler past 121 frames (not run)
- [ ] Licence: HF card says minimax-h3-community; match to shipped weights not checked (moot, rejected)
- [x] Results + verdict in `research/results.md`; Fabio's eye test done

## Integration (added 2026-10-29, LTX 2.5 umbrella MPI-1267) — MiniMax H3 only, only if the bench wins

Not applicable: the bench lost.

- [x] Docs: `docs/models/h3/performance.md` § Open-H3-Regenerate-2K; README.md + ref2va.md point to it

Closed 2026-10-29: rejected by Fabio's eye test, see validation.md.
