# MPI-803 — validation

## Evidence carried in from MPI-800's triage (do not redo)

`tasks/MPI-800/research/audio-probe/README.md` + its three scripts. The app emits audio
correctly: Windows session on `SteelSeries Sonar - Gaming` reads `state=1 peak=0.2598` while a
clip plays, the files carry audio (`volumedetect` prints `n_samples: 0` on filter INIT — read
the LAST count or every clip reads silent), and the renderer's analyser peaks ~0.26. The app
never called `setSinkId`, so it followed the Windows default. That is what this card fixes.

Product rename `5632bf4a` (MPI-708) is why Sonar stopped listing the app: the executable it had
learned (`CubricVision.exe`) no longer exists, and a dev build is `electron.exe`.

## Automated checks (2026-09-17)

| check | result |
|---|---|
| `node --test tests/audio-output.test.cjs` | 5/5 pass — no stored id = no `setSinkId`; a stored id applied exactly once and not re-applied; NotFoundError / missing `setSinkId` / null element all non-throwing; the listener is `play` + capture and ignores non-media targets; a device change re-routes what is already playing |
| `npm test` | tests 1317, pass 1316, **fail 0**, skip 1 (was 1312/1311 before this card — the 5 new ones) |
| `npx playwright test tests/desktop/audio-permission.spec.js` | passed on a real Electron launch (3.4s) |
| `eslint` on every touched `js/` file | clean, `--max-warnings=0` |

## `speaker-selection` is NOT required — measured, not assumed

The plan said to add `speaker-selection` to `main.js`'s `ALLOWED_PERMISSIONS`, because
`setSinkId` is spec'd behind that permission. Proven false on this Electron, so the change was
reverted and `main.js` is untouched:

1. With `speaker-selection` absent and a **made-up** device id → `NotFoundError`. Inconclusive
   on its own: Chromium could be resolving the device before checking permission.
2. With `speaker-selection` absent and a **real** `audiooutput` deviceId from
   `enumerateDevices` → **`accepted`**. The `media` grant already covers it.

Run 2 is why the permission is not in the set. The desktop spec now uses a real deviceId where
the machine has one and asserts `not NotAllowedError`, so it is the alarm if a future Chromium
starts gating this — refused, the picker would accept a choice and silently change nothing.

## Fabio's check — PASSED (2026-09-17)

He restarted the app, still heard nothing, opened Settings, set Output to his speakers, and
playback became audible. The picker does the one thing it exists to do.

## Retraction: the rename does NOT explain Sonar losing the app

I attributed it to `5632bf4a` (MPI-708) renaming the product. Wrong — Fabio never runs the
built exe, he always runs `npm start`, so the process has been `electron.exe` the whole time,
before and after the rename. What stands: a dev build is `electron.exe`, which a per-app router
cannot name, and the release exe is `CubricStudio.exe`. Why it used to be listed and now is not
is NOT established; the plausible mechanism is that a per-app router lists an app only while it
holds an audio session, and this app holds one only while something plays.

## Option B, chosen by Fabio: a Test button (2026-09-17)

"Cubric-Vision is not a routing app, so let's do B." — so no keep-alive session, no attempt to
be visible to Sonar/OBS when idle. What shipped instead is what most apps do: choose an output,
and a button that plays a sound so the choice is checkable.

- The Output plate now sits LAST in the audio section, after Microphone / Input gain / Test
  microphone, because input comes first (his call).
- Test plays `assets/sounds/notify.wav` — the notification chime, not a second sound file —
  through `applySink`, so it goes to the chosen device.
- `applySink` now returns a boolean. A test that silently fails is not a test: a wrong device is
  inaudible by definition, so "it did not take" and "not tried yet" look identical without it.
  A false raises a `ui:warning` toast; ordinary playback still swallows the same failure, since
  there the fallback must be the wrong device rather than no sound.
- Row layout reuses the two-part flex the gain and mic-test rows already use.

## Superseded: the keep-alive option (A), not built

An app that holds an audio session only while a clip plays cannot be found in Volume Mixer /
Sonar / OBS when a user goes looking. A silent zero-gain keep-alive would fix that; rejected as
out of character for the product. Recorded here so the reasoning is not re-derived.

## Test button PASSED, and it identified the original cause (2026-09-17)

Fabio walked the device list with it. Selecting Sonar **Media** or **Chat** directly → audible.
Selecting Sonar **Game** → `setSinkId` ACCEPTED (no warning toast, so `applySink` returned true)
and nothing audible. Game is the Windows default on that box, which is what the app followed
before this card existed.

That closes the loop on MPI-800's triage: the app was never broken. A Sonar channel can accept a
stream and emit nothing — the Windows session reads active with a real peak (`state=1
peak=0.2598`, measured) while the channel swallows it. Every layer we can observe from inside the
app reports success, which is why no amount of app-side probing could find this.

Also visible in his screenshot: the **MEDIA** channel is metering live audio while EVERY channel's
"Apps" box is empty. Sonar is naming no app at all, not just ours, so "the app never shows up in
Sonar" is not about the process being `electron.exe`. Confirms the retraction above, and he
believes it was already the case before this card.

Fabio's hypothesis: the built exe might be listed where `electron.exe` is not. Untested, and his
own screenshot argues against it — the empty Apps boxes are empty for every app, not only ours.
The 10-second discriminator is to play audio in Edge (which he hears) and watch whether **Edge**
appears in any Apps box. If Edge appears and we do not, the exe theory has legs and a portable
build settles it; if Edge does not appear either, Sonar is not enumerating sessions at all and the
executable name is irrelevant.

Nothing to build from this. An endpoint that accepts a stream and drops it is undetectable from
the renderer — there is no audibility signal to read. Walking the list with the Test button IS
the answer for a user in this position, which is what option B bought.

## Note for whoever touches this next

A device pinned in our Settings OVERRIDES the user's own per-app routing at the OS level. The
empty default does not, which is why it is the default and why nothing auto-picks a device.
