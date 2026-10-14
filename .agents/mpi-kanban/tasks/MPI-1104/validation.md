# MPI-1104 validation

2026-10-12, session 2001b3f5:

- `node --test tests/cpu-jobs.test.cjs` - pass. `runCpuJob` adds a `state.cpuJobs` row with
  `progress: null`, clamps `setProgress`, removes the row on success AND on a throw.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/cpu-job-row.spec.js` -
  pass (real Electron, own port). Mounted MpiQueuePanel shows a `--cpu` Transfers row named
  after the job, meta "Working", bar carries `mpi-progress--loading` (the existing sweep), no
  Cancel button; `setProgress(0.4)` -> meta "40%", sweep off; job ends -> row gone, Transfers
  hidden.
- `npx eslint` on the two touched JS files - clean.

- Folded in (MPI-623 message, Fabio live 08:31Z): a download row froze at "Download · 100% ·
  97.5 MB/s" with a still bar through a remote install's verify phase. An `indeterminate` job now
  reads "Download · verifying" / "Download · preparing" under the sweep; a real-% tick clears it.
  Same spec, extended - pass.

Nothing new built: same Transfers list, same MpiProgressBar, same `mpi-progress--loading` CSS.
No cancel for CPU jobs yet; a member that needs one (MPI-1107 bulk Download) adds it.

## Closed 2026-10-14 (session 3d712bc0)

Agent-verifiable check only (specs above passed); master Tests green on 8ef55aa7a, which carries this code. Owning session closed; moved to done per kanban.md "validating is not a parking space".
