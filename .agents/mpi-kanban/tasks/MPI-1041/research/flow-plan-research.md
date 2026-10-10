# MPI-1041 - Flow plan research (2026-10-10, session 16d04a9a)

Three read-only sweeps behind `plan.md`. Line numbers are as of master `f9d99ba86`; re-check before editing.

## Engine (flowService / flowsRegistry / declaredFields)

- Op dispatch: `flowService.js:255` `operation: _leg.operation || flow.operation`; graph = `getUniversalWorkflow(op,
  flowModelIds)` (`commandExecutor.js:1860`, `modelRegistry.js:504-512`, first id with a `byModel` entry wins).
- **Trap:** `flowService.js:288` sends ALL slots' ids; with `[klein-9b, qwen-image-2-1]` the `flowCharacterSheetImages`
  byModel table (`universal_workflows.js:170-172`) matches `klein-9b` -> leg 2 gets the KLEIN graph. Resolve ids per op.
- Readers of `flow.operation`: agentDispatch 1217/1228/1401/1413/1759, routineDispatch 46, routineModel 136/323,
  MpiBaseFlow 2316/3089/3097/3546, agentBench.mjs 54, generationService 225-248/575. agentCorpus.mjs:207 drops ops
  starting `flow` - name new ops `flow*`.
- Chain: `flowsRegistry.js:147-152` one object; `chainWanted` `flowService.js:99-104` (`=== true` only);
  `chainLegInputs` 117-137 (leg 1 filePath -> role, `existingGroup` = next version); leg 2 never re-chains 349-352;
  hand runs drive leg 2 from `MpiBaseFlow.submitChainLeg` (~3125), toggle partner lookup 3088-3097.
- Leg 2 inherits leg 1's positive + injectionParams (257/265); describe runs on leg 1 only (378 `!_leg.tempId`) and
  its answers stay in leg 1's config (385).
- Rule formats today: `hiddenWhen`/`disabledWhen` (declaredFields 320-324, 388-398), describe `when` (flowEnhance
  394-397), `derived equals` (declaredFields 594). None compares numbers.
- Exemption lists for control fields: inject-params-titles.test:1081, flow-model-choice.test:698, services/userFlows.js:219.
- Availability: `flowAvailability` 2813-2823 requires every slot; readers: flowService 198/662, agentDispatch
  1205/1746, routineDispatch 68, MpiFlowLibrary 323/338/375/548/577/609/771-797/857-864/893/972/1046, flowLicences
  47-70, MpiGalleryGrid 43, userFlows 157/181, smoke-workflows 1598-1644. Install UI only in the Library drawer
  (an installed Flow skips it, 889-899); MpiBaseFlow `_paintModelSlots` 1594-1660 = picker only.
- One funnel: `submitFlowGeneration` (hand MpiBaseFlow 3625/3125, agent agentDispatch 1090, MCP connector 569 ->
  agentDispatch 560, routines routineDispatch 124). Describe failure -> `ui:warning` + `onError({code:
  'DESCRIBE_FAILED', userMessage})` (flowService 383); CHILD_SAFETY same shape in generationService 575-615.
- Card name: no source-card link on flow media items (generationControls 722); `customName` set only by
  `renameGroup` (projectService 522) / agent `cardName` (agentDispatch 134-182); commit at generationService
  1637-1653.
- Box: `flowCharacterSheetImages` injector = headSwap, writes `box1` -> `Input_Box` (headSwapInjector 31-34); a SENT
  zero box becomes 1x1 (`_intBox` 67-68) - send no box for the whole picture. Right half of an 8:5 sheet is exactly
  4:5, so `box1 = {x: W/2, y: 0, width: W/2, height: H}` needs no graph change; W/H on `result.item.pixelDimensions`.

## Graphs

- Mask convention: `Input_Mask` (296, red channel) = what to CHANGE (white repaints); the bench inverted the SAM3
  head mask. Bench lock = a separate mask graph (`q4b_masklock.py:20-39`: per-panel ImageCrop -> SAM3_Detect 0.5 /
  refine 2 -> MaskComposite add on SolidMask -> FillHoles -> GrowMask 6 tapered -> InvertMask) fed as a PNG.
  Hair lock = vocabulary "face", FRONT + PORTRAIT crops only (`qhair.py:27-30`, validation batch 8).
- `klein_9b_t2i.json` is GENERATED (`raw/klein_t2i_template.json`, `generate_klein.py`): never edit it; author a new
  `raw/flow_*.json` (precedent `flow_outpaint.json`, `flow_draw_it_in.json`), sync with
  `COMFY_URL=...48188 node sync-raw-workflows.mjs`. Never title a baked prompt `Input_Positive`.
- Size-relative panels precedent: `flow_character_sheet_headless.json` (MpiMath "a // 4" -> MpiBox -> MpiBoxCrop,
  SolidMask from loader w/h, MaskComposite at MpiFromBox offsets). MpiIfElse / MpiAnySwitch are LAZY: SAM3 runs only
  when a lock is on.
- Klein exact size: wire `MpiMath "a*b/1048576"` into node 167 `megapixels` (the bench's `Edit_Scale`), and the
  loader w/h into 581's target.
- Qwen 2.1 edit: `qwen_image_2_1.json` node 30 `TextEncodeQwenImage21.resolution` = 0 for the exact size (untitled
  there); W/H divisible by 32. Give the Flow its own pruned graph (no Flow reuses a model graph).
- New op = 4 files (`01-descriptor-and-ops.md:22-66`): commandRegistry.js (example `flowCharacterSheetImages`
  1537-1559, filePrefix reads as the Flow title, add to `ENHANCE_EXEMPT_OPS` 1636-1648), universal_workflows.js,
  operationRegistry.js (`appVersionIntroduced` = current APP_VERSION), operation_registry.json (`"universal": true`).
- SAM3 is an engine asset (assetDeps 940-950), not a Flow dep.

## Child-safety gate (MPI-1056, `js/data/childSafety.js`)

- The bench prompts (child 10, adult 30, rebuild + "jumper / trousers / boots / tie") are `ok` on both model ids with
  source `character-sheet-editor` (checked in memory by the sweep). Age is read from words only ("10-year-old",
  "child"); a NUMBER param is invisible (`configTexts` keeps strings, :343) - so the builder must write the age into
  `positive`. Keys matching `SKIP_KEY` (:336) and file-like values are skipped.
- Caption words a minor's run REFUSES: culottes (French list), thong sandals, sports bra, boxer shorts, babydoll,
  panty hose, see-through, no clothing, swimsuit / board shorts. Ask the describer for "clothing only, no person
  words" ("a woman in a swimsuit" goes to the judge).
- 16-17 + swimsuit on this Flow refused as of the sweep (`sheet` true from the source id, :274) - MPI-1056 changed the rule later that day (ordinary bikini fine anywhere, revealing never): re-read the gate before testing.
- **Gap:** a Clothes run "a red swimsuit" on a sheet that already SHOWS a child passes (no age in the words).
- Test style: `node --test` (package.json:24), `require('node:test')`, ESM via `import()` (child-safety.test.cjs:21),
  tables of `[text, reason]`.

## Tests a new Flow must pass

inject-params-titles (:1005 sweep + a per-Flow case like :241), flow-model-choice (119-141, 281-298, 478, 537,
676-720), flow-chain (77/85/87/155 source regexes, 98-117), flow-required-media 90-100, flow-output-filename 60-80,
flow-frame 195-212, flow-field-constraints 72/93 (preview asset in `comfy_workflows/display/`), flow-type 22,
flow-result-compare 31/44, connector-agent-tools 378, agent-flow-handover 47/64 (`runs` or `want`),
connector-flow-dispatch, agent-prompt-budget 22/71, flow-cloud-edit 68-101, flow-licence-surface 62-80, smoke-flows
31, user-flows 153 + `FLOW_KEYS` (services/userFlows.js:39), op-registry sync (audio-models.test 67-79); desktop
`tests/desktop/flow-*.spec.js` in CI.

## Agent / docs surface

Catalog is automatic from FLOWS (`agentDispatch._listModels` 1745, `flowDoes` = first sentence 1693, MCP
routes/mcp.js 299/306): description must open verb-first. Recipe `docs/playbooks/add-flow/existing-flows/
character-sheet-editor.md`; `docs/agent/flows.md` + `docs/releases/UNRELEASED.md` are MPI-1036's (claimed);
a `docs/child-safety.md` § Where it runs line is MPI-1056's. Non-commercial: description sentence (precedent
flowsRegistry.js:1533); no Flow-level badge; `flowLicences` shows the optional Qwen licence only if keyed in.
