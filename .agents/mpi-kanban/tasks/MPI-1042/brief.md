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

- **Face picture required, body picture optional. No outfit picture.**
- **One free-text prompt, added to our baked sheet prompt.** The user asks for whatever they want
  changed or added: body type, haircut, clothes (*"the head of a lady, but a different haircut or
  body type"*). Empty prompt = the model invents the rest, and that is fine: the user reruns until
  the body is right.
- **The editor (MPI-1041) still changes clothes afterwards.** A naked sheet in (from a naked body
  picture, or `character-sheet` on Krea 2 NSFW), then the editor dresses it, one sheet per outfit.
- **Free, no head-swap LoRA.** If a face lands weak, the user fixes it with Head Swap afterwards.

## Shape

- **A new Flow on Klein 9B** (`klein-9b` + `klein-9b-cloud`). The prompt-only `character-sheet`
  Flow on Krea 2 is untouched - no optional images bolted onto it.
- **Inputs:** face (required) + body (optional) + the prompt. One reference ~20 s, two ~30 s on
  Klein (`docs/models/klein/README.md`).
- **Reuse the prompt step of `character-sheet`** (`flowsRegistry.js`, the `kind: 'fields'` step
  "Describe your character": raw text, Enhance, the phrase box) - but NOT its enhancer recipe as
  is. That recipe writes a whole character, face included, and an invented face fights the face
  picture. This Flow needs its own rewrite (the enhancer-override hook documented at
  `flowsRegistry.js:283`) that describes body, hair and clothes only, or Enhance off in v1.
- **Two baked prompts, picked by whether a body picture is there** (Fabio, 2026-10-08). With a
  body: face from Picture 1, body from Picture 2, the user's text on top. Without: face from
  Picture 1, body from the user's text or invented. The user's text is added to whichever runs.
- **The presence check is NEW work.** No Flow branches on a missing optional picture today
  (searched 2026-10-08: no `Input_Has_*` anywhere in `js/`, no presence check in
  `flowService.js`; the `mode: 'upto'` slots of voice-changer and object-stamp are filled in
  practice). Agent pick: the app sets one boolean param from whether the body slot is filled
  (`Input_Has_Body`), and the graph switches the baked prompt AND whether the second
  `ReferenceLatent` chains. A boolean the graph reads already has precedent: `chain.when:
  'Input_Remove_Head'` on `character-sheet`, the `Input_Use_*` toggles in `PromptBoxControls.js`.
  Rejected: two workflow files routed by presence (two graphs to keep in step for one switch).
- **Body picture vs a body in the prompt** (agent pick): the picture wins; the field hint says
  "leave the body picture out to describe a different body".
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
4. **The face picture's hair may beat a prompted haircut.** Klein copies a reference hard. If
   "short bob" loses to the picture's long hair, cut the reference down to the face only (the
   graph already has SAM3 text-select and face-yolov8n) before it reaches Klein.

## Head Swap stays separate

**Head Swap is a paid Flow** (Gumroad, MPI-780 / MPI-781; Klein 9B + BFS head-swap LoRA
`klein-9b-lora-headswap`, `docs/playbooks/add-flow/existing-flows/head-swap.md`). This Flow does
NOT use that LoRA (settled above); Head Swap is the user's fix-up for a weak face.
