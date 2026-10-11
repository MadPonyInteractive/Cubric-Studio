# MPI-1089 - Editor fed a headless sheet: the chained Headless leg runs SAM3 again and eats the hair

Umbrella: MPI-1091. **Breaks users** on the 2.1 Character Sheet Editor (MPI-1041).

## What happened (Fabio, 2026-10-11, project `Qwen 2.1`)

- The Editor's input `flowCharacterSheet_012` was itself a HEADLESS-leg output (sidecar `00567a1a...`, op
  `flowCharacterSheetHeadless`): the front figure already had the grey oval.
- Clothes edits `flowCSE_011` / `flowCSE_012` (op `flowCharacterSheetEdit`) kept that grey oval.
- `Input_Remove_Head = true`, so the chain ran `flowCharacterSheetHeadless` on the result
  (`flowCharacterSheet_013` / `_014`, ~3.7 s). No head was left, so SAM3 took bits of the braids instead.
- Fabio read it as "it ran twice": two history entries (with head / headless) are by design (MPI-997); the
  second head removal is the bug.

## Root cause to confirm

The Editor accepts a headless sheet as input and the chain does not know. Read `flowLegs()` / `chain.when` in
`js/data/flowsRegistry.js` (~3099-3290) and the chain run in flowService, then pick:
1. Feed the Editor the WITH-head sibling when the picked sheet is a headless-leg output (the history entry before
   it). The edit then has a real face to match in the close-up, and the leg removes a real head. Likely the root fix.
2. Skip the leg when the input is already a headless output (leaves the edit working on a grey oval).
Same check on Character Sheet from Images (MPI-1042) if it can take a sheet as input.

## Overlaps

MPI-1087 (one Headless toggle) touches the same chain code: do 1089 first, or together.
