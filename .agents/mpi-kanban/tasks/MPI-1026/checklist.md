# MPI-1026 checklist - release 2.0.1

Line: **master** (Fabio, 2026-10-05: every release is cut from master and master carries
the version). First cut on the `2.0.0` maintenance branch in worktree
`C:/AI/Mpi/Cubric-Vision-2.0.x`, then moved to master the same session; that branch work
(local `56ac7030d`, never pushed) is discarded.

- [x] Preconditions: Pod runtime dev = stable (0.2.45), engine pin unchanged (v0.34.0), MCP tools unchanged since v2.0.0
- [x] Fix on master already (e9dd61463, CI green); fallback test 4/4
- [x] Stamp 2.0.1 on master: appVersion / package.json / package-lock, `RELEASE_NOTES['2.0.1']`, `docs/releases/2026-10-05-v2.0.1.md`
- [x] Delete `release-baselines/*.json` so CI emits a FULL update bundle
- [x] `npm run release:check` green; `npm test` on master 2721 pass / 0 fail; `npm run release:deps` 304/304 URLs reachable
- [x] Gate 1: Fabio OK'd the in-app changelog copy (2026-10-05)
- [x] Release skill + `release-baselines/README.md` rewritten for one-release-per-change from master
- [x] Approval preview fixed: `scripts/release-notes-approval.mjs` kept the retired alpha/beta rule and previewed 2.0.1 as "Alpha" while the app shows "Release"; now matches `js/core/appStage.js`, pinned by a new check in `tests/release-notes-preview.test.cjs` (fails on the old copy, 3/3 on the new). Hash never covered the label.
- [x] Local desktop run (old 2.0.x worktree): 187 pass / 17 fail / 13 not run - 15 are Windows 0xC0000142 (process init failed, machine out of resources), 1 failed launch, 2 popup clicks in the same window; same code is CI-green (e9dd61463). The stamp commit gets its own CI run.
- [x] Fabio ran `npm run release:approve` (token `docs/releases/.approved-2.0.1.json`)
- [ ] Commit + push master; CI green on the stamp commit
- [ ] Push tag v2.0.1 (fires the private build); download the 6 artifacts to `D:/CubricStudio/Vision/Builds/v2.0.1/`; delete the CI artifacts
- [ ] Update test: published 1.5.0 copy -> 2.0.1 full update zip, user-data intact, real generation opened; `dev_configs/update-evidence.json`; `npm run release:check:publish`
- [ ] Gate 2: Fabio reviews `release-body-2.0.1.md` (Windows line filled from the test)
- [ ] `gh release create v2.0.1` (Fabio go); `releases/latest` = v2.0.1, not draft, not prerelease
- [x] Removed the `2.0.x` worktree; local `2.0.0` reset to `origin/2.0.0`

## Decisions

- FULL update bundle, not a delta: a 1.5.0 install's Update takes the LATEST release's `CubricStudio-windows-x64-update-v*.zip`, and its applier refuses any delta not built from 1.5.0, so a 2.0.0-based delta would strand every user not yet on 2.0. CI emits full when `release-baselines/<plat>-<arch>.json` is absent. Now standing policy (baselines README).
- Update test runs from 1.5.0, the oldest install a full bundle serves (`oldestServedVersion`, fe7bf452d on master).
- [x] Versioning scheme changed (Fabio, 2026-10-05): 3rd digit = every routine release (model, Flow, op, fix, engine), 2nd = big visible step (new workspace, main-screen redesign, schema change), 1st = new generation, his call. `docs/versioning.md`, both release skills, memory.
