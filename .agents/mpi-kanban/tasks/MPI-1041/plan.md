# MPI-1041 - Character Sheet Editor Flow

## Current State

**2026-10-10 (session 16d04a9a) - bench DONE (validation.md batches 1-19), Flow plan written. NEXT: Fabio's go,
then `mpi-continue` -> Parallel Batch A.** Project mode: scalable-foundation. Research behind every line below, with
file:line: `research/flow-plan-research.md`.

**What it is:** a Flow that changes ONE thing on a finished 3-panel sheet (front | back | 3/4 portrait) by words,
all panels consistent, result as a NEW card ("John - beaten up"); the input sheet stays a live asset.

**Per-field route (bench verdicts):**

| change | editor | how | evidence |
|---|---|---|---|
| Clothes | Klein 9B edit, exact size | L1 wording + per-panel SAM3 "head, hair" lock | b3-b4, 6 of 6 |
| Accessories | Klein 9B edit | as Clothes, "Give the character ..." wording | b4 (wording to pin, A4) |
| Hairstyle | Klein 9B edit | SAM3 "face" lock on FRONT + PORTRAIT only | b8 |
| Condition | Klein 9B edit, free | `Make the character look <words>.` + L1 | b5, 6 of 6 |
| Age 13+ | Klein 9B edit, free | b15 neutral exact-age template + L1 | b11-b15, 3 of 3 |
| Age 12 and under | Klein age edit, then the `flowCharacterSheetImages` QWEN graph on the edit's right half | child-size words + a describer clothes caption | b17 (Klein arm fails b18; Klein stepwise weak on photoreal b19) |
| Body shape | Qwen-Image 2.1 edit, exact size | `qba.py` wording + L1 | b9, 3 of 3 |

Templates come VERBATIM from the bench scripts that passed (`research/bench-tools/`: `q23_state_body_age.py`,
`qhair.py`, `qage.py` SET v3, `qba.py`, `qrebuild.py`). After every leg, the existing `flowCharacterSheetHeadless` leg
runs when "Headless front body" is on (Fabio: the front face is usually removed; a free edit regrows a head, b7).

**Decisions (Fabio 2026-10-10):** all six changes in v1; Age = a number box (1-100); 12 and under rebuild, 13+ edit
alone; child ages always DRESSED - under 18 the sheet must read dressed (describer) or the run refuses "Dress the
sheet first: pick Clothes"; Body shape and the child rebuild make NON-COMMERCIAL pictures (Qwen 2.1) - said in the
description, as Character Sheet from Images does; "we will do what's needed" on engine work.

**Assumed (agent picks, Fabio can overturn at the go):** (1) ONE change per run - a "What to change" select + one
words box (or the age number); more changes = run again on the result. (2) Qwen-Image 2.1 is an OPTIONAL model:
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

- [ ] A1 Engine: multi-leg, routed, optional-model Flows. In `flowsRegistry.js` (helpers only, no FlowDef): FlowDef
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
- [ ] A2 Klein edit graph `flow_character_sheet_edit` (Klein 9B, no NSFW LoRA): pruned from the `klein_9b_t2i`
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
- [ ] A3 Qwen edit graph `flow_character_sheet_edit_qwen` (Qwen-Image 2.1): pruned from `qwen_image_2_1.json`'s
  edit path, node 30 `resolution` 0 baked (exact size), W/H to /32. Titles: `Input_Image`, `Input_Positive`,
  `Input_Seed`, `Output_Image`. Ownership: `comfy_workflows/raw/flow_character_sheet_edit_qwen.json`,
  `comfy_workflows/flow_character_sheet_edit_qwen.json`, `research/bench-tools/run_graph_qwen.sh`,
  `research/graph-qwen.md`. Briefings: as A2. **Verify:** b9's three body cases (heavyset photo; muscular + skinny on
  the nude sheet, outputs to `mpi1041_qba/` only) pass on all three panels, `width.py` sign right, exact size.
- [ ] A4 Pin the untested templates on the bench graph (`klein9b_edit_api.json`), clothed sheets only, ~5-edit runs:
  a teen (15) clause, the OLDER neutral template (70 on the photo), Accessories wording ("Give the character a red
  scarf and round glasses" + clothes lock), and the describer asks on the app's default describer
  (`qwen3vl_4b_abliterated` via ComfyUI): apparent age within +/-8 years on the 5 sheets, DRESSED / NOT DRESSED right
  on clothed + nude sheets, a clothing-only caption with no person words. Ownership:
  `research/bench-tools/qtemplates.py`, `research/bench-tools/run_qtemplates.sh`, `research/templates.md`.
  Briefings: the Snapshot + `docs/child-safety.md`. **Verify:** each template / ask passes on 2 sheets or is written
  up as failed with the next wording; results table in `research/templates.md`.

## Phase B: the Flow itself (after A; touches the FLOWS list and the four op registries)

- [ ] Ops `flowCharacterSheetEdit` (Klein) and `flowCharacterSheetEditQwen` in the 4 files (`commandRegistry.js` with
  `ENHANCE_EXEMPT_OPS`, `universal_workflows.js`, `operationRegistry.js`, `operation_registry.json`); prompt builder
  `js/data/flowPrompts/characterSheetEditor.js` (pure ESM: `buildEditPrompt({ change, words, age, apparentAge })`,
  `buildRebuildPrompt({ age, caption })`, templates from Current State + A4) behind a named-builder registry so the
  FlowDef stays data (`promptBuilder: 'characterSheetEditor'`, called in `submitFlowGeneration` after describe;
  writes `positive`, so the gate reads the age in words); the FlowDef: `type: 'edit'`, verb-first description with
  the non-commercial sentence, sheet image required, fields `change` (select), `words` (text, hidden for Age),
  `Input_Age` (number 1-100, shown for Age), `Input_Remove_Head` (toggle, default on), `operationBy` on `change`,
  `requiredModels: ['klein-9b', { label, models: ['qwen-image-2-1'], optional: true, for: [Qwen op,
  'flowCharacterSheetImages'] }]`, legs [routed edit] -> [`flowCharacterSheetImages` when `Input_Age atMost 12`,
  `box` right half, `params { Input_Face_Pose: 'TURNED' }`] -> [`flowCharacterSheetHeadless` when
  `Input_Remove_Head`], describe asks (apparent age, clothes caption). **Verify:** `npm test` green, plus new
  `tests/character-sheet-editor.test.cjs`: every change kind builds the bench template; child (2-12), teen (13-17)
  and adult (18-90) prompts are `ok` under `checkChildSafety` for both model ids with source
  `character-sheet-editor`; rebuild + an ordinary caption `ok`, + "no clothing" / swimsuit / bra / culottes refuse;
  16-17 swimwear asserts the gate rule IN FORCE at build time (MPI-1056 changed it 2026-10-10: an ordinary bikini fine, revealing swimwear never - read `docs/child-safety.md` then); the builder's output key survives `configTexts`. Also an inject-params-titles
  case for both graphs, an `agent-flow-handover` `runs` entry, the smoke-flows set.

## Phase C: refusals + card name (BLOCKED on MPI-1056 committing and releasing its claim)

- [ ] Describe refusal entries in `flowEnhance.js` (`{ ask, when, refuseUnless, code, message }`, keyed apart from
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
  `/mpi-flow-graphics` (Fabio picks). **Verify:** `npm run lint` + `lint:components` clean, `flow-licence-surface` +
  `flow-field-constraints` green, docs under 200 lines.

## Phase E: end to end (user-ux)

- [ ] In `npm run app:isolated` (never :3000): every change kind on the photo + fisher sheets; age 10 / 15 / 30 / 70;
  Body shape heavyset; without Qwen installed (Klein changes run, the two Qwen paths show Install); the nude sheet +
  age 10 refuses; Clothes "a swimsuit" on the age-10 result refuses; an agent run and an MCP run of one change. Then
  Fabio's eye test on his own sheets. **Verify:** each case's card checked by eye and logged in `validation.md`;
  Fabio's "1".

## Plan Drift

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
