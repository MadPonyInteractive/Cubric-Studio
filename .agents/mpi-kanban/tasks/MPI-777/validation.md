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

### Round 3 - Phase 3b: the overlay composites, the names land, Cosmo takes the rule (2026-09-22)

Session `5a4e6dea`, resumed from handoff `d148ec27`. Verify mode is still `user-ux`, so this
round does NOT close the phase - everything below is self-verification.

#### The cut-off report, measured first and NOT fixed

Fabio, on resuming: *"some have different lengths in seconds, and they're being cut off before
they finish. The animation should play till the end before the next animation starts playing."*

Measured in a live instance (own profile, own port 57931, never `:3000`) with a 40ms poll that
records a clip's `currentTime` and `duration` at the moment it is replaced:

| path | clip | played | cut |
|---|---|---|---|
| idle loop, all five | idle-1/2/3 | 5.2/5.2, 4.1/4.1, 5.1/5.1 | **0** |
| ambient greet | greet-1/2 | 3.0/3.0 | **0** |
| click -> happy | happy-1 | 3.0/3.0 | **0** |
| transition overlay | transition-third | 0.89/0.9 | 0.01 |
| hover -> greet | idle-2 | 0.14/5.2 | **5.06** |
| click -> happy | idle-2 | 2.54/5.2 | **2.66** |

So no clip is cut by a wrong length: `_warm` is reading the real per-clip durations and every
clip that is allowed to finish finishes. The only two cuts are the deliberate interrupts. The
click's is hidden under the overlay - which was the black square, so it hid nothing. The
hover's is naked, and that is what reads as "cut off".

That fork was Fabio's, because waiting is exactly what he ruled out on 2026-09-22 ("it must not
wait up to 5s behind an idle"). His call: **"It's fine if it just cuts into the greeting
animation right away. No worries. Just no transition. Otherwise, it's explosions everywhere."**
So hover keeps its bare interrupt and **no code changed for this report**.

One thing found and deliberately left: the queue runs its FIRST clip on the nominal length
(5200) until `loadedmetadata` lands, so a mascot whose first draw is a short clip (vision
`idle-3`, 4.1s) holds its last frame up to 1.1s longer. That is a hold on the rest frame every
clip opens on, not a cut, and it happens once per slot at mount. Not worth code.

*Probe bug worth recording:* the first run keyed members by `className.split('--').pop()`, which
returns `awake` the moment `--awake` is on, so all five collapsed onto one key and EVERY poll
read as a swap - 150 fake cut-offs. Key off `/crew-member--([a-z]+)/`.

#### The transition overlay now composites

Root cause was already measured in Round 2 (Chromium skips `mix-blend-mode` on a `<video>` it
has promoted to its own layer). The fix removes the dependency rather than fighting it:
`scripts/stage-mascot-clips.mjs` keys the black of an opaque `transition-*` clip into an alpha
plane - `a = max(r,g,b)`, RGB untouched, which IS premultiplied data, so it feeds the same
`scale -> unpremultiply` every cut-out clip already gets. `mix-blend-mode: screen` is gone from
`.mpi-landing__crew-fx`.

- **`max(r,g,b)`, not a luma weighting**, so a saturated flash cannot read semi-transparent.
- **It reproduces what the CSS was asking for.** Computed per pixel on a real frame,
  `|screen - over|` is **2.11/255 mean** on the dark stage (worst 38.9). On a light background
  it diverges (9.4 mean) because the puff occludes instead of washing out - which is what a
  puff of smoke should do, and the stage is dark anyway.
- **The alpha is real and soft**: corner alpha 0, max 255, and 11-49% of the frame partial
  across frames 2/4/6 - the soft smoke edges that were the whole reason `screen` beat a cut-out.
- **A/B on the same pixels, in the app.** The real `.mpi-landing__crew-fx` element, held on
  frame 0.4, screenshotted, and the mascot's own 270x360 box measured:
  **43.7% near-black before (42,439 px), 0.0% after (1 px)**. The "before" was the pre-fix blob
  read straight out of `HEAD`, staged beside it and deleted after.
- **The guard was proven red.** `--verify` gained a keyed-clip branch (a keyed transition must
  be neither fully clear nor fully opaque). Encoding one transition without the key:
  `studio/transition-smoke: key did not take - 0% clear, 0% partial`. Restored, green again.
  The premultiply rim check was NOT weakened - it still skips opaque sources, and still reports
  `worst rim delta -0.06, tolerance +1.00`.
- Weight: the 15 clips go 0.45 MB -> 2.3 MB. `assets/mascot/` is 29 MB with the stills.

#### The two landing changes

- **Crew labels carry the mascot names**: Lingo, Prism, Cosmo, Reel, Vinyl, read back off the
  live DOM. The role lines are unchanged, which is the point - the name is identity, the line
  is the job. This narrows MPI-846's "chrome labels stay role nouns"; recorded there by message,
  and in `docs/shell.md`. The label-width thresholds stay: every new name is SHORTER than the
  61-74px the 2026-09-15 measurement used, and the role lines that set the tighter bound did
  not change.
- **The landing agent slot is Cosmo on the rule.** The 48px `<img>` and the "Ask me anything"
  lettering are gone (`.mpi-agent-chat__mascot*` has no reference left anywhere). He is two
  stacked looping clips in a 46px window with `overflow: hidden`, positioned by the staged
  clip's own geometry - the same `620/370` and `187/370` the crew uses - so the rule cuts him
  at the shoulders. No queue and no timers: both clips loop, and the working state is an
  opacity cross to `studio/working.webm`. Measured: ledge bottom 188.59 = the block's top rule,
  composer top 188.59, i.e. the input sits ON the line. Confirmed it is CosmO and not another
  mascot by cropping the crew's own Studio head from the same screenshot - same character.

#### What ran

- `npm test` - **1793 tests, 1791 pass, 0 fail**, 1 skipped (the one visible assertion is inside
  a pre-existing `todo`, `tests/agent-video-attachment.test.cjs`, MPI-867).
- `npx eslint` on every touched JS file - clean. No stylelint config exists in this repo.
- `node scripts/stage-mascot-clips.mjs --verify` - passes, and proven able to fail (above).
- Live instance, port 57931, past the 18+ gate and the changelog:
  - **Teardown, the one that hangs a run if it is wrong.** `HTMLMediaElement.prototype.play`
    wrapped and the counter zeroed AT the navigation (zeroing it earlier counts the crew's own
    legitimate swaps - the first attempt read 1 for exactly that reason): moving `currentPage`
    off landing leaves **0 `play()` calls in 10s**, 0 crew videos, and both ledge clips paused.
    Back on landing: 6 calls, five crew plus the ledge's rest clip, `currentTime` advancing.
  - **The ledge had to be taught to follow the page.** `MpiAgentChat` is mounted ONCE at boot by
    `projectUI.js` and never destroyed, because the landing is only `.hide`d. Two looping clips
    would therefore have decoded behind an open project for the app's lifetime - a regression on
    two free PNGs. It now pauses on `currentPage` like heroCrew, and `el.destroy()` releases both.
  - **Reduced motion**: a second standalone chat mounted with `matchMedia` stubbed - both ledge
    clips `paused: true` at `currentTime` 0 through a 3s window. Holds a first frame, never plays.
  - Hover: fx layer never lights, Vision lands on `greet-1`. Click: fx plays `transition-smoke`
    with the clip swapping under it.
  - Console: two `[WARNING] [agentService] SSE connection error` lines, and only on a RELOAD -
    the page's old SSE stream dying. Pre-existing and unrelated.

#### What Fabio has to look at

The landing, at a normal window size:

- **Click a character.** The puff should read as smoke over the mascot - no black square, no
  hard edge round it. This is the one that was broken.
- The crew labels: Lingo, Prism, Cosmo, Reel, Vinyl over the role lines.
- The agent slot beside the headline: Cosmo peeking over the line with the input on it. Is 46px
  the right amount of him, and is he in the right place along the rule?
- Type something so he takes his working clip, and check the cross reads as a change of state.

### Round 4 - Fabio's look at Phase 3b (2026-09-22)

**"Everything looks great"** - the keyed transitions, the names and the ledge are accepted in
principle. Four things came out of the look; three are done, one is a peer's file.

#### 1. The puff must TAKE him (done)

*"When I click one of the mascots, before the transition plays, the mascot should disappear.
Then the transition plays, and only then does the mascot appear in the background again, maybe
with a fade-in, so that it actually seems like it vanished with the explosion."*

`--vanished` on the member hides `.mpi-landing__crew-body` and the contact shadow, instantly
(`transition: none`), the moment `_paintFx` gets a clip. He comes back in `_paintClip`'s `show()`
- which the queue calls at the overlay's DENSEST moment - so the fade runs under the smoke and he
is whole before it clears, rather than popping in after it.

**The body wrapper is the load-bearing part of this.** The two clip layers and the fx layer were
siblings, so hiding "the mascot" would have hidden the overlay with him. Wrapping a and b lets
the overlay stay. It also keeps the fade OFF the clip layers themselves: putting a transition on
`.mpi-landing__crew-clip` would have turned every ordinary swap into a crossfade, which is not
what Phase 3 shipped and Fabio accepted.

Traced live through a click, polling computed opacity every 60ms:

| ms | body opacity | overlay |
|---|---|---|
| 63-361 | **0** | playing, 0.04 -> 0.34 |
| 421 | 0.54 (fade running) | 0.40 - the swap moment |
| 848 | 1 | 0.82 |
| 960 | 1 | cleared |

**Regression guarded:** every member's body opacity polled at 50ms for ~15s of idle swaps and
ambient greets - **0 dips below 0.999**. A hover keeps opacity 1 and never lights the fx layer.
So the vanish belongs to the transition path alone.

#### 2. The ledge is the PEEK clip, and its top is no longer sheared (done)

*"On the agent chat, it should be the peeking head... its top is cut off."*

Both halves were one mistake: I had framed a STANDING clip (`idle-1`) by the crew's
`187/370` constants with zero headroom, so the top of his head sat exactly on the window edge.

Measured `studio/peek.webm` rather than assuming: the head occupies rows **443-619** of the 620
frame and its bottom edge is **always 619** - it is cut BY the frame, which is precisely what a
ledge clip is. Frame 29 returns to frame 0's position, so it loops with no jump. That makes the
framing trivial: sit the clip's bottom edge on the rule (`bottom: 0`) and let the window height
decide how much of him clears it. One variable, `--ledge-w`, now sets both.

The working clip could not follow it: `agent-thinking`, `agent-listening`, `agent-answer-ready`
and `working` are all STANDING figures (measured, rows 187-556 / 61-581), so bottom-aligning one
shows his feet. It is hung by its own head row instead (`--standing`), which lands his head in
the same window at the same size - checked by screenshot in both states. The working clip also
moved from `working` to `agent-thinking`, which is what `docs/mascot-placement.md` always
mapped to `_setWorking(true)` for this slot.

#### 3. The agent calls itself Cubric (NOT done - a live peer owns the file)

*"The agent answered that his name is Cubric, when his name is actually Cosmo."*

Correct, and the line is `services/agentLoop.mjs:1271` - `You are Cubric, a helpful assistant
built into Cubric Vision`. **I did not touch it.** Claim `cd2d4679` (session `eca958d8`, MPI-890)
covers `services/agentLoop.mjs` with a live heartbeat, and a system prompt is not something to
edit around a peer who may have that string in their own working tree. Message
`8cd24a3c` sent to that session with the line number, the fix, and why Cosmo is right (MPI-846:
Cosmo is the only speaker; Cubric is the company and the product). Flagged to Fabio rather than
left silent.

#### What ran

- `npm test` - 1793 tests, 1791 pass, **0 fail**, 1 skipped. eslint clean.
- Fresh isolated instance (port 55661, own profile, never `:3000`): the traces above, plus the
  ledge in both states by screenshot, and `studio/peek.webm` confirmed live on the rest clip.
- `tests/desktop/agent-chat.spec.js` follows the clips: `studio/peek.webm` at rest,
  `studio/agent-thinking.webm` while working.
