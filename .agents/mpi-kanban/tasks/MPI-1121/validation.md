# MPI-1121 validation

- Root cause matched to the live log (2026-10-13): model-level complete and node install at 00:01:42; the checkpoint dep's own 'end' (marker clear + `_startPendingDeps`) at 00:02:03.298, same ms as the `checkpoints/` folder mtime. The app re-checked between the two and read ILL Anime not installed.
- `tests/download-verify-holds-transport.test.cjs`: fails with `_verifyingDeps` removed from `_isDepTransportLive`, passes with it (2 cases: verify pass holds then releases; verify mismatch releases).
- Green: install-reconciler (17), download-retry (7), download-completion, download-silent-job, install-start-settles, install-feedback, download-job-denominator, remote-install-concurrency.
- CI on efa9aef96: first run red on `llm-settings-remote.spec.js` MPI-993 (stubbed Ollama settings UI, cannot reach this change; green 3/3 locally); green on rerun of the failed jobs.
- Takes effect in Fabio's running app after a restart (server code).
