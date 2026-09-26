# MPI-944 validation

## What changed

- `js/data/modelConstants/modelPriority.js`: both Boogu notes carry `ONE_IMAGE`: it can never
  bring anything in from another picture; that is `qwenEdit`, else `kleinEdit`, else `krea2Edit`,
  changed picture first, content picture second.
- `docs/agent/models/flux-2.md` Pick it when: the second-image line covers a person and the
  furniture of the same place from another angle, gives the Klein / Krea 2 fallback when Qwen is
  not installed, says never Boogu, and gives the load order.
- `scripts/agent-test.mjs`: cases `second-picture-room` (Boogu High + Klein 9B, the tester's
  box), `second-picture-room-every-editor`, `second-picture-character`; grader
  `gradeSecondPicture` (content picture sent, into a slot the op has, changed picture as
  `inputImage`).
- `tests/model-priority.test.cjs`: both Boogu notes name the three editors, Boogu really has one
  slot, and each named editor really has `inputImage2` (`mediaRolesFor`, what the agent reads).
- `docs/agent-findings.md` finding; `docs/agent-chat.md` harness count 22 -> 26 (it was 23
  before this card).

## Evidence (2026-09-26/27, `deepseek-ai/DeepSeek-V4-Flash-0731`, fake tools)

| | before | after |
|---|---|---|
| `second-picture-room` (Boogu + Klein) | 1/3 | 3/3 (kleinEdit every run) |
| `second-picture-room-every-editor` | 3/3 (qwenEdit) | 3/3 (qwenEdit every run) |
| `second-picture-character` | 2/3 | 3/3 (qwenEdit every run) |

Every run sent the empty picture as `inputImage` and the content picture as `inputImage2`.
Two earlier "after" batches were also 9/9 each.

**A note can outrank the guide.** The first wording listed `kleinEdit` first, and the
every-editor box moved off Qwen (Klein in 5 of 6 runs) against `flux-2.md`'s own order. Now
the note gives the guide's order and the pick follows it.

`--bite` (only the empty picture attached): 3/3 bite, each as "never generated": the agent
asked for the missing photo rather than inventing it. The grader's named failures were proven
on synthetic runs as well (Boogu with B alone; Boogu with A in a slot it lacks; the pictures
swapped): each caught, the right call passes.

- `node --test` on agent-corpus, agent-prompt-budget, flow-model-choice, model-priority,
  recipe-registry, uninstalled-op-gate: 51/51.
- `npm test`: 1995 pass, 0 fail.

Harness spend for the card: about $0.25.

## Shipped

`983ecf44e` (the fix) + `6ee78cb83` (removed the research fragment that broke `eslint .` on master at 7df2f423b). CI run 36278564806 on `6ee78cb83`: unit + desktop 1-4 all green. The class is closed by 55265f1d7 (MPI-946 session): `eslint.config.js` ignores `.agents/**`.

## Not covered

Whether Klein or Qwen can actually redraw the content from a reversed viewpoint. Routing only.
