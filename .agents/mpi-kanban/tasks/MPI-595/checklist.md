# MPI-595 — 2.0 gate checklist

Refreshed 2026-09-27 (the 2026-09-26 list is in git history). Reasoning per item: `brief.md`.
Order: A -> B -> C -> D. A gate that will not clear gets a **known-issue bullet**.

## ON PICKUP (measure, never read counts from prose)

- [ ] `git rev-list --count v1.4.2..HEAD`, `git status --short`, `git log --oneline @{u}..HEAD`
- [ ] `npm run release:check` (RED on 2026-09-27: stale smoke evidence + missing 1.6.x archival notes — both expected, see B1 and D)
- [ ] `gh release list | head -3` — latest public is v1.5.0; nothing cut since
- [ ] Who is in `doing`, and which files are claimed

## Gate A — must fix

- [x] **A1 MPI-806** RunPod REST v2 — app client + tests + watchdog source: Vision `97f729c5e`, mpi-ci `e62a9aa`
  - [ ] Pod runtime watchdog `_self_stop` on v2 with a status check; `publish-runtime.sh dev` -> restart a Pod -> see it stop -> `promote` (Fabio's go; NEVER `stable`)
  - [ ] Live app leg on v2: create / stop / start / delete a Pod, list + grow a volume (Fabio's go)
  - [ ] 2.0 ships by ~2026-11-01
- [x] **A2 MPI-516** vanished-prompt detector, with the re-read guard: `c3a0f839d`, CI green
- [x] **A3 MPI-736** colour — Fabio 2026-09-27: all good, closed
- [ ] **A4 MPI-780** chain
  - [x] packages exist (MPI-781) · [x] app advertises them (MPI-831)
  - [ ] Gumroad products drafted, codes created (MadPony-Identity MPI-81, Fabio) — published ON release day
  - [ ] **MPI-872** redirects resolve — verified in a browser, landing on Gumroad with the discount
- [ ] **A5 MPI-954** 1.x -> 2.0 launcher hop — fixed in `37e5eca77` (CI green); owes the Linux-box A/B (MPI-954 validation.md steps 1-4)
- [ ] **A6 MPI-591** H3 in Extend Video — IN 2.0, Fabio finishes it in its own session, BEFORE B1 (watch: FL2VA needs a core newer than v0.34)
- [x] **A7 MPI-952** SplatKit out of 2.0 (`b3c25a678`); Mickmumpitz stays for Outpaint
- [x] Cleared: MPI-507/515 (rejected, MPI-734), MPI-575, MPI-522/523/527, MPI-873, MPI-708's gates 532/774/809/810/777
- [ ] Every A item that did not clear has its known-issue bullet

## Gate B — must verify

- [ ] **B1 smoke** (after A6 + A7):
  - [ ] sync `node_lock.json` AND `python_deps.txt` into `c:\AI\Mpi\mpi-ci\cubric-vision-pod\`, re-measure the drift, commit there
  - [ ] `node scripts/smoke-workflows.mjs --plan` immediately before, shown to Fabio
  - [ ] DEV Pod image rebuilt at the lock (`/build-pod-image`), app restarted, Pod reports the pinned core
  - [ ] matrix run incl. a VIDEO op; `smoke-evidence.json` fresh; `release:check` green on that line
  - [ ] release Pod image PROMOTED (clean rebuild, never a renamed `-dev` tag)
- [x] **B2 MPI-953** Flow leg in the smoke runner — `49564ad53`: real FLOWS, stages each Flow's models + deps, volume counts only what Flows add; runs for real inside B1 with `--flows all`
- [ ] **B3** Linux box, REMOTE-ONLY (no ComfyUI there): agent, DeepInfra, RunPod v2 (MPI-806 live leg), updater A/B through `update.sh` on a real 2.0 bundle
- [ ] **B4** `npm test` and `npm run test:desktop` green
- [x] **B5** MPI-656 Phase 1 — CLEARED by reading 2026-09-27: every YAML writer (`comfy.js:855/864/934`, `engine.js:671/678`) goes through `writeExtraModelPathsYaml` -> `setRoots`, so `model_roots.json` cannot drift from the YAML; the yaml-only seed and the both-equal rule are tested (`tests/model-roots.test.cjs:213,252`)
- [x] **B6** MPI-710 — CLEARED by reading 2026-09-27: nothing load-bearing reads the installed top-level manifest (the applier keys its guard off package.json on purpose, `apply-update.cjs:88-100`; main, routes and updateChecker never read it). Stays a research card, not a gate

## Gate C — decide / notes

- [ ] Claim audit of `UNRELEASED.md` against **v1.5.0** (copy-review Gate 0)
- [x] Coverage sweep 2026-09-27 (`ec7b81cb3`): agent panel, Connect an agent, GIF workspace, 16K + SVG. Dictation, MCP, mascots, local-only server were already there
- [ ] **MPI-949 close-out**: the two Cue all bullets become stacks (949 replaces Cue all). Agent image tools (MPI-941) get their line at 941 close-out
- [x] Rename section (`ec7b81cb3`), plus Vision -> Cubric Studio in four user-facing bullets
- [ ] Known-issue lines: macOS · unsigned exe / SAC (MPI-616) · A5 if unmitigated · 1.5.0 installs lose the remote engine on 2026-11-15
- [ ] MPI-543 / MPI-544 / MPI-569 in or out
- [ ] Flow-list reconcile — LAST, once, at notes freeze (13 ids on 2026-09-27)

## Agent connection (MPI-593)

- [x] App `README.md` "Use it from your AI agent" section (`ec7b81cb3`, says it needs 2.0)
- [x] `UNRELEASED.md` bullet — now points at Settings > Connect an agent
- [ ] `.mcpb` home: agents-repo release only, or also `mpi-release` step 6
- [ ] Claude Desktop directory submission AFTER 2.0 is live
- [x] MPI-873 done

## Gate D — hygiene at the cut

- [ ] `validating` resolved: MPI-845, MPI-827, MPI-866, MPI-720
- [ ] MPI-623 / 711 / 591 / 656 out of `doing`, or scoped into 2.0 explicitly
- [ ] 1.6.0 / 1.6.1 / 1.6.2 `RELEASE_NOTES` entries + `.approved-1.6.*.json` deleted at the fold
- [ ] MPI-708 Phase 3: dual-publish `CubricVision-*` at the cut (2.0 note done `ec7b81cb3`; 2.1 follow-up is **MPI-951**)
- [ ] `python scripts/overtaken-cards.py`; unpushed pushed; commit by pathspec
- [ ] `/mpi-version-bump` -> **2.0.0**, then `/mpi-release`
- [ ] Release day: Gumroad live; Claude Desktop directory submission
- [ ] After: MPI-603 R2/HF delete; MPI-612
