# MPI-1072 validation

Fabio, 2026-10-11: an Extract button in every mask mode — the masked area kept, everything
else removed, onto transparency or a colour. Image workspace shipped here; the video
workspace has no mask tools at all yet, so its half is MPI-1073.

## What shipped

- `services/imageComposite.js` `extractThroughMask()` — mask luma becomes the alpha, the
  image's own alpha is the ceiling, removed pixels get RGB zeroed, optional flatten onto `#rrggbb`. PNG.
- `routes/projects.js` `POST /project/extract-media` — new entry `extract_NNN.png`, sidecar
  `operation: 'extract'`, renditions; rejects a non-`#rrggbb` background with a 400.
- `MpiCanvasViewer` `el.extractMask({ background })` → emits `mask-extracted`; the Block
  appends the entry like crop / paint / place.
- `MpiMaskStrip` (dest `mask`) — Transparent / Colour radio, colour picker (shown on Colour),
  Extract button; both choices persist under `toolSettings.mask`. Gated on the viewer having
  `extractMask`, so the GIF viewer's strip does not show it.

## Evidence

- `node --test tests/image-extract.test.cjs` — 4/4 pass on PIXELS: JPEG source → RGBA PNG
  with the outside `[0,0,0,0]`; colour flatten; an already-transparent pixel stays
  transparent under a white mask; greyscale source → RGBA.
- Related suites (18 mask / composite / paint / op-strip files): 206/206 pass.
- ESLint on the three changed JS files: clean.
- Route probe (bare express + real router, scratch project): transparent 200 → 4 channels,
  left `[0,0,0,0]`, right opaque source colour; colour 200 → left `[0,0,255]`; bad colour 400;
  sidecar `operation: extract`, `sourceFile` = the source.
- Live UI, isolated instance on a SCRATCH engine + models root (the tree's `node_lock.json`
  carries a peer's unshipped pins, so the real engine was never touched): Mask Brush on a
  512² card → Extract row under the strip; Colour shows the picker; Extract onto white landed
  `extract_001` (corner `[255,255,255,255]`, centre opaque red); Transparent landed
  `extract_002` (corner `[0,0,0,0]`, `hasAlpha: true`); Extract with no mask → the
  "Nothing masked yet" toast and no entry.
- Not driven live: a SAM3 text detection → Add → Extract (no engine in the sandbox). It
  reads the same committed `maskCanvas` the brush writes, so it is the same path.
