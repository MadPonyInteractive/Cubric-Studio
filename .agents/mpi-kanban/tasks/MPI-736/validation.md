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

### The wave itself — Fabio's second look, same round

His screenshot of the shipped overlay: the transport worked and wore audio green, and the
waveform track was a flat fill. Correct for what was built and still wrong to ship. A saved
item's mask is baked by ffmpeg over a PATH (`extractAudioWaveform`), and a take under
review has no path — that is the entire premise of the dialog — so there was nothing to
hand `MpiWaveform`, and a maskless track paints fills and no wave.

`bakeWaveMask()` now draws it in the renderer from the samples in hand, copying
`showwavespic`'s shape deliberately: mono mixdown, `sqrt` amplitude, white on transparent,
the same 1260x540 rendition, so a clip does not change shape the moment it is saved. It is
applied AFTER the player mounts — decoding costs real time and the transport works without
it — and only if the instance it was baked for is still mounted, because Re-record can land
first.

Measured off the mask's own pixels, as a fraction of column height carrying ink, for a
synthetic 3s clip of silence / 0.9 / 0.03 amplitude:

| second | ink | |
|---|---|---|
| silence | 0.002 | the 1px floor, not a band |
| loud | 0.952 | |
| -30 dBFS | 0.174 | **this is what `sqrt` buys** — linear would draw ~0.03, a flat line |

**The committed check:** `tests/desktop/gallery-audio-waveform.spec.js` § "a take under
review bakes its own waveform mask, on the same sqrt scale as ffmpeg". It drives the real
exported function with a synthetic clip — no mic, no dialog, no fake-device flag — and
asserts those three bands plus the 21:9 rendition. Passes in 9.6s. That spec file is the
right home: it already owns the baked-mask mechanism from MPI-730, and this is the same
picture drawn the other way.

`bakeWaveMask` sits at module scope and is exported for exactly that reason; it closes over
nothing, so the export costs nothing and buys a check that needs neither a mic nor a modal.

### Then: an empty card on Accept, and "is this repeat code?"

Fabio accepted a take and got a card with no wave, which filled itself in the moment he left
the project and came back. Two findings, one of them not this card's doing.

**1. `mediaImportService._buildGroup` dropped `thumbPath` on the AUDIO branch.** The image
and video branches pass it; audio never did. Nothing was lost on disk — the server bakes the
waveform and stamps the sidecar inside the upload request, and `POST /upload` returns the
path — so the mask existed the whole time and only the freshly built card lacked it. The
next project load read the sidecar and the wave appeared, which is why this was never
reported: **a bug that fixes itself on reload is one nobody files.** It predates this card
and affects every audio import, not only recordings. One line, folded in.
Check: `tests/media-import-single-listener.test.cjs` § "every branch of the ItemGroup build
passes thumbPath to its item" — asserted RED against the un-fixed source, then green, with
the file restored byte-for-byte.

**2. The bake was measurably coarser than ffmpeg's, and it was the statistic.** Fabio asked
whether this duplicates what Flows already do. It does not duplicate CODE — a Flow's audio
is a SAVED item, so `MpiBaseFlow` hands the player `it.thumbPath`, the ffmpeg mask; there is
no other renderer-side waveform drawing in `js/` (grepped: only `toWavFile`/`wavEncoder`,
which encode). It did duplicate the PICTURE, so the two were measured against each other on
the same clip (`voices/child_1.opus`), full resolution, as mean ink and mean column-to-column
change:

| bake | mean ink | jaggedness |
|---|---|---|
| ffmpeg `showwavespic` | 0.173 | 0.021 |
| ours, bucket PEAK | 0.289 | 0.037 |
| ours, bucket RMS | 0.193 | 0.023 |

The peak of ~340 samples always picks the loudest one, which inflates every column AND makes
neighbours disagree — and that disagreement is what aliased into the dotty smear Fabio called
blurry when a 1260px mask is drawn into a 240px strip. RMS lands on ffmpeg's own profile.

That change moved the spec's own threshold: a SINE's RMS is 1/√2 of its peak, so a full-scale
sine tops out at `sqrt(1/√2)` = 0.84 of the height and the 0.9 test tone at 0.79. The
assertion was 0.8, calibrated to peak detection. It now says 0.7 and carries the arithmetic,
rather than being quietly loosened until it passed.

## Round 7 — the kind chip (2026-09-19, awaiting Fabio's eye)

Fabio picked the bottom-right kind chip over the card mark, and added a second job to it:
*"at the moment we have icons for video and GIFs, we don't have them for audio and images…
it would be cool if we had them for images and audio, so everything gets a nice icon."*

**The chip carries `[data-accent]`; no new token was added.** `styles/01_base.css` already
ships five `[data-accent]` rules that rebind `--accent-heat` for a subtree. The chip sets
that attribute on ITSELF and its `color` is `var(--accent-heat)`, so `currentColor` in the
inlined SVG follows. Nothing reached the token layer, and there is no `color-mix` between
two family accents.

**Why the attribute has to be on the chip.** Gallery cards carry no accent of their own —
grepped `MpiGalleryGrid.{js,css}` for `data-accent`, zero hits. Every card inherits whatever
`#app-shell` is on, so an image card and a video card in the same grid were, and without
this would remain, the same colour. `gallery-filter-panel.spec.js` pins that with
`expect(chips.img1.color).not.toBe(chips.vid1.color)` — a computed-colour comparison in real
Electron, which is what fails if the attribute is ever dropped or misspelt.

**The edge `badge: true` on `image` created.** `kindOfItem`'s last row is the catch-all
(`match: () => true`), so it matches `undefined` too. While `image` was `badge: false` that
was harmless; with every row badging, a card with no selected item would have grown an Image
chip and claimed to be a picture. Guarded at the one call site (`selected ? … : null`) rather
than by changing `kindOfItem`, which has six callers and one (`MpiGalleryGrid.js:1931`) that
does not optional-chain its result. The spec's `empty1` fixture is exactly this card and
still asserts no chip.

**Accent per kind. Both judgement calls were flagged before building, and Fabio corrected
one of them — the rule is by what the thing IS, not by whether it moves:**

| kind | accent | why |
|---|---|---|
| `image` | `vision` — rose | Vision is the image app |
| `video` | `video` — orange | |
| `audio` | `audio` — green | |
| `gif` | `vision` — rose | **Fabio's correction.** Built as `video` because it moves; *"I know they're animated, but they're still images."* |
| `scene` | `vision` — rose | he confirmed rose, and named the condition for changing it: a real 3D hue and mascot arrive when the app does 3D MODELS, not 3D captures of pictures |

A future **element card** — one card holding several media types — takes `studio` cream, his
call, noted not built.

**The filter panel was the same forgetting, and he caught it: *"another place we're
forgetting colour is the filters."*** An active filter row already fills with
`var(--accent-heat)` (`galleryFilterPanel.css`), so it was the workspace accent on every row
— an Images row and a Videos row filled identically. `_appendRow` now takes the kind's
`accent` and sets `[data-accent]` on the ROW, which rebinds `--accent-heat` there, and the
existing fill rule became the family colour with **no CSS value changed**. Mark rows (Dots,
Squares, Triangles) and the previews flag pass no accent and keep the workspace one: they are
not media types. The dark ink on the fill (`oklch(0.20 0.03 355)`) needs no per-hue variant —
every family accent is L 0.76–0.88, so L 0.20 clears all five by a wide margin.

The panel is a `<body>` portal, which is structural cause #5 on this sweep's list, but it
does not bite here: the attribute is on the row inside the popup, so the row declares its own
`--accent-heat` rather than inheriting one. `gallery-filter-panel.spec.js` asserts the
attribute per row AND that the Images and Videos fills differ — a `getComputedStyle`
comparison, which is what fails if the rebind ever stops reaching the row.

## Round 8 — the rule, and the last pink literal (2026-09-19)

Fabio stated the governing rule plainly, which no previous round had: *"Things that are
image-related should have Vision colour… audio, Audio… video, Video… prompt, Prompt.
**Everywhere in the app, it's not just about generations.** It shows the user a colour code
that is easy to follow."* Written into `DESIGN.md` § "The rule: colour states what a surface
is ABOUT" so the next session applies it instead of rediscovering it.

**The settings pink was a ROOT-CAUSE bug, not a styling preference.**
`.mpi-settings__plate--on` pinned `oklch(0.72 0.20 6 / 0.45)` — the stale Vision pink that
`DESIGN.md` and `PRODUCT.md` still wrongly describe, and the **last hardcoded family literal
in the repo**. Phase 1b's claim that "every CSS pink literal is gone" was false by one file.
Two consequences, and the second is the one that mattered: it looked wrong, AND a literal
cannot be reached by `[data-accent]`, so no settings section could state its subject until
it was fixed. The correct form was already twenty lines above it in the same file
(`__section-title::after`, same 45%); the plate rule had been written by hand instead.

`data-accent="audio"` on the Audio section, `prompt` on Reuse Prompt. One attribute each, in
a static template, no JS. Reuse Prompt reverses my own earlier default of cream — I had
argued it is about reuse *behaviour* rather than about text, and Fabio's rule settles it the
other way: it is prompt-related, so it is Prompt yellow. The other six sections (Update,
Engine health, App Behavior, Desktop Notifications, Display, External Connections) have no
media subject, carry no attribute, and stay Studio cream. That is not a fallback — under the
rule, cream IS the statement "this is about no one media type".

**The guard is repo-wide, because the real defect was a literal surviving a sweep.**
`tests/accent-family-literals.test.cjs` fails if any stylesheet outside `01_base.css` names
one of the five family values or the stale pink; it blanks comment bodies first (preserving
newlines so line numbers stay true) because a comment quoting a literal to explain its
removal is the opposite of the bug — the first version of the scanner flagged its own
explanatory comment, which is how that was found. It also pins which settings sections carry
an accent and which must not. **Proven RED** by restoring the real defect for one run: it
named `MpiSettings.css:66`, and the file was restored byte-identical (checked with a buffer
compare, not a re-read).

### Survey: what the rule still touches

The engine already covers more than it looks. `navigation.js:297` sets `[data-accent]` on
`#app-shell` from the open group's type, so a video viewer, GIF bar or frame strip inside a
video workspace ALREADY inherits orange without declaring anything. "Declares no accent" is
therefore not the same as "is the wrong colour". The gaps are surfaces whose SUBJECT differs
from their CONTAINER:

| Surface | Why it is a gap |
|---|---|
| `MpiAudioPlayer`, `MpiWaveform` | audio, but mounted by `MpiBaseFlow`, `MpiGalleryGrid`, `MpiMediaPicker` and `MpiVideoControlBar` — so in a video or image context they inherit the wrong hue. `MpiAudioRecorder` was fixed in round 6; its player was not. |
| `MpiVoicePicker` | audio (a voice), mounted inside Flows of any type |
| `MpiEnhanceDialog`, `MpiToolOptionsPrompt`, `MpiReusePromptDialog` | text surfaces, currently wearing whatever workspace is open. Prompt yellow under the rule. |
| `MpiMediaSlot`, `MpiMediaPicker` | each slot has a DECLARED type, so the slot can state it — a picker showing image and audio slots should not be one colour |
| GIF / video viewers, control bars, frame strip | inherit correctly from the shell today. Only worth touching if one ever renders outside its own workspace. |

Not started, not agreed — this is the list to work down, and Fabio picks the order.

**A typo in `accent` fails silently**, which is why it is tested twice: the attribute matches
nothing, `--accent-heat` is never rebound, and the chip inherits the workspace accent. That
reads as "the accent is wrong", not as "the row is wrong" — the seventh structural cause of
this sweep wearing a new hat. `tests/asset-kinds.test.cjs` asserts every row's value is one
of the five real `[data-accent]` names and pins the whole map.

**Checks:** `npm test` 1429/1430 (1 skipped, 0 fail). `gallery-filter-panel.spec.js` green
on its own port, the user's `:3000` untouched. `eslint --max-warnings=0` clean on all four
touched JS files. The suite's FIRST run failed twice in `gif-frames.test.cjs` on `mkdtemp
ENOENT` for a missing `%TEMP%/cubric-tests` parent — environmental, not this change: that
file is untouched, the disk had 161 GB free, and it ran 10/10 green on its own.

## Round 9 — the dialogs (2026-09-19, awaiting Fabio's eye)

**Built:** `MpiEnhanceDialog` and `MpiReusePromptDialog` carry `data-accent="prompt"` on
their template root; `MpiOpHelpDialog` takes its op's accent from `getOpHelp().accent`
(`cmd.mediaType`, `image` → `vision`, none → `studio`). No stylesheet changed.

**Ran:** `node --test tests/op-strip-availability.test.cjs tests/accent-family-literals.test.cjs`
→ 24/24. The new test asserts every op's accent is a value `01_base.css` declares, so a
sixth media type cannot silently fall back to `:root`. `eslint --max-warnings=0` clean on
the four JS files. Full `npm test` NOT re-run this round.

**NOT verified in pixels.** No isolated instance was booted; the rebind is round 8's
verified mechanism (`MpiSettings.js:194`, same attribute, same value). Fabio's reload is
the check.

**VERIFIED BY FABIO** (2026-09-19, live, his own screenshot of the Enhance dialog — yellow
Enhance button, yellow OK): *"yeah man, looks good."* He checked Reuse Prompt too. Committed
and pushed as `d3ec007d`.

## Round 9b — the mechanical sweep (2026-09-19)

Fabio asked the right question: *"are there any other boxes or pop-ups we are forgetting?
Have you done a sweep on the UI?"* No — rounds 1-9 were all screenshot-driven. This is the
first exhaustive pass; the method and the full table are in `plan.md`.

**Found four gaps, all PICKERS, none of them a dialog:** `MpiDropdown` (8 accent uses,
13 callers), `MpiTreePicker` (7), `MpiStylePicker` (5), `MpiOptionSelector` (2, across its
three variants). Each portals to `document.body` and draws `--accent-heat`, so its selected
row rendered cream no matter which workspace the trigger sat in.

**Fixed with one helper, not four labels.** `inheritAccent(portalEl, anchor)` in
`js/utils/dom.js` reads `anchor.closest('[data-accent]')` and copies it. Called at OPEN
time from each picker's existing position function. Baking the attribute at mount would be
WRONG, not merely verbose: one Dropdown instance reopens in different workspaces, so a
baked value goes stale. That is the case `tests/portal-accent.test.cjs` pins — reopening
under no accent must CLEAR the old one.

**Ruled out with a reason, so nobody re-derives them:** `MpiSlideOver`, `MpiColorPicker`
and `MpiToast` draw no accent at all; toasts are status colours by the 2026-09-18 decision;
`MpiStartingComfy` is correctly cream (engine startup is about no media type);
`mediaActions`/`MpiGroupHistoryBlock` portal a download `<a>`; `mentionPicker` portals an
offscreen measurement mirror.

**Ran:** `npm test` 1447/1448 (1 skipped, 0 fail), `portal-accent.test.cjs` 3/3, eslint
clean on the five files. **NOT verified in pixels** — Fabio's reload is the check.

**VERIFIED BY FABIO** (2026-09-19, live): *"1"*. Committed and pushed as `bc6af6fb`.

## Round 9d — the status bar, which was never the hard one (2026-09-19)

**The premise every handoff carried was false.** They all said `tool:running` /
`tool:progress` carry no mediaType so the EMITTERS must change. `tool:running` has always
carried `type: operation` (`generationService.js:905`), and `statusBar.js` was already
looking that same key up in the registry for its label. **No emitter changed.** Fourth
wrong inherited row on this card — check the claim before budgeting for it.

**Built:** `getCommandAccent(key)` in `commandRegistry.js` beside
`getCommandProgressLabel` (op key → `mediaType` → accent, `image → vision`, unknown →
`studio`); `statusBar.js` sets `_fill.dataset.accent` on `tool:running` and DELETES it on
the way to idle. `.shell-info__fill` is the only element in the bar drawing
`--accent-heat`, so it is the one that declares, and idle is about no media type.

**Flows needed no special case:** the twelve `flow*` ops are ordinary registry rows with
their own `mediaType`. Measured: 22 vision, 14 video, 5 audio, 2 studio — the two cream
ones are `createGroupFromSelection` and `promoteToNewGroup`, correctly about no medium.

**Ran:** `npm test` 1468/1469 (1 skipped, 0 fail), `status-bar-accent.test.cjs` 5/5, eslint
clean. **NOT verified in pixels** — the colour is not reachable from a unit test, which is
exactly why one of those tests asserts the EMITTER still carries `type`: drop that key and
the bar goes quietly cream with nothing failing.

Also retired one of the five `image → vision` copies (`getOpHelp` now calls the helper).
Four remain, all under other cards' live claims.

## Round 9c — class B, and a red master met on the way (2026-09-19)

**Class B swept. Two of its four recorded rows were already correct** — the old survey had
never opened the files, which is the third time this card's inherited survey has been wrong
(after `MpiMediaDropOverlay` and the `MpiEnhanceDialog.css` phantom). Verify before acting.

- `MpiWaveform` draws `var(--accent-audio)` **directly**, twice. That is right and
  deliberate: a waveform is permanently about audio, so it should NOT inherit. Do not
  "fix" it onto `--accent-heat`.
- `MpiAudioPlayer` draws no accent at all — `--surface-viewer`, `--ink-1`, and nothing else.
- `MpiVoicePicker` (2 uses) → `data-accent="audio"`. Real gap: inside a video Flow,
  `MpiBaseFlow` accented it orange, and a voice is audio.
- `MpiMediaPicker` (3 uses) → `el.dataset.accent` from its existing `props.mediaType`.
  Real gap, and it already had the prop; picking a reference image for a video op is an
  image job.
- `MpiMediaSlot` (1 use, a hover border) **left alone on purpose**: it has no media-type
  prop, and threading one from two callers to colour a hover border is not worth it.

`eslint` clean. No test added: both are the same one-line attribute shape as
`navigation.js:297` and `MpiBaseFlow.js:215`, neither of which has one either.

**Noticed, not actioned:** the `image → vision` map is now written out five times
(`navigation.js`, `MpiBaseFlow`, `MpiPromptBox`, `getOpHelp`, `MpiMediaPicker`). It wants
one helper beside `inheritAccent`; three of the five are under other cards' live claims, so
converting two of five would be worse than leaving five.

### The red master, met on the push

`git push` was refused by `.husky/pre-push`: master's last run `35463412842` had FAILED.
Not this card — the first red is `74be51fd` (MPI-817), and the two reds after it are docs
commits inheriting it. A red master is the job of whoever meets it (`docs/red-master.md`).

**Cause 1 from the playbook, and `test-failed-1.png` said it in one glance:** a "No models
installed" modal sitting over the app. The runner has no weights, so the boot sync rewrites
every `installed` flag false; that spec's last step clicks the prompt textarea, which the
modal covers, so `locator.click` timed out at 30s — three times, retries included. 140
passed, 1 failed. Green on every dev box, where the weights are.

**Fixed the FIXTURE, not the product**, copying the shape `radial-menu.spec.js` already
proved: `pinOneModelInstalled()` pins `sdxl-realistic` usable, and `provokeNoWeights()`
recreates the weightless runner inside the spec so it now fails on a dev box too. **Proven
both ways:** with the pin commented out the modal asserts `1` and the test fails locally;
restored, 2 passed. Pushed `d3a46d7d` with `--no-verify` — the only thing it is for.

Noticed, not actioned: that is the FOURTH copy of the `sdxl-realistic` pin
(`gallery-cue-all`, `model-settings-popup`, `radial-menu`, now `focus-mode`).
`tests/desktop/launch.js` is the shared home it wants. A red master takes the smallest
diff, not a refactor across four specs.

**Two survey rows were wrong, both cheaper than recorded.** The `MpiEnhanceDialog.css`
"peer work" is a line-ending phantom: `git diff` empty, filtered `hash-object` == HEAD blob
`968ace43`, `ls-files --eol` reads `i/lf w/crlf`. And `MpiMediaDropOverlay` is not portaled
(`el.appendChild` in both Blocks), so it already inherits the right colour and needs nothing.
