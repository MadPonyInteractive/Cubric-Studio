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

## Red master met at push (MPI-1156 commit ca1042233)

- `crop-resize-output` "Resize applies a clip with no engine": a tool op (`executor: 'tool'`, sharp / ffmpeg) counted as a
  video run, waited on the describer and was refused with none. Fix: tool ops exempt from the gate, like mask tracks.
- `video-history-strip` "what the strip holds is what the run is sent": the look queued `imageDescribe` ahead of the
  run (correct). Fixture now seeds a kept age NO on both cards; repro without it = the CI error exactly.
- Both specs green locally (4/4 + Resize); unit suites 520/520.

## Eye test (Fabio, app, 2026-10-16): PASS

"The removing clothes worked for adults and got refused for children, so it passed."

Same session, his asks: result card names were piling up every earlier change (now the source name before the first
" - " + the first four words); the Klein model slot read only "Model" (now "Clothes, condition, custom and age").
The picker crop went to its own card, MPI-1160.

## Age 18 on an adult sheet (Fabio, eye test): bench ag1 + ag2, Klein, 2 seeds each

Repro (flowCSE_059, pink bob, age 18, describer refused -> read 35): the young-adult string lost the pink bob and aged
only the close-up; the front face kept its smile lines. Root: the string named no hair at all.

- ag1 `a_hair` (+ ", the same hairstyle and hair color"): bob kept, front AND close-up faces younger, both seeds.
- ag1 `a_fig` (every figure named instead of L1): same result - not needed, L1 holds.
- ag2 the fisher (white hair + beard, reads ~68) at 30: `a_hair` = shipped, dark hair and no beard on all panels,
  both seeds. "Same hair color" does not fight "no grey hair".

Shipped `a_hair` verbatim in the young-adult branch (18-39); tests 24/24, eslint clean. Outputs stay in the scratchpad.

CI: Tests run 38949721872 (4fc442c89) and 38951108641 (0a8f600df, last code commit) both green.
