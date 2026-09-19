# MPI-824 — A pinned audio output device fails silently when its endpoint goes stale

## What the user saw

"I had restarted the app a few minutes ago, and my audio settings changed. The output
changed." Fabio had been re-picking the device over and over without knowing why it kept
coming back.

The setting is NOT lost. `mpi_audio_output_device` persists correctly: localStorage lives in
the Electron profile, and Chromium's `media.device_id_salt` persists beside it in
`Preferences`, so a stored deviceId still hashes the same next launch (measured: two runs of
a scratch Electron 41.1.1 against one profile returned byte-identical ids for all 22
devices). What fails is APPLYING it.

## Evidence

`%APPDATA%/Cubric Studio/logs/` — five separate sessions on 2026-09-19, one line each
(`applySink` warns once per session per reason):

```
[2026-09-19T11:06:24Z] [WARN] [audio] setSinkId(3aac61a8…) failed: NotFoundError Requested device not found
[2026-09-19T11:11:22Z] [WARN] [audio] setSinkId(3aac61a8…) failed: NotFoundError
[2026-09-19T11:22:41Z] [WARN] [audio] setSinkId(3aac61a8…) failed: NotFoundError
[2026-09-19T11:55:21Z] [WARN] [audio] setSinkId(3aac61a8…) failed: NotFoundError
[2026-09-19T15:04:18Z] [WARN] [audio] setSinkId(3aac61a8…) failed: NotFoundError
```

The write history in the profile's leveldb shows him fighting it:
`a020aa6a → 3aac61a8 → 884df1b2 → ba6f6d94 → 3aac61a8 → 9d6d1c4e`.

Those ids were mapped back to real endpoints by recomputing Chromium's
`GetHMACForMediaDeviceID` — HMAC-SHA256, key = origin, message = rawEndpointId + salt — over
all 109 MMDevice endpoints in the registry (4 of 5 matched, which validates the method; the
salt itself is deliberately not recorded here):

| id | device | state now |
|---|---|---|
| `a020aa6a` | Speakers | ACTIVE |
| `3aac61a8` | SteelSeries Sonar - Media | ACTIVE |
| `884df1b2` | SteelSeries Sonar - Chat | ACTIVE |
| `ba6f6d94` | SteelSeries Sonar - Gaming | ACTIVE |
| `9d6d1c4e` | **no match — endpoint no longer exists** | — |

## Two distinct failure modes, one symptom

1. **Late registration.** `3aac61a8` still maps to a live, ACTIVE endpoint today, so its id
   never rotated — it simply was not visible to Chromium when the app first played. Sonar
   registers its virtual endpoints after Cubric's first `play` fires. Fabio reached this
   himself: "perhaps the output wasn't available when Cubric tried to connect."
2. **GUID churn.** `9d6d1c4e`, the value stored right now, matches nothing across Render or
   Capture. Sonar regenerates endpoint GUIDs, so a pinned id can die outright while a device
   with the same NAME sits there.

Both land the same way: `applySink` catches, returns false, playback stays on the OS default,
and the only trace is a warn in `app.log`. `MpiSettings` then mounts the dropdown with a
`value` that is not in `options`, so it renders the placeholder — the panel reads
"System default" while a dead id is still in the store.

## Ruled out

- **Not a persistence bug** — see above, the store and the salt both survive.
- **Not the renderer needing `enumerateDevices()` first.** Plausible (nothing enumerates on a
  normal launch until Settings opens), but measured false: in a fresh renderer
  `setSinkId(storedId)` returned OK *before* any `enumerateDevices()` call.
- **Not the `speaker-selection` permission** — `main.js` already allows `media` and the
  check handler is installed.

## Why this is worse than before the feature

MPI-803 was built for exactly this box: the Windows default endpoint was a Sonar channel
Fabio does not monitor, so the app emitted into silence. But an unpinned element FOLLOWS the
OS default live, while a pinned id is a snapshot that can go stale. On a box whose endpoints
churn, the picker is strictly more fragile than the thing it replaced — which is why he says
"it's only after some changes that we've made that I was forced to create an output dropdown,
and now this is happening."

## The decision needed

`applySink`'s tolerance is deliberate (`js/utils/audioOutput.js`: "a device unplugged today is
usually back tomorrow"). Keeping the pick is right. Failing silently is not. Options:

1. **Re-resolve by label.** Store `{ deviceId, label }`; on `NotFoundError`, find a current
   device with the same label, use its id and re-store it. Survives GUID churn without the
   user touching anything. ~15 lines.
2. **Re-apply on `devicechange`.** A `navigator.mediaDevices.addEventListener('devicechange')`
   hook that re-runs `applySink` over live elements. Fixes late registration. ~5 lines.
3. **Say so.** A toast, or an inline note on the Settings row, when the stored device cannot
   be applied — and show the stored-but-missing pick in the dropdown rather than silently
   rendering the placeholder. `MpiLlmSettings` already has this pattern:
   `{ value, label: value, meta: 'Not listed' }`.

1 + 2 + 3 together are the complete fix. 3 alone is the minimum that stops the app lying.

## Files this would touch

`js/utils/audioOutput.js`, `js/core/storage.js`, `js/core/storageKeys.js`,
`js/components/Compounds/LandingPages/MpiSettings/MpiSettings.js`, plus
`tests/audio-output.test.cjs`.
