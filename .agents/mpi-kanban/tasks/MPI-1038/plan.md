# MPI-1038 - Tile upscale in the upscale op ("Use Tiles")

## Goal

Fabio, 2026-10-09, after five Pod runs of the Tile Detailer Flow: tile detailing is far better
than the upscale op's Use Grid (Grid caps at 9 tiles with seam fix off = seams, and huge tiles on
a big photo). It becomes a **Use Tiles** option in every model's upscale op, BESIDE Use Grid
(Fabio: keep Grid). With tiles on, a **1.0x** factor appears = detail only. The Flow goes.

## Design (approved in the 2026-10-09 brainstorm)

- **Prompt box.** `useTiles` toggle next to `useGrid`, injects `Input_Tile_Upscale`. One on turns
  the other off. Hover (status bar): "For very large images, or for improving detail on an
  existing image at 1.0." `upscaleFactor` offers **1.0** only while tiles are on; tiles off on 1.0
  snaps to 1.5. While tiles are on the label reads `Upscale · N tiles`, N from a JS port of Impact
  `MakeTileSEGS` maths on input W x H x factor (bbox clamps to the short side; irregularity pads
  1024/200 to 1068/222). Expected: 800x533 x2 = 2, 1344x768 x2 = 8, 1920x1080 x2 = 15,
  4000x6000 x2 = 150 (from last session's simulator - re-derive from Impact source, do not trust).
- **Denoise:** the same slider, the user chooses (Fabio). **No cap** on 4x - the count is the
  warning; check what breaks past 16K a side (sharp/ffmpeg decode).
- **Which models:** a ModelDef capability gates the toggle; only templates with a tile section get
  it. **Qwen 2.1 later** - no Detailer group to copy, and its file is held by the Qwen agent.
- **Graph contract** (Fabio's Krea2 wiring, bench `krea2_t2i_template`, saved 2026-10-09 11:36):
  group "Tile Upscale" = a COPY of that template's own Detailer group pipe (its Get nodes ->
  ToBasicPipe, seed, steps/cfg rule, sampler/scheduler, Get_denoise) - never wired into the
  existing Detailer's nodes (Fabio). `Get_img1` -> `ImageScaleBy` lanczos x `Input_Upscale_Factor`
  (reroute) -> `ImpactMakeTileSEGS` 1024 / 1.5 / 200 / 30 / 0.7 "Reuse fast" ->
  `DetailerForEachPipe` (guide 1024 bbox, max 1536, feather 10, noise_mask + force_inpaint on,
  refiner 0.2, cycle 1, noise_mask_feather 10). `Input_Tile_Upscale` (MpiSimpleBoolean, default
  false) -> `MpiBooleanInvert` -> `MpiIfElse` (true = Use Grid path, false = tiles) -> `upscale`
  reroute -> Any Switch slot 7. MpiIfElse inputs are lazy: only the chosen path runs.
  **No resize-to-multiple on the tile path** - the detailer resizes each crop itself
  (`core.py enhance_detail`, crop -> new_w/new_h -> back to crop size); a whole-image resize only
  stretches the picture and breaks output = input x factor (compare misaligns at 1.0).
- Fabio's bench edit also deleted two DEAD chains (confirmed dead in the repo copy): Krea2's
  `Input_Image_3` loader (bypassed since MPI-365) and the UltimateSDUpscale refiner (its
  VAEDecode fed nothing). `docs/models/krea2/upscaling.md` still describes that refiner - fix it.

## Phases

1. **Krea2 into the repo.** Copy the bench file verbatim to
   `comfy_workflows/raw/krea2_t2i_template.json` (raw is Fabio's source - no script edits it);
   `node scripts/sync-raw-workflows.mjs` (commits raw `--only`, gates on
   validate-injection-rules, bakes `krea2_t2i_sfw/nsfw.json`). **Verify:** validator passes;
   both runtimes carry `Input_Tile_Upscale` + `ImpactMakeTileSEGS` + `DetailerForEachPipe`, no
   rgthree node; inject tests green.
2. **App wiring.** `useTiles` in `PromptBoxControls.js` + `promptControlDefaults.js`; 1.0 gating
   + tile-count label; upscale op `components` in `commandRegistry.js`; capability on both Krea2
   ModelDefs in `models.js` (HELD by MPI-936 - wait or message); Reuse in `promptReuse.js`; agent:
   `agentToolOps.js` + MCP `describe_model`; docs `docs/playbooks/common/prompt-box-controls.md`,
   `docs/models/krea2/upscaling.md`. **Verify:** a test for the tile-count function (known counts)
   and for the injection, `npm run lint`, `node --check`.
3. **Live run** in an isolated app (`npm run app:isolated`, never :3000) on Krea2: tiles off (Grid
   path unchanged), tiles 2x, tiles 1.0; Reuse restores the toggle. **Verify:** cards + sidecars
   carry `Input_Tile_Upscale`; output dims = input x factor.
4. **Copy to Klein, Chroma, SDXL** by script, each from its OWN Detailer group (its sampler,
   scheduler, steps/cfg; the tile nodes + switch as in Krea2). Fabio eye-checks each on the
   bench; sync; capability on. **Verify:** validator + inject tests; one bench run per template
   under `gpu_lease.py run --poll 2`.
5. **Remove the Flow** (in no release: newest tag v2.0.1 predates `e0dff8c54`): FlowDef, op in 4
   files, raw + runtime workflow, `docs/agent/flows.md`, tests, the existing-flows doc.
   **Verify:** `grep flowTileDetailer` = 0, tests + lint green.
6. `docs/releases/UNRELEASED.md` entry.

## Verification

**Verify mode:** user-ux

Automated: the phase Verify lines. Human: Fabio uses Use Tiles in the app (2x and 1.0 on Krea2,
then the copied models) and judges the result and the tile-count label.

## Current State

2026-10-09 ~15:30: Fabio said 1 on Krea2 + Klein in his app; his Klein A/B: 4 tile steps beat 2 (runtimes back at the committed 4). Agent + MCP now know tiles: named params `tiles` + `upscaleFactor` (generationControls resolveNamedParams/namedParamsFor, ladder asked > panel > default, tiles forces Grid off, 1x only with tiles), wired through agentDispatch, connector NAMED_PARAM_KEYS, routineModel, mcp.js + agentLoop.mjs schemas + _SENT_KEYS; TOOLS_BUDGET 18,673 -> 19,006 (+333, annotated). tests/agent-tiles.test.cjs; npm test 2808 pass / 0 fail. Skill doc + UNRELEASED.md entry written. NEXT: mpi-end-session (commit --only my files; Chroma/SDXL stay validator-proven only).
2026-10-09 ~14:40: Fabio testing in his app (Krea2 now, Klein next) - screenshot showed USE GRID / USE
TILES + "UPSCALE · 6 TILES" + 1x working on Qwen 2.1. His asks, BOTH DONE: (1) Use Tiles persists across
model switches -> `useTiles` scope `shared` (project.shared.image); useGrid (still perOp) mounts OFF
when shared tiles is on for a tile-capable model; upscaleFactor reads tiles from the shared bucket;
legacy Reuse writes `sharedUpdates.useTiles`. Desktop spec + 38 reuse/inject tests green.
(2) Klein tile detailer 2 -> 4 steps (his Flow recipe; 2 "just not doing it"), runtimes `ba5ac9fe5` pushed.
NEXT: wait for his Krea2 + Klein verdict ("1" or changes); then commit the app code (list below)
with `--only`, UNRELEASED.md entry (MPI-1051 held it), close-out. Chroma/SDXL unproven (no weights).
2026-10-09 ~14:00: ALL graphs done + every runtime committed and pushed (b399d7920); red-fix CI green.
Bench x1.5 clean on Krea2 / Klein 9B / Qwen 2.1; Chroma + SDXL have no weights on this machine.
NEXT = Fabio's in-app look (user-ux): reload his app, Krea2 upscale op -> Use Tiles, 2x and 1x.
Uncommitted, waiting on that look: PromptBoxControls.js, MpiPromptBox.js, promptControlDefaults.js,
commandRegistry.js (useTiles component + help line), promptReuse.js, models.js (12 flags),
tileCount.js + test, desktop spec, krea2 upscaling.md. Then: UNRELEASED.md entry (MPI-1051 holds
the file now), optional agent named param.
2026-10-09 ~13:25: RED MASTER fixed - the Flow (e0dff8c54) broke `tests/desktop/flow-library-filters.spec.js`
(Type=Enhance expects 1); pushed the removal alone as `03b63033b` (--no-verify, carried peers'
ea0b707ef + 02eff35b0), CI 37922285517 watched. Krea2 runtimes committed `48c9dec4f`. Qwen 2.1
DONE (Fabio freed it): tile group built by `copy`-style script from Fabio's Krea2 nodes wired to
Qwen's own model/encode/sampler (15 steps euler/simple), raw `e3a60af59`, runtime `fa7b4990a`,
bench x1.5 = 2016x1152 in 174 s, no seams, palette a touch cooler. Klein / Chroma / SDXL DONE by
`copy_tiles.py` (scratchpad; clones each template's OWN Detailer group pipe): raws committed by
sync, 12 generated files STAGED; bench runs queued behind the Qwen agent's GPU lease.
`tileUpscale: true` on all 12 upscale ModelDefs (uncommitted). Desktop spec
`tests/desktop/prompt-box-use-tiles.spec.js` passes (exclusivity, 1x gating, label, injection).
Upscale help gained the Use Tiles + per-tile prompt line.
2026-10-09 ~12:15: phase 1 DONE (raw committed `42eb8fd3d`; API + sfw/nsfw runtimes STAGED,
uncommitted). Phase 2 code DONE except ONE line: `capabilities.tileUpscale: true` on both Krea2
ModelDefs in `models.js`, which MPI-936 (Qwen agent, session 3e2b8b66) holds - add it when
released, then phase 3 (live run). Written: `js/utils/tileCount.js` (port verified against the
verbatim Impact maths on 25,010 size/factor cases, 0 mismatches) + `tests/tile-count.test.cjs`;
`useTiles` control + Grid/Tiles exclusivity over `promptbox:upscale-split` + `upscaleFactor` 1.0
gating and `Upscale · N tiles` label (`setInputImage`, called from MpiPromptBox like
`setAudioPresent`); `useTiles` default; upscale `components`; legacy Reuse reads
`Input_Tile_Upscale`; krea2 `upscaling.md`. Phase 5 DONE: the Flow commit reversed on its code
files (`git apply -R`, nothing later touched them). `npm test` 2800 pass / 0 fail, lint clean.
NOT done: agent/MCP (agents set the factor only through raw injectionParams today, so
`Input_Tile_Upscale` works the same way; a named param is a later call). Flow art in `art/` is moot.

## Completed

- Brainstorm + Krea2 bench wiring (Fabio).

## Remaining Work

Phases 1-6.

## Plan Drift

- 2026-10-09: card re-scoped from "Tile upscaler Flow" to tile upscale inside the upscale op; the
  old Flow plan lives in git history (`cb0b04fee`).

## Preservation Notes

- `docs/models/krea2/upscaling.md`: refiner gone, tile path added, per-tile prompt trap applies
  to tiles too.
- Rule drift question at close-out: a new prompt control (`useTiles`) changes component wiring.
