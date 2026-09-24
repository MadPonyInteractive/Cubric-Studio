# MPI-901 validation

**Verify mode:** auto

## 2026-09-24

- `node --test tests/remote-history-settle.test.cjs` on the pre-fix code: 4 fail, 1 pass (the
  still-running control). The reconcile tests run the REAL `_reconcileFromHistory` body lifted
  from the source against a stub `this`, fed ComfyUI's actual history shape
  (`status_str: 'error', completed: false`, `messages: [[type, data], ...]`).
- Same command after the fix: 5 pass, 0 fail.
- `npm test`: 1843 tests, 1841 pass, 0 fail, 1 skipped, 1 todo.

Not verified live: no RunPod Pod was rented to drive a real failed/interrupted remote prompt.
The history shape is ComfyUI's `prompt_worker` `task_done(... completed=e.success ...)`.

- CI run 35968854510 on `78f03418` (both MPI-901 commits): **success**. That push also carried the red-master fix (flow-uninstall-button spec used outpaint as its models-only case; MPI-900 gave outpaint a node dep).
