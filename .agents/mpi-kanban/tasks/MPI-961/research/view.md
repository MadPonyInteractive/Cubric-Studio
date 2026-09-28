# MpiCanvas Detail Layer Investigation

## 1. ViewManager: State & Coordinate Mapping

**File: ViewManager.js**
- **Lines 6-13**: State properties: offsetX, offsetY, scale (min: 0.1, max: 10), isManagedView (auto-center toggle)
- **Lines 18-49 (reset)**: Fits image to container via scale = Math.min(cw/iw, ch/ih), centers offsets
- **Lines 58-63 (handleResize)**: Adjusts offsets by half the size delta to maintain visual center
- **Lines 73-87 (getViewState)**: Returns current transform; if managed, recalculates fit
- **Lines 102-112 (refit)**: Re-fits managed view to a fitBox (default: image bounds). Handles crop rect extending past image (MPI-383)
- **Lines 118-120 (getCSSTransform)**: Returns translate(offsetX, offsetY) scale(scale) for stackEl

**Screen-to-Image Mapping:**
- **InputController.js:430-437**: Container px to image px via (container.x - view.offsetX) / view.scale
- **InputController.js:157-165 (wheel zoom)**: Cursor remains fixed in image-space during zoom via coordinate transform
- **devicePixelRatio**: Referenced in _DisplayMip.sync (MpiCanvas.js:974) and _drawComparisonLayer (MpiCanvas.js:1160) as scale factor for GPU texture sampling, not view transform

## 2. Canvas Stacking Order (DOM & CSS)

**File: MpiCanvas.js, _CanvasCore constructor (lines 189-239)**
1. stackEl (div, mpi-canvas__stack): position: absolute; top: 0; left: 0; transformOrigin: 0 0; transforms via CSS
2. baseCanvas (image native px): data-role="base"; drawn first
3. _baseMip canvas (display mip): created after base (line 207), positioned absolute at native size
4. compareCanvas (after media native px): data-role="compare"; own aspect, positioned via left/top/width/height
5. _compareMip canvas: created after compare (line 219)
6. overlayCanvas (image native px): data-role="overlay"; mask/crop/grid
7. screenUICanvas (container px): appended to container NOT stackEl (line 239); data-role="screen-ui"; pointerEvents: none; brush ring, slider, crop rect, shape gizmo

**Stacking Rules:**
- _DisplayMip hides native when zoom < 0.5 (line 154): native.style.visibility = hidden; _DisplayMip drawn at next pow-of-2 level down
- compareCanvas under overlay (line 218 appended before overlay line 229): comparison shows through paint/mask/grid
- crop rect + shape gizmo: drawn on screenUICanvas only (line 1093-1096), never clipped by image bounds

## 3. Pixel Mode & Zoom Threshold

**AUTO_PIXEL_THRESHOLD = 3.0** (state.js:228)

**CSS Path (styles/01_base.css:437-459):**
- html.pixel-mode-pixel: image-rendering: pixelated (always)
- html.pixel-mode-smooth: image-rendering: auto (always)
- html.pixel-mode-auto: base is auto; when stackEl data-zoom-mode="pixel", canvases use pixelated
- compareCanvas honors its own data-zoom-mode attribute (MpiCanvas.js:1159, checked separately from stack)

**Zoom-Mode Assignment (MpiCanvas.js:870-872):**
- Set when scale >= 3.0: stackEl.dataset.zoomMode = pixel / smooth
- Called in _applyTransform() after every scale change

**imageSmoothingEnabled:** Not set explicitly in JS (uses browser default = true). CSS image-rendering controls anti-aliasing via browser rendering pipeline, not context property.

## 4. Comparison Mode & Clipping

**compareCanvas Placement (MpiCanvas.js:1135-1154):**
- Sized to after media native px (clamped to MAX_TEXTURE_SIZE)
- Positioned as cover-fit into base frame: relScale = max(baseW/afterW, baseH/afterH)
- Left/top offset: (baseW - compW) / 2, (baseH - compH) / 2
- **Clip path via CSS inset**: inset(top right bottom left) = inset(-compY, compX+compW-baseW, compY+compH-baseH, left)
  - Maps slider position to image px: clipX = (sliderPos * screenW - offsetX) / scale
  - This clip trims to base frame AND applies the split slider
- **After media's own zoom-mode**: scale differs from stack when resolutions differ; set separately (line 1159)

**Comparison does NOT get separate detail layer:** compareCanvas is already clipped to base frame by CSS; detail layer would need same clip treatment if added under it.

## 5. Crop Mode & _refitForCrop

**File: MpiCanvas.js:958-965**
- Called each frame in draw() (line 915)
- **Suppressed while dragging** (crop.isDragging flag set in InputController:212)
- **Gesture boundaries:** InputController.js:328 (crop.endDrag on mouseup) + InputController.js:287-289 (drag during mousemove)
- CropManager.getFitBox() returns { x, y, w, h } bounding image + crop rect, or null

## 6. drawStroke / _renderOverlay Coordinate Mapping

**File: MpiCanvas.js:934-946 (drawStroke)**
- k = overlayCanvas.width / img.width (overlay canvas width / full image width)
- Maps image-px box to overlay-px box via multiplication by k
- Clipped to [0, W) and [0, H) to stay in canvas bounds

**_renderOverlay Verification (MpiCanvas.js:983-1086):**
- Overlay already tested with MAX_TEXTURE_SIZE clamp (loadImage line 491-495 clamps all canvases uniformly)
- Called with clip param (MPI-787): only that rect inside overlayCtx is cleared & redrawn
- Compare layer (destination-in + holeCanvas) sits BEFORE mask/paint in z-order (line 1001-1007)
- No special handling needed for clamped overlay; the k factor normalizes all coordinates

**Paint & Mask Drawing (lines 1026-1062):** Both use ctx.drawImage(layer, 0, 0, W, H), respecting the overlay's actual size.

---

## Summary

- **ViewManager** provides screen to image coordinate transforms; scale/offset track pan/zoom; no devicePixelRatio in transform
- **Stacking:** baseCanvas + _baseMip to compareCanvas + _compareMip to overlayCanvas to screenUICanvas (separate, container px)
- **Pixel mode:** AUTO_PIXEL_THRESHOLD = 3.0 sets stackEl.data-zoom-mode; CSS handles imageSmoothingEnabled via image-rendering
- **Comparison:** Uses CSS clipPath inset() to apply slider + frame clipping; separate zoom-mode for resolution mismatch
- **Crop:** _refitForCrop suppresses refit during drag; gesture start/end marked by InputController.mouseup
- **Detail layer sizing:** Would use k = visibleW / fullW scale factor for drawImage (sx, sy, sw, sh, dx, dy, dw, dh); overlay clamp path already exercised; imageSmoothingEnabled = false on detail canvas matches pixelated CSS at 1:1 threshold
