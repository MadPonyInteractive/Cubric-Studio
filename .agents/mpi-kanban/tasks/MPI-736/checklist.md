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
    - [x] The review track paints a real WAVE. A take under review has no file, so ffmpeg's
          bake cannot run; `bakeWaveMask()` draws `showwavespic`'s shape in the renderer.
          Checked by a desktop spec that drives it with a synthetic clip.
      - [x] Column is RMS, not the bucket peak — measured against ffmpeg's own mask of the
            same clip. Peak read 0.289/0.037, RMS 0.193/0.023, ffmpeg 0.173/0.021.
    - [x] **Folded in, pre-existing and not this card's doing:** the audio branch of
          `mediaImportService._buildGroup` dropped `thumbPath`, so a fresh audio card was
          blank until the project was reopened. Affects every audio import, not recordings.
    - [ ] `types.js:1587` still says `Compound` — inside MPI-771's live claim, messaged
          (`bb5f6817`), NOT edited. **Drift until that lands.**
  - [x] **Round 7 — the gallery card's kind chip.** Fabio picked it over the card mark and
        widened it: colour the icon AND give every kind one.
    - [x] `ASSET_KINDS` gained an `accent` column (a `[data-accent]` value); the grid writes
          it onto the chip, which rebinds `--accent-heat` for itself, and the chip's `color`
          came off `--ink-1`. No new token, no `color-mix` between two family accents.
    - [x] `badge: true` on `image` and `audio` — every kind badges now. Reverses
          `assetKinds.js`'s own "unmarked means just a picture" note, Fabio's call, written
          into the file with the reason.
    - [x] `image/gif/scene → vision`, `video → video`, `audio → audio`. Split by what the
          thing IS, not by whether it moves — Fabio corrected GIF off orange: *"I know
          they're animated, but they're still images."* 3D gets its own hue and mascot when
          the app does real 3D MODELS.
    - [x] **The filter panel too** — *"another place we're forgetting colour is the
          filters."* An active row already filled with `var(--accent-heat)`, so every row
          was the workspace accent. The row carries `[data-accent]` now and the existing
          rule became the family colour; no CSS value changed. Mark rows and the previews
          flag keep the workspace accent — not media types.
    - [x] **Edge the widening created:** `kindOfItem`'s catch-all row matches `undefined`,
          so an empty card would have claimed to be an image. Guarded at the call site, not
          in `kindOfItem` — six callers, one of them not optional-chained.
    - [x] `npm test` 1429/1430 (0 fail), `gallery-filter-panel.spec.js` green, eslint clean.
    - [x] **VERIFIED BY FABIO** (2026-09-19, live, with screenshots): *"yeah mate, it's
          looking good."* Both surfaces — Images/GIFs rose, Videos orange, on the card chips
          AND the filter rows.
    - [ ] Future, NOT built and not carded: an **element card** (several media types on one
          card) takes `studio` cream. Its `ASSET_KINDS` row already has the field.
  - [x] **Round 8 — the RULE got written down, and the settings panel.** Fabio stated the
        governing rule plainly for the first time: colour states what a surface is ABOUT,
        everywhere, not just generations. It is in `DESIGN.md` § "The rule: colour states
        what a surface is ABOUT" so it stops being re-derived every round.
    - [x] **ROOT CAUSE, not a preference:** `.mpi-settings__plate--on` pinned
          `oklch(0.72 0.20 6 / 0.45)` — the stale Vision pink, and the LAST hardcoded family
          literal in the repo. Phase 1b was supposed to have removed every one. A literal
          also ignores the `[data-accent]` rebind, so no settings section could have stated
          its subject until this was fixed. Now `color-mix(… var(--accent-heat) 45% …)`,
          matching the section rule 20 lines above it that was already correct.
    - [x] Audio section wears `data-accent="audio"`; Reuse Prompt wears `prompt` — it is a
          text surface, which the rule settles (my earlier default of cream was wrong).
          Six other sections have no media subject and stay Studio cream.
    - [x] **A repo-wide guard, because a literal surviving a whole sweep is the real bug:**
          `tests/accent-family-literals.test.cjs` fails if any stylesheet outside
          `01_base.css` names one of the five family values or the stale pink. Proven RED
          against the real defect restored, then the file restored byte-identical.
    - [x] `npm test` 1432/1433 (1 skipped, 0 fail), eslint clean.
    - [x] **VERIFIED BY FABIO** (2026-09-19, live): *"nice one, looking good bro."*
  - [ ] Round 9 — dialogs and pop-ups (2026-09-19) — **BUILT, awaiting Fabio's eye**
    - [x] `MpiEnhanceDialog` + `MpiReusePromptDialog` → `data-accent="prompt"` on the root.
    - [x] `MpiOpHelpDialog` → its op's accent, handed over by `getOpHelp().accent`.
    - [x] `MpiMediaDropOverlay` — needs nothing, it is not portaled. `MpiChangelogDialog` cream.
    - [x] The CSS "peer work" blocker was a CRLF phantom — empty diff, blob == HEAD.
    - [x] `op-strip-availability.test.cjs` 24/24, accent-literal guard green, eslint clean.
    - [x] **VERIFIED BY FABIO** (2026-09-19, live, his screenshot): *"yeah man, looks good."*
          Reuse Prompt checked too. Committed + pushed `d3ec007d`.
  - [ ] Round 9b — the MECHANICAL sweep, Fabio: *"have you done a sweep on the UI?"*
    - [x] Method recorded in `plan.md` so it is repeatable: 69 files draw the token,
          20 portal to `document.body`, intersect, then hand-check subject-vs-container.
    - [x] The intersection is FOUR, all pickers: `MpiDropdown` (13 callers), `MpiTreePicker`,
          `MpiStylePicker`, `MpiOptionSelector`. Toasts excluded by the status-colour rule.
    - [x] Fixed with ONE helper — `inheritAccent()` in `js/utils/dom.js`, called at OPEN
          time from each picker's existing position function.
    - [x] `tests/portal-accent.test.cjs` 3/3 incl. the stale-accent clear. `npm test`
          1447/1448 (1 skipped, 0 fail), eslint clean.
    - [x] **VERIFIED BY FABIO** (2026-09-19, live): *"1"*. Committed + pushed `bc6af6fb`.
  - [ ] Round 9c — class B, subject ≠ container (2026-09-19) — **BUILT, awaiting the eye**
    - [x] `MpiVoicePicker` → `data-accent="audio"`. A voice is audio whatever the Flow makes.
    - [x] `MpiMediaPicker` → `el.dataset.accent` from its existing `props.mediaType`.
    - [x] `MpiWaveform` and `MpiAudioPlayer` need NOTHING — the old survey row was wrong.
          The waveform draws `--accent-audio` directly (correct, it is permanently audio);
          the player draws no accent at all.
    - [x] `MpiMediaSlot` left alone on purpose — no media-type prop to drive it.
    - [ ] Fabio's live check; his call on the "?" guide (op colour or Prompt yellow).
  - [x] **RED MASTER met and fixed** (not this card's break): run `35463412842`, first red
        `74be51fd` (MPI-817). `focus-mode.spec.js` clicked the prompt textarea under a
        "No models installed" modal the weightless runner raises. Fixture fixed, proven red
        locally without the pin, pushed `d3a46d7d --no-verify`. See `docs/red-master.md`.
  - [ ] Finish the sweep — the rule now lets US find surfaces instead of waiting for a
        screenshot. Survey in `validation.md` § Round 8.
  - [ ] Round 9d — the STATUS BAR (2026-09-19) — **BUILT, awaiting the eye**
    - [x] `getCommandAccent(key)` in `commandRegistry.js`; `statusBar.js` sets it on the
          fill at `tool:running` and clears it at idle.
    - [x] The inherited premise was FALSE — no emitter changed. `tool:running` already
          carried `type`, and the bar already looked that key up for its label.
    - [x] Flows need no special case; one of the five `image → vision` copies retired.
    - [x] `tests/status-bar-accent.test.cjs` 5/5, `npm test` 1468/1469, eslint clean.
    - [ ] Fabio's live check: run an image op, a video op and an audio Flow.
  - [ ] 1c canvas constants land here (deferred from phase 1)
- [ ] Phase 5 — finish `DESIGN.md` (VT323 wordmark, single mascot) and rewrite `PRODUCT.md`
      (its "pink/heat accent" line goes wrong the moment phase 3 lands)
