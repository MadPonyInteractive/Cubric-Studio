# MPI-1207 brief - custom output size on edit, every model

Asked by Fabio, 2026-10-19, while FLUX.3 Klein (MPI-1181) gained it: "custom size on edit could
possibly be implemented for every single model. That will give users more flexibility and
consistency throughout the app." **The first job is an investigation: is it viable, per model?**
No code before that verdict is written here and Fabio has read it.

## What exists now (MPI-1181)

- The `edit` command carries `ratio` + `qualityTier` in its components and `sizeOptIn: true`.
  `modelShowsRatio()` (`js/data/commandRegistry.js`) shows the picker on a `sizeOptIn` op only for a
  model naming it in `customSizeOps`; PromptBoxControls gates `qualityTier` the same way.
  Today only `flux3-klein` declares `customSizeOps: ['edit']`.
- FLUX.3's graph: `Input_custom_size` -> `custom size AND NOT has_mask` -> picks
  `EmptyFlux2LatentImage(W, H)` over the references' latent. The app always injects
  `Input_custom_size: true` on edit (opInject); a masked edit keeps the source frame in-graph.
- Prompting matters: a bare edit prompt at a new ratio came back pillarboxed; with a
  `TARGET CANVAS: 1:1` first line and "fill the frame" it outpainted cleanly (bench, 2026-10-19).

## Investigate, per edit-capable model

Local: `klein-4b`/`klein-9b` (`kleinEdit`), `krea2`/`krea2-nsfw` (`krea2Edit`), `qwen-image-2-1`
(`edit`), `boogu-edit-*` (`edit`), `qwen-edit` (`qwenEdit`). Cloud (`edit` via DeepInfra):
seedream 4/4.5/5 Pro, FLUX-2 dev/pro/max, Klein 9B cloud, Nano Banana 2 lite/2/pro.

For each, answer:
1. Can the model generate an edit at a frame other than reference 1's? (Latent-from-size node vs
   reference latent; a graph change in ComfyUI by Fabio if needed - agents never script a raw.)
2. Does the result hold up (fills the frame vs pads, stretches or crops)? One bench run per local
   model at a ratio different from the source, under `gpu_lease.py`.
3. Cloud: does the endpoint take a size on edit (`deepinfraSizing.js` already notes edits that
   "arrive with no pixels")? Price per size (the user's money: state it before any paid run).
4. Masked edit: does the model's masked path stay source-sized (crop/stitch), as FLUX.3's does?
5. Prompt needs: does it want a canvas line like FLUX.3, and which enhancer recipe would carry it?

## Done when (phase 1)

A per-model table in `validation.md`: viable / viable with a graph change / not viable, with the
evidence, and Fabio's call on which to wire. Wiring each model is then `customSizeOps` + (where the
graph needs it) an `Input_custom_size` gate, following FLUX.3's pattern.
