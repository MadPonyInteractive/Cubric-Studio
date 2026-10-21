# Validation

- 2026-10-21 `_longAt()` = `_compactAt()` x 0.50 on a window >= 1M, x 0.75 below. Ollama 65,536:
  compaction 32,768, card 24,576 (was 16,384). MiMo 1,048,576 unchanged (~104.9k).
- `agent:long` carries `local: profileId === 'ollama'`; the card title drops "and cost a little more" when true.
- New tests (`tests/agent-chat-length.test.cjs`): 64k shows nothing at 24,575 and the card at 24,576;
  `local` false on DeepInfra, true on Ollama. 217 pass in the two agent files.
- `npm run lint` exit 0; `npm test` 3,500 pass, 0 fail; CI Tests run 39620635927 success on 67f5136b2.
- Not eye-checked in the app: the local title is a text swap on the same element.
