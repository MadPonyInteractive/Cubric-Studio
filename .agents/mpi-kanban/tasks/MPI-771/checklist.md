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
- [x] Item 5: the Background tint question — RESOLVED without the screenshot, see the tint-rule line below. No screenshot needed
- [x] Fabio's call on the RAIL: yes, on the status bar; no floating tooltips. Built, see below
- [x] Fabio's eye pass on items 1-4 (2026-09-18): context menu PASS, Trim PASS ("I like the green indicators"), gallery multi-entry PASS
- [x] **Backspace does not delete a frame in his app — ROOT-CAUSED AND FIXED (2026-09-18).** Fabio confirmed the orange ring, so selection was never the fault. `hotkeyManager._normalizeKey()` builds `control+backspace` while the selection modifier is still held, and the registry carried only bare `backspace`, so `_handle` returned at the `handlers` lookup before any handler ran — silently. Three registry ids now cover bare / ctrl / shift; the spec's press carries `ctrlKey: true` and was PROVEN RED on the pre-fix files first
- [x] The rail says what each tool does ON THE STATUS BAR, never as a floating tooltip (Fabio, 2026-09-18) — a `desc` per GIF rail entry. The wrap keeps the NAME (the rail's own `mouseover` tooltip reads the wrap), and MpiButton's `info` carries the sentence, because statusBar.js resolves `closest('[data-info]')` and so never sees the wrap. Every existing spec selector targets the wrap by name and still matches
- [x] ONE tint rule everywhere: THE TINT IS WHAT GOES (Fabio, 2026-09-18) — `flip = !_invert`, and the per-method `#tint-note` badge deleted. This also CLOSES the "Background tint over the background while the cut kept the robot" question: no polarity bug, it was the old "tinted = what stays" semantics read the natural way
- [x] Scope consolidation (Fabio, 2026-09-18): four buttons became **Mask** + **Clear** with an All / Frame / **Selected** `MpiRadioGroup`. Selected is the strip's Ctrl-click set, reaching the panel through a new `selection-change` event + `setSelection()`. Found on the way: the scope radio could visually diverge from `_scope` when a run was busy — it locks with the method radio now
- [x] The re-key TOAST is gone (it fired on every paused slider drag). The picker's and Tolerance's `info` say "Changes are only visible once you press Mask" on the status bar instead
- [ ] Fabio's eye pass on the six items above
- [ ] **Mask display consistency (Fabio, 2026-09-18) — investigated, NOT built, needs his scope call.** The GIF Mask Brush already mounts the image `MpiMaskStrip` (invert, B/W view, opacity, clear) and `MpiGifViewer` implements all of it. The gap is the CUT-OUT TINT, a read-only preview at a fixed `--accent-heat` 0.45 with no controls at all
- [x] **Consistency audit finding 4 (2026-09-19): the GIF STAGE joined the shared context menu.** `MpiGifViewer` emits `gif-viewer:context-menu` the way `MpiVideoViewer` and `MpiCanvasViewer` do; the Block's `isGif` branch owns the items (Save frame as image / Reverse frames / Clear all masks, the last dead with no masks). Frame-scoped verbs stay on `MpiFrameStrip`'s own menu
- [x] **Finding 3: the two panels that were nothing but an Apply are gone from the rail.** `gifReverse` + `gifSaveFrame` removed from `GIF_TOOLS`, `TOOL_OPTIONS_REGISTRY`, `_GIF_TIMING_TOOLS`, `_GIF_TRANSFORM_TOOLS`, `TOOL_LABELS` and both panels' own `TOOLS` tables. Their handlers are untouched - the context menu calls them. `gifTrim` keeps its panel: its note is real UI, not just an Apply
- [x] Verify: `lint` + `lint:components` clean; the new `gif-workspace.spec.js` stage-menu test PROVEN RED with `MpiGifViewer.js` + `MpiGroupHistoryBlock.js` restored from HEAD, then 3/3 green
- [x] **Finding 1: Cut-out mounts the shared MpiMaskStrip.** It now calls `enterMode('mask')` and mounts `MpiMaskStrip({ viewer, brush: false })`, the same component the Mask Brush and every image mask tool mount - opacity, invert display, B/W view, clear. Fabio re-confirmed the rule (*"everything that's masked is what's supposed to disappear in any world"*), and `setMaskInverted` is NOT a geometric complement (`MpiCanvas.js:972` recolours the mask black), so the canvas is fed the already-flipped bitmap through a new `MpiGifViewer.setCutoutPreview()` display override. Read-only by construction. Clear routes to `clearFrameMasks(index)` under the override. Consequence: Cut-out is a canvas tool, so the built-.gif preview toggle is off in it like the Mask Brush, and the stage shows one frame until Play
- [x] **Finding 2: CLOSED by Fabio, no change.** *"I don't care about timing anymore. Leave it as it is."* Timing keeps its group
- [ ] Finding 5: the GIF output tool gets the GIF Maker's preview pane. Needs no decision
- [ ] Fabio's eye pass on the WHOLE workspace (nothing closes before it)
- [x] Fabio PASSED the context menus (2026-09-19): *"Menus are good, and context looks good. The context pop-up looks good."*
- [x] Verify (finding 1): the strip assertions in `gif-cutout.spec.js` test 1 PROVEN RED with the panel, viewer and Block restored from HEAD, then green; gif-cutout 1/3/4 + gif-workspace 3/3 + mask-colour 1/1 green; lint + lint:components clean; `node --test` 1372 pass, the only 2 failures being peer live-model harnesses with no DEEPINFRA_API_KEY
