# MPI-797 Checklist

Derived from `plan.md`, 2026-09-20. Strictly sequential: phase 3 removes the only way into
agent mode, so phase 1 must ship first.

## Phase 1 - the Agent button joins the top bar
- [ ] Third ghost button in `MpiProjectName.js`, icon `chat`, FIRST in the centre group.
- [ ] `.mpi-project-name__centre` becomes `1fr auto 1fr` so Flows is dead centre.
- [ ] Re-measure `.mpi-project-name__toolbar` `max-width` (7.25rem assumed two buttons).
- [ ] `navigation.js` flips `state.agentMode`; agrees with the `A` hotkey.
- [ ] A toggled look for a LABELLED ghost - `MpiButton.css` has `.is-active` for icon ghosts only.

## Phase 2 - the panel gets its own input row
- [ ] Render `__input-row` in panel mode (drop the `standalone` gate).
- [ ] Widen the standalone-only setup block to both modes.
- [ ] Settle `agent:send`: keep it as the panel's send path, or delete the pair. Update `events.js:142`.
- [ ] Attachments numbered 1, 2, 3.
- [ ] `>` glyph and a block caret on the input; transcript stays prose.

## Phase 3 - agent mode leaves MpiPromptBox
- [ ] Remove the toggle and every `_agentMode` branch (~10 sites, 34 grep hits).
- [ ] Decide `state.agentSettingsPinned`: it is read by `agentService.js` and `agentDispatch.js`.
- [ ] Move the assertions in `tests/agent-ui-surfaces.test.cjs` and `tests/desktop/agent-chat.spec.js`.
- [ ] `npm test` + `npm run lint` green.

## Close
- [ ] Fabio's `user-ux` check (see plan's Verification).
- [ ] Record what shipped, and the `agentSettingsPinned` decision, in `validation.md`.
