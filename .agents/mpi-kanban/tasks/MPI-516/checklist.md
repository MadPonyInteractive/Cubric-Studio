# MPI-516 checklist

- [x] Root read: where absent-from-history is treated as "still running" (`comfyController.js` `_reconcileFromHistory`), on BOTH engines (local has no poll at all; the remote poll spins forever)
- [x] Port the three-signal detector from `scripts/smoke-workflows.mjs` (~968-1014): absent from history AND absent from the queue (running + pending) AND the engine answering, WITH the re-read-history-after-queue guard
- [x] A vanished prompt rejects with a real error: toast, log line, the card settles failed
- [x] Tests: vanished -> rejects; finished between the two reads -> resolves (the false-positive path); engine not answering -> no verdict
- [x] docs/generation-lifecycle.md records the rule
