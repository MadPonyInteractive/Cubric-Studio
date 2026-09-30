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

## Mirrored sheet (2026-09-30, session 9c1e6f07, G:\ComfyUi bench :8189, turbo, 1K)

Fabio's case (enhanced cyborg prompt, Anime, seed 360955969) reproduced byte-for-byte on the bench:
portrait LEFT. Same prompt, "layout right" = [front | back | portrait]:

| recipe text | cyborg Anime | cyborg Cartoon | wizard Anime (hat in portrait) | Photoreal / 3D |
|---|---|---|---|---|
| shipped before | 0/4 | 0/2 | 4/4 (4/4) | 1/1, 1/1 |
| V1 panels listed up front + half-sentences swapped | 7/7 | 2/2 | 2/2 (0/2) | 1/1, 1/1 |
| V2 panels listed up front | 3/3 | - | 4/4 (2/4) | - |
| V3 = V2 without "large" | 2/2 | - | 2/2 (0/2) | - |
| V4 order inside the left-half sentence only | 0/2 | - | 2/2 (2/2) | - |
| **V5 (shipped)** ", the two full-body views on the left and the portrait on the right" | **6/6** | **2/2** | **4/4 (4/4)** | 1/1, 1/1 |

Seeds paired across arms (360955969, 1001-6006). Every image looked at. Then:
- The committed graph file itself (no override) on 360955969: right layout. Leg 2 on that sheet: the
  front body's head filled, portrait untouched (the complaint that opened this).
- Edit is text-only: the clause inserted 4x in `flow_character_sheet.json`, 8x in raw (each text is
  stored twice there, `widgets_values` + `widgets_values_named`); a script asserted each node's text
  equals the tested V5 file. `validate-injection-rules.mjs` (COMFY_URL :8189): conforms.
  `node --test` flow-model-choice, inject-params-titles, flow-chain, smoke-flows: 85 pass, 0 fail.
- Flip fallback not built: not needed, and [portrait|front|back] flipped puts the BACK in quarter 1.
- 55 bench generations, ~31 min of Fabio's GPU (told first); bench stopped after.

## VRAM release on leg 2 (2026-09-30, Fabio: "does it have an MPI VRAM release node?")

It did not, and neither did the pre-split graph: its one `MpiClearVram` (#493) ran BEFORE the
head branch, so SAM3 was always left resident. Added `#901 MpiClearVram` between `#883` and
`#882 Output_Image` (the pass-through, upstream of the capture title, per
`docs/workflow-authoring/bench-editing.md`): raw by script, API by `workflow-to-api.mjs` on the
:8189 bench + shipUploadSlots; the API diff is exactly those two nodes. Validator conforms;
flow tests 85/85. Bench, used VRAM after one head removal: HEAD graph 1147 -> 3013 MB (SAM3
held), new graph 1312 MB after (released). Output checked: front head filled, rest untouched.

## Fabio's look (2026-10-01)

His own app run: the cyborg prompt, Anime, 1K, Turbo, Headless on. Sheet laid out
[front | back | portrait], front head removed, result-pane "Headless front body" toggle shown:
"Looking good". The VRAM node added after needs no second look (his call: only a clear node).

## Left

- CI green on the commit carrying this, then the close.
