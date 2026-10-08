# MPI-1043 Checklist

Playbook: `docs/playbooks/bump-engine/README.md`. Target v0.39.0 (`b0b743566f65daafc423b4fea8a2fbda94b3384a`).

- [x] Gate 0 stated: real bump; v0.39.0 has portable assets (nvidia, nvidia_cu126, amd, intel); `node_lock.json` v0.34.0 == `system_dependencies.json` 0.34.0
- [ ] Gate 0 research: breaking surfaces 0.34 -> 0.39 (requirements diff: frontend 1.49.6 -> 1.53.10, templates 0.11.48 -> 0.11.76, comfy-aimdo 0.4.15 -> 0.5.5, comfy-kitchen 0.2.31 -> 0.2.37, torchaudio line removed; no torch move)
- [ ] Gate 3: pins bumped in BOTH files (core tag + commit + frontend block), grepped and agreeing
- [ ] Gate 4: every pinned custom node re-checked against the new core
- [ ] Gate 5 (needs a window: moves the shared engine install): local engine upgraded in place, `node scripts/engine-floor-check.mjs` exits 0
- [ ] Bench `G:\ComfyUi` bumped too (`/mpi-bump-local-comfy`) - MPI-936 authors its graph there
- [ ] Gate 6: `node_lock.json` + `python_deps.txt` synced into mpi-ci; DEV Pod image built (`v<ver>-dev-<profile>`), only `POD_IMAGE_VERSION_DEV`/`_CPU_DEV` moved
- [ ] Gate 7: Pod reports 0.39.0
- [ ] Gate 8 (costs money, Fabio's yes first): smoke matrix green, skips named
- [ ] Gate 9: evidence written, Windows-half limit stated
- [ ] Release note engine section; 2nd-digit version bump at release (`/mpi-version-bump`)
