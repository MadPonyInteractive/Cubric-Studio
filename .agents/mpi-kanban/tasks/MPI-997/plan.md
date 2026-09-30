# MPI-997 Plan - Character Sheet splits into two workflows

Umbrella: MPI-1000 (phase 3). Brief: `brief.md` (Fabio's shape, his words).

## Shape

- Workflow A `flow_character_sheet.json`: the sheet only (today's graph minus the head branch).
- Workflow B `flow_character_sheet_headless.json`, op `flowCharacterSheetHeadless`: NO model.
  `Input_Image` (path loader) -> image size -> today's head branch (SAM3 on the left quarter, sampled
  backdrop fill) -> `Output_Image`. Op only, no FlowDef: no hidden-flow flag exists, and a
  Library tile for it would be a Flow nobody asked for.
- The chain already exists (`FlowDef.chain`, MPI-623, unused by any live Flow): it gains
  `when` (a field id; off = leg 1 only) and `input` (the leg-2 media role that receives leg 1's
  output). A leg fed leg 1's picture lands as the NEXT VERSION of leg 1's card (`runLanding`
  `existingGroup`, MPI-970's hook), so the original sheet is one step back in the card's history.
  Character Sheet declares `chain: { operation: 'flowCharacterSheetHeadless', when: 'Input_Remove_Head', input: 'image1' }`.
- The agent path is free: `agentDispatch._submitFlow` calls the same `submitFlowGeneration`,
  and the chain reports ONE completion (leg 2). One `generate` call stays enough.
- The result-pane button (press = run B on the shown sheet, press again = back to the original):
  shape goes to Fabio first (look-and-feel call), built after.

## Steps

1. Raw graphs: split `comfy_workflows/raw/flow_character_sheet.json` into A and B (LiteGraph, by
   script). Sync with `scripts/sync-raw-workflows.mjs` against the G:\ComfyUi bench on port 8189
   (`COMFY_URL`), never 8188 (Fabio's app engine port). Prove B on a real sheet there.
2. flowService chain: `when` + `input` + version landing + leg-2 tempId on the landing (preview
   and Stop in the pane). Tests in `tests/flow-chain.test.cjs`.
3. FlowDef `chain` on Character Sheet; typedef; `Input_Remove_Head` joins the
   consumed-elsewhere allow-list in `tests/inject-params-titles.test.cjs`.
4. Op in 4 files (commandRegistry, universal_workflows, operationRegistry, operation_registry.json).
   commandRegistry/operationRegistry/operation_registry.json are claimed by a live peer (74f93ae5,
   DeepInfra Wan) at pickup: message, wait for release.
5. Graph pins: `tests/flow-model-choice.test.cjs` head-branch pins move to B; inject titles case for B.
6. Result-pane button, after Fabio's call.
7. Docs: `existing-flows/character-sheet.md`, `01-descriptor-and-ops.md` + `docs/flow-packages.md`
   (chain keys), `docs/agent/flows.md` only if Cosmo needs it, UNRELEASED.

## Current State (2026-09-30, session 9c1e6f07)

Mirrored sheet FIXED by prompt (route 1): one clause in all four `Recipe_*` texts, right after
"unbroken frame": ", the two full-body views on the left and the portrait on the right". Bench
evidence in validation.md § Mirrored sheet. No flip built. Fabio saw a fixed sheet in the app
("looking good"). Then leg 2 gained `#901 MpiClearVram` before Output_Image (SAM3 was never
released). All uncommitted. Left: Fabio's look at the toggle, then commit + CI + close.

## Resolved: a MIRRORED sheet (Fabio's look, 2026-09-30)

Fabio's first live run (Anime, Turbo, 1K) came out mirrored: portrait LEFT, then front, then back
(`My Agent Tests/Media/flowCharacterSheet_004.png`, leg 1, before any head removal). Leg 2 then cut the
PORTRAIT's face, because it only ever looks at the far-left quarter. Not from the split: the sheet
graph's remaining nodes are byte-identical to HEAD's, the recipes are untouched since `dbc6a74c6`
(MPI-714), and the phrase that ran has no layout words. Fabio: "never happened before, turbo or not".
**His direction:** (1) adjust the sheet prompt (the `Recipe_*` templates, #666-669) so the layout holds;
(2) only if that fails, detect the big face on the left and FLIP. Caution for (2): this sheet was
[portrait | front | back], and a flip gives [back | front | portrait], so a flip alone does not put the
front body in quarter 1; a true mirror [portrait | back | front] does. Measure before choosing.
Try (1) at Turbo on the Anime recipe first (the failing case), a few seeds, looking at each.

## Verification

**Verify mode:** user-ux

- `node --test` the touched tests; `npm test` green apart from known reds.
- Bench: B on a real sheet removes the front-body head, nothing else changes.
- Isolated app (tell Fabio: queues on his local GPU): Character Sheet with Headless on -> one card,
  two versions (sheet, headless); off -> one version. Agent: "make me a character sheet of ..."
  -> one generate call, card with both versions.
- Fabio's look at the result-pane button.
