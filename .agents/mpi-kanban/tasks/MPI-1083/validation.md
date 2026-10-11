# MPI-1083 validation

## 2026-10-11 - automated, passed

- `node --test tests/agent-generation-relay.test.cjs tests/flow-chain.test.cjs tests/flow-cloud-edit.test.cjs tests/cloud-edit-follows-source.test.cjs` - 58/58 pass. New behaviour tests drive the REAL `submitFlowGeneration` with the queue and describer stubbed (`io` param):
  - cancel during describe -> `cancel()` answers `running`, the describe finishing queues NOTHING, caller hears CANCELLED once;
  - a described run enters the queue under the SAME handle, `queueJobId` filled;
  - chained Flow: the handle follows leg 2 (`q2`); cancelled while leg 1 is queued and leg 1 completes anyway -> leg 2 never queued, caller hears CANCELLED, not done;
  - cloud edit cancelled during pass 1 -> no fetch at all (nothing staged or sent to the paid model), nothing queued, CANCELLED.
- `npm test` - 3113 tests, 3111 pass, 0 fail, 2 skipped. Three source pins updated to the new shape (flow-chain, flow-describe, routine-runner).
- `npx eslint` on the three changed JS files - clean.

Not run: a live isolated-app run of a cancelled Video Edit (would need a describer and a Pod; the unit tests drive the exact function the bug lived in).

Known ceiling: a cloud edit's pass 1 is a direct run outside the queue, so a cancel during it waits for pass 1 to end, then stops before the paid call.
