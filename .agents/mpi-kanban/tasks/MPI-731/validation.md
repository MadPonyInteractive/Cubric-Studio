# MPI-731 Validation

Card is open. Evidence per item, newest last.

## Item 1 — `MpiProgressBar` vertical (`eeef13dc`)

- `tests/desktop/flow-audio-player.spec.js` test 1 green in a real Electron window;
  falsified (without `direction: rtl` a bottom click reads 100). Re-run green 2026-09-12
  ~19:35Z by the resuming session.

## Item 2 — `MpiVolumeControl` (uncommitted)

- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-audio-player.spec.js`
  → **2 passed** (18.7s), 2026-09-12 ~19:38Z.
- Test 2 mounts the compound in a real `MpiVideoControlBar`'s right cluster and measures
  computed visibility plus `elementFromPoint`, not classes: hidden before hover, open on
  hover, still open after the pointer travels up into it, top click > 80, bottom click < 20,
  mute click emits `['mute-toggle', true]`, `setMuted` / `setValue` emit nothing, closed
  after leaving.
- **Falsified:** `:has(:focus-visible)` swapped to `:focus-within` → fails on
  "leaving closes the flyout" (Expected hidden, Received visible). Restored, re-run green.
- `npx eslint` clean on `MpiVolumeControl.js` and the spec.
- `grep -rc "MpiProgressBar.mount" js/` = 24 (23 before + the new mount).
- Real-window screenshot sent to Fabio (flyout 140px, travel 112px). **Signed off
  2026-09-12**: height and upward direction as built; the wheel must be on and fast.

## Item 2 addendum — the wheel (uncommitted)

- `WHEEL_STEP = 5`, always on, one capture listener on the root, so it works over the mute
  button AND the panel; the slider mounts `wheel: false`; the `wheel` prop is gone.
- Test 2 now mounts the compound bare (the bar stand-in is gone, test 3 covers the bar) and
  asserts: one tick up over the button 30→35 emitting `[input 35, change 35]`; two ticks down
  over the panel →25; clamps at 100 and a tick that cannot move emits nothing.
- **Falsified:** `WHEEL_STEP = 1` → test 2 fails at "one wheel tick UP over the mute button
  is +5" and test 3 at "two ticks up put the video at 60%". Restored byte-identical (`cmp`).

## Item 5 — `MpiVideoControlBar` adopts `MpiVolumeControl` (uncommitted)

- Bar's `muteBtn` + horizontal `volumeSlider` + `.mpi-video-control-bar__volume*` wrapper and
  its 5 CSS rules removed; `MpiVolumeControl` mounted in the slot. `mute-toggle` and the `M`
  hotkey both call `_toggleMute()`; `input`/`change` → `_doVolume`; attach + `volumechange`
  mirror back through `setValue`/`setMuted`. Arrow hotkeys untouched.
- `MpiVolumeControl.css` registered in `js/shell/preloadStyles.js` (item 8's line, pulled
  forward so the flyout does not flash open on first mount for users).
- New test 3 against a REAL `MpiVideoSurface` (no src): old pair gone, right cluster = 4
  buttons + ONE vertical slider and no leftover width, left 3 buttons, trim mounted;
  attach paints 50%; button mutes/unmutes the `<video>`; two wheel ticks → 60%; `M` mutes and
  unmutes with the button following; ArrowDown → 50, ArrowUp → 60 with the slider following.
- **Falsified:** `hk('video.mute')` → no-op fails exactly at "M mutes, and the control
  follows the element" (the button click above it still passes). Restored byte-identical.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-audio-player.spec.js`
  → **3 passed** (29.3s) after both restores. `npx eslint` clean on all four touched JS files.
- **Fabio's live look, 2026-09-12: "It works great"** — screenshot of the Group History video
  workspace with the flyout open above the speaker, unclipped.

## Zero reads as muted (uncommitted)

- Test 2: `setValue(10)`, three wheel ticks down over the speaker → 0 and the speaker shows
  muted; clicking it → 10 again, not muted, log exactly `[input 10, change 10]` (no
  `mute-toggle`); `setValue(0)` shows muted, `setValue(40)` shows sound. The earlier mute-click
  now starts from `setValue(50)` so it can never land on the restore path.
- Test 3 (real `MpiVideoSurface`): from 60%, twelve wheel ticks → `{ volume 0, muted false,
  slider 0, btnActive true }`; clicking the speaker → `{ volume 60, muted false, slider 60,
  btnActive false }` — the video actually gets its sound back.
- **Falsified twice:** `_paint` without `|| _value() === 0` fails test 2 at "the speaker shows
  MUTED at zero" and test 3 at "wheeled to zero…"; the restore branch disabled fails test 2 at
  "clicking it brings back the level the gesture started from". Restored byte-identical.
- Final: `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-audio-player.spec.js`
  → **3 passed** (32.2s); `npx eslint` clean on the compound and the spec.

## 5b. Transport bar below the PromptBox

- **Fabio verified live, 2026-09-12 ("1").**

- New test 4, real window: video Group History with a synthetic dependency-free i2v model so
  the PromptBox mounts. Measured: bar top 707 == PromptBox bottom 707, 7 buttons, no PromptBox
  node's box on the bar, every button hit-tests to itself. Flyout 144px tall, not clipped by
  `.main-area`, rises over the PromptBox and its slider takes the pointer. Navigating to an
  image group leaves `#controls-mount` empty, 0px tall, block grid two rows.
- **Probe falsified in-test:** moving `#controls-mount` above `#prompt-box-mount` makes it
  report the expand toggle (`mpi-prompt-box__lock-container`) and `mpi-prompt-box__op-strip`
  on the bar — the exact chrome that covered it.
- **z-index falsified:** `#controls-mount { z-index: auto }` fails at "it rises across the
  PromptBox and its slider takes the pointer there" (`reachable: false`). Restored to 41.
- Screenshots (scratchpad, not committed) matched: bar under the prompt row, flyout over it.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-audio-player.spec.js tests/desktop/workspace-sweep.spec.js tests/desktop/mask-persist-roundtrip.spec.js`
  → **11 passed** (54.5s). `npx eslint` clean on the block and the spec.

## 3. MpiAudioPlayer (built; waiting on Fabio's look before item 4)

- New test 5, real window, `/voices/child_1.opus` (11.1s real audio), maskless. Layout at three
  consumer widths: at 260px the player is 260 wide, order `play │ time │ waveform │ volume`, one
  row (centre spread < 4px), waveform the widest element; at 480px every extra pixel goes to the
  waveform (+220); at 160px it is 160px — no minimum width.
- Transport: at rest the time reads `00:11` (the LENGTH); play → playing, fill > 0.03, time now
  elapsed; SPACE with the play button still focused from the click pauses EXACTLY once, SPACE
  again plays; a click at 50% of the track lands `currentTime` in 4.5–7.5s and keeps playing.
- Volume: flyout hidden before hover, opens whole and reachable on hover (nothing in the player
  clips it); mute mutes the element; a wheel tick up while muted → volume 25 AND unmuted; mute
  round-trips; `audio.volume = 0.1` set from outside moves the slider to 10; `M` mutes/unmutes;
  ArrowUp/ArrowDown ±10.
- End and teardown: at the end `{ ended, progress 1, paused, play icon }`; `display:none` host →
  SPACE does nothing, visible again → SPACE plays; a second `hotkeys: false` player keeps playing
  while SPACE pauses the first; destroying a PLAYING player pauses it; no renderer errors.
- **Falsified — all 18, one sabotage at a time** (scratchpad `falsify731.cjs`: apply one, run
  test 5, restore). Each failed at its OWN assertion: track `flex: 0 0 20px` → widest; root
  `min-width: 240px` → 160px consumer; `flex-direction: column` → row order; `formatTime(t)` →
  LENGTH at rest; `setProgress(0)` → fills; playPause bound twice → exactly once; no `pause`
  listener → exactly once; seek gated off → middle of the clip; root `overflow: hidden` → clips
  none of it; `_toggleMute` no-op → mute mutes; no unmute-on-raise → unmutes; no `setValue`
  mirror → element's level; no `M` bind → M mutes; `+0` step → arrow up; `ended ? 0` → stays
  FULL; `_canDrive = true` → hidden SPACE; `hotkeys = true` → hotkeys:false one playing; no
  `audio.pause()` in destroy → destroying pauses. `RESTORED true`, anchors re-grepped.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-audio-player.spec.js`
  → **5 passed** (57.5s). `npx eslint` clean on `MpiAudioPlayer.js`, the spec, `types.js`,
  `preloadStyles.js`. Screenshot at 260px (scratchpad): `▶ 00:11 [track] 🔊`, one row.
- **Not yet proven:** Fabio's look (the user-ux gate before item 4), and a PAINTED wave — the specs
  run maskless; that is item 7's live check.
- Cardless extra: MPI-733's three Cue-all rule-map lines, each checked against the code first
  (`MpiGalleryGrid.js:1507/1557`, `MpiGalleryBlock.js:145/1453/1792`); message `a57c9fbc` resolved.

### 3b. Fabio's look (2026-09-13): behaviour approved, layout changed

- **Fabio: "it works fine"** — the transport behaviour is signed off. Layout change requested: the
  buttons are the ends, the waveform is the bar joining them, the time sits on it.
- Built: no row gap; track `align-self: stretch`; waveform absolute inside it; time absolute over
  it with `pointer-events: none`. Test 5's layout block rewritten; new click-on-the-time assertion.
- Measured at 260px: left seam and right seam < 1px, wave height == button height (< 1px), wave
  width == row − both buttons (< 1px), time box inside the wave box and topmost at its centre; a
  click on the time scrubs to < 3s. 480px: +220 all to the wave; 160px: 160px.
- **Falsified, 8 sabotages** (scratchpad `falsify731b.cjs`): row gap → starts at play edge; fixed
  height → as tall as the buttons; root padding → every pixel the buttons leave; `min-width:
  240px` → no minimum width; time `left: -60px` → sits ON the waveform; time `z-index: -1` →
  painted above it; no `pointer-events: none` → does not swallow the click. One **STILL-PASSED**:
  removing `display: flex` on the button holders — so that rule was deleted, and the unused holder
  classes with it. `RESTORED true`.
- Final build: `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-audio-player.spec.js`
  → **5 passed** (58.1s); `npx eslint --max-warnings=0` clean on the player, `types.js`,
  `preloadStyles.js`, the spec.
- **Not yet:** Fabio's second look at the joined layout; a painted wave (item 7's live check).

### 3c. Fabio's second look (2026-09-13): time digits near-black

- He mounted the joined layout himself; white `--ink-1` digits vanished into the light wave.
  Now `--surface-viewer` (oklch 0.20, darkest token). Test 5 re-run: **1 passed** (16.4s).

### 4. Wired into MpiBaseFlow (2026-09-13, session `30b8fe52`, uncommitted)

- `_sharedAudioEl` -> `_sharedAudioPlayer(url, it)`; N-output players in `_plainAudioPlayers` (pane)
  and `_dockAudioPlayer` (window); dock CSS sizes the player; `tests/flow-result-dock.test.cjs`
  source contracts re-pointed at the player (src set once inside MpiAudioPlayer).
- **Bug found and fixed on the way:** the pane's ResizeObserver fit the player as a picture
  (`isManagedView` left true): measured `matrix(1.4375 ... 0, 215.56)`, player at y=715 below a
  frame ending at 659, scrub hit the slide, `currentTime` 0. `_hasViewableResult()` now gates fit,
  wheel-zoom and pan.
- **New test 6** (`flow-audio-player.spec.js`, real mouse in a real Flow run slide): a travelling
  scrub moves the playhead and not the player; the wheel over the player does not zoom it.
- **Falsified:** fit guard absent (pre-fix) -> scrub `t = 0`, player off-frame; pan guard reverted ->
  player moved **134px**; wheel guard reverted -> **36px** wider. Each restored; `grep SABOTAGE` = 0.
- Final: `flow-audio-player.spec.js` **6 passed** (1.1m); `flow-result-follows-steps.spec.js`
  **1 passed** unchanged (same node across two navigations, never pauses, stops on destroy);
  `npm test` **961/961**; `npx eslint --max-warnings=0` clean on MpiBaseFlow.js + both tests.
- **Not yet:** Fabio's live check with a real generation (painted wave, scrub, the window takes
  the same player across a step change). Rule line `component-mounts.md:268` still names
  `_sharedAudioEl` - needs his permission to edit.

### 4b. Fabio live, Stems flow (2026-09-13)

- Seen in his app: 4 N-output players in the pane, waves PAINTED, one scrubbed mid-clip and
  playing (teal played layer). Not yet seen: the single-output window move across a step.
- Time digits: near-black was harder to read over the mid-grey ground. Reverted to `--ink-1` plus
  a `--surface-viewer` text-shadow halo (reads over light wave and grey surface). CSS-only, no
  spec re-run; his eyes are the check.
- Rule rename approved and done: `.claude/rules/component-mounts.md:268` names `_sharedAudioPlayer`.

### 4c. Fabio verified (2026-09-13): "1"

- Text to Speech, single output: one player, painted wave, played through; the halo digits read.
  With the Stems check above, items 4 and 7 are closed on his word.

### 8. Typedefs + doc (2026-09-13, session `22ada69c`, `2fbfea22`)

- `js/components/types.js`: `MpiVolumeControlProps` (props, API and emits from the
  `MpiVolumeControl.js` header); `MpiProgressBarProps.orientation`; `MpiWaveformProps` corrected
  to what `MpiWaveform.css:45-46` paints (`--accent-audio`, mixed in oklab) and to the `seek`
  payload the component header documents (`modified`). Fabio approved the Waveform fix.
- Hand-built index blob (HEAD + these edits only): `git show --stat 2fbfea22` = 3 files
  (`types.js`, `docs/gallery-audio-cards.md`, `docs/README.md`). Afterwards
  `git diff --stat -- js/components/types.js` = `+13`, which is MPI-728's `MpiOllamaSetupProps`
  hunk, still in the worktree. `npx eslint --max-warnings=0 js/components/types.js` passed
  (asserted inside the commit script).
- `docs/gallery-audio-cards.md` "The player" (157/200 lines). Every symbol it names was grepped
  in `MpiBaseFlow.js` first: `_plainAudioPlayers` :254, `_dockAudioPlayer` :255,
  `_sharedAudioPlayer` :2347, `_hasViewableResult` :2476, N-output `hotkeys: false` :2760.
- `js/shell/preloadStyles.js`: no edit needed. `git show HEAD:js/shell/preloadStyles.js` already
  lists `MpiWaveform.css` :83, `MpiVolumeControl.css` :85, `MpiAudioPlayer.css` :87.
- `python validate_board.py .` exit 0; the `docs/README.md` row points at `gallery-audio-cards.md`.

### Post-close follow-up (2026-09-13, Fabio approved: "yes to both")

- `.claude/rules/component-mounts.md`: § MpiVideoControlBar's sub-mounts corrected (item 5 turned
  the volume `MpiProgressBar` and the mute `MpiButton` into `MpiVolumeControl`; 9 video hotkeys,
  not 6, per `MpiVideoControlBar.js:439-450`); new § MpiVolumeControl and § MpiAudioPlayer;
  § MpiBaseFlow gains its `MpiAudioPlayer` mount.
- `.claude/rules/component-events-organisms.md`: MpiVideoControlBar LISTENS / HOTKEYS corrected
  against `MpiVideoControlBar.js:325-445`; new § Audio Compounds (MpiWaveform, MpiVolumeControl,
  MpiAudioPlayer).
- `docs/releases/UNRELEASED.md` § What's new: the video bar below the prompt box and the volume
  flyout, a released surface (v1.5.0, 2026-09-08, predates both). The Flow player owes no
  entry: Flows are unreleased.
- `MpiVideoControlBar.js`: its comment no longer names the gallery as a consumer (item 6 was dropped).
