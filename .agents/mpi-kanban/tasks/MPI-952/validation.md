# MPI-952 validation

Commit `b3c25a678` (2026-09-27). Decision: Fabio, 2026-09-27, "The 3D stuff is not going to be
in version 2."

## Done

- `ComfyUI-SplatKit` removed from `dev_configs/node_lock.json` and `nodesDeps.js`.
- `click` removed from `dev_configs/python_deps.in` (its own comment: "SplatKit only").
  `python_deps.txt` regenerated with `node scripts/compile-node-deps.mjs`: the package set is
  unchanged, `click==8.4.2` stays because huggingface-hub requires it; only its `# via`
  provenance lost the `-r python_deps.in` line.
- **`ComfyUI-Mickmumpitz-Nodes` KEPT on purpose**: `comfy_workflows/flow_outpaint.json:373` uses
  `MickmumpitzPanoHarmonizeBoundary`, so the shipped Outpaint Flow needs it. (The first sweep
  called both packs unused; that was wrong.)

## Evidence

- `grep -rl SplatKit_ comfy_workflows` -> 0 files: no shipped graph uses a SplatKit class.
- `compile-node-deps.mjs --check` -> OK, every declared node requirement covered;
  trimesh / scikit-image / matplotlib stay because other nodes declare them.
- `npm test` 2111 pass / 0 fail / 1 skipped; eslint clean on `nodesDeps.js`.

## Consequences to know

- The 1.6.x tester builds already installed SplatKit; its folder stays on those engines,
  untracked and harmless (public 1.5.0 never had it).
- The next Pod image (MPI-595 B1) syncs this lock into `mpi-ci`, so the Pod drops it too.
- MPI-623 restores the pack by reverting `b3c25a678`.
