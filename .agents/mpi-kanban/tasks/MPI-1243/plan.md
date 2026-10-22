# MPI-1243 plan - add MOSS-Image (turbo + SFT) on the FLUX.3 setup

Playbook: `docs/playbooks/add-model/` (enforced by `/mpi-add-model`). Research + bench: MPI-1180.

## Shape (playbook hub § 0, answered 2026-10-22)

1. One card `moss-image`, flat `dependencies[]`, single-stage; Turbo button picks the weight (FLUX.3's
   `Input_is_Turbo` MpiIfElse, already in the raw). ONE graph file for every op, like `flux3_t2i.json`.
2. New `model.type` `moss` -> `03-model-registry.md` consumer sweep (type-keyed maps: layoutBoxes format,
   enhancer recipe, licences, progressStages, priority).
3. No new op: reuses t2i (+ i2i / inpaint / detail / upscale only if benched, Fabio's call). MOSS has no
   reference edit, so `edit` is NOT offered.
4. Enhancer recipe: new `moss-image` recipe + `docs/agent/models/moss-image.md` (MOSS prompts are long
   structured captions; its TextGenerate system prompt is the source). `/create-enhancer-recipe` owns it.

## Steps

1. Graph: copy the proven research raw to `comfy_workflows/raw/moss_t2i_template.json`; VAE A/B
   (`flux2-vae_small` bench vs shipped `vae-flux2`) decides node 15; `generate_moss.py` (prune, bake
   wf_type + Turbo, assert weights; none of FLUX.3's edit helpers); runtime `comfy_workflows/moss_t2i.json`.
2. Deps (`modelDeps.js`): `moss-image-turbo-transformer` 5.41 GB, `moss-image-sft-transformer` 5.41 GB,
   `moss-image-te` (qwen3.5_9b_w4a8_gptq) 7.34 GB; reuse `vae-flux2`. sha256 from the G:/models copies.
   R2 upload ~18.2 GB = Fabio's yes first (money). HF mirrors: OpenMOSS (SFT), toxicdog (turbo).
3. ModelDef in `models.js` (Apache-2.0, no licence gate), `progressStages` counted live, `modelPriority`
   rank, `layoutBoxes` format `moss` in `js/data/layoutBoxes.js` (MOSSImageLayoutPrompt JSON).
4. Agent knowledge (`07-agent-knowledge.md`): recipe + guide, rank note, the three agent tests.
5. Verify (`06-verify.md`): `npm run lint`, `npm test`, parse cross-ref, one generation per op in
   `npm run app:isolated`, Fabio's eye on the outputs.

## Verification

**Verify mode:** user-ux (Fabio judges the images in the app).

## Current State

2026-10-22 (Moss image 3), handoff:
- DONE + committed: VAE A/B (shipped `vae-flux2` = small one, 43 dB PSNR, `research/vae/`); raw
  `comfy_workflows/raw/moss_t2i_template.json` (research raw, VAE swapped) -> `generate_moss.py` (registry `moss_`)
  -> `comfy_workflows/moss_t2i.json` (111 nodes); deps `moss-image-turbo-transformer`, `moss-image-sft-transformer`
  (modelDeps.js), `moss-image-qwen35-9b-clip` (assetDeps.js), sha256 from G:/models, HF mirrors HEAD-verified
  byte-identical; `progressStages` `moss_t2i.json` single 1; box format `moss` (`mossLayoutPrompt` in layoutBoxes.js,
  `withLayoutBoxes(..., size)`, commandExecutor passes Width/Height); `docs/models/moss/README.md`; card image
  `comfy_workflows/display/moss-image.webp` (bench SFT bakery sign, placeholder).
- UNCOMMITTED ON PURPOSE (red without a recipe): `js/data/modelConstants/models.js` (the `moss-image` ModelDef, t2i
  only, type `moss`, FLUX.3 deps list), `modelPriority.js` (IMAGE_ORDER + note), `tests/layout-boxes-moss.test.cjs`.
  With them `npm test` fails ONLY `agent-corpus` + `recipe-registry`: "moss-image resolves to no recipe". Committing
  them red would block every peer's pre-push.
- NEXT: `/create-enhancer-recipe` for MOSS (recipe `moss-image`, `RECIPE_REGISTRY` line, `docs/agent/models/moss-image.md`,
  set `enhanceRecipe: 'moss-image'`), source = the official template's TextGenerate system prompt. Then npm test green,
  commit the three files, then R2 upload (Fabio's yes: ~18.3 GB, ~$0.27/month) and one t2i (+ boxes) run in
  `npm run app:isolated`.

2026-10-22 (Moss image 4):
- DONE + pushed `d2dcca4ad`: ModelDef (`enhanceRecipe: 'moss-image'`), modelPriority rank, moss box test,
  recipe `js/data/recipes/moss-image.recipe.js` (Comfy-Org template system prompt verbatim, MIT, + an adapter
  paragraph), RECIPE_REGISTRY, guide `docs/agent/models/moss-image.md`. npm test + lint green.
- Stage 1 local (12B): 15/15 on the final text after 6 iterations (`docs/recipes/research/moss-image/validation.md`):
  budget 80-300 (prompt says under 250), no-medium = photograph. Committed with the evidence.
- R2: all 3 weights uploaded 04:52-06:29, `rclone lsl` byte-exact vs G:/models, public URL 200 with
  byte-exact Content-Length (browser UA; plain urllib gets 403 from the CDN), no orphan multiparts.
- Recipe twice-green on DeepInfra 26B (sweeps 2 + 3, 15/15 each), ~4.5 c spent on Fabio's yeses. Pushed.
- In-app runs DONE (Turbo sign 13.8 s, SFT sign 32.3 s, Turbo + boxes 9.7 s, all text exact, boxes placed,
  layout JSON checked in ComfyUI history). Fabio: "it looks right". Weights copied G: -> M:/CubricModels.
- NEXT: recipe Stage 2 = press Enhance on MOSS in `npm run app:isolated` (2-3 short ideas, one needing
  lettering), render the enhanced prompts, show Fabio; he decides `draft -> validated`. Then `mpi-end-session`.

2026-10-22 (Moss image 5):
- Recipe Stage 2 DONE: 3 ideas enhanced on the default ComfyUI 4B AND DeepInfra 26B, all 6 rendered on
  MOSS Turbo (record: `docs/recipes/research/moss-image/validation.md` § Stage 2, images `research/stage2/`).
  26B clean; the 4B invents text and skips the medium opening. Isolated app closed.
- NEXT: Fabio's verdict -> if yes, flip the moss-image recipe `draft -> validated`, then `mpi-end-session`.

2026-10-22 (Moss image 6), REOPENED on Fabio's smoke test (card back in doing, status active):
- DONE: i2i/inpaint/detail/upscale ON (ModelDef opInject 2/5/6/7, workflows, tileUpscale, imageSizedOps,
  defaultUpscale; graph unchanged: FLUX.3's branches already ride MOSS's UNET; MOSS ignores the inpaint
  reference latents). `progressStages` moss entry removed. Rank note + guide + README + UNRELEASED updated.
  Benched (validation.md § Ops bench); Fabio passed detail, upscale, i2i in his own app.
- DONE: recipe heal v3 (own "Camera, subject and moment" section + "Before you reply, check" list +
  mood ban), status `draft`, test line updated. Skydiver check 12B: camera 5/5, size 5/5, mood 0/5.
- NEXT: (1) Fabio tests INPAINT in his app. (2) Recipe: the 12B still invents signs 4/5 (vendor's
  "designed image -> write copy" line over-applied) — one more wording pass, re-run
  `node docs/recipes/research/moss-image/skydiver_check.mjs gemma3:12b 5` under gpu_lease (free).
  (3) Stage 1 `npm run recipe:test -- moss-image` local 12B, then DeepInfra 26B twice-green: ASK
  Fabio for the price first (~1.5 c a sweep). (4) Fabio renders the skydiver on v3 and re-validates.
  (5) mpi-end-session: code commit, CI green, close commit alone.

## Completed

Steps 1-3; step 4 recipe + guide (Stage 1 local only).

## Remaining Work

Step 4: DeepInfra twice-green. Step 5: R2 verify, in-app runs, Fabio's eye.

## Plan Drift

2026-10-22 (Moss image 7):
- Fabio passed INPAINT (added a cat): all four ops passed in his app.
- Fabio: signs are WANTED. Recipe v4 drops the sign ban (2 lines). Stage 1 DeepInfra 12B --runs 2: 10/10 pass.
  Ollama is no longer an enhancer target for checks (judge still runs there, hard-wired).
- NEXT: Fabio restarts his app, re-enhances + renders the skydiver on v4 -> verdict draft->validated
  (+ restore the FABIO_VALIDATED line in tests/recipe-registry.test.cjs). Then mpi-end-session.
