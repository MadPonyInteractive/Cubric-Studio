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
- 2026-10-20 Fabio live after Ctrl+R (Remote gemma3 12B, Gemma 4 26B describer): edit Enhance on
  edit_001 now describes the real picture ("gorilla ... seated centrally on the dirt and
  rock-strewn forest floor", pose kept; tiger right side, middle height, sneaking from behind).
  edit_001's sidecar (b388be01) now holds `look` + `lookKind: animal` + `lookName`. Edit Enhance
  sees its pictures: PROVEN. Still the generation voice ("Create a composite image by placing...").
- 2026-10-20 Fabio's edit_017/018 from those prompts: tiger off-box, low, touching the gorilla
  ("rubbing like a friend"). The i2i recipe forbids angle-bracket tokens, so the enhanced text
  never cites `<tigger>`. `research/boxes/citebench.mjs` on his DeepInfra gemma3 12B ($0.00066,
  6 calls): shipped wording cited 0/3; + a "write each PLACEMENT tag once" system exception 3/3.
  BUT `citegen.py` on the G: bench (edit_001, his edit_017 text, his 2 seeds + 111, Turbo): with vs
  without `<tigger>` = no visible difference (`cite_sheet.jpg`); both put the tiger right, beside the
  gorilla. Citation exception NOT shipped (no effect shown). Turbo OFF, same text (`--slow`,
  `slow_sheet.jpg`): tiger fills the box, stalking, head low, 3/3, ~90 s vs ~20 s.
  Fabio's read of the sheets: Turbo 4 pass / 2 fail, Turbo OFF all fail (tiger under the gorilla's
  arm or merely curious) - my "Turbo off is better" was WRONG.
  RETRACTED "bench != app": `replay.py` sent his exact edit_017 graph (from :48188 /history; same
  111 nodes, no non-input diff, staged image sha = edit_001) to the bench -> same picture as his.
  The app's TARGET CANVAS line (custom size 8:5 on an 8:5 source) changes nothing (`canvas_sheet.jpg`).
  `--words` (`words_sheet.jpg`, same 3 seeds): row 1 enhanced text = calm, beside the gorilla;
  row 2 his typed prompt + keep line = 1/3 leaping; row 3 pounce spelled out ("crouched low, body
  coiled, ears flattened, teeth bared, about to leap") = 3/3 snarling and crouched, still beside
  the gorilla rather than behind it. The enhancer's text is the weakest of the three.
- 2026-10-20 Fabio's edit_024 scene (edit_007 tiger + mouse/Velociraptor/lady boxes): both
  creatures go for the mouse. He asked: guide read? skills? upsampler? the abliterated encoder?
  (1) `vlmbench.mjs`: BFL's EXTERNAL-VLM `i2i_bbox` prompt (`bfl_pup_prompts_external_vlm.json`,
  the BFL path for a VLM that sees the picture), the picture attached, his boxes as `from:target`
  rows. DeepInfra has no Gemma 4 12B; gemma-3-12b-it + gemma-4-26B-A4B-it, 3 runs each, $0.0026.
  All 6 wrote paragraph + from/src_bbox/tgt_bbox table; ids kept 4/6 (2 renamed to `mouse_1`...,
  BFL's reconcile maps them back). G4 put the action in the descs ("ready to pounce").
  (2) `vlmgen.py` (Turbo, source size, seeds 3443590830/1386278817/111, `vlm_sheet.jpg`): app's
  edit_024 prompt vs G3 vs G4. All: tiger to the mouse, raptor in its box behind the tiger. G4 =
  raptor looming over the tiger, mouth open, 3/3; the lady topless more often (her desc words).
  (3) BFL's own text encoder `qwen3vl_4b_int8_convrot` (4.86 GB, ungated mirror, now in
  G:/CubricModels/text_encoders, bench only): `--clip`, A and G4 (`te_sheet.jpg`): same
  compositions per seed; only clothing shifts (more bras with BFL's). The encoder is NOT the lever.
  Fabio's read: ALL fail; it is the model's capability. DECISION: no seeing-enhancer for box edits,
  no model switch; the user adjusts boxes and wording. Recorded in `docs/models/flux3/README.md`.
- 2026-10-20 Stale enhancement after a box change: the "boxes changed" note lived ONLY inside the
  Enhance dialog, so Fabio never saw it; a t2i enhancement's own table ran the OLD boxes
  (`withLayoutBoxes` keeps an enhanced table) and an edit's words described the old layout
  (his edit_026: the shrunk raptor box sent, the stale words won). Fabio: a box change invalidates
  the enhancement, like a prompt edit. `MpiPromptBox._dropIfBoxesMoved` on the panel's onChange
  and at `getRunPayload`; NOT in `_syncEnhancedState` (Reuse injects the prompt before it restores
  the boxes), so Reuse carries the card's `Layout_Boxes` in `enhanced.boxes` (`promptReuse.js`).
  The dialog-only note is gone. `flux3-boxes` 13/13, `enhance-overlay` 19/19, lint clean.
  Not checked: the live click-through (Fabio). `npm test` 3465: 3463 pass, 0 fail, 2 skipped.
- 2026-10-20 Card image: Fabio's 4:5 crop (`Pictures/Screenshots/crop_001.png`, tiger + mouse) ->
  `comfy_workflows/display/flux3-klein.webp` 704x880 q90 194 KB (was a teapot placeholder).
- 2026-10-20 Cosmo / MCP readiness audit (Explore sub-agent, spot-checked agentLoop:115 + 2394):
  Turbo + 10 refs YES both. Cosmo BROKEN: `qualityTier` enum (agentLoop:115) excludes 1k/2k/4k;
  ratio auto-fill (agentLoop:2394) forces Custom size on every FLUX.3 edit. agentLoop.mjs is held by
  "Cosmo improvements 4" (MPI-1208 claim) -> messaged them both fixes. Boxes: no named param;
  Cosmo cannot send them; HTTP/MCP only via undeclared raw `injectionParams.Layout_Boxes`.
  Guide `docs/agent/models/flux-3.md` stale lines fixed (tiers incl. custom-size edit; the
  "not yet handled" bars line). `agent-corpus` test passes.
- 2026-10-20 Box-change drop: Fabio live click-through PASSED ("as soon as I move the box, the
  prompt enhancement button indicates that it is no longer enhanced").
- 2026-10-20 Cosmo FLUX.3 bugs: fixed by "Cosmo improvements 4" in a836a4334 (qualityTier enum dropped;
  ratio snap skipped where namedParamsFor says customSize). Their regression test is in agent-loop.test.cjs.
- 2026-10-20 Named `boxes` param: namedParamsFor advertises `boxes: true` on FLUX.3 t2i/edit;
  resolveNamedParams validates [{name,x,y,w,h,desc}] fractions and injects Layout_Boxes, asked only
  (INVALID_BOXES otherwise); NAMED_PARAM_KEYS, agentDispatch named, agentLoop schema + _SENT_KEYS (+_sentNote
  prints objects as JSON), MCP schema. Tool schemas +173 B, budget 16,294. Guide `flux-3.md` § Boxes.
  flux3-boxes 13/13 (new: agents send boxes by name), npm test 3467: 3465 pass, 0 fail, 2 skipped; lint clean.
  Not checked: a live Cosmo/MCP run with boxes (GPU; Fabio's go).
- 2026-10-20 Slide-over clip: comfy_workflows/display/flux3-klein.mp4, 960x600 H.264 24 fps 7.8 s 1.0 MB,
  crossfades tiger (edit_007) -> boxes screenshot -> result (edit_029) -> back to tiger for a seamless loop
  (Fabio: plain fades, no drawn boxes). ModelDef `video:`; MpiModelManager now plays `model.video` on an
  image model too (was video models only). Frames checked on a contact strip. Not checked: in the app.
- 2026-10-20 Keep line (Fabio: yes): a typed box edit with no keep clause gets "Keep everything else in the picture
  exactly the same." before the table (`withLayoutBoxes`, `KEEP_CLAUSE` English keyword match). flux3-boxes 13/13, npm test 3465/0.
- 2026-10-20 Cosmo sees the panel boxes (Fabio asked a FLUX.3 t2i "I have already drawn some boxes"; Cosmo could
  not see them). agentService._boxesForTurn sends the selected model's saved per-op boxes in the turn workspace;
  routes/agent._cleanBoxes clamps them; agentLoop App state line lists them (unpinned: pass as `boxes`; pinned:
  they run on their own, resolveNamedParams falls back to getOpSettings(...).boxes when a project is passed).
  Tests: agent-loop "drawn boxes", flux3-boxes 13/13; npm test 3468: 3466 pass, 0 fail. Not checked live: needs an
  app RESTART (server code), then Fabio asks Cosmo again.
- 2026-10-20 LIVE Cosmo t2i with panel boxes (after restart): card e1d046ee sidecar holds the panel's exact boxes
  (people/ufo), so the route works. Two misses: Cosmo ran 16:9 (Fabio drew at 8:5: fractions stretch), and his prompt
  (each person's clothes, camera "slightly behind and below") drew the people ~3x the box. Fix: turn sends the
  panel ratio (_boxesForTurn ratio, route regex-checked), App state line says "send ratio X" + "write the prompt at
  that size"; guide flux-3.md Boxes gets the size + ratio bullets. agent-loop "drawn boxes" extended; npm test
  3468: 3466 pass, 0 fail. Not checked live: needs a restart + Cosmo rerun.
- 2026-10-20 LIVE rerun after restart (Fabio set the panel to 5:4, 2k; agent model MiMo-V2.6-Flash, not DeepSeek):
  sidecar Ratio_Label 5:4 1600x1280 = panel ratio, panel boxes, prompt "small distant figures ... no faces visible".
  People inside their box, poses read as distress (Fabio). Not re-run on DeepSeek V4 Flash.
