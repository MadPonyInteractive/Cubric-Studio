# Cloud generation (paid models on the user's DeepInfra key)

How a cloud model's run travels, what it costs, how it fails and what the user is told. A cloud
model is a `ModelDef` in `js/data/modelConstants/models.js` with `provider: 'deepinfra'` and a
`cloud` block. It never touches ComfyUI. Model and pricing research lives in
`docs/proprietary-models-research/`; the business call (BYO key, no credits) is MPI-849.

## The path

1. **Dispatch.** `generationService` branches on `model.provider` BEFORE `runCommand`: a cloud job
   goes to `runCloudCommand` (`js/services/cloudExecutor.js`), which returns the same `exec`
   handle and callbacks `runCommand` does. The save, sidecar and card code below it is shared, so
   a cloud run is the same pipeline with a different head. It takes the `cloud` lane, never
   `remote` (that is the user's Pod).
2. **Fields.** `cloudRunFields` turns `injectionParams` + staged media into what is sent: size in
   every currency (pixels, ratio label, quality tier), `Input_Duration`, the batch, and
   `imagePaths` in strip order. The price tag reads the SAME function (`estimateRunCost`), so the
   quoted run and the sent run cannot differ.
3. **Send window (MPI-940).** 3 s (`sendWindow.ms`) with "Sending in N..." on the card. A Stop
   inside it aborts and nothing is spent.
4. **POST `/deepinfra/generate`** (`routes/deepinfra.js`) by MODEL ID. The route resolves endpoint,
   key and body itself: the ModelDef is the whitelist, and the key never reaches the renderer
   (`resolveConnection('deepinfra')` in `services/llmEngines.mjs`, main process).
5. **Upstream.** `POST https://api.deepinfra.com/v1/inference/<endpointId>`, the native route,
   because only it returns `inference_status.cost`. Timeout 280 s (Node's `fetch` dies at 300 s
   waiting for headers).
6. **Result.** Bytes land in a scratch dir (`os.tmpdir()/cubric-deepinfra`), served as
   `GET /deepinfra/output/:id` with a real extension (sniffed from the bytes, `_extOf`), kept 24 h
   then swept. The seed the provider picked and the TRUE billed cost go into the sidecar; each
   card of a batch carries its share.

## What the route builds

- **Size:** `buildSizeFields` (`js/data/modelConstants/deepinfraSizing.js`) picks the currency THIS
  endpoint takes and fits it to its published bounds. The fitted size is what bills.
- **Batch:** a native count where the endpoint has one (`batchFieldFor`): N outputs, ONE call,
  ONE bill. Otherwise `calls` requests of one sent together, N bills (MPI-940). One output is kept
  per output asked; extras are dropped (MPI-875).
- **References** (`imagePaths`), every one bounded first by `_readReference`: over 4096x4096 or
  10 MB becomes one upright JPEG; `cloud.inputMaxPixels` caps lower for models billed per input
  megapixel. Placement per ModelDef:
  - `cloud.imageField`: image 1 as a data URL naming the sniffed type;
  - `cloud.imageFields`: reference N in the Nth field (MPI-919);
  - `capabilities.referenceCollage`: up to four collaged into one (`routes/deepinfraCollage.js`);
  - `cloud.imageBareBase64` (FLUX-2 pro/max): bare base64, no data URL;
  - `cloud.mediaList` (Wan 3.0, MPI-923): EVERY input in one typed list `media: [{ type, url }]`,
    built from `media` (each staged item with its type and slot role, `cloudRunFields`) by
    `_wanMediaPlan`. `i2v`: `first_frame` + optional `last_frame` (the `endFrame` slot, shown only to
    a model declaring `capabilities.endFrame`). `ref2v`: every item a `reference_image` / `_video` /
    `_audio`, strip order. Video (MP4/MOV, 100 MB) and audio (WAV/MP3, 15 MB) go as data URLs; any
    other type or size is refused before sending.
- **`ref2v`** is the cloud twin of H3's two-stage `ref2v_ms`: same 9/3/3 wells, but tagged with
  the names the cloud model reads (Wan: `Image n` / `Video n`, counted per type). Wan bills a
  reference VIDEO's seconds as well as the clip's (measured 2026-09-30: 6.9 s ref + 5 s clip billed
  11.9 s); images and audio are free. The length is unknown before the run, so `estimateRunCost`
  quotes the ceiling, "up to", at 15 s a video and 30 s in all (the provider's own limits).
- **A picture op with no picture is refused**, never sent (`requiresImages`): the endpoint would
  bill a text-to-image and hand it back as the "edit".

## Money

- **Price tag (MPI-852):** `estimateRunCost` -> `estimateCost` (`deepinfraPricing.js`, from the
  price snapshot). Agents get the same figure through `/connector/quote`: the in-app agent asks
  before spending, MCP answers `CONFIRM_COST`.
- **Credit gate (MPI-869):** the route reads `/payment/checklist` and refuses a run the balance or
  the monthly limit cannot cover (`LOW_BALANCE` / `OVER_LIMIT`, a toast, not the dialog). An
  unreadable account lets the run through; the provider's 402 (`NO_CREDIT`) is the backstop.
  That body carries the billing address and card last4: only numbers are read out of it.
- **Stop after the POST is not a refund (MPI-928):** the provider finishes and bills, so the
  result still saves as a card marked `chargedAfterStop`. A Stop that the provider then fails was
  not billed and ends like a Stop (MPI-937).
- **Remote panel readout (MPI-855):** `GET /deepinfra/account`, spend plus both stops.

## Failures and what the user sees

The route answers `{ ok:false, error:{ code, message } }` with a message it WROTE. The upstream
body and the key never reach a log or the renderer: a DeepInfra error body can carry account
detail. Status mapping is `_codeForStatus`: 401/403 `NO_KEY`, 402 `NO_CREDIT`, 422 or a wrapped
provider 4xx `PROVIDER_ERROR` (our malformed request, not a refusal), 400/500 `CONTENT_FILTERED`
(the Gemini family refuses with a 500 and no image; a 200 with no output is the same refusal).

The dialog copy is `cloudErrorMessage` (`ERROR_COPY` in `cloudExecutor.js`):

- every code has fixed copy, EXCEPT a `PROVIDER_ERROR` that carries the route's message, which is
  shown as written (MPI-981). Most of those are the app's own failures before anything was sent
  ("The reference image could not be read."), and the fixed sentence blamed the provider;
- so a route message decides its own billing claim: the pre-send ones end "Nothing was sent, so
  nothing was billed."; "generated but could not be downloaded" makes none (it was billed);
- a bare `PROVIDER_ERROR` (an upstream failure) keeps "The provider could not complete this
  generation. Failed calls are not billed.", which is true for DeepInfra's 500s;
- an agent's run gets the same text as `userMessage`, and no toast for a credit refusal: the
  agent says it in the chat.

The log keeps the route's reason either way:
`[cloudExecutor] Cloud generation failed (<op> / <model>): <CODE> - <message>`. Grep that first.

## The cloud-only user (no engine, no Pod) - MPI-856

"Skip the local engine install" on with no Pod connected is a supported state: projects create
and open, and cloud models run, because nothing on that path touches ComfyUI. Every ENGINE action
is refused in one place, `ComfyUIController.ensureServerRunning` (local branch): `hasNoEngine()`
(`js/services/engineGate.js`) -> one `ui:warning` naming cloud models as what still works, then a
throw with `NO_ENGINE_CODE` that the `runWorkflow` callers settle on without the bug dialog. A
new tool needs no gate of its own. Soft layers on top: the History rail dims Resize / Upscale /
Remove Background / Interpolate; Enhance and Describe run on the endpoint backend
(`runnableBackend`); the Flow Library, `flow:open`, a Model Library install and Restart engine
refuse up front. For a user with an engine, `hasNoEngine()` returns before any request.

## Agent paths

A video ref sent in a picture slot becomes its first frame in `/connector/generate` and
`/connector/quote` before the renderer sees it (MPI-980, `docs/agent-chat.md`). Anything that
still reads as the wrong type is refused by `resolveAgentMedia` (MPI-979), so an mp4 never
reaches `_readReference` as "an image".

## Tests

`tests/cloud-executor.test.cjs` (lane invariant, copy), `cloud-price-tag`, `cloud-duration-bounds`,
`cloud-key-refresh`, `model-picker-cloud`, and `deepinfra-*` (account, catalogue, collage, credit
gate, multiref, output retention, pricing, transcribe, wan-media).
