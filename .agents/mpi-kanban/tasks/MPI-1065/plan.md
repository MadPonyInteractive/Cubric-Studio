# MPI-1065 Plan - tell the user when an installed model is missing files

Umbrella MPI-1064. Fabio, 2026-10-10: address it here rather than drop it.

## Problem

"Installed" = every dep on disk now; there is no install receipt. When an update adds a dep to a
model the user already has (MPI-1060 added `ltx23-lora-ingredients`, 1.22 GB, to both LTX 2.3 cards
for 2.1), the model drops out of every picker with no message. The repair already exists: the Models
library shows it as partial with an Install button. What is missing is the user being told.

## Decision (2026-10-10)

Option A: tell, never auto-download. A once-per-session toast names the model(s), the size still
missing, and that they are hidden from the pickers; its button opens Models, where the existing
partial bar + Install finish the job (licence gates and engine scoping stay in Install, untouched).

"Missing files" uses the Models library's own partial rule (MPI-258): at least 1 GB of the model's
OWN deps on disk (shared deps owned by another installed model and custom nodes excluded), not all
of them. A model the user never touched never qualifies; a cancelled install does, which is right.

## Steps

1. `js/data/modelRegistry.js`: export a pure `partialInstall({ depIds, depStatus, ownedIds })`
   lifted from MpiModelManager `_computePartial` (same floor, same exclusions). MpiModelManager's
   `_computePartial` calls it (no behaviour change).
2. `js/shell/modelUpdateCheck.js` (new, the `llmPickCheck.js` pattern): on `models:checked`, for each
   non-cloud model that is not usable, has no download job, and reads partial, toast once per
   session per model; button "Open Models" emits `models:open`. Started from `js/shell.js`.
3. `tests/model-update-check.test.cjs`: dep added to an installed model -> partial; never-touched
   model -> not; only shared deps on disk -> not; message names model + size.

## Verification

**Verify mode:** user-ux
- `npm test` green; new test fails if the floor or the shared-dep exclusion is removed.
- Own `app:isolated` with a model whose new dep is absent: toast appears once, button opens Models
  on the partial tile. Fabio's eye on the toast copy.

## Current State

- 2026-10-11 session 9bbf1e2f: built and verified (validation.md). Waiting on Fabio's eye on the
  toast copy, then close.

## Plan Drift

- 2026-10-11: "partial" alone gave false alarms live (shared-encoder siblings). The toast also
  needs 1 GB of deps no other model uses on disk; the selection is the pure modelsMissingFiles()
  in js/shell/modelUpdateCheck.js, tested against the real ModelDefs. partialInstall() landed in
  resolveModelDeps.js (pure, node-testable), not modelRegistry.js.
