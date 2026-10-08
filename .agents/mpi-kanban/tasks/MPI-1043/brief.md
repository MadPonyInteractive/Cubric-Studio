# MPI-1043 - Bump the shipped engine ComfyUI v0.34.0 -> v0.39.0

Run with `/mpi-bump-engine` (playbook `docs/playbooks/bump-engine/README.md`). Fabio's call
2026-10-08: bump now, ship it in the next app version (2nd digit).

## Why

- Qwen-Image 2.1 (MPI-936) needs core >= 0.37.0 (PR #16400); 0.38.0 and 0.39.0 carry Qwen 2.1
  fixes (KV-cache placement, RGBA preprocess, fp16 clamp, int8/int4 cache crash #16667).
- Also unblocks MPI-578 (LTX 2.5 latent upscalers).
- Fabio expects memory improvements in the newer core too.

## Gate 0 facts already established (2026-10-08)

- Target `v0.39.0`, commit `b0b743566f65daafc423b4fea8a2fbda94b3384a`, released 2026-10-05.
  Portable assets present: `nvidia`, `nvidia_cu126`, `amd`, `intel`.
- Current pins agree: `node_lock.json` `v0.34.0` / `system_dependencies.json` `0.34.0`.
- `requirements.txt` v0.34.0 -> v0.39.0:
  - `comfyui-frontend-package` 1.49.6 -> **1.53.10**
  - `comfyui-workflow-templates` 0.11.48 -> **0.11.76**
  - `comfyui-embedded-docs` 0.5.10 -> 0.5.13
  - `comfy-kitchen` 0.2.31 -> 0.2.37
  - `comfy-aimdo` 0.4.15 -> **0.5.5** - the allocator behind the MPI-1024/1029 dynamic-VRAM
    fallback, which greps aimdo stdout lines. Highest-risk surface: check the fault strings
    and `--disable-dynamic-vram` still exist.
  - `torchaudio` line REMOVED (a disappearing line is not pip work - see 02-local-upgrade
    traps; check no audio node relied on core pulling it).
  - No torch / torchvision move -> no ~11 GB user reinstall.
- Breaking-surface research (release notes + 19 pinned nodes): `research/gate0.md` - no
  confirmed breaker; watch LTXVideo kornia + the aimdo log prefix.

## Coordination

- Gate 5 moves the SHARED engine install in place (stops it, pips, checks out the sha):
  pick a moment Fabio's live app and peer sessions are not generating.
- The bench `G:\ComfyUi` is on v0.34.2; bump it too (`/mpi-bump-local-comfy`) so MPI-936
  can author its graph.
- Smoke (gate 8) rents RunPod: state price + run count, get Fabio's yes first.

## Noticed

- 2026-10-08: the smoke scope counts a model as RUN when every op it has SKIPped (qwen-image-2-1, workflow not landed), so `scope.unproven` reads `[]` and `release:check` prints "covers all 40 models" while Qwen 2.1 never executed. `scripts/smoke-workflows.mjs` scope builder; MPI-936 still owes its scoped smoke before it ships.
