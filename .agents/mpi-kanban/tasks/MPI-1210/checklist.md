# MPI-1210 checklist - 2.1.2 release

- [x] Preconditions (2026-10-21): master = v2.1.1, pushed, CI green; no baseline json;
      Pod dev = stable (wrapper 0.2.48); MCP bundle tools in sync (28); engine core tag unchanged
- [x] Wait for the hotkey fixes (Fabio, 2026-10-21: they ship in 2.1.2)
- [x] Version bump 2.1.1 -> 2.1.2 (`mpi-version-bump`, quick path: no op/engine/schema change)
- [x] `npm test` + `npm run test:desktop` + `npm run release:deps` green
- [x] Gate 1: Fabio reviews the in-app changelog, runs `npm run release:approve`
- [x] `npm run release:check`, commit by pathspec, Fabio OKs push of master
- [x] Fabio OKs the `v2.1.2` tag push (CI build); download 6 artifacts
- [x] Windows zip signature census: every .exe/.dll/.node `Valid`
- [x] Update test from >= 2 releases behind + one real generation; `update-evidence.json`
- [x] Gate 2: Fabio reviews the GitHub release body
- [x] Fabio OKs `gh release create`; `releases/latest` = v2.1.2, not draft/prerelease
- [x] After public: flip "unsigned" wording (README.md, github-release-checklist.md); in the checklist also drop the rule that every body sends pre-1.5.0 installs to the full zip (Fabio, 2026-10-21)
- [x] After public: push website `0d1de08` (privacy page, HF token)
