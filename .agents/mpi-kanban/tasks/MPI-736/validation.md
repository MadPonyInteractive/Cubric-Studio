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

## Phase 2, 3, 4 — not started
