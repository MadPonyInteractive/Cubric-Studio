# MPI-766 validation

## 2026-09-15: agent checks (all passed)

Environment: my own isolated instance (`npm run app:isolated`, scratch profile, scratch
`CUBRIC_ENGINE_ROOT` / `CUBRIC_MODELS_ROOT`, so no install or repair could touch a real engine),
driven with `playwright-cli` as a browser client on its port. Electron-only behaviour through a
hand-rolled Playwright `_electron` probe on its own port and profile. Never `:3000`.

- **Lint and tests.** `npx eslint js/shell/heroCrew.js js/shell/projectUI.js js/shell.js`: exit 0,
  no warnings (heroCrew.js re-linted after the fit rewrite). `npm test`: 1045 pass, 0 fail.
- **Stage geometry at 1920x1032.** Crew scale 1. Each member's centre x / height / bottom in
  stage px: Prompt 118/210/840, Vision 318/260/840, Studio 560/360/840, Video 802/260/840,
  Audio 996/210/840. Matches the brief's table exactly; floor line at y = 840.
- **Fit at each size.** Measured after Fabio's 1280x976 look replaced the hide-breakpoints with
  `_fit()`; screenshot at each size. Viewport px, text bottom -> nearest head top, labels bottom
  -> stats top.

  | Window | Crew scale | Labels | Quote -> Vision | Headline -> Studio | Labels -> stats |
  |---|---|---|---|---|---|
  | 1920x1032 | 1 | names + roles | 585 -> 610 | 453 -> 509 | 939 -> 958 |
  | 1536x864 | 0.738 | names + roles | 496 -> 510 | 385 -> 436 | 765 -> 790 |
  | 1366x768 | 0.519 | names | 457 -> 472 | 355 -> 420 | 643 -> 694 |
  | 1280x976 | 0.667 | names + roles | 453 -> 641 | 355 -> 574 | 875 -> 902 |
  | 1280x680 | 0.219 | crew hidden (below 0.25) | - | - | - |
  | 950x500 | 0 | crew hidden | - | - | - |

  No label overlaps its neighbour or leaves the hero at any size. At 950 wide the hero top bar
  and the stats foot wrap; that is pre-existing.
- **Quote.** Before the fit, the longest real quote ("Creativity is allowing yourself to make
  mistakes...", 3 lines) cleared every character at 1920, 1536 and 1366 (screenshots). The fit now
  reads the quote's real bottom, so a longer quote shrinks the crew instead of reaching it.
- **No re-entrance.** Editing `#heroStatSession` or `#heroQuoteText`, or changing `--crew-k`,
  leaves 0 running crew animations. With the hero as a size container a text edit restarted all
  5, which is why no scale comes from a container (plan.md, Plan Drift).
- **Refit and teardown.** A quote that wraps differently refits (`--crew-k` overwritten by the
  observer). Moving `state.currentPage` landing -> gallery -> landing -> gallery with the timers
  wrapped: while mounted, one crew interval and one timeout are live; after destroy, 0 crew
  timers, 0 members, and the observer is disconnected (a quote change no longer refits); a
  remount rebuilds 5 members and refits.
- **Reduced motion** (emulated `prefers-reduced-motion: reduce`, reloaded): 0 crew animations at
  boot and after a remount, 0 ambient intervals, 5 members present.
- **Picker foot, browser client:** `+ New project` opens `mpi-new-project`.
- **Picker foot, Electron:** the buttons are `+ New project` and `Open folder`, each 214px wide
  with an 8px gap; clicking `Open folder` invoked `choose-folder` (stubbed to `cancelled`, so no
  native dialog opened); the old `#openFolderHeroBtn` slot is gone; 5 crew members mounted.

## Not verified by an agent

- **Teardown through a real project open.** The scratch instance has no engine, so
  `blockedByNoEngine` stops a project from opening. The teardown was driven through
  `state.currentPage`, which is exactly what `router.navigate` writes and what the crew listens
  to, but not through the Open click itself.
- **The video half of `destroy()`** (pause, remove `src`, `load()`). No WebM loops exist yet; the
  line is there for the animated mascots.

## 2026-09-15: Fabio verified (`user-ux`)

First look, on his 1280x976 monitor: the crew was hidden, and he asked for it to scale down
instead, which `_fit()` now does. Second look, in a visible isolated instance running the fit:
**verified ("1")**. What he was asked to look at:

1. The crew at his window sizes: the entrance (light up, Studio rises, the crew steps out), the
   3px float, one character greeting every ~3s.
2. Hover a character: greet pose, 8px lift, floor glow in its colour. Click: happy pose for ~1.4s.
3. `+ New project` and `Open folder` at the foot of the project list.
4. Resize the window: the crew shrinks with the room, role lines drop out first, then names.
5. In his own app: open a project and come back; the entrance plays again.

Step 5 needs an engine, which the isolated instance does not have; the return path is covered by
the agent teardown and remount check above, and it repeats the next time a project is opened in
his own app.

## 2026-09-15: the entrance waits for a clear screen (agent checks, all passed)

Fabio's follow-up: start the entrance only once every overlay is gone, as something reusable.
Built as `state.screenClear` (`js/shell/screenClearService.js`, fed by `shell:booted`, the
`Overlays` stack and any backdrop on `<body>`); the crew holds (`--held`, paused) until it.

- **Lint and tests.** `npx eslint js/shell/screenClearService.js js/shell/heroCrew.js js/shell.js
  js/state.js`: exit 0, no warnings. `npm test`: 1045 pass, 0 fail.
- **Boot sequence, fresh browser client on a scratch instance.** At load, with the engine gate
  modal up: `screenClear` false, crew held, all 5 entrance animations paused at 0ms. After
  "Remote only", the 18+ notice ("Continue"), then the changelog ("Done"): still false, held,
  paused at 0ms at each step. After "Done": true, and the entrance runs from its start (684ms in,
  0.7s later), then finishes.
- **No false "clear" between dialogs.** The `screenClear` log over that whole sequence reads
  `true`, once. With a microtask recompute it read `true,false,true`: the 18+ Continue opens the
  changelog one animation frame later (MPI-333), and that frame looked clear. Recomputing on the
  next frame fixed it.
- **Engine-start screen** (`comfy:starting`, local): false, held, one backdrop on `<body>`.
  Leaving and re-entering the landing while it is up: 0 members after destroy, 5 new members
  paused at 0ms. `comfy:ready`: true, the entrance runs, 0 backdrops.

## 2026-09-15: Fabio verified the entrance hold (`user-ux`)

Only visible on a launch that shows overlays, so it ran in a separate visible isolated instance on
a fresh profile with empty scratch engine and models roots (`app:isolated`, port 57961, never
`:3000`). He clicked "Remote only" on the engine gate (the log records the RunPod escape hatch at
17:00:31Z, no install), "Continue" on the 18+ notice and "Done" on the changelog, and confirmed
the crew waits, still, behind them and plays its entrance only when the last one closes:
**verified ("it's verified. Looks good.")**.
