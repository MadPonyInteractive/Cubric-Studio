# MPI-1232 checklist (bench phase)

- [x] Bench up, models + face/person yolo present
- [x] Face photo picked
- [x] Stage 1: 12 runs (A/B/C x Krea 2 / FLUX.3 Klein x face exclusion off/on) + 2 FLUX.3 base checks - results in brief.md
- [x] Fabio's verdict on the stage 1 sheets: face pass ships, turbo = base, prompts judged in stage 2
- [x] Stage 2: describer context, 4 caption methods + 9 runs on the UFO field (0.2 and 0.45) - results in brief.md
- [x] Fabio's verdict on stage 2: keep per-tile prompts as SHORT names (his rule), people kept out
- [x] Stage 3: people pass benched (boxes; describer-free people). Overlap rule moved to Phase 1 verify.
- [x] Verdicts written into brief.md, shown to Fabio; he chose names + people pass + face pass (2026-10-22)
- [x] Wiring plan written (plan.md top, footprint in research/footprint.md)
- [x] Fabio's open calls (plan.md "Open"): Tiles denoise default, people pass denoise
- [x] Phase 1 graphs (14 runtime from 7 raw) - verify on G: bench
- [x] Phase 2 tile maths + controls + Grid removal - npm test, lint, desktop spec
- [x] Phase 3 Describe each tile (outlines route, captions, one visible row) - label-keyed names, Klein 9B bench
- [x] Phase 3 live app:isolated Use Tiles run (8/8 named, clean)
- [ ] Endpoint describer price before a big run (Fabio's call)
- [ ] `.claude/rules/` Tiles/Grid rows (ask Fabio, CLAUDE.md rule 5)
- [x] Phase 4 agent/MCP/docs + test pins (tileSize named param, up to N tiles)

## Cosmo + tiles (Fabio, 2026-10-22)

- [x] Started tiled run: Cosmo names the tile count + "the status bar at the bottom counts them", never the chat's
      0-of-1 line (`_tilesNote`, services/agentLoop.mjs; commit 83cfbc54)
- [ ] Cosmo's upscale (any op with live latents) opens the card in the IMAGE workspace before it runs, so the
      user sees the latent previews. Today it starts from the gallery and no latents show. Find where the agent's
      generate picks the workspace (agentDispatch.js / commandExecutor) and whether a hand-run upscale already opens it.
      - 2026-10-22 read: routing is already right. Cosmo's 12:26 tiled upscale (flux3-klein, Moss image) landed as
        `upscale_001` INSIDE card t2i_021's history (`workspaceGenerationOpts`), and `_followWork` -> `followTarget`
        navigates to that history on a typed turn (`input.follow`). No "view stays" line in the log, so it was not
        blocked; nothing logs a navigation, so whether the view moved is unprovable from the log. Next: reproduce in
        `app:isolated` (a typed "upscale this" from the gallery) and watch whether the page changes - suspects:
        `_follow` false on that turn (wake/carry) or the history opening but drawing no remote (RunPod) latents.
