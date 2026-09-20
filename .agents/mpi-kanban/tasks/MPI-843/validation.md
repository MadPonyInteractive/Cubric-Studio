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

**MUST VERIFY, not yet answered:** Fabio's note that opening the prompt box settings and
leaving them open chooses the model and settings the agent generates with. If that behaviour
is gated on the prompt box being in agent mode, dropping agent mode breaks it. If it simply
reads the box's current settings, it survives and gets better — the box can show real
settings while the agent uses them. Check before implementing.

## Still open

- MPI-777 open decision #4 (ledge vs the 48px Studio in `MpiAgentChat.js` ~44-94) is
  answered in spirit by The Ledge, but the merged panel has not been drawn yet.
- **PRODUCT.md contradicts the crew presence.** Under "Mascots & logo": *"Away from the
  landing it is always Studio: a workspace does not swap in its own character, because the
  accent already states the subject."* The accent half of the design matches principle 4
  exactly; the mascot half reverses this line. Needs Fabio's sign-off and a PRODUCT.md edit,
  and `PRODUCT.md` was claimed and heartbeating on 2026-09-20 at 09:55Z.
- MPI-797 carries items these decisions rewrite. It is on the agent track — its owner
  updates it, not this card. An open message to MPI-817 already exists
  (`state/messages/be606244-ec07-4eb1-ab57-382af74723da.json`).

## Card state

The study delivered and Fabio chose. The merged panel drawing is the remaining work before
this card closes.
