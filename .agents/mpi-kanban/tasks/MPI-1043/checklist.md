# MPI-1043 Checklist

Playbook: `docs/playbooks/bump-engine/README.md`. Target v0.39.0 (`b0b743566f65daafc423b4fea8a2fbda94b3384a`).

- [x] Gate 0 stated: real bump; v0.39.0 has portable assets (nvidia, nvidia_cu126, amd, intel); `node_lock.json` v0.34.0 == `system_dependencies.json` 0.34.0
- [x] Gate 0 research: breaking surfaces 0.34 -> 0.39 (requirements diff: frontend 1.49.6 -> 1.53.10, templates 0.11.48 -> 0.11.76, comfy-aimdo 0.4.15 -> 0.5.5, comfy-kitchen 0.2.31 -> 0.2.37, torchaudio line removed; no torch move)
- [x] Gate 3: pins bumped in BOTH files (core tag + commit + frontend block), grepped and agreeing; MpiNodes 3e8d7d2 -> 6bf5659 (MPI-1036 ask, additive MpiGradeMatch); python_deps.txt regenerated, comment-only diff
- [x] Gate 4: every pinned custom node re-checked against the new core (research/gate0.md; bench floor check 220/220 class_types on 0.39.0)
- [x] Gate 5 (needs a window: moves the shared engine install): local engine upgraded in place, `node scripts/engine-floor-check.mjs` exits 0 - 2026-10-08 Fabio relaunched the dev app; boot gate moved 48188 in place in 23 s (5 pip lines, MpiNodes repaired to 6bf5659), floor 220/220, no IMPORT FAILED (KJNodes PatchTritonVAE triton warning pre-exists since 09-28, unused)
- [x] Found + fixed on the way: a node 2.0 dropped from the registry (SplatKit, Mickmumpitz - 1.6.x tester builds + dev engines) sent the in-place upgrade to the full ~11 GB wipe; `routes/engine.js` now sets it aside as `<name>.stale-<sha8>.disabled` (proved live on this engine)
- [x] Bench `G:\ComfyUi` bumped too (`/mpi-bump-local-comfy`) - MPI-936 authors its graph there
- [ ] Gate 6: `node_lock.json` + `python_deps.txt` synced into mpi-ci; DEV Pod image built (`v<ver>-dev-<profile>`), only `POD_IMAGE_VERSION_DEV`/`_CPU_DEV` moved - IN PROGRESS: synced mpi-ci 88e6120; CI run 37786409120 building v0.25.0-dev (cpu pushed, cu130 building); consts not moved yet
- [ ] Gate 7: Pod reports 0.39.0
- [ ] Gate 8 (costs money, Fabio's yes first): smoke matrix green, skips named
- [ ] Gate 9: evidence written, Windows-half limit stated
- [ ] Release note engine section (DONE f5926cfa8, UNRELEASED.md); 2nd-digit version bump at release (`/mpi-version-bump`) + clean RELEASE Pod image rebuild at ship (mandatory for an engine bump)
