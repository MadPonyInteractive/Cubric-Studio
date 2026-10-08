# MPI-1043 Checklist

Playbook: `docs/playbooks/bump-engine/README.md`. Target v0.39.0 (`b0b743566f65daafc423b4fea8a2fbda94b3384a`).

- [x] Gate 0 stated: real bump; v0.39.0 has portable assets (nvidia, nvidia_cu126, amd, intel); `node_lock.json` v0.34.0 == `system_dependencies.json` 0.34.0
- [x] Gate 0 research: breaking surfaces 0.34 -> 0.39 (requirements diff: frontend 1.49.6 -> 1.53.10, templates 0.11.48 -> 0.11.76, comfy-aimdo 0.4.15 -> 0.5.5, comfy-kitchen 0.2.31 -> 0.2.37, torchaudio line removed; no torch move)
- [x] Gate 3: pins bumped in BOTH files (core tag + commit + frontend block), grepped and agreeing; MpiNodes 3e8d7d2 -> 6bf5659 (MPI-1036 ask, additive MpiGradeMatch); python_deps.txt regenerated, comment-only diff
- [x] Gate 4: every pinned custom node re-checked against the new core (research/gate0.md; bench floor check 220/220 class_types on 0.39.0)
- [x] Gate 5 (needs a window: moves the shared engine install): local engine upgraded in place, `node scripts/engine-floor-check.mjs` exits 0 - 2026-10-08 Fabio relaunched the dev app; boot gate moved 48188 in place in 23 s (5 pip lines, MpiNodes repaired to 6bf5659), floor 220/220, no IMPORT FAILED (KJNodes PatchTritonVAE triton warning pre-exists since 09-28, unused)
- [x] Found + fixed on the way: a node 2.0 dropped from the registry (SplatKit, Mickmumpitz - 1.6.x tester builds + dev engines) sent the in-place upgrade to the full ~11 GB wipe; `routes/engine.js` now sets it aside as `<name>.stale-<sha8>.disabled` (proved live on this engine)
- [x] Bench `G:\ComfyUi` bumped too (`/mpi-bump-local-comfy`) - MPI-936 authors its graph there
- [x] Gate 6: `node_lock.json` + `python_deps.txt` synced into mpi-ci; DEV Pod image built (`v<ver>-dev-<profile>`), only `POD_IMAGE_VERSION_DEV`/`_CPU_DEV` moved - synced mpi-ci 88e6120; CI run 37786409120 both legs success, cu130 `node-import smoke test OK` (torch 2.12.0+cu130); `v0.25.0-dev-cu130` + `v0.25.0-dev-cpu` pull-verified 2026-10-08; dev consts -> v0.25.0-dev, stable pair untouched at v0.24.0
- [x] Gate 7: Pod reports 0.39.0 - `engine: Pod image built from 0.39.0, matches node_lock ✓` 2026-10-08T16:15:55Z, RTX 4090 EU-RO-1
- [x] Gate 8 (costs money, Fabio's yes first): smoke matrix green, skips named - Fabio's one approved run, model ops only: PASS 39 · SKIP 3 (qwen-image-2-1/t2i + edit: workflow not landed yet; flux-schnell-cloud/t2i: no workflow) · FAIL 0. MpiNodes ran at the app pin 3ec03efb (MPI-623 moved it after the mpi-ci sync)
- [x] Gate 9: evidence written, Windows-half limit stated - `dev_configs/smoke-evidence.json` engine want=got=0.39.0 proven; limits carry "Pod-green is not Windows-green" (gate 5 is the local half, done). Gap: qwen-image-2-1 is in `scope.modelsRun` though both ops skipped, so `unproven: []` overstates it; its scoped smoke (with the 3D scene, `--flows all`) is still owed
- [x] Smoke volume `0gzc4yk344` (360 GB) deleted - runner kept it (no TTY); Fabio deleted it 2026-10-08 (agent delete was permission-blocked)
- [ ] mpi-ci `cubric-vision-pod/node_lock.json` MpiNodes 6bf5659 -> the app pin (3ec03efb as of 2026-10-08; code-only drift, not a rebuild) - sync at the release rebuild, since MPI-623 may move it again
- [ ] Scoped smoke for Qwen 2.1 (MPI-936) + 3D scene (MPI-623) with `--flows all` on v0.25.0-dev, once both cards' graphs land - Fabio said yes to running it 2026-10-08; quote price + run count before renting, that yes is not a money yes
- [ ] Release note engine section (DONE f5926cfa8, UNRELEASED.md); version bump at release (`/mpi-version-bump`) + clean RELEASE Pod image rebuild at ship (mandatory for an engine bump) - Fabio 2026-10-08: ships as **2.0.2**; these leftovers are the blockers of umbrella **MPI-1044**
