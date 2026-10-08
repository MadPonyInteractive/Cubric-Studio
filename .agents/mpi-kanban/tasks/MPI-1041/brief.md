# MPI-1041 - Character Sheet Editor (and a sheet from an existing character)

Opened 2026-10-08. Fabio: *"I think it's time to make the character sheet accept a base image
or images so that the user can create a character sheet from an existing character he already
has."* Reshaped the same day into an editor (see § Direction).

## Direction - Fabio, 2026-10-08

- **Start with face + body only.** Outfit and prop images come later. Body is its own input
  because shapes differ hugely (very muscular vs very skinny man; curvy vs skinny vs fat woman).
- **This is edit-model work, so Klein, not Krea 2.** Krea 2 is weaker at editing and slower.
  The image path needs Klein 9B.
- **A Character Sheet EDITOR is probably the real answer**, editing:
  accessories, clothes, body, head, hairstyle.
  > *"I create a character sheet for John, where John is wearing his default clothes and is in
  > its default state. But then I want to create a video scene from that character sheet where
  > John is all beat up and his clothes are torn apart because he's been in a fight. I need a
  > character sheet editor there. Because regenerating John with the changes will not produce a
  > good result or a consistent one."*

**Settled:** build the editor. **Agent recommendation, awaiting Fabio:** no image inputs on the
existing sheet and no separate "sheet from images" Flow - the editor covers both. Editor results
land as a NEW card ("John - beaten up"), not a new version, because the default sheet stays a live
asset for other scenes.

### Proposed shape

- **A new Flow, image required, Klein 9B slot** (`klein-9b` + `klein-9b-cloud`, like
  `scribble-object`). The prompt-only `character-sheet` Flow on Krea 2 stays as it is. Adding
  optional images + a second model slot to it would branch one graph two ways.
- **"From an existing character" falls out of the editor:** make any sheet, then edit Head from a
  face image and Body from a body image. One Flow covers both jobs.
- **v1 fields:** Head (face image or words), Body (body image or words), Hairstyle, Clothes,
  Accessories (words). Image inputs for clothes and accessories later (the MPI-815
  sheet-builder).

## Bench first - what decides whether this works

All on a real 3-panel sheet, Klein 9B, in the node graph (MPI-560 phase-4 rule: Fabio authors,
no worker sub-agent):

1. **Story-state edit, words only:** "bruised face, torn dirty clothes". Do all three panels
   change the SAME way, the back panel included? This is the editor's core test.
2. **Head from a face image:** does identity land on the 3/4 close-up, and does the back panel's
   hair follow?
3. **Body from a body image:** does the shape carry to front AND back? Try the extremes Fabio
   named (muscular / skinny / curvy / fat).
4. **Free edit vs mask-locked edit.** A whole-image edit can drift parts nobody asked to change.
   The sheet already runs SAM3 text-select (the headless chain, MPI-997); a per-field mask
   ("hair", "clothes") + LanPaint would keep everything else pixel-identical. Bench both.
5. **Headless front body:** a body or clothes edit may grow a head back on the front panel.
   If so, re-run the `flowCharacterSheetHeadless` chain after the edit.

## Board check: no card covered this (2026-10-08)

- **MPI-504** (archived, done) shipped Character Sheet v1 as *prompt only* and deferred the
  reference-photo path to v2 without a card. Its brief keeps the research:
  `tasks/_archived/MPI-504/brief.md` § "Path 2 - reference photo in. **The hard one.**" Same note
  in code at `js/data/flowsRegistry.js:755-759`.
- **MPI-815** (Elements library, todo) lists "the sheet-builder Flow (character + clothes +
  weapon -> a character sheet)" as a later card (`tasks/MPI-815/plan.md:236`). Its image-input
  half is this card's later step.

Near but not duplicates: **MPI-603** (outpaint LoRA retirement; steps 3-5 are `models.js` /
`loraDeps.js` / R2, not this graph), **MPI-586** (Prop Sheet), **MPI-1039** (Multi-angle, for
locales), **MPI-1036** (Video Edit on H3: swap person / head / outfit in a VIDEO), **MPI-348**
(the swap family).

## Overlap with a PAID Flow - needs Fabio's call

**Head Swap is sold on Gumroad** (MPI-780 / MPI-781; graph in `c:\AI\Mpi\Cubric-Flows\head-swap`,
Klein 9B + the BFS head-swap LoRA `klein-9b-lora-headswap`,
`docs/playbooks/add-flow/existing-flows/head-swap.md`). A free editor whose Head field takes a
face image does much of the same job. Options: the Head-from-image field needs Head Swap
installed; or the free editor does Head by words only; or it does both and Head Swap's value is
the LoRA's quality.

## What exists today

- Flow `character-sheet` (`flowsRegistry.js`, op `flowCharacterSheet`, graph
  `comfy_workflows/flow_character_sheet.json`): Krea 2 render slot (SFW / NSFW, MPI-590), large
  3/4 close-up + full body front + full body back on grey. Step 0 collects no media.
- Headless front body is a chained second run since MPI-997 (`flowCharacterSheetHeadless`, Klein
  blend slot from MPI-610). Recipe: `docs/playbooks/add-flow/existing-flows/character-sheet.md`.
- Klein 9B needs ~15 GB VRAM at peak (`models.js`, `klein-9b` description); `klein-9b-cloud`
  covers smaller cards.
