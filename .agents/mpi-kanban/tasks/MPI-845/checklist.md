# MPI-845 checklist

Derived from `plan.md`, 2026-09-20.

- [x] 1. The titlebar mark — point `index.html` at the already-cropped `logo.webp` and size
      `.titlebar-logo-img` by height with `width: auto`, so the art height IS the number in
      the CSS instead of 68% of it.
- [x] 2. The back chip's hover fill — override `.mpi-btn--ghost:hover` (0,3,0) at a matching
      weight for BOTH `.mpi-project-name__back` and `.mpi-project-name__segment--link`.
      `MpiButton`'s ghost variant stays untouched.
- [x] A test pinning the hover background, so the specificity loss cannot come back.
- [x] `npm test` + eslint on the touched files.
- [x] Real-pixel before/after of the lockup, off a static page. Never `:3000`.
- [x] 3. The chip's remove X — MPI-822's `min-height` floor clamped it to 16x34. FIVE
      call sites had the same defect, all fixed with `min-height: 0`; `MpiButton` untouched.
- [x] `tests/button-size-floor.test.cjs` — the guard for the whole class, proven RED
      against all five reverts.
- [ ] Fabio's eye, at his own resolution — all three defects were reported by eye.

**Done 2026-09-20**, awaiting only Fabio's eye. The new test was proven RED against
the pre-fix CSS and the file restored byte-identical. `npm test` 1543/1545 with one
failure that is a live peer's uncommitted `agentTools.mjs` route, not this card.
