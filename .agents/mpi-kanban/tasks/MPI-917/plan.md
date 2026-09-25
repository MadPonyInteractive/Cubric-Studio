# MPI-917 Plan: the Mix workspace (video lane, audio tracks, mixer)

**Post-2.0. Do not start before the 2.0 release ships.**

## Current State

- **Project mode:** scalable-foundation. The decisions were settled with Fabio on 2026-09-25
  before this plan was written. See `brief.md` § Decisions and § Decisions, round 2. No task
  below carries an open product decision.
- **Design:** `brief.md`. **Investigation (with file:line references):** `research/server-data-agent.md`,
  `research/workspace-components.md`, `research/tests-parity.md`. Read the one for your phase
  before starting it.
- **What it is:**
  - a new item kind `mix`, stored as an ordinary `video` or `audio` sidecar plus a `mix`
    recipe block (the GIF pattern)
  - a new page, `PAGE_MIX`, with the video lane on top, track lanes in the middle and the
    mixer at the bottom
  - rendering by server-side ffmpeg
  - a live preview in Web Audio
  - an agent connector route
  - Audio-green accent
- **Names frozen once released:** kind id `mix`, sidecar field `mix`, page `PAGE_MIX`. `scene`
  is taken: it is the 3D Scene kind and `PAGE_SCENE`.
- **Reused as-is:**
  - `MpiFader`, `MpiLevelMeter` + `meterAnalyser`, `MpiTrimBar`, `MpiResizeHandle`
  - `MpiMediaPicker` (From project / Upload / Record in one dialog),
    `MpiAudioRecorder` / `recordAudioIntoProject`
  - `MpiVideoSurface` / `MpiVideoViewer`, `MpiContextMenu`, `MpiButton`
  - `services/ffmpegBinary.js`, `services/ffmpegMux.js` (`mixAudioFiles`)
  - `writeVideoDerivatives`, `extractAudioWaveform`, `nextSequence`
- **Known traps, all measured:**
  - `amix` divides by the input count unless `normalize=0`.
  - `alimiter`'s default `level=1` pushes the mix back up to 0 dBFS; use
    `limit=<ceil>:level=0:latency=1`.
  - ffmpeg's implicit mono-to-stereo upmix is -3 dB; Web Audio's is unity. Always
    upmix explicitly.
  - Windows command lines cap at 32,767 characters; use `-filter_complex_script` and a
    staged render.
  - The CI runner has no audio device; assert Web Audio through `OfflineAudioContext`.
  - Hotkeys have no scopes, so gate each handler on the element being visible.
  - `AudioContext` output ignores the app's pinned device until `audioOutput.js` learns it.
  - Audio groups never open on click today.
- **Rule files that will need an update at close-out,** only with Fabio's explicit
  permission (CLAUDE.md rule 5): `.claude/rules/workspaces.md` says "three workspaces", and
  the component maps.

## Completed

- [ ] Nothing yet.

## Remaining Work

## Phase 1: The recipe and the shared audio maths

Everything else reads these two modules, so they land first and alone.

- [ ] **`js/data/mixRecipe.js`**: a DOM-free ES module.
  - **Recipe schema `mix.v = 1`:**
    - `videoLane: [{ itemId, in, out, join: 'cut' | {crossfade: sec}, linkedAudioClipId }]`
    - `tracks: [{ id, name, kind: 'audio' | 'videoAudio', volumeDb, pan, mute, solo, clips: [...] }]`
    - each clip:
      `{ id, itemId, start, in, out, volumeDb, fadeIn, fadeOut, loop, linkedVideoIndex? }`
    - `master: { volumeDb }`
  - **Functions:** `validateMix(recipe)` → `{ ok, errors }`; `mixDuration(recipe)`;
    `resolveSolo(tracks)`, where any solo mutes every non-solo track.
  - **Clip references:** always ITEM ids, never group ids.
  - Ownership: `js/data/mixRecipe.js`, `tests/mix-recipe.test.cjs`.
  - **Verify:** `node --test "tests/mix-recipe.test.cjs"` passes. It checks a valid
    recipe, each invalid shape rejected with a named error, duration with crossfades, and
    solo resolution.
- [ ] **`js/data/mixMath.js`**: the ONE definition shared by preview and render.
  - `dbToGain`
  - `panGains(p, channels)`: the W3C `StereoPannerNode` law, mono and stereo
  - `fadeGainAt(t, clip)`: linear, the same as ffmpeg `afade curve=tri`
  - `LIMITER_CEILING_DB`
  - `ffmpegPanExpr(p, channels)`: returns the `pan=stereo|c0=…|c1=…` string using `=`
  - Ownership: `js/data/mixMath.js`, `tests/mix-math.test.cjs`.
  - **Verify:** `node --test "tests/mix-math.test.cjs"` passes: centre mono gives -3.01 dB
    per channel, stereo centre is unity, hard left and hard right, and the midpoint of a
    linear fade gives -6.02 dB. A `routes/`-style `require('../js/data/mixMath.js')` works
    (the ES-module `require` precedent: routes/connector.js:80).

## Parallel Batch: Render, primitives, preview engine

These run in parallel after Phase 1 through `mpi-execute-parallel`. Their ownership does
not overlap. Briefings: `root-cause` for all three; `components` and `dos_and_donts` for
A2; `state` and `events` for A3.

- [ ] **A1: server render.**
  - **`services/mixRender.js`, a staged render:**
    1. Normalise and trim each video clip into scratch files, reusing the
       `scale,setsar,fps,format=yuv420p,setpts` chain + `settb`.
    2. `xfade` only the pairs whose join is a crossfade.
    3. Join with the concat demuxer. Re-test its timestamp drift on our own scratch files
       (services/videoConcat.js:259-264).
    4. Mix the audio in its own pass: per clip, explicit upmix → trim → loop → fade after
       the loop → clip gain; per track, gain → `ffmpegPanExpr`; then
       `amix normalize=0:dropout_transition=0`, master gain, and
       `alimiter=limit=<ceil>:level=0:latency=1`.
    5. Mux. With no video lane, the output is audio only.
  - **Missing source:** a source whose sidecar is gone renders as silence (audio) or black
    frames (video) for its full length, so everything after it stays in sync. The job
    reports `missing: [clipId…]`.
  - Use `-filter_complex_script` for every graph.
  - **`routes/mix.js`:**
    - `POST /mix/render {projectId, recipe, jobId, targetItemId?}`
    - `POST /mix/cancel/:jobId`
    - `GET /mix/events/stream`, sending `mix:progress/done/error` over SSE
  - **Output:** a new sequenced file, plus a sidecar with `type` video or audio, the `mix`
    recipe and derivatives. Audio output calls `extractAudioWaveform` directly; don't
    export `writeAudioWaveform`, whose "four hits" rule is in
    `docs/gallery-audio-cards.md`. Re-rendering an existing mix writes a new sequenced file
    (Chromium caches by URL).
  - The route returns the item. It does **not** write `itemGroups`; the renderer lands the
    card.
  - Mount it in `server.js`.
  - Ownership: `services/mixRender.js`, `routes/mix.js`, `server.js` (the mount lines only),
    `tests/mix-render.test.cjs`, `tests/mix-render-route.test.cjs`.
  - **Verify:** `node --test "tests/mix-render*.test.cjs"` passes, using lavfi fixtures and
    the one-second-slot method (`research/tests-parity.md` § Level assertions). It checks:
    - a -6 dB track is 6.02 ± 0.3 dB below the reference
    - three in-phase tracks sum to +9.54 dB (so `amix` is not normalising)
    - mono pan at centre gives -3.01 dB per channel
    - the float peak is at or under the ceiling
    - a two-clip `xfade` has the expected duration
    - a missing source keeps its length and is reported in `missing`
    - audio-only output
    - the route writes the sidecar with `mix.v === 1`
    - the argv or filter-script builder stays under 32,767 characters for 200 clips (a
      pure-function test)
- [ ] **A2: new primitives and icons.**
  - `MpiKnob`: bipolar, centre detent, double-click to reset, generic formatter.
  - `MpiTimeRuler`: a zoomable time scale with a playhead line.
  - `MpiFadeHandle`: a corner triangle you drag inward, plus a curve overlay; emits
    `fade-change` in seconds.
  - An `MpiWaveform` `window: {in, out}` prop, so a trimmed clip shows its window of the
    mask.
  - Icons: `solo`, `link`, `unlink`.
  - For each: register the `.css` in `js/shell/preloadStyles.js`, document the props in
    `js/components/types.js`, and follow the BEM and `ResizeObserver` 0×0 rules.
  - Ownership: `js/components/Primitives/MpiKnob/**`, `.../MpiTimeRuler/**`,
    `.../MpiFadeHandle/**`, `.../MpiWaveform/**`, `js/utils/icons.js`,
    `js/components/types.js`, `js/shell/preloadStyles.js`,
    `tests/desktop/mix-primitives.spec.js`.
  - **Verify:** `npm run lint` is clean, and
    `npx playwright test --config=playwright.desktop.config.js tests/desktop/mix-primitives.spec.js`
    passes. It checks that the knob snaps to its detent and resets on double-click, that a
    fade-handle drag emits the right seconds for a given px-per-second, that the windowed
    waveform clips its mask, and that the ruler maps time to x.
  - **Ask Fabio before adding any of these to the dev Components Gallery.**
- [ ] **A3: the live preview engine.**
  - **`js/services/mixPreview.js`:**
    - `buildMixGraph(ctx, recipe, sources)`: per clip, a gain node with fades scheduled from
      `fadeGainAt`; per track, a gain node and a `StereoPannerNode`; then the master gain
      and a limiter `WaveShaperNode` that is transparent below the ceiling.
    - Media-element sources in the app, `AudioBuffer`s in tests. Don't decode long clips
      into buffers in the app (the MPI-631/633 memory rule).
    - A transport: play, pause and seek, where seeking into a fade seeds the gain from
      `fadeGainAt`. It also drives the video element, with a CSS opacity crossfade.
    - Analyser taps for `MpiLevelMeter`.
  - **`js/utils/audioOutput.js`:** add `applyContextSink(ctx)`. It reuses `_reresolve`,
    keeps a set of live contexts, and re-points them on `setOutputDevice()` and
    `devicechange`, so the preview honours the pinned device and the MPI-824 stale-endpoint
    fix.
  - Ownership: `js/services/mixPreview.js`, `js/utils/audioOutput.js`,
    `tests/desktop/mix-preview-parity.spec.js`.
  - **Verify:** `npx playwright test --config=playwright.desktop.config.js
    tests/desktop/mix-preview-parity.spec.js` passes. It renders the same slot-per-track
    recipe through `buildMixGraph` on an `OfflineAudioContext`, and asserts the gain, pan
    and fade levels against the numbers A1's test asserts, within ± 0.3 dB, below the
    ceiling only. A stubbed `setSinkId` records that a new context received the pinned
    device.

## Phase 2: Compounds and Organisms

**Sequential, not a batch:** every component here registers in the same two shared files,
`js/components/types.js` and `js/shell/preloadStyles.js`, so their ownership can't be split.
Briefings: `components`, `dos_and_donts`, `events`. Follow the 4-tier rule: Compounds import
Primitives only; Organisms import Primitives and Compounds.

- [ ] **`MpiClipBlock`** (Compound):
  - a windowed `MpiWaveform`
  - trim edges modelled on `MpiTrimBar` (one draw per frame)
  - two `MpiFadeHandle`s at the top corners, Resolve style
  - the name, a link badge, and a **red missing state**
  - it emits `move`, `trim`, `fade` and `select`, and never mutates the recipe itself
  - **Verify:** a desktop spec: dragging the body emits `move` with a time delta, dragging
    an edge emits `trim`, dragging a corner handle emits `fade`, and `missing:true` renders
    the red state.
- [ ] **`MpiChannelStrip`** (Compound):
  - `MpiFader` (dB), `MpiLevelMeter`, mute and solo `MpiButton`s (toggleable), an `MpiKnob`
    for pan, and the track name
  - a `master` variant with no pan, no solo and no mute
  - **Verify:** a desktop spec: moving the fader emits the dB value, the mute and solo
    toggles emit, the master variant hides pan, solo and mute.
- [ ] **`MpiTrackLane`, `MpiTimeline`, `MpiMixVideoLane`, `MpiMixer`** (Organisms):
  - The lane places clip blocks by `start` and px-per-second.
  - The timeline holds the ruler, the lanes and a shared playhead, with horizontal zoom and
    scroll.
  - The video lane shows the chained clips with their join markers.
  - The mixer holds one strip per track plus the master.
  - All four take a recipe in, emit intent events out, and hold no audio.
  - **Verify:** a desktop spec mounts `MpiTimeline` and `MpiMixer` from a fixture recipe
    with 3 tracks and 2 videos, checks that clip positions and strip count match, that
    zooming changes px-per-second, and that no `AudioContext` is created by these
    components.

## Phase 3: The Mix page and Block (user-ux)

- [ ] **The new page `PAGE_MIX` `{groupId?}`.** No id means an empty mix. Wire it into:
  - `js/router.js`
  - `handleNavigation` and `_importView` in `js/shell/navigation.js`
  - `_updateBreadcrumb`: back label, stats, `data-accent="audio"`, Record hidden
  - `focusModeService.js:35-39`
  - the radial Tab / Ctrl+Tab `when` gates (hotkeyRegistry.js:390, 409)
  - `agentService.js:173`

  Navigating away calls `instance.destroy()`.
  - **Verify:** a desktop spec: `navigate(PAGE_MIX)` mounts an empty mix with the green
    accent, and navigating back destroys the Block, closes its `AudioContext` and leaves no
    hotkey bound.
- [ ] **`MpiMixBlock`:**
  - It owns the recipe in Block state and passes it to the timeline, the mixer and the
    preview.
  - **The + button** opens `MpiContextMenu` with Record, From project, Upload and Video:
    - Record and Upload go through `MpiMediaPicker` / `recordAudioIntoProject`, so they
      land as gallery cards.
    - Video appends to the video lane and adds a linked clip to the single "Video audio"
      track, created on first use.
  - **Link and unlink:** moving or trimming a linked video moves or trims its sound. An
    unlinked sound clip can be dragged onto another track.
  - **Undo:** a snapshot stack, one entry per committed edit (drag end, not every frame).
    Ctrl+Z undoes and Ctrl+Shift+Z redoes, both gated on `!isTyping` and the page being
    visible. New `hotkeyRegistry` entries; Space reuses `video.playPause`.
  - **Render:** calls `/mix/render`, shows progress through the SSE bridge, supports
    cancel, and lands the card via `addGroup` (a `landMixCard` helper in
    `js/shell/mixJobs.js`, reused by Phase 5). Re-rendering an opened mix adds to that
    card's history.
  - **Missing sources** render red and are listed after a render.
  - **Verify:**
    - A desktop spec with real media (`voices/child_1.opus` plus a generated test video):
      add a track, move a clip, undo, redo; render with `/mix/render` stubbed, and the card
      lands and reopens with the same recipe.
    - A real render in `npm run app:isolated` (never :3000) produces a playable file.
    - **user-ux: Fabio drives it:** the fader feel, the fade handles, link and unlink, and
      preview sync with the video.

## Parallel Batch: Entry points and the agent

These run in parallel after Phase 3; their ownership does not overlap. Briefings:
`components`, `events`, `root-cause`.

- [ ] **B1: the gallery way in (user-ux).**
  - **Combine** in the card menu (`MpiGalleryGrid.js:1510-1624`) now:
    - is enabled for 1 or more video and/or audio cards
    - is labelled "New mix" when one card is selected and "Combine" when two or more are
    - builds a starting recipe: videos on the video lane in click order with linked audio,
      and audio cards layered one track each starting at 0:00
    - navigates to `PAGE_MIX`
  - **New:** a right-click menu on empty gallery space with "New mix" (an empty mix).
  - **Mix cards open the Mix page on click,** including audio mix cards. That is an
    exception to the "audio never opens" rule (MpiGalleryBlock.js:288). A card is a mix
    when it has `mix.v`; add an `ASSET_KINDS` row.
  - The `/combine-videos` route is unchanged; GroupHistory and the GIF routes still use it.
  - Ownership: `js/components/Compounds/MpiGalleryGrid/**`,
    `js/components/Blocks/MpiGalleryBlock/**`, `js/utils/assetKinds.js`,
    `tests/desktop/mix-entry.spec.js`.
  - **Verify:** a desktop spec: selecting 2 videos and 1 audio card, then Combine, opens
    `PAGE_MIX` with 2 lane clips, a linked Video audio track and 1 layered track at 0:00;
    one card shows "New mix"; the background menu opens an empty mix; clicking an audio mix
    card opens `PAGE_MIX`.
- [ ] **B2: the agent route and skill.**
  - **`routes/connectorMix.js`:** `POST /connector/mix/render` takes a whole recipe.
    - It validates with `validateMix` and renders **server-side** through A1's service, with
      its own progress and cancel (never inside the 30-minute relay).
    - It relays only a "land this card" job (`js/shell/mixJobs.js` `landMixCard`, registered
      in `agentDispatch.js`). If the project isn't open, it uses `POST /project-groups`.
  - `GET /connector/mix/:itemId` returns a mix's recipe, so the agent can edit it and
    render again.
  - A skill page, `.claude/skills/cubric-vision-mix/SKILL.md`, and a row in the family
    table (cubric-vision/SKILL.md:57-68).
  - Ownership: `routes/connectorMix.js`, `server.js` (its mount line only; A1 has already
    landed), `js/shell/agentDispatch.js` (the registration lines),
    `.claude/skills/cubric-vision-mix/**`, `.claude/skills/cubric-vision/SKILL.md` (the
    table row), `tests/connector-mix.test.cjs`.
  - **Verify:** `node --test "tests/connector-mix.test.cjs"` passes: an invalid recipe gets
    a 400 with named errors; a valid one renders and relays a land job; the recipe comes
    back unchanged. Plus one real call against `npm run app:isolated` that lands a card.

## Phase 4: Docs and the stress check

- [ ] **`docs/mix.md`** (≤200 lines): the recipe schema, the render stages, the parity
  definitions, the traps, the entry points. Add a row in `docs/README.md`.
  - **Verify:** `docs/mix.md` exists and is under 200 lines, and the `docs/README.md` row
    links it.
- [ ] **A 200-clip render behind an env flag**
  (`MIX_STRESS=1 node --test "tests/mix-render-stress.test.cjs"`).
  - **Verify:** with the flag set it completes, and the output length equals
    `mixDuration`. Without the flag it is skipped, so CI stays inside its budget.

## Plan Drift

- None yet.

## Verification

**Verify mode:** user-ux. Phase 3 and Batch B1 are user-ux: Fabio must feel the timeline,
the mixer and the entry points in the running app. Phase 1, Batch A, Phase 2, B2 and
Phase 4 are `auto`.

Done end to end:
- `npm test` and `npm run lint` are green, and the new desktop specs pass.
- In `npm run app:isolated`:
  1. Combine 3 video cards and 1 music card.
  2. Place a sound effect, drag its fades and pull a fader.
  3. Undo and redo.
  4. Render. The video card lands.
  5. Reopen it: the recipe is intact.
  6. Delete one source card, reopen, and render. That clip shows red and the rest renders
     in sync.
- Fabio confirms the preview sounds like the render.
- An agent assembles a mix through `/connector/mix/render` and the card lands.

## Preservation Notes

- **Ask Fabio before editing `.claude/rules/`:** `workspaces.md` ("three workspaces" → four)
  and the component maps (mounts, events, state). The `component-maps` agent can refresh
  them once he says yes.
- Heal the `project_product_scope` memory: Vision now has an audio editing surface (Mix),
  and the "no audio editor" line is out of date.
- Tidy `project_audio_folds_into_vision`: the deferred DAW call has started, as Mix.
- MPI-775 (YuE2) already points here. Its piano roll becomes a Mix panel or track type.
- The global "used by reference" delete warning is its own card (MPI-920), not this one.
- `types.js:1601` wrongly labels `MpiAudioRecorder` a Compound; it is a Block. Mention it,
  don't fix it here.
