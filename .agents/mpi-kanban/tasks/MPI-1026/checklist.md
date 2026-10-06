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
- [x] Commit + push master (`30ea77df6`); CI green on it at attempt 3 (run 37365763898): attempt 1 never got a runner, attempt 2 lost its runner mid desktop shard 3 - GitHub Actions major outage 2026-10-05, no test ever failed
- [x] Tag `v2.0.1` = `30ea77df6` pushed 21:19Z; dispatcher run 37375088078 ok; mpi-ci build run 37375120690
- [x] Build 37375120690 green on all 3 legs in 14 min, each at `HEAD is now at 30ea77df6`, each `No baseline ...; full bundle`; 6 assets in `D:/CubricStudio/Vision/Builds/v2.0.1/` (flattened), all archives integrity-tested (tar needs `--force-local` in Git Bash), update manifests fromVersion null / toVersion 2.0.1 / ~7.2k files; 3 CI artifacts deleted
- [x] Update test (Windows): 1.5.0 copy with engine -> 2.0.1 via its own update-from-zip.bat, exit 0; 385/385 user-data + models files byte-identical; scratch Documents renamed Cubric Vision -> Cubric Studio, both projects listed; engine installed 2.0 packages; SDXL t2i 768x1024 in 81 s under the GPU lease, image opened (red bicycle, white brick wall); `dev_configs/update-evidence.json` written (uncommitted until close); `release:check:publish` green
- [x] Gate 2: Fabio OK'd `release-body-2.0.1.md` (2026-10-06, after the Windows line was filled from the test) and said proceed with publishing - in the next session (handoff)
- [ ] **ON HOLD (Fabio, 2026-10-06):** 2.0.1 now also carries a peer session's fixes - MiniMax H3 gets no reference video (errors) + two small improvements. The 30ea77df6 build is OBSOLETE. When the peer lands on master, CI green: update `RELEASE_NOTES['2.0.1']` + `docs/releases/2026-10-05-v2.0.1.md` + `release-body-2.0.1.md`, Fabio re-runs `npm run release:approve`, move tag `v2.0.1` to the new commit, rebuild 3 legs, redo the Windows 1.5.0 update test + `update-evidence.json`, Gate 2 again
- [x] Hold lifted 2026-10-06: MPI-1028/1029/1031/1032/1033/1034 on master, CI green through `546dc5fc1`. Notes redone (8 fixes), archival note renamed `2026-10-06-v2.0.1.md`, UNRELEASED folded, Fabio re-approved (token 14:05Z), Gate 1 OK; `acf2dc384` pushed, CI run 37476235455 green (unit + 4 desktop shards)
- [x] Tag `v2.0.1` moved to `acf2dc384` (delete + fresh push, no force); dispatcher 37478057897 ok; mpi-ci build 37478074382
- [x] Empty draft release 404413440 deleted; stale 30ea77df6 assets deleted from `D:/CubricStudio/Vision/Builds/v2.0.1/`
- [ ] Download the 6 new assets, integrity-test, delete CI artifacts; Windows update test from `D:/CVTest/CubricVision-v1.5.0-to-v2.0.1b/` (pristine 1.5.0 + 1.4.4 engine + extra_model_paths to 1.4.4 models, prepared); rewrite `update-evidence.json`; `release:check:publish`
- [ ] `gh release create v2.0.1` (Fabio go); `releases/latest` = v2.0.1, not draft, not prerelease
- [x] Removed the `2.0.x` worktree; local `2.0.0` reset to `origin/2.0.0`

## Decisions

- FULL update bundle, not a delta: a 1.5.0 install's Update takes the LATEST release's `CubricStudio-windows-x64-update-v*.zip`, and its applier refuses any delta not built from 1.5.0, so a 2.0.0-based delta would strand every user not yet on 2.0. CI emits full when `release-baselines/<plat>-<arch>.json` is absent. Now standing policy (baselines README).
- Update test runs from 1.5.0, the oldest install a full bundle serves (`oldestServedVersion`, fe7bf452d on master).
- [x] Versioning scheme changed (Fabio, 2026-10-05): 3rd digit = every routine release (model, Flow, op, fix, engine), 2nd = big visible step (new workspace, main-screen redesign, schema change), 1st = new generation, his call. `docs/versioning.md`, both release skills, memory.
