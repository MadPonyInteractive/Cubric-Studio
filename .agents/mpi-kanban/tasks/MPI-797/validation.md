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

## Still to do on this card

Phases 2 and 3, strictly in order — phase 3 removes the only existing way into agent
mode, so it must not land before phase 1 is accepted. Their files are deliberately NOT
claimed yet.
