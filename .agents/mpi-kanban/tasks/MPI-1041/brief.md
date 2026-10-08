# MPI-1041 - Character Sheet from an existing character

Opened 2026-10-08. Fabio: *"I think it's time to make the character sheet accept a base image
or images so that the user can create a character sheet from an existing character he already
has."*

## Board check first: no card covered this

Searched every live and archived card before opening this one (2026-10-08). The photo path
was **deferred, never carded**:

- **MPI-504** (archived, done) shipped Character Sheet v1 as *prompt only*. Its brief
  (`tasks/_archived/MPI-504/brief.md`) calls the reference-photo path v2 and keeps the research:
  § "Path 2 - reference photo in. **The hard one.**"
- `js/data/flowsRegistry.js:755-759` says the same in code: v1 takes a prompt and nothing else,
  the photo path is deferred whole to v2, because Head Swap covers "make it look like this
  person" as a second pass on the finished sheet.
- **MPI-815** (Elements library, todo) lists "the sheet-builder Flow (character + clothes +
  weapon -> a character sheet)" under *Later - separate cards, not this one*
  (`tasks/MPI-815/plan.md:236`). The multi-image half of this card is that Flow.

Not duplicates, but they touch the same ground:
- **MPI-603** (todo) - outpaint LoRA retirement. The Character Sheet graph half is done; its
  open steps 3-5 are `models.js` / `loraDeps.js` / R2, not this graph.
- **MPI-586** (todo) - Prop Sheet, the sibling flow for animals and props.
- **MPI-1039** (todo) - Multi-angle Flow, same "views the source never shows" problem for locales.
- **MPI-348** (done) - the Krea2 swap family (face / head / character), today's workaround.

## What exists today

- Flow `character-sheet` (`flowsRegistry.js`, op `flowCharacterSheet`, graph
  `comfy_workflows/flow_character_sheet.json`). Krea 2 render slot (SFW / NSFW, MPI-590),
  three panels: large 3/4 close-up, full body front, full body back, grey studio backdrop.
- Headless front body is a chained second run since MPI-997 (`flowCharacterSheetHeadless`,
  Klein blend slot from MPI-610). The input image path of that chain is the only image the flow
  touches today; step 0 collects no media (no `inputSchema`).
- Recipe: `docs/playbooks/add-flow/existing-flows/character-sheet.md`.
- Workaround a user has now: make a sheet from a description, then Head Swap their character
  onto it. Two runs, and outfit / body / back view are invented, not theirs.

## The hard part (from MPI-504 path 2)

Identity must hold onto a **back view the source image never shows**. Bench the back panel
first; that is the step most likely to fail. A single front portrait gives the model nothing
for hair-from-behind, a cape, a back print.

## Open questions - Fabio's to settle before the bench

1. **What goes in:** one image only, or several (face + full body + outfit + prop)? The
   multi-image shape is the MPI-815 sheet-builder; one-image is the smaller first step.
2. **Does the prompt still apply** on this path (change the outfit, add a scar), or is it
   "reproduce this character as a sheet" with the prompt optional?
3. **Model:** Krea 2's edit path (`docs/models/krea2/editing.md` - read § "`ref_boost` - measured,
   and why it is not the identity answer" before assuming it holds identity) vs Klein Edit
   (multi-reference). Whichever wins the back-view test, not the prettiest front.
4. **Headless front body:** keep the chained head removal on this path too? Same reason holds
   (one place for a video model to take a face from), so the default is yes.

## Shape of the work

Bench work in the node graph first (the MPI-560 phase-4 rule: Fabio authors, no worker
sub-agent), then wire through `/mpi-add-flow` as either a second input mode on the existing
`character-sheet` Flow or a sibling Flow. Decide that once the bench says whether the graph
diverges.
