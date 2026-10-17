# MPI-1168 Smarter clip viewing (MCP)

Member of umbrella MPI-1170 "Cosmo understands video".

## Current State

Project mode: scalable-foundation.

- `services/cardView.js` `viewFile(file, {frames})` picks 2-12 frames by EVEN INDEX and tiles them into ONE
  contact sheet (512 px cells). Shared by Cosmo (`_describeClip`, `services/agentLoop.mjs:927`, `frames: 6`)
  and MCP `view_card` (`routes/mcp.js:392`, `frames` 2-12, default 6).
- MCP clients (Claude etc.) see images themselves; `routes/mcp.js:783-788` turns ONE `_image` into ONE
  image part. A 12-frame sheet is ~2056 px wide, so each frame is small.
- Source of the design: the Watch skill (bradautomates/claude-video, installed locally as `/watch`):
  scene-change pick with uniform fallback, 16x16 near-dup drop, `--start/--end` focus window, separate
  frames with absolute times.

Decisions (Fabio, 2026-10-17):
- **MCP only.** Cosmo's viewing does NOT change: same 6-frame sheet, same even-index pick, same
  `_describeClip`. The new behaviour is opt-in options on `viewFile` that only `view_card` passes.
- Frame picking (MCP): candidates from ffmpeg `select='gt(scene,0.20)'` plus the first frame; fewer cuts
  than requested -> today's even-index rule; more cuts -> even-sample the cuts so the whole clip is
  covered. Then drop near-duplicates (16x16 gray, mean abs diff <= 2.0 vs the last kept) and refill from
  the even-index set if the drop leaves too few.
- `from`/`to` seconds narrow the clip before picking; times stay ABSOLUTE in the output.
- `view_card` returns SEPARATE frames (each at most `VIEW_PX` long edge) as several image parts, each
  frame's time in the text. No sheet. `frames` stays 2-12, default 6.

## Implementation

- [ ] Implement the planned change end to end:
  1. `services/cardView.js`: a `pickFrames(file, {frames, from, to, scene})` helper (scene + dedup +
     fallback when `scene`, today's even-index rule otherwise); `viewFile` gains `from`, `to`, `scene`,
     and `separate` (one webp per frame). Defaults reproduce today's output byte-for-byte for Cosmo.
  2. `routes/mcp.js` `view_card`: `from`/`to` params, calls `viewFile` with `scene: true, separate: true`;
     the result path (`:783`) emits several image parts from an `_images` array (single `_image` still
     works for every other tool). Update the server-instructions line and the tool description.
  3. Tests: `tests/card-view.test.cjs` (scene pick on a synthetic two-shot clip, dedup on a static clip,
     uniform fallback on a pan, window keeps absolute times, defaults unchanged), `tests/mcp.test.cjs`
     (multi-image result shape, from/to validation).
  **Verify:** `node --test tests/card-view.test.cjs tests/mcp.test.cjs tests/agent-loop.test.cjs` green
  (agent-loop proves Cosmo unchanged); then against `npm run app:isolated`, MCP `view_card` on a
  cut-heavy clip and on a camera-move clip returns separate frames with absolute times.

## Completed

- [x] 2026-10-17: implemented + verified (validation.md). Uncommitted: `services/cardView.js`,
  `routes/mcp.js`, `tests/card-view.test.cjs`, `tests/mcp.test.cjs`, `docs/mcp-server.md`.

## Remaining Work

- Commit (end-session) and move to done. Nothing else.

## Plan Drift

- 2026-10-17: first plan also changed Cosmo (Settings slider, chained sheets). Fabio cut it to MCP only;
  Cosmo's long-video needs moved to MPI-1134 "Story and Infinite Video (umbrella)" Phase 5b.
- 2026-10-17: cut detection is our own 16x16-grey neighbour diff in one ffmpeg pass (not ffmpeg's
  `scene` filter) — one pass gives cuts AND the dedup fingerprints. A cut = step > 16 AND > 3x the
  local median (a pan is not cut). Fewer shots than asked: every shot + even fill; a still clip
  returns 1 frame (no refill — the same picture twice says nothing).

## Verification

**Verify mode:** auto

No app UI changes; the tests plus one isolated-instance MCP call prove it. Own instance only, never `:3000`.

## Preservation Notes

- `docs/mcp-server.md`: view_card's new params and the separate-frames result.
- Privacy policy unaffected: no new outbound service.
