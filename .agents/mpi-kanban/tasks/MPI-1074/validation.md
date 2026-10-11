# MPI-1074 validation

**Root cause:** `pruneStaleMaskTemp()` decided staleness by NAME alone (every `cubric-<uuid>` but its
own). Instances that share no single-instance lock (`app:isolated`, desktop specs: own profile, own
port) therefore deleted the live app's session dir at every boot.

**Fix:** each instance writes `owner.json` (`{ pid, startedAt }`) into its own dir at boot
(`main/maskTempPrune.cjs` `writeOwnerMarker`); the prune removes a dir only when that PID is dead.
A dir with no readable marker comes from a pre-fix build that may still be running (the developer's
live app while agents boot new code), so it goes only after 7 days untouched. MPI-919's
`cubric-<uuid>` regex guard is kept.

**Evidence (2026-10-11):**
- `node --test tests/mask-temp-prune.test.cjs`: 3/3 pass (live peer kept, dead owner pruned, recent
  unmarked kept, week-old unmarked pruned, `cubric-deepinfra` untouched, own-PID-on-another-dir =
  stale, corrupt marker = unmarked, `pidAlive` true for self / false for a reaped child).
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/mask-temp-ipc.spec.js`:
  2/2 pass (stale dir planted with a dead PID's marker is pruned; sibling kept).
- Live: a running `electron.exe` (PID 45276) owned `%TEMP%\cubric-b85629ae-...` with a marker; both
  spec boots above left it in place.

**Known ceilings:** PID reuse keeps a dead dir until the reusing process exits (a temp leak, never a
loss). The `mask-temp:cleanup-session` IPC (no callers today) removes the marker with the dir; a
later write recreates the dir unmarked, which the 7-day grace still protects.
