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
  character sheet)" as a later card (`tasks/MPI-815/plan.md:236`). This card is its first half;
  weapon / prop images come later.

## Shape (agent pick, awaiting Fabio)

- **A new Flow on Klein 9B** (`klein-9b` + `klein-9b-cloud`). The prompt-only `character-sheet`
  Flow on Krea 2 is untouched - no optional images bolted onto it.
- **Inputs fit Klein's three references exactly** (1 ref 20 s, 2 / 3 refs 30 / 44 s,
  `docs/models/klein/README.md`):
  1. Face - required.
  2. Full body - optional; carries body shape (and clothes, when the user keeps them).
  3. Outfit - optional, a third picture, later if v1 runs long.
- **Clothes: a toggle.** "Keep the clothes from the pictures" or "Describe the clothes" (prompt).
- **Reuse the headless chain as-is.** `flowCharacterSheetHeadless` runs on any finished sheet
  image, so the front body comes back headless with no new graph.
- Same sheet layout as `character-sheet` (3/4 close-up, front, back, grey), so both Flows feed
  the editor (MPI-1041) and video models the same way.

## Risks to bench first (node graph, Fabio authors - MPI-560 phase-4 rule)

1. **Klein 9B places the referenced person ~2 in 3 at best, and a miss looks clean**
   (`docs/models/klein/9b.md` § "Known limit - reference placement fails SILENTLY"). Expect a
   retry. Batch is no answer (artefacts on images 2+ outside SDXL / cloud). The Flow's copy must
   say "if it is not your character, run it again".
2. **One shot vs per panel.** One image keeps the three panels consistent with each other but asks
   Klein to lay out a sheet from references. Per panel (three runs, stitched in code) makes the
   layout certain but risks the outfit drifting between front and back. Bench one shot first.
3. **A body photo carries its clothes and pose.** With "Describe the clothes" on, does the photo's
   outfit still leak through?
4. **The back panel is invented.** No source shows it. The face does not matter there; hair and
   outfit from behind do. Judge it on those.

## Open product call

**Head Swap is a paid Flow** (Gumroad, MPI-780 / MPI-781; Klein 9B + BFS head-swap LoRA
`klein-9b-lora-headswap`, `docs/playbooks/add-flow/existing-flows/head-swap.md`). This Flow also
carries a face from a picture, onto a sheet. Free or paid, and may it use the head-swap LoRA if the
bench says identity needs it? Fabio's call.
