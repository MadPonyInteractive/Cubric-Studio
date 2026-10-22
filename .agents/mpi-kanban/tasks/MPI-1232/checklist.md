# MPI-1232 checklist (bench phase)

- [x] Bench up, models + face/person yolo present
- [x] Face photo picked
- [x] Stage 1: 12 runs (A/B/C x Krea 2 / FLUX.3 Klein x face exclusion off/on) + 2 FLUX.3 base checks - results in brief.md
- [x] Fabio's verdict on the stage 1 sheets: face pass ships, turbo = base, prompts judged in stage 2
- [ ] Stage 2: describer context, 3 captions + 3 runs on the UFO field
- [ ] Stage 3 (if 1-2 pass): people pass, overlap rule
- [ ] Verdicts written into brief.md Decisions, shown to Fabio

## Cosmo + tiles (Fabio, 2026-10-22)

- [x] Started tiled run: Cosmo names the tile count + "the status bar at the bottom counts them", never the chat's
      0-of-1 line (`_tilesNote`, services/agentLoop.mjs; commit 83cfbc54)
- [ ] Cosmo's upscale (any op with live latents) opens the card in the IMAGE workspace before it runs, so the
      user sees the latent previews. Today it starts from the gallery and no latents show. Find where the agent's
      generate picks the workspace (agentDispatch.js / commandExecutor) and whether a hand-run upscale already opens it.
