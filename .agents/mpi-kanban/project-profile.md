---
schema: mpi-kanban/project-profile/v1
mode: scalable-foundation
mode_rationale: user-confirmed at setup and re-confirmed 2026-08-09; strong repo evidence (21 .claude/rules, docs/ tree with a routing map, schema versioning, CI on push, 0 board violations)
mode_source: user
pack_version: 1.7.0
push_policy: auto
setup_date: 2026-05-23
last_refresh: 2026-10-23
last_refresh_notes: 'Refresh on Mpi-Kanban 1.7.0 (profile recorded 1.6.0; installed is NEWER, not stale). 1.7.0 slims the skills: mpi-continue, mpi-handoff and mpi-end-session became routers over sibling files, and the card-move recipes (moveTask, writeTask, ensureLinkedFiles, beginImplementation, appendEvent) moved from task-board-ops/mutate.md to implement.md. The repo leaned on that in .claude/rules/kanban.md only: line 4 pointed at mutate.md alone, rule 1 still called the done-card status an unfixed plugin defect (task_ops.py move sets it since at least 1.6.2), rule 6 described a four-write hand move plus a board.json events array that no longer exists, rule 5 warned of live seed maturities (none left), rule 7 said mutate.md writes the link not the file (task_ops.py move now refuses the move). All five updated. PROFILE: summary said MPI-708 was in doing and the rename not done in code - it closed 2026-10-01, productName and userData are Cubric Studio, package name stays cubric-vision; commands gained app:isolated and npm test. INDEX: two stale pointers - the app.log path (still Cubric Vision, no portable path) and project_website_subdomain_strategy.md (archived 2026-10-23, replaced by project_website_revamp_studio_only.md). BOARD: 647 cards (74 todo / 9 doing / 564 done), next_id 1264 = max+1, no duplicate ids, maturities valid and column-coherent, 194 file-claim records clean, no interop.json. Only validator red was active_sessions (2 live missing), cleared with validate_board.py --fix. RULES: behaviour.md byte-identical to the 1.7.0 template; 22 briefing rules listed, none missing or unlisted; 3 archetypes match 3 bundles; gpu_command_patterns present. SPRAWL: 74 todo, but umbrellas MPI-1063/1102/1134/1179/1187/1188/1189 cover every recent card; no new cluster of 3+. 67 todo cards have empty files.json - normal, written at todo->doing. KEPT: kanban.md:370,428 python -c uuid one-liner, as last refresh. NOT DONE: 72 handoff files in state/handoffs (6 open) - mpi-cleanup territory.'
prior_refresh_notes: 'Refresh on Mpi-Kanban 1.6.0 (profile recorded 1.5.1; installed is NEWER, not stale). 1.6.0 changes reports and stops: every report opens with a breaker line, the brief is Next/How/Risk, mid-work stops are a fixed list, close-out approvals print as Your call lines and do not wait, and safe board repairs apply without asking; mpi-init and mpi-project-refresh keep their one proposal stop. Only two repo files leaned on the old contract: the knowledge index no-topic fallback (now a bounded search before asking for a pointer) and close-out.md, which twice said close-out waits for per-file approval (now one Your call line per file, written only on a yes). BOARD: 354 cards (79 todo / 15 doing / 260 done), next_id 970 = max+1, no duplicate ids, maturities valid and column-coherent, 581 file-claim records pass. The only validator red was active_sessions (2 closed sessions listed, 2 live ones missing) - the session-hook gap 1.6.0 names - cleared with validate_board.py --fix; state/ is local-only here. RULES: behaviour.md byte-identical to the 1.6.0 template (unchanged since 1.5.1); 22 briefing rules listed, none missing or unlisted; plugin hooks unchanged since 1.5.1, so no double-fire. INDEX: 127 pointers, 0 dead. SPRAWL: 6 todo cards since 2026-09-26, MPI-962 already umbrellas MPI-959, no new cluster of 3+. KEPT: kanban.md:370,428 python -c uuid one-liner, as last refresh. MEMORY: global tools/mpi-kanban.md claim-release entry amended for 1.6.0.'
knowledge_index: .agents/mpi-kanban/project-knowledge-index.md
---

# Project Profile

## Project Summary

**The product ships as Cubric Studio (2.0); "Cubric Vision" is the repo's working name.** `origin` is the public `github.com/MadPonyInteractive/Cubric-Studio`. MPI-708 closed the user-facing rename on 2026-10-01: the app (`productName`), its `%APPDATA%` folder, mascots and sites say Cubric Studio, while internal identifiers — the `cubric-vision` package name, this folder, some code strings — still say Vision. A new agent meets both names. Treat them as the same product; do not "fix" an internal name to the other without a card for it.

Cubric Studio is a desktop Electron app that wraps ComfyUI as its generation engine for local open-source image and video creation. Users manage projects (history, models, LoRAs) through a 3-workspace UI (Landing → Gallery → Group History). It generates image, video AND audio — LTX 2.3 emits video+audio jointly and takes reference audio in, and further audio work folds in as Flows rather than a separate app (MPI-573, 2026-08-17). Prompt-gen is the one capability that lives in a sibling app (Cubric Prompt). Out of scope here is STANDALONE audio tooling, not audio itself.

## Architecture Summary

Architecture: Electron shell + Express server + vanilla-JS SPA — full map in `docs/PROJECT.md`.

## Conventions

See `CLAUDE.md` § "Critical Rules Snapshot" for the canonical list (BEM, ComponentFactory, no hardcoded colors, state proxy, project JSON writes, logging, kanban auth, claim files before editing, no destructive git on a shared tree, commit by pathspec — never `add -A`). Architecture rules live in `.claude/rules/*.md`.

## Important Commands

- `npm start` — launch Electron app
- `npm run app:isolated` — launch YOUR OWN instance (own profile + port); `:3000` is the user's live session, never drive it (`docs/testing.md`)
- `npm test` — node unit tests; with `npm run lint` it is the gate `.husky/pre-push` runs on every code push
- `npm run server` — run Express server only (no Electron)
- `npm run test:desktop` — Playwright Electron tests (sets `CUBRIC_E2E_USER_DATA`)
- `npm run lint` / `npm run lint:components` — ESLint
- `npm run release:deps` — dependency audit leg of the release gate
- `npm run release:check` — mandatory release-health gate before bump builds, pre-release generation tests, tags, pushes, or publication
- `npm run release:notes` — generate the release notes; `npm run release:approve -- --yes` approves them non-interactively (the old `printf 'y\n' |` pipe is blocked by the Bash classifier and reads as a hang)
- `npm run build:portable:dry-run` — stage-and-verify without producing the artifact
- `npm run build:portable:win` — build full Windows portable artifact (single source `scripts/build-portable.mjs`; `:linux` / `:mac` target other platforms via `--platform`/`--arch`). Stages to `D:\tmp\cubric-portable` (C: is space-constrained; never stage inside the repo — the script refuses it). Windows portable is install-validated (fresh install + model download + generation). Windows launches from a root `CubricVision.exe` (MPI-387 — `start.vbs`/`start-with-terminal.bat` are DELETED; Smart App Control blocks `.vbs`/`.bat` outright on a clean Windows 11). Linux/macOS still use `start.sh`. All three platforms are now real-host validated: Linux live (MPI-198, 2026-07-31), macOS on the rented Mac (MPI-414), and the in-app update flow end to end — fetch, spawn, apply, `evictBusyFile`, relaunch (MPI-334 → MPI-422, 2026-08-03; recipe in `docs/releases/portable-distribution-contract.md` § In-app update prompt).
- `node scripts/compile-node-deps.mjs [--check]` — MANDATORY when adding or bumping a custom node with `installRequirements: true` (MPI-413). `--check` reports what the node declares that `dev_configs/python_deps.in` does not cover; bare regenerates `dev_configs/python_deps.txt`, the single curated set the local engine installs in one `--no-deps` pass. Commit both files; never hand-edit the `.txt`. Full step: `docs/playbooks/add-model/02-dependencies-r2.md`.
- Read `logs/app.log` tail (offset, never full) for runtime debugging
- `node scripts/convert-images.cjs --prefix=<name> --out=<name>` — batch PNG/JPG → WebP for sibling website carousels (defaults: brand-assets marketing-media → website vision-media, quality 85).

## Read First

- `CLAUDE.md` — master routing
- `AGENTS.md` — Codex pointer
- `docs/PROJECT.md` — subsystem orientation hub
- `.claude/rules/dos_and_donts.md` — universal CSS/icon/utility rules
- This profile + `.agents/mpi-kanban/project-knowledge-index.md`

## Open Gaps

- Stage redesign phases 0–10.2 merged (commit `e9b5eb6`); follow-up phases (>10.2) not yet planned.
- Sibling repos (Website, Docs) need new Stage design ported; design source at `c:\AI\Mpi\CubricStudio_Redesign\` (no git).

## Mode Notes

- 2026-05-23: scalable-foundation. New work follows full guardrails (rules, BEM, factory, events, state proxy). No prototype shortcuts.
- 2026-08-09: re-confirmed by the user at refresh — "this is a huge project". Unchanged.
