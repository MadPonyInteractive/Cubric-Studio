# MPI-824 — validation

## What shipped

**1 — Re-resolve by label.** `AUDIO_OUTPUT_DEVICE` now stores `{ deviceId, label }`; a
pre-MPI-824 bare string migrates to `{ deviceId, label: '' }`. On `NotFoundError`,
`applySink` looks up the current id of an `audiooutput` whose label matches verbatim,
applies it, and re-pins the store. One lookup per dead id, not one per `play` — `applySink`
runs on every playback and a hover-scrubbed gallery makes hundreds.

**2 — Re-apply on `devicechange`.** `installAudioOutput` drops the attempt cache and
re-points every live `audio`/`video` element. Elements already on the right sink return
early, so it is free when nothing is wrong. `_warned` is deliberately NOT cleared: a mixer
that churns fires this repeatedly, and a warning per churn is a log nobody can read.

**3 — Settings says so.** A stored device the list no longer carries gets its own row,
labelled with its stored name and flagged `Not available`, plus an inline note on the Output
row. The flag carries `icon: 'warning'` because MpiDropdown ellipsises a plain meta at 11
characters (MPI-599) and "Not available" is 13 — without the icon it renders "Not availa…".

## Evidence

### The panel (real Electron, real component)

`tests/desktop/audio-output-missing-device.spec.js` mounts the real `MpiSettings` on a real
shell, stubs `enumerateDevices` (a CI runner has no audio hardware — provoking the
runner's condition deliberately, `docs/red-master.md` cause 1), and reads the rendered row.

Green on the fix:

```
ok 1 tests\desktop\audio-output-missing-device.spec.js:26:1 › a stored output device that
     no longer resolves is named, not hidden behind the placeholder (3.9s)
  1 passed (4.5s)
```

RED on pre-fix code — the three modules restored from `HEAD`, the spec untouched. The
failure IS the bug report:

```
Expected: "SteelSeries Sonar - Media"
Received: "System default"
```

That is exactly what Fabio saw: the panel reading "System default" while a dead id was
still in the store and still being applied on every play.

### The healing

`tests/audio-output.test.cjs`, 9 cases, all green:

```
✔ a stored id that no longer resolves is re-pinned from its label
✔ a device that is genuinely gone costs ONE lookup, not one per play
✔ an id that never resolves and has no label never even looks
✔ devicechange re-points live elements and re-arms the lookup
```

Four of the nine fail on pre-fix modules (`pass 5, fail 4`), the test file untouched.

One trap worth recording: the harness stubs `navigator` with `Object.defineProperty`, not
assignment. Node exposes `navigator` as a getter-only global, so `globalThis.navigator = …`
silently no-ops in sloppy mode and the stub never reaches the module — the first run looked
like the feature was missing.

### Suite and lint

`npm test` — 1415 tests, 1414 pass, 0 fail, 1 skipped.
`npx eslint` over all five changed files — clean, exit 0.

## Not done, deliberately

No toast when playback lands on the wrong device. With 1 and 2 in place the remaining case
is a device that is genuinely absent AND whose label matches nothing, and a toast fired from
`applySink` at boot — before a late-registering mixer has appeared — would be a false alarm
on exactly the box this card is about. The Settings row and the `app.log` warn carry it
instead. Worth revisiting if a silent wrong-device case is reported again.
