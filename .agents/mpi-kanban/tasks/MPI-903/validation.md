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

## Phase 4 — prove (2026-09-24, same model, 22 cases x 3)

An earlier attempt died on DeepInfra `402 Payment Required` after 10 conversations; the account was
topped up and every run below is a real behaviour result.

**Run 1, on 879caf0c as committed: 17/22 at 3/3.** Five cases fell below the baseline:

| case | runs | what it did | fix |
|---|---|---|---|
| ranked-editor | 0/3 | "make it a night scene" ran i2i | Model rule: a whole-frame change to what is in the picture is the edit task; i2i only for a restyle the user asks for |
| text-in-picture | 0/3 | offered mask vs whole edit and waited | Text rule: "run it, with no mask question" (the condense dropped "run the edit") |
| new-project-brief | 1/3 | no project made / no brief note | Project rule: "Asked to start a new project, create it... that alone asks for nothing to be made"; `create_project` result carries a `note` asking for the brief |
| memory-write-unprompted | 1/3 | made the picture, promised to "keep track" | first ok `generate` of a turn with no `write_memory` carries `remember` (once per turn; `tests/agent-loop.test.cjs`, mutation-proved) |
| no-delete | 2/3 | called `list_cards`, then refused correctly | CHECK fix, not behaviour: `list_cards`/`visible_cards` are reads, and the Cards rule sends "the fox card" there |

Rule text alone moved memory-write-unprompted to 5/8 only, so the tool-result nudge took it (plan
principle 1). A first rewording of the Model rule ("only a restyle into another look or medium")
broke rerun-on-named-model (1/3: an anime MODEL read as a restyle ask); the final wording is 5/5.

**Final run, on the final code: 21/22 at 3/3.** The one miss, picks-installed-model 2/3, sent
`ratio: "3:2"` (krea2 does not offer it), met the `INVALID_RATIO` gate and recovered to 16:9; the
same case went 5/5 straight after, and 3/3 in both earlier full runs (13/14 overall). Noise, not the
rewrite: nothing in this phase touched Settings. Cost $0.2155 for 66 conversations.

`--bite` on the final code: **21/22 bite.** video-limit's flip (a frame attached, "look at it and
tell me if the motion is smooth") did not bite once: the model answered that one frame cannot show
motion, without calling `look`, which is an honest answer, so the flip is the weak part, not the
check. Re-run alone it bit, and it bit in both earlier `--bite` runs (3 of 4).

Floor (`no-delete`, one call): **7,035 input tokens, down from 11,104 (-37%)**. System prompt
9,764 bytes (budget 9,800), tool schemas unchanged. Agent + connector suites: 399 pass, 0 fail,
1 todo (MPI-867). eslint clean on `services/agentLoop.mjs`, `scripts/agent-test.mjs`,
`tests/agent-loop.test.cjs`, `tests/agent-sessions.test.cjs`.
