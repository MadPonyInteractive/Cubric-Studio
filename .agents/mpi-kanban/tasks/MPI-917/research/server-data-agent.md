# MPI-917 research: server, data model and agent route (2026-09-25)

Read-only investigation. The line numbers are from 2026-09-25; re-check them before
trusting them.

## The GIF precedent
- **How the kind is stored.** A GIF is not a new `type`. It is an ordinary `type:'image'`
  sidecar whose `filePath` is the built `.gif`, plus an extra `gif:{frames,loop,output}`
  block (docs/gif.md:9-22). The kind is matched by a row in `ASSET_KINDS`
  (js/utils/assetKinds.js:73). History switches mode on `kindOfItem(...).kind === 'gif'`
  (MpiGroupHistoryBlock.js:294).
- **Route mounting.** Routes are `require`d and `app.use`d in server.js:54-63 and 88-102,
  one route file per feature.
- **How a card is created.** The route builds the file, names it with `nextSequence()`
  (routes/projects.js:267-292, which bumps a counter through `updateProjectJson`), makes the
  thumb, then writes the sidecar with `fs.writeJson` (routes/gif.js:197-234,
  gifMake.js:136-164).
  - It **never writes `itemGroups`.** The renderer builds the group with `createImageItem` +
    `createItemGroup` + `appendToHistory` + `addGroup`.
  - An update always writes a new sequenced filename, because Chromium caches by URL
    (gif.js:167-195).

## ffmpeg plumbing
- **Finding ffmpeg.** services/ffmpegBinary.js:65-66: the packaged binary, else
  `ffmpeg-static` (6.1.1).
- **Spawning and progress.** services/videoConcat.js:71-105 runs a local `_runFfmpeg`,
  reads `time=` from stderr and divides by the total. The route throttles updates to 1%
  (routes/videoConcat.js:86-94).
- **SSE.** routes/videoConcat.js:34-51 keeps its own client set; `_broadcast` is not
  exported. It sends `concat:progress/done/error` keyed by `jobId`. The renderer bridge is
  js/services/concatProgress.js (`trackConcatJob`:75).
- **Output sidecar.** `_writeOutputSidecar` (routes/videoConcat.js:96-134) probes the file,
  busts the URL with the mtime, and calls `writeVideoDerivatives` (poster, proxy, waveform;
  services/ffmpegThumb.js:312-325).
- **Hard cuts only, no crossfades.**
  - One `filter_complex` `concat=n=N` over one `-i` per input (services/videoConcat.js:128-222).
  - Every input is scaled and cropped to the first input's size. The comment at :145-147
    says "pad", but the code crops.
  - The concat demuxer with `-c copy` is avoided because it drifts timestamps on short
    clips (:259-264).
- **Reusable:**
  - `mixAudioFiles` (services/ffmpegMux.js:82-114): `amix normalize=0:dropout_transition=0`
    plus a peak-trim pass.
  - `muxAudioIntoVideo`.
  - There are four separate spawn wrappers and no shared spawn-with-progress helper.
- **Audio waveform.** `extractAudioWaveform` (services/ffmpegThumb.js:147-184) is wrapped by
  the route-local `writeAudioWaveform` (routes/projects.js:150-155). That wrapper is not
  exported, and docs/gallery-audio-cards.md:34-38 requires exactly four hits for it.

## Audio cards
- `MEDIA_TYPE.AUDIO` (js/data/commandRegistry.js:23-27). `createAudioItem`
  (js/data/projectModel.js:143) makes `type:'audio'` items with a `duration` and a
  `thumbPath` that holds the waveform mask.
- **Upload.** `POST /project-media/:id/upload` (routes/projects.js:1387-1506) copies a
  `sourcePath` or decodes base64, then runs `nextSequence`, `probeAudio` and
  `writeAudioWaveform` (1460-1467). **There is no dedupe.**
- **Audio groups never open a workspace** (docs/gallery-audio-cards.md:74-78), and
  `resolveFlipTarget` excludes them (projectModel.js:321).

## Reuse
- **Flow Reuse.** `flowId` + `flowInputs` pass through a four-hop save chain, and
  `openFlowFromReuse` restores them (docs/playbooks/add-flow/03-storage-and-reuse.md:31-85).
- **Hydration.** The reconciler spreads the whole sidecar into memory, so a new `mix` field
  comes back for free. The only group filter is the whitelist in `serializeGroup`
  (js/services/projectService.js:570-585).
- **No operationRegistry entry is needed.** It covers commandRegistry ops only
  (js/core/operationRegistry.js:13). What becomes permanent once shipped: the `operation`
  string and the sidecar field name. **Put a version inside the recipe** (`mix.v`).

## Agent connector
- **`_dispatchToRenderer(capability, input)`** (routes/connector.js:328-383, exported
  at :1154):
  - SSE `/connector/jobs/stream` to the newest renderer, then waits on
    `/connector/jobs/:id/result`.
  - The wait has one flat 30-minute limit (`JOB_TIMEOUT_MS` :312).
- **The GIF precedent.** routes/connectorGif.js validates the shape and relays `gif.*`.
  js/shell/gifJobs.js POSTs the route and lands the card with `_landNewCard` → `addGroup`
  (114-128). The handlers are registered in agentDispatch.js:1331-1336.
- **A server render still needs the renderer to land its card** (MpiGalleryBlock.js:345-397
  for combine). The only server-side landing is `POST /project-groups`
  (routes/projects.js:2573-2607), and only for a project that is **not open**
  (docs/generation-lifecycle.md:120).
- **The rule that decides the design:** a verb that needs progress, status or cancel must
  not be a throwaway relay (docs/generation-lifecycle.md:148-150). So render server-side
  with its own progress and cancel, and relay only "land this card".
- **Skills.** `.claude/skills/` holds cubric-vision, -generate, -flows, -gif,
  -project-files and -engine. The family table is at cubric-vision/SKILL.md:57-68.

## Resolving an id to a file
- Each route reads `Media/.meta/<id>.json` and decodes `filePath` from `/project-file?path=`.
  There are four private copies: videoConcat.js:55-78, gif.js:52, gifMake.js:55,
  projects.js:81/322. There is no shared resolver.
- Deleting a card removes its sidecar (projects.js:1096-1110). The reconciler drops items
  whose media is missing (projectReconciler.js:66-72).
- `input_asset_deleted` is a renderer-side HEAD check (comfyController.js:1908-1931).
- **Reference ITEM ids, not group ids,** because a group's selected entry changes.

## Scale
- **200 inputs in one `filter_complex`** means 200 decoders open at once. It can also go
  past Windows' 32,767-character command line.
- **Staged render instead:**
  1. Normalise and trim each clip into scratch files.
  2. `xfade` only the pairs that need it; it needs cumulative offsets and matching timebase,
     fps and size.
  3. Join with the demuxer. Re-test the demuxer's timestamp drift on our own scratch files.
  4. Mix the audio in its own pass.
  5. Mux.
