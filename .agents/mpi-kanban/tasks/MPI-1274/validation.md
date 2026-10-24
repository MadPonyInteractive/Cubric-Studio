# MPI-1274 validation

- `tests/engine-repair-unimportable.test.cjs` (new, 3 tests): the failed pack is wiped only after the
  killed engine exits, then re-fetched (`startUniversalWorkflowInstall(['RES4LYF'], false)`); a pack that
  is no dep of ours is left alone; a healthy engine reinstalls nothing; a failed re-fetch answers 500
  with its own reason. Pass, with `engine-import-failure` and `engine-job-single-flight` (16/16).
- Pre-push: lint + full unit suite green on a435ad630.
- CI on a435ad630: red 3 attempts on `tests/agent-loop.test.cjs` "fifty cards are ONE job ... queued
  fast" (1697-1884 ms vs a 1600 ms limit). It loads only `services/agentLoop.mjs` and fakes, none of
  this card's files; the same assertion failed on 137ab8fcd (a no-code handoff, 2026-10-23) at 1860 ms.
- Not checked live: no crashed RES4LYF on a real engine. RES4LYF recreates `res4lyf.config.json` from
  `web/js/res4lyf.default.json` when it is missing (`res4lyf.py` `get_extension_config`).
