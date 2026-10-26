# Handoff: AUDIT.md first batch — done, in PR #12

**Branch:** `claude/youthful-cerf-jy5ms7` · **PR:** MadPonyInteractive/Cubric-Studio#12 (ready for review)
· **Updated:** 2026-10-26, end of the cloud session that did the work.

Read the PR description first: it lists every change, what each commit verified, and the
visible label changes. `AUDIT.md` is the source of the finding IDs used below.

## Done in this PR (one commit each)

| Audit ID | What |
|---|---|
| H1 | `.claude/settings.json` hooks resolve via `$CLAUDE_PROJECT_DIR` (shell works off Windows) |
| H2, X3 | `no-unused-vars` on; 78 findings cleared |
| — | `scripts/smoke-workflows.mjs` records the GPU the run really got (found by H2; unverified, Pod-only) |
| B1, B5, D2 | `services/projectFileUrl.js`: one `/project-file?path=` <-> disk-path helper; the double decode is gone |
| B2, D4 | `js/services/toolSettings.js` for the 8 tool panels; `projectService` settings queues pinned to their project, `flushPendingSettings()` before open/delete |
| B3 | audio card length no longer reads `0:60` |
| D5 | decimal `formatSpeed`; GIF badges use `formatBytes`; dead `file.js` copy deleted |
| X1, X2 | dead utils, `shaderBackground.js`, 3 unused packages, Fira Code / VT323 fonts removed |
| — | Stop hooks find the repo from their own path |
| — | `mpi/no-raw-event-listener` + `mpi/no-raw-console` normalise path separators (they never ran on Windows CI); the 142 violations they had let through are fixed |

## Still open on this PR

- **One manual check in the app** (no spec covers it): change a setting in a tool panel, switch
  tool within 200 ms, come back, then reopen the project. The setting should hold.
- Review and merge. CI is the Windows `Tests` workflow on PRs to master.

## Left alone on purpose

- `MpiProjectName` / `MpiQueuePanel` keep local byte formatters (decimal already; merging them
  changes spacing and precision on screen — a visual call for Fabio).
- `connector.js`, `mcp.js`, `agentLoop.mjs` already decode `/project-file` URLs once; ~30 plain
  inline URL builders in `projects.js` / `ffmpegThumb.js` are correct as written.
- Three tests filled counters they never asserted (agent-loop, comfy-vanished-prompt,
  thumb-strip); the counters were removed. Possibly a missing assertion each — worth a look.

## Next batch candidates (from AUDIT.md, not started)

- Low risk, GPU-free: **B4**, **B6**, **D8**, **D6**, **H3**, **X4** (ask Fabio before trimming
  routes the skill docs list), **T1/T2**.
- Then **D1** (PromptBox slider x17), **D3/D10** route by route, **P2/P14/P7/P12/P13**.
- Needs the desktop suite or Fabio watching: **P1**, **P3**, **D7**, **D9**.
- Needs a local profile or a Pod: **P4–P6**, **P9–P11**.

## Working notes for the next agent

- Lint now passes on Linux too (`npm run lint`, `--max-warnings=0`), so a new warning anywhere
  fails it — on Windows CI as well, since the two path rules work there now.
- `npm test` on a Linux cloud container has 16 environmental failures (RunPod, agent
  installers, `sh` scripts, Windows `wmic`); compare failing-test NAMES before and after a
  change, not the exit code.
- Cloud setup: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`. No app, desktop suite, ComfyUI or GPU.
  The Mpi-Kanban plugin is not installed in the cloud; this batch was tracked in the PR instead
  (Fabio's call). Ask before assuming the same next time.
