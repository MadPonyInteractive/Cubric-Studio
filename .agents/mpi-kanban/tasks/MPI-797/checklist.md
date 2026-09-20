# MPI-797 Checklist

Derived from `plan.md`, 2026-09-20. Strictly sequential: phase 3 removes the only way into
agent mode, so phase 1 must ship first.

## Phase 1 - the Agent button joins the top bar
ACCEPTED by Fabio 2026-09-20 in his own app (verify mode `user-ux`). See validation.md.
- [x] Third ghost button in `MpiProjectName.js`, icon `chat`, FIRST in the centre group.
- [x] `.mpi-project-name__centre` becomes `1fr auto 1fr` so Flows is dead centre.
      Measured 0.00px off centre, and still 0.00px with Record hidden.
- [x] Re-measure `.mpi-project-name__toolbar` `max-width` (7.25rem assumed two buttons).
      7.25rem overlapped by -30.2px; 9.75rem clears by +9.8px. Both measured.
- [x] `navigation.js` flips `state.agentMode`; agrees with the `A` hotkey.
- [x] A toggled look for a LABELLED ghost - `MpiButton.css` has `.is-active` for icon ghosts only.
      **The premise was wrong:** an icon+label button still carries `mpi-ibtn`, so the button
      was already covered. The real gap was the LABEL (`--ink-1` at (0,3,0)); fixed in
      `MpiProjectName.css` and the `MpiButton.css` edit was reverted. See validation.md.

## Phase 2 - the panel gets its own input row
BUILT 2026-09-20, three rounds of Fabio's own eyes; no final "verified" yet. See validation.md.
- [x] Render `__input-row` in panel mode (drop the `standalone` gate).
- [x] Widen the standalone-only setup block to both modes.
- [x] Settle `agent:send`: **DECIDED - delete the pair, executed in PHASE 3, not here.**
      Its only producer is MpiPromptBox:2537, which phase 3 deletes; removing the listener
      now breaks the toggle in the window between the phases. `events.js:142` is therefore
      still accurate and is untouched - phase 3 updates it.
- [x] Attachments numbered 1, 2, 3 - composer AND sent bubble, one `_attachmentChip()`.
- [x] `>` glyph and a block caret on the input; transcript stays prose.
- [x] Not in the plan, found by Fabio in the app: the box never collapsed after a send;
      the hint stranded 21px above the `>`; the send button oversized; 13 attachments
      could starve the field. All fixed and measured.

## Phase 3 - agent mode leaves MpiPromptBox
- [ ] Remove the toggle and every `_agentMode` branch (~10 sites, 34 grep hits).
- [ ] Decide `state.agentSettingsPinned`: it is read by `agentService.js` and `agentDispatch.js`.
- [ ] Move the assertions in `tests/agent-ui-surfaces.test.cjs` and `tests/desktop/agent-chat.spec.js`.
- [ ] `npm test` + `npm run lint` green.

## Close
- [ ] Fabio's `user-ux` check (see plan's Verification).
- [ ] Record what shipped, and the `agentSettingsPinned` decision, in `validation.md`.
