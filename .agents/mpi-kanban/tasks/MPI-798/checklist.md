# MPI-798 Checklist

Derived from plan.md § Implementation (2026-09-19).

- [x] 1. Publish the pin set - NO CHANGE NEEDED, already published at every release tag
- [x] 2. scripts/install-flow-devkit.mjs - install packs at pins, write .mpi_node_commit, --check mode
- [x] 3. Linter reports pack drift for the ComfyUI it is pointed at (COMFY_PATH)
- [x] 4. Document it in docs/flow-packages.md
- [x] 5. The match check names EXTRA packs too (found after step 4; warning only)
