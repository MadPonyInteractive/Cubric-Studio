# MPI-1125 - Cosmo's per-request prompt: always-sent rules vs pointers

Fabio, 2026-10-13: "make sure it loads the list ... when it talks to the user and that it
uses mostly pointers that are only accessed depending on what the user needs or asks."
Reading to confirm: Cosmo always carries a short list of topics, and reads a topic's detail
only when the question needs it.

## Measured 2026-10-13 (offline, `_buildSystemPrompt('auto')` + `TOOL_DEFS`, at ebdea8738)

- System prompt 11,124 bytes = 25 rules (~10.7 KB) + the `app:*` index (411 bytes, 11 lines).
- Tool schemas 19,647 bytes; `generate` alone 4,283; the four GIF tools 4,591.
- Floor ~30.8 KB, estimated ~8k tokens (no tokenizer run; a live call reports the real count).
- The 11 `app:*` docs total ~72 KB and are already read on demand (`read_knowledge`).
- Biggest rules: Model 1,264, Honest limits 1,078, Route 919, Repeat 837, Cards 816,
  Settings 683, Project 676.

## Cache layout (read from `runTurn`)

- System prompt is message 0, rebuilt each turn but byte-stable (changes only with mode).
- The App state line, notes and finished-job lines ride at the top of the USER message, so
  they never break the cached prefix.
- A wake turn sends `WAKE_TOOL_DEFS` (two tools fewer): a different tool list, so that call
  likely misses the prefix cache.

## Price (DeepInfra `/v1/openai/models`, DeepSeek-V4-Flash-0731, per 1M tokens)

input 0.06, cached input 0.015, output 0.18. The floor costs ~0.0005 per request uncached,
~0.00012 cached. History, not the floor, is the bill: compaction fires at 30% of 1M =
~314k prompt tokens per request.

## Measured live 2026-10-13 (5 calls, DeepSeek-V4-Flash-0731, total 0.0015 USD)

| Call | prompt_tokens | cached |
|---|---|---|
| system + "hi", no tools | 2,673 | 0 |
| system + tools, turn 1 | 8,095 | 0 |
| turn 2, same tools | 8,174 | 7,936 (97%) |
| wake turn, `WAKE_TOOL_DEFS` | 8,117 | **0** |
| next normal turn | 8,340 | 7,936 |

- Floor = ~8.1k tokens: system ~2.65k, **tools ~5.4k (two thirds)**.
- Cache works across turns (97%), in 128-token blocks. A wake turn misses it entirely.

## Decided (Fabio, 2026-10-13): all four

1. One-line "covers:" description per `app:*` entry, authored at the top of each doc.
2. Task-only rules (Repeat, Duration, Shape, Text, Settings detail) move into the tool
   results that need them; Model, Route, Masking stay always-on. Proven with `agent:test`
   (quote before the run).
3. Compaction at a fixed size (~128k tokens) instead of 30% of a 1M window.
4. Wake turns send the full tool list; the two project tools refuse in-loop instead.

Plus Fabio's proposal: a "this chat is getting long" choice for the user (see report).
