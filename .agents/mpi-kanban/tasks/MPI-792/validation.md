# MPI-792 validation

## Real install path (server)

`scratchpad/e2e/run.cjs`: the real `POST /engine/download` (Windows archive branch) with
`CUBRIC_ENGINE_ROOT` / `CUBRIC_MODELS_ROOT` / `APP_USER_DATA` in a scratch folder, a local file
server (646 MB 7z with 3,000 files and one 640 MB file, two node zips, an 8 MB weight served
at ~1 MB/s) and a stubbed 3-dep UW set. Every SSE event recorded.

- `engine:extracting`: 41 events over ~4.1 s, percent 0 -> 99 (14 distinct), max gap 418 ms,
  40 of them carrying a file name. (Before: per-file `data` in bursts, probe max gap 1.2 s on a
  smaller archive, and one event per file on the real portable.)
- `Downloading remaining components...` at 6.2 s while the weight was still streaming.
- `Installing custom nodes (1 of 2)...`, `(2 of 2)...` with `phase: 'nodes'`, both nodes on disk.
- No `Installing dependencies...` / `waiting for engine` from the provisioner's UW call.
- `engine:patching` -> `engine:complete`.
- The up-front HEAD pass is gone: the first engine byte flowed 40 ms after the request.

## Screen (client)

`scratchpad/harness/`: a static server over the repo tree plus one page that mounts the REAL
`MpiEngineInstall` / `MpiStartingComfy` with the real CSS.

- The 10,049 events recorded above replayed through the component: **12 screen-state
  transitions, 0 A-B-A flips**, steps `A-- -> DA- -> DDA -> DDD`, meter
  `busy -> bytes -> busy -> unpack -> bytes -> busy -> done`.
- Screenshots checked for: download (heat bar, bytes, speed, ETA), unpack without a percent
  (spinner, no byte bar), unpack with a percent (frost bar), remaining components, node step,
  finishing, complete (ok bar, three checks), uv output line (ellipsised), repair flow, the
  quiet hint after 15 s, and the starting-comfy modal with clock + hint.
- `engine:ready` emitted exactly once on complete; POSTs went to `/comfy/set-path` +
  `/engine/download` (install) and `/engine/repair-deps` (repair) as before.

## Tests

- `tests/install-feedback.test.cjs` (3): clock format; ticker paints at once and every second,
  hints only after the quiet window, rotating, cleared by `touch()`, stopped by `stop()`.
  Negative control: removing the quiet-window gate fails the rotation test.
- `npm test`: 1236 tests, 1235 pass, 0 fail. `eslint` clean on the three frontend files.
- `tests/uw-partial-install.test.cjs` and `tests/engine-asset-visibility.test.cjs` still read
  the edited sources and pass.

## Pass 2: the quit warning covers the whole engine job

Cause: `main.js` asked `GET /comfy/downloads/active`, whose `engine` flag was true only while
`_activeEngineDownloader` was registered — the archive download. Unpack, the uv install, the
node step, repair, upgrade and the first-start pip pass all quit silently.

- `routes/engineJobs.js` counter; held by `/engine/download`, `/engine/repair-deps`,
  `/engine/upgrade` and the `ensureCuratedPythonDeps` call in `/comfy/start`. The route reads
  it; the archive-only flag and `registerEngineDownload` / `clearEngineDownload` are gone.
- `main/quitWarning.cjs` words the dialog; `main.js` uses it.
- `tests/install-feedback.test.cjs` +4 tests (counter nesting, route with a job and no
  download, wiring on all four sites, dialog copy). Negative control: route forced back to
  `engine: false` fails the route test.
- Real Electron (`scratchpad/quitprobe/probe.cjs`: scratch profile, port 54792, scratch engine
  root, `dialog.showMessageBox` stubbed in the main process): idle `engine:false`; after
  `POST /engine/download` `engine:true`; closing the window produced ONE dialog — title "The
  engine is still installing", buttons `Quit anyway` / `Keep installing`, defaultId 1 — and
  the window stayed on "Keep installing"; closing again with "Quit anyway" exited the app.
  12 MB of the real portable had landed in the scratch root (deleted).
- `npm test`: 1240 tests, 1239 pass, 0 fail. eslint clean on the touched frontend + main files.
- The user looked at the install screen (Browser pane replay) and approved it, 2026-09-17.

## Not verified

- A real multi-GB portable on a slow disk, and the Linux/macOS uv path on a real machine. The
  uv half is client-side labelling of events the server already sent.
