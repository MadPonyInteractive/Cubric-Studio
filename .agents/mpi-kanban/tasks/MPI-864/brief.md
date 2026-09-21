# MPI-864 — Preview art for the fifteen cloud model tiles

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

## Two things to settle before downloading anything

1. **A logo is not what this slot holds anywhere else in the app.** Every local model's tile
   is a SAMPLE OUTPUT of that model, not a brand mark, and the flow tiles MPI-831 just added
   are stills too. Fifteen logos would be the only tiles in the library that advertise a
   company rather than show what you get. **The alternative is one real generation per model
   through the path MPI-851 already ships, which costs about $8.25 in total** ($0.67 for the
   eleven image models, $7.58 for the four dearest clips) and produces art nobody can object
   to. Worth putting to Fabio before spending time sourcing logos.
2. **Trademark, if logos win.** Shipping a vendor's mark inside a commercial product is a
   different permission from using their API. Google, Black Forest Labs and Alibaba all
   publish brand guidelines; check each before bundling, and prefer the vendor's own press
   or brand kit over a scraped favicon.

Note the licence angle is already on file: [[project_model_licences_can_be_territory_restricted]]
records that a model licence can restrict the OUTPUTS, which matters if option 1 is taken.

## Notes

- Sizes and format: match the existing `comfy_workflows/display/*.webp` convention.
- `_paidTileItem` in `MpiModelManager.js` already reads `model.image` / `model.video`; a
  missing file renders the placeholder, so the art can land model by model.
- Downloading files is a step that needs Fabio's explicit go-ahead per file source.
