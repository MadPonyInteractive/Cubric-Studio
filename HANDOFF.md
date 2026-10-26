# Handoff: act on AUDIT.md (first batch)

**From:** cloud session of 2026-10-26 that produced `AUDIT.md` (read-only audit, nothing executed).
**Branch:** `claude/youthful-cerf-jy5ms7`. Read `AUDIT.md` first; finding IDs below (H2, B1, X3…) refer to it.

## State you inherit

- `AUDIT.md` — ranked findings with file:line, fix, risk, GPU-free yes/no. Nothing in it was
  measured or run: the audit was done with grep/read only because the shell was blocked.
- `.claude/settings.json` — hooks now resolve via `$CLAUDE_PROJECT_DIR`. Before this change every
  `PreToolUse` hook pointed at `c:/AI/Mpi/Cubric-Vision/...` and blocked **every** shell command
  outside Fabio's Windows box. If your shell is blocked, you are on a checkout without this commit.
- Both are in one commit on this branch. Nothing else changed.

## Cloud environment notes (first cloud use for this project)

- **GitHub access:** the first session could CLONE but not PUSH (`403: Claude doesn't have GitHub
  access ... for your organization`). If your push fails the same way, stop and tell Fabio — fixing
  it is an org-admin step (install the Claude GitHub App on `MadPonyInteractive/Cubric-Studio`),
  not something to work around. Work that is not pushed is lost when the container is reclaimed.
- **No `node_modules`.** Run `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` first (the Electron binary is
  not needed for lint or unit tests, and its download may fail through the proxy).
- **What can run here:** `npm run lint`, `npm test` (node --test). **What cannot:** the app,
  `npm run test:desktop` (Electron/Playwright, Windows CI only), ComfyUI, any GPU or Pod work.
  So the first batch is chosen to be verifiable by lint + unit tests alone; anything needing the
  desktop suite is called out and must be confirmed by Fabio locally or by CI.
- **The Mpi-Kanban plugin is NOT installed in the cloud** (`~/.claude/plugins/installed_plugins.json`
  is empty), so `task_ops.py`, `validate_board.py` and the `/mpi-*` skills are absent. `CLAUDE.md`
  still requires a card in `doing` before code edits. Either ask Fabio whether to hand-write the
  card per `.claude/rules/kanban.md` (schema, both event logs, `files.json`, `checklist.md`) or to
  track this batch in the PR description instead. Do not guess; the board is public and shared.
- `.husky/pre-push` only gates pushes to `master`; this branch is unaffected. Do not push to master.

## Proposed first batch (low risk, verifiable without a GPU)

Confirm the scope with Fabio before starting; he may want a different slice.

1. **H2** — enable `no-unused-vars` in `eslint.config.js` (warn first; `args: 'none'`,
   `varsIgnorePattern: '^_'`), and drop the unused `@eslint/js` import (or spread its recommended
   config). Run `npm run lint` to size the backlog and fix it. This supersedes the sampled **X3** list.
   Note `lint` runs with `--max-warnings=0`, so a `warn` rule fails lint until the backlog is clear.
2. **B1 + D2 (backend half)** — one helper module for `/project-file?path=` ↔ disk path
   (decode ONCE, as `projects.js` `decodeProjectFilePath` does) and the URL builders; replace the
   copies listed in AUDIT D2. Add a node test with `%`, `&`, `#`, spaces, unicode and `&v=` suffix.
   Fixes the double-decode bug and the non-busted GIF URLs (B5).
3. **B2 + D4** — `createToolSettings(toolKey, DEFAULTS, { delayMs })` whose `dispose()` FLUSHES
   pending writes; migrate the 8 `MpiToolOptions*` panels. Desktop-suite confirmation needed
   (change a setting, switch tool within 200 ms, reopen) — flag it for CI/Fabio.
4. **B3** — `MpiGalleryGrid.js:1521` duration rounding (`0:60`): use `formatClock` from
   `js/utils/elapsedTicker.js`.
5. **X1 + X2** — delete `js/utils/async.js`, `js/utils/images.js`, `js/components/shaderBackground.js`
   and update `.claude/rules/dos_and_donts.md` / `docs/utils.md` that still recommend the first two
   (rule files need Fabio's explicit OK per CLAUDE.md rule 5 — ask). `npm uninstall
   electron-context-menu firacode jetbrains-mono`; remove the dead Fira Code and VT323
   `@font-face` blocks. Check `scripts/build-portable.mjs` (`build:portable:dry-run`) still passes.
6. **D5** — one decimal `formatBytes` + `formatSpeed`; delete the unused `js/utils/file.js`
   `formatBytes`; replace the local copies. Visible label change: mention it in the PR.
7. **Hook follow-up** — the three Stop hooks (`bump-rebuild-reminder.py`, `handoff-index-drift.py`,
   `kanban-event-schema.py`) hard-code `REPO = "c:/AI/Mpi/Cubric-Vision"` and silently check
   nothing elsewhere. Derive it from `Path(__file__).resolve().parents[2]`; keep `--selftest` green.

Commit each item separately (`git commit --only <paths>`; `git add` new files first), run
`npm run lint && npm test` before each push.

## Explicitly NOT for the cloud

AUDIT P4–P6, P9–P11 (canvas readbacks, Pod uploads, undo) need a local profile or a Pod.
P1/P3 (sidecar GC, bulk delete) touch code with three past race fixes — do them only with the
existing race tests green and ideally with Fabio watching. D7/D9 (canvas managers, the two
workspace Blocks) need the desktop suite.

## Open questions for Fabio

- Kanban card for this batch: hand-written card, or PR-only tracking while in the cloud?
- OK to edit `.claude/rules/dos_and_donts.md` (stale `async.js`/`images.js` advice, the
  `seed`/`gallery` icon note)?
- Routes listed in AUDIT X4 as "public HTTP API per skill docs" — keep or trim?
