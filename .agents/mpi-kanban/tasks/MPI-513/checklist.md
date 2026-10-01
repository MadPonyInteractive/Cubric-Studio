# MPI-513 Checklist

- [x] Phase 0: map every `_modelJobs` / `_depJobs` read and write, both engines; read MPI-276 invariants (04); write the large plan
- [x] Phase 1: failing D2 (shared dep records) + D4 (one model-level writer) tests, then made green in installStore + reconciler (uncommitted until D1 wiring)
- [x] Phase 1 (MPI-320): `installStore` is the only status writer; maps keep transport detail only or die
- [x] Phase 1: `_checkModelJobsComplete` reads store dep states
- [x] Phase 1: pull endpoints (`/downloads/status`, `/downloads/active`, `_serializeModelJob`) read the store records
- [ ] Phase 1: remote stall-watchdog retired into the reconciler — DEFERRED by the approved design (transport recovery, not a status writer); follow-up under MPI-320
- [x] Phase 1: unit tests green (install-store, reconciler, download-completion, remote-*), invariants matrix re-checked
- [x] Phase 1: live local install / cancel / resume on an isolated instance (+ shared-dep attach)
- [ ] Phase 1: live remote resume (Pod, costs money: ask first)
- [ ] Phase 2: re-test MPI-497 and MPI-397 against the single writer; close or re-card with evidence
- [x] Docs: `docs/download-manager.md` Shadow-SOT caveat + job-storage section rewritten
