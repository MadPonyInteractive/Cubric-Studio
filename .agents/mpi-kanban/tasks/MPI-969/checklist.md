# MPI-969 checklist

- [x] Verify no emitter: `js`, `services`, `routes`, `main.js`, agent SSE names (`AGENT_EVENT_NAMES`), MCP/connector routes, string-built names, Electron IPC, sibling Cubric-Studio + cubric-studio-agents. Only listeners, comments, tests.
- [x] Fabio approved removal + the `.claude/rules/` edits (2026-09-28, this session).
- [x] Drop the listener in `MpiGalleryBlock` and `MpiGroupHistoryBlock`. Their `MpiModelSettings` mounts STAY: the model picker's `settings` handler still opens them.
- [x] `tests/flow-lora-rack.test.cjs`: delete the test that pins the listeners; fix the comment that says two components listen.
- [x] Comments: `MpiBaseFlow.js` `_paintModelSlots`, `flowsRegistry.js` `action` doc, `flow-lora-button.spec.js`.
- [x] Docs: `docs/events.md` row, `docs/playbooks/add-flow/ui/lora-rack.md`.
- [x] Rules: `component-events-blocks.md` (both Blocks), `component-mounts.md` (MpiBaseFlow's MpiModelSettings line).
- [x] `npm test`, lint, desktop `flow-lora-button` + `model-settings-popup` + `workspace-sweep` specs: unit 2197 pass / 0 fail, lint 0, desktop 7/7 (settings slide-over needed a second launch: `no 127.0.0.1 window within 30000ms`, a boot flake before any code ran).
