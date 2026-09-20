# MPI-843 Validation

## Decisions — Fabio, 2026-09-20, from `research/chat-mockups.html`

### The panel

**Header from The Stage, everything else from The Ledge.**

- Header: Cosmo as a persistent 20px identity beside the label. Never moves, never competes.
- Body: prose transcript, not a command log.
- Cosmo sits on a bottom ledge docked above the input; the working mascot slides in beside
  him on the same ledge, so there is one place the eye checks for "who is working".
- Terminal register: **light**. A `>` prompt glyph and a blinking caret on the input only.
  The transcript stays prose.
- Rejected: The Log (full terminal, mascots reduced to colour-plus-name — costs the
  emotional payoff the work exists for) and The Stage's collapsing working strip (the only
  option whose layout moves).

### The agent input — Option 1

**The agent chat panel gets its own input. The prompt box is left alone.**

Why it was needed: `#agent-panel-mount` (`index.html:146`) is shell-level, app-lifetime,
never destroyed — the panel is already global and is present in the History workspace. But
`MpiAgentChat`'s template renders `__input-row` **only when `standalone` is true**, so panel
mode has no input; text arrives as `agent:send { text, attachments }` emitted by
`MpiPromptBox` in agent mode (`js/events.js:143`). A global panel with a non-global input.

Both halves already exist. The standalone branch already builds the row with `ac-input-slot`
and `ac-send-slot`. Rendering it in panel mode and emitting the same `agent:send` adds one
producer to an event that already has exactly one consumer. Nothing downstream changes.

**This deletes MPI-797 item (2)** ("consider swapping the whole prompt box for an agent box
that holds only the text input and the Agent|Prompt toggle"). Nothing is swapped: the prompt
box stays a prompt box and the agent gets its own box.

**MPI-797 item (3) moves with it** — drag-an-image-to-attach now targets the panel input.

### The Agent toggle leaves the prompt box

**Dropped from `MpiPromptBox` entirely. It becomes a third button in the gallery top bar,
beside Flows and Record** — `js/components/Compounds/MpiProjectName/MpiProjectName.js:130`
(Flows, icon `layers`) and `:141` (Record, icon `mic`), both `size:'sm'`, `variant:'ghost'`.

The win: the prompt box goes back to being purely a generation surface, so the user can
**generate and talk to Cosmo at the same time**.

**No new SVG is needed.** `chat` already exists in `js/utils/icons.js` and matches the row's
icon vocabulary. Cosmo's head also already ships (`assets/mascot/studio/logo.webp`, plus
`idle` / `greet` / `happy` poses), but it belongs in the panel header where identity is the
job, not in a monochrome ghost-button row — product register wants one icon style per row.

Knock-ons for whoever implements:

- `state.agentMode` is set by the prompt-box toggle today (`js/shell/agentPanel.js:58`).
  The setter moves to the new button. `agentPanel.js` reacts to state and does not care who
  sets it, so it needs no change.
- The `A` hotkey already toggles the panel from the shell, not from the prompt box
  (`js/shell/agentPanel.js:64`). Unchanged — the new button is its visible twin.
- There are three Flows entry points today (`MpiProjectName.js:130`, `projectUI.js:84`,
  and the radial menu at `navigation.js:112`). Decide whether Agent joins the radial menu
  too, or only the top bar.

**ANSWERED by Fabio, 2026-09-20 — the concern is void.** The behaviour does not work today:
in agent mode with the settings open, an agent generation does **not** pick up the currently
selected model and settings. So dropping agent mode from the prompt box breaks nothing,
because there is nothing working to break. Implement the toggle move without waiting on this.

It does leave a separate, pre-existing gap, on the agent track and not in this card's scope:
the agent has had a named-parameter layer on `generation.submit` since MPI-547, so it *can*
take a model and settings — it simply does not read the prompt box's selection. Open product
question for whoever owns that track: **should an agent generation inherit the prompt box's
current model and settings, or stay deliberately independent of them?** Worth a card either
way, since the current state is neither documented nor obviously intended.

## The merged panel — drawn 2026-09-20, `research/chat-merged.html`

Drawn in place rather than floating: the panel docks left at its real 420px
(`styles/shell/workspace.css:67`), under the top bar, prompt box starting to its right. Shows
the third top-bar button (real `chat` icon path), the prompt box with the toggle slot struck
out, the panel's own live input (`>` glyph, block caret, numbered attachment chip), and four
ledge states (idle, Prism, Vinyl, Lingo) below the frame. An "op running" checkbox flips
working/idle.

Checked in the Browser pane at 1400x1000: panel 420px, ledge 52px, JetBrains Mono loaded, no
transcript overflow. Toggling working -> idle: ledge height 52 -> 52, input-row top 813 -> 813,
transcript 502 -> 502, guest settles at opacity 0 / translateX(16px). **The layout does not
move**, which was the reason The Stage's strip was rejected.

One thing the drawing had to pick, not previously decided: the block caret. `caret-shape:block`
on the real input, native bar as the fallback; the drawn block shows only while the field is
empty and unfocused. Implementer may skip the fake.

### Round 2 — Fabio on the drawing, 2026-09-20

- **Agent goes LEFT of Flows**, so the row reads Agent · Flows · Record and Flows lands in the
  centre. Drawn as a `1fr auto 1fr` grid on `.mpi-project-name__centre`: Flows measured 0px
  off the bar's centre, whatever its neighbours measure. This also pays back the half-button
  drift MPI-678 accepted when Record joined.
- **No background on the Agent button — the others have none.** Panel open = icon and label
  take `--accent-heat`, the app's existing toggled-ghost rule (`MpiButton.css:318`), no fill,
  no border. Implementer's note: that rule exists only for ICON ghosts today; the labelled
  `.mpi-btn--ghost` has no `.is-active`. And on this bar heat is cream (L 0.78), slightly
  DIMMER than the resting `--ink-2` (L 0.85) beside it — acceptable because the open panel
  is the loud signal, but it is a real measurement, not a guess.
- **The status bar is not the agent's.** The footer in the drawing IS the status bar; the
  first pass wrote agent text into it. Redrawn as it is today (idle/remote scope, or the
  running job). It already owns idle and remote information — the agent adds nothing to it.
- **PRODUCT.md updated, with Fabio's sign-off** ("more truthful"): the agent chat joins the
  list of mascot placements, and "always Studio" now reads "away from the landing and the
  agent chat".

**Awaiting Fabio's eyes on the redrawn panel** — that is the last gate on this card.

## Still open

- ~~MPI-777 open decision #4~~ — carried into `tasks/MPI-777/plan.md` 2026-09-20: answered
  "neither", the panel gets its own ledge. **Knock-on found while carrying it:** MPI-777
  Phase 4 had "Agent mode: Studio on the ledge" of the PROMPT BOX. Agent mode no longer
  exists there, so that bullet is annotated as moved to the panel ledge.
- ~~PRODUCT.md contradicts the crew presence~~ — RESOLVED 2026-09-20, see Round 2. No live
  claim held the file when it was edited. One line left alone on purpose: *"Never animated
  more than gentle 4s float"* is still true of what ships (`heroCrew.js` swaps stills), and
  becomes false when MPI-777 lands clips — that edit belongs to MPI-777.
- MPI-797 carries items these decisions rewrite. It is on the agent track — its owner
  updates it, not this card. An open message to MPI-817 already exists
  (`state/messages/be606244-ec07-4eb1-ab57-382af74723da.json`).

## Card state

The study delivered and Fabio chose. The merged panel drawing is the remaining work before
this card closes.
