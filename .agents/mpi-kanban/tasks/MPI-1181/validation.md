# MPI-1181 validation

## 2026-10-19 - wiring (session "Flux.3 integration 5")

Runtime graph `comfy_workflows/flux3_t2i.json` (generate_flux3.py from the raw; 111 nodes, upload
slots blank, wf_type 1, Turbo true) run on the bench ComfyUI 0.42.1 with only the app's injections,
`scratchpad/runops.py`, under gpu_lease:

| case | result | wall |
|---|---|---|
| t2i Turbo 1024x1024 | success, teapot | 12 s |
| t2i base 1024x1024 | success, visibly different (UNET switch works) | 48 s |
| edit Turbo, 1 ref, custom size off | success, top recoloured, rest intact, source 571x1021 | 21 s |
| edit Turbo, custom size on, 1024x1024 | success at 1024x1024; pillarboxed with a bare prompt, fills the frame with a `TARGET CANVAS: 1:1` line | 21 s |
| i2i Turbo 768x1344 denoise 0.6 | success | 12 s |
| upscale Turbo x1.5 | success, 840x1512 | 12 s |
| card image, base 896x1088 | success -> display/flux3-klein.webp (placeholder) | 45 s |

Not run on the runtime file: inpaint, detail (need a mask; Fabio benched both in this exact graph,
and the generator only prunes/bakes defaults - prune keeps every branch upstream of Output_Image).

`npm test`: first run 3423/3429, 4 fails all from this change (pinned rank order; a comment
containing "motion" inside the H3 hint slice) - fixed. Re-run: see below.

Not done yet: in-app run per op (the app engine reads G:/CubricModels, 8.7 GB free, weights sit in
C:/AI), R2 upload (needs Fabio's yes), agent guide (comes with the flux-3 recipe), progressStages
count, Boxes, Pod smoke.

## 2026-10-19 - Custom size button (session "Flux.3 integration 6")

Fabio's in-app ask: the edit size picker behind a button, off by default. `customSize` control
(perOp, injects `Input_custom_size`), `Input_custom_size` out of `opInject.edit`, MpiPromptBox
parks ratio + qualityTier (hidden + not injected) while off; agent `resolveNamedParams`: a named
ratio/tier turns it on, else the project's button, else off with no Width/Height.

- `tests/flux3-custom-size.test.cjs` 6/6; `npm test` 3433 pass / 0 fail / 2 skipped.
- `tests/desktop/prompt-box-custom-size.spec.js` (real Electron, own port) pass: off = no Width,
  `Input_custom_size: false`, picker hidden; on = Width + true, shown; off again = parked.
  Neighbours prompt-box-use-tiles / badge / start-frame-toggle: 4/4 pass.
- Fabio in his own app, 2026-10-19: "It looks great" (Turbo + Custom size buttons in the edit
  popup, 1K/2K/4K + ratio shown when on). Copying it to every other edit model is MPI-1207, not here.

## 2026-10-20 - R2 upload of both transformers

`rclone copyto` from C:/AI/diffusion_models, serial, `--bwlimit 3M`, `--s3-no-check-bucket`: both exit 0,
0 ERROR lines, rclone's own post-upload checksum passed. `rclone lsl cubric-models/vision/models/diffusion_models/`:
`flux3-image-klein-int8-convrot.safetensors` 5827874779 B, `flux3-image-klein-base-int8-convrot.safetensors`
5807427339 B = the local files byte for byte. URLs = the dep entries' `url` (`models.cubric.studio/vision/models/<filename>`).

## 2026-10-20 - flux-3 recipe (draft), Stage 1 NOT RUN YET

`js/data/recipes/flux-3.recipe.js`: `t2v` = BFL `pup_prompts.json` t2i verbatim; `i2i` = BFL
`pup_prompts_external_vlm.json` i2i verbatim + one adapter sentence. `tests/flux3-recipe.test.cjs` 3/3,
recipe-registry, agent-corpus, agent-prompt-budget green. `npm test` 3443/3447 before the guide's price
wording fix (the 2 fails were that line), corpus tests green after it. The Stage 1 sweep was queued under
the GPU lease behind MPI-1207's bench and cancelled for the handoff: nothing ran.

## 2026-10-20 - Stage 1 sweep + Enhance wiring (session "Flux.3 integration 7")

- Stage 1 (12B probe, gemma3:12b judge, 3 runs, under gpu_lease): sweep 1 t2v 11/15, i2i 12/15; three
  fixes (t2v adapter paragraph, BFL upsampler scope-opener sentence on i2i, harness scope regex); sweep 2
  t2v 14/15 (one "is visible"), i2i 13/15 then `--tier whole` 3/3. Record: `docs/recipes/research/flux-3/validation.md`.
  DeepInfra 26B count NOT run (needs Fabio's yes, ~6 cents for 4 sweeps).
- `flux3-klein` -> `enhanceRecipe: 'flux-3'` (Cosmo's flux-3.md guide now routes); new ModelDef
  `enhanceFirstOps` (t2i/i2i/edit/inpaint/detail): `opAllowsEnhance(op, model)` shows Enhance on FLUX.3
  edit + inpaint only, every other model's edits stay exempt; `getOpHelp` appends "press Enhance ... then Cue".
- `tests/enhance-control.test.cjs` 8/8 (new: FLUX.3 lift, Klein still exempt, help line); `tests/flux3-recipe.test.cjs` 3/3;
  `npm test` 3446 pass / 0 fail / 2 skipped. Not seen in the real app yet.

## 2026-10-20 - DeepInfra count stopped by Fabio; canvas line on (session "Flux.3 integration 7")

- DeepInfra Gemma 4 26B, 8 sweeps (~12 cents, two yeses of 4): t2v 15/15 on the last, i2i 14/15 (one
  151-word whole-image edit). One BFL sentence restated (its ban quoted "is visible"). Fabio: "Good
  enough: a 1-word overrun is harmless. Stop sweeping." Detail: `docs/recipes/research/flux-3/validation.md`.
- `canvasPrompt: true` on flux3-klein: the executor prepends withCanvasPrompt's TARGET CANVAS line on a
  custom-size, unmasked edit. Bench on the shipped graph (G:/ComfyUi :8188, Turbo, portrait 571x1021
  source, seed 424242, under gpu_lease) with the helper's exact text: 1:1 and 16:9 both fill edge to
  edge, no bars; the earlier bare 1:1 pillarboxed (2026-10-19). `tests/flux3-custom-size.test.cjs` 9/9;
  `npm test` 3446 pass / 0 fail / 2 skipped.

## 2026-10-20 - Boxes steer the local model (session "Flux.3 integration 8")

Shipped runtime graph `comfy_workflows/flux3_t2i.json`, bench G:/ComfyUi 0.42.1, Turbo, seed 424242,
under gpu_lease; the box table appended to the prompt exactly as `Flux3LayoutPrompt` does
(`research/boxes/boxbench.py`, sheets `research/boxes/sheet_t2i.jpg`, `sheet_edit.jpg`):

- t2i 1344x768 "meadow <obj_1>, red fox <obj_2>, blue bicycle <obj_3>": with no table the fox and bike sit
  wherever; with the table each lands inside its box, and swapping the boxes swaps them (12 s each).
- edit "Add a black cat <obj_1>", one ref: the cat lands in the box top-left and bottom-right, the rest
  of the photo untouched (21 s each). The simple `{id,bbox,desc}` row and BFL's edit row
  (`from: "target"`, `tgt_bbox`) land the same, so v1 sends the simple row on every op (Fabio's pick 1).

## 2026-10-20 - Boxes built (session "Flux.3 integration 8")

- Uncited boxes steer an edit too (`research/boxes/sheet_uncited.jpg`): the edit Enhance (blind to the
  pictures, so no BFL i2i_bbox) writes the instruction and the app appends the table.
- Box-mode Enhance probe (local 12B, think off) -> caption citing <obj_1>/<obj_2>, coordinates kept,
  rendered on the bench with each subject in its box (`sheet_enhanced.jpg`, `enhanced_box_prompt.txt`).
- In my isolated app (scratch project "Boxes test"): Boxes button on every FLUX.3 op, greyed with its
  reason on i2i; dialog draws, moves by tag, resizes by corner, draws inside a full-frame box; the
  row text + `<obj_1>` cite reach the prompt; the run payload carries `Layout_Boxes`; saved per op;
  edit frame = the staged picture at its own shape.
- `tests/flux3-boxes.test.cjs` 7/7, `tests/flux3-recipe.test.cjs` + registry green; `npm test` 3454 pass,
  0 fail, 2 skipped. Lint clean.
- Fixed on the way: an edit Enhance ran the r2v picture-lines step and prefixed tag lines to the
  instruction; now r2v only (`llmService.enhance`).
- Not done: a real in-app generation (the app engine has no FLUX.3 weights; benched on G:/ComfyUi
  instead), Fabio's eye check of the dialog, a DeepInfra count of `t2v_bbox`.

## Boxes UI rework (2026-10-20, Fabio's eye check of the modal)

- MpiBoxesDialog -> MpiBoxesPanel: slides up from behind the PromptBox on the Boxes button, down on
  the next press or its X; no backdrop. Live in my isolated app ("Boxes test"): op strip + media chips
  ride on its top edge; prompt typing, ratio picker and Custom size work while open and the frame
  follows (1:1 -> 9:16 -> 1:1 measured); edit shows picture 1, centred `contain` in the ratio with
  Custom size on; Darken 76% -> `brightness(0.24)`; placeholder "What happens here" on edit, "What goes
  here" on t2i; Add box removed, Clear all added (empties the run payload's `Layout_Boxes`).
- Named boxes: drawing opens the rename (typed "big cat" -> `big_cat`), name click cites `<big_cat>`,
  double-click on the frame tag renames to `cat` and the prompt became `<cat>`. Empty desc -> the name.
- Reuse: a run whose project copy lagged (300 ms save) or an agent dispatch recorded the PROJECT's
  boxes - the control only injected non-empty, mounted. Now always injects; test proves sidecar ->
  `buildPromptReuseSettings` returns the run's named boxes.
- `tests/flux3-boxes.test.cjs` 9/9; `npm test` 3458, 1 fail (`cloud-price-tag` source-shape pin on my
  listener edit) fixed and rerun 13/13; lint clean.
- Not checked: whether FLUX.3 fills or rescales around a centred picture with Custom size (needs a
  bench render); Fabio's eye check of the panel.

## Boxes round 2 (2026-10-20, Fabio's in-app test)

- Fabio: panel "looks good, seems to work fine". His empty-prompt edit (cat box "a cute cat looking at
  the gorilla", nothing in the main prompt) DID add a cat in the box; not looking at the gorilla.
- Bug (Fabio): panel followed him gallery -> history and vanished on return. Root cause: button,
  panel and open flag lived on the `boxes` REGISTRY entry, one object shared by every prompt box.
  Fix (his design): `boxes` control is data-only (value/setValue/injection); MpiPromptBox owns its
  own Boxes toggle on the bar beside the cog (icon + count, hidden where the op takes no boxes) and
  its own panel; the panel survives an op switch, dies with the box. Live in my app: t2i shows
  count 2, i2i hides the button, edit shows it; gallery open -> history = closed/off; open in
  history -> back to gallery = closed/off. Rows widened 340 -> 430 px.
- `npm test` 3458: 3456 pass, 0 fail, 2 skipped; lint clean.
- Zoom/colour (Fabio): NOT the graph resize - edit_001 -> edit_005 -> edit_006 are all 1280x800 in and
  out with custom size off. Bench replays (`research/boxes/zoombench.py`, `zoom_sheet.jpg`,
  `zoom_sheet2.jpg`): edit_005 + "Orange cat" box, empty prompt vs "Keep everything else identical",
  seeds 111/222 and his recorded 2686832702 - framing held in ALL, and his own edit_006 matches
  edit_005's framing. His visible zoom is edit_001 -> edit_005 (first box edit, empty prompt): not
  reproduced yet. Also: on the bench the desc "Orange cat" did NOT recolour at his seed (app did).

## Boxes round 3 (2026-10-20, Fabio's second in-app test)

- Fabio: bar toggle, gallery <-> history round trip and wider rows all pass. Approved both proposals.
- Bug (Fabio, edit_007): edit_001 + a `Tiger` box "Sneaking Tiger", EMPTY prompt -> a new picture,
  gorilla gone (environment kept). Cause: with only the table the model has no edit instruction.
  Fix: `withLayoutBoxes(..., operation)` writes `In <Tiger>: Sneaking Tiger. Keep everything else in
  the picture exactly the same.` when an edit's prompt is empty. Bench (`research/boxes/tigerbench.py`,
  `tiger_sheet.jpg`, `tiger_sheet2.jpg`, his seed 1221865106 + 111/222/333): empty lost the gorilla on
  2 of 4 (his seed reproduced) and zoomed on 111; the written line kept the gorilla 4 of 4, tiger
  peeking from behind it; framing shifted on 222, a gorilla-tiger blend on 111. `Add <Tiger>:` wording
  drew no tiger at his seed and printed "Tiger: Sneaking Tiger" as text at 111 -> rejected.
- `@` picker lists boxes after the references, NAME ONLY (Fabio: the desc showed too; removed).
  Live in my isolated page: `@T` -> Tiger and tree rows, Enter wrote `<Tiger> `, a `<b>` in a desc
  showed as plain text.
- `tests/flux3-boxes.test.cjs` 10/10; `npm test` 3459: 3457 pass, 0 fail, 2 skipped; lint clean.
- Not checked: Fabio's eye check of the `@` list; the zoom is rarer with the written line, not gone.
- edit_008 (typed prompt "the <tigger> is sneaking from behind the gorilla...", box on the RIGHT, custom
  size 1280x800): tiger landed LEFT. Bench (`e008bench.py`, `e008_sheet.jpg`, his seed 3824626108 +
  111/222): his prompt alone recomposed the gorilla 3 of 3, tiger off-box; + "Keep everything else in
  the picture exactly the same." kept the gorilla 3 of 3, tiger in the box 3 of 3 (two tigers once).
  Fabio then landed a good one in-app by typing "Do not change anything in the picture. Simply add the
  tiger..." himself (2 of his 3 runs had a SECOND tiger). Open: app appends the keep line on box edits?
- Keep line downside (`keepbench.py`, `keep_sheet.jpg`, seeds 3824626108/111): "Make it night time" +
  keep line still went night 2 of 2 (no block); "one tiger" alone recomposed + off-box, + keep line one
  tiger in the box, gorilla kept 2 of 2.
- Enhance bug (Fabio): his enhanced edit prompt said "similar ... to the tiger described in the first
  image" - no tiger picture exists. Backend = the engine's Qwen3-VL 4B (Ollama off). Cause: the edit
  (i2i) request carried BFL's t2i_bbox header "LOCKED ... preserve every supplied identity, provenance
  value" + raw coordinates. Bench (`enhbench.mjs`, `enhbench.txt`, i2i system prompt + a hand-written
  gorilla caption, 3 seeds each): A (today) invented "the Bengal tiger from the first image" 3/3;
  B (plain coordinates header) 0/3 but leaked "[8,736,793,1000]" once and put it lower-LEFT once;
  C (words, no "not in the pictures") 3/3 invented again; D 0/3, leaked "marked region"; E
  (`PLACEMENT ... the attached images do not show it` + `<id>: desc, on the right of the frame, at
  middle height.`) 0/3, imperative "Place a Bengal tiger on the right side...", gorilla kept 3/3.
  Shipped E as `editPlacementInput` (t2i keeps BFL `t2v_bbox` + `upsamplingInput`); string proven
  identical to the bench's. `npm test` 3460: 3458 pass, 0 fail, 2 skipped; lint clean.
- Not checked: E's prompt rendered through FLUX.3 in-app (Fabio).
- CORRECTION: Fabio's backends are Remote (DeepInfra) for both: enhancer gemma3 12B, describer Gemma 4
  26B. Code follows both picks (`enhance()` / `describeImage` -> `runnableBackend(<pref>)`); my "4B"
  was a guess. Second cause found: the prompt box passed `pictures` only from TAGGED slots
  (`_stagedRefTags`), and edit's slots carry no tag, so every FLUX.3 edit Enhance went out with NO
  picture description while the i2i system prompt promises them - the box desc was the only "image"
  text. Fix: untagged ops send their role-assigned images by load order (`Image 1`...). LTX's
  `seesPictures` is r2v only (tagged), unchanged. Live in my isolated page: FLUX.3 edit + a staged
  picture -> the dialog got `pictures: [{tag:'Image 1', url}]` (was `[]`). `npm test` 3458/0/2.

