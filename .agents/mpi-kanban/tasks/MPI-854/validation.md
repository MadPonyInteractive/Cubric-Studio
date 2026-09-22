# MPI-854 — closed as a DUPLICATE of MPI-876. Nothing was built and nothing was lost.

**Closed 2026-09-22 by `mpi-umbrella`, on Fabio's direct instruction ("A").**
**Maturity `rejected`, not `complete`** — the work this card describes has NOT shipped. It
moved, whole, to **MPI-876**.

## What was compared

| | MPI-854 (2026-09-20, MPI-849 phase 2) | MPI-876 (2026-09-21, MPI-817) |
|---|---|---|
| title | "The agent states a price and spends only after OK" | "The agent asks before it spends, and says roughly how much" |
| seam | `agent:confirm` in `services/agentLoop.mjs` + `MpiAgentChat.js` | identical |
| price source | `deepinfraPricing.js` | identical |
| batch rule | ONE card carrying the total | identical, reached independently |
| verify mode | `user-ux` | `user-ux` |

Same job, same two files, written a day apart by two sessions that could not see each other.
They could never have run in parallel — a dispatcher would have had to serialise them on
`agentLoop.mjs` anyway.

## Why MPI-876 is the survivor

It is the later and far richer plan: it carries Fabio's own words from 2026-09-21 (**ask every
time**, no suppression path, no per-model exemption), the `estimateCost` contract with its
sub-cent `{ batch: N }` trap, the `null` handling, the `reset()`-resolves-`'declined'` trap that
MPI-870 paid for in real debugging, a drafted copy table, and the settled test model
(`flux-schnell-cloud`, $0.0005 an image).

MPI-854 was never a subset of it. What MPI-854 alone held — and what is now verbatim in
MPI-876's plan under **"ABSORBED: MPI-854, the implementation map"** — is:

- the exact gate site, **`agentLoop.mjs:924`**, and why it cannot sit after `:1004`;
- the **four bypass paths** an agentLoop-only gate misses (`POST /connector/generate`, the
  user's own Cue press, the Flow branch with a null `model.id`, and crash-requeue, which
  re-spends silently by design);
- the **six edits**, including the `GET /agent/history` projection without which a reload loses
  the price and the Yes button still spends;
- the `kind`-is-not-an-enum finding (a new kind is ignored, not rejected, so the failure is a
  wrong card rather than an error);
- the `tests/agent-no-delete.test.cjs` trap;
- Fabio's 2026-09-20 answers: batch size 4, and 200 concurrent requests per model verified on
  the account.

## Evidence this close is safe

- `.agents/mpi-kanban/tasks/MPI-876/plan.md` contains the absorbed section, added in the same
  pass as this file.
- `brief.md` stays in this folder, unedited, as the original source.
- **No code was written for this card, so there is nothing to un-ship.**

## Carried forward, and owed

- MPI-876 is now **both umbrellas' phase** — report it to **MPI-849** as well as MPI-817 when
  it ships. MPI-849's `plan.md` points at MPI-876 in place of this card.
- The real start gate is **MPI-851** (`doing/validating`, on two checks only Fabio can do): it
  ships the `provider` field the "is this op billed" predicate reads. MPI-850 is `done`.
- Corrected while merging: MPI-876's plan described **MPI-852** as "todo, has not started".
  MPI-852 is `done/complete` — it shipped as `CUE | ABOUT $0.14`, the estimator's `display`
  verbatim. The copy-drift question it left open is therefore already answered.
