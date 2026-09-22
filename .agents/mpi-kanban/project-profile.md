---
schema: mpi-kanban/project-profile/v1
mode: scalable-foundation
mode_rationale: user-confirmed at setup and re-confirmed 2026-08-09; strong repo evidence (21 .claude/rules, docs/ tree with a routing map, schema versioning, CI on push, 0 board violations)
mode_source: user
pack_version: 1.5.0
push_policy: auto
setup_date: 2026-05-23
last_refresh: 2026-09-22
last_refresh_notes: 'Refresh on Mpi-Kanban 1.5.0 (profile had recorded 1.2.0; installed is NEWER, not stale). MPI-893 carries the work. BOARD CLEAN - 277 cards (83 todo / 17 doing / 177 done), next_id 893 = max+1, no duplicate ids, every board entry has a task.json, every maturity in the enum and column-coherent, root events.jsonl 4910 lines all parseable, kanban.md already tombstoned. ALL 17 validator violations were in state/, and 12 cleared with `validate_board.py . --fix`, which rebuilds the five derived arrays from each record''s status on disk - no heartbeat pruning, no judgement. Counts after: active_sessions 10->15, active_file_claims 6->7, pending_file_states 280->294, open_messages 41->37, active_handoffs 38->35. THE PLANNED HANDOFF PRUNE WAS DROPPED: Fabio corrected the premise mid-refresh - every session in his sidebar is ACTIVE even after weeks idle, so a stale heartbeat is NOT a dead session and a newest-wins prune would have deleted the resume path for work he intends to return to. Same reason nothing was pruned from active_tasks (MPI-623 at 494h, MPI-591 at 335h, both still in doing) and no message was resolved on my judgement. Of the 5 remaining violations - a file claim held by a ''closed'' owner session - only MPI-858''s was released: card done, its claimed paths clean in git. The other four are LIVE work whose session record merely says closed: 243e6d57/c25c427c/cb64609a are one session on MPI-888 (services/agentLoop.mjs, docs/agent/masking.md, tests/agent-loop.test.cjs) and d1ba816b is MPI-887, whose ten claimed paths match the dirty tree exactly. Both owner sessions were stamped closed at the SAME instant (2026-09-22T09:49:02Z) - a bulk close, not two sessions ending - and both carry active_file_claims: [] while their claim records name them, so those claims protect nothing on the session side. They must re-claim under their current session id. RULES: behaviour.md is again byte-identical to the 1.5.0 template. Its git section had drifted to 2 bullets where the pack ships 6, and the surviving bullet BANNED `git commit --only` - which CLAUDE.md, .claude/rules/git.md and the pack all MANDATE. The four restored bullets are the --only traps (untracked path aborts the whole commit; a DIRECTORY pathspec skips untracked files silently and exits 0; git status --short AFTER the commit). CONFIG: root-cause and engine-recipes both carried a `## Sub-Agent Briefing` and were never listed. root-cause was the expensive one - CLAUDE.md Sub-Agent Dispatch step 2 orders every dispatcher to paste it, and /mpi-brief-rule root-cause answered ''no such rule'' for every one of them. Now in all three bundles; engine-recipes in comfy-worker only. critical_snapshot_anchor corrected (it carried an ''applies-to-'' the heading does not slug to). HOOKS: .claude/settings.json PreToolUse matcher was `Bash` while the plugin''s is `Bash|PowerShell`, and Desktop on Windows drives a separate PowerShell tool - so guard-runpod-create.py was OFF on the primary shell, and it guards a route that RENTS A GPU. Widened. guard-shell-backticks.py checked and KEPT: 1.5.0''s guard-shell.py blocks heredocs, backslash-continuations and PowerShell @" here-strings but still has no rule for backticks inside a double-quoted python -c. INDEX: all 104 pointers resolve, 0 dead - but two live subsystems had no topic and now do: the in-app agent (docs/agent/, agent-chat/corpus/findings; MPI-774/817/889) and the mascot system (nine docs/mascot-*.md; MPI-777/846). SPRAWL: 83 todo, 24 umbrella plans already covered 47; four umbrellas created for the uncovered clusters. NOT findings, checked and dismissed: no pre-1.0 skills pack, no state/interop.json, no .claude/skills/mpi-end/ wrapper, no duplicate guard-destructive-git.py, 3 archetypes match 3 bundles, every profile npm command resolves, push_policy present and valid, and 76 of 83 todo cards having no files.json is the contract (ownership is written at todo->doing, never backfilled).'
prior_refresh_notes: 'Refresh on Mpi-Kanban 1.2.0. Board validated CLEAN - 0 errors across 167 cards (62/4/101), next_id correct, every maturity column-coherent, all event lines valid. GPU LEASE TURNED ON: `gpu_command_patterns` added to `.agents/mpi-kanban.local.md`, so `guard-gpu` now binds four commands that actually execute a generation (pre_release_test.py, smoke-workflows.mjs except --plan/--self-check, direct POSTs to 8188/48188 /prompt, /connector/generate). Probes, `npm start`, `app:isolated` and `/proxy/prompt` deliberately unmatched. Verified 12/12 both directions, and the guard fired live mid-refresh. The lease is MACHINE-GLOBAL (~/.mpi-kanban/gpu/<index>.lock, kernel flock, no TTL) but enforcement is PER-REPO - a sibling repo with no patterns still walks onto the card. Handoff desync repaired: 10 record files still said `open` after the index recorded them superseded, and MPI-325''s entry said `open` while its file carried the closure note - each fixed toward whichever side held the evidence, then `active_handoffs` pruned 19 -> 3. Three dead memory pointers repointed (all broken by the MPI-574 memory reorg four days after the last refresh). NOT a finding, checked and dismissed: 3 `active` session records looked orphaned but were Fabio''s two live agents plus this one, and `active_sessions: []` is normal - the pack never populates it, `guard-claim` reads the session directory. Card sprawl is NOT a finding either: 11 umbrellas already exist, each with a plan.md naming its members, covering 39 of 62 todo cards. Verified clean: behaviour.md byte-identical to the 1.2.0 template, 19 listed rules == 19 carrying a briefing, snapshot anchor resolves, 3 archetypes match 3 bundles, every profile command resolves in package.json, no pre-1.0 skills pack, no 1.0 migration leftovers.'
knowledge_index: .agents/mpi-kanban/project-knowledge-index.md
---

# Project Profile

## Project Summary

**The product ships as Cubric Studio (2.0); "Cubric Vision" is the repo's working name and the rename is NOT done in code.** `origin` is the public `github.com/MadPonyInteractive/Cubric-Studio`, the user-facing app, mascots and sites say Cubric Studio, and MPI-708 carries the code rename — it is in `doing`, so both names are live and a new agent will meet each of them. Treat the two as the same product; do not "fix" one to the other outside MPI-708.

Cubric Studio is a desktop Electron app that wraps ComfyUI as its generation engine for local open-source image and video creation. Users manage projects (history, models, LoRAs) through a 3-workspace UI (Landing → Gallery → Group History). It generates image, video AND audio — LTX 2.3 emits video+audio jointly and takes reference audio in, and further audio work folds in as Flows rather than a separate app (MPI-573, 2026-08-17). Prompt-gen is the one capability that lives in a sibling app (Cubric Prompt). Out of scope here is STANDALONE audio tooling, not audio itself.

## Architecture Summary

Architecture: Electron shell + Express server + vanilla-JS SPA — full map in `docs/PROJECT.md`.

## Conventions

See `CLAUDE.md` § "Critical Rules Snapshot" for the canonical list (BEM, ComponentFactory, no hardcoded colors, state proxy, project JSON writes, logging, kanban auth, claim files before editing, no destructive git on a shared tree, commit by pathspec — never `add -A`). Architecture rules live in `.claude/rules/*.md`.

## Important Commands

- `npm start` — launch Electron app
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
