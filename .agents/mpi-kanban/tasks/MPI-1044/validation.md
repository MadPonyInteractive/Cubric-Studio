# MPI-1044 Validation

Release 2.1 readiness, closed 2026-10-19. Item-by-item evidence is in `checklist.md`; the gates:

## 2.1.0
- Engine 0.42.1: local gate 252/252 floor, 0 IMPORT FAILED; Pod smoke `--all` PASS 65 / SKIP 1 / FAIL 0, 18/18 Flows (evidence 0c11b4cdc); release image v0.28.0 pinned stable (a7be64bcc).
- Published `--latest` at tag 4a52fb289 after Fabio's Gate 2; `releases/latest` = v2.1.0, 6 assets, sizes equal to the local builds.
- MCP bundle 0.3.2 released and on the MCP Registry; website guides live; IndexNow HTTP 202; Enhance + Describe eye test passed (Fabio).

## 2.1.1 (six fixes: MPI-1205, 1206, 1199, 1203, 1202, 1201)
- Notes approved by Fabio (`release:approve`, hash acab3e0b), committed b60ed5303; tag v2.1.1 -> b60ed5303.
- CI green on every code commit: 809cce797 (39299834217), ea0f11f0c (39300367655), d20daa9c3 (39306413245, re-run after an unrelated upload-cancel flake), b60ed5303, 95b3e0c8c.
- mpi-ci 39313364316 built it; BUILD_HASH b60ed53033cc.
- Update test from the PUBLISHED 1.5.0 on a fresh install (e): 29/29 user-data byte-identical, the app moved its own engine 0.34.0 -> 0.42.1, one engine start, one pip pass, first-launch SDXL picture opened and matches the prompt (`dev_configs/update-evidence.json`); `release:check:publish` passed.
- Published `--latest` after Fabio's Gate 2; `releases/latest` = v2.1.1, draft false, prerelease false, 6 assets `uploaded`, byte sizes equal to `D:/CubricStudio/Vision/Builds/v2.1.1`.

## Left to Fabio
- Deleting D:/CVTest test installs (b, c, d, e) and docs-*-test folders (the rm safety check refuses D:\ top-level folders).
