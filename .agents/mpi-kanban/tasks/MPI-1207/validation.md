# MPI-1207 validation - phase 1: is custom size on edit viable, per model?

Session 2026-10-19. Investigation only: no app code, no shipped graph touched.

## The template: FLUX.3 Klein (MPI-1181)

`flux3_t2i.json`, edit sampler `699`: `latent_image` <- `703 MpiIfElse`
(true: `700 EmptyFlux2LatentImage(Input_Width, Input_Height)`, false: `694` the references' latent),
boolean <- `798 MpiBooleanCompare a_true_b_false (Input_custom_size, Input_Mask has-mask)`.
So a masked edit always keeps the source frame: the mask path crops 1024-ish round the mask
(`InpaintCropImproved` -> stitch), and that crop runs through the SAME edit sampler, so the gate
MUST include "not masked". The app injects `Input_custom_size: true` on every edit (opInject).

Every local graph below has the same shape problem: the masked edit's crop goes through the edit
sampler too (Klein: `592` -> `167` -> `163` -> `185`; Krea2: `594` -> `573` -> `572`; Boogu:
`226` -> `196` -> `232`; Qwen Edit: `256` -> `207` -> `215`), so each needs the full
`custom AND NOT masked` gate, never a bare `custom` switch.

## Per model: where the edit frame comes from today, and the change

| model | graph, edit branch | frame source today | change (Fabio, in ComfyUI) |
|---|---|---|---|
| Klein 4B / 9B (`kleinEdit`) | `klein_t2i.json` / `klein_9b_t2i.json`, wf 4, sampler `185` | `163 VAEEncode(ref 1 @ 1 MP)` | IfElse(`EmptyFlux2LatentImage(W,H)`, `163`, gate) into `185.latent_image`, AND the same switch on `173 Flux2Scheduler` width/height (today `186` = ref 1's size). `Input_Width`/`Input_Height` exist. Identical family to FLUX.3. |
| Krea2 / Krea2 NSFW (`krea2Edit`) | `krea2_t2i_*.json`, wf 4, switch `561.any_4` | `572 VAEEncode(source @ 1 MP)` | IfElse(`560 EmptyLatentImage(W,H)`, `572`, gate) into `561.any_4`. Inputs exist. Krea2EditModelPatch `fit_mode: fit` fits the reference inside any target grid. |
| Qwen-Image 2.1 (`edit`) | `qwen_image_2_1.json`, `32 'Edit Canvas'` ComfySwitch | on_true = `30` encoder's ref latent when `Input_Image` present, else `31 EmptyLatent(W,H)` | Switch condition becomes `has image AND NOT (custom AND NOT masked)`. Inputs and the empty latent exist - smallest change of all. |
| Boogu Edit high/balanced (`edit`) | `boogu_edit_*.json`, `143 EmptyLatentImage` | ALREADY an empty latent, sized by `232 GetImageSize(source-or-crop @ total px)` | Switch `143` width/height to `Input_Width`/`Input_Height` under the gate. Graph has NO `Input_Width`/`Input_Height` yet - add them. |
| Qwen Edit (`qwenEdit`) | `qwen_edit.json`, wf 1, sampler `30` | `215 VAEEncode(source-or-crop @ total px)` | IfElse(`EmptySD3LatentImage(W,H)`, `215`, gate). No `Input_Width`/`Input_Height` yet - add them. |

App side for every one: `customSizeOps` + drop the op from `imageSizedOps` + `Input_custom_size: true`
in opInject. `kleinEdit`, `krea2Edit`, `qwenEdit` are their own commands, not `edit`, so each needs
`sizeOptIn: true` and a `qualityTier` component the way `edit` got them (`ratio` is already listed
on kleinEdit and krea2Edit, suppressed by imageSizedOps; qwenEdit has neither).

## Cloud (DeepInfra), `edit` op

`deepinfraSizing.buildSizeFields` already sends a PICKED size on edit; it falls back to the
source's shape only when no size arrives (that fallback is why edits follow the source today).
So the plumbing is there; only `imageSizedOps: ['edit']` hides the picker.

| family | body field | evidence on file | open question |
|---|---|---|---|
| Seedream 4 / 4.5 / 5 Pro | `size: 'WxH'` | 4 and 4.5 answered an unsized edit with a 2048 square, reframed (2026-10-02) - they obey the size | fill vs crop at a deliberate new ratio |
| FLUX-2 dev / Klein 9B cloud | `width`/`height` | default square "centre-cuts any other shape" | does a new ratio crop or outpaint? |
| FLUX-2 pro / max | `width`/`height` | bills per started MP of output AND input | same |
| Nano Banana 2 lite / 2 / pro | `aspect_ratio` label only | NB2 reframed a square to 1408x768 when unsent (MPI-1178), and a logo on a blank canvas of the target ratio came back at that ratio | label only, no pixels: ratio yes, tier per model |

`cloudExecutor.js` never reads a mask (no `mask` anywhere in it): a cloud edit sends only its
images, so the masked caveat is local-only.
Price per size is the t2i price at that size (already in `deepinfraPricing.js`); no paid run made.

## Bench (local, `G:/ComfyUi` 8188, under gpu_lease)

Test-only copy of each runtime graph (`scratchpad/bench.py`), unmasked edit, source 571x1021
portrait, output forced to 1024x1024 by the patch above. `bare` = plain edit prompt; `canvas` =
`TARGET CANVAS: 1:1` first line + "fill the frame" (FLUX.3's working prompt).

RESULTS PENDING
