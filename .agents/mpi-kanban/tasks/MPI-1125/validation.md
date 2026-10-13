# MPI-1125 validation

## Floor, measured live (DeepSeek-V4-Flash-0731 on DeepInfra)

| | before | after |
|---|---|---|
| system prompt bytes | 11,124 | 10,702 (incl. +820 of Covers lines) |
| tool schema bytes | 19,647 | 15,333 |
| prompt tokens, system only | 2,673 | 2,571 |
| prompt tokens, system + tools | 8,095 | 6,753 (-17%) |
| wake turn cached | 0 of 8,117 | same tool list as a typed turn (test) |

Budgets in `tests/agent-prompt-budget.test.cjs` lowered to the measured sizes.

## Tests

- `npm test`: 3,284 tests, 3,282 pass, 0 fail.
- New: `tests/agent-chat-length.test.cjs` (7), the wake tool-list test, the describe_model
  rules test, the Repeat test, the Covers test, the gif-tool gate and stray-setting tests.

## Real model (`npm run agent:test`, 38 cases x 3)

32 of 38 cases 3/3. Every case that exercises a moved rule or the folded tool passed 3/3:
`text-in-picture`, `rerun-on-named-model`, `auto-video-medium-turbo`, `sheet-goes-to-reference`,
`reads-guide-first`, `ranked-editor`, all six `routine-*`.

Six cases 2/3, each a different one-off:
- `ask-first` #3: asked for the settings and did not generate, but with no "?" (the grader's check).
- `new-project-brief` #3: generated when asked for nothing (Project rule, untouched).
- `video-hair-to-video-edit` #3: sent `fields` as a malformed JSON string.
- `outpaint-grows-one-side` #1, `second-picture-room-every-editor` #3, `second-picture-character` #3:
  STEP_LIMIT, looping `look` on the edit result by a `/project-file?path=` ref.

Baseline for the look loop, the same three cases x3 on the pre-change HEAD (8864fc41e, own
worktree): `second-picture-room-every-editor` #1 failed with the identical loop (1 of 9 there,
3 of 9 here; too few runs to call a rate change). An existing bug, filed as its own task.

Spend: harness-priced (every token as fresh input) 0.4605 + 0.0670 USD for 123 conversations;
billed lower, as the prompt cache read about 97% of a repeated prefix at a quarter of the price.

## Live UI (own `app:isolated` instance, never :3000)

The card drawn by an `agent:long` event in the landing chat: title, the notes hint, Start
fresh / Compact / Keep going (wrapping at the landing chat's width). Keep going removes it.
`POST /agent/shorten` answers `NO_CHAT` on an empty chat and 400 on a bad choice.
Not exercised live: Start fresh and Compact on a real long chat (covered by the unit tests).
