# MPI-971 — Engine ops on 16K+ photos: the app never sends the engine more than the op needs

**Umbrella:** MPI-962 (Big photos) phase 3. **2.0 gate** (Fabio 2026-09-29). **Decision (Fabio
2026-09-29): option B** — size inputs app-side; NO node-limit lift in `ComfyUi-MpiNodes` (option A).

## Current State

**2026-09-30 (session 8aad9989): Phase 1 DONE and live-verified, uncommitted at the time of
writing** (`routes/projects.js`, `js/services/commandExecutor.js`, `js/data/commandRegistry.js`,
`tests/engine-input-cap.test.cjs`; committed `4b2e03823`). **Next: Phase 2** (localised edits
crop/stitch). P-A and P-B both answered YES by Fabio (§ Decisions), so Phase 3 is unblocked. How
Phase 1 landed:
- Server: `resolveDisplayImage(file, ENGINE_MAX_EDGE, { engine: true })` + `GET /engine-image`
  (`routes/projects.js`). A sidecar-owned file's copy is `<Media>/.meta/<id>.thumb.engine4096.png`
  (swept with the card); a file NO sidecar owns (Flow `.preview-assets`, an agent's own path) goes
  to `os.tmpdir()/cubric-engine-inputs/<sha1(path)>.engine4096.png` — never a `.meta` written
  beside a folder we do not own (the first cut did that to an agent's scratch dir).
- Renderer: `_capLargeImageInputs` in `commandExecutor.js`, called after the trim pre-pass, before
  `_buildParams`. Runs only when `COMMANDS[op].modelSizedInputs` and NO mask. Accepts a
  `/project-file` URL OR a bare path (the connector hands bare paths; the first cut missed them).
  Fails open (warn, original) on a route fault.
- `modelSizedInputs: true` on i2i, control, kleinEdit, edit, krea2Edit, qwenEdit, pid, i2v, i2v_ms,
  ref2v_ms, imageDescribe — each graph traced to a resize right after load (2026-09-30).

Project mode: scalable-foundation. Investigation 2026-09-30 (session dd0e0b12, one read-only sweep,
spot-checked): `research/findings.md`.

- **The failure:** `MpiLoadImage` (`ComfyUi-MpiNodes` `img.py` ~:438) opens with Pillow's default
  178,956,970 px limit, then builds a float32 tensor of the whole image (3.2 GB at 16K, 12.9 GB at
  32K; the photographer tester has 16 GB RAM). Every op fed a 16K+ source dies at load.
- **Already fixed (MPI-961, `49c4b4884`):** auto-mask / SAM3 detect sends the server's 4096 copy
  (`resolveDisplayImage(url, 4096)`) with click points scaled. Cloud models (DeepInfra) already cap
  at 4096² (`routes/deepinfra.js` `_readReference`).
- **ONE ComfyUI chokepoint:** `ComfyUIController.runWorkflow`'s media loop
  (`js/services/comfyController.js` ~1575-1617) stages a `/project-file` locally
  (`_stageLocalMedia` → `routes/comfy.js` `stageMediaFile`) or uploads it to the Pod
  (`_uploadRemoteMedia`). It is op-blind. The OP-AWARE layer is `commandExecutor.js`:
  `_buildParams` (:668; media slots :793-838, `Input_Mask` :853) with a precedent pre-pass,
  `_prepareTrimmedVideoInputs` (:141, called :1631) that rewrites media items into temp files and
  cleans up after. That is where this card hooks in: before staging, so local AND Pod both benefit.
- **Two op classes behave differently:**
  1. **Model-resolution ops** — unmasked edit (Klein/Qwen/Boogu/Krea2 `ImageScaleToTotalPixels` to
     1 MP right after load), i2i (`ImageResizeKJv2` to the chosen W/H), i2v first/last frames,
     reference slots `Input_Image_2..8`. The graph discards the extra pixels anyway, so a capped copy
     changes nothing the user can see.
  2. **Full-resolution ops** — inpaint / localised edit (`InpaintCropImproved` → sample →
     `InpaintStitchImproved` INSIDE ComfyUI, result card = source size), Detail (`MaskDetailerPipe`
     over the whole image), remove background, upscale (output LARGER than source; no size guard
     exists today: 16K ×2 = 32K out, 64K internally), and Flows carrying source-pixel coordinates
     (Draw It In / Object Stamp boxes via `headSwapInjector`, Outpaint, `Input_Paint` layers that must
     match `Input_Image`'s size).
- **Masks** are exported at FULL source size (`MaskManager._toSourceScale`, :986/:1049) because
  `InpaintCropImproved` asserts mask and image sizes match. A 32K mask cannot be built in Chromium
  (canvas area cap), so the big-source path must take the mask at its 4096 working size and scale
  it server-side.
- **Reusable:** `resolveDisplayImage` (`routes/projects.js:210`; sharp, `limitInputPixels:false`,
  EXIF `.rotate()`, WebP q90, cached `<Media>/.meta/<sidecar>.thumb.fit<edge>.webp`) — BUT it returns
  the ORIGINAL for a file with no `.meta` sidecar (Flow `.preview-assets` inputs), so it cannot be
  the engine path as-is. `imageSize` / `reduceImage` (`routes/imageImport.js:44/:53`),
  `cropExtended` (`services/imageCrop.js:127`), `compositeThroughMask`
  (`services/imageComposite.js:88`, the stitch-back primitive).

## Decisions

Settled:
- **The cap is 4096 on the long edge** (`ENGINE_MAX_EDGE`), the same number as the mask working
  size (MPI-961) and the auto-mask input. A source at or under it goes to the engine untouched, so
  no ordinary photo changes behaviour.
- **Model-resolution ops get a capped copy** when the source exceeds the cap.
- **Localised edits keep the full-resolution result** by cropping around the mask server-side,
  sending the crop, and compositing the engine's result back into the original THROUGH THE MASK.
  Pixels outside the mask stay the original's. Composite-through-mask makes a second downscale safe:
  if the crop itself is over the cap (a mask spanning most of a 32K), it is downscaled to the cap,
  and nothing outside the mask is touched. The generated content is ≤1024² inside
  `InpaintCropImproved` anyway.
- **Server-side, never renderer-side:** every copy / crop / stitch runs in sharp on the server
  (`limitInputPixels:false`), the one place that can hold a 32K.

Picks — **both DECIDED by Fabio 2026-09-30: "yes / yes"** (P-A as written; P-B the composite):
- **P-A Upscale on a big source (Phase 3):** refuse when the OUTPUT long edge would exceed 16384
  (sharp's and ffmpeg's ceiling, and the app's display clamp at 16383), with a plain message, and
  grey the factor choices that would cross it. Anything that passes is also under Pillow's load limit
  (16384 / 1.5 → ≤10.9K input, 119 MP). *My pick: yes.*
- **P-B Detail on a big source (Phase 3):** run it on the capped copy, then composite back only the
  pixels that changed (a server-side difference mask, feathered) so the card stays full size.
  Fallback if that proves unreliable: refuse with a message. *My pick: the composite.*

## Completed

- [x] Investigation: every place an image reaches the engine, mapped and spot-checked (research/findings.md).
- [x] Phase 1 (2026-09-30, session 8aad9989): engine copy + model-resolution pre-pass; evidence in validation.md.

## Remaining Work

Sequential, NOT a parallel batch: every phase edits the same op-aware pre-pass in
`js/services/commandExecutor.js`, and Phases 2-4 all build on Phase 1's server module. Splitting
would put two workers in one function.

## Phase 1: the pre-pass and the capped copy (model-resolution ops)

- [x] New server module + route (e.g. `services/engineInput.js`, `POST /engine-input/prepare`):
  given a `/project-file` path and a class, return the original when its upright long edge ≤ 4096,
  else a capped copy. Unlike `resolveDisplayImage` it must work for sidecar-less files
  (`.preview-assets`), write LOSSLESS PNG (an engine input, not a display thumb), respect EXIF
  orientation exactly as the canvas does, and cache by path+mtime+size under the engine staging
  area or `<Media>/.meta/`. Renderer side: `_prepareLargeImageInputs(payload)` in
  `commandExecutor.js` beside `_prepareTrimmedVideoInputs`, same rewrite-and-clean-up shape, called
  before `_buildParams`, applied to the image slots of model-resolution ops only (op class from the
  command registry, not a hard-coded op list).
  **Verify:** unit tests for the size rule (4096 exactly, 4097, portrait EXIF 6, sidecar-less input,
  cache hit); a 16K fixture edit (Klein Edit) and an i2v first frame run on the LOCAL engine and land
  a card, `logs/app.log` shows the copy path staged, not the original; a ≤4096 source stages the
  original byte-for-byte.

## Phase 2: localised edits keep full resolution (crop, engine, stitch back)

- [ ] Big-source mask export: for a source over the cap, `MaskManager` (both twins if the mask code
  has two) sends the mask at its working size plus the scale, never a source-size PNG.
  Server: mask bbox in source px + context padding (match `InpaintCropImproved`'s context factor and
  padding) → crop rect → `cropExtended` the source; scale the mask region to the crop; downscale
  both to the cap if the crop still exceeds it; the engine runs the UNCHANGED workflow on the crop;
  the result is resized to the crop rect and composited into the original through the (feathered)
  mask; the card lands at full size with the normal sidecar. Covers inpaint / localised edit on every
  model whose graph carries the crop/stitch pair (Klein, Qwen, Krea2, Boogu, SDXL).
  **Verify:** 16K and 32K fixtures, a small mask and a mask spanning most of the frame: the result
  card is the source's exact size; pixels outside the mask (feather excluded) equal the original's;
  the edit is visible in the masked region. Pod path: one run on a remote engine proves the upload
  carries the crop, not the source (log line), cost stated first.
  **Verify mode:** `user-ux` for this phase — Fabio looks at a 16K localised edit in his app.

## Phase 3: whole-image full-resolution ops

- [ ] Remove background on a big source: run on the capped copy, upscale the returned alpha to the
  source size, `joinChannel` it onto the ORIGINAL (the sharp mask-through-alpha recipe and its traps:
  memory `tools/sharp.md`). **Verify:** 16K cutout card is source-size and its RGB outside the matte
  equals the original's.
- [ ] Upscale guard per P-A (both the universal tool `MpiToolOptionsUpscale` / History
  `_runImageTool`, and the model `upscale` op's factor control), plus the same check server-side so an
  agent or the connector cannot bypass the UI. **Verify:** a 12K source offers no ×2+, a 16K offers
  none and names why; a unit test on the rule; a ≤ cap source is unchanged.
- [ ] Detail per P-B. **Verify:** 16K face-detail card is source-size; outside the changed region
  pixels equal the original's.

## Phase 4: Flows with source-coordinate inputs

- [ ] Draw It In / Object Stamp (boxes via `headSwapInjector`), Outpaint, `Input_Paint` layers, and
  the Head Swap package: the boxes / paint define the crop region exactly as the mask does in Phase 2
  (translate coordinates into the crop, stitch back). Any Flow this cannot cover refuses a big
  source with a named reason instead of dying in `MpiLoadImage`. **Verify:** Draw It In on a 16K lands
  a source-size card; every image-taking built-in Flow either works on a 16K fixture or refuses with
  its reason (a sweep test over `flowsRegistry.js` image slots).

## Plan Drift

- 2026-09-30: Phase 1 reused `resolveDisplayImage` (an `engine` option) instead of a new
  `services/engineInput.js` + POST route — same cache, EXIF turn and 32K handling, already proven
  by MPI-961. Route is `GET /engine-image`, edge fixed server-side. Cached, so no temp clean-up.
- 2026-09-30: op class = a registry flag `modelSizedInputs` (per op). Two graphs are not a pure
  resize, accepted: Chroma's i2i MpiCrop takes a native W x H centre window (a >4096 source now
  crops from the 4096 copy, a wider window; noted in brief.md), and H3's `max` reference mode
  keeps a 2048 short edge, so a >2:1 panorama over 4096 reaches it smaller than before.
- 2026-09-30: a 16384 x 10240 fixture (167.8 MP) is UNDER Pillow's limit and does not reproduce
  the failure; the live check uses 16384 x 16384 (268 MP).

## Verification

**Verify mode:** user-ux (Phase 2 and Phase 3 each end on Fabio's look at a 16K result; Phase 1 and 4
self-verify).

End to end, on the tester's shape of machine (16 GB RAM is the bar): a 16K and a 32K photo through a
Klein edit, an i2v first frame, a localised inpaint, remove background, Detail, an upscale refusal and
Draw It In — no `DecompressionBombError`, no OOM, every full-resolution op lands a source-size card,
`npm test` + the desktop specs green, CI green on the code commit.

## Preservation Notes

- `docs/` home for the rule "the engine never gets more than ENGINE_MAX_EDGE" — the big-photos doc or
  `docs/generation-lifecycle.md`; add-model playbook note: a new model's inpaint graph must keep the
  crop/stitch pair or Phase 2's assumption breaks.
- Update MPI-962's plan when this closes (its last open member) and UNRELEASED.md's big-photos line.
- Fixture photos: generate 16K / 32K test images with sharp in the test itself; never commit one.
