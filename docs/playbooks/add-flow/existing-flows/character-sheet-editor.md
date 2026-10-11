# Character Sheet Editor (`character-sheet-editor`) - one change on a finished sheet

> A three-panel sheet (front | back | 3/4 close-up) in, the same character with ONE thing changed out,
> all three panels kept in step. The result is a NEW card named `<input card> - <change>`; the sheet
> it started from stays a live asset. MPI-1041. Bench record (19 batches, every verdict below):
> `.agents/mpi-kanban/tasks/MPI-1041/validation.md`; the strings: `research/templates.md`.

The first Flow on the engine's **multi-leg, routed, optional-model** shape. Read this before
building a Flow that needs more than one graph or more than one model.

## Shape

| | |
|---|---|
| requiredModels | `[{ label: 'Model', models: ['klein-9b'], loras: true }, { label: 'Body shape and child ages', models: ['qwen-image-2-1'], optional: true, loras: true, for: ['flowCharacterSheetEditQwen', 'flowCharacterSheetImages'] }]` |
| operation / `operationBy` | `flowCharacterSheetEdit` (Klein), routed by the `change` select: `body` -> `flowCharacterSheetEditQwen`, `none` -> no leg 1 |
| graphs | `flow_character_sheet_edit.json` (Klein 9B, 73 nodes, in-graph SAM3 lock, optional reference) and `flow_character_sheet_edit_qwen.json` (Qwen-Image 2.1, 20). Both output the INPUT size |
| authoring source | `raw/` is the source now. `research/bench-tools/build_edit_graph*.py` wrote the first raws; the LoRA racks went in after with `research/bench-tools/insert_rack.py`, the reference with `insert_ref2.py` (raw in place, then `workflow-to-api.mjs` single-file) |
| media | `image1` the sheet; `image2` an OPTIONAL Reference picture (Klein op only) |
| fields | `change` (select), `words` (hidden for "Nothing else"), `Input_Age` (slider -1-100: -1 = keep, the default; 0 = a newborn; 1 = a toddler; `valueLabels` reads Keep / Newborn), `Input_Remove_Head` |
| prompt | `promptBuilder: 'characterSheetEditor'` -> `js/data/flowPrompts/characterSheetEditor.js`, called in `flowService` after describe. The user never types a prompt |

## Legs (`chain` as an ARRAY)

| # | op | when | what |
|---|---|---|---|
| 1 | routed (`operationBy`) | `change` is not `none` | the picked change, Klein or Qwen |
| 2 | `flowCharacterSheetEdit` | `Input_Age` atLeast 0 | Klein's exact-age edit, `prompt: 'age'` |
| 3 | `flowCharacterSheetImages` | `Input_Age` 0-12 | the from-images graph rebuilds a child's bodies from the right half (`box` in fractions), `params: { Input_Face_Pose: 'TURNED' }`, `prompt: 'rebuild'` |
| 4 | `flowCharacterSheetHeadless` | `Input_Remove_Head`, `unless` age 0 | the same head removal Character Sheet runs; never on a newborn (swaddled, lying down) |

Each leg gets the previous leg's picture on `input`; a skipped leg passes it through. Every leg
carries `runPrompt` (the WHOLE run's words), so the child-safety gate refuses "Clothes: a bikini +
Age 10" on leg 1, not after it. Engine contract: `flowsRegistry.js` § Legs, routing and rules.

A sheet picked while its card shows the head-removed version goes in as the version before it, WITH
its head (`flowService.js` `unchainedSource`, MPI-1089): fed the grey oval, leg 4 ran SAM3 on a
sheet with no head and took the hair.

## Which change runs where, and why (bench verdicts)

| change | editor | lock (`Input_Lock`) | evidence |
|---|---|---|---|
| Clothes | Klein | 1 = SAM3 "head, hair, face" on all three panels | b3-b4, 6 of 6; F1 wording 9 of 9 |
| Accessories | Klein | 0 (free): a head lock blocks glasses and hats | A4, 2 of 2; F1 wording 7 of 8 |
| Hairstyle | Klein | 2 = "face" on the front and the close-up | b8; F1 wording 3 of 3 |
| Condition | Klein | 0 | b5, 6 of 6 |
| Age 13+ | Klein | 0, exact-age wording | b11-b15 |
| Age 12 and under | Klein age edit, then the Qwen rebuild | - | b17; Klein-only rebuild failed (b18, b19) |
| Age 1 | as 12 and under, plus "the same hairstyle and hair color"; toddler body words | - | b20-21, 2 of 2 |
| Age 0 (newborn) | as 12 and under: SWADDLED in a cream blanket, no clothes caption, no head removal; the graph draws it standing | - | b21, 2 of 2 (Fabio took the upright pose) |
| Body shape | Qwen-Image 2.1 | none in that graph | b9, 3 of 3 |

**Panel agreement is the WORDING's job (F1, `validation.md` § Phase F1).** Naming only the close-up
left each panel to pick its own sleeves or drop the scarf; Clothes now names all three views and the
parts that disagreed, Accessories names "the character seen from behind" and the close-up, Hairstyle
adds "with the head uncovered and no hat". On a FREE edit (no head lock) "the back view" or "all three
figures" makes Klein redraw the layout with an extra figure. A second "make the views match" pass
changes nothing. A younger age within 15 years of the describer's read takes no direction word (it
stripped the fisher's beard); a small OLDER step either overshoots on every panel or ages only the
close-up - a Klein limit, the overshooting wording is kept because its panels agree.

**The Reference picture (F2).** `image2` -> `Input_Image_2` -> a second `ReferenceLatent` on top of
reference 1, switched by `loaded` AND `Input_Reference` (`MpiBooleanCompare` both_true -> `MpiIfElse`,
lazy). The builder sets `Input_Reference` only on the change leg of Clothes: an age leg that starts
the run is handed the user's media too. Words become optional with a reference; any age 0-17 refuses
it (`docs/child-safety.md`). With a reference the wording names only the close-up: naming the back
view let Klein draw the reference person as an extra figure, even under lock 1 (validation.md § F2).
It must also take the OLD clothes off in words, or Klein keeps what the picture does not cover (a
bikini kept the jeans): no words -> "only the outfit ... take off everything else"; with words ->
"...: <words>, replacing all of the clothes ... top and bottom". Never the take-off clause with
words: it strips what the words leave out (jacket + scarf -> trousers cut to shorts). Known limit:
with partial words the picture's other garments can still come along (its trousers replaced hers).
The close-up line names "the same neckline and straps": without it the close-up drifted back to the
old top in the late steps on some seeds (round 8).
Accessories and Hairstyle ignore the picture: a hat or a haircut from one reached all three panels
1 time in 8.

An edit keeps the figure's SIZE: a child's or a heavier body needs the bodies redrawn, which is why
age 12 and under and Body shape leave Klein. Klein's lock is LAZY (SAM3 runs only at lock 1 or 2);
an `MpiClearVram` output node forced the lazy branch and was removed.

## Optional model: Qwen-Image 2.1

Qwen is non-commercial (research licence), so it is OPTIONAL: without it every Klein change runs.

- `flowAvailability` ignores an optional slot; `flowRunAvailability(flow, run)` adds it back for
  a run whose ops it serves (`for`). Hand runs warn, agent runs get the missing id.
- `flowModelIds(flow, { op })` null-fills the slots an op does not use, so leg 3 can never match
  Klein's `byModel` arm of the from-images graph.
- The run slide shows a slot whose optional model is not installed as `<name> [Install]`
  (`MpiBaseFlow._optionalInstallRow`, `downloadService.start`, so the licence gate fires there),
  repainted on install events. The Library leaves it out of Fits my GPU, Install, Cancel and the
  progress bar (`flowInstallKeys` = required only) and lists it under "Optional models";
  `flowLicences` still shows its licence.

## LoRA racks

Slot 1 (Klein) fills `Input_Lora_Phase1_1..6` in the Klein graph, in front of BOTH arms of the lock
switch (`CFGGuider` 50 and `LanPaint_KSampler` 54). Slot 2 (Qwen) fills `Input_Lora_Phase2_1..6` in the
Qwen graph. A leg sends only the phases of the slot it runs (`flowService` § `loraPhases`), so the
child rebuild (leg 3, the from-images graph, titled Phase1) takes no rack and no Klein LoRA can land
in it. `tests/flow-lora-rack.test.cjs` `RACKS` walks all three chains.

## Describe: answers and CHECKS

Two answers feed the prompt builder through NON-graph keys: `sheetAge` (how old the sheet looks,
for the younger / older word only; it reads old faces 10-15 years high) and `sheetClothes` (a
`Wearing ...` caption the child rebuild dresses the bodies in, 1-12, unless Clothes is the change).

Four entries have NO `to`: they are CHECKS (`SHEET_CLOTHES_CHECKS`, `{ media, region, when, ask,
refuseUnless, code, message }`), asked before every answer and refusing unless the whole answer
equals `refuseUnless`. At ages 0-17 the upper and the lower body of the front and the back view
(`region` = that quarter of the sheet) must each read CLOTHES, swimwear included at 16-17 (Clothes
puts a bikini on through the words gate). Skipped when Clothes is the change: that leg dresses the
sheet first. **Never ask about the whole sheet:** "is the person fully dressed?" cleared a bikini,
lingerie and a nude sheet on the default describer, and a one-word classification of the whole
sheet cleared a jacket-front / bikini-back sheet (Phase E rounds 1-3, `validation.md`; benches
`research/bench-tools/qchecks*.py`). No check judges how OLD a picture looks: Fabio's call,
2026-10-10. Code `CHILD_SAFETY` on hand, agent and routine runs alike. The rule and its known
gaps: `docs/child-safety.md`.

## Tests

`tests/character-sheet-editor.test.cjs` (templates, routing, legs, per-leg models and racks, the
checks, a real hand / agent / routine run, the card name), `tests/flow-legs.test.cjs` (the engine),
`tests/flow-lora-rack.test.cjs`, `tests/flow-licence-surface.test.cjs` (optional model).
