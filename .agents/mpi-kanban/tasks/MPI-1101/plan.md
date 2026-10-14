# MPI-1101 Make seamless - a Flow that makes any picture tile left-right, top-bottom or both

## Current State

**2026-10-13 later (609868bb) - (c) PROVEN LIVE; (b) PREMISE CHANGED, waiting on Fabio.** Real-photo test (greenhouse, Klein at 4x shrink) and a new per-window measure (`seamlessOps.seamScore`, validation.md) show 16K windows KEEP THE CUT in most windows (4 of 5 leaves repro + greenhouse w0), all 8K windows heal: the 4x shrink is the cause, so the approved seed re-run would heal ~1 in 5. Not built; options put to Fabio (cap the shrink at 2x / soften the cut in the picture Klein is shown / re-run as approved). Separately FIXED the line where two windows meet (`windowMaskBuffer`, overlap ramp) - proven live on `_074`. **FABIO PICKED (2026-10-14): cap Klein's shrink at 2x** (8K windows all heal). NEXT: in `services/seamlessOps.js` `planAxis`, size cuts so the model shrinks <= 2x (MAX_CUT/WINDOW_TARGET today give 4096 -> 1024 = 4x at 16K); mind the column split a wide band gets (ponytail note in planAxis); unit test + live greenhouse 16K under the lease, judged with scratch 609868bb `calib.cjs`/`seamcrop.cjs` (seamScore edge < ~15 and an eye check at the seam), never `divider.mjs` alone. Then the Cosmo turn: ask Fabio to paste his DeepInfra key into the isolated profile a244 instance (NO_KEY today). Cosmo turn blocked: isolated profile has no DeepInfra key ($0 spent).

**2026-10-13 (609868bb) - (c) IDLE GAP FIXED in code, unit-proven, live check pending (GPU queue).** Root cause: a pass's job settles -> the store has no running job -> `statusBar._reconcileFromStore` self-heals to IDLE while the result lands, the next window is cut and the next pass queues. Fix: new event `tool:hold` - generationService emits `active: true` on the success path of a pass whose config carries `flowContinues` (flowService sets it when `runNextPass` exists, with the next i/N); the bar sweeps under the run's label, ignores the store's emptiness and the finished pass's late terminals, and the next pass's `tool:running` ends it. `flowService.releaseHoldOnEnd` wraps the run's callbacks so any cancel/error (incl. a pending pass Stopped in the queue, which only calls `onCancel`) sends `active: false` tagged with the run's tempId; a save failure in generationService releases too. Test `tests/status-bar-hold.test.cjs` (fails 2/4 on HEAD statusBar, 4/4 now); `npm test` 3297/0. NEXT: live 16K check on harness (scratch 609868bb `sampler.js` + `mcp.py` + `anime16k_lr.jpg`); (b) needs a REAL sharp 16K photo - none on disk (`Pictures/Big Photos Test/bigphoto-16k.jpg` is an anime upscale, soft at 1:1); candidate Poly Haven `abandoned_greenhouse` tonemapped JPG (CC0, 20650x10325, 48.6 MB) awaits Fabio's download OK; (a) Cosmo script ready (scratch `cosmo.js`, profile deepinfra, model '' = DeepSeek-V4-Flash, ~$0.0035).

**2026-10-13 (4a8405cd) - 4b/4c/4d RUN LIVE, details in validation.md:** 4b PASS (16K both ways = 11 windows, status bar i/N, one card) and 4c PASS (local describer filled `Input_Positive`). Result Tiles slider stretched non-square pictures - FIXED, uncommitted (`MpiStepEdges.repeatFromTiles`: joined axis `100/n %`, other `auto`; `MpiBaseFlow._applyTilesRepeat` takes its `position`; `result-tiles` + `step-edges` tests). MCP generate PASS. OPEN, awaiting Fabio: (a) Cosmo on `ornith:9b` sends "make this picture tile" to a TILED UPSCALE, not this Flow - try the production DeepInfra model (paid, ask) and/or name "tile/repeat" in Cosmo's routing; the Flow is dev-gated, so text pointing at it must be gated too; (b) status bar reads IDLE between windows (~15 s a gap at 16K); (c) 16384-wide left-right joins fail 2 of 6 on a blurry test picture (white divider or hard edge at Klein's 4x shrink; 8K/1024 clean) - fix direction is Fabio's call (seed retry on a divider check, a smaller shrink cap, or prompt). Harness for the next live run: scratch 4a8405cd `harness.cjs` (run under the lease) + `ev.py`. **FABIO SAID YES TO ALL THREE (2026-10-13):** (a) ONE Cosmo turn on the production DeepInfra model, ~1 cent, one run only; (b) 16K joins: first test a real (sharp) 16K photo, then re-run a window when a divider is detected at the join; (c) fix the IDLE gap on this card.

**2026-10-13 SCOPE SPLIT (Fabio):** Make seamless = join the edges of a picture you HAVE (pano, background, busy texture); it says out loud that a big shape crossing an edge or one-sided light still repeats and that it does NOT make game textures (FlowDef description + `docs/agent/flows.md`). The no-picture leg was never built (dropped 2026-10-12), so nothing to remove; the planner already refuses an empty run. Tileable texture (made to tile from scratch) = new card MPI-1128 (todo, research). Fabio: the two need not ship together now that Make seamless says it is not for tiles.

**2026-10-13 (e1a94c33) - edge graphic APPROVED by Fabio, subject swapped to AUTUMN LEAVES:** moss's cut was too subtle. New local Klein t2i `t2i_005` (leaves) -> left-right run `flowMakeSeamless_038`; hero + tile rebuilt with the same edge recipe (`edgeplates.mjs` + `hero2.sh`). FABIO APPROVED it. NEXT: checklist 4b/4c/4d.

**2026-10-13 later (e1a94c33) - GRAPHICS REDONE per Fabio:** he rejected the tiled-grid hero (moss already looks tileable at that scale; thin heat lines misrepresent the change). New design = ONE EDGE at 1:1: two copies of moss side by side, joint centred; hero = hard edge -> see-through rose strip at the REAL band width (10% a side = 204 px) fades in -> repaint crossfades under it -> strip lifts on a matching edge -> hold -> back; tile = that strip, top half before / bottom half after. Scratch e1a94c33 `edgeplates.mjs` + `hero2.sh`. Marble re-run with the fix (`_037`) still fails (vein ~300 px apart at the edges; 10% band cannot bend it) and the agent path cannot widen the handles (edges are not a Flow field). Awaiting Fabio's eye test of the edge hero.

**2026-10-13 session e1a94c33 - BOTH-WAYS CENTRE BREAK FIXED (uncommitted until the handoff/close-out):** `services/seamlessOps.js` keeps the working copy UNROLLED; every window carries its frame (fx, fy) - x band (dx, 0), y band (0, dy), plus one corner window (dx, dy) per both-ways run (`planCorner`, `fade: true` = mask and paste smoothstep to 0 at both ends of its run); `windowCut`/`paste` read/write the frame as up to 4 wrapped pieces (`framePieces`), `finish` is a copy. New test 'both ways: no break...' fails on the old code (step 255 -> 0 at h/2) and passes now; seamless-ops 20/20 incl. 16K, related suites 46/46. Live: moss `_028`, sand `_031`, stone `_034` (3 windows each, ~50-60 s), mid-line step now ~1x (see validation.md). Flow graphics REBUILT from `_028` (`comfy_workflows/display/flow-make-seamless.webp` + `.mp4`, same recipe, scratch e1a94c33 `rebuild.sh`). NEXT: Fabio's eye test of the new tile + hero, then checklist 4b/4c/4d.

**Where it stands (2026-10-12, session a244b23d):** card in `doing`. Phases 0-3 DONE + committed (9cc0ce44b). BAND-EDGE FIX DONE + FABIO EYE TEST PASS (2026-10-12), NOT committed (the handoff/close-out commits): the model's mask now RAMPS from 0 at each band edge (`seamlessOps.rampMaskBuffer`, RAMP_FRAC 0.4) and the graph runs LanPaint through `DifferentialDiffusion`, so the band's outer part keeps the picture's own content; 8K E2E band-edge line score 1.00/1.00 (failed run 1.61/1.34), validation.md. A wider paste feather ghosts and a multi-band paste leaves haze - do NOT retry those. Soft-at-1:1 seam area was shown and accepted - no detail pass. Fabio asked Cosmo/MCP: both enter through `/connector/generate` (services/agentTools.mjs:129 + the MCP generate tool), the door the 8K E2E proved; a live run of each is checklist 4d. SESSION 02405ed6 (2026-10-13): graphics built + committed (moss tile + hero, `comfy_workflows/display/flow-make-seamless.*`, c. local commit) BUT the moss result they use carries the BOTH-WAYS BUG below - rebuild them from a fixed run. Fabio's UI feedback DONE (uncommitted -> committed by the handoff): Preview tiles removed from step 02 (the result's Tiles slider is where he wants it), Even out lighting moved to step 03 (Flow `fields`; `_planPasses` now hands `{ ..._fieldValues, ..._stepValues }` to the planner, the planner reads `lightingFlatten` flat), the Edges gizmo's corner-zoom bug fixed (`_refit()` on image load - the ResizeObserver had sized the canvas first so `_syncCanvasSize` returned early and the picture drew at scale 1 from its top-left; MpiStepCrop already refits there); its dead tiles view removed. Tests 73/73 focused, NOT yet seen in the app. BOTH-WAYS BUG (Fabio saw it, GO given for the fix): every both-ways result has a hard break halfway down each side band (y=h/2) and halfway along the top/bottom bands (x=w/2) - measured on `flowMakeSeamless_021/_023` (row step 2.0-3.2x at y=512). Root cause `services/seamlessOps.js` `planAxis`: prepare rolls by (w/2, h/2), so each band is ONE window whose two free ends (rolled y=0/h, resp. x=0/w) are neighbouring rows/cols of the real picture's middle, painted independently. Left-right only never rolls y, so the pano never showed it. APPROVED FIX: keep the working copy UNROLLED and give every window its own roll: x-band windows in frame (dx, 0) - their ends land on the top/bottom edge, which the y pass repaints; y-band windows in frame (0, dy) - their ends land inside the joined side seam; then ONE corner window in frame (dx, dy) centred where the four copies meet, mask = the y band near the x centre line, ramped, to repaint the last junction. windowCut rolls before extract, paste rolls/composites/rolls back; finish no longer unrolls. Both-ways runs gain one window (flowPasses count follows the plan). Verify: unit tests for the plan + a both-ways synthetic with no break at h/2 / w/2; then moss, sand, stone runs on own app:isolated under the lease, row/col step at h/2 and w/2 ~1x; then rebuild the graphics from the fixed moss run. NEXT after that: (2) the Flow screen in an isolated app: status bar i/N on a 16K picture (multi-window), no second Generating card, Tiles slider, a texture both ways; (3) one run with the box EMPTY (describer path; ask Fabio first if the isolated profile's describer is a paid cloud pick).

**Project mode:** scalable-foundation. **Design approved by Fabio 2026-10-12** - the whole record, with
every ruling and the prior art, is `research/brainstorm.md`. In one breath: a dev-gated Flow,
01 Inputs (optional picture) - 02 Edges (four % handles, 10% default; Tiles preview 1-4; Even out
lighting, default 0) - 03 Generate (Tiles slider 1-4: strip / column / per-side grid). The app rolls the
picture by half, repaints the band round each seam in ~1024 windows (one model), stitches each back,
rolls back. Baked instruction + optional prompt. No picture = Klein 9B makes one from the prompt first.

**Gate: the model.** The bench (`research/bench/`, `run_bench.sh` under the GPU lease) picks Klein 9B vs
Krea 2, with a no-model half-shift blend as a baseline column. It runs ONLY on Fabio's go (the GPU
blocks every other agent). CPU halves dry-run clean 2026-10-12. Default if the sheets tie: Klein 9B.

**Investigation (3 read-only agents, 2026-10-12) - the facts the plan stands on:**
- **Steps.** One registry: `STEP_KINDS` (`js/components/Blocks/MpiBaseFlow/stepKinds.js:25-61`); a new
  gizmo = one component + one line; `_getSteps` (`MpiBaseFlow.js:136`) skips unknown kinds. Step contract
  `{ media, value, onChange, step, source, sourceValue }` + `el.getValue()`; a step's `fields` reach it
  through `el.onField(id, val)` (`MpiBaseFlow.js:2104-2115`). Closest model: `MpiStepCrop` (own canvas
  + view transform + image-space pointer mapping, `MpiStepCrop.js:209-305`), not `MpiStepBox`.
- **Media rules are missing.** `ruleHolds` (`flowsRegistry.js:3177`) reads FIELD rules only; legs
  (`legWanted` :3248, `operationBy` :3264) and step/field `hiddenWhen` (`declaredFields.js:389-415`)
  cannot test whether a picture was given. `{ media }` exists only in describe entries
  (`flowEnhance.js:401`). A no-picture step today shows "Add the image for this step on the first step."
- **Passes.** Outpaint's planner chains engine runs: `MpiBaseFlow._planPasses` (:3607, HARDCODED to
  `kind === 'crop' && maxGrow`) -> `_run` -> `flowService.nextPassCallbacks` (:287) /
  `runNextPass` (:586); the agent duplicates it (`agentDispatch.js:1065-1085, 1293-1330`). Every pass
  LANDS through `runLanding` on the same tempId. MPI-1092 (shipped f3ec8cb40, validating) stamps
  `config.flowStep` per LEG only (`flowService.js:186-190, 611` -> `statusBar.js:549-557`); a pass gets
  `null`, so "2/5" needs a pass index stamped there.
- **The engine cut/stitch cannot be reused for windows.** `/engine-mask` passes through anything
  <= 4096 (`engineMask.js:137`), picks its own square, and `stitchMaskCrop` deliberately bleeds ~48 px
  OUTSIDE the mask (:340) - that breaks "outside the band byte-identical". The pixel work goes in a
  NEW server service; `routes/toolResize.js` + `services/resizeOps.js` are the shape to copy, never
  `routes/projects.js` (3991 lines, peer-edited). Step media (`STEP_MEDIA`) is a renderer canvas capped
  at 4096 from the display copy, so it cannot carry the roll.
- **sharp traps** (`~/.claude/memory/tools/sharp.md`): fixed op order (extract before composite, so
  materialise each half), `limitInputPixels: false` on EVERY input incl. composites, lossless
  intermediates only (raw / `.v` / PNG; a bare `toBuffer()` keeps JPEG q80), big overlays via `.v`,
  blur-then-threshold runs threshold first, `.stats()` ignores `extract`, `sharp.cache({ files: 0 })`.
- **Graph.** The Flow ships its own `flow_make_seamless.json`, pruned from the Character Sheet
  Editor's locked Klein branch (`flow_character_sheet_edit.json` 39/47/53/54/57): MpiMaskSquareBbox(64)
  -> InpaintCropImproved (target 1024, blend 32) -> ReferenceLatent -> FluxGuidance 4 ->
  SetLatentNoiseMask -> LanPaint_KSampler (4 steps, cfg 1) -> VAEDecode -> InpaintStitchImproved ->
  MpiClearVram -> `Output_Image`. Prompt: untitled baked MpiText -> Join Prompt (" ") with
  `Input_Positive` -> Trim (the Outpaint join, `flow_outpaint.json` 112/666/667/685). NOT the model's
  `klein_9b_t2i.json` (Flows dispatch with `model.id: null`, no bake slot, enhancer/NSFW/style baggage,
  ids move on re-export). A ~1024 window samples ~1:1 (target 1024 / square side). No new deps:
  LanPaint + cropandstitch are pinned universal nodes. A second small graph,
  `flow_make_seamless_t2i.json` (pruned Klein t2i), is the no-picture leg; never one graph with a lazy
  switch (the cloud-edit.md loader trap, and the app must roll between the two).
- **Agent/MCP.** `description`'s first sentence is what the agent reads (`flowDoes`); field LABELS carry
  meaning (info/note dropped); pin in `tests/agent-flow-handover.test.cjs`
  (`docs/playbooks/add-flow/07-agent-knowledge.md`).
- **Peer-touched files** (claim before editing, re-check at start): `js/data/flowsRegistry.js`,
  `docs/agent/flows.md`, `docs/flow-packages.md`, `docs/releases/UNRELEASED.md`,
  `tests/desktop/flow-library-filters.spec.js` were uncommitted MPI-1071 edits on 2026-10-12;
  `MpiBaseFlow.js/.css`, `flowService.js`, `commandExecutor.js`, `agentDispatch.js`,
  `routes/projects.js`, `routes/mcp.js` had peer commits within the hour.

**Decisions taken in planning (engineering, not product; recorded so `mpi-continue` never stops on them):**
- **D1 Server owns the pixels.** New `services/seamlessOps.js` + `routes/seamless.js` (mounted in
  `server.js`). A run keeps a lossless full-size WORKING COPY in `os.tmpdir()/cubric-seamless/<runId>/`
  (swept at 24 h like `cubric-engine-inputs`): `prepare` (optional lighting flatten -> roll -> band ->
  window plan), `window(i)` (cut + mask PNGs, each <= 4096, mask = band ∩ window), `paste(i, result)`
  (alpha = the band ∩ window, feathered INWARD only, so outside the band stays byte-identical),
  `finish` (roll back, write the result). Band math is the brainstorm's: after a roll by n//2 the band
  is [n/2 - hi*n, n/2 + lo*n).
- **D2 One card per run.** Window passes paste into the working copy; only the LAST pass lands, as the
  full-size rolled-back picture. Intermediate window outputs never become cards or history versions.
  Hook: an op flag (`pastesToWorkingCopy`-style) that `_finishGeneration` honours the way it honours
  `cropsToMask` -> `_stitchOutputs` - one seam, both producers (UI + agent) inherit it.
- **D3 The pass plan is data, not a branch.** Generalise `_planPasses` into a per-Flow planner
  (`passes: '<planner id>'` on the FlowDef, planners in `js/utils/` - Outpaint's moves there unchanged),
  ONE module imported by both `MpiBaseFlow` and `agentDispatch`. Its pass count feeds MPI-1092's
  `flowStep`, so the status bar reads `2/5`.
- **D4 `{ media }` joins `ruleHolds`** - one evaluator for legs, `operationBy`, step and field
  `hiddenWhen`, as its header promises. Then: leg 1 `flowMakeSeamlessT2i` runs `when` there is no
  picture; the Edges step hides with no picture; the direction select shows only then.
- **D5 Tiles preview = CSS** `background-repeat` on the display copy (one decode, GPU tiling),
  `background-size` 100/N %, repeat only on the joined axes. Same primitive on step 02 and the result.
  Judge joins at 1:1, never in a downscaled copy (edge clamping can draw a faint line).
- **D6 Mask transport:** the window cut and its mask go as two media files on the `Input_Image` /
  `Input_Mask` (red channel) titles, matching the model graphs.

## Completed

- [x] Brainstorm + design approval (Fabio, 2026-10-12) - `research/brainstorm.md`.
- [x] Bench scripts + CPU dry run - `research/bench/`.

## Remaining Work

## Phase 0: Model bench (GATE, needs Fabio's go)

- [ ] On Fabio's explicit go only: run `research/bench/run_bench.sh` under `gpu_lease.py run` (exact
  command in the script header; the G:\ComfyUi bench must be up on :8188). Send Fabio the four
  `sheet_*.jpg` + `report.txt`; he picks. If the band shows LanPaint inventing content, re-run the
  winner once at a lower denoise before Phase 2. Record the verdict + numbers in `validation.md`.
  **Verify:** 16 repaints saved, `report.txt` shows `max change outside band 0` on every run, Fabio's
  verdict written down.

## Parallel Batch: foundations (independent of the model; may run before Phase 0 ends)

`mpi-execute-parallel` is appropriate here: three disjoint ownerships, each verified by its own unit
tests, no shared file.

- [x] **A1 Seamless pixel service (D1).** DONE 2026-10-12: 17/17 tests, lint clean; routes POST `/seamless/prepare|window|paste|finish` (contract in the `services/seamlessOps.js` header); `runId` must be a uuid (traversal guard added at integration). Ownership: `services/seamlessOps.js`, `routes/seamless.js`,
  `server.js` (the one mount line), `tests/seamless-ops.test.cjs`. Briefings: the Critical Rules
  Snapshot + `root-cause.md` § Sub-Agent Briefing + `~/.claude/memory/tools/sharp.md` + `docs/resize.md`
  + `docs/big-photos.md`. **Verify:** `node --test tests/seamless-ops.test.cjs` green, covering: roll
  then unroll is byte-identical (odd and even sizes); band math matches the formula for asymmetric
  handles and a handle at 0 (no band on that axis); windows cover the band with none > 4096 and the
  ~1024 target; paste changes ZERO pixels outside the band; a 16384x8192 synthetic (made in-test with
  sharp, never committed) completes; lighting flatten at 0 is a no-op and at >0 reduces a synthetic
  left-to-right gradient.
- [x] **A2 `MpiStepEdges` gizmo + tiles view (D5).** DONE 2026-10-12: 23/23 + step-param-binding 7/7, lint clean; no STEP_PARAMS adapter (edges go to the server service, not injection); `StepEdgesValue` typedef parked atop `MpiStepEdges.js` until `types.js` is free. Ownership:
  `js/components/Organisms/MpiStepEdges/` (.js + .css), `stepKinds.js` (one `STEP_KINDS` line + a
  `STEP_PARAMS` adapter if needed), `js/components/types.js` (typedef), the css registration file the
  component docs name (`.claude/rules/components.md`), `tests/step-edges.test.cjs`. Briefings:
  `/mpi-brief-rule components`, `dos_and_donts`, `component-mounts`; `docs/playbooks/add-flow/ui/`;
  `docs/big-photos.md` § Flow screens (`setDisplaySrc`/`originalSize`). Four per-side handles in
  image-space %, clamped 0..50 per side and left+right <= 100; value `{ left, right, top, bottom }`;
  `onField('tiles', n)` hides handles above 1 and shows the CSS repeat on the joined axes.
  ComponentFactory, BEM `mpi-step-edges__*`, CSS vars only, `qs`/`on`/`off`, `el.destroy()`.
  **Verify:** unit test on the value maths + clamping; `npm run lint:components` clean on the new
  folder.
- [x] **A3 `{ media }` in `ruleHolds` (D4).** DONE 2026-10-12: rule `{ media: '<role>', present? }` (present defaults true), context `ctx.media` = Set of roles carrying a file, threaded as a NEW optional 3rd/4th arg (`ruleHolds(rule, values, ctx)`, `legWanted(flow, leg, run, ctx)`, `hiddenFieldIds(fields, values, modelIds, ctx)`); 9 new tests, `npm test` 3197/0. `operationBy` stays a field map (not a rule), `disabledWhen` stays field-only: neither is needed here. Ownership: `js/data/flowsRegistry.js` (`ruleHolds`,
  `legWanted`, `flowOperation` only - NOT the FlowDef list), `js/utils/declaredFields.js`
  (`hiddenFieldIds`), `tests/flow-rules-media.test.cjs`. Briefings: Critical Rules Snapshot,
  `flowsRegistry.js` § Legs, routing and rules. One evaluator: `{ media: role, present: bool }` (exact
  shape the implementer's call, documented in that header). **Verify:** new test: a leg / step / field
  rule on media holds and fails correctly; `npm test` green (existing leg + hiddenWhen tests unchanged).

## Phase 2: Graphs + op registration (after Phase 0 names the model)

- [x] Build `comfy_workflows/raw/flow_make_seamless.json` (the D-graph above, with the bench's winning
  denoise; Krea 2 instead if it won - then the Krea pair slot + turbo field per
  `docs/playbooks/add-flow/any-of-models.md`) and `raw/flow_make_seamless_t2i.json`; convert with
  `COMFY_URL=http://127.0.0.1:48188 node scripts/workflow-to-api.mjs` or `sync-raw-workflows.mjs`
  (never bare: 8188 is the bench). Register `flowMakeSeamless` + `flowMakeSeamlessT2i` in the 4 files
  (`commandRegistry.js` `universal:true`, `universal_workflows.js`, `core/operationRegistry.js`,
  `operation_registry.json` hand-edited) per `docs/playbooks/add-flow/01-descriptor-and-ops.md`.
  Run `/mpi-add-flow` - it enforces the playbook. **Verify:** `tests/inject-params-titles.test.cjs`
  pins `Input_Image`, `Input_Mask`, `Input_Positive`, `Input_Seed` and that the bake is NOT titled
  `Input_Positive`; one bench run of each converted API graph on :8188 under the lease returns an image.

## Phase 3: Wire the Flow (after the batch + Phase 2)

Sequential, not a batch: every task edits `MpiBaseFlow.js` or `flowService.js`.

- [x] FlowDef in `flowsRegistry.js`, dev-gated (`...(APP_CONFIG.dev_mode ? [...] : [])`): optional
  `image1` (`mode:'upto', max:1`, "(optional)"), leg 1 `flowMakeSeamlessT2i` `when` no picture, step
  `kind:'edges'` with fields Tiles + Even out lighting (hidden with no picture), Direction select (shown
  only with no picture), optional `positive`. **Verify:** the Flow appears in the dev Library; its
  fields render; `tests/flow-model-choice.test.cjs` + existing Flow tests green.
- [x] **Pass media ctx at every caller (A3 left these; without them a `present:false` rule HOLDS even when a picture was given):** `flowsRegistry.js` `flowRunLegs` (forward ctx to `legWanted`); `flowService.js` `chainCallbacks` / `flowStep` / `submitFlowGeneration`; `agentDispatch.js` ~1359 (build `ctx.media` from `run.mediaItems`); `MpiBaseFlow.js` `_visibleSteps` / `_hiddenNow` / `_paintFieldConstraints` (4th arg to `hiddenFieldIds`); `flowEnhance.js` ~343/403. One helper that builds the Set from mediaItems, imported by UI and agent. **Verify:** a test per producer.
- [x] D3 planner: DONE 2026-10-12 (see Plan Drift for the shape that shipped). move Outpaint's planner behind `passes:` unchanged, add the seamless planner (calls
  `/seamless/prepare` once, then per pass `/seamless/window`), stamp pass index/total into `flowStep`.
  Same module in `agentDispatch.js`. **Verify:** Outpaint's existing pass tests
  (`tests/outpaint-next-pass.test.cjs`) still green; a new planner test plans 1 window for a 1024 tile
  and ~4-5 for a 8192x4096 pano left-right.
- [x] D2 landing: DONE 2026-10-12, reshaped (see Plan Drift). the op flag + `_finishGeneration` hook pastes each window, lands only the final
  rolled-back picture. **Verify:** test - an N-pass run lands exactly one card version at the source's
  full size.
- [x] Result pane Tiles slider: DONE 2026-10-12. FlowDef opts in with `result: { tiles: true }`; axes from the edges step value, else a `direction` field (`left-right|top-bottom|both`, `resultTileAxes` in MpiStepEdges.js); tiles the DISPLAY copy via `resolveDisplayImage` (orchestrator fix: the worker tiled the full-size original, past Chromium's 16384 texture cap on a 16K pano). Was: (`MpiProgressBar`, `interactive`, 1-4) between frame and
  `_pendingNote`, gated on a FlowDef `result.tiles` key; repeat only on the joined axes. **Verify:**
  unit test on the axes -> repeat mapping; lint clean.
- [x] Agent + MCP: `description` first sentence "Make a picture tile seamlessly ...", labelled fields,
  `tests/agent-flow-handover.test.cjs` pin, a `docs/agent/flows.md` line within its 200-line budget.
  **Verify:** `npm test` green incl. `agent-prompt-budget`.

## Phase 4: End to end (user-ux)

- [ ] Own instance only (`npm run app:isolated`, never :3000), engine runs under the GPU lease: the 8K
  broken pano left-right, a texture both ways, a prompt-only texture. Check: status bar `1/N..N/N`, one
  card, full size, outside-band unchanged (diff against the source), Tiles slider shows strip / grid.
  **Verify:** the four checks recorded in `validation.md` with numbers; then Fabio's eye test.

## Plan Drift

- 2026-10-13: scope split - texture-from-scratch leaves this card for MPI-1128; Make seamless's copy now states its limits.
- 2026-10-12 (session 5c333500) Phase 4 REDESIGNED THE WINDOWS (`services/seamlessOps.js` planAxis): A1 cut each window to exactly the band and masked all of it, so Klein had no surroundings and painted a new picture per window. Now each window has `rect` (the cut: band + context of max(256, band/2) px each side, so the model sees ~bench proportions), `paint` (its mask: band minus what an earlier window already painted) and `band` (what is pasted, feathered inward; outside stays byte-identical); a seam up to 4096 long is ONE window (bench-like; a second window seeing only a pano's floor painted its own scene), longer seams walk in square windows overlapping by max(256, len/4). Cost: at 8K the band is repainted at ~0.3x (the bench's scale), so it may read SOFTER than the picture - Fabio's eye decides; a native-res detail pass is the upgrade. Also: mask slot `planned: true` (caller checks skip it, agents never see it, enqueue still requires it); a one-pass plan never chains `runNextPass` (UI + agent). Default 10% handles at 8K = a 1638 px band: worth Fabio's look too.

- 2026-10-12 (session 5c333500) Phases 2+3 DONE. Shape that shipped: op `flowMakeSeamless` (`image1`->Input_Image, `mask`->Input_Mask, `pastesToWorkingCopy`); prompt field id `Input_Positive` (typed words land in injectionParams, so the describer, which skips a filled target, leaves them); `describe: [{ to: 'Input_Positive', media: 'source' }]` where the planner adds the WHOLE picture on role `source` to pass 1 only (a window is mostly seam), answer carried to later passes via `_leg.described`; a `direction` field hidden whenever a picture is given (the agent's way to name the joins; the gizmo value wins via `edgesFor`); step fields `tiles` (preview only) + `lightingFlatten` (0..1). NO `result.compare`: the run's `image1` is a window. Make seamless is excluded from the "every Flow as a package" test: its planner is keyed to the built-in op id.

- 2026-10-12 FABIO (after the round-5 sheets): build it with KLEIN, skip Krea. TWO options, done in order: (1) FROM AN IMAGE - make an existing picture seamless with the round-5 Klein repaint: BUILD THIS FIRST; (2) FROM SCRATCH - textures (gaming textures especially) generated tileable from the start, the prior art he linked (brainstorm.md: spinagon circular-padding works on a CONV model, SDXL, not on Klein/Krea transformers). Option 2 is LATER: the no-picture leg (`flowMakeSeamlessT2i`, Direction field) is out of the first build. The from-image Flow keeps `image1` REQUIRED.
- 2026-10-12 Phase 0 round 5 = the working recipe, and it CHANGES Phase 2: the graph has NO ReferenceLatent (a reference makes Klein copy the band, seam included), and its prompt is the baked instruction + one line saying what the picture shows. Without that line a reference-free Klein paints unrelated things (round 4). So the Flow needs the content line: the user's prompt, else the app's describer (`describe`, MPI-1036) writes it. Rounds 1-4 in validation.md.
- 2026-10-12 Phase 0 rounds 1+2 INCONCLUSIVE: the masked branch is LanPaint at denoise 1.0 already; the seam survives because the edit REFERENCE (`ReferenceLatent`) is the input itself, seam included (validation.md). The Phase 2 graph inherits that wiring from the Character Sheet Editor branch: its reference must not carry the band. Round 3 tests blanking the band first. Sheets go to Fabio only once a run actually repairs a seam.
- 2026-10-12 D2 SHIPPED RESHAPED (uncommitted). The worker's version failed on every real run, four ways its fetch-stubbed tests hid: `/seamless/finish` sent without the `outPath` the route required (400); `/seamless/paste` handed the engine's VIEW URL where the route wanted a disk path (404); middle windows emptied `outputUrls`, which generationService treats as CANCELLED (run ends, preview revoked); and generationService's executor payload is a WHITELIST, so the window id never reached `_finishGeneration`. What shipped instead: EVERY window pastes (`/seamless/paste {runId,i,viewUrl}`, fetched like `/engine-stitch`) then finishes (`/seamless/finish {runId}` -> absolute `/project-file` URL, new file each time) and that whole picture saves; window 1 lands the card, each later window REPLACES that version (`replaceItemId`) through the chained-leg door (`landOnCard` in flowService, shared with `chainLegInputs`) - one card, one version, healing seam by seam. All per-pass data is ONE run-only key `runPass: { index, count, seamless?: { runId, i }, replaceItemId? }`, pulled off in `submitFlowGeneration`'s signature so it never reaches `snapshot` (= the sidecar's `flowInputs`; the worker had leaked `runPassIndex` + `seamless*` there). `/seamless/window` returns `/project-file` URLs (as `/engine-mask` does); the planner decodes a slot's `/project-file` URL to the disk path `/prepare` needs. The agent path now REFUSES (`RUNTIME_ERROR`) when a planning Flow gets no plan, instead of running one pass on the whole picture. New `tests/seamless-landing.test.cjs` drives the real routes over HTTP. PHASE 4 MUST CHECK: no second "Generating..." card appears during windows 2..N, and the queue row/status bar reads i/N between windows.
- 2026-10-12 Phase 3a shipped (uncommitted): ONE media mechanism - `flowRunLegs` / `flowRunAvailability` default `ctx = flowMediaCtx(run?.mediaItems)` (UI `runInputs` and the agent `run` both carry `mediaItems`), explicit ctx at `hiddenFieldIds` callers (MpiBaseFlow `_mediaCtx()`, flowEnhance). Planners live in `js/utils/flowPasses.js`, keyed by OPERATION id (`flowMakeOutpaint`, `flowMakeSeamless`), NOT a `passes:` FlowDef key - `services/userFlows.js` FLOW_KEYS rejects unknown keys. Seamless planner: `/seamless/prepare` + per-pass `/seamless/window`, pass 1 via `firstPassMedia`, each payload carries `seamlessRunId` + `windowIndex` for D2. Status bar: `runPassIndex`/`runPassCount` -> `config.flowStep = "i/N"`. 11 new tests; `npm test` 3209/0. UNPROVEN until Phase 4: a picture added/removed re-hides media-ruled fields/steps (slots call `onDirty`, which rebuilds the slide; check it in the isolated app).
- 2026-10-12: Fabio: "start Phase 3 while the GPU is busy, then lease the GPU, get in line" = the
  Phase 0 go. Bench queued under `gpu_lease.py run --timeout 21600 --poll 2` (5th in the FIFO line at
  ~10:10 local); assert on the output files in `G:/ComfyUi/ComfyUI/output/mpi1101`, never on exit 0.
  Phase 3a (media ctx at callers + D3 planner) dispatched to a worker meanwhile.
- 2026-10-12: MPI-1071 committed + released `flowsRegistry.js` (e3a8f8fcb) mid-batch, so A3 ran right after A1/A2.
- 2026-10-12 (session 3feb22c3): card moved `todo -> doing`, `files.json` written. Batch ran A1 + A2
  only. A3 deferred: `js/data/flowsRegistry.js` is held by MPI-1071's live claim (2458ed19) with
  uncommitted hunks; message `3feb22c3-mpi1101-to-mpi1071` asks for the release. A2's `types.js`
  typedef deferred too (MPI-623's claim cdb2fd5e holds it): the typedef sits as JSDoc at the top of
  `MpiStepEdges.js` until it can move.

## Verification

**Verify mode:** user-ux (Phases 0 and 4 need Fabio's eyes: the bench sheets and the running Flow;
the batch, Phase 2 and Phase 3 self-verify with tests).

Done means: a dev-gated Make seamless Flow in the Library; with a picture it returns ONE full-size card
whose pixels outside the chosen bands are byte-identical to the source and whose joins pass Fabio's eye
on the Tiles view; with no picture it makes a texture from the prompt and returns it tileable; the agent
and MCP can run it; `npm test` and `npm run lint` green; the status bar counts the windows.

## Preservation Notes

- New doc `docs/playbooks/add-flow/existing-flows/make-seamless.md` (<= 200 lines): the roll + band +
  window recipe, D1-D6, the bench verdict. Route it from `docs/README.md` / the add-flow README.
- `docs/flows.md` / `docs/playbooks/add-flow/01-descriptor-and-ops.md`: the `{ media }` rule (D4) and
  `passes:` planners (D3) are engine-wide contracts - document where the rule/leg contract lives.
- `docs/big-photos.md`: the seamless service is a fourth big-photo path (its own cut, not
  `cropsToMask`) - add a row so the next agent does not "fix" it onto `/engine-mask`.
- `docs/releases/UNRELEASED.md` line when it ungates. Preview art: `/mpi-flow-graphics` (separate step).
- Ask Fabio before editing `.claude/rules/` (new step kind + result control = component wiring change).
- Lighting-flatten idea credit: SparknightLLC's repo has NO licence file - ideas only, no code copied.
