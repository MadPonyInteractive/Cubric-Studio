# MPI-919 plan - up to four Nano Banana references, collaged into one

DeepInfra's Nano Banana takes ONE `image` (measured 2026-09-25, see task.json). The prompt box
gets up to four references; the server collages them into one picture before the call.

## Shape (data-driven, no prompt-box code)

1. `js/data/commandRegistry.js` `edit` op: slots `inputImage2..4`, optional, `ordinal`,
   `requiresCapability: 'referenceCollage'`. `_maxMediaSlots` counts the MODEL's slots, so
   Boogu (no flag) keeps one slot and the three Nano Banana models get four. Slot 1 gains
   `ordinal` too, so strip order is the meaning.
2. `js/data/modelConstants/models.js`: the three Nano Banana ModelDefs carry
   `capabilities.referenceCollage: true`.
3. `js/services/cloudExecutor.js`: `cloudRunFields` sends `imagePaths` (every image, strip
   order, cap 4). Pricing unchanged: input is billed flat per image sent, and it is ONE image.
4. `routes/deepinfra.js`: accepts `imagePaths`; one path = today's behaviour byte for byte;
   2-4 = `routes/deepinfraCollage.js` builds the collage (sharp) and a layout preamble.
   Output ratio = image 1's, snapped by `buildSizeFields` (NB follows the INPUT's shape,
   and a square collage would otherwise return a square).
5. Sidecar keeps the ORIGINAL references (mediaItems) - the collage never touches disk.

## Collage

- 2 images: side by side; 3-4: 2x2. Each cell contains its image (no crop), neutral pad.
- Preamble tells the model which cell is Image N and to return ONE picture, not a grid.

## Verify

- `tests/deepinfra-collage.test.cjs`: layout per count, cell geometry, ratio of image 1.
- Live: real paid NB2 Lite edit with 2 and 4 refs through the route; read the output.

## Current State (2026-09-25, handoff)

Pushed: c90e6eff collage, dca6424f image-1 big cell (won the paid A/B), 214955b7 refs sent as
DISK paths (filePath is the /project-file URL; cloud edits never saw their image since MPI-851)
+ route refuses an image op with no refs, 6b83283f Wan 3.0 i2v as [{type:'first_frame',url}]
(was a 422 since ship; live 0.10 USD mp4). Fabio restarted, and a 2-image NB edit now fails
"provider could not complete" (Reuse Prompt AND fresh drag-drop) - NOT yet diagnosed.

2026-09-25 (session 643d8190): diagnosed + fixed - chips carry only `url`, executor read
`filePath`. Sweep done (validation.md): FLUX-2 pro/max bare base64, Seedream links /
`image_url` / Veo `videos` now read, unknown bytes refused. Next: Fabio restarts the app and
retries the 2-image NB edit; Veo live run only if he okays $1.20.

## Plan Drift

Scope grew into the cloud media path itself: every cloud model's input shape needs a sweep
against DeepInfra's in_fields (Fabio's ask), because Wan proved they differ. The sweep then
found the OUTPUT side broken too (Seedream, FLUX-2 pro/max, Veo) - same route, folded in.
