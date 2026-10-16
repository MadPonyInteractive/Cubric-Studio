# MPI-1159 validation

## Bench ud1 (2026-10-16, app engine :48188 under gpu_lease)

Sheet flowCSE_044 (project "Qwen 2.1", Fabio's adult woman, pink bob), his words as typed:
"Remove all the clothes, leaving you nude and barefoot." Seeds 1954144633 (his flowCSE_057 run) and 42.
Script + outputs: session scratchpad `ud1.py`, `ud1/` (adult nudity, never in the repo).

| case | prompt | result |
|---|---|---|
| repro (flowCSE_057) | Klein lock 1, "Dress the character in Remove all the clothes..." | came back dressed (Fabio's run) |
| q_ship | Qwen, the same shipped string | 2/2: all three figures nude + barefoot, own face, hair, layout |
| q_verb (SHIPPED) | Qwen, "Change the character's clothes in image 1: <words>. The front view, the character seen from behind and the close-up portrait on the right all show the same change. Keep the character's own face and hair. Keep everything else exactly as it is." | 2/2 the same |

Klein's own runs (k_ship, k_verb) were not looked at: Fabio, "Klein cannot do human anatomy".

## Shipped

- `childSafety.asksToUndress`: nudity + undressing words, NOT underwear ("red lace lingerie" stays a Klein dressing).
- `operationBy.map.clothes` rule entry: undress words + no Reference picture -> `flowCharacterSheetEditQwen`.
- Builder: those words get the q_verb string, byte-identical to the bench (test asserts it).
- Safety unchanged: the typed words refuse at Age 0, 10, 16, 17 on both models (test).

Tests: `tests/character-sheet-editor.test.cjs` 24/24; registry + safety suites 396/396; eslint clean.

## Open

- Fabio's eye test in the app (restart needed): Clothes, "Remove all the clothes..." on an adult sheet.
