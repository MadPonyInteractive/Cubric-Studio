# MPI-774 Validation

Evidence per plan item, newest at the bottom. Card closes when every brief item 1-15 has a line
here, the harness passes 9 cases 3/3, and Fabio's pass is recorded.

## Phase 0

- **Contract, `docs/agent-chat.md`** (2026-09-15): written, 180 lines (`wc -l`). Brief items 1-15
  each have a row in § "Brief items -> surface" (15 of 15, plus profiles/probe). The six brief
  § Architecture tools (list models, read knowledge, install, generate, look, open project) each
  have a parameter schema in § Tools. `docs/README.md` routes it (Core app table, after Flows).
  `validate_board.py .` -> "Board validation passed."
- **Describer question** (2026-09-15, Fabio authorised the agent to edit `raw/`): node 38 retitled
  `Text String (System Prompt)` -> `Input_Describe_Prompt` in `comfy_workflows/raw/image_descriptor.json`
  (one line; node 46 carries the same old title and is unconnected, left alone).
  `node scripts/sync-raw-workflows.mjs` -> raw committed `aff97551`, converted, "All 1 file(s)
  conform to the injection rules", runtime staged. Scripted check against a pre-sync snapshot of
  runtime node 38: title `Input_Describe_Prompt`, `value` identical (1773 chars), feeds
  `36.prompt`, title unique -> PASS. `node --test tests/inject-params-titles.test.cjs` -> 23 pass,
  0 fail. `git diff --cached comfy_workflows/image_descriptor.json` -> the `_meta.title` line only.
  No GPU used (the sync reads `/object_info` only).
