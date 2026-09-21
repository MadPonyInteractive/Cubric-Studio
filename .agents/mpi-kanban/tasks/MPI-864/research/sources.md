# MPI-864 — the fifteen sources

2026-09-21. One uniform source found: **DeepInfra hosts its own cover art per model** on
`shared.deepinfra.com`, and for every one of the fifteen it is a sample generation, not a logo.
Three models additionally host a `sample_output.*`.

This is NOT the `out_example` field the brief already ruled out — that is a schema placeholder in
the keyless JSON API. These are files linked from the model's own HTML page at
`https://deepinfra.com/<endpointId>`, which is where a customer is shown what the model makes.

## The ten image models — all sourced

| Model | File | Source |
|---|---|---|
| Seedream 4 | `cover_image.480f1543….webp` | https://deepinfra.com/ByteDance/Seedream-4 |
| Seedream 4.5 | `cover_image.633808cb….webp` | https://deepinfra.com/ByteDance/Seedream-4.5 |
| Seedream 5.0 Pro | `cover_image.925057d2….webp` | https://deepinfra.com/ByteDance/Seedream-5.0-Pro |
| FLUX 2 Dev | `cover_image.97fe66df….webp` | https://deepinfra.com/black-forest-labs/FLUX-2-dev |
| FLUX 2 Pro | `cover_image.507c610a….webp` | https://deepinfra.com/black-forest-labs/FLUX-2-pro |
| FLUX 2 Max | `cover_image.e62a7556….webp` | https://deepinfra.com/black-forest-labs/FLUX-2-max |
| Nano Banana 2 Lite | `cover_image.a39e8c50….webp` | https://deepinfra.com/google/nano-banana-2-lite |
| Nano Banana 2 | `cover_image.d6d3cadd….webp` | https://deepinfra.com/google/nano-banana-2 |
| Nano Banana Pro | `cover_image.0d2a5d51….webp` | https://deepinfra.com/google/nano-banana-pro |
| Gemini 3 Pro Image | `cover_image.ce46365e….webp` | https://deepinfra.com/google/gemini-3-pro-image |

Full URLs in `sources.json` beside this file; the candidates are staged in the session
scratchpad, NOT in the repo, until Fabio approves.

## Three findings that change which file gets picked

1. **Two near-duplicate pairs.** Seedream 4's cover and Seedream 4.5's `sample_output` are the
   same train-into-a-black-hole shot; Nano Banana 2's `sample_output` and Gemini 3 Pro Image's
   cover are the same Eiffel-Tower-fireworks shot. Taking the **cover** for all ten avoids both
   collisions — 4.5 then shows a mermaid, Nano Banana 2 a banana on a table.
2. **Three of the ten carry a brand mark inside the picture**: Nano Banana 2 Lite (a Pixel with
   the `G` logo), Nano Banana Pro (a device with `NANO BANANA PRO` on it), Seedream 5.0 Pro (a
   chalkboard reading `SEEDREAM COFFEE`). The brief chose samples over logos partly to skip the
   trademark question; these three bring a piece of it back in.
3. **The video row has no motion to show.** All five clip models have a still cover only; the
   ONLY clip DeepInfra hosts is `sample_output.…mp4` for Veo 3.1 Fast. Vendor sample clips are
   not on the DeepInfra page for any of the other four.

## The video gap — a decision, not a search result

The brief says "six clip models". It is **five**: `seedance-15-pro`, `seedance-2`, `wan3`,
`veo-31-fast`, `veo-31` are the only `mediaType: 'video'` entries of the fifteen.

`MpiModelManager.js:755` reads `model.video` for a video model and `model.image` for an image
one — there is no fallback, so a still cannot fill a video tile as the code stands. Options:

- **A** — hunt vendor clips (ByteDance / Wan-AI / Google announcement posts). Free, uncertain.
- **B** — generate the four missing clips on the user's own key. Real, unambiguously ours, and
  the dearest part of the brief's $8.25 estimate. Fabio's prepaid balance was $2.26.
- **C** — a one-line fallback so a video tile falls back to `model.image`, and ship the five
  stills. Cheapest; costs the hover-play that every local video model has.

## 2026-09-21, Fabio's review of the fifteen

Approved the set, with two swaps he called himself. Both generated on the model whose tile
they fill, 4:5, into the `Deepinfra model tests` project — so the tile is that model's own
output, which is the convention the brief set out to keep.

| Tile | Card | Why |
|---|---|---|
| Gemini 3 Pro Image | `t2i_004` — an enamel sign reading `Gemini 3` | Its cover collided with Nano Banana 2's `sample_output`, and the ModelDef comment says the two models are the SAME model under two names. A sign naming itself is the one thing that tells them apart. |
| Nano Banana 2 | `t2i_003` — a banana lit as a luxury product | Fabio asked for a different banana-type image. |

**Billed, from the sidecars' `generationSettings.cost.usd`:** $0.137566 + $0.0672285 +
$0.13777 = **$0.3426** over three runs. The first Gemini attempt (`t2i_002`) framed the sign
so the `3` fell off the right edge, hence three runs for two pictures.

**Decided against spending on the video clips** — Fabio, 2026-09-21: "Do not spend $7."
He will look for the four missing clips on the vendors' own sites himself.

## Two things found while doing it

1. **`guard-gpu` blocks a CLOUD generation.** It matches on `/connector/generate` and cannot
   see that a `provider` model never touches the GPU. Taking the lease anyway is correct and
   cheap — noting it so nobody reads the block as "the app is using the GPU for this".
2. **Every DeepInfra cover is 768x768 square; every existing `comfy_workflows/display/*.webp`
   is 4:5 portrait** (896x1088, 944x1136, 512x640). Thirteen square tiles in a portrait grid
   is a look decision, not a bug — crop to 4:5 or leave them square, but decide once.

