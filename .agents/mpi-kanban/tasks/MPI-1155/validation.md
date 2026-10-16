# MPI-1155 Validation

Scope changed twice mid-session (Fabio, 2026-10-16): first "credit LEFT matters, not the
month's spend", then "always show it, on the home page and the status bar, like
`$0.50 of $15`". The Remote-panel button was dropped; nothing ships there.

## Shipped
- `client.balance(key)` (`routes/runpodRemote.js`) — GraphQL `myself { clientBalance }`. RunPod v2
  has no balance route (v2 `/billing` is history only); runpodctl's `user` reads the same field.
- `/remote/pod/specs` returns `creditUsd`: one balance read per Pod, plus what the Pod had
  billed by then, so a warm-resumed Pod is not counted twice.
- `podSpendText(cost, creditUsd)` (`js/utils/podCost.js`) — both surfaces print
  `$0.58 of $15.37`, or `$0.58` when there is no credit figure.

## Evidence
- `node --test tests/status-bar-spend.test.cjs` + RunPod suites: 44/44. Full `npm test`: 3337 pass, 0 fail.
- Isolated app, one faked `remote:connection` tick (14 min at $2.49/hr, credit 15.37):
  hero "CURRENT SESSION 14min/$0.58 of $15.37" on one line; status bar
  "IDLE · Remote · $0.58 of $15.37".

## Not verified
- A live GraphQL answer with a real key (no key in the agent profile). Fabio's next Pod
  connect, after an app restart, is the check: the "of $X" must match his RunPod balance.
