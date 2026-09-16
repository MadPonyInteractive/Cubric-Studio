# MPI-769 Validation

## 2026-09-16 - MPI-757 Batch 2, verified by the orchestrator

| Check | Command | Result |
|---|---|---|
| GIF desktop specs | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-make.spec.js tests/desktop/gif-workspace.spec.js tests/desktop/history-modes.spec.js tests/desktop/gallery-gif-hover.spec.js --output=<scratchpad>/pw-orch` | 5/5 pass (orchestrator re-run) |
| Neighbouring gallery specs | same config: `gallery-renditions`, `gallery-media-release`, `gallery-cue-all`, `gallery-archive` | 12/12 pass |
| Bite check (worker) | forced `isGif = false` | both new specs red, restored green |
| Component lint | `npm run lint:components` | clean (after the orchestrator's fix below) |
| Full node suite | `node --test "tests/*.test.cjs"` | 1108 pass, 0 fail, 1 skipped |

What the specs prove: a GIF card opens in gif mode with no PromptBox and an empty tool rail. Step, play
and scrub keep the strip's centred thumb on the frame the counter shows. Reorder and delete stage
locally with no `/gif/entry` call. Update posts `mode:'update'` and rewrites the same card; Apply posts
`mode:'new'` and adds a card. Image and video groups still mount their own viewer, rail and control
bar. `gif-make.spec.js` then opens a REAL built GIF in this workspace, straight from Make GIF.

Integration (orchestrator):
- `MpiFrameStrip` drag listeners moved from raw `window.addEventListener` to `on()` (dos_and_donts).
- `hotkeyRegistry.js` line endings put back to LF; the worker had written CRLF.
- Added the GIF Player group (Space, arrows, Backspace) to the hotkeys panel
  (`LandingPages/mpi-hotkeys/mpi-hotkeys.js`, message f7b11b0f).

Gotcha recorded in `docs/workspaces.md`: `ComponentFactory.mount()` sets `container.innerHTML`, so
two components in `#controls-mount` each need their own wrapper div.

**2026-09-16: Fabio checked it in his app and approved it** (user-ux gate, plan Phase 2): the strip,
playback and Make GIF all work. The only change he asked for was Make GIF's timing (MPI-770).
