# MPI-1113 checklist

- [x] `_firePost` never revives a job an SSE terminal already settled
- [x] `silent` carried on the server job (register, serialize, snapshot, complete event)
- [x] client reads silence off the job; `_silentJobs` removed
- [x] tests: new race + silent test, install-queue-wedge updated, download suite green
- [x] docs/download-manager.md § Internal heal jobs updated
