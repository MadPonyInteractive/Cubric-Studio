# MPI-1210 validation - 2.1.2 release

## 2026-10-21 preconditions

- master `APP_VERSION` 2.1.1 = latest release v2.1.1; origin/master...master 0/0; last 3 `Tests` runs success.
- `release-baselines/` holds README.md only.
- Pod runtime manifests dev and stable identical (wrapper 0.2.48, same three sha256).
- `routes/mcp.js` TOOLS keys = `mcp/cubric-studio/manifest.json` tools (28, manifest 0.3.2).
- `dev_configs/node_lock.json` since v2.1.1: MpiNodes commit + UltimateSDUpscale submodule only, core tag unchanged.
- No op registry change since v2.1.1: quick-path bump.
- FLUX.3 Klein Pod-proven by Fabio 2026-10-21 (MPI-1181 validation). MPI-1207 edit graphs benched locally, not Pod-smoked.

## 2026-10-21 bump to 2.1.2

- Hotkey fix MPI-1238 (`92a5c410f`) on master before the bump. UNRELEASED folded, plus 12 fixes since
  v2.1.1 that never passed through it (MPI-1216/1220/1221/1223-1226/1228/1229/1234/1236/1238); each
  "used to" claim checked against `v2.1.1` (compaction 128k cap, card at half, wake + auto-look existed).
- Gate 1: Fabio approved the notes as written; he ran `release:approve` (hash 2f9247e7...).
- `release:check` passed. `npm test` 3506 pass, 0 fail. eslint clean on edited files.
- `release:deps`: 1 dead MIRROR, `krea2-lora-accelerator` (HF repo renamed to
  `TheDivergentAI/Krea2-Turbo-Distill-8step-LoRA`, file `krea2_turbo_distill_8step_r128.safetensors`,
  HF lfs sha256 + size = ours). mirrorUrl updated; re-run: all 345 URLs reachable.
- `test:desktop`: 247 passed, 2 failed on 30 s timeouts (flow-chain-toggle, nodev-flag) while unit runs and
  release:deps ran beside it; both re-run alone: 4/4 pass (11 s, 3 s).
