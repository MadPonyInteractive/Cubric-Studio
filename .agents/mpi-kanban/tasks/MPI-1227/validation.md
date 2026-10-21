# MPI-1227 validation

- 28 spellings of `G:/CubricModels` / `G:\CubricModels` / `g:/cubricmodels` repointed to `M:` across 16 files (scoped docs, playbooks, `docs/models/**`, merge-loras README, the `mpi-bump-local-comfy` skill, the `mpic-compute-dep-hashes` command, and the `LOCAL_ROOT` default + docstring in `scripts/computeDepHashes.py`). Byte-level substitution, so diff is 28 lines in / 28 out, no EOL churn.
- `rg -i 'g:.{1,2}cubricmodels'` over the scoped files: no matches (exit 1).
- `python -m py_compile scripts/computeDepHashes.py`: ok.
- `.husky/pre-push` lint + unit tests green on 212ed8027; pushed to master.
- Left alone on purpose: `.agents/mpi-kanban/**` history, `docs/archive/**`, `tests/*.cjs` (fixture strings), `js/data/modelConstants/assetDeps.js:1196` (code comment, outside scope), and `.claude/rules/comfy_engine.md:26` (rule file: needs Fabio's explicit OK).
- `G:\ComfyUi` (the bench itself) still lives on G: and its mentions are unchanged.
