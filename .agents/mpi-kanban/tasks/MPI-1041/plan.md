# MPI-1041 - Character Sheet Editor Flow

## Current State

**2026-10-10 (session 16d04a9a) - bench DONE (validation.md batches 1-19), Flow plan written, Fabio's go given.
NEXT: `mpi-continue` -> Parallel Batch A** (route it to `mpi-execute-parallel`). Project mode: scalable-foundation.
Research behind every line below, with file:line: `research/flow-plan-research.md`.

**2026-10-10 (session 89967af0) - Phase C DONE (`npm test` 2973/2975, 0 fail). NEXT: Phase D** (UI + docs + the
LoRA cogwheel Fabio asked for via MPI-1036's message, see Phase D). Phase C notes are under its `[x]` line. Phase E
must bench the two dressed checks (validation.md Phase C entry). Perceived age: none, by decision (CP Gate 1). Claim `state/files/89967af0-mpi1041-phaseC.json`.

**2026-10-10 (session 08593195) - Batch A + Phase B DONE (`npm test` 2961/2963, 0 fail). NEXT: Phase C** (UNBLOCKED: MPI-1056 committed `bddf6391c` and released its claim). Phase B notes are under its `[x]` line. Was: Phase B (sequential: FLOWS list + the 4 op registries + `js/data/flowPrompts/characterSheetEditor.js`; templates = `research/templates.md` + the bench scripts; graph contracts = `research/graph-klein.md` / `graph-qwen.md`). Batch A ran as 4 Sonnet workers. Claim
`state/files/08593195-mpi1041-batchA.json` + `files.json` hold every owned path (A1 also owns `js/data/routineModel.js`,
A3 `bench-tools/build_edit_graph_qwen.py`). Briefings: `scratchpad/brief_{A1,graph,A4}.md`. Workers convert with
`workflow-to-api.mjs` single-file mode (never `sync-raw-workflows.mjs` - it commits). A1 must not touch
`flowEnhance.js` (MPI-1056): describe `when` keeps its own check until Phase C, `ruleHolds` exported for it.

**Fabio's answers at the go (2026-10-10):** one change per run - YES; Qwen-Image 2.1 optional - YES; cloud arm -
LATER, once the local Flow is locked in; **Age = a SLIDER, not a number box:** 0 = Off (the prompt does not touch
the age), then 1 = a baby, 2, 3 ... 100 = target years (his dictation said "moves to 0 which would be a baby" -
read as 1; confirm in passing). Open, agent pick: the slider sits on EVERY run (default 0), so "a new outfit AND
age 30" runs the age as its own leg after the picked change (the leg array supports it) and the picker gets a
"Nothing else" choice for an age-only run. If Fabio meant the slider only under an "Age" pick, drop the extra leg.
Picks (4) and (5) below stand (not contested).

**What it is:** a Flow that changes ONE thing on a finished 3-panel sheet (front | back | 3/4 portrait) by words,
all panels consistent, result as a NEW card ("John - beaten up"); the input sheet stays a live asset.

**Per-field route (bench verdicts):**

| change | editor | how | evidence |
|---|---|---|---|
| Clothes | Klein 9B edit, exact size | L1 wording + `Input_Lock` 1 = SAM3 "head, hair, face" on all three panels | b3-b4, 6 of 6; A2 3 of 3 |
| Accessories | Klein 9B edit, FREE (`Input_Lock` 0) | "Give the character <words>." + L1; a head lock blocks glasses / hats | A4, 2 of 2 (`research/templates.md`) |
| Hairstyle | Klein 9B edit | SAM3 "face" lock on FRONT + PORTRAIT only | b8 |
| Condition | Klein 9B edit, free | `Make the character look <words>.` + L1 | b5, 6 of 6 |
| Age 13+ | Klein 9B edit, free | b15 neutral exact-age template + L1 | b11-b15, 3 of 3 |
| Age 12 and under | Klein age edit, then the `flowCharacterSheetImages` QWEN graph on the edit's right half | child-size words + a describer clothes caption | b17 (Klein arm fails b18; Klein stepwise weak on photoreal b19) |
| Body shape | Qwen-Image 2.1 edit, exact size | `qba.py` wording + L1 | b9, 3 of 3 |

Templates come VERBATIM from the bench scripts that passed (`research/bench-tools/`: `q23_state_body_age.py`,
`qhair.py`, `qage.py` SET v3, `qba.py`, `qrebuild.py`). After every leg, the existing `flowCharacterSheetHeadless` leg
runs when "Headless front body" is on (Fabio: the front face is usually removed; a free edit regrows a head, b7).

**Decisions (Fabio 2026-10-10):** all six changes in v1; Age = a slider (0 Off, 1-100 years; see above); 12 and under rebuild, 13+ edit
alone; child ages always DRESSED - under 18 the sheet must read dressed (describer) or the run refuses "Dress the
sheet first: pick Clothes"; Body shape and the child rebuild make NON-COMMERCIAL pictures (Qwen 2.1) - said in the
description, as Character Sheet from Images does; "we will do what's needed" on engine work.

**Assumed (agent picks, Fabio can overturn at the go):** (1) ONE change per run - a "What to change" select + one
words box, plus the age slider; more changes = run again on the result. (2) Qwen-Image 2.1 is an OPTIONAL model:
without it the Klein changes run, Body shape / age 12 and under show "needs Qwen-Image 2.1 - Install". (3) v1 is
local Klein 9B only, no cloud arm. (4) Age direction (younger / older) comes from a describer "how old does the
person look?" answer. (5) The swimwear-on-a-child-sheet gap (the gate cannot see the picture) closes with a
describer "does the person look under 18?" ask that runs ONLY when the words carry a swimwear / underwear / nude term.

**Engine facts that shape the work:** a Flow runs at most 2 legs and `chain.when` is a `=== true` toggle; nothing
routes the op by a field; every model slot is required; describe refuses only on describer failure; leg 2 gets
the WRONG graph when two model slots exist (`flowService.js:288` sends all slot ids). No shipped Klein graph builds
its own SAM3 lock (`klein_9b_t2i.json` is generated - never edit it).

**Peer claims (check `state/index.json` before each phase):** MPI-1056 (session e74cfbb0) holds
`js/services/flowEnhance.js`, `js/services/generationService.js`, `js/services/llmService.js`,
`js/data/childSafety.js` and its tests - Phase C waits for its commit + release. MPI-1036 (d958e01b) holds
`docs/agent/flows.md`, `docs/releases/UNRELEASED.md`, `services/agentBench.mjs` - Phase D messages it or waits.

## Completed

- [x] Bench batches 1-19 (validation.md); field route above; Klein rebuild and Klein stepwise benched and parked.

## Remaining Work

## Parallel Batch A: engine + graphs + template pins

Disjoint files; A2-A4 share the GPU through `gpu_lease` (they queue, they never run two jobs at once). Hand every
GPU worker the LITERAL wrapped command: `python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 --
"C:/Program Files/Git/bin/bash.exe" <runner.sh>` (memory: a worker told "run under the lease" once never leased).

- [x] A1 Engine (DONE 2026-10-10, npm test 2938/2940 + 2 stale source pins updated in routine-runner / flow-frame tests): multi-leg, routed, optional-model Flows. In `flowsRegistry.js` (helpers only, no FlowDef): FlowDef
  `operationBy: { field, map }` + `flowOperation(flow, run)` / `flowOperations(flow)`; `chain` accepts an ARRAY of
  legs run in order, each `{ operation, when, input, box, params }` (old single object still works), each leg fed
  the previous leg's picture, a skipped leg passes it through; slots accept `{ ..., optional: true, for: [ops] }`;
  `flowModelIds(flow, { op })` null-fills slots that do not serve the op (fixes the leg-2 wrong-graph trap);
  `flowAvailability` ignores optional slots; new `flowRunAvailability(flow, run)` checks the routed op + every
  wanted leg. In `js/utils/declaredFields.js`: one `ruleHolds(rule, values)` with `is | isNot | in | atMost | below |
  atLeast` (array = all) used by `hiddenWhen`, `disabledWhen`, describe `when` and `chain.when`; `flowControlFieldIds
  (flow)` replaces the three hand exemption lists. In `flowService.js`: routed op at :255, per-op model ids at :288,
  per-leg availability at :198, the leg runner (`chainLegInputs` with `box` as fractions of
  `result.item.pixelDimensions`, `params`, and a run-only `runDescribed` so leg 1's describe answers reach later
  legs). `agentDispatch.js` / `routineDispatch.js`: `flowRunAvailability` after fields resolve; catalog marks optional
  slots. `MpiBaseFlow.js`: the hand-run leg driver (`submitChainLeg`) runs N legs; `promptRequired` reads the routed
  op; the result-pane toggle stays for string-form `when` only. Ownership: `js/data/flowsRegistry.js` (engine
  helpers, NOT the FLOWS list), `js/utils/declaredFields.js`, `js/services/flowService.js`, `js/shell/agentDispatch.js`,
  `js/shell/routineDispatch.js`, `services/userFlows.js` (`FLOW_KEYS` + the :219 exemption), `js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js` (leg driver +
  promptRequired only), `tests/flow-chain.test.cjs`, `tests/flow-model-choice.test.cjs`,
  `tests/inject-params-titles.test.cjs` (exemption helper only), new `tests/flow-legs.test.cjs`. Briefings:
  `/mpi-brief-rule` for the flows / state / events rules (`.claude/rules/README.md`) + the Critical Rules Snapshot +
  root-cause § Sub-Agent Briefing. **Verify:** `npm test` green; `tests/flow-legs.test.cjs` proves: op routed by a
  select value; a 3-leg chain with a numeric `atMost` rule runs legs 1+3 and skips 2; leg 2 of a two-slot Flow gets
  the Qwen graph; a missing optional model blocks only the ops it serves; every shipped Flow still resolves the same
  op / graph / availability as before (snapshot of all FLOWS ids).
- [x] A2 (DONE 2026-10-10, `research/graph-klein.md`: 60-node API graph; lazy proof - SAM3 runs only at lock 1 (3 panels) / lock 2 (front + portrait); 16 bench cases PASS by eye at 1792x1120; lock 1 vocabulary is now "head, hair, face" (photo portrait face 5% -> 100% locked, clothes re-run face diff 0.0); `MpiClearVram` is an OUTPUT node and forced the lazy branch - removed) Klein edit graph `flow_character_sheet_edit` (Klein 9B, no NSFW LoRA): pruned from the `klein_9b_t2i`
  edit path, exact size (`MpiMath "a*b/1048576"` into the scale, loader w/h into the crop target), an in-graph
  SAM3 lock chosen by `Input_Lock` (0 off | 1 "head, hair" on all three panels | 2 "face" on front + portrait),
  panels from `MpiMath` on the width as `flow_character_sheet_headless.json` does, lazy so SAM3 runs only when
  locked. Titles: `Input_Image`, `Input_Positive` (the whole prompt - the builder writes it), `Input_Seed`,
  `Input_Lock`, `Output_Image`. Authored as `raw/flow_character_sheet_edit.json` by a Python builder, synced with
  `COMFY_URL=...48188 node sync-raw-workflows.mjs`. Ownership: `comfy_workflows/raw/flow_character_sheet_edit.json`,
  `comfy_workflows/flow_character_sheet_edit.json`, `research/bench-tools/build_edit_graph.py`,
  `research/bench-tools/run_graph_klein.sh`, `research/graph-klein.md`. Briefings: workflow-authoring
  (`docs/workflow-authoring/README.md`) + the Snapshot. **Verify:** through `run_api.py` under the lease, on the photo
  + fisher sheets at seed 42: clothes lock (b4 outfit), hair lock (b8 bob), condition free (b5 beaten), age 10 + 30
  (b15 v3) - each matches its batch verdict by eye, `layout.py` heads within 16 px, output = the input size.
- [x] A3 (DONE 2026-10-10, `research/graph-qwen.md`: 14-node API graph, b9 heavyset / muscular / skinny PASS, mean pixel diff to b9 0.46-0.75 of 255, ~108 s an edit, output = input size via a trailing `ImageScale` - an odd 1770x1100 input returns 1770x1100; `Input_Image` has `block_if_empty` ON; output RGB) Qwen edit graph `flow_character_sheet_edit_qwen` (Qwen-Image 2.1): pruned from `qwen_image_2_1.json`'s
  edit path, node 30 `resolution` 0 baked (exact size), W/H to /32. Titles: `Input_Image`, `Input_Positive`,
  `Input_Seed`, `Output_Image`. Ownership: `comfy_workflows/raw/flow_character_sheet_edit_qwen.json`,
  `comfy_workflows/flow_character_sheet_edit_qwen.json`, `research/bench-tools/run_graph_qwen.sh`,
  `research/graph-qwen.md`. Briefings: as A2. **Verify:** b9's three body cases (heavyset photo; muscular + skinny on
  the nude sheet, outputs to `mpi1041_qba/` only) pass on all three panels, `width.py` sign right, exact size.
- [x] A4 (DONE 2026-10-10, strings in `research/templates.md`: teen15b + older70 + free-edit Accessories pinned 2 of 2; the age ask reads old faces HIGH - direction only, never trust a read of 70+; DRESSED ask 24/24; the `Wearing ...` caption is clean; the gate takes `{ modelId, nsfw }`, no `source`) Pin the untested templates on the bench graph (`klein9b_edit_api.json`), clothed sheets only, ~5-edit runs:
  a teen (15) clause, the OLDER neutral template (70 on the photo), Accessories wording ("Give the character a red
  scarf and round glasses" + clothes lock), and the describer asks on the app's default describer
  (`qwen3vl_4b_abliterated` via ComfyUI): apparent age within +/-8 years on the 5 sheets, DRESSED / NOT DRESSED right
  on clothed + nude sheets, a clothing-only caption with no person words. Ownership:
  `research/bench-tools/qtemplates.py`, `research/bench-tools/run_qtemplates.sh`, `research/templates.md`.
  Briefings: the Snapshot + `docs/child-safety.md`. **Verify:** each template / ask passes on 2 sheets or is written
  up as failed with the next wording; results table in `research/templates.md`.

**A1 hand-on (2026-10-10):** API = `ruleHolds`, `flowControlFieldIds`, `flowLegs`, `flowToggleLeg`, `flowOperation`,
`flowOperations`, `flowRunLegs`, `flowModelIds/flowModelParams(flow, { op })`, `flowRunAvailability` in `flowsRegistry.js`
(re-exported by `declaredFields.js`); `legInjection` / `submitChainLeg(..., index)` in `flowService.js`. Skip leg 1 =
a `null` map entry; a slot with no `for` serves every op no other slot's `for` claims; no wanted leg = hand warn /
agent `NOTHING_TO_DO`. Folded into B/C/D: every op in `flowOperations` must declare `flow.operation`'s media slots
(agentDispatch / routineDispatch / routineModel / MpiBaseFlow read media from `flow.operation` alone - add a test);
`smoke-workflows.mjs resolveFlowSmokeSet` + the inject-params-titles sweep cover only `flow.operation` - add routed /
leg ops; `services/agentLoop.mjs:570-576` (MPI-1053's) drops the catalog's `optional` key; Phase C adopts `ruleHolds`
in `flowEnhance.js _describeRuleHolds` (keep its `{ media }` branch); Phase D: `MpiFlowLibrary` `_fitsMyGpu` (323)
counts the optional slot, "Required models" (793) lists it, `_installProgress`/`_cancelInstall` iterate
`flowInstallKeys` incl. it (bar never reaches 100%), `_installMissing` cannot install it; docs
`01-descriptor-and-ops.md` ~361 (single-object chain) + `any-of-models.md` (`optional`/`for`).

## Phase B: the Flow itself (after A; touches the FLOWS list and the four op registries)

- [x] (DONE 2026-10-10: FlowDef `character-sheet-editor`; ops in the 4 files + `ENHANCE_EXEMPT_OPS`; builder `js/data/flowPrompts/characterSheetEditor.js` behind `flowService` `PROMPT_BUILDERS` (built in `start()`, after describe, before enqueue) + `flowRunRefusal` (hand toast / agent `BAD_REQUEST`); legs tag their part with `prompt: 'age' | 'rebuild'`; describe answers land in NON-graph keys `sheetAge` / `sheetClothes`; every leg carries `runPrompt` = the whole run's prompts so the per-job gate refuses "Clothes: a bikini + Age 10" on LEG 1; `promptBuilder` added to `FLOW_KEYS`; interim tile `display/flow-character-sheet-editor.webp` = A4's accF close-up (Phase D replaces it); tests `character-sheet-editor.test.cjs` 12/12 + inject-params-titles + agent-flow-handover `runs`. Describe `when` is `Input_Age isNot 0` until Phase C adopts `ruleHolds`) Ops `flowCharacterSheetEdit` (Klein) and `flowCharacterSheetEditQwen` in the 4 files (`commandRegistry.js` with
  `ENHANCE_EXEMPT_OPS`, `universal_workflows.js`, `operationRegistry.js`, `operation_registry.json`); prompt builder
  `js/data/flowPrompts/characterSheetEditor.js` (pure ESM: `buildEditPrompt({ change, words, age, apparentAge })`,
  `buildRebuildPrompt({ age, caption })`, templates from Current State + A4) behind a named-builder registry so the
  FlowDef stays data (`promptBuilder: 'characterSheetEditor'`, called in `submitFlowGeneration` after describe;
  writes `positive`, so the gate reads the age in words); the FlowDef: `type: 'edit'`, verb-first description with
  the non-commercial sentence, sheet image required, fields `change` (select incl. "Nothing else"), `words` (text,
  hidden for "Nothing else"), `Input_Age` (slider 0-100, 0 = Off, on every run - Fabio 2026-10-10; the age reaches
  the gate as WORDS in `positive`, never as the number), `Input_Remove_Head` (toggle, default on), `operationBy` on
  `change`, `requiredModels: ['klein-9b', { label, models: ['qwen-image-2-1'], optional: true, for: [Qwen op,
  'flowCharacterSheetImages'] }]`, legs [routed edit, skipped for "Nothing else"] -> [Klein age edit when `Input_Age
  atLeast 1`] -> [`flowCharacterSheetImages` when `Input_Age` in 1-12, `box` right half, `params { Input_Face_Pose:
  'TURNED' }`] -> [`flowCharacterSheetHeadless` when
  `Input_Remove_Head`], describe asks (apparent age, clothes caption). **Verify:** `npm test` green, plus new
  `tests/character-sheet-editor.test.cjs`: every change kind builds the bench template; child (2-12), teen (13-17)
  and adult (18-90) prompts are `ok` under `checkChildSafety` for both model ids with source
  `character-sheet-editor`; rebuild + an ordinary caption `ok`, + "no clothing" / swimsuit / bra / culottes refuse;
  16-17 swimwear asserts the gate rule IN FORCE at build time (MPI-1056 changed it 2026-10-10: an ordinary bikini fine, revealing swimwear never - read `docs/child-safety.md` then); the builder's output key survives `configTexts`. Also an inject-params-titles
  case for both graphs, an `agent-flow-handover` `runs` entry, the smoke-flows set.

## Phase C: refusals + card name (unblocked 2026-10-10: MPI-1056 committed and closed)

- [x] (DONE 2026-10-10, session 89967af0: a describe entry with NO `to` is a CHECK `{ media, when, ask, refuseUnless, code,
  message }`, asked before every target, refusing unless the WHOLE answer (letters only, `<think>` stripped) equals
  `refuseUnless`; `_describeRuleHolds` = `{ media }` + `ruleHolds`; flowService feeds describe `flowRunValues(flow, run)` + injectionParams (rules read `change` / `words`, which
  are not graph params) and reports `d.code || 'DESCRIBE_FAILED'`. FlowDef: two checks, both skipped when Clothes is the change, code
  `CHILD_SAFETY`: `Input_Age` 1-15 DRESSED (A4 wording + "Swimwear or underwear is NOT DRESSED."); 16-17 "nude or
  topless, in underwear or lingerie, or in revealing swimwear?" refuse unless NO (the gate's 16-17 rule, CP Gate 1); `sheetAge` atLeast 1;
  `sheetClothes` 1-12 and not Clothes. NO perceived-age check: see Plan Drift (Fabio: CP Gate 1's job). Card name: builder `cardName(values, sourceName)` -> `opts.cardName` (first call only) -> gallery card
  `customName`; `flowService.sourceCardName` finds the card by its file's basename in any history version. Docs:
  `docs/child-safety.md` § Where it runs + one known gap. Tests: `character-sheet-editor.test.cjs` 17/17 incl. a real
  hand / routine / agent run each) Describe refusal entries in `flowEnhance.js` (`{ ask, when, refuseUnless, code, message }`, keyed apart from
  `to`) + `flowService` reporting `d.code`: under 18 and not DRESSED -> "Dress the sheet first: pick Clothes"; Clothes
  / Accessories words with a swimwear / underwear / nude term (a predicate EXPORTED from `childSafety.js`, never a
  copied list) + "looks under 18" -> refuse. `generationService.js`: `opts.cardName` -> `customName`, the Flow names
  the card `<input card name> - <change words>`. **Verify:** unit tests for both refusals (hand, agent and routine
  paths get the same code + message) and the card name; `npm test` green.

## Phase D: UI + docs

- [ ] `MpiBaseFlow.js` live "needs Qwen-Image 2.1 - Install" row for an optional slot (ComponentFactory, BEM,
  `downloadService.start` so the licence gate fires); `MpiFlowLibrary.js` "Optional models" list; `flowLicences.js`
  shows the optional Qwen licence. Recipe `docs/playbooks/add-flow/existing-flows/character-sheet-editor.md`;
  `docs/flows.md` / add-flow playbook lines for legs, `operationBy`, optional slots; MPI-1036's `docs/agent/flows.md`
  paragraph (which sheet Flow to use) + `UNRELEASED.md` entry by `mpi-message` or after its release; preview art via
  `/mpi-flow-graphics` (Fabio picks). **LoRA cogwheel** (Fabio via MPI-1036's message `2ea083d1-mpi1036-to-mpi1041`,
  2026-10-10: "most Flows" get the user LoRA rack): `loras: true` on both `requiredModels` slots; an
  `Input_Lora_Phase1_1..6` `MpiLoraModel` chain between the UNETLoader and its first model consumer in
  `raw/flow_character_sheet_edit.json` and Phase2 in `raw/flow_character_sheet_edit_qwen.json` (a two-slot Flow takes
  Phase2 for its second slot, `docs/playbooks/add-flow/ui/lora-rack.md`); convert single-file (never
  `sync-raw-workflows.mjs` - it commits); a `RACKS` row per graph in `tests/flow-lora-rack.test.cjs`. Then resolve the
  message. **Verify:** `npm run lint` + `lint:components` clean, `flow-licence-surface` +
  `flow-field-constraints` + `flow-lora-rack` green, docs under 200 lines.

## Phase E: end to end (user-ux)

- [ ] In `npm run app:isolated` (never :3000): every change kind on the photo + fisher sheets; age 10 / 15 / 30 / 70;
  Body shape heavyset; without Qwen installed (Klein changes run, the two Qwen paths show Install); the nude sheet +
  age 10 refuses; Clothes "a swimsuit" on the age-10 result refuses; an agent run and an MCP run of one change; the
  result card reads "<input card> - <change>". Bench the two Phase C checks on the default describer first (DRESSED
  with its swimwear/underwear line: clothed sheets DRESSED, nude + a swimsuit sheet NOT DRESSED; the 16-17 ask: clothed
  and ordinary-bikini sheets NO, nude / lingerie sheets YES). Then
  Fabio's eye test on his own sheets. **Verify:** each case's card checked by eye and logged in `validation.md`;
  Fabio's "1".

## Plan Drift

- 2026-10-10 (session 89967af0, Phase C): the planned "looks under 18" describer check was built, then REMOVED on
  Fabio's word: perception, not age, is the issue (a 24-year-old who looks 16 would be blocked; nobody can tell 15 from
  17). CP Gate 1 (2026-10-10): no picture's age is judged anywhere, by Fabio's call - leave it (it put a scorer to Fabio
  as his product call). It also split the DRESSED check to the gate's current rule: 1-15 DRESSED, 16-17 nothing nude,
  underwear or revealing (an ordinary bikini passes). The DRESSED check is skipped when Clothes is the change (the clothes leg dresses the sheet before the age leg);
  the half-dressed-in-innocent-words hole that leaves is a documented gap in `docs/child-safety.md`. The DRESSED ask
  gained one sentence (swimwear / underwear = NOT DRESSED): A4 never tried those sheets.

- 2026-10-10 (session 08593195, A2/A3): Klein lock 1 vocabulary "head, hair" -> "head, hair, face" (the photo portrait face was 5% locked). The Qwen graph returns the INPUT size (a trailing `ImageScale`), not the nearest /32. A3 once ran one bench edit outside the lease (a hand-run runner slice); runners now take a slice argument so slices go through the wrapper.
- 2026-10-10 (session 08593195, A4): Accessories moved to the FREE edit (the head/hair lock blocks glasses; SAM3 "head, hair" on the photo portrait marks the hair only, so a Clothes lock leaves that face unlocked - A2 to confirm in-graph). The gate has no `source` context, so Phase B's "with source `character-sheet-editor`" is moot: test by model id only. The age ask stays only for younger / older direction (+12 on the fisher; the 70 edits read 80-85).
- 2026-10-10 (session 16d04a9a): the bench plan was replaced by this Flow plan. Klein rebuild (b18) and Fabio's
  stepwise portrait-then-bodies shape (b19) were benched before it: heavyset + a stylised child pass on Klein, but
  the portrait edit is unstable for muscular / skinny and a photoreal child reads ~13, so Qwen stays for Body shape
  and the child rebuild. Commercial-safe Klein routes for both are a follow-up, not v1.
- 2026-10-10 (session 98aec79c): Age is a Klein field by exact-age wording (b11-15); a child's body (12 and under)
  is a from-images rebuild (b17). Child ages are wanted (films), always dressed; MPI-1056 checks every prompt.
- 2026-10-09: Fabio - the Flow may use 2-3 editors, each field routed to the model that passes it; a
  non-commercial model in the chain is acceptable (memory `project_flows_chain_best_model_per_job`).

## Verification

**Verify mode:** user-ux (Phase E only; Batch A and Phases B-D are `auto`).

Done when: every Phase E case is logged in `validation.md` with its card, `npm test` and lint are green on the final
commit, CI on master is green, and Fabio has looked at the Flow in the app and said "1".

## Preservation Notes

- `docs/flows.md` + the add-flow playbook must describe legs, `operationBy`, `ruleHolds` and optional slots
  (`.claude/rules/` doc-drift question at close-out: component wiring changes).
- Memory candidates: "an edit keeps the figure's size - a different body size needs the bodies redrawn" (b16, b19);
  "Klein's portrait edit reads every word literally: a garment named lands in the frame, 'beard' adds one" (b19).
- Bench outputs stay on G: (`mpi1041_age/`, `mpi1041_qba/` nude) - never the repo.
