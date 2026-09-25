# MPI-917 research: tests and preview/render parity (2026-09-25)

Read-only investigation. The ffmpeg behaviour below was measured directly (output to the
null muxer). The line numbers are from 2026-09-25.

## Node tests
- The real script is `node --test "tests/**/*.test.cjs"` (package.json:24). Files run in
  parallel.
- **ffmpeg:** `require('../services/ffmpegBinary').ffmpegPath` (6.1.1, gyan.dev essentials).
  It has `afade`, `acrossfade`, `xfade`, `alimiter`, `pan`, `astats`, `volumedetect` and
  `ebur128`.
- **Fixtures:** made with lavfi: `sine=frequency=440:duration=1` + `volume=`
  (audio-mix-levels.test.cjs:60), `testsrc`+`sine` (video-waveform-derivative.test.cjs:56-58),
  `color=` (gif-make.test.cjs:39). Scratch folders come from `tests/helpers/scratch.cjs`.
- **Route tests:** `express()` + `app.use(require('../routes/gifMake.js'))` +
  `listen(0,'127.0.0.1')`, with a real project.json and `Media/.meta` on disk
  (gif-make.test.cjs:79-89).
- **SSE reader:** agent-card-marks.test.cjs:44-75.
- **The pattern to copy:** `tests/audio-mix-levels.test.cjs` (MPI-663) already guards the
  `amix` normalize trap.
- No test covers `routes/videoConcat.js` today.

## CI
- `tests.yml`, `windows-latest`:
  - `unit`: `npm ci` + lint + `npm test`, about 80 s
  - `desktop`: 4 shards, `retries: 2`
- ffmpeg comes from `ffmpeg-static`'s postinstall download during `npm ci`.
- The runner has **no audio hardware** (audio-output-missing-device.spec.js:15-17), no GPU
  and no weights.

## Desktop specs
- `launchApp(testInfo)` from tests/desktop/launch.js. Drive the app with `window.evaluate`
  and stub `window.fetch`.
- **The workspace spec to copy:** gif-workspace.spec.js:22-99.
- **A real project:** `createProject`/`openProject` + `navigate(PAGE_GALLERY)`
  (flow-queue-hotkey.spec.js:91-94).
- **Real audio:** `voices/child_1.opus` (gallery-audio-waveform.spec.js:38).
- **Autoplay works without flags** (flow-audio-player.spec.js:777).
- **Assert Web Audio with `OfflineAudioContext`, never a live `AudioContext`**, because the
  runner has no audio device.

## Level assertions
- **Give each track its own one-second slot.** Measure it with
  `atrim=start=k:end=k+1,volumedetect`, always relative to a measured reference. lavfi's
  sine peaks at about -18 dBFS.
- **A track at -6 dB:** `slot - ref ≈ -6.02 ± 0.3`.
- **The `amix` trap:** three identical in-phase tones → **+9.54 dB** (20·log10 3) over one
  tone. A normalizing `amix` gives +0. Start at `volume=0.1`.
- **Pan:** per-channel `astats` peaks. A mono source at centre reads -3.01 dB per channel.
- **Fade:** at the midpoint of a linear fade, about -6 dB.

## Parity definitions: one shared module
- **Gain:** `dbToGain = 10^(dB/20)`. Web Audio sums at unity, which matches
  `amix normalize=0:dropout_transition=0` (ffmpegMux.js:86).
- **Fades:** `afade curve=tri` is linear, the same as `linearRampToValueAtTime`. Share
  `fadeGainAt(t)`, which also seeds the gain when seeking into a fade.
  - Apply the fade after the loop.
  - Express a linked video-audio crossfade as overlapping clips (fade out + fade in), not
    `acrossfade`.
- **Pan:** `StereoPannerNode` follows the W3C algorithm.
  - Mono: x=(p+1)/2, L=cos(xπ/2), R=sin(xπ/2), which is -3 dB each at centre.
  - Stereo with p≤0: x=p+1, L=inL+inR·cos, R=inR·sin. p>0 mirrors it.
  - ffmpeg: `pan=stereo|c0=<gL>*c0|c1=<gR>*c0` (mono), or `c0=c0+<gL>*c1|c1=<gR>*c1`
    (stereo, p≤0). Use `=` rather than `<`. Compute both from one `panGains(p, channels)`.
- **Measured trap: ffmpeg's implicit mono-to-stereo upmix is -3 dB** (-18.1 → -21.1). An
  explicit `pan=stereo|c0=c0|c1=c0` stays at -18.1, and Web Audio's upmix is unity. Never
  let ffmpeg upmix automatically. Mic takes are mono.
- **Measured limiter trap:** `alimiter`'s default `level=1` scales the mix back up to
  0 dBFS (`limit=0.5` still peaked at 0.0 dB). With `level=0` it peaks at -6.02.
  - Use `alimiter=limit=<ceil>:level=0:latency=1`. `latency=1` drops the 5 ms lookahead
    delay against the video.
  - `DynamicsCompressorNode` can't match: the ratio tops out at 20, it has a knee, and it
    adds makeup gain.
  - For the preview, use a `WaveShaperNode` that is transparent below the ceiling, or an
    AudioWorklet.
  - Assert parity **below the ceiling only**, plus "the render's float peak is at or under
    the ceiling".
- **Video crossfade:** `xfade=transition=fade:duration=D:offset=<cumulative length −
  cumulative crossfades>`. The inputs need matching size, fps, pixel format and timebase:
  reuse the `scale,setsar,fps,format=yuv420p,setpts` chain at
  services/videoConcat.js:167-169, plus `settb`. The preview uses a CSS opacity fade.

## Where the shared maths lives
- `js/data/mixMath.js` (or similar), a DOM-free ES module. Routes can already `require()`
  an ES module (routes/connector.js:80 → generationControls.js; its header explains why),
  on Node 24.14.
- Do not make a hand-synced `.cjs` twin.

## Preview graph testability
- Build the preview as `buildMixGraph(ctx, recipe, sources)`, so an `OfflineAudioContext`
  spec can render it and compare slot levels against the ffmpeg render.
- Media-element sources can't be rendered offline. Use buffers in tests and media-element
  sources in the live app.

## Scale
- Windows caps a command line at 32,767 characters. Use `-filter_complex_script` (ffmpeg
  6.1; renamed in 7.x) plus a staged render. Unit-test the argv length as a pure function.
- Keep a real 200-clip render behind an env flag (`{ skip: !process.env.X && '…' }`, as in
  agent-loop.test.cjs:2314). It doesn't fit the roughly 80 s unit-job budget.
- **Loop to fill:** `aloop` needs a sample count, so probe the sample rate first. The
  alternative is `-stream_loop -1` + `atrim`.

## Isolated app
`npm run app:isolated` prints `READY <url>`. To stop it, kill the parent of the process
listening on the port, not the listener itself, or the user gets a modal error box
(scripts/launch-instance.mjs header, lines 17-37).
