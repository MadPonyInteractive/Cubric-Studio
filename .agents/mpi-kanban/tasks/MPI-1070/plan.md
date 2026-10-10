# MPI-1070 - No GPU Pod blocks opening a project

## Goal

With a No GPU (download-only) Pod connected, a project opens and works: DeepInfra
models, and local generation on the user's own GPU.

## Approach (agreed with Fabio, 2026-10-11)

- Drop the MPI-88 navigation gate `_blockedByDownloadMode()` in `js/shell/projectUI.js`
  (open-project row click + create-project dialog). MPI-539 already routes every
  generation to the LOCAL engine while a download-only Pod is connected.
- Reuse the existing "Run locally" toggle (R31, `state.engineOverride`) instead of a
  second install-status list: while a No GPU Pod is connected the prompt box turns it
  ON and locks it (it cannot be switched off; the Pod cannot generate). The override
  already drives the model pickers (local install state), the presence check
  (`/comfy/models/check-local`) and the generation lane (`forceLocal`), so all three
  agree with the engine that actually runs.
- The override is app-wide and the Model Manager reads the same dep-status cache, so
  the prompt box clears the lock it set when it is destroyed (leaving the project):
  back home, the Model Manager shows the Pod's installs again.

Ownership: `js/shell/projectUI.js`, `js/components/Organisms/MpiPromptBox/MpiPromptBox.js`

## Verification

**Verify mode:** auto

- `npm test` subset touching prompt box / projectUI stays green; lint clean.
- Isolated app (`npm run app:isolated`), download-only mode faked: a project opens,
  toggle is on + disabled, local models listed; going home clears the override.

## Current State

Done and verified (validation.md). Next: close out (commit the 3 files + card).

## Completed

- Gate removed in projectUI (both call sites, orphaned import dropped).
- The prompt box locks Run locally ON while a No GPU Pod is connected (refresh-then-apply
  on mount and on `remote:connection`). The lock is a module-level `_noGpuLock`, lifted
  on `currentPage -> landing`.
- tests/desktop/no-gpu-pod-project.spec.js.

## Remaining Work

## Plan Drift

- 2026-10-11: the lock is lifted on the PAGE (landing), not on prompt-box destroy. Gallery
  and history each remount their own box, and flipping the override on every remount
  fires two install re-syncs that race (`syncModelInstalled` is not serialised). The
  test file was added to ownership.
