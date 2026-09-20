# MPI-797 Validation

## Phase 1 — the Agent button joins the top bar (2026-09-20)

Built on MPI-843's approved drawing. **Verify mode is `user-ux`, so this phase is NOT
closed** — Fabio's eyes in the real app are the evidence. Everything below is what ran
here first.

### What ran

- `npm test` — **1599 pass, 0 fail, 1 skipped** (1600 tests, 15 suites). Twice: once
  before the `MpiButton.css` revert below, once after.
- `eslint` clean on `MpiProjectName.js` and `navigation.js`.
- **Live measurement of the real component in real Chromium**, not the app:
  `research/measure-centre.html` mounts `MpiProjectName` against the real stylesheets
  over http and measures it. Its header documents how to re-run it.

### Measured, not assumed

| | Result |
|---|---|
| `.mpi-project-name__centre` | `display: grid`, columns `97.2px / 90px / 97.2px` |
| **Flows off bar centre** | **0.00px**, with Agent and Record either side |
| Flows off centre, Record `display:none` | **0.00px** — columns `90/90/90`, the empty third column still holds its 1fr |
| Agent active, button colour | `oklch(0.78 0.028 80)` — equals `--accent-heat` |
| Agent active, label colour | `oklch(0.78 0.028 80)` — matches the button (after the fix below) |
| Agent active, background | `rgba(0, 0, 0, 0)` — no fill, as Fabio asked in round 2 |

### Two things the plan got wrong, found by measuring

**1. The plan's `MpiButton.css` trap does not exist, and the edit was reverted.**
The plan said a labelled ghost has no `.is-active` rule. It does: an icon+label button
still carries `mpi-ibtn` (real classes: `mpi-btn mpi-btn--ghost mpi-btn--sm mpi-ibtn
mpi-ibtn--label-right`), so `.mpi-btn.mpi-ibtn.mpi-btn--ghost.is-active` already matched
and already gave it heat with no fill. A widened selector was written, measured to be
redundant, and backed out — `MpiButton.css` is byte-identical to HEAD.

**2. The real gap was the LABEL, one level down.**
`.mpi-ibtn.is-active .mpi-ibtn__label` pins `--ink-1` at (0,3,0), so an active Agent
button rendered a heat glyph with near-white text — heat `0.78` against label `0.98`.
Fixed in `MpiProjectName.css` at (0,4,0), matching the weight lesson the Record rules
below it already record. The primitive is untouched: a labelled icon button going
`--ink-1` when toggled is correct everywhere else.

### The toolbar number was a real regression, proven both ways

`max-width: calc(50% - 7.25rem)` was sized for a two-button group (~96px half). Three
buttons make the group 292.41px, so half is 146.2px. With an overflowing toolbar, at
1400px:

- `7.25rem` → **-30.2px: the toolbar overlaps the centre group.**
- `9.75rem` → **+9.8px clear, no overlap.**

Sized against the three-button case on purpose: Record is gallery-only and the gallery
is the only page that mounts a toolbar in that slot.

### Two harness traps worth keeping

Both produce numbers that read as layout bugs rather than measurement bugs:

- `ComponentFactory` injects component CSS by **relative** path, so a page outside the
  repo root 404s every component stylesheet and mounts the component completely
  unstyled. `<base href="/">` fixes it. First run reported `display: block`,
  `flowsOffCentre: -634` — all of it a lie.
- These buttons carry `transition: color`, so reading `getComputedStyle` straight after
  toggling `.is-active` returns an interpolated `oklab()` mid-transition. The toggled
  look read as broken until the read waited the transition out.

## Phase 1 ACCEPTED — Fabio, 2026-09-20

Checked in his own app. The row order, the centring, the toggled cream with no fill and
the toolbar at a narrow window all passed on sight. One change asked for and made, plus
one thing accepted as-is:

- **The status bar names the hotkey.** Hovering Agent now reads
  `(A) Talk to the agent about this project`. `statusBar.js` prints `data-info` verbatim
  and does no hotkey lookup, so the key has to be written into the string; `A` is
  `agentMode.toggle` (`hotkeyRegistry.js:93`).
  **The LEADING paren is deliberate and is Fabio's call** — every other hotkey string in
  the app trails (`'Loop (L)'`, `'Send (Enter)'`, 18 of them, none leading). He asked for
  the key in front of the existing text. Do not "correct" it to the trailing form.
  (An earlier commit briefly read `(A) Communicate`; that word was speech-to-text noise,
  not a label, and is gone.)
- **The icon stays `chat`.** Fabio asked for an agent icon rather than a speech bubble and
  then accepted the bubble — "a speech bubble works". So this is a known, accepted
  substitute, not an oversight: if a proper agent glyph is ever added to `icons.js`, this
  button is the place it belongs.

Noticed and NOT changed: Flows and Record name no hotkey in their own status text. Out of
scope for this card.

## Found while measuring, NOT fixed here — Record's hide is broken

`setRecordVisible(false)` adds `.mpi-project-name--hidden { display: none }` at (0,1,0),
which ties with MpiButton's own `display` at (0,1,0) — and `MpiButton.css` is injected
**after** `MpiProjectName.css`, so the later rule wins and Record stays visible. Measured:
with the hidden class applied, `getComputedStyle(record).display` is still `flex`, and the
only two matching rules are `.mpi-project-name--hidden -> none` and `.mpi-btn ->
inline-flex`.

This is **pre-existing and not MPI-797's** — Agent is never hidden, and nothing in this
phase changes it. It means Record is probably visible on group-history, where MPI-678
intended it gated. Reported to Fabio, not actioned, and no card created.

## Phase 2 — the panel gets its own input row (2026-09-20)

Built, then driven by Fabio in his own app over three rounds. **No final "verified" —
the card stays in `doing`.** Everything below was measured, not assumed.

### What ran

- `npm test` — **1619 pass, 0 fail, 1 skipped** (1620; the count moved from 1600 to 1620
  during the session as peers landed `deepinfra-pricing` and others — not this card).
- `tests/desktop/agent-chat.spec.js` — **33/33**, up from 29. Four new tests.
- `eslint` clean on both component files and the spec.

### The decision this phase owed: `agent:send`

**Delete the pair — in Phase 3, not here.** The only producer is `MpiPromptBox.js:2537`,
which Phase 3 deletes; the only consumer is this component's listener. Removing the
listener in Phase 2 would silently break sending from the prompt box's toggle in the
window between the two phases. So Phase 2 keeps it, the panel's own composer calls
`_sendMessage()` directly (two producers, one target, no double send), and Phase 3
removes emit + listener + the `events.js:142` entry + the spec's emit at once.
`events.js:142` is untouched and still accurate today.

### Four faults Fabio found by eye, and what they actually were

None was in the plan. Each was measured before it was fixed.

**1. The composer never collapsed after a send.** `_doSend` cleared the field with
`textareaEl.value = ''`, which fires no `input` event — and `input` is the ONLY thing
MpiInput's auto-height listens to. A field grown to four lines stayed four lines tall and
empty. Fixed by calling the Primitive's own `mainInput.el.setValue('')`, which re-measures;
that setter exists precisely for this and `MpiInput.js:107` documents reaching past it for
`.value` as the mistake (seven modules, eleven sites). Measured **187px → 42px**.

**2. The hint stranded above the `>`, which read as a broken row.** NOT the send button.
`MpiInput.css:109` floors an auto-height textarea at `min-height: 2.6rem` — it is sized for
a paragraph. Stripping the field's padding for the terminal look while leaving that floor
put the text at the TOP of a 42px box while the `::before` glyph centred in it: **21px
apart**. `min-height: 0` in panel mode. Measured field **42px → 17px**, and `wrapH ===
fieldH`, which is what puts them on one baseline.

**3. The send button was oversized — downstream of (2).**
`--agent-composer-h` matched the button to the PADDED field so the pair read as one
control. Against a dissolved one-line field a 39px button was the tallest thing in the bar
and dragged the row up around it. Natural size in panel mode: **39px → 34px**, row 51px.

**4. Latent, found while measuring (2): the textarea carried an inline `height: 0px`.**
The panel is **closed at boot** — zero width, no layout — so MpiInput's own mount-time
`resize()` read `scrollHeight: 0` and wrote it. Only the 2.6rem floor was hiding it, so
removing the floor would have collapsed the field to nothing. A re-measure at mount would
just write `0px` again. Fixed by CLEARING the inline height and letting `rows="1"` size the
field intrinsically — needs no layout, right in both modes; auto-height takes over on the
first real keystroke, when the panel is open.

### Thirteen attachments — Fabio's "what if a model takes 9 images, 2 videos and 2 audios"

Chips stay to the LEFT of the `>` — **his call, he likes it**. Safe because the **field wins
the row**: a `min-width: 9rem` floor on the input wrap, and the strip is what gives way —
`flex: 0 1 auto`, `nowrap`, `overflow-x: auto`. Measured with 13 chips:

| | 420px panel | 280px (narrowest) |
|---|---|---|
| strip width / scroll width | 185px / 568px, scrolls | 45px / 568px, scrolls |
| **field width** | **144px** | **144px** |
| row overflow-x | 0 | 0 |

### Numbering

One `_attachmentChip()` helper draws the composer chip and the sent-bubble chip, so they
cannot drift. The bubble numbering is Fabio's explicit ask (2026-09-20). Counted on what is
**DRAWN**, not the array index — a history entry with no `dataUrl` is skipped and a gap
would number a picture nobody can see. Bubble chips are not clickable; a sent chip is a
record.

### Scope taken, and the one thing deliberately left

The composer bar (its own `--surface-2` surface, the field dissolved into it) is scoped to
`#agent-panel-mount`. **The landing standalone chat keeps its bordered field** — the MPI-843
drawing is of the panel, and Fabio signed the landing composer off in round 2. The fixes
that are bugs rather than looks (collapse, placeholder-on-focus, numbering, the field floor)
apply to both. One word from him moves the bar to the landing chat too.

### A coverage gap worth knowing about

Every pre-existing test in `agent-chat.spec.js` mounts into a plain host div, which cannot
see a single line of the panel's CSS — **all of it is `#agent-panel-mount`-scoped, and both
faults Fabio caught by eye lived exactly there.** There is now a test that drives the REAL
panel mount and pins: no inline height, `min-height: 0`, field under 25px, `wrapH ===
fieldH`, glyph present.

### Each guard proven RED on pre-fix code, one back-out at a time

A spec covering N fixes proves ONE unless they are backed out separately.

| Guard | Backed out | Result |
|---|---|---|
| panel composer exists | both files to HEAD | fails at `expect(field).toBeVisible()` |
| numbering | `_renderAttachments` only | send still passes, `toHaveCount(2)` gets **0** |
| collapse after send | the `setValue('')` line only | expected **41.59px**, got **53px** |

Files restored byte-identical after each (sha checked). The diff carries no EOL churn —
`git diff --numstat` is identical with and without `--ignore-cr-at-eol`.

## Still to do on this card

Phase 3 only — agent mode leaves MpiPromptBox. It removes the last way into agent mode
from the prompt box, which is now safe because Phase 1 (the Agent button) and Phase 2 (the
panel's own composer) both ship.

## Pre-existing, found while working here, NOT fixed and NOT carded

- **`--r-sm` and `--r-md` are not defined anywhere.** The radii are `--r-1/2/3/pill`
  (`styles/01_base.css:186-190`). `MpiAgentChat.css` is the ONLY file in the repo that uses
  those two names — 6 declarations (mascot, bubble, confirm card, compacting notice, result
  card, attachment thumb). All invalid, so all render square. Contained to one file and
  mechanical once the values are picked.
- `npm test` failed twice in seven runs on 2026-09-20, clean on every re-run:
  `ENOENT mkdtemp` under `%TEMP%/cubric-tests/<pid>` (`tests/helpers/scratch.cjs:26`).
  Nothing in the repo sweeps that shared parent, so something outside it does. Un-owned,
  and it runs in CI. Same pile as the `gif-workspace.spec.js` flake.
