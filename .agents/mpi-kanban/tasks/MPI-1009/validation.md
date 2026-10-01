# MPI-1009 Validation

## 2026-10-01, Agent 82: self-verified (auto)

**Unit:** `node --test tests/mcp.test.cjs tests/routine-model.test.cjs tests/agent-no-delete.test.cjs tests/connector-routines.test.cjs tests/agent-routine-tool.test.cjs tests/routine-runner.test.cjs tests/agent-routines-store.test.cjs`
-> 107 pass, 0 fail. `npx eslint` on the six touched code/test files -> exit 0.

New coverage: tools/list is 22 with `delete_routine` the only destructive tool; list + read by
name; save/rename/delete reach the route as the in-app agent sends them; run answers running
and `wait_generation` delivers with ONE run call; quote AND run carry the resolved project; a
disk-path value is staged, a groupId/words pass as given; `cancel_generation` on a routine job
answers CANNOT_CANCEL; a paid routine answers CONFIRM_COST (twice, nothing run) and runs only on
the matching price; NOT_INSTALLED and an early app refusal run nothing; the validator refuses
`prompt` and a crop's top-level `ratio`.

**Live, isolated instance** (`APP_DOCUMENTS=<scratch> npm run app:isolated`, port 54400, own
profile; ComfyUI 48188 queue empty before; Fabio's :3000 never driven), over its `/mcp`:

- `save_routine` with `{ operation: "crop", ratio: "1:1" }` -> INVALID_FIELD "ratio goes in
  fields for crop"; with `prompt` on a model step -> INVALID_FIELD "goes in positive".
- `save_routine` crop 1:1 -> downscale 0.25 MP -> saved; `list_routines` and by name returned it
  with its steps.
- `run_routine` on the 1600x900 seed card -> one NEW card, 2 versions. On disk:
  `resize_002.png` 900x900, `resize_003.png` 512x512; the seed `resize_001.png` stayed
  1600x900 with 1 version. Project card count 1 -> 2.
- `rename_routine` then `delete_routine` -> list empty, file in
  `<profile>/agent/routines/deleted/live-square-2.json`.
- Paid step (Nano Banana 2 Lite edit) on the keyless profile -> NOT_INSTALLED "(no cloud key
  set)", nothing run. No confirmCost was ever sent; no money spent.

**Not live-checked:** CONFIRM_COST end to end (needs a cloud key; the isolated profile has
none, and Fabio's app is off limits) - covered by the unit test, through the same `askPrice`
`generate` uses. The live run finished inside the 3 s early window, so the `running` ->
`wait_generation` leg and CANNOT_CANCEL were proven by unit test only.
