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

## Phase 3 wiring - app side done ahead of the graphs (2026-10-19, session "Custom edit option for models 2")

UNCOMMITTED until Phase 2 benches pass: today the graphs ignore `Input_custom_size`, so the button
would do nothing on these models.

- `kleinEdit` / `krea2Edit` / `qwenEdit`: `sizeOptIn` + `customSize, qualityTier, ratio` (FLUX.3 order).
  Krea2's edit tier radio injected nothing before (dead control); it now sits behind the button.
- `customSizeOps`: Klein 4B/9B `kleinEdit`, Krea2/NSFW `krea2Edit`, Qwen Edit `qwenEdit`,
  Qwen-Image 2.1 / Boogu high / balanced `edit`; each op dropped from `imageSizedOps`.
  Klein, Boogu, Qwen Edit are orientation-mode (ratio only; Boogu + Qwen Edit use the SDXL 1 MP fallback set).
- Qwen Edit `canvasPrompt: true`: `commandExecutor` prepends `TARGET CANVAS: <ratio>` and appends
  "Fill the whole picture edge to edge, no borders." on a custom-size, UNMASKED run (`withCanvasPrompt`,
  generationControls.js). Wording differs from the bench prompt (scene-specific) - Phase 2 bench must use it.
- Checks: `node --test` full suite 3441 pass, 1 fail = op-strip-availability's old Klein `imageSizedOps` pin, updated and re-run green;
  `tests/flux3-custom-size.test.cjs` 8/8 (family loop + canvas line); desktop
  `prompt-box-custom-size.spec.js` passes off/on/off on flux3, klein-4b, krea2, qwen-image-2-1,
  boogu-edit-high, qwen-edit; eslint clean.

## Phase 2 - raw graphs edited by the agent (Fabio's permission, 2026-10-20)

Fabio asked the agent to add the nodes itself, keeping `raw/` LiteGraph (never API). Done with a
clone-and-wire script (scratchpad `lgedit.py`): new nodes are clones of FLUX.3's (#700 / #703 / #798 /
#704) or of the graph's own Get/Set/MpiInt, placed in free space by their group, each raw written back in
ITS OWN formatting (Krea2's raw is minified one-line, the rest indented; a whole-file rewrite was caught and
reverted), dead reroute ids purged. Then `workflow-to-api.mjs` + `validate-injection-rules.mjs` (all pass) +
`orchestrate.py` (one-off `bake.mjs`, the sync script minus its auto-commit). Runtime semantic diff = only
the new nodes + the rewired inputs (Qwen Edit also picks up two cosmetic display-name changes on untitled
encoders from the newer ComfyUI).

| raw | added | rewired |
|---|---|---|
| `klein_t2i_template` (4B + 9B) | Input_custom_size + Set, Get_custom size / Get_has_mask -> MpiBooleanCompare a_true_b_false, Get_W/Get_H -> EmptyFlux2LatentImage, 3 MpiIfElse | `185.latent_image`, `173 Flux2Scheduler` width/height |
| `krea2_t2i_template` (SFW + NSFW) | Input_custom_size + Set, gate, MpiIfElse(560 empty, Get_Empty_latent_Resized) | `561.any_4` |
| `qwen_image_2_1` | Input_custom_size (plain wires, no Get/Set in this graph), `Custom Size Unmasked` + `Keep Source Canvas` compares | `32 Edit Canvas`.switch = image loaded AND NOT gate |
| `boogu_edit_template` (high + balanced) | NEW Input_Width / Input_Height (1024), Input_custom_size + Set, gate, 2 MpiIfElse | `143 EmptyLatentImage` width/height (Set_W/Set_H left as they were) |
| `qwen_edit_template` | Input_custom_size + Set, gate, EmptySD3LatentImage, MpiIfElse; UNMUTED Input_Width/Height + Set_W/Set_H (were mode 4) | `30.latent_image` |

Mask button (Fabio, in-app look): a drawn mask greys Custom size out, parks ratio + tier and sends
`Input_custom_size: false` - FLUX.3 included. Signal = `_context.hasMask`, the same flag Detail /
Inpaint use (`requiresMask`). Desktop spec covers masked -> unmasked on all six models.

Bench 2 (`research/bench2.py`, shipped runtimes, no patch; output size asserted):

| model | on (1024x1024, unmasked) | off (no size) | mask (custom on + mask) |
|---|---|---|---|
| Klein 4B | 9 s, 1024x1024, fills | 9 s, 768x1376 (source shape) | 18 s, 571x1021 source frame, edit inside the mask only |
| Klein 9B | 27 s, fills | 16 s, 768x1376 | 30 s, 571x1021 |
| Qwen-Image 2.1 | 52 s, fills | 36 s, 768x1376 | 61 s, 571x1021 |
| Boogu balanced | 39 s, fills by zooming (accepted) | 27 s, 768x1376 | 30 s, 571x1021 |
| Krea2 SFW | 253 s, fills, doorway outpainted | 406 s, 768x1376 | 424 s, 571x1021 |
| Qwen Edit (tier 3) | 60 s, 1024x1024 BUT black bands with the first canvas tail | 48 s, 768x1376 | 45 s, 571x1021 |

All 18 sizes PASS (asserted in bench2.py). Qwen Edit's canvas tail, same seed, 3 wordings at 1:1: "Fill the whole
picture edge to edge, no borders" = bands; "Extend the scene outward on every side so it fills the whole picture
edge to edge. No black bars, no borders, no padding." = clean fill; a "widen the view ... left and right" variant =
clean; "recompose ... never leave bands" = bands. At 16:9 (1344x768) the old tail made a three-panel collage, the
"extend outward" tail a coherent wide room. `withCanvasPrompt` now uses "extend outward". One seed per wording:
a different seed could still band - Fabio's in-app look is the wider check.
Masked input must sit inside ComfyUI input/ (MpiLoadImage refuses other absolute paths) - a bench trap, not an app one.
Full unit suite after the graph change: 3442 pass, 0 fail.

## Fabio's in-app look (2026-10-20)

"Custom size looks and behaves right on the edit models, and the mask greys it out." Local edit models:
VERIFIED. Left on the card: the cloud edit models (one paid probe per family, price stated first).

## Cloud probes (2026-10-20, Fabio approved 4 runs ~$0.13; SPENT $0.1336)

Portrait source (571x1021) -> 16:9, plain edit prompt, body built exactly as routes/deepinfra.js does
(`buildSizeFields`), seed 424242. Script: session scratchpad `cloud_probe.mjs` (pictures stay off the board).

| family (probed member) | sent | cost | result |
|---|---|---|---|
| Seedream 4 / 4.5 / 5 Pro (`seedream-4-cloud`) | size 1344x768 | $0.040 | FILLS: doorway + wall outpainted, person intact |
| FLUX-2 dev / Klein 9B cloud (`klein-9b-cloud`) | width/height 1344x768 | $0.015 | FILLS: blinds + door outpainted |
| FLUX-2 pro / max (`flux2-pro-cloud`) | width/height 1344x768 | $0.045 | CENTRE-CROP ZOOM: head and legs cut off, no bands |
| Nano Banana 2 lite / 2 / pro (`nano-banana-2-lite-cloud`) | aspect_ratio 16:9 | $0.034 | STRETCH: 1376x768, the figure squashed sideways |

Verdict, mine: wire Seedream + FLUX-2 dev / Klein 9B cloud (clean fills). FLUX-2 pro/max zoom-crop
is "zoom" under Fabio's rule but loses the head - Fabio's call. Nano Banana stretches (distortion,
not bands) - Fabio's call; a canvas line like Qwen Edit's might fix it but costs more probes.
Wiring for cloud = add `customSizeOps: ['edit']` + drop 'edit' from `imageSizedOps` on the chosen
cloud ModelDefs; the size plumbing (deepinfraSizing) already sends the picked size. One paid run
in the real app per wired family is the verify.

**Decision (Fabio, 2026-10-20):** a model that fails does not get the option. Wire Seedream 4 / 4.5 / 5 Pro,
FLUX-2 dev and Klein 9B cloud; FLUX-2 pro/max (crop loses the subject) and the Nano Banana family (stretch) keep
following the source with no button.

## Cloud wiring (2026-10-20)

`customSizeOps: ['edit']` (and `imageSizedOps` edit dropped) on seedream-4-cloud, seedream-45-cloud,
seedream-5-pro-cloud, flux2-dev-cloud, klein-9b-cloud. No other code: the prompt box parks ratio + tier while
the button is off (no Width/Height sent, so deepinfraSizing keeps sending the source shape) and the agent path
(generationControls) gates the same way. `tests/flux3-custom-size.test.cjs` asserts the five show the button
and size on a ratio, and that flux2-pro/max + the three Nano Bananas show none and send no Width. Full unit
suite: 3446 pass, 0 fail. Left: one paid in-app run on Seedream 4.5, 5 Pro, FLUX-2 dev (~$0.11, asked).
