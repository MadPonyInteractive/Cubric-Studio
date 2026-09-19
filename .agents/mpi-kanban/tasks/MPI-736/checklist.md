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
- [~] Phase 3+4 (collapsed) — `:root` default to Studio's colour + the per-workspace
      `[data-accent]` overrides. The engine landed and Fabio signed off on five rounds of
      surfaces; the sweep is not finished.
  - [x] ASKED AND ANSWERED: `--hub-accent` cream `oklch(0.78 0.028 80)`. Fabio, 2026-09-18.
  - [x] The engine: `:root --accent-heat: var(--hub-accent)` + five `[data-accent]` rules,
        each restating `--accent-heat-hi`. `01_base.css`.
  - [x] Workspace binding on `#app-shell` (NOT `#tool-container` — `#controls-mount` is its
        SIBLING, so the transport and trim bar were left on the shared cream).
  - [x] PromptBox takes the SELECTED MODEL's colour; the settings popup gets it separately
        because it is appended to `document.body`.
  - [x] The bar's own controls: border + `color` (the icons are `currentColor`), the
        `.mpi-ibtn__label` for CUE, and the hold-to-loop charge fill + armed state off
        `--accent-frost`.
  - [x] `--ink-on-accent` born — there was no token for text ON an accent fill and
        `MpiButton.css` had stated the same literal four times.
  - [x] Record + volume slider → `--accent-audio`. Flows → their declared `mediaType`.
  - [~] Round 6, implemented and awaiting Fabio's live pass:
    - [x] Record-audio overlay colours → `--accent-audio`, rebound on `.mpi-audio-recorder`
          so the mic button, meter and player all inherit it.
    - [x] The raw `<audio controls>` swapped for `MpiAudioPlayer`. Forced
          `MpiAudioRecorder` Compounds → **Blocks**: only Blocks may import an Organism,
          and `--max-warnings=0` makes that red CI, not a nit. Fabio approved the move.
    - [x] Gallery info + archive toggles off `variant: 'ghost'` — a ghost toggle shows its
          state in colour alone, invisible now the accent is cream.
    - [ ] `types.js:1587` still says `Compound` — inside MPI-771's live claim, messaged
          (`bb5f6817`), NOT edited. **Drift until that lands.**
  - [ ] Finish the sweep — Fabio is still finding surfaces a round at a time
  - [ ] 1c canvas constants land here (deferred from phase 1)
- [ ] Phase 5 — finish `DESIGN.md` (VT323 wordmark, single mascot) and rewrite `PRODUCT.md`
      (its "pink/heat accent" line goes wrong the moment phase 3 lands)
