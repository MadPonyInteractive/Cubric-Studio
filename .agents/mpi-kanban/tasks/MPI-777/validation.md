# MPI-777 Validation

## Phase 1 - the staged clips (2026-09-21)

`scripts/stage-mascot-clips.mjs` + 95 clips under `assets/mascot/{key}/*.webm`, 13.7 MB.
Nothing consumes them yet - `_poseSrc` still returns the `.webp` stills, and pointing it at a
clip is Phase 3. So this phase closes on the asset checks below, not on a UI.

### What ran

- `node scripts/stage-mascot-clips.mjs` - 95 of 103 manifest rows staged, 8 skipped as the
  documented spares. Every staged file decodes; alpha present on all 84 cut-out clips and absent
  on all 11 transitions, which is correct (they composite with `mix-blend-mode: screen`).
- `node scripts/stage-mascot-clips.mjs --verify` - **rim check passed on every staged clip**,
  worst delta -0.06 against tolerance +1.00.
- `eslint scripts/stage-mascot-clips.mjs` - clean.
- Real Electron, five staged clips at the landing's 360px draw height: all five playing
  (`paused:false`, `currentTime` advancing, `videoWidth` 620), and pixels inside each video's box
  read exactly `30,30,34` - the page background through the alpha.

### The rim, which Fabio caught by eye and no check was looking for

The first encode put a faint light outline around every character. Worth recording because the
obvious diagnoses were all wrong:

| tried | ring luminance (bg 30.00) | verdict |
|---|---|---|
| first encode, `scale` then vp9 | 36.69 | the rim |
| crf 20 instead of 32 | 36.46 | not the bitrate |
| `yuva444p` (no chroma subsampling) | - | encoder refuses it without `-strict experimental` |
| **`premultiply` → `scale` → `unpremultiply`** | **29.72** | fixed, and 0.221 -> 0.200 MB |

Scaling **straight** alpha interpolates RGB across the silhouette boundary, so body colour lands
in pixels that should be fully transparent; any alpha softness then reveals it. It is a resize
bug, not a codec one - which is why more bitrate did nothing.

### The first version of the guard was wrong in a way that read as two failures

An absolute threshold ("ring must sit at the background") flagged `prompt/working` (32.64) and
`studio/peek` (31.73). Both were fine. Downscaling legitimately produces antialiased edge pixels
carrying the character's own colour, so a light-edged mascot reads **above** the background and a
dark-edged one below (`vision/getting-ready`, 28.49). The check now compares against a reference
downscale of the same frame through sharp, which premultiplies; every staged clip lands 0.15-0.40
**below** its reference.

Chasing that also produced a wrong intermediate result worth not repeating: the first comparison
used `gif_6f1eec7e` as "Prompt's Working", which is Video's. Resolve a clip's source through the
staging script's own dry run, never by eye from the manifest table.

**The guard was proven red.** `vision/idle-1` re-encoded without the premultiply step: `--verify`
reported `rim +7.26 over a correct downscale` and exited 1. Source restored byte-identical
(sha256 `dd3fa438...`) and the check went green again.

### VRAM, because the format decision turned on it

Fabio's challenge - video must be heavy on VRAM, and VRAM is what ComfyUI needs - measured in
real Electron, 5 clips at the landing's draw size, 12 interleaved rounds plus earlier runs:

| | runs | median GPU delta | CPU |
|---|---|---|---|
| empty window (control) | 7 | +7 MiB (-266 … +87) | 0% |
| 5 animated GIFs | 9 | **+305 MiB** (+261 … +350 in 8 of 9) | 0.5% |
| 5 alpha WebM | 10 | **+13 MiB** (-34 … +50 in 9 of 10) | 0.7% |

Chromium holds a decoded animated GIF as GPU textures: 620x620x4 B x ~51 frames x 5 = ~344 MiB
nominal against ~305 measured. Alpha VP9 never reaches the hardware decoder -
`kVideoDecoderName=VpxVideoDecoder`, `kIsPlatformVideoDecoder=false` - so it is decoded in
software and only the frames in flight become textures.

This bears on Phase 3 directly: the queue **preloads a slot's whole pool**, and a mascot's pool is
7 clips. As GIF that is nominally ~2.4 GB of texture cache across five mascots.

Limits of the measurement, stated because the numbers look cleaner than the method: `nvidia-smi`
reports only TOTAL GPU memory on Windows (per-process is `[N/A]` under WDDM) and Fabio's own app
allocates during the runs - that is where both outliers come from.

### Not done in this phase, on purpose

- **The backup was BUILT AND REVERTED, so the single-copy risk is still open.** All 103
  originals were copied into MadPony-Identity and committed (303 MB, sha256-verified); Fabio
  rejected the size, the commit was reset and the copies deleted after re-checking every one
  was byte-identical to a surviving original. The originals were never moved or rewritten -
  103 files, 0.317 GB, confirmed after the delete.

  I had written "the single-copy risk is closed" into four files before he saw the number.
  That was wrong twice over and both corrections are now in `docs/mascot-gif-manifest.md`:
  the 317 MB is genuine rather than a bad export (dither on and off both give 3.94 MB for one
  clip; 78% of opaque 2x2 blocks are non-uniform, because these are an AI model's renders of
  vector art), and the GIFs are a middle step whose own masters - `Cubric Studio Mascots`,
  2.8 GB, 8,373 files - sit on the same single machine. A git commit was the wrong instrument
  and it was aimed at the wrong artefact.
- Nothing is wired. `heroCrew.js` still drives `_poseSrc` directly at the stills.
- Still open and still Fabio's: **Studio has no Failed clip** (`i2v_016` was never rolled), so the
  agent-panel ledge cannot show a failed state while every other mascot can. Two other Studio
  slots are also missing - Happy head pop (`i2v_015`) and landing no projects (`i2v_042`).

## Phase 2 - the shared clip queue (2026-09-21)

Built. `js/utils/mascotClipQueue.js` + `tests/mascot-clip-queue.test.cjs`. Nothing is wired to
it yet, so there is no UI to look at - this phase closes on the unit test the plan asked for.

### What ran

- `node --test tests/mascot-clip-queue.test.cjs` - **8 pass, 0 fail.**
- `npm test` - **1688 pass, 0 fail**, 1 skipped (pre-existing) and 1 todo (MPI-867, red by design). 1690 total.
- `eslint` clean on both new files.

### The shape, and why it is DOM-free

It matches `createPreviewClipPlayer` (`js/services/previewClipPlayer.js`): a factory taking a
`paint` callback, touching no pixels itself. That is what makes the four rules unit-testable at
all, and it is what keeps the queue independent of the format decision - the same queue drives a
still, a GIF or an alpha WebM.

**Driven by a duration clock, never a media `ended` event.** Load-bearing, per Current State: a
GIF in an `<img>` cannot report that it ended, so an `ended` design would work only if the format
went one way and would silently foreclose the other.

### Every guard proven RED on a broken rule, one mutation at a time

A suite covering N rules proves ONE unless each is backed out separately. Each mutation was
applied alone, the matching test run, then the source restored and its sha256 checked.

| Rule broken | Guard | Result |
|---|---|---|
| no-immediate-repeat `while` removed | "never repeats" | RED |
| a waiting request applied at once | "waiting request" | RED |
| play-once no longer hands back to rest | "hands back" | RED |
| interrupt swaps with no transition | "interrupt starts" | RED |
| `destroy` stops clearing timers | "destroy clears" | RED |

Source restored byte-identical after every one (sha256 `6dc764732adbc768...`).

### One guard was ASLEEP, and rewriting it is the real finding

The first `destroy` test asserted "nothing painted afterwards" and **passed under the mutation**.
`_after` already refuses to run its callback once `_dead` is set, so effects are suppressed
whether or not the timers were cleared - the assertion could not see the difference.

What an uncleared timer actually does is worse than a wrong paint: the chain **re-arms itself for
ever and holds the event loop open**, so the process never exits. That is a HANG, not a failure -
no output, no failing test, nothing to read. It happened here for real: the preload test did not
mock timers, armed a live 5s chain, and hung the whole run with an empty output file.

The guard now stubs `globalThis.setTimeout`/`clearTimeout` and asserts every armed id was cleared,
which catches the mutation. `mock.timers` cannot be used for it - the `_dead` flag hides the
symptom from any time-advancing assertion.

### Not done in this phase, on purpose

Nothing is mounted. `heroCrew.js` still drives `_poseSrc` directly; putting the crew on the queue
is Phase 3, and the two ledges are Phase 4. The queue has no consumer until then.

## Phase 3 - the landing hero crew on the queue (2026-09-22)

`js/shell/heroCrew.js` + `styles/shell/landing.css` + `docs/shell.md`. `_poseSrc` and the
`.webp` stills are gone from the landing; each member owns a `createMascotClipQueue` and paints
two stacked `<video>` with a screen-blended transition layer above them.

**Verify mode is `user-ux`, so this phase does NOT close on what follows.** Everything below is
self-verification: it proves the thing runs, tears down and does what the plan asked. Whether the
motion is right is Fabio's.

### What ran

- `npm test` - 1781 tests, 1779 pass, **0 fail**, 1 skipped, 1 todo (both pre-existing).
- `npx eslint js/shell/heroCrew.js js/utils/mascotClipQueue.js` - clean. No stylelint config
  exists in this repo, so the CSS has no linter to run.
- Real Electron, own profile and own port (`node scripts/launch-instance.mjs`, port 57327,
  never :3000), driven with playwright-cli at 1920x1032 past the 18+ gate and the changelog:
  - **Five members, all on clips.** `prompt/idle-1`, `vision/idle-1`, `studio/idle-1`,
    `video/idle-2`, `audio/idle-1`, every one `paused:false` with `currentTime` advancing, and
    the B element of each already holding a different idle - so a swap had already happened
    inside the first few seconds.
  - **Geometry.** Vision's member box measures 195x260 and its video 436x436: 436/260 = 1.677,
    which is the `620/370` the CSS asks for. A screenshot of the landing shows five characters
    standing on the floor line under their labels, neither floating nor shrunken.
  - **Durations are being read, not assumed.** `vision/idle-1` reported `duration` 5.1 where
    `vision/idle-2` reported 5.2 and `video/idle-3` 5.2 - the per-mascot spread that the
    nominal 5200 would have papered over.
  - **Hover interrupts.** A `pointerenter` on Vision: at +700ms the fx layer is playing
    `transition-third.webm` and the mascot underneath has already swapped to `greet-1`
    (`currentTime` 0.31); at +1300ms the fx layer is cleared and paused and `greet-1` is at
    0.92. That is the transition-covers-the-swap rule working end to end.
  - **Click interrupts, and a one-clip pool works.** A click on Studio: fx layer playing,
    `happy-1.webm` live underneath. Studio has no `happy-2` (i2v_015 was never rolled) and the
    queue's `pool.length === 1` path handles it with no special case in heroCrew.
  - **TEARDOWN, the one that hangs a test run if it is wrong.** `HTMLMediaElement.prototype.play`
    wrapped with a counter, then `currentPage` moved off landing: `#heroCrew` empties (0 members,
    0 videos) and **0 `play()` calls in the following 8 seconds**. The timer chain is dead, not
    merely hidden.
  - **Reduced motion.** `matchMedia` stubbed to report `prefers-reduced-motion: reduce`, then
    back to landing: five members mount, each live video holds `currentTime` 0 of an idle clip,
    `paused:true`, and **0 `play()` calls in 9 seconds**. "Shows a first frame and never plays",
    with no separate still path to keep in step.
  - **0 console messages** for the whole session - no errors, no warnings.

### What Fabio has to look at

The landing, at a normal window size:

- The five idles at rest - do they read as alive without being busy, and does the random pool
  avoid looking like a loop?
- Hover a character: a transition should fire *at once*, not after a wait, and the greet should
  appear from under it with no jump.
- Click a character: same, with a happy clip. Studio's is the only one-clip pool.
- The ambient greet every ~3.2s on a resting character - it deliberately WAITS for the current
  idle to finish, so it should never cut one short.
- Sizes and footing: each character the same height as before, feet on the floor line.

### Not done in this phase, on purpose

No walking clips (plan), and the two ledges are Phase 4. Studio still has no `failed` clip, so
Phase 4's agent ledge cannot show a failed state until `i2v_016` is re-rolled - Fabio's.

### Round 2 - Fabio looked at the landing (2026-09-22)

**"The animations look good, and they are well connected."** The queue, the pools, the swap
timing, the sizing and the footing are ACCEPTED. What follows is what he asked to change.

- **Hover must not play a transition; only a click does.** Done in this session. The queue
  gained a per-request `transition` flag (`request(name, { interrupt: true, transition: false })`)
  so a hover still cuts the idle short - it must not wait up to 5s - but lands straight on the
  greet. Click keeps the overlay. New unit test `a bare interrupt cuts straight to the clip and
  never plays a transition`, **proven RED** on the previous queue (fail 1) and green after
  (9/9). `npm test` 1786 / 1784 pass / 0 fail. Re-checked in a fresh isolated instance
  (port 50161): hover moved Vision `idle-1 -> greet-2` with the fx layer never lit, and a click
  on Studio still played `transition-third` on the fx layer.
- **The transition overlay paints a BLACK SQUARE.** Confirmed, and it is not a missing step:
  the overlay clips are opaque VP9 rendered on black and depend on `mix-blend-mode: screen` to
  drop it. Measured on the frozen frame: computed `mix-blend-mode` really is `screen`, the
  parent's `isolation` is `auto` and its `opacity` 1, and forcing `isolation: isolate` on
  `.mpi-landing__crew-float` changed nothing. Chromium promotes a `<video>` to its own
  composited layer and skips the blend. **Handed to a new session** - see the handoff.
  The likely fix is to stop depending on the blend at all: re-encode the 15 transitions with an
  alpha plane derived from luma, in `scripts/stage-mascot-clips.mjs`, which currently detects
  them as opaque and strips the alpha on purpose. Alpha VP9 already composites correctly here -
  that is what every mascot clip is - so the mascots themselves are the proof. It also keeps
  the soft smoke edges, which is the reason `screen` was chosen over a cut-out.
- **Also handed over:** the crew labels should carry the mascot NAMES (Cosmo, Lingo, Prism,
  Reel, Vinyl - MPI-846), and the landing's agent area should lose the Prism mascot and the
  "Ask me anything" lettering, with Cosmo peeking over the rule and the input moving up to it.
