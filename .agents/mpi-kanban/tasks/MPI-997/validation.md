# MPI-997 Validation

## Built (2026-09-30, session 123a6c39)

- Graphs: `comfy_workflows/raw/flow_character_sheet.json` split by script into A (sheet only) and
  `raw/flow_character_sheet_headless.json` (B: `MpiLoadImage` `Input_Image` #900, its width/height
  replacing the Get_W/Get_H plumbing, then the head branch with node ids and widgets verbatim).
  Converted with `scripts/workflow-to-api.mjs` against the G:\ComfyUi bench on port 8189 (the sync
  script's git steps skipped: it commits raw and stages into the shared index).
  `validate-injection-rules.mjs`: both conform.
- API check against HEAD: every B node's widgets identical to the old branch; A lost exactly the 16
  branch nodes and changed only `#882 Output_Image` (now reads the sheet `#730`).
- Bench run of B on a real sheet with its head (`cowboys/flowCharacterSheet_007.png`, copied into the
  bench's input/, removed after): 6.3 s incl. SAM3 load; front-body face gone, back view and
  portrait untouched. Carried-over quirk: SAM3 "face" also took the round cloak brooch.
- `js/services/flowService.js`: `chain.when` (off = leg 1 only, field default when the run carries
  none), `chainLegInputs` (leg 1's picture on `chain.input`, leg 2 lands as the card's next version
  through `runLanding.existingGroup`), `tempId` on a version landing.
- FlowDef `chain` on Character Sheet + typedef; `universal_workflows.js` maps the new op.

## Evidence

- `node --test` flow-chain, routine-runner, inject-params-titles, flow-model-choice, flow-frame,
  flow-result-compare, smoke-flows, agent-flow-handover, connector-flow-dispatch, flow-lora-rack,
  flow-enhance: 180 pass, 0 fail.
- Mutations on flowService, each caught by `tests/flow-chain.test.cjs`: `when` ignored; no version
  landing; leg-2 media on the wrong role.

- Op `flowCharacterSheetHeadless` in all 4 files (Agent 77 released its claim; its MPI-923 hunks in
  the same files stay uncommitted and are NOT part of this card's commit). `filePrefix:
  'flowCharacterSheet'`: the key alone was cut to 24 chars on disk (`flowCharacterSheetHeadle_002.png`).
- Result-pane chain toggle (`_mountChainToggle`, bottom-left, the `when` field's own icon + label),
  built on my pick while Fabio's call on its shape is open. `_run`'s callbacks and post-submit
  bookkeeping extracted into `_runCallbacks` / `_track` so the toggle's leg-2 run reports like Generate.
- `services/userFlows.js`: a package's chain `when` field is not required to name a node.

## Live (2026-09-30, isolated instance, Fabio's local engine, GPU lease held)

1. ONE connector `generate` (the agent/MCP door), Character Sheet, Headless on, Turbo, into the CLOSED
   project My Agent Tests. First try: leg 1 landed, leg 2 ran but was DROPPED ("groupHistory completion
   ignored because group no longer exists") and the call answered CANCELLED. Root cause: a closed
   origin is versioned off the frozen copy the run was dispatched with, and leg 1's copy predates leg
   1's card. Fixed in `chainLegInputs` (leg 2's origin = leg 1's plus the card leg 1 registered, the
   routine runner's re-read for one card); test added.
2. Rerun: HTTP 200 in 57 s, `ok: true`, card "MPI-997 chain test" with 2 versions
   [flowCharacterSheet, flowCharacterSheetHeadless], selectedIndex 1, reply = the headless item
   (leg 2: 4.5 s). Both images looked at: v1 the untouched sheet, v2 only the front head filled.
3. The toggle on a ONE-version sheet (card 708c36a0, left by try 1), in a real Electron window:
   press -> 5 s -> 2 versions, selected 1, toggle pressed, pane shows v2, "Done — saved to your
   gallery.", no page errors. (A browser tab cannot run this: ComfyUI CORS; only Electron rewrites Origin.)
4. `tests/desktop/flow-chain-toggle.spec.js`: swap both ways, card `selectedIndex` + persisted;
   mutation (no card swap) caught.
- `node --test tests/*.test.cjs`: 2582 pass, 0 fail. Lint clean. Desktop flow specs 11/12, the one red
  (`flow-enhance-writes-textarea` #1) passed 2/2 alone: a boot-timing flake.

## Left

- Fabio's look at the toggle (shape was his call; mine was taken, see the ask in the session).
