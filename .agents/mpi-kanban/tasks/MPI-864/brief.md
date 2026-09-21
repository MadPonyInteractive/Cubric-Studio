# MPI-864 — Preview art for the fifteen cloud model tiles

**Phase 3 of MPI-849** (the paid-cloud-models umbrella). Plan: `.agents/mpi-kanban/tasks/MPI-849/plan.md`.

Fabio, 2026-09-21, on the first screenshot of the finished DeepInfra section: every one of
the fifteen renders a placeholder because no ModelDef carries an `image`/`video`. Asked for
art sourced online, from each vendor's official platform where one exists.

## What ships

An `image:` (or `video:` for the six clip models) filename in each cloud ModelDef, pointing
at `comfy_workflows/display/`, exactly as every local model already does.

The fifteen, by vendor:

- **ByteDance** — Seedream 4, 4.5, 5.0 Pro, Seedance 1.5 Pro, Seedance 2.0
- **Black Forest Labs** — FLUX 2 Dev, Pro, Max
- **Google** — Nano Banana 2 Lite, Nano Banana 2, Nano Banana Pro, Gemini 3 Pro Image,
  Veo 3.1, Veo 3.1 Fast
- **Alibaba** — Wan 3.0

## The route is settled: a published SAMPLE GENERATION, not a logo

Fabio, 2026-09-21: *"Every single one of these models has generations online. Can we not just
pick one up?"* Yes, and it is the right answer for a reason beyond convenience: **every other
tile in this app is a sample output rather than a brand mark.** Every local model's tile is an
image that model made, and the two Flow tiles MPI-831 added are stills. Fifteen logos would be
the only tiles in the library advertising a company instead of showing what you get. Sourcing a
published sample keeps the convention AND skips the trademark question a logo raises.

**A dead end already checked, so nobody checks it twice.** The keyless per-model API carries an
`out_example` field, which looks exactly like the answer and is not: it is a SCHEMA placeholder.
Seedream returns `https://example.com/generated.png`, the Gemini family and FLUX 2 Dev return a
1x1 transparent base64 PNG, and FLUX 2 Pro/Max, both Veos and both Seedances share two stock
paths (`flux_pro_cake.jpg`, `pyramid_sample.mp4`) across unrelated models. Sweeping `txt_docs`,
`doc_blocks`, `short_doc_block` and `description` for any real media URL returns nothing on all
sixteen. **The API has no sample art. It has to come from the web.**

So: DeepInfra's own HTML model page per id, then the vendor's announcement post or Hugging Face
model card. Prefer a sample the vendor published as "this is what it makes", and record the
source URL per model so the provenance is auditable later.

## Still to settle before downloading

1. **Permission, per source.** Downloading a file needs Fabio's explicit go-ahead, and a
   vendor's marketing sample is still third-party content being bundled into a commercial
   product. Note the source URL for each of the fifteen and get one approval covering the set
   rather than fifteen separate asks.
2. **The paid-generation fallback, if a model has no usable published sample.** One real
   generation through the path MPI-851 already ships costs about **$8.25 for all fifteen**
   ($0.67 for the eleven image models, $7.58 for the four dearest clips), and the output is
   unambiguously ours. Worth it for the handful that come up empty rather than shipping a
   placeholder. Note [[project_model_licences_can_be_territory_restricted]]: a model licence
   can restrict the OUTPUTS, so check the licence before using a generated sample as shipped
   art.

## Notes

- Sizes and format: match the existing `comfy_workflows/display/*.webp` convention.
- `_paidTileItem` in `MpiModelManager.js` already reads `model.image` / `model.video`; a
  missing file renders the placeholder, so the art can land model by model.
- Downloading files is a step that needs Fabio's explicit go-ahead per file source.
