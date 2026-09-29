# MPI-987 validation

**Shipped:** `48611f4d8`. The masked App state line (`services/agentLoop.mjs`) now adds that painting chose
that entry (so the agent never sends the user to repaint somewhere else), and that anything they say they
painted is the mask, a sound-alike included.

**Evidence**
- `tests/agent-loop.test.cjs` "a painted mask is named on the line" pins both sentences; with
  `tests/agent-prompt-budget.test.cjs`: 155 pass, 0 fail. Full unit suite later in the session: 2276 pass, 0 fail.
- The system prompt is unchanged (the line is per turn, only when a mask is painted), so the prompt budget is untouched.

**Not proven on the real model.** No harness case: `services/agentBench.mjs` has no `workspace` plumbing.
Fabio chose not to run the live re-test (2026-09-29). He corrected the wording in chat and the agent then ran
the masked inpaint on his mask, which shows the flow works once the word is right. It does not show that the
new line fixes the misheard case.

**Found on the way:** that inpaint came back at 1344x768 from a 1920x1080 source. That is MPI-988.
