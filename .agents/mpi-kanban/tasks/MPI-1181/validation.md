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
