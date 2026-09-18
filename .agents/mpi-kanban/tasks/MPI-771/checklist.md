# MPI-771 Checklist

Derived from `tasks/MPI-757/plan.md` (2026-09-16).

- [x] Engine half (MPI-757 Batch 2 worker)
- [x] Engine verify: tests/gif-cutout.test.cjs + one real local track
- [x] UI half (MPI-757 Batch 3)
- [x] Redesign per Decision 14 (Phase 3b): base layer, per-frame masks, Mask Brush, Track All / Single Frame - automated checks green
- [x] Fabio's six findings from the first eye check (2026-09-16 13:10Z) - automated checks green
- [x] Fabio's second check (2026-09-17): held thumb overshoot, native-drag "copy" + stuck Discard, preview button in the Mask Brush - automated checks green; Discard stays frames-only (Fabio: a)
- [x] types.js typedef hunk + `preloadStyles.js` — landed 2026-09-18 once MPI-774's claim no longer covered either file; rewritten against the code as it is, `types-hunk.md` deleted
- [x] UI verify: local engine AND RunPod (user-ux) - local 2026-09-17 ("1"), RunPod 2026-09-17 (Fabio's app, RTX 2000 Ada)
- [x] Header ENTRIES count refetches after a GIF tool Apply (found in the RunPod check screenshot)
- [x] Fabio's UI pass (2026-09-17 ~14:00Z): Cut out saves transparent; `colours` stored as 0 (3 routes); checkerboard behind frames; spinner + status bar while masking; masks survive Cut out (per-list stash); "name what to KEEP" hint; cut-out records its settings
- [x] Mask methods: Remove background (BiRefNet, default), By name (SAM3), By colour (shared `js/utils/colourKeyMask.js`); runner hunk waits on MPI-774's commandExecutor.js claim (message 4463a29e)
- [x] By colour in the IMAGE mask tools (Fabio, 2026-09-17)
- [ ] Fabio's UI check of the above after a full app restart
- [x] Fabio's second pass (2026-09-18 ~11:3xZ), items 1-4: strip right-click menu (Delete frame / Clear this frame's mask); the trim range painted on the strip + the Trim note telling the truth on a full range; the gallery hover-play artefact root-caused (transparent GIF over an unhidden, differently-scaled poster) and fixed in CSS; the `[data-info]` gap closed on the control bar's trim handles + frame counter
- [ ] Item 5: Fabio's screenshot of the Background tint before CUT OUT — the only open polarity question
- [ ] Fabio's call: should the GIF tool RAIL say what each tool does? Its `info` is the tooltip too, so it needs a `data-tip` split; reverted rather than impose it
- [x] Fabio's eye pass on items 1-4 (2026-09-18): context menu PASS, Trim PASS ("I like the green indicators"), gallery multi-entry PASS
- [ ] **Backspace does not delete a frame in his app** — a REAL bug, not discoverability as the last session assumed. Real-key + tool-panel-open paths both work in the fixture; bisect with him: does a Ctrl-clicked thumb get the orange selection ring?
