# MPI-1262 Validation

- Piece 1 (ff2e430c1): entries line + `list_cards <groupId>` entries; `tests/agent-cards.test.cjs`, checked on Fabio's real "Moss image" card t2i_054 (4 entries).
- Piece 2 (9852ab424): model card + style carried on a same-model redraw; `tests/agent-loop.test.cjs` "an upscale or detail of another model's picture asks which model redraws it, and keeps its style".
- Piece 3 (e73d513d8): remembered mask reused on its own entry; `tests/agent-mask-dispatch.test.cjs` "a redo on the masked entry reuses its mask, and only there", `_sanitiseWorkspace` lastMask test, `_entriesLine` mask line in `tests/agent-cards.test.cjs`.
- `node --test tests/agent-*.test.cjs`: 544 pass, 0 fail, 1 skipped. eslint clean. pre-push lint + unit tests green on both pushes.
- CI tests.yml on e73d513d8: success (run 40026385858).
- Not yet seen live in the app; Fabio chose to close now (2026-10-23).
