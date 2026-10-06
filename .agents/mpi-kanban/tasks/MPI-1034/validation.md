# MPI-1034 validation

## Root cause (measured 2026-10-06, throwaway Electron 41 = the app's binary, own profile)

| constraint | device asked | device opened |
|---|---|---|
| `{ deviceId: { ideal: id } }` | Focusrite (fresh, valid id) | Default - SteelSeries Sonar - Microphone |
| `{ deviceId: { exact: id } }` | Focusrite | Analogue 1 + 2 (Focusrite), real signal |

Ids were stable across two launches, so this is not a stale salted id: Chromium overrides
an `ideal` deviceId with the default. All three mic consumers asked `ideal`.

## Why it surfaced today

The Windows default mic (SteelSeries Sonar - Microphone) was handing out digital silence to
everyone, not just the app: ffmpeg dshow capture read -91 dB, Focusrite read -28 dB peak on
the same pass. Fabio sees the same in WhatsApp and restarting Sonar clears it. With the
picker ignored, choosing another mic in the app could not route around it.

## After the fix

The real `js/utils/audioInput.js` loaded in that Electron:
- Focusrite picked -> "Analogue 1 + 2 (2- Focusrite USB Audio)", peak 0.0076
- dead id picked -> falls back to the default, no throw
- nothing picked -> the default

`node --test tests/audio-input.test.cjs`: 4/4. eslint on the touched files: clean.
