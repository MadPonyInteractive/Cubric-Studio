# MPI-803 — Audio output device picker in Settings

## Why

The app has never called `setSinkId`, so every `<audio>`/`<video>` it plays and the toast
chime follow the **Windows default endpoint**. On Fabio's box that is `SteelSeries Sonar -
Gaming`, which he does not hear; Edge, which he does hear, sits on Sonar's Media channel.
Measured in the running app (MPI-800 triage, `tasks/MPI-800/research/audio-probe/README.md`):
the Windows audio session on Gaming reads `state=1 peak=0.2598` while a clip plays, the file
carries audio, nothing is muted and the analyser peaks ~0.26. The app is emitting correctly
into an endpoint he cannot hear, and it gives him no way to point it somewhere else.

Second half of the same report: the app stopped appearing in Sonar's app list. It used to
appear. `5632bf4a feat(MPI-708): Cubric Studio build identity` renamed the product, so the
executable Sonar had learned (`CubricVision.exe`) no longer exists — a never-seen executable
falls to Sonar's default channel, and a dev build is `electron.exe`, which Sonar cannot name
at all. A picker inside the app is the only fix that does not depend on Sonar classifying us.

## Approach

ONE place applies the choice. A `setSinkId` call sprinkled over the ~8 playback sites
(gallery grid audio + hover video, media picker, flow result dock, group history, op help
dialog, base flow) is the shared-primitive failure this repo bans, and the next playback site
someone adds would silently skip it.

- `js/utils/audioOutput.js` (new) — the whole feature:
  - `applySink(el)`: `el.setSinkId(id)` guarded (unsupported / rejected → one warn log).
  - `installAudioOutput()`: a single **capture-phase** `play` listener on `document`.
    `play` does not bubble, but a capture listener on `document` is still on the path to any
    in-document media element, so this catches every current and future playback site.
  - `setOutputDevice(id)`: persist + re-apply to every `audio, video` already in the DOM, so
    a change while something plays takes effect now rather than on the next press.
- `js/core/storageKeys.js` + `js/core/storage.js` — `AUDIO_OUTPUT_DEVICE`, mirroring
  MPI-573's `AUDIO_INPUT_DEVICE` exactly (same empty-string = system default, same
  deliberate non-validation of a stored id against the current list).
- `MpiSettings.js` — an **Output** plate at the top of the existing audio section, beside
  Microphone, per Fabio. Section title `Audio Input` → `Audio`. Same `MpiDropdown.mount` +
  `enumerateDevices` call the mic picker already makes, filtered to `audiooutput`.
- `MpiToast.js` — the chime is a detached `new Audio()`, never in the DOM, so the document
  listener cannot see it: one `applySink(_chime)` call.
- `js/init.js` — `installAudioOutput()` at module top level, beside `restoreUiZoom()`.
- ~~`main.js` — add `speaker-selection` to `ALLOWED_PERMISSIONS`.~~ Dropped, see Plan Drift:
  measured, the `media` grant already covers `setSinkId` on this Electron.

## Not doing

- Per-card or per-op device routing. One output for the app.
- `AudioContext.setSinkId`. Nothing plays through an AudioContext — the mic monitor is input
  only and `toWavFile.js` uses an OfflineAudioContext.
- Anything about Sonar. Fabio's Gaming channel being inaudible is his box, not our code.

## Ownership

`js/utils/audioOutput.js`, `js/core/storage.js`, `js/core/storageKeys.js`,
`js/components/Compounds/LandingPages/MpiSettings/MpiSettings.js`,
`js/components/Primitives/MpiToast/MpiToast.js`, `js/init.js`,
`tests/audio-output.test.cjs`, `tests/desktop/audio-permission.spec.js`,
`docs/component-contracts.md`.

## Verification

**Verify mode:** user-ux — the whole point is a device Fabio can hear, which only he can confirm.

1. `node --test tests/audio-output.test.cjs` — the module's pick/guard logic against a fake
   media element: no stored id = no `setSinkId` call, a stored id = exactly one call with it,
   a rejecting element does not throw, an element without `setSinkId` does not throw.
2. `npm test` — full suite stays green.
3. In the app: Settings → Audio → Output → pick the device he actually hears (Sonar Media, or
   the headset directly). Play an audio card and a video card in the gallery, and trigger a
   toast chime. All three must come out of the chosen device. Then check Sonar lists the app.

## Plan Drift

- 2026-09-17 — `main.js` / `speaker-selection` dropped. Measured instead of assumed: with the
  permission ABSENT, `setSinkId` on a real `audiooutput` deviceId is **accepted** on this
  Electron, so the `media` grant already covers it and widening `ALLOWED_PERMISSIONS` would buy
  nothing (that allowlist inverts Electron defaults for everything else, so it is not free).
  `main.js` is untouched and out of the card's ownership. The desktop spec keeps a real-deviceId
  assertion as the alarm if a future Chromium starts gating it. Evidence: validation.md.

## Current State

2026-09-18 ~00:15Z. SHIPPED and VERIFIED BY FABIO. The picker plus its Test button are in, the
Output plate sits last in Settings -> Audio (input first, his call), and he confirmed both:
picking his speakers made playback audible, and the Test button let him walk the device list.

That walk found the original cause and closed MPI-800's audio thread: Sonar's **Game** channel
ACCEPTS a stream and emits nothing, and Game is the Windows default that the app followed before
this card. Media and Chat are audible. Nothing left to build — an endpoint that swallows audio is
undetectable from the renderer.

`npm test` 1321 / 1320 pass / 0 fail, unit 5/5, desktop audio-permission spec green, eslint clean.

NEXT: nothing for this card except close-out. It closes with MPI-800 and MPI-805 in one
mpi-end-session.
