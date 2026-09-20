# MPI-736 — Per-media-type accent family

Brief: `brief.md`. Source of truth for values: `c:\AI\Mpi\Cubric Studio (Website)\styles\landing.css`.

## Current State

**2026-09-20, session 03654647 — PHASE 1c IS IN AND VERIFIED BY FABIO** ("1"). The five
canvas literals read the live token off `ctx.canvas`; a crop handle in the video workspace
draws orange. Detail below under "1c".

**Rounds 9c and 9d are also VERIFIED** — he checked all three in the same pass. Nothing on
this card is now awaiting an eye. Remaining: phase 2b and phase 5, neither started.

**2026-09-19, session 8abe87b4 — the SWEEP IS FINISHED. What is left is phases, not
surfaces.** Five commits, all pushed, master green: `d3ec007d` dialogs, `bc6af6fb` the four
portalled pickers, `d3a46d7d` a red master that was not ours, `47e10d3b` voice + media
picker, `2013bc51` the status bar.

Fabio verified rounds 9 and 9b live (*"yeah man, looks good"*, then *"1"*). **Rounds 9c and
9d are committed but NOT eye-checked** — that is the only thing owed before the remaining
phases: a voice list in a video Flow should be green, the media picker on an image slot in
a video op rose, and the status bar should take the colour of the op it is running and go
back to cream at idle.

**Settled:** the "?" op guide keeps its OP's colour — *"leave the ? guide fine as it is."*

**The lesson of this session, and it kept repeating: FOUR inherited survey rows were
wrong** — `MpiMediaDropOverlay` (not portalled), `MpiEnhanceDialog.css` (a CRLF phantom,
never a peer's work), two of class B's four rows (`MpiWaveform`/`MpiAudioPlayer` were
already correct), and the status bar's *"the emitters have to change"* (they never did).
Open the file before budgeting for a row.

Remaining, in the card's own order: phase 2b `--accent-warn`, phase 5 docs
(`PRODUCT.md`, `DESIGN.md`'s stale VT323 line). 1c is done and signed off.

Phase 1a and 1b landed and are committed (`2a3677f3`, 28 files). `--accent-err`,
`--accent-heat-hi` and `--accent-err-hi` exist in `styles/01_base.css`; every danger/error
surface is off the action token; every CSS pink literal is gone. Proven zero-delta: 13
old/new colour pairs byte-identical rgba, every live rule chain read back in a running app,
`npm test` 1348/1348. Details in `validation.md`.

Fabio confirmed on reload that he could see no change — correct, and the reason is worth
keeping: `iconTone: 'warning'` has exactly ONE caller in the app (`js/shell.js:112`, the
18+ gate, once per profile), and the other two deltas are hover-only at identical lightness
and chroma. Phase 1 needed no human eye; the byte comparison was the verification.

Also committed this session, NOT MPI-736 work: `f76f886c` — the agent chat's user bubble
fills `--accent-heat` (rebound to `--hub-accent` cream) and its text was `--ink-1`,
near-white on cream. Now `--ink-4`. Fabio's call, made in devtools. `MpiAgentChat.css` is
MPI-774's file, so it was committed under that card.

**Phase 2a is DONE and verified by Fabio** (2026-09-18): `--accent-err` is
`oklch(0.70 0.19 27)`. Working out the value, and the "Stop is not danger" finding that came
out of it, are in `validation.md`.

Also done, pulled forward out of phase 5 because Fabio has now asked three separate sessions
for it: the five family accents are written into `DESIGN.md` § "The accent family", sourced
from `Cubric Studio (Website)\styles\landing.css:30-34`, and `CLAUDE.md`'s Snapshot gained a
rule — **never sample a brand colour off the mascot art, the values are written down.** That
rule exists because this session sampled the PNGs before checking, which is the mistake.

**PHASE 3+4's ENGINE HAS LANDED** (2026-09-19). `:root --accent-heat` is
`var(--hub-accent)`, five `[data-accent]` rules sit under it in `01_base.css`, and Fabio
signed off across five rounds of live checks. The sweep is NOT finished — he is still
finding surfaces a round at a time, which is the expected shape of this phase, not drift.

**Round 6 is VERIFIED BY FABIO** (2026-09-19, live): *"it's working now, everything looks
okay."* That closes the audio strand of this sweep — the record-audio overlay's colours, our
own player with a real waveform, the gallery info toggle, and the two defects the round
surfaced (an imported audio card dropping `thumbPath`, and the bake reading peak instead of
RMS). `npm test` 1419/1420, desktop bake spec green, lint clean.

**Round 7 is VERIFIED BY FABIO** (2026-09-19, live, from his own screenshots): *"yeah mate,
it's looking good."* Card chips and filter rows both. He picked the kind chip, not the
card mark: *"the little card icon at the bottom right… at the moment we have icons for video
and GIFs, we don't have them for audio and images."* Two jobs, both done — the chip wears its
media type's family accent, and every kind badges now.

`ASSET_KINDS` gained an `accent` column holding a `[data-accent]` value. Two surfaces read
it and set it on their own element, which rebinds `--accent-heat` there: the card's corner
chip (`MpiGalleryGrid`, whose `color` came off `--ink-1`) and the filter panel's kind rows
(`galleryFilterPanel.js`, where the active-row fill was ALREADY `var(--accent-heat)` — so
that surface needed no CSS value changed at all, only the attribute). Neither a card nor a
filter row carries an accent of its own, so without it every one would be whatever
`#app-shell` is on. `badge` flipped true on `image` and `audio`, reversing `assetKinds.js`'s
own "unmarked means just a picture" rationale — Fabio's call, written into the file with the
reason.

**The rule is what the thing IS, not whether it moves.** `image`, `gif` and `scene` are all
`vision`; `video` is `video`; `audio` is `audio`. GIF was built as `video` and Fabio
corrected it — *"I know they're animated, but they're still images."* 3D Scene keeps rose on
the same logic, and he named the condition for a sixth hue and mascot: real 3D MODELS, not
3D captures that produce pictures.

`npm test` 1429/1430 (1 skipped, 0 fail), `gallery-filter-panel.spec.js` green, eslint clean.
The suite's first run failed twice in `gif-frames.test.cjs` on `mkdtemp ENOENT` for a missing
`%TEMP%/cubric-tests` parent — environmental, 10/10 green run alone, 161 GB free, and that
file is untouched by this round.

**Round 8 is VERIFIED BY FABIO** (2026-09-19, live): *"nice one, looking good bro."* The
settings panel, and — more
importantly — **the governing rule is now written down**. He stated it plainly for the first
time: *"image-related → Vision colour, audio → Audio, video → Video, prompt → Prompt.
Everywhere in the app, it's not just about generations."* It lives in `DESIGN.md` § "The
rule: colour states what a surface is ABOUT". Every earlier round derived a piece of this
from a screenshot; from here the rule finds the surfaces instead.

The settings pink turned out to be a **root-cause bug**: `.mpi-settings__plate--on` pinned
`oklch(0.72 0.20 6 / 0.45)`, the stale Vision pink and the LAST hardcoded family literal in
the repo — phase 1b's "every pink literal is gone" was false by one file. A literal also
ignores the `[data-accent]` rebind, so no section could have stated its subject until it was
fixed. `tests/accent-family-literals.test.cjs` now fails repo-wide if any stylesheet outside
`01_base.css` names a family value, proven RED against the restored defect. Audio section →
green, Reuse Prompt → yellow, the other six stay cream because they are about no media type.
`npm test` 1432/1433, lint clean. Details and the survey: `validation.md` § Round 8.

### THE STATUS BAR — DONE 2026-09-19, and it was NOT the hard one

Every handoff since round 6 carried this as *"the one genuinely non-trivial piece left —
`tool:running`/`tool:progress` carry no mediaType, so the EMITTERS have to change, not just
`statusBar.js`."* **That premise was false, and it is the FOURTH wrong inherited row on
this card.** `tool:running` has always carried `type: operation`, the op key
(`generationService.js:905`), and `statusBar.js` was ALREADY looking that same key up in
the registry for its label (`getCommandProgressLabel`). Nothing upstream changed.

- `getCommandAccent(key)` in `commandRegistry.js`, beside `getCommandProgressLabel`:
  op key → `mediaType` → accent, `image → vision`, unknown → `studio`.
- `statusBar.js` sets `_fill.dataset.accent` on `tool:running` and DELETES it at idle.
  `.shell-info__fill` is the only element in the bar that draws `--accent-heat`, so it is
  the one that declares. Idle is about no media type, so it goes back to cream.
- **Flows needed no special case** — the twelve `flow*` ops are ordinary registry rows
  carrying their own `mediaType`, so an LTX foley run reads audio and an outpaint reads
  image. Only the two group ops take cream, correctly.
- This also killed one of the five `image → vision` copies: `getOpHelp()` now calls the
  helper. **Four left** (`navigation.js:297`, `MpiBaseFlow.js:215`, `MpiPromptBox.js:1984`,
  `MpiMediaPicker`), all under other cards' claims.

`tests/status-bar-accent.test.cjs` pins the two things that would silently undo it: every
op resolving to a declared `[data-accent]`, and `tool:running` still carrying `type` —
because the colour itself is not reachable from a unit test, so a dropped payload key would
turn the bar quietly cream with nothing failing. `npm test` 1468/1469 (1 skipped, 0 fail).

### THE MECHANICAL SWEEP (2026-09-19) — Fabio: *"have you done a sweep on the UI?"*

Answer was no. Every round 1-9 was screenshot-driven: he saw a cream surface, we fixed it.
This is the first exhaustive pass, and it is cheap to repeat because it is two greps.

**The method — do this, not a walkthrough.** A surface is wrong only when BOTH hold:
it draws `var(--accent-heat)`, AND it cannot inherit the right one. So:

1. `grep -rlo "var(--accent-heat" js styles` → **69 files**.
2. `grep -rn "document\.body\.appendChild" js` → **20 files** (class A: inherits `:root`).
3. Intersect. Then hand-check class B separately: NOT portalled, but its SUBJECT differs
   from its CONTAINER (an audio player inside a video Flow).

**Class A result — the intersection is FOUR, and all four are PICKERS, not dialogs:**

| Portalled | `--accent-heat` uses | Verdict |
|---|---|---|
| `MpiDropdown` | 8 | **GAP — fixed.** 13 callers |
| `MpiTreePicker` | 7 | **GAP — fixed** |
| `MpiStylePicker` | 5 | **GAP — fixed** |
| `MpiOptionSelector` | 2 | **GAP — fixed** (3 variants, one `_positionPopup`) |
| `MpiSlideOver`, `MpiColorPicker`, `MpiToast` | 0 | Clean — draw no accent at all |
| `MpiStartingComfy` | yes | Correct as cream — engine startup is about no media |
| `statusBar`, `downloadService`, `generationService` | — | TOASTS. Status colours by decision (2026-09-18), never family |
| `mediaActions`, `MpiGroupHistoryBlock` | — | A download `<a>`. Invisible |
| `mentionPicker` | — | An offscreen measurement mirror |
| `js/pages/components.js` | — | The dev component gallery, not a user surface |

**The fix is ONE helper, not four labels** — `inheritAccent(portalEl, anchor)` in
`js/utils/dom.js`, called from each picker's existing position/open function, where the
trigger rect is already being read. Labelling callers was the wrong shape: `MpiDropdown`
alone has 13, and the same instance reopens in different workspaces, so a baked attribute
would be stale rather than absent. `tests/portal-accent.test.cjs` pins the case that
catches: reopening under NO accent must CLEAR the old one, not keep it.

**Class B — subject ≠ container. SWEPT 2026-09-19. Two of its four rows were already
correct; the old survey had never opened the files.**

| Surface | What it actually draws | Verdict |
|---|---|---|
| `MpiWaveform` | `var(--accent-audio)` **directly**, ×2 | **Already right.** A waveform is permanently about audio, so it is hard-bound on purpose, not inheriting. Do not "fix" it to `--accent-heat` |
| `MpiAudioPlayer` | no accent at all — `--surface-viewer`, `--ink-1` | **Nothing to do.** It has no accent surface to colour |
| `MpiVoicePicker` | `--accent-heat` ×2 | **GAP — fixed.** `data-accent="audio"`: a voice is audio whatever the Flow makes |
| `MpiMediaPicker` | `--accent-heat` ×3 | **GAP — fixed.** It already had `props.mediaType`; `el.dataset.accent` now follows the SLOT's type, so picking a reference image for a video op reads as an image job |
| `MpiMediaSlot` | `--accent-heat` ×1 (hover border) | **Left alone, deliberately.** It has NO media-type prop — only `label`/`empty`/`canPaste`. Giving it one means threading a prop from two callers to colour a hover border. It inherits the workspace, which is defensible: the slot is part of the tool |

Everything else inside a matching workspace already inherits correctly from `#app-shell`
(`navigation.js:297`), which is why the sweep is this short.

**Noticed, not actioned — the `image → vision` map is now written out FIVE times**
(`navigation.js:297`, `MpiBaseFlow.js:215`, `MpiPromptBox.js:1984`, `getOpHelp()`,
`MpiMediaPicker`). It wants one helper next to `inheritAccent`. Not done here: three of the
five sit under other cards' live claims, and converting two of five is worse than five.

### Round 9 — BUILT, AWAITING FABIO'S EYE (2026-09-19, session 8abe87b4)

Three dialogs now state their subject; NO stylesheet changed — every one already drew from
`var(--accent-heat)`, so the attribute alone does it.

- `MpiEnhanceDialog` + `MpiReusePromptDialog` → `data-accent="prompt"`, static, on the
  template root (same form as `MpiSettings.js:152,194`).
- `MpiOpHelpDialog` → dynamic. `getOpHelp()` now returns `accent` from the OP's own
  `mediaType` and `open()` writes it to `el.dataset.accent`. Done that way, not at the
  PromptBox call site, for two reasons: the op knows what it makes, and
  `MpiPromptBox.js` is inside MPI-822's live claim. Tally: 22 vision, 14 video, 5 audio,
  2 studio (`createGroupFromSelection`, `promoteToNewGroup` — no media type, correctly cream).
- Guard: `tests/op-strip-availability.test.cjs` — every op's accent must be a value
  `01_base.css` actually declares. 24/24, accent-literal guard green, eslint clean.

**THE BLOCKER WAS A PHANTOM.** `MpiEnhanceDialog.css` shows `M` with an EMPTY diff:
`git hash-object` (filtered) equals the HEAD blob `968ace43`; only the working copy's CRLF
differs (`i/lf w/crlf`, `core.autocrlf=true`). No peer content exists in it, no claim names
it, and round 9 never needed to touch it. Do not "coordinate" over it again.

**`MpiMediaDropOverlay` needs NOTHING** — the survey row below is wrong. It is NOT
body-portaled: both mounts append inside their Block (`MpiGalleryBlock.js:237`,
`MpiGroupHistoryBlock.js:1546`), so it already inherits — cream in the gallery (several
types), the group's colour in a workspace. `MpiChangelogDialog` stays cream by the rule.

**SETTLED 2026-09-19 (Fabio): the "?" guide keeps its OP's colour.** *"leave the ? guide
fine as it is."* It was offered as a one-line switch to Prompt yellow on the reading that
"How to prompt" is a surface about text; he declined. `getOpHelp().accent` stays. Do not
re-raise it.

NOT verified in pixels by the agent — no isolated instance was booted for three attributes;
the `[data-accent="prompt"]` rebind itself is round 8's verified mechanism. Verify mode is
`user-ux`: a renderer RELOAD picks the edits up, uncommitted.

NEXT after his yes: commit the 5 files by pathspec, then `validation.md` § Round 8's survey
— `MpiAudioPlayer`/`MpiWaveform` in a non-audio Flow, `MpiVoicePicker`, per-type media slots.

### Round 9 — the original survey (Fabio, 2026-09-19)

He named this closing round 8, with the Enhance Prompt dialog as the example: *"this pop-up
should already be addressed by now, it should have the prompt colours."*

**The structural reason they are ALL cream, and it is cause #5 on the list below.** Every
dialog self-portals to `document.body` (`MpiModal.js:63,70`; `MpiPopup` likewise), so it
inherits from `:root`, NOT from its opener. A dialog can therefore never pick its subject up
from the workspace — **each one must set `[data-accent]` on itself.** That is one line per
dialog, not a system.

Surveyed, none of these declares an accent today (`MpiRadialMenu` is the only overlay that
already rebinds):

| Dialog | Subject → accent | `--accent-heat` uses |
|---|---|---|
| `MpiEnhanceDialog` | text → `prompt` — **Fabio's named example** | 1 |
| `MpiReusePromptDialog` | text → `prompt` | 4 |
| `MpiOpHelpDialog` | depends on the op it documents — likely dynamic | 2 |
| `MpiChangelogDialog` | no media subject → stays cream | 2 |
| `MpiErrorDialog`, `MpiContextMenu`, `MpiCompareOverlay` | none; already accent-free | 0 |
| `MpiMediaDropOverlay` | the slot's declared type → dynamic | 2 |

**`MpiEnhanceDialog.css` carries a PEER's uncommitted work** — it was already modified at
this session's start and is not ours. Coordinate or wait; do not clobber it. That is the one
real blocker in round 9.

Then keep going down `validation.md` § Round 8's survey: `MpiAudioPlayer` and `MpiWaveform`
in a non-audio Flow, `MpiVoicePicker`, per-type media slots. Everything inside a matching
workspace already inherits correctly from `#app-shell` (`navigation.js:297`) and needs
nothing.

Also still open: the **element card** (several media types on one card) takes Studio cream —
Fabio's heads-up, not built, not carded; the `ASSET_KINDS` row already has the field for it.

### What the sweep taught, and will teach again

Every round so far was a STRUCTURAL cause, never a colour question. Check these before
theorising about a value:

1. **`#controls-mount` is a SIBLING of `#tool-container`** (`index.html:158`), and
   `MpiGroupHistoryBlock` mounts the video bar, the GIF bar AND the frame strip into it.
   That is why the accent binding lives on `#app-shell`.
2. **An icon button is never `primary`.** `MpiButton.js:74` maps every icon button that is
   not danger/ghost down to `secondary`. CUE mounts `variant: 'primary'` and has always
   rendered as an outline.
3. **`.mpi-ibtn__label` pins its own `color`** (`--ink-2`, with an ink-1 hover ladder), so
   a button's `color` recolours its ICON (currentColor) and not its WORD.
4. **A ghost ICON button is `.mpi-btn.mpi-ibtn.mpi-btn--ghost` at 0,3,0 pinning `--ink-3`**
   — not the plain `.mpi-btn--ghost` at 0,1,0 pinning `--ink-2`. A 0,2,0 override loses,
   and loses SILENTLY: the label goes coloured and the glyph stays grey.
5. **A `document.body`-appended child inherits from `:root`, not from its opener.** The
   PromptBox settings popup needed the attribute set on it directly.
6. **Measure contrast off rendered pixels.** `getComputedStyle` returns `oklch(...)` and
   canvas `fillStyle` silently REJECTS oklch, returning `#000000` — every ratio comes back
   1.00:1 and looks like a bug in the CSS. Screenshot + sharp, sample the pixel.
7. **A `ghost` icon button's toggled state is COLOUR ALONE** (`MpiButton.css:308-312`) —
   no border, no fill. Against the shared cream that is invisible, and it reads as "the
   accent is wrong" when the real answer is "this button should not be ghost". The
   non-ghost toggle (`:276-280`) already fills with the accent and blackens the icon.

## The mechanism (already shipped, just not applied widely)

Components read ONE action token, `--accent-heat`; a subtree redefines it. MPI-774 shipped
this twice — `MpiAgentChat.css:17` and `MpiPromptBox.css:146` both rebind `--accent-heat`
to `--hub-accent` for their subtree. `styles/shell/landing.css:122-152` does the same shape
with `--crew-accent` per crew member. Phase 3 generalises that, it does not invent it.

`--accent-heat` keeps its name. 239 uses across 68 files; a rename is churn for no behaviour
change, and the token's meaning ("the action colour here") is already right.

## Decisions

- **2026-09-15 (Fabio) — Studio owns no hue.** Shared surfaces draw actions in ink; each
  workspace rebinds the action token to its character's colour. `--hub-accent` is identity
  only. See `brief.md`.
- **2026-09-18 (Fabio) — `--accent-warn` moves, `--video-accent` stays.** Identity beats
  status.
- **2026-09-18 (Fabio) — status colours stay status colours, and they live on toasts.**
  Green success, red failure, yellow warning. `--accent-ok` does NOT move; green already
  appears elsewhere in the app and the audio-green proximity is accepted. Warning yellow
  must read as distinct from video's orange.
- **2026-09-18 (Fabio) — every character accent drives live surfaces**, keyed by what is
  happening. Rules in phase 3.
- **2026-09-18 (Fabio) — `--accent-err` is a REAL RED.** It was born at `--accent-heat`'s
  exact rose only to keep phase 1 provably zero-delta. That was scaffolding; it comes down
  in phase 2a. *"the error accent should be red, not pink."*
- **2026-09-18 (Fabio) — general buttons stop being pink and take the STUDIO MASCOT
  COLOUR.** *"all the buttons that are general buttons should stop being pink and gain the
  studio mascot colour. Well, you know what colour I mean."*

  **This refines the 2026-09-15 decision and reverses one of its rules.** 2026-09-15 said
  shared surfaces draw actions in **ink** (`--ink-1`) and that `--hub-accent` is identity
  only, *never* an action colour — and it gave a reason: cream at chroma 0.028 sits right
  next to `--ink-2`, so used as the accent it makes ordinary body text read as the accent.
  Fabio has now asked for Studio's colour on general buttons anyway.

  **ANSWERED 2026-09-18 — `--hub-accent` cream `oklch(0.78 0.028 80)`.** Fabio picked it off
  rendered swatches. The mascot art was sampled to settle it: `Studio-Logo.png` is 39.7%
  `#c1b6a4` = `oklch(0.780 0.028 80.2)`, i.e. `--hub-accent` to three decimals. (He also said
  "hub accent green" — that is the AUDIO mascot, `#70e2c5`. Studio is beige.)

  The 2026-09-15 objection stands and is accepted, not refuted: 122 of the 246
  `var(--accent-heat)` lines are `color:`, and cream at chroma 0.028 sits beside `--ink-2`'s
  0.012 on the same hue. **Watch accent TEXT when the flip lands, not the buttons** — the
  buttons were never the risk. `oklch(0.82 0.07 80)` is the fallback if it reads too close to
  ink; Fabio saw that swatch too and did not take it.

## Phase 1 — make the token honest (target: zero visual delta) — 1a + 1b DONE 2026-09-18

Every replacement resolves to the colour that renders today. One deliberate exception,
called out below. This phase is the prerequisite for phase 3: a literal cannot follow a
rebind.

### 1a. Danger is not the action accent

`MpiButton.css:76` says it outright — *"danger — same heat fill (semantic alias)"*. Error
and destructive states across the app resolve to `var(--accent-heat)`:

`MpiToast.css:116,149` (the danger dot and progress) · `MpiButton.css:77` ·
`MpiBadge.css:52` · `MpiIcon.css:57` · `MpiInput.css:62,66,70` · `MpiProgressBar.css:49` ·
`MpiContextMenu.css:45,49` · `MpiErrorDialog.css:10` · `MpiLevelMeter.js:54` ·
`MpiEngineInstall.css:63` · `MpiStartingComfy.css:81` · `MpiPromptBox.css:713`

Left alone, phase 3 turns a failure toast **orange inside the video workspace** and
**yellow during a prompt enhance** — exactly what the 2026-09-18 toast decision forbids.
Fix: `--accent-err` born in `01_base.css`, initially at today's exact value
`oklch(0.76 0.17 355)` so the phase stays provably zero-delta; every danger/error site
above points at it. Re-hueing it to a truer red is phase 2, judged by eye.

### 1b. ~33 hardcoded pinks onto the token

Re-grepped 2026-09-18; the brief's line numbers had drifted.

- `MpiButton.css:58,59,85,86,282,283` — an *older* pink `oklch(0.78 0.20 6)`, the hover
  lift. **The one deliberate visual change:** becomes
  `oklch(from var(--accent-heat) calc(l + 0.02) calc(c + 0.03) h)`, which keeps the lift
  and drops a legacy 11° hue rotation.
- Alpha glows and fills, literal `oklch(0.76 0.17 355 / a)` →
  `color-mix(in oklab, var(--accent-heat) N%, transparent)`:
  `styles/shell/base.css:26` · `styles/shell/components.css:46,47,60,61` ·
  `styles/shell/titlebar.css:44` · `styles/shell/workspace.css:140` ·
  `styles/01_base.css:321-326` (the `neonPulse` keyframe) ·
  `MpiMemoryMonitor.css:123,128,129` · `MpiAbout.css:22` · `MpiStartingComfy.css:28` ·
  `MpiHistoryList.css:53` · `MpiCanvasViewer.css:51,63`
- `MpiReusePromptDialog.css:72,73` — falls back to a literal behind `--accent-heat-hi`,
  which is defined nowhere in the repo, so the fallback is always what renders. Drop the
  dead var, use the same relative expression as the button hover.
- **NOT touched:** the paint default `#e0446b` (`MpiToolOptionsPaint.js:38`,
  `MpiToolOptionsMaskAdjust.js:56`, `MpiStepPaint.js:97`, `PaintManager.js:52`). It is a
  brush colour, not the accent — decided separately.

`color-mix(in oklch, …)` is forbidden here: the hue interpolates, and the surface family at
350 against audio at 170 is antipodal, so the mix walks through yellow. Use `oklab`.
Precedent: `MpiWaveform.css:45`.

### 1c. Canvas constants — DONE + VERIFIED BY FABIO 2026-09-20

**Phase 3 answered the blocker, so it unfroze.** `styles/01_base.css:210-229` is the
rebind engine, `:root --accent-heat` is already Studio cream, and `navigation.js:297` sets
the attribute on the app shell — which is above every canvas. `ctx.canvas` was the guess
below and it is now provable.

**One helper, not five constants:** `accentHeat(el)` in `js/utils/dom.js`, beside
`inheritAccent`. It reads `--accent-heat` off the element at DRAW time and falls back to
the rose when the element computes nothing (a detached overlay during teardown). No cache:
one property read per draw, and these paths paint into a canvas rather than dirty the DOM,
so `getComputedStyle` forces no recalc. A `ponytail:` comment names that ceiling.

**`brushDab.js` stayed DOM-free** — `tests/brush-presets.test.cjs:3` pins it. The accent
arrives as `opts.accent`; `BRUSH_CURSOR` is now the fallback for a caller that passes none.
Shared primitive, so all THREE `drawBrushRing` callers pass it: `MpiCanvas.js:1198`,
`MpiStepCutout.js:305`, `MpiStepPaint.js:397`. The eraser deliberately ignores it — frost
is a TOOL signal and must not follow the workspace; a test pins that.

**The row was smaller than the list.** Seven line numbers, five live literals: `MpiCanvas`
`:22,28` are `--accent-ok` green (already noted below) and `:18` `BRUSH_DOT` was DEAD.
Deleted rather than converted — phase 1's verify grep fails on a dead literal just as
loudly as a live one. `getCSSColor` at the old `:95` is still dead and still left alone.

**The grep does not reach zero, by design:** two `oklch(0.76 0.17 355)` remain in `js/`,
`dom.js`'s `ACCENT_HEAT_FALLBACK` and `brushDab.js`'s `BRUSH_CURSOR`. Both are documented
fallbacks, and `brushDab` cannot import the other one without acquiring the DOM dependency
its test forbids.

The 2026-09-18 reasoning that froze it, kept because it is what the answer was checked
against:

- `brushDab.js` is pinned DOM-free by its own test — `tests/brush-presets.test.cjs:3`
  says so in a comment: *"brushDab.js never touches `document`: it draws into a context
  it is handed"*. So its ring colour has to arrive from the caller, not be read inside;
  `BRUSH_CURSOR` is an exported const that `MpiCanvas.js:1124,1133` also uses.
- `getComputedStyle` in a per-frame draw path forces a style recalc, so any read needs
  a cache, and cache invalidation depends on whether a mounted surface can change its
  accent — which is a phase 3 question.
- `ctx.canvas` is the element every one of these draw methods already has in hand, which
  is very likely the answer; it just should not be committed to before the rebind exists.

The five that moved: `js/utils/cropTool.js` `HANDLE_FILL` · `MpiCanvas.js`
`MASK_POINT_NEGATIVE` + the comparison slider · `ShapeManager.js` `SHAPE_HANDLE_FILL` ·
`CropManager.js` `CROP_HANDLE_FILL` · `brushDab.js` `BRUSH_CURSOR`.
`MpiCanvas.js:22,28` are `--accent-ok` green, not pink, and stay literals.

**Noticed, not actioned:** `MpiCanvas.js:18` `BRUSH_DOT` and `MpiCanvas.js:95`
`getCSSColor` are both dead — defined, never referenced. Pre-existing, left alone.

**Verify phase 1:** `grep -rn "0\.76 0\.17 355" js/ styles/` returns only the token
definitions in `01_base.css` · lint touched files individually (whole-tree lint is red on a
peer's uncommitted `js/shell/navigation.js:398`) · `npm test` · pixel check in an isolated
app: shell glow, titlebar, history row, crop handle, primary-button hover, a danger toast.

## Order (chosen 2026-09-18, Fabio left it to the agent)

2a first — it is small, isolated, already decided, and visible everywhere. Then 3+4 as one
change. Phase 1a is what makes that flip safe: every error and destructive surface is
already off the action token, so recolouring the token cannot recolour a failure.

## Phase 2 — move the status hues (visible; Fabio judges by eye)

- ~~`--accent-err` to a truer red~~ **DONE 2026-09-18** — `oklch(0.70 0.19 27)`, verified in
  the live app. Value derivation + the "Stop is not danger" follow-on in `validation.md`.
- `--accent-warn` off hue 60 — **still open.** It is squeezed: video orange at 48 on one
  side, prompt yellow at 102 on the other. Needs his eye, not a calculation. Note `--accent-err`
  has since landed at 27, so warn is now boxed on three sides, not two — lightness separation
  may beat hue here.
- `--accent-ok` stays. Decided.

## Phase 3 + 4 — ONE change now (collapsed 2026-09-18)

Fabio's "general buttons take Studio's colour" is the same lever as the rebind engine, from
the other end. The shared-surface answer IS the `:root` default:

```css
:root { --accent-heat: <Studio's colour>; }   /* every shared surface, by default */
[data-accent="vision"] { --accent-heat: var(--vision-accent); }   /* …and a workspace overrides */
```

So there is no separate "phase 4 — shared surfaces in ink": setting the root default and
adding the per-workspace overrides is one coherent edit, and doing them apart would mean
recolouring the whole app twice. The docs rewrite stays a tail task.

**Size warning:** `--accent-heat` has 239 uses across 68 files. Flipping the root default
recolours the entire app in one commit — that is the big visible moment of this card, and
the moment to have Fabio watching. Check `.mpi-btn--primary`'s text colour when it lands:
it is `oklch(0.16 0.02 0)` dark-on-rose today, which still works on cream but wants an eye.

### The engine and the surfaces

One rule block, one attribute, everything else is a data binding:

```css
[data-accent="vision"] { --accent-heat: var(--vision-accent); }
[data-accent="video"]  { --accent-heat: var(--video-accent);  }
[data-accent="prompt"] { --accent-heat: var(--prompt-accent); }
[data-accent="audio"]  { --accent-heat: var(--accent-audio);  }
[data-accent="studio"] { --accent-heat: var(--hub-accent);    }
```

Surfaces that set it (Fabio, 2026-09-18):

- **Progress / status bar** — the accent of the task ahead. Prompt enhance → prompt,
  video generation → video, and so on.
- **Image workspace, GIF workspace** → vision. **Video history workspace** → video.
- **Flows** — by declared output: image output → vision, video output → video. Multiple
  outputs → fall back to the media type of the model in use.
- **Prompt box** — the *selected model's* type colour across the whole box, not just the
  name: model name, model-selector button and border, settings, queue, stop, and the
  selected option. Image model → rose, video model → orange.
- **Enhance button** → prompt accent, always.
- Fabio: *"pretty sure there are more places"* — sweep every `var(--accent-heat)` consumer
  by surface before calling this done, do not work only from this list.

The existing `MpiAgentChat` / `MpiPromptBox --col--mode` rebinds to `--hub-accent` fold
into the same block.

## Phase 3+4 — the sweep (IN PROGRESS)

Fabio walks the app and names surfaces a round at a time. Five rounds are done and
signed off; round 6 is implemented and waiting on his eye.

### Round 6 — DONE, awaiting Fabio (2026-09-19)

Both overlay jobs below, plus the gallery **info toggle** he named mid-round: clicking it
went studio cream, which is a hair off `--ink-2`, so on and off read the same.

**The cause was the VARIANT, not the colour.** `MpiButton.css:308-312` — a `ghost` icon
button's `is-active` is *colour alone*: transparent background, transparent border. That
worked while the accent was rose and stopped working the moment the shared accent became
cream. Both the info and archive toggles were `variant: 'ghost'`. Dropping it (→ the
default `secondary`) gives them `MpiButton.css:276-280`, the treatment every other
toggleable icon button in the app already has: bordered at rest, accent fill with a black
icon when on. Archive's bespoke `.is-active` rule came out with it — it existed only to
give a ghost button a loud state, and at 0,2,0 it would now lose silently to the
primitive's 0,4,0. **A seventh structural cause for the list below.**

**The overlay's player swap forced a TIER MOVE, Fabio's call.** `MpiAudioRecorder` was a
Compound and `MpiAudioPlayer` is an Organism, which `mpi/no-same-tier-component-import`
forbids — and `npm run lint` is `--max-warnings=0`, so it is red CI, not a nit. There is
no cheaper rung: an Organism may not import an Organism either, and the player cannot drop
to Compounds because a Compound importing a Compound is *also* blocked. Blocks is the only
tier that may import an Organism, so the folder moved to
`js/components/Blocks/MpiAudioRecorder/`. Same depth, so not one internal import changed.

One line could NOT be written: `types.js:1587`'s typedef still says
`(Compound — js/components/Compounds/MpiAudioRecorder)`. It sits inside MPI-771's live
claim `e48d9b11`, so it was messaged (`bb5f6817`), not edited — the same shape this card
already used for the Stop-button twin. Nothing tests it, so it is docs drift, not a red
build.

**Two jobs, both on the record-audio overlay** (Fabio, 2026-09-19):

1. **Its colours are wrong — it should be AUDIO.** `MpiAudioRecorder.css:12,40,41` read
   `--accent-heat`, so on a shared surface the overlay renders Studio cream. Rebind the
   token on `.mpi-audio-recorder` exactly as `MpiGalleryToolbar.css` does for the volume
   slider — `--accent-heat: var(--accent-audio)` plus the restated `--accent-heat-hi`.
   The ACCEPT button is a filled `primary` and follows for free.
2. **It must use OUR player, not the browser's.** `MpiAudioRecorder.js:223` builds
   `ce('audio', { src: URL.createObjectURL(_blob), controls: true })` and drops it into
   `#playback-slot`. Replace with `MpiAudioPlayer` (Organism). **The fact that makes this
   cheap:** its `mask` prop (a baked waveform) is OPTIONAL and its own header says *"a
   maskless player still scrubs"* — a just-recorded clip has no baked waveform, so `src`
   + `duration` is enough. It owns ONE `<audio>` and `src` is set once, never re-pointed,
   so **Re-record must destroy the instance and mount a fresh one**, not re-point it
   (MPI-727). Destroy it on `cancel`/`accept` too — `destroy()` pauses and unbinds.
   Watch `hotkeys`: it answers SPACE/M by default, and the overlay is a modal with its
   own Escape handling.

**Settings — Fabio asked whether this could be worked out without being told. It can.**
Settings is a `LandingPages/` surface, reached from the landing page, which is the HUB —
Studio's own screen, the one whose mascot "runs the crew". A shared surface takes `:root`'s
default, and that default is now `--hub-accent`. So Settings is **Studio cream, and it
already renders correctly** — nothing to change. The one row worth raising with him is
*"Play sound on notification"*: by the rule just applied to Record and the volume slider,
an audio control wears `--accent-audio`. That is a question, not an assumption.

### Round 7 — the kind chip. BUILT 2026-09-19, awaiting Fabio's eye

He named "the card icons" as he signed off round 6 without saying which, and the survey found
FIVE icon families on a card, not two. Asked; he picked the kind chip and widened the job:
colour it, and give audio and images one too. Details and the accent map are in
`validation.md` § Round 7.

**Still open, and it was the other candidate.** The card mark (`MpiGalleryGrid.js:519`,
`variant: 'ghost', toggleable: true`) is round 6's trap verbatim and the survey found it is
actually INVERTED: unmarked wears a chip background, border and `--ink-1`
(`MpiGalleryGrid.css:410-417`), and marking it *removes* that chip
(`:426-429`) leaving `--accent-heat` alone on the thumbnail (`MpiButton.css:308`). So a
marked card reads weaker than an unmarked one. That worked while the accent was rose. Fabio
has not been asked to judge it yet — raise it, do not just fix it, because the mark's whole
point is scanning a grid and the fix changes how a marked card looks.

The three other families are fine as they are: notes and reuse carry a chip background with
`--ink-1`; continue / finish / cancel mount `primary` and render as outlines (structural
cause #2).

Then: keep sweeping. The remaining known gaps are phase 1c's canvas constants, the
progress/status bar's "accent of the task ahead" (the `tool:*` events carry no
`mediaType`, so the EMITTERS have to change — this is the one genuinely non-trivial
piece left), and whatever Fabio finds next.

## Phase 4 — shared surfaces in ink, and the docs

Landing, Model Library, settings, queue, and any dialog not tied to one media type: primary
action filled `--ink-1` with dark text, emphasis from value not hue (2026-09-15 decision).
Then rewrite `DESIGN.md` and `PRODUCT.md`, which still describe one pink accent at a stale
value (`oklch(0.72 0.20 6)`), a VT323 wordmark (the code uses Russo One) and a single
mascot.

## Verification

**Verify mode:** user-ux — colour is judged by eye, in the app.

Phase 1 is the exception: it is mechanically provable zero-delta and self-verifies on the
grep + lint + `npm test` above, with the button hover the single thing to look at.

## Constraints

- Shared tree, live peers. Commit by explicit pathspec, never `git add -A`.
- **Do not push.** master's CI is red (MPI-774, `tests/desktop/agent-chat.spec.js:654`) and
  the tree holds unpushed peer commits. Commit locally, wait for green.
- `styles/01_base.css` sits inside MPI-774's file claim. Heartbeat was 225 min stale
  against a 120 min timeout at session start, and the file is committed clean.
- Fabio's live app runs from this tree — renderer edits show on his next reload. Never
  touch `:3000`; use `npm run app:isolated` on its own port and profile.

## Plan Drift

- 2026-09-18: plan created. Brief's token table was stale — the family tokens landed with
  MPI-766/MPI-774, so phase 1 is no longer blocked on adding them.
- 2026-09-18: phase 1a (`--accent-err`) added. Not in the brief's work items; found by
  grep while scoping 1b. Danger being an alias of the action accent is the one thing that
  would have made phase 3 wrong on every surface.
- 2026-09-18: the `DESIGN.md` token port was pulled forward out of phase 5. It was never a
  phase-5-shaped job — Fabio has asked three separate sessions for it, and `DESIGN.md` was
  carrying a pink (`oklch(0.72 0.20 6)`) that had not existed in the code for a long time.
  `PRODUCT.md` stays in phase 5: it holds no values, only prose.
- 2026-09-18: "Stop is not danger" folded in, Fabio's call. Not in any phase — it surfaced
  from him asking whether the app even has red buttons. Answer: four, one destructive. Half
  of it is blocked on MPI-771's live claim, so this card ships an inconsistency on purpose
  and `validation.md` records it.
- 2026-09-19: round 7 grew a second job the plan did not have. It was scoped as "colour the
  card icon"; Fabio also asked for a chip on image and audio cards, reversing `assetKinds.js`'s
  own stated rationale that an unmarked card means "just a picture". Folded in rather than
  carded — one column in one table, and splitting it would have shipped the colour onto two
  of five kinds.
- 2026-09-19: a future card type recorded, NOT built and deliberately not carded — an
  **element card** holding several media types takes Studio cream. Fabio flagged it as a
  heads-up while closing round 7. The `accent` column is where it will go.
- 2026-09-20: **phase 1c unfroze.** It was moved to phase 3 on 2026-09-18 for one stated
  reason — "the correct plumbing is decided by phase 3, not guessed twice". Phase 3 has
  since shipped the `[data-accent]` rebind engine, so the plumbing is decided and the file
  the 1c note guessed at (`ctx.canvas`) is the one that works. Nothing about the phase
  changed; its precondition arrived.
- 2026-09-20: 1c's "seven lines" was really five. Two are `--accent-ok` green and one
  (`BRUSH_DOT`) was dead — the fifth session in a row where an inherited survey row cost
  more to believe than to open. The lesson under "What the sweep taught" holds.
