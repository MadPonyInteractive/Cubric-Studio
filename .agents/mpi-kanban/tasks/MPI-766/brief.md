# MPI-766 — Landing hero 2.0: the mascot crew replaces the dragon backdrop

## Decision (Fabio, 2026-09-15)

Of three hero studies, **A "Stage Call" ships with 2.0**, with the two changes Fabio asked for
(quote and buttons, below). B "Handoff" and C "Tell Studio" are parked for 2.1: both assume the
talking agent, which MPI-677 schedules last.

Mockup: study A at https://claude.ai/artifact/9pHmQsg2ZjbVhmRZh9BB7Y (private to Fabio; an
`Artifact read` from one of his sessions returns the HTML). It is a mockup: its raw
`addEventListener` calls, bare `<button>`s and inline styles are not a pattern to copy.

## What changes on the landing

**Today** (`index.html:58-116`, `styles/shell/landing.css`, `js/shell/projectUI.js`): the hero
column paints `assets/hero-bg.jpeg` at 35% opacity behind the headline, the rotating quote
(MPI-696, `js/shell/heroQuote.js`), a CTA row (`+ New project` and `Open folder`, built from
`projectUI.js:100`) and the stats foot. The picker column ends in a single `Open folder…` button
(`#openFolderBtn`, `projectUI.js:133`).

**After:**

1. **Backdrop.** `hero-bg.jpeg` goes. In its place, a soft spotlight cone from the top onto
   Studio plus an elliptical floor pool, both drawn from surface tokens. No image.
2. **Headline unchanged:** "Generate. Refine. Own it."
3. **The quote moves up** into the slot under the headline that the CTA row held. It keeps
   MPI-696's fixed min-height, so a long quote never pushes the crew. About 400px wide at the
   reference size, so a three-line quote still clears Studio's head.
4. **The CTAs move to the picker foot.** `+ New project` (primary) and `Open folder`
   (secondary) sit side by side in two equal columns with an 8px gap, replacing the lone
   `Open folder…`. The hero CTA row is removed.
5. **The crew stands on a stage** across the bottom of the hero, on a 1px floor line.
6. **The stats foot is unchanged** (GPU, VRAM, RAM, models, last session).

## Stage spec

Reference window 1920×1032, so the hero column is 1120×1000. The floor line sits at y = 840 in
the hero. Each character is bottom-anchored on it and centred on x:

| Character | centre x | height | role line under the floor |
|---|---|---|---|
| Prompt | 118 | 210 | shapes the words |
| Vision | 318 | 260 | makes the images |
| Studio | 560 | 360 | runs the crew |
| Video | 802 | 260 | puts them in motion |
| Audio | 996 | 210 | gives them sound |

- Studio stacks above Vision and Video, which stack above Prompt and Audio, so the crew steps
  out from behind it.
- Label: the character name in the wordmark face with a dot in its family accent, and the role
  line under it in `--ink-3`.
- The stage is a fixed composition. Decide during planning how it scales with the window (scale
  the stage as one unit, never reflow the row) and check it at the smallest supported window.

## Motion

- **Page load:** the light and the pool fade up; Studio rises 36px; Vision and Video slide 90px
  out from behind it, then Prompt and Audio (delays of about 0.6s and 0.78s). **Transform only,
  never from opacity 0:** a delayed entrance that starts invisible shows nothing if it never runs.
- **At rest:** each character floats 3px on a 4s ease-in-out cycle with a random phase
  (DESIGN.md mascot rule). One character greets every ~3.2s for ~1.5s.
- **Hover:** greet pose, 8px lift, and a floor glow in that character's accent (mix in `oklab`;
  see MPI-736's trap). **Click:** happy pose for ~1.4s.
- **`prefers-reduced-motion`:** no entrances, no float, no ambient greeting.
- Every timer and listener is released in `destroy()` when the landing unmounts.

## Mascot slots and the animation to come

- **The stills are placeholders.** Fabio is making animated versions of the mascots in a
  separate session (MadPony-Identity). Build now with the current PNGs from
  `C:\AI\Mpi\Cubric Studio Brand Assets`, but keep the slot the only thing that knows the file,
  so the animations replace the stills without touching the layout.
- One element per character, swapping idle / greet / happy.
- Export each character's poses **sharing one registration box** (the union of the three alpha
  bounds), so a pose swap never shifts the body. Downscale on the way in: a ~620px-tall WebP is
  25-60 KB per pose, against 1.5-4 MB source PNGs.
- Animated loops are coming. Plan for **WebM (VP9 with alpha)**, not GIF: GIF's 1-bit
  transparency leaves a jagged fringe on the dark outline. When a project opens, the landing's
  `destroy()` pauses each video, removes its `src` and calls `load()`. That releases the decoder;
  hiding a playing video does not.

## Dependencies and overlaps

- **MPI-708 (rename and mascots).** Its Phase 2 stages `assets/mascot/<character>/` and a
  mascot-path map keyed on `MEDIA_TYPE`. Reuse both; do not build a second map. **MPI-708 parks
  the Audio and Prompt mascots, and this hero needs all five**, so that park is lifted for the
  landing (Fabio chose study A with all five, 2026-09-15).
- **MPI-736 (accent).** The no-hue decision, applied to the landing: "Generate. Refine." in
  `--ink-3`, "Own it." in `--ink-1`, the primary button filled with ink, the kicker line in ink.
  Only the crew carries hue. Build against the action token so the hero follows whatever MPI-736
  lands; if this card ships first, it ships in today's pink and flips when MPI-736 lands.
- **Display strings** ("Cubric Studio · v2.0.0" in the mockup) belong to MPI-708.
- **Rules that bind the build:** every control through `ComponentFactory` (MPI buttons, never a
  bare `<button>`), BEM `.mpi-landing__*`, colours from tokens only, listeners through
  `js/utils/dom.js` `on`/`off`, teardown through `destroy()`.

## Likely files

Declare the real list in `files.json` at the `todo -> doing` move: `index.html` (landing block),
`styles/shell/landing.css`, `js/shell/projectUI.js`, `js/shell/heroQuote.js` (only if its mount
changes), `assets/mascot/**` (shared with MPI-708), and `assets/hero-bg.jpeg` (removal; check
nothing else references it first).

## Verify

In `npm run app:isolated`, never the user's `:3000`:

- crew positions at the reference size and at the smallest window;
- both picker-foot buttons do what the old buttons did;
- the quote rotates without moving the crew;
- reduced motion is honoured;
- no timer, listener or video decoder is alive after a project opens.
