# MPI-1101 Make seamless - a Flow that makes any picture tile left-right, top-bottom or both

## Current State

**Where it stands (2026-10-12, session a244b23d):** card in `doing`. Phases 0-3 DONE + committed (9cc0ce44b). BAND-EDGE FIX DONE + FABIO EYE TEST PASS (2026-10-12), NOT committed (the handoff/close-out commits): the model's mask now RAMPS from 0 at each band edge (`seamlessOps.rampMaskBuffer`, RAMP_FRAC 0.4) and the graph runs LanPaint through `DifferentialDiffusion`, so the band's outer part keeps the picture's own content; 8K E2E band-edge line score 1.00/1.00 (failed run 1.61/1.34), validation.md. A wider paste feather ghosts and a multi-band paste leaves haze - do NOT retry those. Soft-at-1:1 seam area was shown and accepted - no detail pass. Fabio asked Cosmo/MCP: both enter through `/connector/generate` (services/agentTools.mjs:129 + the MCP generate tool), the door the 8K E2E proved; a live run of each is checklist 4d. NEXT: (1) the Flow's graphics - tile still + hero clip - with `/mpi-flow-graphics` (Fabio, 2026-10-12: there are none yet); (2) the Flow screen in an isolated app: status bar i/N on a 16K picture (multi-window), no second Generating card, Tiles slider, a texture both ways; (3) one run with the box EMPTY (describer path; ask Fabio first if the isolated profile's describer is a paid cloud pick).

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
