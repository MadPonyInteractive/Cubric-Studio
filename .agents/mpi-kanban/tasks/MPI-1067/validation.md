# MPI-1067 Validation

2026-10-10, worker in session 38894ae1, re-checked by the orchestrator.

- Root cause: `MpiSwitch.check_lazy_status` / `use_selected` indexed the CONNECTED inputs
  (`list(kwargs)`) by `select - 1`; ComfyUI passes only connected inputs.
- Fix (ComfyUi-MpiNodes `switches.py`): select `<type_name>_<select>` by name; an unwired
  selected slot returns ExecutionBlocker. Covers MpiAnySwitch, MpiAnySwitch10, MpiLoraSwitch.
  changelog.md V1.2.18 entry.
- `G:/ComfyUi/python_embeded/python.exe C:/AI/Mpi/ComfyUi-MpiNodes/test_switches.py`:
  16 passed (rerun by orchestrator), gapped and ungapped for all three classes.
- Open: commit + push in ComfyUi-MpiNodes, then pin in `dev_configs/node_lock.json`
  (`/mpi-nodes-sync`), at close-out.
