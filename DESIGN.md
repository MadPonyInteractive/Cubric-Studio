# Cubric Studio — Design System

Stage direction (warm dusk, drenched, content-forward) is the locked-in design language. This file is the source of truth for tokens, type, components, and motion.

> All colors are OKLCH. No `#000`, no `#fff`. Every neutral is tinted toward 350° (mauve). Gradient text is banned.

## Tokens

```css
:root {
  /* Surfaces — chrome warmer than canvas; canvas is the deep stage */
  --surface-0:       oklch(0.50 0.022 350);  /* outermost chrome */
  --surface-1:       oklch(0.46 0.022 350);  /* panels */
  --surface-2:       oklch(0.42 0.022 350);  /* raised, inputs */
  --surface-3:       oklch(0.55 0.024 350);  /* hover */
  --surface-bar:     oklch(0.34 0.022 350);  /* status, quiet zones */
  --surface-canvas:  oklch(0.28 0.020 350);  /* editor canvas, vignette base */
  --surface-viewer:  oklch(0.20 0.020 350);  /* media compare/preview surround (MPI-585) */

  /* Ink — warm whites */
  --ink-1:           oklch(0.98 0.008 80);   /* primary text */
  --ink-2:           oklch(0.85 0.012 80);   /* secondary */
  --ink-3:           oklch(0.66 0.014 80);   /* labels, kickers */
  --ink-4:           oklch(0.50 0.018 80);   /* muted, almost-disappearing */

  /* Lines — translucent so they sit ON the surface */
  --line:            oklch(0.72 0.018 350 / 0.16);
  --line-soft:       oklch(0.72 0.015 350 / 0.08);

  /* Action accent — ONE token, rebound per workspace. See "The accent family" below.
     The :root default is Studio's cream, NOT Vision's rose: a general button belongs to
     the hub. Pointed at --hub-accent rather than restating its value, so the hub identity
     and the shared action colour cannot drift apart. */
  --accent-heat:     var(--hub-accent);      /* the action colour HERE — primary actions, active states */
  --accent-heat-hi:  oklch(from var(--accent-heat) calc(l + 0.02) calc(c + 0.03) h);  /* hover lift */

  /* Status — these stay status colours and do NOT follow the workspace */
  --accent-frost:    oklch(0.82 0.13 220);   /* cyan — generative state, focus rings, frost lines */
  --accent-ok:       oklch(0.78 0.13 150);   /* success, ready */
  --accent-warn:     oklch(0.78 0.14 60);    /* warning */
  --accent-err:      oklch(0.70 0.19 27);    /* error, destructive */
  --accent-err-hi:   oklch(from var(--accent-err) calc(l + 0.02) calc(c + 0.03) h);

  /* Family identity — one per app in the Cubric family. See the table below. */
  --hub-accent:      oklch(0.78 0.028 80);   /* cream  — Studio */
  --vision-accent:   oklch(0.76 0.17 355);   /* rose   — Vision */
  --prompt-accent:   oklch(0.88 0.13 102);   /* yellow — Prompt */
  --accent-audio:    oklch(0.84 0.11 170);   /* green  — Audio */
  --video-accent:    oklch(0.78 0.15 48);    /* orange — Video */

  /* Type scale — dramatic ratio for register=brand pages, tighter for product UI */
  --t-2xs:  10px;
  --t-xs:   11px;
  --t-sm:   13px;
  --t-md:   15px;
  --t-lg:   19px;
  --t-xl:   32px;
  --t-2xl:  64px;
  --t-3xl:  96px;
  --t-display: 144px;

  /* Spacing */
  --s-1:   4px;
  --s-2:   8px;
  --s-3:   14px;
  --s-4:   22px;
  --s-5:   32px;
  --s-6:   48px;
  --s-7:   72px;
  --s-8:   112px;

  /* Radius */
  --r-1: 0px;        /* sharp — Stage prefers angular over rounded */
  --r-2: 4px;        /* small affordances */
  --r-3: 12px;       /* large containers when softness is needed */
  --r-pill: 999px;   /* status pills, accent dots */

  /* Motion — cinematic, exponential ease-out */
  --ease:    cubic-bezier(0.16, 1, 0.3, 1);
  --t-fast:  200ms;
  --t-base:  280ms;
  --t-slow:  480ms;
}
```

## Color usage rules

| Color | Use for | Never use for |
|---|---|---|
| `--accent-heat` | Primary buttons, active layer outline, "generating" indicators, mascot accents, hover-state on row arrows. | Body text, large background fills (it's an accent — drenched is the SURFACE doing the work, not the heat). Anything that means *failure* — that is `--accent-err`. |
| `--accent-err` | Destructive buttons, error toasts, invalid-field borders, failure text. | Anything merely "primary" or "active". It was a literal alias of `--accent-heat` until MPI-736; that is exactly the bug. |
| `--accent-frost` | Focus rings, AI-state, secondary chips, frost-lined gauges, eyes on the mascot. | Decorative outlines on cards. |
| `--surface-canvas` | Editor canvas zone, vignette gradient stops. | Outer chrome — chrome stays at `--surface-0` / `--surface-1`. |
| Gradient text (`background-clip: text`) | Nothing. The wordmark used to be the one exception and no longer is — see § Wordmark. | Anywhere. One live consumer survives, `.gradient-text` on the engine-starting title (`MpiStartingComfy.js`); it is a known inconsistency, not a licence. |

## The accent family

**Source of truth: `c:\AI\Mpi\Cubric Studio (Website)\styles\landing.css:30-34`.** Cubric ships
as a family of apps and each one owns a hue. These five values are mirrored here from the
website, never invented — if they ever disagree, the website wins and this file is the thing
that drifted.

| App | Token here | Value | Mascot art |
|---|---|---|---|
| Studio (the hub) | `--hub-accent` | `oklch(0.78 0.028 80)` | cream `#c1b6a4` |
| Vision | `--vision-accent` | `oklch(0.76 0.17 355)` | rose `#fc77aa` |
| Prompt | `--prompt-accent` | `oklch(0.88 0.13 102)` | yellow `#ede367` |
| Audio | `--accent-audio` | `oklch(0.84 0.11 170)` | green `#70e2c5` |
| Video | `--video-accent` | `oklch(0.78 0.15 48)` | orange `#ff9360` |

**One name drifts:** the website calls Audio's `--audio-accent`; here it is `--accent-audio`.
Same value, and the one to grep for locally is `--accent-audio`.

### The rule: colour states what a surface is ABOUT

Fabio, 2026-09-19, stated plainly after the sweep had found it a screenshot at a time:

> Things that are image-related should have Vision colour. Audio-related, Audio colour.
> Video-related, Video colour. Prompt-related, Prompt colour. **Everywhere in the app, not
> just generations** — it shows the user a colour code that is easy to follow.

So the accent is not decoration and not a workspace theme. It is a **statement of subject**,
and it applies to any surface that has one: a gallery card's kind chip, a filter row, a
settings section, a dialog, a toolbar, a status line. A surface about no media type, or about
several at once, takes **Studio cream** — that is the meaning of cream, not a fallback.

Two readings that look the same and are not:

- **Prompt yellow is for surfaces about TEXT ITSELF** — the Enhancer, prompt history, Reuse
  Prompt. It is NOT the generate box: `MpiPromptBox` sets `[data-accent]` from the selected
  model's media type, so it says what it is about to MAKE, which is the more useful statement
  and is shipped behaviour.
- **A GIF and a 3D Scene are Vision, not Video.** The split is what the thing IS, not whether
  it moves — *"I know they're animated, but they're still images."* 3D earns its own hue and
  mascot when the app does real 3D MODELS, not 3D captures that produce pictures.

Mechanically this is always the same one-line move: put `[data-accent]` on the element that
owns the subject and let the rules underneath it resolve. Never name a hue at the call site —
a hardcoded value is how `MpiSettings.css` kept a stale pink through an entire sweep that was
supposed to have removed every one.

**How a workspace takes its colour.** Components read ONE action token, `--accent-heat`, and a
subtree redefines it — they are never taught five tokens:

```css
[data-accent="video"] { --accent-heat: var(--video-accent); }
```

A custom property bakes its `var()` at the rule that *declares* it, so any block rebinding
`--accent-heat` MUST restate `--accent-heat-hi` in the same rule or the hover lift keeps the
old hue. `MpiAgentChat.css` and `MpiPromptBox.css` already do the rebind; `styles/shell/landing.css`
does the same shape with `--crew-accent`.

**Never `color-mix()` two of these together.** The family spans antipodal hues and an oklch mix
walks through yellow. Mixing one with `transparent` is safe — use `in oklab` by convention.

## Theme

**No dark mode. No light mode. Mid-tone warm dusk only.**

Scene that justifies this: *a creator at their desk in late afternoon, room half-lit, working on AI imagery for hours. The screen should feel inhabitable, not glowing. Warm enough to relax the eye over a four-hour session.*

Don't ship a light mode. Don't ship a "darker" mode. The single mid-tone is the brand.

## Typography

**Family:** `JetBrains Mono` (already vendored in `assets/fonts/`). All UI, labels, numbers, body. Variable monospaced.
**Wordmark only:** `Russo One` (`--font-wordmark`, vendored in `assets/fonts/`). Not a pixel font — the pixel `VT323` this file used to name is the `docs/redesign/` mockups' wordmark. Its `@font-face` is still declared in `01_base.css` and referenced by nothing in `styles/` or `js/`.

**Hierarchy via scale + weight contrast (ratio ≥ 1.25). Never via color.**

| Role | Size | Weight | Line height | Letter-spacing |
|---|---|---|---|---|
| Display (landing headline) | 64–96px | 700 | 0.92 | -0.04em |
| Section heading | 32px | 600 | 1.0 | -0.02em |
| Subheading / project name | 19px | 600 | 1.2 | -0.01em |
| Body | 13–15px | 400 | 1.5 | 0 |
| Label / kicker | 11px | 500 | 1.3 | 0.16–0.32em (UPPERCASE) |
| Numerals (memory, counts) | inherit | 400 | inherit | 0, `tabular-nums` |

Cap reading column at 65ch. UI ignores this rule.

## Components

### Wordmark

A live two-tone lockup, not an image and not a gradient. `styles/shell/titlebar.css`:

```html
<span class="mpi-wordmark mpi-wordmark--titlebar" aria-label="Cubric Studio">Cubric<span class="mpi-wordmark__suffix">Studio</span></span>
```

```css
.mpi-wordmark {
  font-family: var(--font-wordmark);   /* Russo One */
  font-weight: 400;
  color: var(--ink-1);
  letter-spacing: 0.02em;
}
.mpi-wordmark__suffix { color: var(--accent-heat); }
```

**Colour is the only thing that differs across the family.** "Cubric" stays `--ink-1` in every
app; the suffix takes `--accent-heat`, which the `[data-accent]` rebind resolves to that app's
hue — so the hub reads cream, Vision rose, Prompt yellow, Audio green, Video orange, from one
rule. Never a second font, never a second lockup.

### Logo (titlebar / landing header / About)

The Studio robot's head, shipped already on-palette and used as-is: **no CSS filter recolor.**
The old `hue-rotate()` recipe over `favicon.png` / `lettering.png` belonged to the mockups and
has no consumer left in `styles/` or `js/`; the lines above are the only place it is still
named, as history.

Two files, and the difference matters when you size one:

- `logo.webp` (128×86) is **cropped to the art** — titlebar and the agent's head. Size it by
  `height`, and the number is what renders.
- `logo.png` (256×256) carries 44px of transparent padding above the art and 38px below —
  About uses it at a size where that does not show. Sizing it into a square box renders the
  robot at 68% of the box, which is the MPI-845 defect.

### Buttons

```css
.btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 24px;
  font-size: var(--t-sm);
  letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600;
  border: 1px solid var(--ink-1);
  background: transparent; color: var(--ink-1);
  transition: background var(--t-base) var(--ease), color var(--t-base) var(--ease);
}
.btn:hover { background: var(--ink-1); color: var(--surface-bar); }

.btn-primary {
  background: var(--accent-heat);
  border-color: var(--accent-heat);
  color: oklch(0.16 0.02 0);
}
```

Sharp corners (`--r-1: 0`). No rounded pills for primary actions in Stage. Pills are reserved for status indicators.

### Tags (filter / sort)

Plain text, UPPERCASE, ≥0.16em tracking. Active state shows a heat dot, not a border.

```css
.tag[aria-selected="true"]::after { content: " ●"; color: var(--accent-heat); }
```

### Kicker (eyebrow label)

```css
.kicker {
  font-size: var(--t-xs);
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.kicker::before {
  content: ""; width: 28px; height: 1px; background: var(--accent-heat);
  margin-right: 8px;
}
```

### Gauge (memory / progress)

```css
.gauge .bar {
  width: 60px; height: 1px; background: var(--line);
  position: relative;
}
.gauge .bar > span {
  position: absolute; inset: 0 auto 0 0;
  background: var(--accent-heat);
}
```

Bar is 1px tall — a line, not a chunky bar. `tabular-nums` on the numbers.

### Card / frame (gallery)

Frames are full-bleed images with a gradient overlay for legibility. No card chrome (no border, no inner padding around the image, no shadow). Hover scales the image 1.03 over `--t-slow`.

```css
.frame {
  position: relative; overflow: hidden; cursor: pointer;
  background: var(--surface-bar);
}
.frame img {
  width: 100%; height: 100%; object-fit: cover;
  filter: saturate(0.92) brightness(0.92);
  transition: transform var(--t-slow) var(--ease), filter var(--t-slow) var(--ease);
}
.frame:hover img { transform: scale(1.03); filter: saturate(1) brightness(1); }
```

### Canvas (editor)

Editor canvas has a radial vignette: `--surface-bar` at center, `oklch(0.20 0.020 350)` at edges. Adds inner darkening so the focused image pops.

```css
.canvas {
  background: radial-gradient(
    ellipse at 50% 45%,
    var(--surface-bar) 0%,
    oklch(0.20 0.020 350) 100%
  );
}
```

### Mask overlay

Heat-tinted feathered ellipse with dashed outline:

```css
.mask-shape {
  background: radial-gradient(ellipse at center,
    color-mix(in oklch, var(--accent-heat) 60%, transparent) 0%,
    color-mix(in oklch, var(--accent-heat) 25%, transparent) 60%,
    transparent 78%);
  outline: 1.5px dashed color-mix(in oklch, var(--accent-heat) 80%, transparent);
  mix-blend-mode: screen;
}
```

For mask painting on darker imagery, switch to `--accent-frost` (cyan) — kept available as `.mask-shape--frost`.

### Crop rig (video / image crop)

8 round handles, full outline, rule-of-thirds gridlines, darkened mask outside crop region. Handle: 10×10px heat dot with 2px ink-1 outline.

### Timeline

Full-width band, 100px tall. Three rows:
1. Controls: prev / play / next, time readout `MM:SS.MS / MM:SS.MS`, loop+audio toggles.
2. Track: 44px tall, frost waveform, heat trim handles, ink-1 playhead with arrow head.
3. Ruler: 5 timestamp ticks at 0/25/50/75/100%.

### Status footer

Always visible. Always at the bottom. Always carries: Idle/Generating state (with mascot peek if active), VRAM gauge, RAM gauge, optional queue count.

```html
<footer class="bar">
  <span>● Idle</span>
  <span>...</span>
  <span class="gauge"><span>VRAM</span><span class="bar"><span style="width:8%"></span></span>1.3 / 16</span>
  <span class="gauge"><span>RAM</span><span class="bar"><span style="width:27%"></span></span>17.6 / 64</span>
</footer>
```

## Layout principles

1. **Three-pane editor.** 64px tools rail (left) + canvas (center) + 360px inspector (right). All other surfaces flex to canvas.
2. **No nested cards.** A card inside a card is always wrong. Inspector sections separate via a 1px line, not via boxes.
3. **Asymmetric strips for galleries.** Three strip variants in Stage: `7-5`, `4-4-4`, `5-7`. Cycle them. Don't fall back to a uniform card grid.
4. **Vary spacing for rhythm.** Inspector sections use varying internal padding (`--s-3` for compact, `--s-5` for breath).

## Motion

- Default transition: `var(--t-base)` (280ms) `var(--ease)` (cubic-bezier 0.16, 1, 0.3, 1).
- Cinematic enters: `var(--t-slow)` (480ms) for image-scale-on-hover and tab cross-fade.
- No bounce, no elastic, no spring. Ease-out-quart / quint only.
- Don't animate layout properties — only `transform`, `opacity`, `filter`, `background-color`.

## Mascot rules

**There are five, one per app, and they are the accent family in character form** — Studio,
Vision, Prompt, Audio, Video, with the art colours in the table above. Poses live at
`assets/mascot/<key>/{idle,greet,happy}.webp`.

The landing hero stands all five on a lit stage, Studio centre (`js/shell/heroCrew.js` — the
only code that knows a mascot file path). Everywhere else in the app it is **Studio alone** —
the flat `assets/mascot/*.png` poses for the generating peek, the empty gallery, the engine-
starting card and the agent chat, and `studio/logo.*` for the titlebar, About and the agent's
head. A workspace does NOT swap in its own character: the accent already says what the surface
is about, and five robots taking turns would be noise.

- **Where it appears:**
  - Idle / "thinking" — small float in the corner of the editor canvas while a job runs.
  - Empty states — first-run landing, empty filter result.
  - Done state — brief celebrate hover in completion toasts.
- **Where it never appears:**
  - Background wallpaper.
  - On every screen (it stops being a friend, becomes wallpaper).
  - Bigger than 64px outside the landing.
- **Animation:** gentle vertical float, 4s, ease-in-out, 3px amplitude. Never spin, never wave continuously.

## Anti-patterns banned in Stage

- `#000` / `#fff` (use OKLCH neutrals).
- Gradient text. The wordmark was the one exception and no longer is.
- Glassmorphism by default. Allowed only for the canvas dock backdrop, kept subtle.
- Side-stripe accents (`border-left: 3px solid …`). Use full borders, dots, or kickers instead.
- The hero-metric template (big number + small label + supporting stats + gradient accent).
- Identical card grids — Stage uses asymmetric strips, never a 4-column repeat.
- "Working on it ✨" copy. Show the real progress and ETA.
