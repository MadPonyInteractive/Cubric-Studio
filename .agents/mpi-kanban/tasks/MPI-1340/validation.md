# MPI-1340 Validation

## Phase 1 (2026-10-29) - port built, uncommitted, LICENCE BLOCKED
- `clown/`: MpiClownKSampler (ClownsharKSampler_Beta; keeps "KSampler" so `js/services/progressAggregator.js` /KSampler/i still weights it), MpiClownModelLoader, MpiImageCropLocationExact. Only `exponential/res_2s` + `linear/euler`, schedulers incl. `bong_tangent`/`beta57`, mode "standard".
- `tests/test_clown_{crop,scheduler,sampler,nodes}.py` green (re-run by the orchestrator); end-to-end sampler output bit-identical to RES4LYF over 17 setting variants, with a dummy model (no GPU, real CFGGuider stubbed).
- No pip beyond the engine; nothing writes a config file.

## BLOCKER - licence (verified by the orchestrator in G:/ComfyUi/.../RES4LYF/LICENSE)
The LICENSE opens with a preamble on top of AGPL-3 banning use of the software "or any derivative
work" for a commercial service, including one that charges users directly or indirectly, even
integrated into a larger product. Phase 0's table said plain AGPL (corrected). `clown/` is a
derivative: do NOT commit or ship it until Fabio picks: ask the author for permission, or a
clean-room rewrite of res_2s + bong_tangent from the papers. Same question applies to shipping the
unmodified pack today.

## For Phase 2
- `import clown` registers the `bong_tangent`/`beta57` schedulers globally: Chroma's UltimateSDUpscale (node 2753) uses `bong_tangent` too, so the package must be imported even with no nodes.
- Old class names to update: progressAggregator.js:95, comfyController.js:1667, progressStages.js:97/121, models.js (474, 594, 811), nodesDeps.js:152, three tests, generate_chroma.py:68.
- Port refuses (raises) negative cfg, noise_mask latents, denoise 0; output latent carries only `samples`. Paid Flow graphs not checked.

## DECIDED 2026-10-29 (Fabio) - not ported, the pack stays a dependency
Any pack whose licence (code or weights) carries a commercial restriction stays as a plain dependency: no port, no rewrite, no asking the author. The working port is shelved outside the repo (session scratchpad shelved-ports/), never committed. Card closed rejected.
