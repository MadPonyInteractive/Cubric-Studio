# MPI-829 - Waveform in the video trim bar

## Scope

A video's audio, drawn inside the trim track, so an in/out point can be placed against
a word or a beat instead of guessed. Every surface that mounts `MpiTrimBar` for VIDEO.
The GIF control bar is out of scope - a GIF has no audio.

## Design

Bake at derivative time and ride the sidecar, the same doctrine as the audio card's
waveform (MPI-730), the video proxy (MPI-633) and the image renditions (MPI-319). NOT an
on-demand bake: that would invent a mechanism this codebase does not have, and would need
a path-to-id sidecar scan per request.

`extractAudioWaveform` already takes any ffmpeg input, so there is no new ffmpeg work -
`showwavespic` reads a video's audio stream the same way it reads a .wav. It lands at
`<id>.wave.webp` (NOT `.thumb.webp`, which a video already uses for its poster).

## Steps

- [x] `services/ffmpegThumb.js`: bake the wave inside `writeVideoDerivatives` when the clip
      has audio, returning `wavePath` beside `thumbPath`/`proxyPath`. One funnel already
      feeds all six routes (import, save-generation, concat, crop, reverse, gif-to-video),
      so no route grows a copy.
- [x] `services/ffmpegThumb.js`: `extractVideoWaveform` owns BOTH the name and the size.
      See "the size is not the audio card's" below - this was a real defect found by the test.
- [x] `routes/projects.js`: `wave` added to BOTH `DERIVATIVE_RE` and
      `CLEANUP_DERIVATIVE_RE`, and the cleanup nulls `wavePath` with the file it deletes -
      without that null the backfill (which gates on the sidecar, never on disk) never
      re-bakes and the mask 404s forever.
- [x] `routes/projects.js`: `/backfill-media-derivatives` video branch bakes the wave, and
      PROBES AND STORES `hasAudio` when a pre-existing sidecar lacks it - otherwise a
      silent clip re-runs ffmpeg on every project load forever.
- [x] `MpiTrimBar`: `wavePath` prop + `setWavePath(url)`, one `mask-image` layer at z-index
      0 under the selection tint. `MpiWaveform` deliberately NOT mounted inside it - it owns
      its own playhead, cursor and click-to-seek, which would fight the trim bar's drag roles.
- [x] `MpiVideoControlBar`: `setWavePath(url)`, proxied to the trim bar, no-op without one.
- [x] `MpiVideoViewer`: proxies `meta.wavePath` from `loadVideo`. Set UNCONDITIONALLY,
      unlike fps/frameCount - a stale wave is the PREVIOUS clip's audio under this clip's
      handles.
- [x] `MpiGroupHistoryBlock`: `wavePath` at all five `loadVideo` sites + the two
      item-creation sites (combine, add-to-gallery).
- [x] Item shape: `wavePath` threaded through `mediaUploadService`, `mediaImportService`,
      `generationService`, `projectService`, `MpiGalleryBlock`, `events.js` and `types.js`.
      `projectService`'s backfill patcher compares an EXPLICIT key list, so the key had to
      be added there AND spelled on every server branch - a key in one and not the other
      compares `null !== undefined` and marks every item dirty on every project load.
- [x] The four derived-video routes (crop, reverse, concat, gif-to-video) each record
      `wavePath`; they destructure the result field by field, so without a line apiece the
      wave was baked to disk and never recorded.
- [x] Test: `tests/video-waveform-derivative.test.cjs`, 7 cases, all green (the 7th ties
      the wave's inset to the handles' and arrived with the height change).
- [x] `docs/video-player.md`: a "trim bar's waveform" section.
- [x] Components gallery: the demo mounts a synthetic mask so the state is reviewable
      without a project open.

## Verification

- `node --test tests/video-waveform-derivative.test.cjs` - 7/7 pass.
- Neighbours green: `cleanup-derivatives`, `gallery-renditions`, `gif-transform`,
  `reuse-snapshot-defaults`, `audio-waveform-alpha`, `image-thumb-alpha`,
  `reuse-video-audio-gate` - 34/34.
- eslint clean on every changed file.
- LIVE: baked a real wave from a real clip through `writeVideoDerivatives`, served it over
  the app's own `/project-file` route (200, image/webp) into a real `MpiTrimBar` in an
  isolated instance on :63808, and screenshotted it. The envelope's peaks and gaps read
  clearly; handles and playhead stay legible on top. The user's :3000 was never touched.

## Known traps

- The trim bar positions by FRAME INDEX (`idx/lastIdx`, matching
  `MpiVideoControlBar._displayTime`), and the wave is linear in TIME. Worst-case drift is
  one frame's width at the clip end, invisible on a 28px strip. Note it; do not "fix" it
  by unpicking the frame-indexed mapping, which exists to stop the playhead jumping on drop.
- A silent clip must not bake. `hasAudio` is already probed into every video sidecar.
- **The size is NOT the audio card's.** A trim track is ~26px inside its border, so the
  card's 1260x540 is a 20:1 vertical squash and the browser's downscale smears the envelope
  into a soft band - measured side by side at 540/160/80 on one clip. `VIDEO_WAVEFORM_PX`
  is 1260x160, which is sharper AND a smaller file (2178 bytes against 3488). This is not
  the second rendition MPI-730 warned against: that warning is about two sizes of the SAME
  asset for the same consumer.
- **The constants are `{w,h}`; `extractAudioWaveform` takes `{width,height}`.** Passing the
  constant straight through matches NEITHER key, silently falls back to both audio-card
  defaults and bakes the blurry 540 anyway - exit 0, valid file, no error. Only a pixel
  assertion catches it. One did, during this card.

## Blocked, not skipped

`js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js` mounts a video control bar for a Flow
result and needs ONE line (pass `wavePath` into `loadVideo`). A live peer session holds
that path under MPI-822 and it is uncommitted, so this card does not touch it. Messaged the
owner (state/messages/cc5c4578-28de-4bfc-ab10-19426c5dbe2c.json); the Flow result player
picks the wave up when that line lands. Nothing breaks meanwhile - the proxy call is
optional-chained, so that surface just shows a plain trim bar.
