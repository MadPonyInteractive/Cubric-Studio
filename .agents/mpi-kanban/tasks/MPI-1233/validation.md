# Validation

- 2026-10-21 `_compactAt()` = window x 0.20 when window >= 1,000,000, else x 0.50; `COMPACT_CAP` removed.
  On MiMo-V2.6-Flash (1,048,576): compaction ~209.7k, long-chat card ~104.9k (was 128k / 64k).
- `node --test tests/agent-loop.test.cjs tests/agent-chat-length.test.cjs`: 215 pass, 0 fail.
  New boundaries asserted: 1M compacts at 200,000 not 199,999; card at 105,000 not 104,000.
- `npm run lint` exit 0; `npm test` 3,497 pass, 0 fail.
- Not checked live in the app (no spend asked for); the trigger reads the provider's own `prompt_tokens`, unchanged.
