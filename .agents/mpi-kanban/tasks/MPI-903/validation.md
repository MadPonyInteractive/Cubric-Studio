# MPI-903 validation

## Phase 0 baseline (HEAD 7faac616, before any edit)

`npm run agent:test` (real model `deepseek-ai/DeepSeek-V4-Flash-0731`, 21 cases x 3), 2026-09-24:
**21/21 cases at 3/3.** Cost $0.2303 for 63 conversations ($0.00366 each).

Floor: `no-delete` is a single call, so its input is the per-request floor plus one short user
message: **11,104 input tokens** (all three runs).

| case | runs | typical in-tokens / run |
|---|---|---|
| picks-installed-model | 3/3 | ~62k (4 calls) |
| install-needed | 3/3 | |
| auto-video-medium-turbo | 3/3 | |
| ask-first | 3/3 | |
| install-asks | 3/3 | |
| look-before-comment | 3/3 | |
| look-refusal | 3/3 | |
| video-limit | 3/3 | |
| create-then-generate | 3/3 | |
| open-by-name | 3/3 | |
| new-project-brief | 3/3 | ~34k (3 calls) |
| reads-guide-first | 3/3 | 60-75k |
| memory-read | 3/3 | ~63k |
| memory-write | 3/3 | ~22k (2 calls) |
| ranked-editor | 3/3 | 126-147k (7-8 calls) |
| rerun-on-named-model | 3/3 | ~60k |
| text-in-picture | 3/3 | ~62k |
| outpaint-grows-one-side | 3/3 | 56-57k |
| over-boxed-head | 3/3 | 62-72k |
| memory-write-unprompted | 3/3 | 63-81k |
| no-delete | 3/3 | 11,104 (1 call) |

## Phase 1 — gates (each mutation-proved: the check disabled turns its test red)

- `MASK_SEVERAL_AREAS` (`js/shell/agentDispatch.js` `resolveMask` + `countMaskAreas`): edit, kleinEdit,
  krea2Edit, qwenEdit, inpaint refuse a mask with 2+ separate areas; detail passes. Tests in
  `tests/agent-mask-dispatch.test.cjs`.
- `KNOWLEDGE_NOT_READ` (`services/agentLoop.mjs`): with a mask painted on the open card, a masked op
  waits for `app:masking`. Tests in `tests/agent-loop.test.cjs` (h).
- `BOX_TOO_BIG` + look `hint` (`services/agentLoop.mjs`): a box square over 0.6 of either side is
  not a measure; the second says stop and ask the user to crop.
- Start-frame `use` text (`routes/connector.js` `mediaRolesFor`): startFrame says the clip opens on
  it and a character sheet goes to a ref2v op. Test in `tests/connector-agent-tools.test.cjs`.
- `look` refusal hint: NOT a gate. The describer's refusal is free text with no structured signal,
  so it stays one sentence in the Looking rule.

## Phase 2-3 — rewrite measured

System prompt 25.4 KB -> **9,490 bytes** (with the app:* index); tool schemas 17.7 KB -> **16,947 bytes**.
Agent, connector and GIF suites: 456 pass, 0 fail. `tests/agent-prompt-budget.test.cjs` mutation-proved
(a date in a rule, a 210-line doc: each turns it red). eslint clean on touched files.

## Phase 4 — harness after the rewrite: INCOMPLETE (DeepInfra 402)

2026-09-24, same model, 21 cases x 3 (the run predates the new case). The account ran out of credit mid-run: every call after the
tenth conversation answered `402 Payment Required`, so 56 of 66 runs made 0 calls. Not a behaviour
result. What did run, before the 402:

| case | runs | note |
|---|---|---|
| picks-installed-model | 3/3 | 5-6 calls (4 at baseline), 55-70k in |
| install-needed | 3/3 | ~28k in |
| auto-video-medium-turbo | 3/3 | |
| ask-first #1 | turn 0 correct | asked the settings before generating; turn 1 died on the 402 |

**Still owed:** the full x3 run (and `--bite`, and the new `sheet-goes-to-reference` case) once the
DeepInfra balance is topped up. About $0.25 a full run.
