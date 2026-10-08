# MPI-1042 - Character Sheet from images

Opened 2026-10-08. Fabio: *"Users may have existing characters that they've been using, and they
want a character sheet out of them. I'd like to have a flow where I can just place images from an
existing character that I have, and that would create a character sheet from it with clothes that
I can prompt or clothes that just come from the provided images."*

Split from **MPI-1041** (the Character Sheet Editor), which changes a finished sheet by words and
**never swaps a face**. Identity from images lives HERE only.

## Where this came from

- **MPI-504** (archived, done) shipped Character Sheet v1 as prompt only and deferred this exact
  path to v2 without a card. Its research still holds: `tasks/_archived/MPI-504/brief.md`
  § "Path 2 - reference photo in. **The hard one.**" Same note in code at
  `js/data/flowsRegistry.js:755-759`.
- **MPI-815** (Elements library) plans a "sheet-builder Flow (character + clothes + weapon -> a
  character sheet)" as a later card (`tasks/MPI-815/plan.md:236`). This card is its character
  half; clothes and weapon belong to the editor (MPI-1041).

## Settled - Fabio, 2026-10-08

- **Face + body only. No clothes field, no outfit picture.** Clothes are the editor's job
  (MPI-1041). The sheet follows the body picture as given: a naked body in, a naked sheet out,
  then the editor dresses it - as many outfits as the user wants, one sheet each. The same holds
  from scratch: a naked character from `character-sheet` on Krea 2 NSFW, then the editor.
- **Free, no head-swap LoRA.** If a face lands weak, the user fixes it with Head Swap afterwards.

## Shape

- **A new Flow on Klein 9B** (`klein-9b` + `klein-9b-cloud`). The prompt-only `character-sheet`
  Flow on Krea 2 is untouched - no optional images bolted onto it.
- **Two pictures, both required** (agent pick: with no clothes field, a missing body leaves the
  model nothing to keep). Two references run ~30 s on Klein (`docs/models/klein/README.md`).
- **Reuse the headless chain as-is.** `flowCharacterSheetHeadless` runs on any finished sheet
  image, so the front body comes back headless with no new graph.
- Same sheet layout as `character-sheet` (3/4 close-up, front, back, grey), so both Flows feed
  the editor (MPI-1041) and video models the same way.

## Risks to bench first (node graph, Fabio authors - MPI-560 phase-4 rule)

1. **Klein 9B places the referenced person ~2 in 3 at best, and a miss looks clean**
   (`docs/models/klein/9b.md` § "Known limit - reference placement fails SILENTLY"). Expect a
   retry. A batch fixes nothing: it is the same as N runs with N seeds, same odds per image
   (Fabio, 2026-10-08). The Flow's copy must
   say "if it is not your character, run it again".
2. **One shot vs per panel.** One image keeps the three panels consistent with each other but asks
   Klein to lay out a sheet from references. Per panel (three runs, stitched in code) makes the
   layout certain but risks the outfit drifting between front and back. Bench one shot first.
3. **The back panel is invented.** No source shows it. The face does not matter there; hair and
   outfit from behind do. Judge it on those.

## Head Swap stays separate

**Head Swap is a paid Flow** (Gumroad, MPI-780 / MPI-781; Klein 9B + BFS head-swap LoRA
`klein-9b-lora-headswap`, `docs/playbooks/add-flow/existing-flows/head-swap.md`). This Flow does
NOT use that LoRA (settled above); Head Swap is the user's fix-up for a weak face.
