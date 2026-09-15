# Per-media-type accent family: finish what `--accent-audio` started

## Decision (Fabio, 2026-09-15): Studio owns no hue

Scope item 1 below is answered. **Studio has no action colour of its own.**

- **Shared surfaces draw actions in ink.** The landing, Model Library, settings, the queue and
  any dialog not tied to one media type: the primary button is filled with `--ink-1` and carries
  dark text, and emphasis comes from value (`--ink-3` against `--ink-1`), not from a hue.
- **Each workspace takes its character's colour as the action accent.** Image workspace =
  `--vision-accent` (so it looks exactly as it does today), video workspace = `--video-accent`,
  audio Flows = `--audio-accent`, the enhance dialog = `--prompt-accent`.
- **Shape: the themed option, not five global action tokens.** Components keep reading ONE
  action token and a workspace root redefines it. `--accent-heat` is that token today; whether
  it gets renamed, now that it no longer means "pink", is an implementation call on this card.
- **`--hub-accent` stays Studio's IDENTITY colour** (its mascot label, family swatches), never
  an action colour.

**Why.** The two alternatives failed on sight in the mockup:

- Studio's cream (`--hub-accent`, chroma 0.028) sits right next to `--ink-2`. Used as the
  accent, it makes ordinary body text read as the accent.
- Keeping pink everywhere gives Studio Vision's colour.

The Studio mascot is also the only character with no coloured part in its art: the orchestrator
is the neutral one.

Mockup with a Pink / Studio cream / No hue switch plus a per-workspace strip: study A at
https://claude.ai/artifact/9pHmQsg2ZjbVhmRZh9BB7Y (private to Fabio). The hero build is MPI-766.

### Work the decision creates

1. **About 30 hardcoded pinks bypass the token and would not follow it.** Measured 2026-09-15;
   `var(--accent-heat)` itself has 239 uses in 68 files and those all follow.
   - Primary button hover, an older pink `oklch(0.78 0.20 6)`:
     `js/components/Primitives/MpiButton/MpiButton.css:58-59, 85-86, 251-252`. Left alone, every
     primary button flashes the old pink on hover.
   - Literal `oklch(0.76 0.17 355 / a)` glows and fills: `styles/shell/base.css:26`,
     `styles/shell/components.css:46-61`, `styles/shell/titlebar.css:44`,
     `styles/shell/workspace.css:82`, `styles/01_base.css:307-312`,
     `js/components/Compounds/MpiMemoryMonitor/MpiMemoryMonitor.css:123-129`,
     `js/components/Compounds/LandingPages/MpiAbout/MpiAbout.css:22`,
     `js/components/Compounds/MpiStartingComfy/MpiStartingComfy.css:28`,
     `js/components/Compounds/MpiHistoryList/MpiHistoryList.css:53`,
     `js/components/Organisms/MpiCanvasViewer/MpiCanvasViewer.css:51, 63`.
     Replace with `color-mix(in oklab, var(--accent-heat) N%, transparent)`.
   - Canvas constants, which cannot read CSS: `js/utils/cropTool.js:34`,
     `js/components/Primitives/MpiCanvas/MpiCanvas.js:18, 23`, and in
     `js/components/Primitives/MpiCanvas/managers/`: `ShapeManager.js:38`, `CropManager.js:29`,
     `brushDab.js:294`. Each must read the computed token of the workspace it draws in.
   - `js/components/Compounds/MpiReusePromptDialog/MpiReusePromptDialog.css:72-73` falls back to
     a literal only when `--accent-heat-hi` is undefined.
   - The paint default `#e0446b` (`MpiToolOptionsPaint.js:38`, `MpiToolOptionsMaskAdjust.js:56`,
     `MpiStepPaint.js:97`, `managers/PaintManager.js:52`) is a brush colour, not the accent.
     Decide it separately; do not sweep it by reflex.
2. **OPEN: status colours collide with two characters.** `--accent-warn` `oklch(0.78 0.14 60)`
   is nearly `--video-accent` `oklch(0.78 0.15 48)`, and `--accent-ok` `oklch(0.78 0.13 150)`
   sits beside `--audio-accent` `oklch(0.84 0.11 170)`. In those workspaces a warning would read
   as an action. Either re-hue warn and ok, or make every warning and success carry an icon and
   text as well as colour. Fabio's call, before this card starts.
3. **Design docs.** `DESIGN.md` and `PRODUCT.md` still describe one pink accent at a stale value
   (`oklch(0.72 0.20 6)`; the code has `0.76 0.17 355`), a VT323 wordmark (the code uses Russo
   One) and a single mascot. Rewrite them with this decision, which is scope item 2.
4. The oklab mixing trap further down applies to every per-workspace accent.

## Why this card exists

MPI-730 needed one colour and took one: `styles/01_base.css` now carries
`--accent-audio: oklch(0.84 0.11 170)`, mirrored from the source of truth, and the audio
gallery card paints with it. That was a deliberate single-token landing — the rest of the
family was NOT added, because it is a product decision, not a component one.

The rest of the family still has to land, and the design docs still have to say so.

## The family (source of truth — mirror, never invent)

`c:\AI\Mpi\Cubric Studio (Website)\styles\landing.css` is the source of truth.
`c:\AI\Mpi\MadPony-Identity\DESIGN.md:360-372` mirrors it and states that rule in as many
words.

| token there | value | in Vision today |
|---|---|---|
| `--hub-accent`    | `oklch(0.78 0.028 80)`  | absent |
| `--vision-accent` | `oklch(0.76 0.17 355)`  | present, but named `--accent-heat` |
| `--audio-accent`  | `oklch(0.84 0.11 170)`  | present as `--accent-audio` (MPI-730) |
| `--prompt-accent` | `oklch(0.88 0.13 102)`  | absent |
| `--video-accent`  | `oklch(0.78 0.15 48)`   | absent |

Note the naming collision to resolve: Vision's app accent `--accent-heat` IS
`--vision-accent`, same value. Whether the family renames it, aliases it, or leaves it
alone is part of this card's decision.

## Scope

1. **Decide the shape** — one token per media type in `styles/01_base.css`, or a themed
   `--accent-media` that a workspace/card sets per type. Then land it.
2. **Update the design docs** with the decision: which names Vision uses, that the website
   repo stays the source of truth, and how a surface picks its accent.
3. **Apply it** to the surfaces that should carry a media-type colour rather than the app
   accent. The audio card is already done and is the worked example.

## The trap that cost a test run on MPI-730 — read before using any of these

`color-mix(in oklch, ...)` interpolates the **hue**. The surface family sits at hue 350
and `--accent-audio` at 170 — exactly antipodal — so an oklch mix walks the hue right past
the colour and lands on a yellow. It looked like the token had not loaded at all.
`--accent-video` (48) and `--accent-prompt` (102) are far from 350 too and will do the same
thing. **Mix in `oklab` (or another rectangular space).** Vision's rose never showed this
because 355 is 5° from the surface hue, so every existing `color-mix(in oklch, var(--accent-heat) …)`
call site in the app is fine and none of them proves the pattern safe.

Second trap: `--accent-ok` is `oklch(0.78 0.13 150)`, close enough to the audio accent to be
tempting and wrong — it is the success/ready semantic, and reusing it would tie a brand
colour to a status.

## Relationship to MPI-708

MPI-708 renames the product to Cubric Studio and gives each media type its own mascot and
accent. This card is the token/design half of that and can land ahead of it or inside it —
Fabio's call.
