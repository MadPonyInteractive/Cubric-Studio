# MPI-1230 validation

## Cause (measured, not the first theory)

CI run 39601605307 attempt 1, shard 3: `llm-settings-remote.spec.js:29` failed on all three
attempts, each at a different step, each "an opened `.mpi-dropdown__list.is-open` resolved to
0 elements". Attempt 2 had the same symptom on the same file's `:145` test (flaky).

First theory (from the session that started this one): the boot's second navigation, the
engine version check and the 18+ gate land after `shellWindow` returns. **Does not hold under
E2E**: `_isE2E()` skips the engine gate, so `_bootApp` runs from its first navigation to
`shell:booted` with no `await`; a probe saw no `shell:booted` after `shellWindow` returned.
The 18+ gate is on screen in every run of this spec, green ones included.

What does close the list: a `resize` (MpiDropdown closes on `resize`). Probe, armed right after
`shellWindow` returned, with main's `shell:landing-ready` held 3s (the runner's order of
events): one `resize` ~0.85s later, the window still hidden, rAF running at ~1 frame/s until
the reveal. Same probe with `shellWindow`'s `setZoomFactor(1)` removed: no `resize` at all.
So it is the harness's own MPI-995 zoom pin. Chromium dispatches the resize on the next frame,
main.js keeps the window hidden until the landing has content (mascot clips decoded, MPI-966),
and a hidden window draws about once a second, so the event lands up to a second into the spec.

## Fix

`tests/desktop/shellWindow.js` waits two animation frames after the zoom pin. A frame runs
the resize steps before its rAF callbacks, so the resize has fired before the spec starts.

## Proof

New spec `tests/desktop/shell-window-no-late-resize.spec.js` holds main's landing-ready listener
for 3s, opens a Remote dropdown right after `shellWindow`, waits 1.5s, asserts the list is
still open and no resize arrived.

- Fixed harness: 3/3 green; with `llm-settings-remote.spec.js`, `--repeat-each=3`: 15/15 green.
- Original harness (`git show HEAD:tests/desktop/shellWindow.js`): 3/3 red, "the open
  dropdown closed under the spec" — CI's symptom.
- `scripts/mutate-check.mjs` deleting the frame wait: 3/3 red.
- A reveal wait (poll `BrowserWindow.isVisible()`) also killed it, but redundantly with the
  frame wait (each half alone kept the spec green), so it was not kept.
- `npm run lint`: clean. `npm test`: 3497 pass, 0 fail.
- Full desktop suite, four shards side by side on Fabio's box: 240 pass, 9 fail. All 9 pass
  rerun alone with a short `--output` path (agent-drag-set, canvas-display-copy,
  crop-resize-output, delete-offers-archive, fullscreen-titlebar, gif-cutout, gif-transform,
  mask-temp-ipc, stack-history). Three of them failed rerun WITHOUT this fix too, with
  "Input file is missing" under a ~200-char scratchpad output path: path length plus the
  load of four parallel apps, not this change.
