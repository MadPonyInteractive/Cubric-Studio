# MPI-320 Validation

## Core write-flip SHIPPED under MPI-513 - 2026-10-01

Items 1-3 of the brief's scope are done in MPI-513 Phase 1 (`5a8dc2d2a`) + follow-ups
(`9c593af5f`, `a3db21e04`): the legacy `_modelJobs`/`_depJobs` maps are deleted, `installStore`
is the only record set and status writer, `_checkModelJobsComplete` reads store deps, and the pull
endpoints serialize the store. The brief's "live resume test on local AND remote before close" ran:
local on an isolated instance (Agent 84), remote on a CPU Pod from the Linux box (Agent 85).
Evidence: `tasks/MPI-513/validation.md`.

## Left - AFTER 2.0 (Agent 85's pick 2026-10-01, put to Fabio, no objection)

4. Retire the remote stall-watchdog into the reconciler (OPEN-7). It is transport recovery
   (SSE reconnect, orphan re-issue, remote-inactive fail), not a status writer since D3.
5. G6 local/remote adapter split. The Pod run found one more seam it would close: the local pump
   had to learn to skip remote records (`a3db21e04`).
Neither is user-visible; both are refactors with their own risk, so not in the 2.0 window.
