# MPI-736 checklist

Derived from `plan.md` phase titles, 2026-09-18.

- [x] Phase 1 — make the token honest (zero visual delta, proven) — commit 2a3677f3
  - [x] 1a `--accent-err` born; every danger/error site off `--accent-heat`
  - [x] 1b ~33 hardcoded pinks onto the token
  - [~] 1c canvas constants — MOVED to phase 3 (see plan.md; brushDab is pinned DOM-free by its own test)
- [x] Phase 2a — `--accent-err` to a REAL RED: `oklch(0.70 0.19 27)`. Verified by Fabio in
      the live app on an error toast and the prompt box.
  - [x] Stop stops being red — it is a cancel, not a failure (Fabio, 2026-09-18).
        `MpiMaskDetectRow.js:81` → `variant: 'primary'`. Its twin
        `MpiToolOptionsGifCutout.js:358` is under MPI-771's live claim 6154218d;
        messaged (`e93c9db7`), NOT edited. **The two are inconsistent until that lands.**
- [x] Port the family accents into `DESIGN.md` (pulled forward out of phase 5, Fabio asked
      three times) + a `CLAUDE.md` Snapshot rule: never sample a brand colour off mascot art.
- [ ] Phase 2b — `--accent-warn` off hue 60 (squeezed between video 48 and prompt 102)
- [ ] Phase 3+4 (collapsed) — `:root` default to Studio's colour + the per-workspace
      `[data-accent]` overrides. 246 call sites in 67 app files; the big visible moment.
  - [x] ASKED AND ANSWERED: `--hub-accent` cream `oklch(0.78 0.028 80)`. Fabio, 2026-09-18.
  - [ ] 1c canvas constants land here (deferred from phase 1)
- [ ] Phase 5 — finish `DESIGN.md` (VT323 wordmark, single mascot) and rewrite `PRODUCT.md`
      (its "pink/heat accent" line goes wrong the moment phase 3 lands)
