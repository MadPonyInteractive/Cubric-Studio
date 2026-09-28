# MPI-961 Plan - Big photos (16K+) in History: display copy + detail layer

## Current State

- **Project mode:** scalable-foundation. **Umbrella:** MPI-962 (members MPI-959 EXIF, MPI-963 previews).
- **Design B approved** (Fabio, 2026-09-28): `brief.md` § Design. Goal in his words: no lag, and the UI
  never breaks or stops moving on a big image. Mask cap 1536 stays.
- **Baseline by hand - UNCONTROLLED: the GPU was BUSY** (another agent's job running; VRAM read
  10.4/16 GB). Timings below are "GPU busy", not a clean baseline. GPU-independent facts stand: the
  32K cannot decode, and the entry rows load the originals (MPI-963).
  (Fabio, live app 1.6.2, RTX 4060 Ti 16 GB / 64 GB RAM - NOT the tester's 16 GB),
  project "Big Photos Test" (`C:/Users/Fabio/Documents/Cubric Vision/Projects/Big Photos Test`):
  - phone photo 3072x4096 (`imported_001.jpg`): opens practically instantly.
  - 16K PNG 345 MB (`imageUpscale_002.png`, entry 3 of card "Base 1K"): **> 30 s** to show. The History
    entry rows first paint top-down one at a time (they load the ORIGINALS - MPI-963), then the canvas.
    **Switching tool takes "forever" to redraw - reads as the app being broken.**
  - 32K JPEG 57 MB (`imported_002.jpg`, from `~/Pictures/Big Photos Test/bigphoto-32k.jpg`): canvas
    **never shows**; its entry row is a broken image (MPI-963).
- **What the code does** (research/, code traces, Phase 1 measures them):
  - base + overlay canvases = the image, clamped only to GPU `MAX_TEXTURE_SIZE` (32768 on NVIDIA), so
    16K = two 1 GiB canvases; `_maskTintBuf` a third; `this.img` a fourth. Chromium's canvas AREA cap is
    16384^2 (268 MP), so a 32K image cannot have a full-size canvas at all.
  - EVERY pan tick and wheel tick runs `onDraw` = `_applyTransform(); draw()` (MpiCanvas.js ~:298), and
    `draw()` repaints base + overlay edge to edge. Only brush moves are clipped (`drawStroke`, MPI-787).
    A mode switch also runs a full `draw()`.
  - SAFE to shrink: mask / paint / comp / place buffers size from `this.img` (~:497-506), not from the
    base canvas; no code reads base/overlay pixels (only the destroy loops touch them); the MPI-960
    eyedropper is native `window.EyeDropper`. The overlay already runs smaller than the image (the
    `k = W / this.img.width` factor in `drawStroke`, and Place's `W / this.img.width`).
  - `research/consumers.md` has a WRONG "critical" list - see its correction header.
- **MPI-957** (doing/validating) landed `_DisplayMip` (zoomed-out mip siblings) in the same draw path; it
  stays and applies to the display copy. Its last gate is Fabio's eyes on a real 8K/16K zoomed out -
  the Big Photos Test 16K card serves both cards.
- **Where it stands (2026-09-28, session 48110acd):** Phases 0 + 1 DONE (card `doing`, claim
  `state/files/48110acd-mpi961.json`). Baseline GPU IDLE + GPU BUSY (Fabio's H3 video), the D2
  experiment and the MPI-963 rowfix control are all in `validation.md` (rig in `research/rig/`;
  run a scratch copy of it). **Next: Phase 2 (D3)** - see Plan Drift for its re-scoped target.
- **Phase 2 (session 9bb6f112, claim `state/files/9bb6f112-mpi961-p2.json`):** code DONE, uncommitted
  (`drawView`, dots/grid on the screen canvas, `_heldMask` lazy source-size mask); unit 103/103,
  desktop list + new `canvas-pan-no-repaint.spec.js` 16/16, new spec proven red on HEAD
  (`validation.md` § Phase 2). Also in: `_renderBase` skips an unchanged source (the swap
  `clearRect` blocks were base repaints on mode setters) and `_DisplayMip` reduces from the
  native canvas (else a level crossing re-decoded the 16K). Idle re-measure recorded. **Left:**
  the GPU BUSY re-measure - `ROWFIX=1 STROKE_AB=1 node perf.cjs full 16k after-busy-rowfix` from
  a scratch copy of `research/rig/` while Fabio runs a LOCAL video (no pod smoke on the lease). If
  busy wheel crossings are slow, add a per-level mip cache.
- **Headline:** (1) MPI-963's rows-load-originals is the biggest cost to OPEN and to Prompt<->tool
  swaps (16K idle open 37 s -> 5 s, 4K swaps 5 s -> 0.35 s with rows on thumbs). (2) Under GPU
  load, 16K pan/zoom/stroke fall to 2-6 fps because every tick runs a full `draw()` of the
  16384^2 canvases (189-322 ms to next frame vs 13.4 ms transform-only); 4K stays 75 fps under the
  same load. At idle both are 75 fps. (3) The 16K canvas's own open/swap cost: a 2.5-2.7 s block on
  first paint of the 16384^2 canvases, 1.4-2.2 s `toDataURL` in `swapToPreview`, 3.2-4.6 GB GPU
  memory (VRAM near full under load -> paging). (4) 32K fails in 0.6 s, blank.
- **Live claims:** none on `js/components/Primitives/MpiCanvas/**` or `MpiCanvasViewer.js` (checked
  2026-09-28); MPI-949's stack-crop edits there are committed (`f6119d0fe`).

## Decisions (front-loaded)

- **D1 Display cap.** `DISPLAY_MAX_EDGE = min(MAX_TEXTURE_SIZE, max(4096, 2 x screen long edge in device
  px))`, computed once at module load like `MAX_TEXTURE_SIZE`; a constructor option overrides it for specs.
  `ponytail:` a monitor change mid-session keeps the old cap - fine, it only sets sharpness at fit.
- **D2 Where the pixels come from - DECIDED: S1** (Fabio accepted the recommendation, 2026-09-28):
  - **S1 (CHOSEN):** the SERVER makes the display copy with sharp (`limitInputPixels: false`) as a
    cached rendition beside the thumbs (`<id>.display.webp`, same GC/derivative rules as `thumbPathLg`),
    made lazily on first open, so the renderer never decodes the original to open a card. The DETAIL
    layer decodes the original in the renderer OFF the main thread (`createImageBitmap` on the fetched
    blob) only on the first zoom past the display copy's 1:1, and `close()`s it on zoom-out / entry
    switch. Above Chromium's area cap (the 32K) there is no detail: zoom stays soft, one `app.log` line.
  - S2: server tiles for the detail too (a cached pyramidal TIFF per big image, regions served on
    settle): 32K sharp when zoomed, but a tiling route + ~1.3x the file size of extra disk per big photo.
  - S3: renderer only (`createImageBitmap` resize from the decoded original): least code; 32K never
    opens and the 16K open stays as slow as its decode.
- **D3 Pan/zoom never repaints image content.** During a gesture `onDraw` does transform + mip sync +
  screen UI only; the overlay's scale-dependent bits (mask point dots, grid) re-render on SETTLE. A mode
  switch repaints only what the mode changes.
- **D4 Detail layer** = a class mirroring `_DisplayMip`: two instances (base; compare with the same
  clip-path), screen-sized, drawn on settle (debounce ~120 ms - there is no gesture-end hook),
  `imageSmoothingEnabled = false` when the stack's `data-zoom-mode` is `pixel` (mirrors the CSS).
- **D5 Video:** display cap on BOTH sizing twins (`_sizeImageCanvases` and the `loadVideo` block ~:600),
  no detail layer.

## Completed

- [x] Brainstorm + design approval; fixtures made; four read-only investigations (`research/`).
- [x] Phase 0 pickup; Phase 1 baseline (idle + busy + rowfix control + D2) in `validation.md` (2026-09-28).

## Remaining Work

**Why no Parallel Batch:** Phases 2-4 all rewrite the one draw path in `MpiCanvas.js`; splitting it
across workers would collide in one file. Phase 3's server rendition could be a lane, but its only
consumer is Phase 3's renderer half, whose Verify needs it - a forward dependency, so it runs first
inside the phase instead. MPI-959 / MPI-963 (umbrella Batch 1) are the parallel work.

## Phase 0: Pickup

- [x] Re-read this plan, `brief.md`, MPI-957's `validation.md`; `git log -3 --` the two canvas files;
  check `state/index.json` claims. Move MPI-961 `todo -> doing` with `files.json`
  (`js/components/Primitives/MpiCanvas/MpiCanvas.js`, `.../managers/InputController.js`,
  `js/components/Organisms/MpiCanvasViewer/MpiCanvasViewer.js`, the S1 server rendition files - the
  thumbnail writer in `routes/projects.js` is shared with MPI-959/963, so coordinate or sequence - new
  specs). **Verify:** `validate_board.py .` passes; claim record + `active_file_claims` line both exist.

## Phase 1: Measure the baseline (research - no product code)

- [x] Launch `npm run app:isolated` (GPU on; NEVER the desktop harness - it runs `--disable-gpu`). Copy
  "Big Photos Test" into a scratch projects root; open it on the isolated port only. Record, on the 16K
  entry AND on the 4K entry of the same card (the 4K is the CONTROL: it predicts what a display copy
  buys before building it - feedback `a_control_sizes_a_gap`):
  (a) open time to first paint, split into entry rows vs canvas; (b) one `draw()` call timed in the
  console, vs `_applyTransform()` alone; (c) pan and wheel-zoom frame time (rAF intervals, 3 x 3 s);
  (d) a mask stroke's frame time (MPI-787 method); (e) tool-switch time (Prompt -> Mask -> Paint);
  (f) renderer + GPU process memory after open and after Mask (MPI-633 method); (g) the 32K: what
  fails and where (console errors, `img.onerror`, a zero-size canvas).
  **Two conditions, each run:** GPU IDLE (`nvidia-smi` util < 5 % before starting, no peer GPU job -
  check the GPU lease / ask) and GPU BUSY (a local generation running on the same GPU for the whole
  run - ask Fabio to start a video generation in HIS app, never drive `:3000` yourself). Record the
  `nvidia-smi` util + VRAM reading beside every number. Busy is a real use case (masking while a
  generation runs), not noise.
  Experiment for D2: in the isolated console, time `createImageBitmap(blob)` of the 16K original and of
  the 32K (does it succeed? main-thread block?), and `sharp` making a 4096 webp from each (Node).
  **Verify:** `validation.md` § Baseline holds every number WITH the command/snippet that produced it
  (feedback `record_the_command`); the D2 experiment result is recorded; the top time and memory costs
  are named with numbers, not guesses.

## Phase 2: Pan / zoom / tool switch without repainting the image (D3)

- [x] Split `onDraw` into a view-only path (transform, `_baseMip`/`_compareMip` sync, screen UI) and a
  settle pass (overlay scale-dependent items). Find why a tool switch redraws for so long (Phase 1 e)
  and fix THAT cause - a full reload of the image is a different bug from a full `draw()`.
  **Verify:** the 6 `.cjs` suites importing `MpiCanvas.js`; desktop `history-modes`, `mask-colour`,
  `mask-persist-roundtrip`, `canvas-downscale-quality`, `compare-native-resolution`,
  `crop-resize-output`, `stack-crop`, `gif-cutout`; a new spec proving a pan tick does not call
  `_renderBase` (spy) AND fails on HEAD; Phase 1 (b)(c)(e) re-measured on the 16K.

## Phase 3: Display copy (D1, D2 display half, D5) - user-ux checkpoint

- [ ] Server rendition first (S1): sharp -> `<id>.display.webp` at `DISPLAY_MAX_EDGE`, cached beside
  the thumbs, made on first request, covered by the derivative GC and the delete paths. Unit test on a
  16K + a 32K fixture (sharp, `limitInputPixels: false`).
- [ ] The History PROMPT preview (`MpiMaskedImagePreview`, both `<img>`) shows the display copy too:
  zooming it re-decodes the 345 MB original at every new raster scale (fit -> 1x took 11.6 s,
  10 stalls to 2.7 s; `validation.md` § Zoom IN). Same for `swapToPreview`'s image load.
- [ ] Renderer: sweep every `this.img` / `_displayImage()` consumer and classify DIMENSIONS (keep natural
  size - managers, `k` factors, ViewManager fit, crop) vs DRAWABLE (draw the display copy). Size base +
  overlay (+ tint buffer, which follows the overlay) + compare to the display copy; both video twins.
  **Verify:** unit suites + the Phase 2 desktop list; a new spec with the cap forced to 1024 on a 2048
  fixture: crop / mask / paint / place outputs are byte-equal to the uncapped run (they read the
  original on the server), and the spec FAILS if a site draws the display copy where natural size is
  needed; Phase 1 (a)(c)(d)(f) re-measured on 16K + 32K, GPU idle AND GPU busy (Fabio runs a local
  video; this run also stands in for Phase 2's busy re-measure), plus the rig's `zoomin` mode
  (canvas + Prompt preview). **Fabio (user-ux):** 16K opens fast, pans,
  masks and switches tools smoothly; the 32K opens.

## Phase 4: Detail layer (D4, D2 detail half) - user-ux checkpoint

- [ ] Screen-sized detail canvas under the compare canvas, redrawn on settle past the display copy's
  1:1; compare instance with the same clip-path; pixel mode honoured; original decoded off-thread on
  first need and released on zoom-out / entry switch.
  **Verify:** a desktop spec on the forced-cap fixture: at 2x zoom after settle a 1px grating reads
  sharp (std > 40, MPI-957's method) on base AND compare side, soft (std < 10) before settle is not
  asserted; pixel mode shows hard edges above `AUTO_PIXEL_THRESHOLD`; memory after zoom-out returns to
  the Phase 3 level. **Fabio (user-ux):** zoom into the 16K - soft while moving, sharp when stopped.

## Phase 5: Close

- [ ] Final table (baseline vs after) in `validation.md`; docs: the canvas subsystem doc (route via
  `docs/README.md`) gains the display-copy + detail-layer model; ask Fabio before touching
  `.claude/rules/component-mounts.md` (new canvases, as MPI-957 did). Tester build is Fabio's call.
  **Verify:** claim-auditor at close-out; CI green on the code commit before the close commit.

## Plan Drift

- 2026-09-28 (Phase 1): the instrument is a Playwright GPU-ON Electron rig, not a literal
  `npm run app:isolated` - that instance has no CDP port. Same isolation (own port, userData,
  APP_DOCUMENTS, empty engine root). With no engine there is no model, so History opens in
  Transform/Crop and Prompt is reached through the rail's `setMode`.
- 2026-09-28 (Phase 1): D3 is idle-invisible but load-critical. At GPU idle 16K pan/wheel run at
  vsync; under a local video generation they fall to 2-6 fps with a 189-322 ms `draw()` frame vs a
  13.4 ms transform-only frame. **Phase 2 stays, re-scoped:** its target is the GPU-BUSY 16K pan /
  wheel / stroke numbers, and its Verify re-measures them busy (Fabio runs a video again). Its
  "tool switch" half is re-scoped too: the multi-second swaps are MPI-963 (rows) plus the 16K
  canvases' first paint (`clearRect` / `_renderBase` 2.4-3.3 s) and `swapToPreview`'s `toDataURL`
  (1.4-4.6 s) - the first two are MPI-963's and Phase 3's; Phase 2 looks only at `toDataURL`.
  The mask stroke under load goes through `drawStroke` (clipped, MPI-787), yet still collapses at
  16K - so the clip alone does not save it; find why in Phase 2 (profile a busy stroke).
- 2026-09-28 (Phase 1): MPI-963 (umbrella member) should land BEFORE Phase 3 is measured - its
  rows cost dominates every 4K/16K number and would mask the display copy's effect.
- 2026-09-28 (Phase 2 start, session 9bb6f112, Fabio "go"): D3's "overlay scale-dependent bits
  re-render on SETTLE" is replaced by MOVING them - mask point dots and the grid (no live caller)
  draw on the screen-UI canvas, so the overlay no longer depends on the view at all and a pan /
  wheel tick (`drawView`) never touches base or overlay; no settle timer. `swapToPreview`'s
  `toDataURL` is the mask scaled UP to the source (16384^2) and PNG-encoded on every switch to
  Prompt; only dispatch needs that size, so the preview holds the working-size mask and the
  source-size encode runs once, on the first dispatch that asks (tradeoff accepted: a Generate
  from Prompt mode pays it at click time). The busy stroke is an A/B in the rig (overlay backing
  16384^2 vs 4096^2) - diagnosis only; its fix is Phase 3's display copy if the A/B points there.
- 2026-09-28 (Phase 2 close, Fabio): the separate Phase 2 GPU-BUSY re-measure is SKIPPED - Phase 3
  moves the same numbers again, so ONE busy run after Phase 3 covers both (Phase 3's Verify now
  carries it). Order from here (Fabio "go with that order"): MPI-963 (rows on thumbnails) FIRST,
  then Phase 3 (display copy for the canvas AND the Prompt preview), then Phase 4.
- 2026-09-28 (Phase 2, measured): Phase 1's "swap clearRect = fresh overlay's first paint" was
  wrong - call trees put it in `_renderBase` under the mode setters (unchanged base repainted,
  twice on Prompt -> Mask). Fixed here per D3 (repaint only on a source change), which forced the
  display copy to reduce from the native canvas instead of the `<img>` (a level crossing had
  started re-decoding the 16K, 2.4 s). What stays for Phase 3: one 16K first paint per mount.

## Verification

**Verify mode:** user-ux

Phase 1 is research (auto). Phase 2 is auto (specs + numbers). Phases 3 and 4 stop for Fabio: only a
person panning and masking a 16K photo tells whether it "keeps up". Every before/after pair is taken
under the SAME GPU condition (idle vs idle, busy vs busy); Fabio's own check runs with a video
generation going, since that is the case he hit. Done = every Phase 1 number
re-measured after, Fabio's OK on 16K (smooth) and 32K (opens), and a green CI on the code commit. The
tester's OK on his 16 GB machine is a bonus, not a gate.

## Preservation Notes

- Docs: canvas subsystem doc (display copy, detail layer, D3 view-only redraw); `docs/testing.md` if the
  isolated perf recipe is worth keeping as a script.
- Memory: the desktop harness runs GPU-OFF - never take perf numbers there (already in MPI-633's
  validation; check `tools-index.md` holds it before adding).
- Rules: `component-mounts.md` names the new canvases - ask first.
