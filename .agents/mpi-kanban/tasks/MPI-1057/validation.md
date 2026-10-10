# MPI-1057 validation

Verify mode: user-ux (plan.md). Automated evidence below; Fabio's look on his next connect closes it.

## Automated (2026-10-10, session 8f2f562a)

- `node --test tests/pod-stall-cap.test.cjs` - 4/4 pass: cap is 8 min; a boot not ready at
  8 min - 1 ms is untouched, at 8 min its Pod is deleted and status reports `stalled.podId`;
  Cancel first disarms the cap; a new boot clears the old report; `getPod({timeoutMs})` aborts
  a request that never answers.
- `node --test tests/models-check-pending.test.cjs` - 1/1 pass: a `pending` check emits no
  `models:checked` and leaves `MODELS[].installed` alone.
- 37 suites touching the edited modules (`--test-concurrency=1`): 311/311 pass.
- `npx eslint` on all touched files: clean.
- The Pod-field log line renders in the test log:
  `Pod pod1 status=RUNNING startedAt=- cudaVersion=- dc=- machineAssigned=false ...`

- 2026-10-10 later: toast removal + Flow hot-store fix: tests/pod-identity-hot-store.test.cjs 10/10 (new Flow case fails without the fix: no files staged); 35 suites importing commandExecutor 352/352; eslint clean.
- Live: PRO 4000 and PRO 6000 connects logged `[remote] phase` + Pod-field lines as designed.

## Not provable here

- The LOCAL · OFFLINE cause (status route outliving the feed's 4 s abort while RunPod's
  getPod hung) is the strongest fit, not proven. The `[remote] phase` log names the cause of
  the next one either way.
- A real stall cannot be staged on demand; the 8-min path is proven by the test only.

## Fabio's look (pending)
