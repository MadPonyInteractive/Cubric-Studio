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
  - [x] Pod runtime watchdog `_self_stop` on v2 with a status check; dev-proven on a CPU Pod, promoted 2026-09-27 on Fabio's yes
  - [ ] Live app leg on v2: create / stop / start / delete a Pod, list + grow a volume (Fabio's go)
    - [x] 2026-09-27 GPU leg (create via GraphQL RAM floor, v2 reads/start/delete) + CPU create; volume grow not run
    - [ ] REST v2 GPU create live: the RAM-floor create now goes REST v2 (uncommitted, 2026-09-27); one Connect after an app restart proves it
  - [x] **GraphQL retires early 2027** — Fabio 2026-09-27: create moves in 2.0 (done, above); picker catalogue is a **2.1 blocker** (MPI-894 phase 1b), not a 2.0 gate
  - [x] Runtime `promote` — Fabio's yes 2026-09-27; stable `wrapper_sha256` = `27fcd294…` = dev, served hash verified
  - [ ] 2.0 ships by ~2026-11-01
- [x] **A2 MPI-516** vanished-prompt detector, with the re-read guard: `c3a0f839d`, CI green
- [x] **A3 MPI-736** colour — Fabio 2026-09-27: all good, closed
- [x] **A4 MPI-780** chain, done 2026-09-27
  - [x] packages exist (MPI-781) · [x] app advertises them (MPI-831)
  - [x] Gumroad products LIVE at £4, 100-use codes applied automatically (MadPony-Identity MPI-81)
  - [x] ~~**MPI-872** redirects~~ rejected: Get it opens the plain Gumroad pages (`fe68f620d`). Build check is B7
- [x] **A5 MPI-954** 1.x -> 2.0 launcher hop — `37e5eca77`; PROVEN on the Linux box 2026-09-27 (control exit 127, fixed exit 0 on both paths, boot heal in 2 s). macOS not run (no Mac)
- [x] **A6 MPI-591** H3 in Extend Video — closed 2026-09-27 (`8975ff6d6`); B1 is unblocked on A6
- [x] **A7 MPI-952** SplatKit out of 2.0 (`b3c25a678`); Mickmumpitz stays for Outpaint
- [x] Cleared: MPI-507/515 (rejected, MPI-734), MPI-575, MPI-522/523/527, MPI-873, MPI-708's gates 532/774/809/810/777
- [ ] Every A item that did not clear has its known-issue bullet

## Gate B — must verify

- [ ] **B1 smoke** (after A6 + A7):
  - [x] sync `node_lock.json` AND `python_deps.txt` into `c:\AI\Mpi\mpi-ci\cubric-vision-pod\`, re-measure the drift, commit there — 2026-09-28 mpi-ci `5ba9eb8` (MpiNodes cff4c3b -> bc92a1b, SplatKit out, core v0.34.0 unchanged); byte-identical to Vision. pushed 2026-09-29 with mpi-ci `57a31c0` (MPI-894)
  - [x] `node scripts/smoke-workflows.mjs --plan --flows all` 2026-09-28, shown to Fabio: 13 models / 38 ops / 290.5 GB + 14 Flows (+64.1 GB) = **400 GB volume**; lock in sync; MpiNodes + required-inputs sweeps clean; 1 SKIP `flux-schnell-cloud/t2i` (cloud, no workflow). **Re-run right before the real smoke** (sync LAST rule)
  - [x] DEV Pod image rebuilt at the lock (`/build-pod-image`), app restarted, Pod reports the pinned core — `v0.24.0-dev` (cu130 Docker Hub + cpu GHCR), CI run 36408333772, both pull-verified; `POD_IMAGE_VERSION_DEV`/`_CPU_DEV` in `6311ce8b9`; Fabio restarted the app (boot 11:16:51Z). Local cpu boot smoke not run (Docker daemon down). Pod-reports-core is asserted by the runner's gate 7 in the live run
  - [x] matrix run incl. a VIDEO op; `smoke-evidence.json` fresh; `release:check` green on that line — **2026-09-28 GREEN: PASS 51 · SKIP 1 · FAIL 0 across 52 ops** (37 model ops incl. every video op + 14 Flows; SKIP = `flux-schnell-cloud/t2i`, cloud, no workflow). Engine 0.34.0 proven. RTX 5090 (55.88 GiB host, placed at `--min-ram 60`) 19:35-19:56Z; H3 Extend retried on A100 PCIe 20:04-20:24Z after the probe clip went 1 frame -> 48 (MpiH3MaskedPrefix needs >=39). `release:check`: smoke line clear; only the 1.6.x archival notes (gate D) remain. Spend ~$0.95 (5090 $0.35, A100 $0.53, CPU Pods cents)
    - 2026-09-28 run 1 (`--flows all`) installed all 13 models + Flow models, then ABORTED before the GPU leg: `flow dep install failed: flow:voice-changer, flow:chatter-box` — every chatterbox dep `invalid model type` (a `targetPath` weight reaches the wrapper with an empty type; `_SUBDIR_RE` rejects it). NOT a regression: MPI-607 (2026-08-24, Fabio-approved) made both Flows honest-missing on remote; neither the image nor the volume path can supply them. Run 2 = same matrix, `--flows` minus those two (12 Flow entries) — ALSO aborted, on run 1's leftover failed jobs (runner bug). **Fabio 2026-09-28: B — 2.0 cannot ship a Flow that works locally and not remotely.**
    - [x] B fix: Vision `43eab1c33` (`wrapperDepPath` maps `targetPath: models/<type>/<sub>` to a real wrapper type at status/install/uninstall; `_withRegistryDef` resolves `targetPath` + `bakedOnPod` by id for stripped callers; runner counts only its own jobs; `tests/remote-target-path-deps.test.cjs`; npm test 2190/0 fail). mpi-ci start.sh links `/opt/ComfyUI/models/chatterbox` -> volume `mpi_models/chatterbox`, published to R2 **dev** (served bytes verified = committed). mpi-ci `b131c0a` pushed 2026-09-29 with `57a31c0`. `promote` to stable at release
    - [x] run 3: `--flows all` after an app restart (routes changed); chatter-box + voice-changer PASS on the Pod is the live proof of the symlink (not testable on Windows) — chatter-box 21s + voice-changer 8s PASS on the 5090 Pod 2026-09-28
  - [ ] release Pod image PROMOTED (clean rebuild, never a renamed `-dev` tag)
- [x] **B2 MPI-953** Flow leg in the smoke runner — `49564ad53`: real FLOWS, stages each Flow's models + deps, volume counts only what Flows add; runs for real inside B1 with `--flows all`
- [ ] **B3** Linux box, REMOTE-ONLY (no ComfyUI there): agent, DeepInfra, RunPod v2 (MPI-806 live leg), updater A/B through `update.sh` on a real 2.0 bundle
- [ ] **B4** `npm test` and `npm run test:desktop` green
- [x] **B5** MPI-656 Phase 1 — CLEARED by reading 2026-09-27: every YAML writer (`comfy.js:855/864/934`, `engine.js:671/678`) goes through `writeExtraModelPathsYaml` -> `setRoots`, so `model_roots.json` cannot drift from the YAML; the yaml-only seed and the both-equal rule are tested (`tests/model-roots.test.cjs:213,252`)
- [x] **B6** MPI-710 — CLEARED by reading 2026-09-27: nothing load-bearing reads the installed top-level manifest (the applier keys its guard off package.json on purpose, `apply-update.cjs:88-100`; main, routes and updateChecker never read it). Stays a research card, not a gate
- [ ] **B7** on the 2.0 build, Get it on Head Swap and DramaBox opens Gumroad at £0

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
- [ ] Release day: Claude Desktop directory submission (Gumroad already live, A4)
- [ ] After: MPI-603 R2/HF delete; MPI-612
