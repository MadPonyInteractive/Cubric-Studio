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

App side for every one: `customSizeOps` + drop the op from `imageSizedOps`, and follow FLUX.3's
NEXT shape, not today's (Flux.3 integration 5, 2026-10-19): a "Custom size" toggle on edit, OFF by
default. Off = follow reference 1, `Input_custom_size: false`, no ratio/tier shown; on = picker shown,
`true` sent. So `Input_custom_size` comes from the toggle, never from opInject. `kleinEdit`, `krea2Edit`, `qwenEdit` are their own commands, not `edit`, so each needs
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

Test-only copy of each runtime graph (`research/bench.py`; test pictures kept OFF the public board, in the session scratchpad), unmasked edit, source 571x1021
portrait, output forced to 1024x1024 by the patch above. `bare` = plain edit prompt; `canvas` =
`TARGET CANVAS: 1:1` first line + "fill the frame" (FLUX.3's working prompt).

Bench weights MISSING (dropdown check against `/object_info`, `research/missing.py`) - Fabio
installing after removing three video models for space (2026-10-19):

| graph | missing |
|---|---|
| `klein_t2i` (4B) | UNET `flux-2-klein-4b-int8-convrot`, CLIP `qwen_3_4b` (+ 4B style/depth LoRAs, not needed for edit) |
| `krea2_t2i_nsfw` | UNET `lustify-v10-krea-raw-int8_convrot` |
| `boogu_edit_high` / `_balanced` | UNET `boogu_image_edit_bf16` / `boogu_image_edit_turbo_int8_convrot`, VAE `ae` |
| `qwen_edit` | UNET `qwen_image_edit_2511_int8_convrot`, CLIP `qwen_2.5_vl_7b_fp8_scaled` |
| `klein_9b_t2i`, `krea2_t2i_sfw`, `qwen_image_2_1` | all present |

| model | run | wall | result |
|---|---|---|---|
| Klein 4B | bare | 15 s | PASS: fills the frame, door outpainted on the right, top burgundy, identity intact. (First attempt never ran: weights not installed yet.) |
| Klein 4B | canvas | 9 s | PASS: same, wider balcony view. No canvas line needed. |
| Krea2 SFW | bare | 300 s | fills 1024x1024 edge to edge: doorway and wall outpainted both sides, top burgundy, person/bottle/balcony intact, no pillarbox, no stretch. A plain edit prompt is enough. |
| Krea2 SFW | canvas | 271 s | same quality, fills the frame; extends a door on the right. No gain over bare - Krea2 needs no canvas line. |
| Qwen-Image 2.1 | bare | 48 s | fills 1024x1024: blinds and wall extended both sides, top burgundy, person intact (a touch crisper/more saturated than the source). No pillarbox. Plain prompt is enough. |
| Qwen-Image 2.1 | canvas | 42 s | same as bare, fills the frame. No canvas line needed. |
| Klein 9B | canvas | 27 s | fills the frame, door outpainted on the right, identity intact; recoloured AND turned the tank into a short-sleeve tee (adherence drift, not a framing fault). |
| Boogu balanced | bare | 43 s | no bands, but it ZOOMS rather than extends: framed head-to-knees (feet and floor lost), wall stretched on the right, figure reads slightly wider. |
| Boogu balanced | canvas | 33 s | same zoom-crop, adds a door frame on the right. Canvas line does not make it outpaint downward. |
| Qwen Edit (tier 3 Hyper, lowest) | bare | 66 s | FAIL: solid black band down the left (~120 px), face cropped off the top; right side extended into a room. |
| Qwen Edit (tier 3 Hyper, lowest) | canvas | 60 s | PASS: fills edge to edge, full body, scene recomposed and widened (balcony, buildings, door). Needs the `TARGET CANVAS` line, like FLUX.3. |

## Verdict so far (2026-10-19)

| model | verdict |
|---|---|
| FLUX.3 Klein | done (MPI-1181); its "Custom size" toggle is the reference the rest copy |
| Klein 4B / 9B | WIRE - both fill the frame with a plain prompt |
| Krea2 / Krea2 NSFW | WIRE - fills the frame, no canvas line needed (NSFW = same graph) |
| Qwen-Image 2.1 | WIRE - fills the frame, no canvas line needed; smallest graph change |
| Boogu Edit high/balanced | WIRE - fills the frame by zooming (Fabio: expected, like i2i at a new size - zoom in/out or add content is fine; only bands fail) |
| Qwen Edit | WIRE (Fabio 2026-10-19) WITH the canvas line added to its prompt whenever custom size is on: bands + cropped face with a plain prompt, clean fill with `TARGET CANVAS` - the same need FLUX.3 has |
| Cloud edit models | not decided - one paid probe per family first (fill vs crop), price stated before |

Krea2's "bands left and right" (Fabio's first read) were the doorway outpainted as real content,
not padding - Fabio accepted it.

Rule (Fabio): zooming in/out or adding content to fill the frame is fine, as i2i at a new size;
only bands (padding) fail.

## The toggle to copy (FLUX.3, pushed 86680e011, Fabio approved in-app - Flux.3 integration 6)

- `customSize` control in `PromptBoxControls.js`: perOp, injects `Input_custom_size`, default `false`
  in `promptControlDefaults.js`, emits `prompt:custom-size`. `visibleControlIds` shows it only where
  `commands[op].sizeOptIn && modelShowsRatio(model, op)`.
- The command lists `'customSize'` BEFORE `'qualityTier', 'ratio'` in `components` (`edit` does;
  `kleinEdit` / `krea2Edit` / `qwenEdit` need it plus `sizeOptIn: true`).
- `MpiPromptBox._applyCustomSize()` parks ratio + qualityTier while off (`.hide` AND removed from
  `_activeControls`, so no Width/Height is injected). No remount: the settings queue is debounced and
  a remount re-reads the stale value.
- Agent path: `resolveNamedParams` (`generationControls.js`) gates on
  `getCommandComponents(op).includes('customSize')`: a named ratio/qualityTier turns it on, else the
  project's saved `customSize`, else off with no size.
- `Input_custom_size` must NOT be in a model's opInject.
- Tests to extend: `tests/flux3-custom-size.test.cjs`, `tests/desktop/prompt-box-custom-size.spec.js`.

## Phase 2 order

1. Fabio changes the raws in ComfyUI per the table above (the `custom AND NOT masked` gate; Klein's
   `Flux2Scheduler` width/height too). Agents never script a raw.
2. Bench each changed runtime graph (`research/bench.py` pattern): unmasked custom on (fills the
   frame), custom off (follows ref 1), masked (keeps the source frame).
3. Wire per the toggle shape above (it has landed): `customSizeOps`, drop the op from `imageSizedOps`,
   `sizeOptIn` + `qualityTier` on `kleinEdit` / `krea2Edit`, `Input_custom_size` from the toggle.
