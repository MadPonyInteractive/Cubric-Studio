# MPI-1203 checklist

- [x] Root cause: `_laneOf` ignored a download-only Pod, so the intent lane and the store lane disagreed
- [x] `_laneOf` mirrors the executor (`isDownloadOnly()` -> local)
- [x] `_dispatchNextCue` warns once when a dispatched job has no store job on its lane after 30 s
- [x] Test: a CPU-Pod job frees its lane for the next one (fails without the fix); a stalled job logs the warning
- [x] `docs/generation-lifecycle.md` names the rule and the warning
- [x] Unit suite green (3419 pass, 0 fail)
- [x] CI green on the commit (run 39268687670 on b5d9124c5: unit + desktop 1-4)
