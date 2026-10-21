# MPI-1225 validation

- Live 2026-10-21: quote 01:51:45, Fabio clicked Yes, no generation.submit followed; quote 01:52:18 (second card), submit 01:52:57. The connector generate route refused the first call with its own pre-dispatch checks, which logged nothing; the quote route never ran them.
- Fix: both routes share _checkGenerate; a quote the submit would refuse is refused with the same code, so the agent spend gate (_askSpend: quote not ok -> null) raises no card. Generate logs every refusal (connector generate refused: CODE message).
- Not proven which check refused the live call (it was unlogged); the new log line names it next time.
- Tests: agent-generation-relay (quote and generate refuse the same bodies with the same code, nothing relayed), agent-loop, mcp, agent-no-delete, agent-view-follow: all pass. Pre-push full suite green on 707910c7f.
