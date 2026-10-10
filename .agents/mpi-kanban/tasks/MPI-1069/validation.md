# MPI-1069 Validation

Run 2026-10-10, session d44c0c41. All passed.

## Unit
- `node --test tests/resize-ops.test.cjs` - 10/10. Planner numbers worked by hand from KJNodes
  `ImageResizeKJv2.resize` (crop, pad + divisible round-up, resize, total_pixels, stretch, rotation
  swap, pyRound; an old card's upscale_method is ignored - Lanczos always, Fabio 2026-10-10); real-pixel quadrant checks for flip x / y, rotate 90 CW,
  flip-then-rotate, crop position, all four pad modes, alpha kept; ffmpeg on a generated clip:
  size, audio kept, trim 0.5-1.5 s -> ~1 s, rotate 270 + flip, odd size -> even; every pad mode's
  bands on a clip match the still renderer (row means, tol 8).
- `tests/lane-agreement.test.cjs` - incl. the REAL store: a `tool` job runs beside a busy `local` job.
- `tests/cloud-executor.test.cjs` (seam regex updated), `crop-ratios-divisible`, `injector-consumes`.
- `npm test`: 3044 pass, 2 fail - both in `tests/child-safety-gate.test.cjs`, which a peer session
  has uncommitted edits in (with `js/data/childSafety.js`); not touched by this card. An earlier
  full run (before the peer's edit landed) was 3024/3024 green.
- `npx eslint` on every touched file: clean.

## Desktop (Electron, own port + scratch profile, CUBRIC_E2E: engine gate skipped, no repair)
- `crop-resize-output.spec.js` 6/6 - incl. NEW: Resize Applies a still with no engine (preview
  becomes a server blob; 400x300 -> 192x96 lands as a history entry) and a clip with no engine
  (320x240, trim 0.5-1.5 -> 160x112, ~1 s, audio kept, history entry). Engine stub `idleEngine` removed.
- `agent-tool-ops.spec.js` 1/1 - updated: the agent's crop reaches `/tool/resize` (op, params,
  disk path) while an upscale still holds the engine lane; only the 2nd upscale is pending.
- `no-engine-user.spec.js` 1/1.

## Proof on Fabio's real clip (copied to scratch; the project file was never written)
`CP Tests/Media/imported_002.mp4`, 2160x3840, 59.94 fps, 13.7 s, 822 frames, audio:
- crop to 1080x1920 (div 16 -> 1072x1920): 10.3 s, node peak RSS 71 MiB, ffmpeg peak WS 1544 MiB,
  822 frames out, audio kept. (Before: ~82 GB float32 decode, MemoryError.)
- pillarbox_blur to 1920x1080 (-> 1920x1072): 15.2 s, ffmpeg peak 1508 MiB; frame eyeballed.

## Not run
- `npm run release:check` fails on ONE item, not this card's: the engine pin moved 0.34.0 -> 0.39.0
  today (peer, MPI-623, `node_lock.json` claimed by a live session) and `smoke-evidence.json` is
  stale. Its registry/universal-workflow checks (the ones this card's removals touch) pass.
- `app:isolated` on the real engine root deliberately NOT booted: the pin moved today and a boot
  repairs the user's live engine (memory tool_isolated_app_boot_repairs_the_real_engine). The
  desktop E2E harness above is the sandboxed equivalent.

## After Fabio's Lanczos call (same day)
- Method dropdown removed, server always Lanczos. Re-run: resize-ops + crop-ratios-divisible 13/13, desktop crop-resize-output + agent-tool-ops 7/7, eslint clean.
- Claim auditor: 28 proven, 0 false (one stale wording here, fixed).

## Reopen: blank preview after a clip Apply (2026-10-10 night)
- Reproduced in `crop-resize-output.spec.js` (new assertion: preview is a NEW blob with an opaque centre pixel): clip test red 2 of 5, then 2-3 of 8 at panel open once the post-Apply seek race was gone.
- Instrumented: failing thumbnails had readyState 4, not seeking, currentTime 0, `drawImage` alpha 0; rVFC fired 18-31 ms later with alpha 255.
- Fix (MpiVideoViewer.whenSourceLoaded via rVFC; waitForVideoFrame deleted): clip test 8/8, whole spec file x3 below; eslint clean.
