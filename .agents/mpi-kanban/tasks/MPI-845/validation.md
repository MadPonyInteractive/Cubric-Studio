# MPI-845 validation

## Evidence for the diagnosis (2026-09-20, before any fix)

Both causes were measured off the repo, with no app running.

**The titlebar mark.** `PIL` alpha-bbox of `assets/mascot/studio/logo.png`:

```
canvas (256, 256)   alpha bbox (2, 44, 256, 218)
pad  left 2  right 0  top 44  bottom 38
glyph 254x174 = 99.2% w, 68.0% h
glyph centre (129.0, 131.0) vs canvas centre (128.0, 128.0)  ->  dx +1.0  dy +3.0
```

So `.titlebar-logo-img { width:16px; height:16px }` renders the robot at **15.88 × 10.88 px**
inside a box that is 32% empty vertically.

`fontTools` on `assets/fonts/RussoOne-Regular.woff2` (upm 1000, hhea asc 926 / desc −279,
`sCapHeight` 700) at the wordmark's 12px with `line-height: 1`:

```
ascent 11.11  descent 3.35  content 14.46  half-leading -1.23
baseline 9.88  capHeight 8.40  caps span 1.48..9.88  caps centre 5.68
box centre 6.00  ->  caps sit -0.32 px relative to the box centre
```

Icon art centre lands +0.19px below its box centre; text caps sit −0.32px above theirs. Net
≈ 0.51px of disagreement, which a fractional `devicePixelRatio` rounds independently for a
16px image box and a 12px text box — the reported "in most resolutions".

`assets/mascot/studio/logo.webp` is 128×86 with a **zero-padding** alpha bbox, aspect 1.4884
against the PNG art's 1.4598, and an overlay of the two at a common size shows the same robot
(mean abs RGB delta 16.59/255, all of it outline antialiasing from the smaller re-export).
It already ships and `MpiPromptBox.js:2526` already uses it.

**The back chip's hover fill.** Specificity, not a missing rule:

| Selector | Specificity | Declares |
|---|---|---|
| `.mpi-project-name__back` | (0,1,0) | `background: none` |
| `.mpi-project-name__back:hover` | (0,2,0) | `color` only |
| `.mpi-btn--ghost:hover:not(:disabled)` (`MpiButton.css:119`) | **(0,3,0)** | `background: var(--surface-2)` |

The component asks for no background at a weight the primitive outranks. Flows and Record are
clean because they are **icon** buttons and match `.mpi-btn.mpi-ibtn.mpi-btn--ghost:hover`
(`MpiButton.css:307`), which pins `background: transparent` deliberately —
*"Ghost icon button — never fills background."*

`.mpi-project-name__segment--link` carries the identical `background: none` at (0,1,0), so it
has the same defect and has simply not been hovered.

## Fix (2026-09-20, session 6eea5755)

### 1. The titlebar mark

`index.html` now points at `assets/mascot/studio/logo.webp` (the unpadded twin), and
`.titlebar-logo-img` is `height: 14px; width: auto` instead of a square `16px` box. With zero
padding in the asset, **the number in the CSS is the art height** rather than 68% of it.

Rendered boxes, measured live off a static page through `playwright-cli` (never `:3000`):

| | image box | visible art | art centre vs bar | text centre vs bar |
|---|---|---|---|---|
| before | 16 x 16 | 15.88 x 10.88 | 16.00 | 16.00 |
| after  | 20.83 x 14 | 20.83 x 14.00 | 16.00 | 16.00 |

The two BOXES were always centred on each other — that part was never broken. What moved is
the art: it now fills its box, so the mark reads at its stated size and its visible centre is
its box centre instead of 0.19px below it.

**What is deliberately NOT done.** Russo One's caps sit 0.32px above the middle of their own
12px line box, so a box-centred mark still reads ~0.32px low against the letters. That is a
third of a CSS pixel; nudging it would mean a sub-pixel margin with no way to judge it, and
the dominant error (a mark 22% shorter than it claimed to be) is gone. If it still reads low
at Fabio's scaling, the harness and the exact number are both here and the nudge is one line.

`electron-builder.yml` ships `**/*`, and `MpiPromptBox.js:2526` already loaded this webp at
runtime, so nothing new enters the package.

### 2. The back chip's hover fill

One rule in `MpiProjectName.css`, at the primitive's own selector shape:

```css
.mpi-btn.mpi-btn--ghost.mpi-project-name__back:hover:not(:disabled),
.mpi-btn.mpi-btn--ghost.mpi-project-name__segment--link:hover:not(:disabled) {
    background: transparent;
    color: var(--ink-1);
}
```

(0,4,0) against the primitive's (0,3,0). `MpiButton` is untouched — a text ghost filling on
hover stays correct everywhere else in the app.

### Automated

- **`tests/project-name-chip-hover.test.cjs`, new, 4/4.** It does not grep for the rule; it
  resolves the cascade over a synthetic chip across both stylesheets and asserts the winning
  `background`. A text scan would pass on the broken code, because `background: none` is still
  present there and simply loses.
- **PROVEN RED against the pre-fix CSS**, then restored byte-identical:

  ```
  x back chip (<- GALLERY / <- PROJECTS) takes no background on hover
      resolves to `background: var(--surface-2)` from `.mpi-btn--ghost:hover:not(:disabled)`
  x breadcrumb link segment takes no background on hover
      resolves to `background: var(--surface-2)` from `.mpi-btn--ghost:hover:not(:disabled)`
  pass 2  fail 2
  ```

  The other two cases stayed GREEN through the revert, which is what makes them guards rather
  than restatements: one pins that a plain text ghost still fills, the other that the icon
  ghost never did.
- `npm test` 1545 tests, **1543 pass / 1 skipped / 1 fail**, and the failure is not this card's
  — see below.
- `eslint` on all four touched paths: no errors (the three non-JS files are not linted).

### The one failing test is a live peer's, uncommitted

`tests/agent-no-delete.test.cjs` -> *"POST /connector/cancel is not on the in-app agent's
allowlist"*. `services/agentTools.mjs` is dirty in the shared tree and **HEAD does not contain
`/connector/cancel` at all** (`git show HEAD:services/agentTools.mjs | grep -c` -> 0, working
copy -> 2). So a peer added the route without extending the allowlist the test pins. Nothing
in this card touches JS, and that test reads none of the four files here. It is also
**unclaimed** — no `state/files/` record covers `agentTools.mjs` — so it was edited outside
the claim system rather than inside someone's live ownership.

## 3. The chip's remove X (Fabio, 2026-09-20, added after the first two shipped)

*"Another place where changing the MPI button broke it — the X for the image chips now looks
like a rectangle."*

**It is not a cascade problem, which is why it survived a rule written at (0,3,0).**
`ddd813da` (MPI-822, *"one height per control size, app-wide"*) added
`min-height: var(--control-h-sm)` — 34px — to `.mpi-btn--sm`. A **size floor clamps the USED
height after the cascade resolves**, so the remove pill's `height: 16px` could not win at any
specificity. The X rendered **16 x 34**: a portrait tab, exactly what the screenshot shows.

MPI-822's own comment reasoned *"icon buttons are unchanged, text buttons grow to meet them —
nothing shrinks."* That held for every call site taking the default height and was false for
every one that had deliberately shrunk below it. **There were five, not one:**

| file | rule | asked | rendered |
|---|---|---|---|
| `MpiPromptBox.css` | `.mpi-prompt-box-media-strip__remove` | 16px | 34px |
| `MpiQueuePanel.css` | `.mpi-queue-panel__action` | 26px | 34px |
| `MpiQueuePanel.css` | `.mpi-queue-panel__icon-btn` | 28px | 34px |
| `MpiModelManager.css` | `.mpi-detail__close` | 28px | 34px |
| `MpiMemoryMonitor.css` | `.mpi-mem-monitor__btn-wrap .mpi-ibtn` | 30px | 34px |

All five fixed in one pass (`.claude/rules/root-cause.md`: a shared primitive is fixed at every
call site or not at all). Each gets `min-height: 0` beside its existing `height` — the floor is
released rather than the number restated, so nothing duplicates `--control-h-sm`.

`MpiButton.css` is **not** touched. The floor is right; MPI-822 shipped it for a real defect
(text and icon buttons reading 3-4px apart) and it is still doing that job for every other
button in the app.

### Measured

Rendered off a static page carrying the REAL `01_base.css`, `MpiButton.css` and
`MpiPromptBox.css`, through `playwright-cli`:

```
before  16 x 34      <- the portrait tab in Fabio's screenshot
after   16 x 16      <- square, which is what `border-radius: 0` was drawn for
```

The first attempt at the BEFORE column measured 16x16 and was WRONG: the simulated floor was
written at (0,2,0) and lost to the real rule's (0,3,0). Re-stated at (0,4,0) it reproduced
16x34. Worth recording, because it is the same specificity trap the bug is about, met while
trying to demonstrate the bug.

### Guard

`tests/button-size-floor.test.cjs`, new, 2/2. It walks every stylesheet, finds each rule whose
SUBJECT is a button (not an icon, img or spinner child of one) asking for a height under its
size token, and fails unless that rule also releases `min-height`. **Proven RED with all five
fixes reverted** — it named all five with their files and numbers — then all four files
restored byte-identical.

Its second case pins MPI-822's floor still being present on `--sm/--md/--lg`. Without that,
deleting the floor would make the first case pass vacuously.

### Suite

`npm test` **1549 tests, 1548 pass / 1 skipped / 0 fail.** The `agent-no-delete` failure
reported earlier in this session is gone — the peer extended their own allowlist
(`tests/agent-no-delete.test.cjs` is dirty too now, and carries `/connector/cancel`). Nothing
on this card touched it.
