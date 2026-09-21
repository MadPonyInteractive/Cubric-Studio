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

## Phase 3 — agent mode leaves MpiPromptBox (2026-09-21)

Built. **Verify mode is `user-ux`, so this is NOT closed** — Fabio's eyes in the real app
are the evidence. Everything below ran here first.

### What ran

- `npm test` — **1668 pass, 0 fail**, 1 skipped (the baseline one) and 1 todo (added
  deliberately below). 1670 total.
- `tests/desktop/agent-chat.spec.js` — **31/31**. It was 33: two tests drove the deleted
  toggle and their subject no longer exists, and a third merged into the inverse test.
- `eslint` clean on every changed file.
- No EOL churn: `git diff --numstat` is identical with and without `--ignore-cr-at-eol`.

### The decision the plan left open: `state.agentSettingsPinned`

The brief offered "delete the read side too" and the plan offered "or re-home the trigger".
**Re-homed**, and the brief's own recommendation was withdrawn on reading the code, because
it was wrong about the size of the thing.

It is not a "read side". The pinned panel is a feature spanning the whole stack:
`resolveSettingsOwner` in `agentDispatch.js` with its two refusal codes (`NO_PINNED_MODEL`,
`MODEL_PINNED`), `_pinnedForTurn` in `agentService.js`, `_pinnedSettingsLine` in
`services/agentLoop.mjs` (the sentence the LLM is actually told), and
`tests/agent-pinned-settings.test.cjs` — 123 lines, 8 tests. Deleting it on a card about a
UI toggle would have been scope this card has no business taking, would have bulldozed a
file MPI-817 had claimed, and would have ANSWERED the open product question Fabio parked
("should an agent generation inherit the prompt box's model and settings?" — MPI-843
validation, "worth a card either way") by force.

The trigger was `_agentMode`, which was only ever a mirror of `state.agentMode`. That flag
survives Phase 3 — Phase 1 moved its setter to the top bar's Agent button. So the rule now
reads `state.agentMode === true` at each of the three live sites, and its meaning is
unchanged: **agent panel open + cog open = the user owns the model and the settings.**

The one line that needed re-homing rather than re-pointing: `_applyAgentView` used to
re-sync the flag when the mode changed, and it is deleted. Replaced by an
`Events.onState('agentMode', ...)` that does the same two things (the flag, and the cog's
`[data-info]` copy), plus a once-at-mount branch for a box mounted while the panel is open.

### What went, and the one principle that decided it

Everything that made the prompt box LESS OF A PROMPT BOX while agent mode was on is gone,
because the box is now always a prompt box. Everything about settings OWNERSHIP stayed.

| Went | Why |
|---|---|
| `mode-toggle-slot`, `_setAgentMode`, `_applyAgentView`, `_sendAgentTurn`, `_agentMode` (28 hits) | the agent face |
| `AGENT_MAX_IMAGES` / `AGENT_MAX_VIDEOS`, the chip/badge branches, `_fitMediaToOperation` | chips are op slots again, with their frame pills |
| `.mpi-prompt-box--agent-mode` (grid + hide list + run column) | the box is never stripped |
| `.mpi-prompt-box__popup--agent` | it hid the op strip INSIDE the parameters popup. That rested on the box being the agent's face; the user drives this box themselves now, so hiding their own op selector was wrong. The op was never part of the handover — the table in `docs/agent-chat.md` has always given it to the agent either way |
| `.mpi-prompt-box__col--mode` (MPI-736's cream rebind) | the toggle's head is gone; the box is the selected model's colour |
| `__stop-host` class | its ONE consumer was the deleted agent-mode rule |
| `agent:send` — emit, listener, `events.js:142`, the spec's emit | settled in Phase 2, executed here as a set |

| Stayed | |
|---|---|
| `state.agentSettingsPinned` and all four writers | re-homed onto `state.agentMode` |
| the PINNED popup (no outside-click, no Escape) | **unchanged on purpose — needs Fabio's eye.** The rule still reads true, but it now holds in a situation that could not exist before: the panel open for a long stretch while he uses the prompt box normally. Fabio has rejected a prompt-rule answer to this twice, so it was not quietly changed |
| `COG_INFO_AGENT` | the copy is still accurate |

### A REGRESSION this phase causes, not yet fixed — MPI-817's video attachments

**`_sendAgentTurn` was the only UI path for handing the agent a video.** It pushed
`{ url, name, mediaType: 'video', itemId }` — by reference, never bytes — and the drop
guard that accepted a clip was the `AGENT_MAX_VIDEOS` branch. Both died with the toggle.

The SERVER half is untouched and still correct (`routes/agent.js`, `ownedMedia`,
`reference: true`, the loop registering the clip under its basename). It simply has no UI
that can reach it. The panel's own composer guards on `image/` and silently ignores a
dropped clip, so **there is no way to hand the agent a video today.**

Not fixed here, deliberately: MpiPromptBox staged its clip with its own private
`_importMediaFile`, there is no shared import service, and MpiAgentChat has no
project-media machinery at all. That is a surface of its own, not a line of Phase 3.

`tests/agent-video-attachment.test.cjs` was split rather than trimmed: the route gate still
asserts as it did, and the UI gate is a `todo` naming the gap, so it stays on the board on
every run instead of vanishing. Messaged to the live MPI-817 session (4ea0febf) because it
lands in the middle of its close-out. **Fabio's call whether Phase 3 ships with it.**

### The test debt the plan flagged, paid on the new surface

`tests/agent-ui-surfaces.test.cjs` pinned the deleted lines by regex at 73, 82, 86, 88, 89
and 99. Every assertion moved to the surface that replaced it rather than being deleted:
rule 1 ("Stop stays reachable in agent mode") became "the box is never stripped down", the
pinned-panel tests now assert the `state.agentMode` trigger, and a new guard asserts
`agent:send` is gone from all three sides at once so neither half can be left dangling.

**Each proven RED on pre-fix code, one back-out at a time** (a suite covering N changes
proves ONE otherwise):

| Backed out to HEAD | Guards that went red |
|---|---|
| `MpiPromptBox.js` | no agent face; run cluster; pinned panel armed by state; cog copy; agent:send gone |
| `MpiPromptBox.css` | nothing hides the run column; Studio cream; no agent face; run cluster |
| `MpiAgentChat.js` | agent:send gone |
| `js/events.js` | agent:send gone |

Restored byte-identical after each (sha checked), and the suite is clean again at the end.

### Found while verifying: MPI-863 red 16 of 31 desktop specs — FIXED HERE

Not this card's, met here, and fixed because it blocked this card's verification.

`e2bc81f5` (MPI-863, pushed, card `validating`) seeds auto-start ComfyUI at boot from
`/engine/version-check`. A spec profile is always fresh, so `hasAutoStartComfy()` is always
false and the seed always runs — and **on a box that HAS an engine** it answers installed,
turns auto-start ON, boot tries to start ComfyUI inside the E2E harness, and it fails there.
The "ComfyUI failed to start" modal then puts an `.mpi-modal-backdrop` over the window that
swallows every click for the rest of the run.

Proven not-mine before touching it: the same failure reproduces with **all eight of this
session's files swapped to their HEAD blobs** (~40s, restored sha-checked).

It is machine-dependent, which is the worst shape for a suite — a runner with no engine
reads `needsInstall: true` and never seeds, so CI may well be green on it. Fixed with one
clause on the seed, `&& !_isE2E()`, using the guard `shell.js:255` already defines for
exactly this (MPI-446: an E2E profile is engine-blind by design). Shipped behaviour is
untouched. MPI-863's own contract test pinned the gate verbatim, so it gained the third
clause. Messaged to MPI-863 (5e03b0f1) — Fabio named that session as still running, and it
held no claim on either file when this session checked.

Desktop specs went 15 passed / 16 failed → **31/31**.

## CLOSED - Fabio, 2026-09-21

All three phases verified in his own app: Phase 1 on 2026-09-20, Phases 2 and 3 together on
2026-09-21 ("it looks good, mate"). Shipped as 47fcdc2a / fcefd4ff / ad155a98 / 9a71f2ce
(Phase 1), e4dd9143 (Phase 2) and 45f5f403 (Phase 3).

**The video regression does NOT close with this card - it is MPI-867**, split out on Fabio's
call rather than folded in, because restoring it is a new surface and not a line of Phase 3.
The `todo` in `tests/agent-video-attachment.test.cjs` names MPI-867, and making it pass is
that card's definition of done.

Two things recorded here that outlive this card:

- **The pinned popup was deliberately left alone**, and Fabio signed it off. It now holds in a
  situation that could not exist before - the agent panel open while he uses the prompt box
  normally. He has rejected a prompt-rule answer to this twice; do not "fix" it without him.
- **The open product question stays open**, and it belongs to the agent track: should an agent
  generation inherit the prompt box's current model and settings, or stay deliberately
  independent? MPI-843 parked it. Re-homing `agentSettingsPinned` rather than deleting it is
  what kept it answerable - the machinery that would implement either answer is still there.

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
