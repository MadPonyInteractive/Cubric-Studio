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

## Not verified

- A real multi-GB portable on a slow disk, and the Linux/macOS uv path on a real machine. The
  uv half is client-side labelling of events the server already sent.
