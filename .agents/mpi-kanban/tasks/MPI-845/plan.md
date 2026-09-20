# MPI-845 — Titlebar mark sits small and off-centre; the back chip fills on hover

Two chrome defects Fabio reported together on 2026-09-20. Both are one-file CSS fixes with a
measured cause. Neither is a new feature; do not grow this card into a chrome redesign.

## Current State

**All THREE defects built, awaiting only Fabio's eye.** The card grew a third on
2026-09-20 when he spotted the chip remove X rendering as a tall rectangle — MPI-822's
`min-height` size floor clamping a 16px button to 34px. That one was NOT one call site:
five rules across four files shrink a button below its size token, and all five had been
silently taller since `ddd813da`. Fixed in one pass, guarded by
`tests/button-size-floor.test.cjs`.

`npm test` 1549 tests, 1548 pass / 1 skipped / 0 fail. Both new tests were proven RED
against the pre-fix code and every touched file restored byte-identical.

## 1. The titlebar mark

`index.html:19` renders `assets/mascot/studio/logo.png` through
`.titlebar-logo-img { width: 16px; height: 16px }` (`styles/shell/titlebar.css:40`).

That PNG is a **256×256 canvas holding 254×174 of artwork** — 44px of transparent padding on
top, 38px on the bottom. Forced into a 16px box the robot renders **15.88 × 10.88 px**, so the
box is 32% empty vertically and the visible mark is 10.9px tall against 8.40px text caps
(Russo One at 12px, `capHeight` 700/1000). That is the whole of "it seems a bit small".

The same padding puts the art's own centre 3px low on a 256 canvas (+0.19px once scaled), and
Russo One's caps sit 0.32px **above** the centre of their own 12px line box. The two disagree
by roughly half a pixel — below notice on its own, but any non-integer `devicePixelRatio`
rounds the 16px image box and the 12px text box independently, which is the "in most
resolutions" part of the report.

**`assets/mascot/studio/logo.webp` is the same artwork already cropped to zero padding**
(128×86, confirmed by overlaying it on the PNG's alpha bbox). It already ships and
`MpiPromptBox.js:2526` already uses it. Point the titlebar at it and size by height with
`width: auto`; no new asset, no magic number tied to the PNG's padding.

**Verify:** `height` × the webp's 128/86 aspect is what renders; the art height is now the
number in the CSS rather than 68% of it.

## 2. The back chip's hover fill

`.mpi-project-name__back` is an `MpiButton` with `variant: 'ghost'`
(`MpiProjectName.js:63`). It declares `background: none` at specificity **(0,1,0)**, and
`MpiButton.css:119` sets `.mpi-btn--ghost:hover:not(:disabled) { background: var(--surface-2) }`
at **(0,3,0)**. The component's own `:hover` rule only restates `color`, so nothing ever
outranks the fill.

Why Flows and Record next to it are clean: they are **icon** buttons, so they match
`.mpi-btn.mpi-ibtn.mpi-btn--ghost:hover` (`MpiButton.css:307`), which pins
`background: transparent` on purpose — *"Ghost icon button — never fills background."* The
back chip is a text-only ghost and there is no such rule for it.

`.mpi-project-name__segment--link` has the **identical** defect (same `background: none` at
(0,1,0)) and is only invisible because the breadcrumb is rarely hovered. Fix both in one pass.

**Do NOT change `MpiButton`'s ghost variant.** A text ghost filling on hover is correct
everywhere else in the app; these two chips are opting out, so the override is local. Match
the primitive's selector shape, which is the house style `MpiProjectName.css` already set in
its MPI-736 Record comment 20 lines below.

**Verify:** a test that asserts the winning `background` for the back chip and the link
segment in `:hover` is not `--surface-2`, and that the Record/Flows icon buttons are untouched.

## Verification

**Verify mode:** user-ux — both are judged by eye, in the app, at his own resolution.

Automated first: `npm test`, eslint on the touched files, and a real-pixel before/after of the
lockup rendered off a static page (no Electron, never `:3000`).

## Constraints

- Shared tree, live peers. Commit by explicit pathspec.
- Fabio's live app runs from this tree — renderer edits show on his next reload.
- `styles/shell/titlebar.css` and `js/components/Compounds/MpiProjectName/MpiProjectName.css`
  are this card's only CSS. `index.html` gets one `src` swap.

## Plan Drift

- 2026-09-20: card created from Fabio's report while MPI-736 phase 5 was awaiting his read.
  Separate system (app chrome, not the accent family), so it did not fold into MPI-736.
- 2026-09-20: grew a third defect, folded in rather than carded — same session, same
  report, same class of bug (a shared change to the button breaking chrome). Its lineage is
  MPI-822's, not this card's, and the validation says so.
