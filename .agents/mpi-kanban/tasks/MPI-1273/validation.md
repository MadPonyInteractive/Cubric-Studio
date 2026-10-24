# MPI-1273 validation

- `node --test tests/child-safety.test.cjs tests/child-safety-gate.test.cjs`: 66 pass, 0 fail (2026-10-24).
  New: `a look that could not run says what broke` (a 429 from the describer reaches the agent's
  `userMessage` and the toast); `refusal('pictureUnchecked', error)` keeps the error, no doubled full stop.
- The existing MPI-1152 log test now expects `(pictureUnchecked) error="..."`.
- ESLint on the four changed source/test files: clean.
- Not checked live: the photographer's own failure. His `app.log` line `llm describe failed:` still names the cause.
