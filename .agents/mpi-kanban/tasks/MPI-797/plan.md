# MPI-797 - Agent box: its own input, numbered image chips, a resizable full-height panel

Fabio's five notes from 2026-09-17, now with a drawing behind them. MPI-843 decided the
shape and Fabio approved it twice; this card builds it.

**Read first:** `tasks/MPI-843/validation.md` (every decision, and the two rejected options)
and `tasks/MPI-843/research/chat-merged.html` (the panel, drawn in place at its real 420px).

## Current State

**ALL THREE PHASES ARE BUILT AND ACCEPTED.** Fabio verified Phase 2 and Phase 3 together
in his own app on 2026-09-21 ("it looks good, mate"); Phase 1 was accepted 2026-09-20.
The card stays in `doing` because of the open item (1) below, NOT because anything is
unverified.

Phase 3 (2026-09-21): the agent face is gone from MpiPromptBox. `npm test` 1668 pass / 0
fail, `agent-chat.spec.js` 31/31, every new guard proven red on pre-fix code one back-out
at a time. Full write-up in `validation.md` § Phase 3. Three things there need Fabio
rather than a re-read:

1. **A REGRESSION this phase causes.** `_sendAgentTurn` was the only UI path for handing
   the agent a VIDEO (MPI-817, shipped 2026-09-20). It died with the toggle. The server
   half is intact; nothing can reach it. Restoring it needs project-media staging in the
   panel composer, which is a surface of its own — NOT a line of Phase 3. Its test is a
   `todo`, not deleted. His call whether Phase 3 ships with it.
2. **`state.agentSettingsPinned` was RE-HOMED, not deleted** — onto `state.agentMode`.
   The plan's other option (delete the read side) turned out to mean deleting a
   whole-stack feature with its own 8-test suite, on a card about a UI toggle.
3. **The PINNED popup was deliberately left alone** and now holds in a situation that
   could not exist before (the panel open while he uses the prompt box). He has ruled on
   that behaviour twice, so it was not quietly changed. Worth a look in the app.

Also fixed here, not this card's: MPI-863's boot seed (`e2bc81f5`) turned auto-start
ComfyUI ON inside the E2E harness and red 16 of 31 desktop specs on any box that has an
engine. One `!_isE2E()` clause. Proven not-ours first by swapping this session's eight
files to their HEAD blobs.

**The two open threads below still stand, because Fabio named them himself:**

1. **The panel header** should become Cosmo (face + name), not the word `Agent`.
2. **The ledge** above the input — Cosmo docked, a guest mascot sliding in with its family
   accent. Fabio calls it "the footer above the user text with the two MASCOTS", and
   corrected the wording himself: **there is ONE agent, Cosmo.** The other four are never
   agents and never speak — they are working indicators carrying their family accent while
   their kind of work runs, then they hand back to Cosmo. Do not write "two agents"
   anywhere in this track.

Both are **MPI-846 Phase 3 / MPI-777 / MPI-842**, gated on the GIF clips, and the § "Out of
scope, on purpose" section below still holds: the composer built here deliberately leaves
room above the input row for the ledge. Do NOT fold them into this card — but expect Fabio
to ask for them next, and MPI-777 is unblocked and queue-first.

**Phase 1 was built and accepted (Fabio, 2026-09-20, in his own app).**
Commits `47fcdc2a`, `fcefd4ff`, `ad155a98`, `9a71f2ce`, all pushed. Evidence and every
measured number are in `validation.md`; the measuring rig is `research/measure-centre.html`
(mounts the real component over http, no Electron — its header documents two traps that
make it lie if ignored).

Two plan premises were wrong and are corrected in `validation.md`: the `MpiButton.css`
`.is-active` trap does not exist (an icon+label button still carries `mpi-ibtn`, so that
edit was written, measured redundant and reverted), and the real gap was the LABEL at
(0,3,0), fixed in the component. The toolbar `max-width` was a genuine regression —
`7.25rem` overlapped the centre group by 30.2px with three buttons; it is now `9.75rem`.

The decisions are recorded, the panel is drawn, `PRODUCT.md` has been updated to allow the
crew, and MPI-777's open decision 4 is answered. The card was `blocked` on MPI-774 Phase 3c;
that landed in `4ee23d00` on 2026-09-17, so the blocker is stale and this plan clears it.

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

- [x] `MpiProjectName.js` - a third `_mountButton`, icon `chat` (already in `icons.js`),
      label `Agent`, `size:'sm'`, `variant:'ghost'`, emitting `agent`. It goes **first** in
      `centreGroup`, so the row reads Agent - Flows - Record.
- [x] `MpiProjectName.css` - `.mpi-project-name__centre` becomes a `1fr auto 1fr` grid so
      **Flows sits dead centre** whatever its neighbours measure. Measured 0px off centre in
      the mockup. This also pays back the half-button drift MPI-678 accepted.
- [x] **Re-measure `.mpi-project-name__toolbar`'s `max-width`.** The current `7.25rem` is
      documented at `MpiProjectName.css:162-165` as "half the Flows + Record group (~96px)";
      a third button invalidates that number, and the toolbar sliders slide under the group
      when it is wrong.
- [x] `navigation.js` (beside the `flows`/`record` handlers at :82 and :88) - `agent` flips
      `state.agentMode`. `agentPanel.js:64` already binds the `A` hotkey to exactly that, so
      the button is its visible twin and the panel needs no change.
- [x] The toggled look: icon and label take `--accent-heat`, **no fill** (Fabio, round 2).
      **Trap:** `MpiButton.css:318` only defines `.is-active` for ICON ghosts
      (`.mpi-btn.mpi-ibtn.mpi-btn--ghost`); a labelled ghost has no active rule, so this
      needs one adding rather than a class reused. On this bar heat is cream at L 0.78,
      slightly dimmer than the resting `--ink-2` at L 0.85 - accepted, because the open
      420px panel is the loud signal.
- **Verify:** the button opens and closes the panel, `A` still does, both agree; Flows is
  centred on the bar with the panel open and shut; the gallery toolbar's sliders do not
  slide under the group at a narrow window.

### Phase 2: the panel gets its own input row

- [x] `MpiAgentChat.js` template - drop the `props.standalone ?` gate on the input row
      (lines 76-83) so panel mode renders `__input-row` too.
- [x] `MpiAgentChat.js` setup - the standalone-only block (545-632: `MpiInput`, send button,
      Enter/Shift+Enter, `_doSend`, `_addImageFile`, `_renderAttachments`, the drop
      handlers) stops being standalone-only. It is already written; it only needs its `if`
      widening. Fabio's item (1) is satisfied by its placeholder.
- [x] **Decide `agent:send`'s fate, do not leave it half-wired.** Its only producer is
      `MpiPromptBox.js:2516`, which Phase 3 deletes; its only consumer is
      `MpiAgentChat.js:539`, and `tests/desktop/agent-chat.spec.js:1242` emits it to prove
      the panel listens. Either keep the event as the panel's own send path (documented at
      `events.js:142` - update that line, it names MpiPromptBox as the producer) or delete
      the pair and call `_sendMessage` directly, and delete the spec's emit with it.
- [x] Item (3): attachments are numbered 1, 2, 3 - never "start frame" or "picture 1".
      `_renderAttachments` (606) draws thumbs with no number today; add the index.
- [x] The light terminal register from the drawing: a `>` glyph and a block caret on the
      input only, transcript stays prose. `caret-shape: block` with the native bar as
      fallback; the mockup's drawn caret is a mockup device, not a thing to port.
- **Verify:** type in the panel and send with no prompt box on screen (the History
  workspace has none); drop an image on the panel and see it numbered; the landing
  standalone chat is unchanged.

### Phase 3: agent mode leaves MpiPromptBox

The removal is ~10 sites across a 2766-line file. Grep `_agentMode` first - 34 hits.

- [x] Delete: `mode-toggle-slot` (template, :110), `_setAgentMode` (2485), `_sendAgentTurn`
      (2493), `_applyAgentView` (2446), the agent branches in `_readMode`/`_writeMode`
      (172-175), `AGENT_MAX_IMAGES` (83), `COG_INFO_AGENT` (89), the Enter branch (1491-1498,
      2556), the chip/badge branches (337, 421, 937, 958, 1470), `_fitMediaToOperation`'s
      agent caller, and `.mpi-prompt-box--agent-mode` / `__popup--agent` in the CSS.
- [x] **`state.agentSettingsPinned` goes dead and it is NOT only cosmetic.** It is written
      only inside MpiPromptBox (1669, 1675, 2454, 2760) but READ by `agentService.js:81` and
      `agentDispatch.js:212`, where it decides whether the agent inherits the user's pinned
      model and settings. Remove the writers and that branch is permanently false - dead
      code in the dispatch path, not a leftover flag. **Fabio already ruled the behaviour
      does not work today** (MPI-843 validation), so nothing observable breaks; decide
      deliberately between deleting the read side too and re-homing the trigger, and say
      which in `validation.md`. The open product question - should an agent generation
      inherit the prompt box's model and settings? - stays with the agent track.
- [x] **Test debt, and it is real.** `tests/agent-ui-surfaces.test.cjs` is a source-contract
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

## Plan Drift

- **2026-09-21, Phase 3.** The plan asked for a deliberate choice between deleting
  `state.agentSettingsPinned`'s read side and re-homing its trigger. Re-homed. Deleting it
  would have reached `agentDispatch.js`, `agentService.js`, `services/agentLoop.mjs` and a
  123-line 8-test suite — a whole-stack feature — and would have answered by force the
  product question MPI-843 parked. Re-homing is three lines and loses nothing.
- **2026-09-21, Phase 3.** The plan's delete list did not mention
  `.mpi-prompt-box__popup--agent`, `.mpi-prompt-box__col--mode`, `__stop-host` or
  `docs/agent-chat.md`. All four are consequences of the same removal and went with it;
  the reasoning is in `validation.md`.
- **2026-09-21, Phase 3.** The plan did not anticipate that deleting `_sendAgentTurn`
  removes MPI-817's video-by-reference path, shipped the day before. It is a real
  regression, recorded rather than papered over, and it is the one thing that might stop
  this card closing.
