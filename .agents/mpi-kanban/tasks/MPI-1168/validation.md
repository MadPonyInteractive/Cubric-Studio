# MPI-1168 Validation

## 2026-10-17 — auto, PASSED (session "Video frame limit solutions", 3a69bd32)

- `node --test tests/card-view.test.cjs` — 7/7 pass. New: one frame per shot from each shot's middle
  (3-colour clip, frames 3 -> r,g,b at ~0.31/0.93/1.55 s, never enlarged); a 3-frame blue flash that
  6 even slices miss IS picked by `scene`; a still clip returns 1 picture; a 2 s pan over testsrc2
  (neighbour steps up to ~17) is NOT cut and returns 6 spread frames; `from`/`to` keep absolute times,
  stay inside the window, and reject an empty window. The original sheet test passes unchanged
  (Cosmo's default path byte-for-byte the same code).
- `node --test tests/mcp.test.cjs tests/agent-loop.test.cjs` — 227 pass, 1 skipped (live DeepInfra
  test, no key). New: `view_card` on a 2-shot clip -> text + 2 image parts, "2 pictures in clip
  order"; `to <= from` -> `BAD_RANGE`.
- Real footage (read-only, `viewFile(..., {scene, separate})` — the exact call `view_card` makes):
  `Grantiz/combined_001.mp4` (10 s, 1088x1920, a joined clip) caught all 3 shots (wide stage,
  cymbal close-up, side shot) + spread fill over the long last shot, 945 ms; a single-take 3 s
  i2v clip gave 6 distinct evenly spread frames, no false cut, 666 ms. Frames 580x1024.
- Not run: an isolated-app MCP call. The route itself is exercised by `tests/mcp.test.cjs`
  through `callTool`, and the real-clip check ran the same `viewFile` call on real files.

Found and fixed during verify: a flat cut threshold cut a busy pan (now a cut must also be 3x the
median change of the 8 frames around it); spreading shots + fill frames could drop a shot (shots now
always stay, only fill frames thin).
