# MPI-736 validation

**Verify mode:** user-ux — colour is judged by eye, in the app. Phase 1 is the exception:
it is mechanically provable zero-delta, and that proof is below.

## Phase 1a + 1b — RUN 2026-09-18, all checks passed

Isolated instance: `npm run app:isolated` → `READY http://127.0.0.1:50357`, driven with
`playwright-cli -s=mpi736`, stopped via the listener's parent (pid 10804).

### Static

- `grep -rn "0\.76 0\.17 355\|0\.78 0\.20 6\|0\.80 0\.19 355" js/ styles/` → the only survivors
  are the three token definitions in `styles/01_base.css` (`--accent-heat`, `--accent-err`,
  `--vision-accent`) and the six canvas constants deferred to phase 3. Zero CSS literals left.
- `npx eslint` on the touched files → 0 errors (the CSS files are not linted by this config).
- `npm test` → **1348 pass, 0 fail**, 1 skipped, 1349 total.

### Pixel — the zero-delta proof

Each old literal and its replacement rendered into its own element, the computed colour
pushed through a 1×1 canvas and the rgba bytes compared:

```
pairs=13 mismatches=0 -> every pair is byte-identical rgba
```

Those 13 are every alpha used in the sweep (0.08, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5,
0.6, 0.7, 0.85, 0.9, 0.95). `color-mix(in oklab, var(--accent-heat) N%, transparent)`
serialises as `oklab(0.76 0.169353 -0.0148165 / N)` — the same colour the literal
`oklch(0.76 0.17 355 / N)` resolves to, to the byte.

### Live rule chains

Real class names mounted in the running app, computed value read back:

| surface | renders |
|---|---|
| `.mpi-toast--danger` dot and progress | `oklch(0.76 0.17 355)` — unchanged |
| `.mpi-badge--danger`, `.mpi-icon--danger` | `oklch(0.76 0.17 355)` — unchanged |
| `.mpi-input--error` field border | `oklch(0.76 0.17 355)` — unchanged |
| `.mpi-progress--danger` fill | `oklch(0.76 0.17 355)` — unchanged |
| `.mpi-btn--primary`, `.mpi-btn--danger` | `oklch(0.76 0.17 355)` — unchanged |
| `.mpi-ok-cancel__icon--danger` | `oklch(0.76 0.17 355)` — unchanged |
| `.mpi-ok-cancel__icon--warning` | `oklch(0.78 0.14 60)` — **changed**, delta 3 |
| `.mpi-btn--primary.is-pressed`, `--danger.is-pressed` | `oklch(0.78 0.2 355)` — **changed**, delta 1 |

Relative colour syntax works in this Electron: `--accent-heat-hi` resolves and
`calc(l + 0.02) calc(c + 0.03)` lands exactly on `0.78 0.2`.

**Confirmed empirically, and it matters for phase 3:** `--accent-heat-hi` computes at
`:root` to `oklch(from oklch(0.76 0.17 355) …)` — the inner `var()` is already substituted.
A subtree that rebinds `--accent-heat` MUST restate `--accent-heat-hi` in the same rule or
the lift stays rose. The comment in `01_base.css` says so; this is the measurement behind it.

### Still needs Fabio's eye (user-ux)

Three deliberate visual deltas, everything else proven identical:

1. **Primary / danger button hover** — `oklch(0.78 0.20 6)` → `oklch(0.78 0.2 355)`. Same
   lightness and chroma, legacy 11° hue rotation dropped.
2. **`MpiReusePromptDialog` active-row hover** — was `oklch(0.80 0.19 355)` behind an
   undefined `--accent-heat-hi`; now the one shared lift `oklch(0.78 0.2 355)`.
3. **`MpiOkCancel` warning icon** — was `--accent-heat` (rose), now `--accent-warn`
   (yellow). Visible on the 18+ gate's triangle. Same defect class as danger: a status
   icon riding the action token.

## Phase 2a — `--accent-err` to a real red — DONE 2026-09-18

`styles/01_base.css:90` — `oklch(0.76 0.17 355)` → `oklch(0.70 0.19 27)`.

**Why this value, so nobody re-derives it.** Candidates were rendered on the real
`--surface-1` / `--surface-2` and judged against contrast and hue separation:

| | value | text on `--surface-1` | dark label on fill | sRGB |
|---|---|---|---|---|
| old rose | `0.76 0.17 355` | 3.06:1 | 8.28:1 | clips |
| **chosen** | **`0.70 0.19 27`** | **2.48:1** | **6.70:1** | **in gamut** |
| truer red | `0.63 0.22 27` | 1.85:1 | 5.01:1 | in gamut |

Hue 27 is the only red clearing both neighbours — 21° off `--video-accent` (48), 32° off
`--vision-accent` (355). L 0.70 is the practical ceiling: sRGB red maxes near L 0.63 at
full chroma, so **anything redder buys hue with contrast**. Error *text* on a panel drops
from 3.06:1 to 2.48:1 — neither passes AA, so this is a coloured-label convention, not body
text, and a second lighter token was judged not worth it.

**Verified by Fabio in the live app** (renderer is served from this tree, so a plain reload
picks it up): the error toast and the prompt box both read as the intended red.

### Stop is not danger (Fabio, 2026-09-18)

Grepping "which buttons are actually red" found only **four** in the whole app, and only
one is destructive:

| site | button | destructive? |
|---|---|---|
| `MpiRunpodSettings.js:962` | `Delete Pod` | yes — destroys a rented GPU |
| `MpiMaskDetectRow.js:81` | `Stop` (swaps in for `Detect`) | no |
| `MpiToolOptionsGifCutout.js:358` | `Stop` (swaps in for `Mask`) | no |
| `MpiPromptBox.css:714` | media-strip remove `×`, hover only | yes-ish |

So the red seen day to day signalled nothing wrong. Stop now takes the workspace accent
(`variant: 'primary'`), which phase 3 rebinds per workspace. State reads off the icon and
label, which are what change — the fill no longer distinguishes Detect from Stop, and that
is accepted.

**`MpiMaskDetectRow.js:81` changed. `MpiToolOptionsGifCutout.js:358` NOT changed** — it sits
under MPI-771's live claim `6154218d` (heartbeat 24 min at the time, well inside the 120 min
timeout). Message `e93c9db7` carries the exact one-word diff to that session. **Until MPI-771
applies it the two Stop buttons are inconsistent — GIF cut-out's is still red.**

Note the shipped third idiom, left alone: `MpiPromptBox.js:2346`'s Stop is a separate,
always-present `variant: 'secondary'` button that disables when idle, not a swap.

`npm test` 1351/1352 pass, 0 fail, 1 skipped (suite grew from 1348 — peers added four).

## Phase 2b — not started


## Phase 3+4 — the engine, and five rounds of sweep (2026-09-19)

`:root --accent-heat` is `var(--hub-accent)`; five `[data-accent]` rules sit under it, each
restating `--accent-heat-hi` because a custom property bakes its `var()` at the rule that
DECLARES it. Proved in real Chromium against the real stylesheets before Fabio ever
reloaded — every rebind resolves and every hover lift tracks its OWN hue:

| attr | `--accent-heat` | `--accent-heat-hi` |
|---|---|---|
| (`:root`) | `oklch(0.78 0.028 80)` | `oklch(0.8 0.058 80)` |
| `vision` | `oklch(0.76 0.17 355)` | `oklch(0.78 0.2 355)` |
| `video` | `oklch(0.78 0.15 48)` | `oklch(0.8 0.18 48)` |
| `prompt` | `oklch(0.88 0.13 102)` | `oklch(0.9 0.16 102)` |
| `audio` | `oklch(0.84 0.11 170)` | `oklch(0.86 0.14 170)` |

`--vision-accent` is byte-identical to the old `--accent-heat`, so the image workspace was
the control: unchanged is CORRECT there, and any delta would have been a bug.

### Every round was a STRUCTURAL cause, never a colour

Five rounds, and not one of them was "wrong value". Recorded because the next surface will
be one of these again:

1. **The trim bar and transport stayed cream.** `#controls-mount` is a SIBLING of
   `#tool-container` (`index.html:158`), and `MpiGroupHistoryBlock.js:518,547` mounts the
   video bar, the GIF bar and the frame strip into it. Binding moved to `#app-shell`.
2. **The model name never carried the accent at all.** `modelBtn` is `variant: 'secondary'`
   = pure `--surface-2` / `--ink-3` / `--ink-1`. The plan's "across the whole box" needed
   the box's own CSS to say so.
3. **The settings popup ignored its opener.** `MpiPromptBox.js:1573` appends `popupNode` to
   `document.body`, so it inherits from `:root`. It gets the attribute directly.
4. **The icons.** `MpiIcon` is `currentColor` BY DESIGN — the icons were faithfully
   inheriting `.mpi-btn--secondary`'s `color: var(--ink-1)`. One `color` on the button, not
   an `.mpi-icon--accent` tag per mount site.
5. **CUE's word stayed white while its glyph went orange.** `.mpi-ibtn__label` pins
   `var(--ink-2)` to run its own ink-2 -> ink-1 hover ladder. Related and worth knowing:
   `MpiButton.js:74` maps every icon button that is not danger/ghost down to `secondary`,
   so CUE has NEVER been filled despite mounting `variant: 'primary'`.
6. **Record's label went green and its mic glyph stayed grey.** A ghost ICON button is
   `.mpi-btn.mpi-ibtn.mpi-btn--ghost` at 0,3,0 pinning `--ink-3`, not the plain
   `.mpi-btn--ghost` at 0,1,0 pinning `--ink-2`. The 0,2,0 override lost, and lost
   silently. Caught by the probe, not by reading.

### `--ink-on-accent` was born here

The hold-to-loop charge fill and the armed CUE state were hardcoded `--accent-frost`, so
the one control that fills solid was the one ignoring the model. Moving them to
`--accent-heat` meant the armed label would be accent-on-accent, and there was **no token
for text on an accent fill** — `MpiButton.css` states the same `oklch(0.16 0.02 0)` four
times for want of one. Measured off rendered pixels (see below), one dark ink clears 4.5:1
on all five accents, so it became a token rather than a fifth literal.

| accent | fill | `--ink-on-accent` | old `--surface-0` |
|---|---|---|---|
| studio | `rgb(193,182,164)` | **9.73:1** | 3.04:1 |
| vision | `rgb(255,126,182)` | **8.26:1** | 2.58:1 |
| prompt | `rgb(233,219,111)` | **13.74:1** | 4.30:1 |
| video  | `rgb(255,151,92)`  | **9.11:1** | 2.85:1 |
| audio  | `rgb(122,226,192)` | **12.48:1** | 3.90:1 |

The armed button's old `--surface-0` label was 2.58-2.85:1. The washed-out "LOOP" in
Fabio's screenshot was failing contrast, and it predates this card.

**Measuring this is a trap.** `getComputedStyle` returns `oklch(...)`, and canvas
`fillStyle` silently REJECTS oklch — it keeps the previous value, so every pair reads
`#000000` and every ratio comes back a clean, plausible `1.00:1`. Screenshot the swatches
and sample the pixels with sharp instead.

### Signed off by Fabio, live, over five rounds

Workspace + transport by media type; PromptBox by SELECTED MODEL (name, borders, icons,
CUE lettering, charge fill, armed state); Enhance always prompt; Agent head always Studio;
Record and the gallery volume slider + icon always `--accent-audio` (the size slider beside
volume is NOT audio and keeps the workspace accent); Flows by their declared `mediaType`,
which `flowsRegistry.js` documents as "What the flow PRODUCES".

`npm test` 1408/1409 pass, 0 fail, 1 skipped. Lint clean on every touched JS file.

**Open, and Fabio's call, asked three times and deliberately left alone:** the prompt box's
trash button takes the model colour with the rest of the bar. The plan named "queue, stop"
and not delete.

## Round 6 — 2026-09-19 (implemented, awaiting Fabio's eye)

Three surfaces: the record-audio overlay's colours, its player, and the gallery info toggle.

### Proved in a real browser, not by reasoning

A node server on :48123 serving the repo root plus a scratch probe page, driven by
`playwright-cli`. The probe mounts the REAL `MpiAudioPlayer` inside a REAL
`.mpi-audio-recorder`, then reads computed values:

| read | value | means |
|---|---|---|
| `--accent-heat` on `.mpi-audio-recorder` | `oklch(0.84 0.11 170)` | audio green, not the cream |
| `--accent-heat` at `:root`, same page | `oklch(0.78 0.028 80)` | the rebind is scoped, not a global change |
| `--accent-heat-hi` on the dialog | `oklch(from oklch(0.84 0.11 170) …)` | the restatement baked the AUDIO base — the trap avoided |
| `--accent-heat` on the mounted player | `oklch(0.84 0.11 170)` | the player inherits the dialog's rebind |
| the player's time, before any metadata | `00:07` from `duration: 7.5` | the `duration` prop paints, which matters because Chromium reports `Infinity` for a MediaRecorder blob |
| a toggled `secondary` icon button at `:root` | bg `oklch(0.78 0.028 80)`, color `oklch(0.16 0.02 0)`, border = bg | cream fill, black icon — Fabio's spec |
| the same button UNtoggled | bg `surface-2`, border `ink-3` | bordered at rest, so on and off are distinguishable |

### The tier move

`MpiAudioRecorder` moved `Compounds/` → `Blocks/`, because mounting `MpiAudioPlayer` (an
Organism) from a Compound is what `mpi/no-same-tier-component-import` forbids, and
`--max-warnings=0` makes that red CI rather than a nit. Verified by hand, since
`.claude/rules/components.md` warns that a wrong `css:` path passes lint AND `npm test`:
all 12 relative imports inside the moved file resolve, and so do its own `css:` entry,
`preloadStyles.js`, `navigation.js`, `MpiBaseFlow.js`, and the `media-picker-cards` spec's
dynamic import.

`npm test` 1410/1411 pass, 0 fail, 1 skipped — run before AND after the move. Lint clean on
every touched file.

**Shipping one inconsistency on purpose, again:** `types.js:1587` still calls the recorder a
Compound and names its old path. That file is inside MPI-771's live claim `e48d9b11`
(session active, 30-minute heartbeat), so it was messaged (`bb5f6817`) rather than edited.
Nothing asserts that typedef, so it is docs drift, not a failing build.

**Noticed, not actioned:** `resources/cubric/update-manifest.json` still lists the old
`Compounds/MpiAudioRecorder` paths. It is a generated build artefact (`build-portable.mjs`)
and currently carries 34k lines of a peer's uncommitted work, so it was left alone — the
next portable build regenerates it.
