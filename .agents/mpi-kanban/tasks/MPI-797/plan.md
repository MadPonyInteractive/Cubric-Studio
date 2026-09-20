# MPI-797 - Agent box: its own input, numbered image chips, a resizable full-height panel

Fabio's five notes from 2026-09-17, now with a drawing behind them. MPI-843 decided the
shape and Fabio approved it twice; this card builds it.

**Read first:** `tasks/MPI-843/validation.md` (every decision, and the two rejected options)
and `tasks/MPI-843/research/chat-merged.html` (the panel, drawn in place at its real 420px).

## Current State

Nothing is built. The decisions are recorded, the panel is drawn, `PRODUCT.md` has been
updated to allow the crew, and MPI-777's open decision 4 is answered. The card was `blocked`
on MPI-774 Phase 3c; that landed in `4ee23d00` on 2026-09-17, so the blocker is stale and
this plan clears it.

**The five original items, re-scoped against what shipped since:**

| # | Item | State |
|---|---|---|
| 1 | The input says how to use it | Phase 2 - the panel's own row carries the hint |
| 2 | Swap the prompt box for an agent box | **DELETED by MPI-843.** Nothing is swapped: the panel grows its own input and the prompt box stays a prompt box |
| 3 | Dropped image attaches, chips numbered 1/2/3 | Phase 2 - moves to the panel input |
| 4 | Panel resizes, full height, pushes the prompt box right | **ALREADY SHIPPED** inside MPI-774 - `agentPanel.js` step 3 mounts an `MpiResizeHandle` and stores the width; `workspace.css:67` offsets the workspace by it. Verify it still holds, build nothing |
| 5 | A Remote image description shows no progress | **DEFERRED** - it wants a mascot animation, so it belongs with MPI-846/MPI-777 once the clips land. Not built here |

## Phases

Strictly sequential. Phase 3 removes the only way into agent mode that exists today, so it
must not land before Phase 1 gives the user a new one. **This is deliberately NOT a
`## Parallel Batch`** - the ownership overlaps in `state.agentMode` and the order is
load-bearing.

### Phase 1: the Agent button joins the top bar

- [ ] `MpiProjectName.js` - a third `_mountButton`, icon `chat` (already in `icons.js`),
      label `Agent`, `size:'sm'`, `variant:'ghost'`, emitting `agent`. It goes **first** in
      `centreGroup`, so the row reads Agent - Flows - Record.
- [ ] `MpiProjectName.css` - `.mpi-project-name__centre` becomes a `1fr auto 1fr` grid so
      **Flows sits dead centre** whatever its neighbours measure. Measured 0px off centre in
      the mockup. This also pays back the half-button drift MPI-678 accepted.
- [ ] **Re-measure `.mpi-project-name__toolbar`'s `max-width`.** The current `7.25rem` is
      documented at `MpiProjectName.css:162-165` as "half the Flows + Record group (~96px)";
      a third button invalidates that number, and the toolbar sliders slide under the group
      when it is wrong.
- [ ] `navigation.js` (beside the `flows`/`record` handlers at :82 and :88) - `agent` flips
      `state.agentMode`. `agentPanel.js:64` already binds the `A` hotkey to exactly that, so
      the button is its visible twin and the panel needs no change.
- [ ] The toggled look: icon and label take `--accent-heat`, **no fill** (Fabio, round 2).
      **Trap:** `MpiButton.css:318` only defines `.is-active` for ICON ghosts
      (`.mpi-btn.mpi-ibtn.mpi-btn--ghost`); a labelled ghost has no active rule, so this
      needs one adding rather than a class reused. On this bar heat is cream at L 0.78,
      slightly dimmer than the resting `--ink-2` at L 0.85 - accepted, because the open
      420px panel is the loud signal.
- **Verify:** the button opens and closes the panel, `A` still does, both agree; Flows is
  centred on the bar with the panel open and shut; the gallery toolbar's sliders do not
  slide under the group at a narrow window.

### Phase 2: the panel gets its own input row

- [ ] `MpiAgentChat.js` template - drop the `props.standalone ?` gate on the input row
      (lines 76-83) so panel mode renders `__input-row` too.
- [ ] `MpiAgentChat.js` setup - the standalone-only block (545-632: `MpiInput`, send button,
      Enter/Shift+Enter, `_doSend`, `_addImageFile`, `_renderAttachments`, the drop
      handlers) stops being standalone-only. It is already written; it only needs its `if`
      widening. Fabio's item (1) is satisfied by its placeholder.
- [ ] **Decide `agent:send`'s fate, do not leave it half-wired.** Its only producer is
      `MpiPromptBox.js:2516`, which Phase 3 deletes; its only consumer is
      `MpiAgentChat.js:539`, and `tests/desktop/agent-chat.spec.js:1242` emits it to prove
      the panel listens. Either keep the event as the panel's own send path (documented at
      `events.js:142` - update that line, it names MpiPromptBox as the producer) or delete
      the pair and call `_sendMessage` directly, and delete the spec's emit with it.
- [ ] Item (3): attachments are numbered 1, 2, 3 - never "start frame" or "picture 1".
      `_renderAttachments` (606) draws thumbs with no number today; add the index.
- [ ] The light terminal register from the drawing: a `>` glyph and a block caret on the
      input only, transcript stays prose. `caret-shape: block` with the native bar as
      fallback; the mockup's drawn caret is a mockup device, not a thing to port.
- **Verify:** type in the panel and send with no prompt box on screen (the History
  workspace has none); drop an image on the panel and see it numbered; the landing
  standalone chat is unchanged.

### Phase 3: agent mode leaves MpiPromptBox

The removal is ~10 sites across a 2766-line file. Grep `_agentMode` first - 34 hits.

- [ ] Delete: `mode-toggle-slot` (template, :110), `_setAgentMode` (2485), `_sendAgentTurn`
      (2493), `_applyAgentView` (2446), the agent branches in `_readMode`/`_writeMode`
      (172-175), `AGENT_MAX_IMAGES` (83), `COG_INFO_AGENT` (89), the Enter branch (1491-1498,
      2556), the chip/badge branches (337, 421, 937, 958, 1470), `_fitMediaToOperation`'s
      agent caller, and `.mpi-prompt-box--agent-mode` / `__popup--agent` in the CSS.
- [ ] **`state.agentSettingsPinned` goes dead and it is NOT only cosmetic.** It is written
      only inside MpiPromptBox (1669, 1675, 2454, 2760) but READ by `agentService.js:81` and
      `agentDispatch.js:212`, where it decides whether the agent inherits the user's pinned
      model and settings. Remove the writers and that branch is permanently false - dead
      code in the dispatch path, not a leftover flag. **Fabio already ruled the behaviour
      does not work today** (MPI-843 validation), so nothing observable breaks; decide
      deliberately between deleting the read side too and re-homing the trigger, and say
      which in `validation.md`. The open product question - should an agent generation
      inherit the prompt box's model and settings? - stays with the agent track.
- [ ] **Test debt, and it is real.** `tests/agent-ui-surfaces.test.cjs` is a source-contract
      suite whose regexes pin these exact lines (73, 82, 86, 88, 89, 99) - it goes red the
      moment the code goes. `tests/desktop/agent-chat.spec.js` pins `mode-toggle-slot` in
      the slot order at 673, 717, 947, 951, 957. Move the assertions to the new surface;
      never just delete them.
- **Verify:** `npm test`, `npm run lint`, and the two specs above green; the prompt box in
  every workspace has no Agent toggle and generates as before.

### Out of scope, on purpose

The ledge (Cosmo docked above the input, the guest mascot sliding in with its family accent)
is drawn in the mockup but belongs to **MPI-846 Phase 3 / MPI-777**, which are gated on the
GIF clips. The panel built here must leave room for it above the input row.

## Claims to respect

Both were live when this plan was written - check `state/index.json` again before editing:

- `MpiProjectName.css` + `MpiPromptBox.js` + `MpiPromptBox.css` - claim `450b7f35`,
  **MPI-736** (`doing`/`in-progress`, the per-media accent family). Phases 1 and 3 both
  need it. Message the owner or wait; do not edit around them.
- `MpiAgentChat.js` - claim `e15fd08d`, **MPI-839** (`doing`/`validating`). Phase 2 needs it.
- `MpiPromptBox.js` also carries claim `b89bab94` for **MPI-822**, which is `done/complete` -
  a stale record, safe to release.

## Verification

**Verify mode:** `user-ux` - Fabio's own eyes, as the card says.

Fabio checks: the Agent button opens the panel and reads as on; Flows is centred; he can
talk to Cosmo and generate in the prompt box at the same time; a dropped image arrives
numbered; the status bar is untouched.
