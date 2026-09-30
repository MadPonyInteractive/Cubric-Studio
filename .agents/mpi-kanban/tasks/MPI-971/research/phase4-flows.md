# MPI-971 Phase 4 — Flows on a 16384^2 photo (read-only sweep, 2026-09-30, session 0caa9d47)

An Explore sub-agent's report, NOT re-verified line by line; spot-check a cited line before building
on it. Line numbers are as of `b66b032fa`.

## Scope

Four built-in Flows take an image. Skipped: ltx-extend / ltx-foley / ltx-upscale (video),
character-sheet (no media), voice-changer / chatter-box / stems / minimax-music / sound-and-music
(audio/text). Head Swap is no longer built in (`flowsRegistry.js:441-448`), it is the
`user:head-swap` package.

## Dispatch: every producer reaches the Phase 1-3 hooks, none of the four Flows opts in

`MpiBaseFlow._run` (MpiBaseFlow.js:3607), the agent's `_submitFlow` (agentDispatch.js:1001; the
connector reaches it via `_submitGeneration` :537) and `routineDispatch.js:124` all call
`flowService.submitFlowGeneration` (flowService.js:115) -> `enqueueGeneration` -> `runCommand`.
Flows dispatch under `flow.operation` (flowService.js:184) with `model.id: null`, so COMMANDS flags
on those op entries WOULD apply; none of the four sets `modelSizedInputs` / `cropsToMask` /
`returnsMatte` / `enlarges`. Flows never send `maskDataUrl` / `Input_Mask` (their mask-like input
is `Input_Paint`), so `cropsToMask` alone does nothing. The injector (headSwapInjector) reads
`workingPayload.injectionParams` (commandExecutor.js ~1901), NOT the built `params`.

## Per Flow

| Flow (op) | Photo slot + extras | Source-px coordinates | Graph after load | Verdict |
|---|---|---|---|---|
| Draw It In `scribble-object` (`flowScribObj`) | `Input_Image` = photo; `Input_Paint` = paint layer made in the renderer AT THE PHOTO'S FULL SIZE (`composePaintLayer`, MpiStepPaint.js:146-172, upscaled from a <=4096 layer) | `box1` -> `Input_Box` from MpiStepBox, absolute source px; written by headSwapInjector (:81-94) | ImageCompositeMasked(photo, paint, 0,0) -> MpiBoxMask -> InpaintCropImproved (1024 target, context = max(1, 4.267 x drawSide/boxSide), node 183) -> Klein -> ColorMatch -> InpaintStitchImproved at full res | (b) cut Input_Image AND Input_Paint to one window, shift the box, stitch back. Window scales with the drawing: plan per Flow, not engineMask.CONTEXT_REACH |
| Scribble `scribble` (`flowScribble`) | `Input_Image` = one flattened composite at the upload's natural size (`composePaintComposite`, MpiStepPaint.js:199-238) | none | ImageScaleToTotalPixels 1 MP -> latent from GetImageSize; ~1 MP out, no stitch | (a) `modelSizedInputs: true` fixes the engine side; ALSO cap the composite in the renderer |
| Outpaint `outpaint` (`flowOutpaint`) | `Input_Image` = photo PADDED with transparent bars (bigger than the source), drawn full-res by `composePaddedImage` / `_padTo` (MpiStepCrop.js:122-132, 175+) via `_deriveRunMedia` (MpiBaseFlow.js:3428-3465); agent path agentDispatch.js:1108-1128 | crop rect in source px (MpiStepCrop.js:22) | ImageScaleToTotalPixels 1 MP -> Klein -> MickmumpitzPanoHarmonizeBoundary (full-res plate, node 553) -> ComposeColorMatch onto the full-res padded frame (node 686) | (c) output always > the source: refuse over the cap |
| Object Stamp `object-stamp` (`flowObjectStamp`) | `Input_Image` = scene; `Input_Paint`: Auto = object placed on a SCENE-SIZED canvas (`composePlacedObject`, MpiStepPlace.js:128-156), Manual = the cut-out at its own size (a reference) | `place` -> region->box1, mode->Input_Mode (stepKinds.js:144-158), source px, via headSwapInjector | ImageCompositeMasked(scene, paint) -> MpiAnySwitch -> InpaintCropImproved x2 (context 1.0, grow round(0.3 x boxSide) node 225, pad 32) -> ref 2 via ImageScaleToTotalPixels 1 MP -> InpaintStitchImproved full res | (b) for scene + Auto layer, like Draw It In; Manual's Input_Paint can take the 4096 copy. OVERLAPS MPI-998 (Object Stamp flip, MpiStepPlace.js) |

## Renderer-side failure BEFORE the engine

Derived files go to `place-preview-asset` as base64 JSON (MpiBaseFlow.js:953-973; agentDispatch.js:950)
under the server's `100mb` body limit (server.js:42). A 16K padded Outpaint frame or a 16K Scribble
composite likely exceeds it: the user only sees "could not prepare its image" (MpiBaseFlow.js:3594-3601).
A >=16384^2 canvas is also at Chromium's canvas area cap (agent's knowledge, not in the repo). The
mostly transparent Draw It In / Object Stamp layers probably pass this step and die in MpiLoadImage.

## Where a refusal lives

1. Backstop for every producer: `runCommand`, beside `_upscaleRefusal`, keyed on a new COMMANDS flag,
   `imageSize()` as in upscaleLimit.js. Gaps: for Outpaint it runs AFTER the padded frame was made
   (and would size the frame, not the source); `_failBail(new Error(msg))` sets no `userMessage`, so
   the agent's onError (agentDispatch.js:1006-1007) says only "The generation failed" — set
   `err.userMessage` / `err.code`. (The same gap applies to Phase 3's upscale refusal for the agent.)
2. Early refusal with the reason: a pure `flowSizeRefusal(flow, naturalSize)` beside `flowAvailability`
   in flowsRegistry.js, called in `MpiBaseFlow._run` before `_planPasses` (:3588) and in
   `agentDispatch.buildFlow` after `resolveAgentMedia` (:1055) (buildFlow is shared by
   /connector/generate and routines).
`submitFlowGeneration` is the one place all Flows pass but a poor home: synchronous, toasts + returns
null (agent sees only REJECTED), and runs after the derived images exist.

## Package Flows

`registerUserFlow` copies `manifest.op` into COMMANDS (userFlowService.js:76-81), but the `OP_KEYS`
whitelist (services/userFlows.js:40-41) excludes these flags, so `user:head-swap` (photo + boxes)
cannot opt in and stays unguarded.

## Agent note

The in-app agent never RUNS Draw It In / Scribble / Object Stamp (`agentOpens` opens them on screen,
agentDispatch.js:1239), but `buildFlow` never checks `agentOpens`, so `/connector/generate` can.
