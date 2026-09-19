# MPI-736 — Per-media-type accent family

Brief: `brief.md`. Source of truth for values: `c:\AI\Mpi\Cubric Studio (Website)\styles\landing.css`.

## Current State

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

Next action: the record-audio overlay (two jobs, `## Phase 3+4 — the sweep` below).

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

### 1c. Canvas constants — MOVED TO PHASE 3 (2026-09-18)

Not done here, and deliberately. Moving these buys nothing visible until a rebind
exists, and the correct plumbing is decided by phase 3, not guessed twice:

- `brushDab.js` is pinned DOM-free by its own test — `tests/brush-presets.test.cjs:3`
  says so in a comment: *"brushDab.js never touches `document`: it draws into a context
  it is handed"*. So its ring colour has to arrive from the caller, not be read inside;
  `BRUSH_CURSOR` is an exported const that `MpiCanvas.js:1124,1133` also uses.
- `getComputedStyle` in a per-frame draw path forces a style recalc, so any read needs
  a cache, and cache invalidation depends on whether a mounted surface can change its
  accent — which is a phase 3 question.
- `ctx.canvas` is the element every one of these draw methods already has in hand, which
  is very likely the answer; it just should not be committed to before the rebind exists.

Still frozen, still listed for phase 3: `js/utils/cropTool.js:34` ·
`MpiCanvas.js:18,22,23,28` · `managers/ShapeManager.js:38`, `CropManager.js:29`,
`brushDab.js:320`. `MpiCanvas.js:22,28` are `--accent-ok` green, not pink.

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

## Phase 3+4 — the sweep (IN PROGRESS, this is the next action)

Fabio walks the app and names surfaces a round at a time. Five rounds are done and
signed off. **Two jobs are open, both on the record-audio overlay** (Fabio, 2026-09-19):

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
