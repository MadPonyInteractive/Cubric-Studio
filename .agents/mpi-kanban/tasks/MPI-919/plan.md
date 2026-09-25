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

2026-09-25 later: d1cffbe0 pushed, CI green. Fabio confirmed the 2-image NB edit in the app
(edit_008). Veo 3.1 Fast i2v live OK ($1.20). The collage phase is DONE; what follows is the
cloud media path, per Fabio's calls below.

2026-09-25 (session 949bf2cd), item 1: ROOT CAUSE = `main.js` `pruneStaleMaskTemp` matches
`cubric-*`, so it wipes every sibling temp dir (cubric-deepinfra, -agent, -gif, -tests,
-agent-profile), not just `cubric-<uuid>` mask sessions. Route half DONE (uncommitted):
`/deepinfra/output` no longer deletes on serve (a served file proves no save); `_sweepOutputs`
ages files out after 24 h, test `tests/deepinfra-output-retention.test.cjs`. main.js half
done after MPI-922 released it (uuid-shape regex + spec updated, 2/2 pass).

2026-09-25 (949bf2cd) later: ALL SIX items done, uncommitted, unit suite green; evidence in
validation.md "Next phase". Design: `cloud.imageFields` (numbered fields) + capability
`multiReference`/`multiReference8` gate edit slots 2-4/5-8; `cloud.inputMaxPixels` shrinks
FLUX-2 pro/max refs to 1 MP so `BFL_MEGAPIXEL_USD` quotes exactly. Fabio verified; shipped
in a0e6b58a (with 1 MiB ratio rows and 16K-safe references). CLOSED. Gotcha: a harness with TEMP overridden needs
DEEPINFRA_API_KEY in env - the key store falls back to os.tmpdir() without APP_USER_DATA.

## Next phase - Fabio's decisions (2026-09-25), in this order

1. **Never lose paid work.** `mask-temp`'s startup prune deletes `os.tmpdir()/cubric-deepinfra`
   as a "stale session dir" (live log 11:01Z, 11:16Z; a peer's harness pruned it mid-run and
   a generated file hit ENOENT). A paid output must survive until the project copy exists.
   Find the prune's pattern first, then move the output dir out of it (or exempt it), and
   check `/deepinfra/output` deleting on serve cannot lose a file whose save failed.
2. **Native multi-reference, collage ONLY for Nano Banana.** Seedream 5 Pro takes
   `image`..`image_4`, FLUX-2 dev `input_image_1..4`, FLUX-2 pro `input_image`..`_4`, max
   `..._8` (schema_in, 2026-09-25). Give those models their real slot count and fill the
   numbered fields; `referenceCollage` stays on the three NB models only.
3. **FLUX-2 price tag counts input images.** Pro edit billed $0.045 (1 MP out + ~1 MP in),
   quoted $0.015; max billed $0.10, quoted $0.10 - measure before assuming the formula.
   Multi-reference (item 2) multiplies this, so do it together.
4. **Ratio selector on edits** for the models that take a resolution (Fabio's pick over
   deriving from the image): Seedream 4/4.5 and FLUX-2 pro/max edits return SQUARE today
   (2048^2 / 1024^2 for a 1088x896 source) because an edit sends no size. Drop `edit` from
   those models' `imageSizedOps` so the existing picker shows; its rows are already snapped
   to each model's step, so divisibility is not an issue. Seedream 4.5 floor: 3,686,400 px
   (its published box text is copied from Seedream 4 and wrong) - every 2K row clears it.
   Seedream 5 Pro and NB already follow image 1's ratio on their own.
5. **HTTP 500 = "the model refused" is sometimes OUR malformed request.** DeepInfra wraps the
   provider's answer: `{"detail":"Request to <host> failed with status: 400, response: ..."}`.
   Recommendation: classify from `detail` without logging or returning it - a wrapped 4xx
   parameter/decode error is PROVIDER_ERROR, a safety/blocked wording or a bare 500 stays
   CONTENT_FILTERED - and log only the wrapped status + provider host. Capture one real
   Gemini refusal body first to know what it says.
6. Open a Wan 3.0 reference-to-video card next to MPI-910 (still pending).

## Plan Drift

Scope grew into the cloud media path itself: every cloud model's input shape needs a sweep
against DeepInfra's in_fields (Fabio's ask), because Wan proved they differ. The sweep then
found the OUTPUT side broken too (Seedream, FLUX-2 pro/max, Veo) - same route, folded in.
