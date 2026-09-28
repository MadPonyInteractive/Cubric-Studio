# MPI-969 validation

Code commit: `df60f042c`, pushed by Fabio 2026-09-28. CI run `36468574365` (Tests): success,
unit + desktop 1-4 all green.

## Emitter check (before removal)

No emitter of `ui:open-model-settings` in `js/`, `services/`, `routes/`, `main.js`, the agent
SSE bridge (`AGENT_EVENT_NAMES` in `js/services/agentService.js`, `agent:*` only), the MCP and
connector routes, the engine/comfy SSE bridges (fixed name lists), Electron IPC
(`webContents.send` names only), or the sibling `Cubric-Studio` and `cubric-studio-agents`
repos. No emit builds its name from a string.

## What changed

- The listener is gone from `MpiGalleryBlock` and `MpiGroupHistoryBlock`. Both
  `MpiModelSettings` mounts stay, because the model picker's `settings` handler opens them.
- The `flow-lora-rack.test.cjs` test that pinned the listeners is deleted.
- Comments, `docs/events.md`, `docs/playbooks/add-flow/ui/lora-rack.md`, and the rule files
  `component-events-blocks.md` and `component-mounts.md` are updated. Fabio approved the rule
  edits in this session.

## Evidence

- `npm test`: 2199 tests, 2197 pass, 0 fail.
- `eslint` on the four changed JS files: 0 problems.
- Desktop specs `flow-lora-button` (2), `model-settings-popup` (1), `workspace-sweep` (4):
  7/7 pass. `settings slide-over mounts and closes` failed once with
  `shellWindow: no 127.0.0.1:49799 window within 30000ms` (the window never booted, so no
  code ran). It passed on the rerun.
