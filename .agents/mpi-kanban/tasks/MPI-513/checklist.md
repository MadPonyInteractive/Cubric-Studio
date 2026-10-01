# MPI-513 Checklist

- [ ] Phase 0: map every `_modelJobs` / `_depJobs` read and write, both engines; read MPI-276 invariants (04); write the large plan
- [ ] Phase 1 (MPI-320): `installStore` is the only status writer; maps keep transport detail only or die
- [ ] Phase 1: `_checkModelJobsComplete` reads store dep states
- [ ] Phase 1: pull endpoints (`/downloads/status`, `/downloads/active`, `_serializeModelJob`) read `store.snapshot()`
- [ ] Phase 1: remote stall-watchdog retired into the reconciler
- [ ] Phase 1: unit tests green (install-store, reconciler, download-completion, remote-*), invariants matrix re-checked
- [ ] Phase 1: live local install / cancel / resume on an isolated instance
- [ ] Phase 1: live remote resume (Pod, costs money: ask first)
- [ ] Phase 2: re-test MPI-497 and MPI-397 against the single writer; close or re-card with evidence
- [ ] Docs: `docs/download-manager.md` Shadow-SOT caveat + job-storage section rewritten
