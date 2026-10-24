# MPI-1266 brief: LTX 2.5 Stage 2

Follow-up to MPI-1095 (Stage 1 closed 2026-10-24). Under umbrella MPI-1267 (LTX 2.5 release) since 2026-10-24; MPI-1095 sat under MPI-1179 (New Models to Test).

**Fabio 2026-10-24:** all of this can be worked NOW. Only removing the dev gate (`devOnly: true` on
`ltx-25`) waits: it comes off at the LTX 2.5 release (umbrella MPI-1267), not tied to a version number. Stage 2 starts in a fresh session.

## Where Stage 1 left it

- `ltx-25` ModelDef wired, `devOnly: true`; six deps + the DiffVAE on R2; Turbo on/off (OFF = DiffVAE,
  ON = conv) passed Fabio's in-app test; 2.3 High retired.
- `ltx-2.5.recipe.js` enhancer recipe twice green on all four modes, status `draft`
  (`docs/recipes/research/ltx-2.5/validation.md`: final prompts, 3 known limits).
- Full history and evidence: `.agents/mpi-kanban/tasks/MPI-1095/` (`plan.md`, `validation.md`,
  `research/findings.md` - the 2.5 capabilities and LoRAs beyond 2.3 are listed there as Stage 2 input).

## Scope

1. LTX 2.5 in the existing LTX Flows (Extend Video, Add Foley, Upscale Video, Reference to Video; each
   requires `ltx-23-balanced` today in `flowsRegistry.js`) - replace or beside is Fabio's call per Flow.
2. Keyframes to Video Flow (MPI-1191) on 2.5.
3. 2.5-only Flows (e.g. the latent upscalers, MPI-578).
4. A second download route for the 2.5 deps (HF re-host, ~41 GB; public upload = Fabio's yes) - before
   the gate comes off.
5. Measure the new LTX `high` 1536x896 tier on the GPU (time, VRAM, look) - a GPU run, Fabio's yes.
6. Fabio's review of the raw `ltx25_i2v_t2v_template` in G: ComfyUI (if he changes it: re-copy to `raw/`,
   convert, gate, `generate_ltx25.py`).
7. Fabio's Stage 2 renders of the recipe prompts; he alone flips the recipe `draft -> validated`.
8. At the LTX 2.5 release: remove `devOnly` on `ltx-25` + the UNRELEASED changelog entry.

`M:/_stage/mpi1095` DELETED 2026-10-24 on Fabio's yes (all 7 files matched in `M:/CubricModels` and on R2).
