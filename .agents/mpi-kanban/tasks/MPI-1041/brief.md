# MPI-1041 - Character Sheet Editor

Opened 2026-10-08 as "Character Sheet from images", reshaped the same day. The from-images
job moved to its own card, **MPI-1042**.

## Direction - Fabio, 2026-10-08

- **The editor changes a finished sheet by WORDS:** hairstyle, clothes, accessories, body
  shape, age. **It never swaps a face** - no face image input. (Identity from images is MPI-1042.)
- **Why an editor at all:**
  > *"I create a character sheet for John, where John is wearing his default clothes and is in
  > its default state. But then I want to create a video scene from that character sheet where
  > John is all beat up and his clothes are torn apart because he's been in a fight. I need a
  > character sheet editor there. Because regenerating John with the changes will not produce a
  > good result or a consistent one."*
- **Klein, not Krea 2:** Krea 2 is weaker and slower at editing.

### Shape (agent pick)

- New Flow, a sheet image required, Klein 9B slot (`klein-9b` + `klein-9b-cloud`, like
  `scribble-object`). The prompt-only `character-sheet` Flow is untouched.
- Fields, all words: Hairstyle, Clothes, Accessories, Body shape, Age.
- Result lands as a NEW card ("John - beaten up"), not a new version: the default sheet stays a
  live asset for other scenes.

## Bench first - what decides whether this works

On a real 3-panel sheet, Klein 9B, in the node graph (MPI-560 phase-4 rule: Fabio authors, no
worker sub-agent):

1. **Story-state edit:** "bruised face, torn dirty clothes". Do all three panels change the SAME
   way, back panel included? This is the editor's core test. If it fails, the fallback is a
   per-panel edit (crop, edit, stitch), at more runs.
2. **Body shape and age by words:** muscular / skinny / curvy / heavyset; older / younger. Does
   the face stay the same person while age changes?
3. **Free edit vs mask-locked edit.** A whole-image edit can drift parts nobody asked to change.
   The sheet already runs SAM3 text-select (the headless chain, MPI-997); a per-field mask
   ("hair", "clothes") + LanPaint keeps everything else pixel-identical. Bench both.
4. **Headless front body:** a body or clothes edit may grow a head back on the front panel. If
   so, re-run the `flowCharacterSheetHeadless` chain after the edit.

## Board check (2026-10-08)

No earlier card covered an editor. Near: **MPI-1042** (sheet from images, the sibling),
**MPI-1036** (Video Edit on H3 - outfit / head swaps in a VIDEO), **MPI-586** (Prop Sheet),
**MPI-603** (outpaint LoRA retirement - `models.js` / `loraDeps.js` / R2, not this graph).

## What exists today

- Flow `character-sheet` (`flowsRegistry.js`, op `flowCharacterSheet`, graph
  `comfy_workflows/flow_character_sheet.json`): Krea 2, large 3/4 close-up + full body front +
  full body back on grey. Headless chain since MPI-997 (`flowCharacterSheetHeadless`, Klein
  blend slot from MPI-610). Recipe: `docs/playbooks/add-flow/existing-flows/character-sheet.md`.
- Klein edit timings: 1 ref 20 s, 2 / 3 refs 30 / 44 s (`docs/models/klein/README.md`). 9B needs
  ~15 GB VRAM at peak; `klein-9b-cloud` covers smaller cards.
