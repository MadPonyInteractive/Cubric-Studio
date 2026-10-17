# MPI-1174 Validation

## Why the app measured "no gaps" (Fabio's run 2026-10-17 19:13)

- Not a browser-vs-node difference. The Editor's sidecar (flowCSE_069) shows the picked sheet,
  flowCharacterSheet_070 (headless), was run AS its with-head version flowCharacterSheet_069 (the
  Character Sheet card's other `outputVersions` entry), and the measure read 069.
- node + sharp on 069 with the shipped `sheetCuts` also gives no cuts (070 gives 490,908).
- On 069 the backdrop near the left edge is shaded top to bottom (calm, but spread above the
  threshold), which splits the empty margin before the front figure off the edge. That margin run
  (~6%) passed the old `start > 0` test, became cut 1, failed the 15-40% check, and nulled the sheet.
  On 070 the same margin run was 4 columns, under the 6-column minimum, so it was skipped by luck.

## Fix

`sheetCuts` counts a run only once an active (figure) column lies to its left.

## Evidence

- All 149 flowCSE / flowCSFI / flowCharacterSheet PNGs in "Qwen 2.1" (r44's bench set and newer):
  146 identical before/after; 3 changed, all from no cuts to cuts in real gaps
  (flowCharacterSheet_069 490,908; flowCharacterSheet_071 460,868; flowCSE_069 462,868), eye-checked.
- New synthetic case in tests/flow-describe.test.cjs (shaded left margin): old code null, new 0.278/0.546.
- Isolated instance (`app:isolated`, :61731, own profile): `describeFlowRun` for the Editor
  (change=tattoos) in the app renderer, real Image + canvas measure, on copies of 069 and 070:
  app.log `[flow-describe] Character Sheet Editor sheetCuts measured: 490,908` for both. No graph
  was queued (that instance saw Fabio's ComfyUI engine).
- node --test flow-describe + character-sheet-editor: 40/40; eslint clean.
