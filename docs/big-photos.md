# Big photos on the engine (MPI-971)

Users load 16K and 32K photos. ComfyUI cannot open them: `MpiLoadImage` hits Pillow's
decompression-bomb line (178,956,970 px) and would build a float32 tensor of the whole picture
(3.2 GB at 16K) before any graph node can shrink it. **The rule: the engine never gets more than
`ENGINE_MAX_EDGE` (4096 on the long edge) of a photo, and every full-resolution op still lands a
source-size card.** The app sizes inputs itself (option B, Fabio 2026-09-29); the node limit in
`ComfyUi-MpiNodes` is deliberately NOT lifted.

Everything below runs in the renderer's op-aware layer (`js/services/commandExecutor.js`, after
the trim pre-pass, around `_buildParams`), BEFORE media are staged locally or uploaded to a Pod,
so the local engine and the Pod get the same treatment. The pixel work is server-side
(`services/engineMask.js`, routes in `routes/projects.js`), where sharp holds a 32K
(`limitInputPixels: false`, `autoOrient` so every rect is in upright source px).

## Which op gets what — the registry flags (`js/data/commandRegistry.js`)

| Flag | Ops | What the engine gets | Card |
|---|---|---|---|
| `modelSizedInputs` | i2i, control, kleinEdit, edit, krea2Edit, qwenEdit, pid, i2v, i2v_ms, ref2v_ms, imageDescribe, flowScribble | the 4096 **engine copy** (`GET /engine-image`), only when the run has NO mask | model-sized, as before |
| `cropsToMask` | inpaint, kleinEdit, edit, krea2Edit, qwenEdit, detail | the source **cut round the mask** (`POST /engine-mask`), 1:1, scaled to 4096 only if the cut is bigger | source size: `POST /engine-stitch` pastes the result back through the mask |
| `returnsMatte` | removeBackground | the engine copy, background forced transparent | the matte stretched onto the ORIGINAL's RGB (`applyMatte`), or flattened over the chosen colour |
| `cropsToBox` | flowScribObj (Draw It In), flowObjectStamp | photo AND its paint layer cut round `box1` (`POST /engine-box`), box moved to match | stitched back through the box grown 0.3 of its side |
| `enlarges` | upscale, imageUpscale | refused before dispatch past 16384 on the long edge (`js/utils/upscaleLimit.js`); the Upscale rail greys those factors | — |

- **Why a model-sized copy changes nothing:** each of those graphs resizes right after load (Klein /
  Qwen / Krea2 edit `ImageScaleToTotalPixels` to 1 MP, i2i to the chosen W/H, i2v to the video
  size). The extra pixels were discarded anyway. A mask turns an edit into a `cropsToMask` run.
- **Why the mask cut is 1:1, and still 1 MP at the model:** the inpaint graphs'
  `InpaintCropImproved` scales the mask's box to `output_target 1024x1024` before sampling and
  `InpaintStitchImproved` scales it back; Detail's `MaskDetailerPipe` caps at `max_size 1024`.
  The cut only has to CONTAIN their window: `planMaskCrop` keeps `max(CONTEXT_PAD 128,
  ceil(CONTEXT_REACH 0.45 x box long side))` each side (MaskDetailer reaches 0.4 at crop_factor
  1.8). Seen on a Pod 2026-09-30: eyes masked on a 16384^2 photo uploaded a 2144^2 `.crop.png`.
- **The stitch keeps every pixel away from the mask the original's** (0 bytes differ outside, measured
  at 16K and 32K). Several far-apart mask areas make ONE cut round all of them.
- **Masks come over at working size** (at most 4096): `MaskManager.getURL` no longer scales to the
  source; the server fits the mask to the job. A 32K mask cannot be built in Chromium anyway.
- **Scribble** composes its paint over the photo in the renderer; `composePaintComposite`
  (`MpiStepPaint`) caps that composite at 4096, drawn from the display copy.
- **Outpaint** pads its frame at most 4096 on the long edge (`_padTo`, `MpiStepCrop`): the graph
  scales its input to 1 MP on load, so any frame size works. The old refusal past 16384
  (`outpaintRefusal`) went with MPI-1014.

## Flow screens (MPI-1014)

The Flow screens follow the History canvas's MPI-961 rule: past `displayMaxEdge()` they draw the
server's **display copy** (`GET /display-image`), while every box / crop / paint coordinate stays
in the ORIGINAL's px. `setDisplaySrc(img, url)` + `originalSize(img)` (`js/utils/displayImage.js`)
are the pair every screen uses: the Inputs slot chip and result pane (`MpiBaseFlow`) and the
Paint, Box, Crop, Preview, Cutout and Place steps. A file no sidecar owns (an uploaded Flow input
in `.preview-assets`) gets its copy in the temp cache, as the engine copy does.

**No Run-time export builds a canvas past ENGINE_MAX_EDGE** (a 16K canvas is ~1 GB, a 32K cannot
be made): the paint layer (Draw It In) and the Place stamp (Object Stamp) are LAYERS, and
`/engine-box` maps a layer of the photo's aspect at any size; the cut object, the Scribble
composite and the Outpaint frame are scaled into 4096 because their graphs shrink them anyway.
Measured on a 32768x16384 photo (2026-10-04): chip in 1.6 s on the first copy, paint step in 82 ms.

**The Paint and Cutout brushes grow with the picture.** Brush size is in IMAGE px, and its default
(40), cap (400) and wheel step (5) were tuned on a ~1K picture: on a 16K the cap drew a ring a few
screen px wide. `brushScale(size)` (`brushDab.js`, long edge / 1024, never below 1) multiplies all
three, so the brush is the same size on screen at any picture size; the 2 px floor never scales.

## The backstop

`_loadRefusal` (`loadRefusal` in `upscaleLimit.js`) runs after every fit, for every op and every
producer (UI, agent, connector, MCP): any image input still over Pillow's line is refused with the
size and `code: TOO_BIG` + `userMessage`, so the in-app agent says why instead of "The generation
failed". A new op with a full-resolution input that nobody flagged fails HERE, loudly, not as a
`DecompressionBombError` in the engine.

## Files and cleanup

- A sidecar-owned photo's engine copy: `<Media>/.meta/<id>.thumb.engine4096.png`, swept with the card.
  A file no sidecar owns (Flow `.preview-assets`, an agent's own path) goes to
  `os.tmpdir()/cubric-engine-inputs/` — never write a `.meta` beside a folder we do not own.
- Cuts, masks and boxes: `os.tmpdir()/cubric-engine-inputs/<uuid>.*`, swept at 24 h.
- Fixture photos for tests are made with sharp inside the test; never commit a 16K image.

## Adding an op or a Flow

- A graph that resizes right after load: add `modelSizedInputs`.
- A masked graph: keep the `InpaintCropImproved` -> sample -> `InpaintStitchImproved` pair (or
  MaskDetailer) and add `cropsToMask`; a graph that samples the WHOLE masked image breaks the cut.
- A box Flow: keep `MpiBoxMask` -> crop -> stitch and add `cropsToBox`. A Flow whose paint or
  place step sends a LAYER must be `cropsToBox`: past 4096 the layer comes at its working size and
  only `/engine-box` maps it onto the photo.
- A new Flow step screen: load its picture with `setDisplaySrc`, read sizes with `originalSize`.
- Package Flows opt in through `OP_KEYS` in `services/userFlows.js` (`modelSizedInputs`, `cropsToBox`).
- Not flagged and fed a big photo: the backstop refuses it. That is the correct failure.

## Deferred (MPI-961, umbrella MPI-962)

The zoom detail layer (sharp past the display copy's 1:1) and a server tiled cache were closed
without building (Fabio 2026-09-29); revisit only on user reports that big photos are still slow.
