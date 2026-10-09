# Krea2 — upscaling (MPI-350)

The `upscale` op is **branch 7 of the master template** since MPI-365:
`krea2_t2i_template.json` → `krea2_t2i_<sfw|nsfw>.json`, selected by `Input_wf_type: 7`.
Read this before re-tuning the upscaler or adding another pass to it.

> **The standalone `krea2_upscaler_*` files are DELETED.** Everything below still
> describes the live chain — the nodes moved into the master graph unchanged — but they
> now sit alongside the other five ops' branches rather than in a file of their own, and
> ComfyUI's lazy evaluation prunes them on any other op. Node ids below are from the old
> standalone file and will NOT match the master graph; find nodes by title.
>
> Two consequences of the move worth knowing:
> * The **style rack now reaches this op** (`styleOps` includes `upscale`). The old
>   standalone file had no rack at all.
> * `progressStages` no longer records a `single` total for Krea2 — one file, six ops,
>   different bar counts. The `postTile: 1` entry below survives on the `krea2_t2i.json`
>   key, because `phaseProgress` only reads it once tile mode is entered.

## Shape

Two paths, switched by `Input_Tile_Upscale` (MPI-1038, the prompt box's **Use Tiles**)
through `MpiBooleanInvert` → `MpiIfElse` into the `upscale` reroute. MpiIfElse is lazy, so
only the chosen path runs.

```
Grid  (off): Input_Image → ResizeImageMaskNode (÷16) → UltimateSDUpscale ──┐
Tiles (on):  Get_img1 → ImageScaleBy lanczos × Input_Upscale_Factor        ├→ upscale
             → ImpactMakeTileSEGS 1024 / 1.5 / 200 / 30 / 0.7 "Reuse fast" │
             → DetailerForEachPipe (guide 1024 bbox, max 1536) ────────────┘
```

**Tiles** is a copy of this graph's own Detailer group (same Get nodes → ToBasicPipe, turbo
model switch, `3 if turbo else 16` steps, `1.0 if turbo else 1.5` cfg, euler/beta,
`Input_denoise`), with MaskDetailer swapped for the tile nodes. Fixed 1024 tiles, so the
count grows with the picture (`js/utils/tileCount.js` ports the node's maths for the
prompt box label: 1920×1080 ×2 = 15 tiles, 4000×6000 ×2 = 150). Cloud masks blend the
tiles, so no seam shows. Factor 1.0 = detail only (offered only with tiles on). **No
resize-to-multiple** on this path: the detailer resizes each crop itself, and a
whole-picture resize would only stretch it and break output = input × factor.

**Grid** splits at most 9 ways (`MpiGridDimensions`, each ≤768 source px) with seam fix
off, so it seams, and a big photo gets 9 huge tiles. Kept beside Tiles by Fabio's call.

## The refiner (REMOVED 2026-10-09)

The UltimateSDUpscale pass used to feed a 2-step ClownsharK refiner. Its VAEDecode had
been wired to nothing for a while, so it never ran; Fabio's MPI-1038 edit deleted the
dead chain. The history below explains why it was added.

## Why the refiner existed — it was a FIX, not a flourish

Before it, a single UltimateSDUpscale pass at cfg 2 produced heavy noise: unusable
at full quality, mediocre on turbo. Two things were wrong at once, and both had to
change:

1. **The accelerator LoRA was applied in BOTH tiers**, so "full quality" never
   actually ran at full quality.
2. **Nothing cleaned up after the tiled pass.** A short low-denoise pass over the
   whole frame puts the texture back — the same shape as the t2i graph's 3-step
   refiner (see [samplers.md](samplers.md)).

## The tier gate

`1697 Input_Tier` → `1700 MpiMath ("a == 1")` → `1711 MpiIfElse ("is high tier")`,
whose output feeds `1686 UltimateSDUpscale.model`:

| tier | turbo | branch | model on the tiles |
|---|---|---|---|
| 1 | OFF | true → `1685 FromBasicPipe` | base, **no accelerator LoRA** |
| 2 | ON | false → `1706 MpiLoraModel` | accelerator LoRA |

`1706` chains off `1680 Input_Lora_6`, so user LoRA slots stay upstream of it.

**The refiner takes its model from `1706` in BOTH tiers — deliberate.** High tier
gets a full-quality tiled pass followed by a cheap 2-step distilled polish, not a
full-quality refine. Do not "fix" this by routing the refiner through `1711`.

## Traps

- **Prompt applies PER TILE.** With `Use Grid` or `Use Tiles` on, every tile is sampled with the
  full positive prompt at the current denoise, so a scene prompt ("two women on a
  ship") renders the whole scene *in each tile*. Grid upscaling wants an empty or
  generic prompt. Live-confirmed on a 4×2 grid.
- **Tile count is a runtime value.** `1639 MpiGridDimensions` derives tile size from
  the image × `Grid_H`/`Grid_V` × `Input_Upscale_Factor`, so the count scales with
  input size, factor and the Use Grid toggle. Never record a static stage total for
  this graph — see [../../generation-lifecycle.md](../../generation-lifecycle.md)
  for `postTile` and the T+1 tile-tick trap.
  The Tiles path is the same: its count follows the OUTPUT size, so a big photo is
  150+ detailer steps (the `DETAILING · 0%` status sat still deep into a Flow run - unchecked).
- **`Grid_H` / `Grid_V` (1604/1605) are NOT injectable** — no `Input_` prefix, fixed
  at 1. Only `Input_Auto_Grid` varies the split.
- **Injection surface is 16** (`Input_*` / `Output_*`) and did not change when the
  refiner landed. The node ids that moved (`1701` → `1706`) are referenced nowhere
  in `js/` — injection is title-keyed.

## Verified

Live, both tiers, 2026-07-25: 768×1344 at factor 1.5 → 1152×2016 with `Use Grid` on
(2 tiles). Turbo and non-turbo both accepted by the user in a side-by-side compare.
The tier-1 branch had never been exercised before this — every earlier upscale
sidecar recorded `Input_Tier: 2`.
