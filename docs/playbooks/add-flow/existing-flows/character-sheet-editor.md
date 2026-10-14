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
| requiredModels | `[{ label: 'Model', models: ['klein-9b'], loras: true }, { label: 'Body shape, hair from a picture and child ages', models: ['qwen-image-2-1'], optional: true, loras: true, for: ['flowCharacterSheetEditQwen', 'flowCharacterSheetImages'] }]` |
| operation / `operationBy` | `flowCharacterSheetEdit` (Klein), routed by the `change` select: `body` -> `flowCharacterSheetEditQwen`, `hair` -> Qwen WITH a Reference picture, else Klein (a rule entry, MPI-1086), `none` -> no leg 1 |
| graphs | `flow_character_sheet_edit.json` (Klein 9B, 102 nodes, in-graph SAM3 lock: cut at the shoulders on the back body, at the brows at lock 2; optional reference, cut out to its hair at lock 2) and `flow_character_sheet_edit_qwen.json` (Qwen-Image 2.1, 45: with a Reference picture a Klein mannequin leg feeds it `images.image_2`, MPI-1086 r23). Both output the INPUT size |
| authoring source | `raw/` is the source now. `research/bench-tools/build_edit_graph*.py` wrote the first raws; the LoRA racks went in after with `research/bench-tools/insert_rack.py`, the reference with `insert_ref2.py`, the brow cut, hair cut-out and the Qwen mannequin leg with MPI-1086's `research/bench/patch_raw*.py` (raw in place, then `workflow-to-api.mjs` single-file) |
| media | `image1` the sheet; `image2` an OPTIONAL Reference picture (Klein op: Clothes, Accessories; Qwen op: Hairstyle) |
| fields | `change` (select; "Custom" = a free edit in words, "None" = age only), `words` (hidden for None), `Input_Age` (slider -1-100: -1 = keep, the default; 0 = a newborn; 1 = a toddler; `valueLabels` reads Keep / Newborn), `Input_Remove_Head` |
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
| Clothes | Klein | 1 = SAM3 "head, hair, face" on all three panels; the BACK body's cut at the shoulders (MPI-1090) | b3-b4, 6 of 6; F1 wording 9 of 9 |
| Accessories | Klein | 0 (free): a head lock blocks glasses and hats | A4, 2 of 2; F1 wording 7 of 8 |
| Hairstyle | Klein | 2 = "face" on the front and the close-up, from the BROWS down (MPI-1086) | b8; F1 wording 3 of 3; fringe 6 of 6 |
| Hairstyle + picture | Qwen-Image 2.1; Klein makes the picture a mannequin in the same graph | none in that graph | MPI-1086 r21 17/18, r23 6/6 |
| Condition | Klein | 0 | b5, 6 of 6 |
| Custom | Klein | 0: "Change the character in this character sheet: <words>." + the accessories tail | MPI-1086 qh6, 6 of 6 layouts (the words as typed broke 1 of 6) |
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
lazy). The builder sets `Input_Reference` only on the change leg of Clothes, Accessories or Hairstyle: an age leg that starts
the run is handed the user's media too. Words become optional with a reference; any age 0-17 refuses
it (`docs/child-safety.md`). With a reference every figure is named, the back one ONLY as "the
character seen from behind": "the back view" let Klein draw the reference person as an extra figure,
even under lock 1 (MPI-1041 validation.md § F2). It must also take the OLD clothes off in words, or
Klein keeps what the picture does not cover (a bikini kept the jeans): no words -> "only the outfit
... take off everything else"; with words -> "..., replacing all of the clothes ... top and bottom".
Never the take-off clause with words: it strips what the words leave out (jacket + scarf -> trousers
cut to shorts). The user's words get their OWN sentence ("Change only this about the outfit: ..."),
never spliced into the reference clause: spliced, "G string on the back view" became the whole outfit
and redrew the front figure as a back view. `_unview` rewrites "the back view" in the words to "seen
from behind". With words the close-up lost the neckline 6 times in 6 until a sentence named the
reference's neckline (MPI-1090 validation.md rounds 2-4: front, layout, close-up 5/5, back 4/5;
picking "the green jacket" off a full outfit keeps her own trousers 3/3, the scarf still comes 2/3).
**The back lock stops at the shoulders (MPI-1090).** SAM3 takes long hair as one solid block, gaps
included, so on the back body lock 1 froze the old top between the braids (12 of 12) and Klein then
continued it below them. SAM3 "face" on the front body gives the chin (`MpiMaskBbox` -> `MpiFromBox`);
the back's SAM3 mask is multiplied by a box from the top of the panel to chin + half a face height
(`MpiBox` -> `MpiBoxMask`), so hair below the shoulders is redrawn with the outfit. No face found =
an empty box = no lock on the back, never an error. Word lists on the back SAM3 ("head", "head, neck")
still took every braid. With no words and a front-only reference the back stays a guess (shorts,
skirt or bodysuit by seed); a front-and-back reference is the fix.
**The fringe (MPI-1086).** SAM3 "face" runs from the HAIRLINE, so lock 2 froze the whole forehead
and a fringe never landed (0/3; free, 3/3). Each lock-2 face mask is multiplied by a box from face
top + a third of its height down (`MpiMaskBbox` -> `MpiFromBox` -> `MpiBox` -> `MpiBoxMask`, behind an
`MpiIfElse` on lock 1, whose masks stay whole - pixel-identical). A quarter left 1 front in 3 without
a fringe. Trade-off: a bob with no fringe asked can now draw one; "no fringe" in the words is the out.
**Accessories with a picture (MPI-1086 qh5/qh7)** NEED words naming it: alone, gold hoops became a
necklace and a rose tattoo went on the face (4/4). The shipped accessories string + "from the
reference picture" + "Keep the character's own face, hair and clothes." - without that line a photo
of a man in a bandana put his face and tee in the close-up; naming every figure "worn the same way"
made the close-up HIM (2/2). A backpack can still come out worn on the chest: "on her back" fixes it.
**Hairstyle with a picture runs on QWEN (MPI-1086 rounds 16-24).** Fabio's eye test failed the Klein
route: lock 2 pastes the old face back onto a head Klein redrew from the picture's pose (double jaw,
a second ear, a face out of place; ~11/17 after every lock fix). `operationBy` routes `hair` by a rule
entry (`{ when: { media: 'image2' }, then: Qwen, else: Klein }`); hair in WORDS stays on Klein.
The Qwen graph turns the picture into a MANNEQUIN first, in the same prompt: `Input_Image_2` ->
Klein 9B free edit ("Replace the person with a plain white mannequin seen in a three-quarter view,
and keep the hairstyle exactly as it is...", fixed seed, 1 MP) -> `MpiClearVram` -> a second
`TextEncodeQwenImage21` with the mannequin as `images.image_2`. Three lazy `MpiIfElse` take that encode
only when `loaded` AND `Input_Reference`, so Body shape never loads Klein. 6/6 + rate (validation.md
r23); the raw photo as image 2 put its make-up on the front figure (r22), and an earlier SAM3 hair
cut-out got proportions and colour wrong. Keep the 3/4 view: a forced front view or "the full length
of the hair" grew a short crop long. `refHair` (ASK2: each colour and where, for roots) describes the
RAW photo - the app describes before the graph runs - and the builder names image 1 / image 2 and every
figure. The user's words LEAD ("..., changed like this: <words>. The hairstyle in image 2: ..."):
after the description the bodies kept the picture's colour. Words recolour and add; MOVING part of a
style ("the bun lower") added a bun in every wording. It needs Qwen, so it is non-commercial.

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

Three answers feed the prompt builder through NON-graph keys: `sheetAge` (how old the sheet looks,
for the younger / older word only; it reads old faces 10-15 years high), `sheetClothes` (a
`Wearing ...` caption the child rebuild dresses the bodies in, 1-12, unless Clothes is the change)
and `refHair` (the Reference picture's hairstyle in one phrase, for Hairstyle; MPI-1086 qh12).

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
