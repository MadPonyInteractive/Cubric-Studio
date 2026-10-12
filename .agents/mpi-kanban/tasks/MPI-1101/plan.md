# MPI-1101 Make seamless - a Flow that makes any picture tile left-right, top-bottom or both

## Current State

**Where it stands (handoff 2026-10-12):** planned, card in `todo`, NO code written. Next: move the
card `todo -> doing` with `files.json`, then the Parallel Batch (or Phase 0 the moment Fabio says the
GPU is free).

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

- [ ] **A1 Seamless pixel service (D1).** Ownership: `services/seamlessOps.js`, `routes/seamless.js`,
  `server.js` (the one mount line), `tests/seamless-ops.test.cjs`. Briefings: the Critical Rules
  Snapshot + `root-cause.md` § Sub-Agent Briefing + `~/.claude/memory/tools/sharp.md` + `docs/resize.md`
  + `docs/big-photos.md`. **Verify:** `node --test tests/seamless-ops.test.cjs` green, covering: roll
  then unroll is byte-identical (odd and even sizes); band math matches the formula for asymmetric
  handles and a handle at 0 (no band on that axis); windows cover the band with none > 4096 and the
  ~1024 target; paste changes ZERO pixels outside the band; a 16384x8192 synthetic (made in-test with
  sharp, never committed) completes; lighting flatten at 0 is a no-op and at >0 reduces a synthetic
  left-to-right gradient.
- [ ] **A2 `MpiStepEdges` gizmo + tiles view (D5).** Ownership:
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
- [ ] **A3 `{ media }` in `ruleHolds` (D4).** Ownership: `js/data/flowsRegistry.js` (`ruleHolds`,
  `legWanted`, `flowOperation` only - NOT the FlowDef list), `js/utils/declaredFields.js`
  (`hiddenFieldIds`), `tests/flow-rules-media.test.cjs`. Briefings: Critical Rules Snapshot,
  `flowsRegistry.js` § Legs, routing and rules. One evaluator: `{ media: role, present: bool }` (exact
  shape the implementer's call, documented in that header). **Verify:** new test: a leg / step / field
  rule on media holds and fails correctly; `npm test` green (existing leg + hiddenWhen tests unchanged).

## Phase 2: Graphs + op registration (after Phase 0 names the model)

- [ ] Build `comfy_workflows/raw/flow_make_seamless.json` (the D-graph above, with the bench's winning
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

- [ ] FlowDef in `flowsRegistry.js`, dev-gated (`...(APP_CONFIG.dev_mode ? [...] : [])`): optional
  `image1` (`mode:'upto', max:1`, "(optional)"), leg 1 `flowMakeSeamlessT2i` `when` no picture, step
  `kind:'edges'` with fields Tiles + Even out lighting (hidden with no picture), Direction select (shown
  only with no picture), optional `positive`. **Verify:** the Flow appears in the dev Library; its
  fields render; `tests/flow-model-choice.test.cjs` + existing Flow tests green.
- [ ] D3 planner: move Outpaint's planner behind `passes:` unchanged, add the seamless planner (calls
  `/seamless/prepare` once, then per pass `/seamless/window`), stamp pass index/total into `flowStep`.
  Same module in `agentDispatch.js`. **Verify:** Outpaint's existing pass tests
  (`tests/outpaint-next-pass.test.cjs`) still green; a new planner test plans 1 window for a 1024 tile
  and ~4-5 for a 8192x4096 pano left-right.
- [ ] D2 landing: the op flag + `_finishGeneration` hook pastes each window, lands only the final
  rolled-back picture. **Verify:** test - an N-pass run lands exactly one card version at the source's
  full size.
- [ ] Result pane Tiles slider (`MpiProgressBar`, `interactive`, 1-4) between frame and
  `_pendingNote`, gated on a FlowDef `result.tiles` key; repeat only on the joined axes. **Verify:**
  unit test on the axes -> repeat mapping; lint clean.
- [ ] Agent + MCP: `description` first sentence "Make a picture tile seamlessly ...", labelled fields,
  `tests/agent-flow-handover.test.cjs` pin, a `docs/agent/flows.md` line within its 200-line budget.
  **Verify:** `npm test` green incl. `agent-prompt-budget`.

## Phase 4: End to end (user-ux)

- [ ] Own instance only (`npm run app:isolated`, never :3000), engine runs under the GPU lease: the 8K
  broken pano left-right, a texture both ways, a prompt-only texture. Check: status bar `1/N..N/N`, one
  card, full size, outside-band unchanged (diff against the source), Tiles slider shows strip / grid.
  **Verify:** the four checks recorded in `validation.md` with numbers; then Fabio's eye test.

## Plan Drift

- None yet.

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
