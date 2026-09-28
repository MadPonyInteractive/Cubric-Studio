# Canvas Size Consumer Audit

> **CORRECTION (main session, 2026-09-28):** the "critical sites" below are mostly WRONG. Mask /
> paint / comp / place buffers are sized from `this.img` (`MpiCanvas.js` `mask.init(this.img.width, ...)`
> ~:497-506), NOT from baseCanvas, and every export reads those manager buffers. A grep for pixel
> reads of `baseCanvas` / `baseCtx` / `overlayCanvas` outside MaskManager (whose `baseCanvas` is its
> OWN 1536 buffer) finds only the destroy loops (~:403/:407). The MPI-960 eyedropper is native
> `window.EyeDropper` (screen pixels). So a reduced display copy changes no export. Trust this file's
> SAFE list only.

## Scope
Finds every code site that would break if baseCanvas/overlayCanvas/maskCanvas are resized from full-image pixels to display-clamped (~4096px).

---

## (A) PIXEL READING: getImageData / toDataURL / toBlob

| File:Line | Code | Impact if canvas becomes display-sized |
|-----------|------|----------------------------------------|
| MaskManager.js:494 | baseCtx.getImageData(0, 0, w, h) | Reads display pixels, not full-res mask |
| MaskManager.js:708 | src.getContext().getImageData(0, 0, w, h) | Samples wrong pixels from source |
| MaskManager.js:867 | srcCanvas.toDataURL + getImageData | Exports canvas at whatever size it is |
| MaskManager.js:942 | maskCtx.getImageData(0, 0, w, h) | CRITICAL: getMaskDataURL() reads display-sized buffer |
| MaskManager.js:979 | if (w === canvas.width) return canvas.toDataURL() | Conditional upscale fails; exports display size |
| PaintManager.js:580 | paintCtx.getImageData(0, 0, w, h) | CRITICAL: Paint export at canvas size |
| CompositeManager.js:377 | holeCtx.getImageData(0, 0, w, h) | Hole analysis at wrong resolution |
| CompositeManager.js:398,404 | holeCanvas.toDataURL() / out.toDataURL() | Exports at canvas size |

**Problem**: All exports read from canvas pixels. If canvas is ~4096 display copy, exports are 4096px not full-res. Server expects full resolution.

---

## (B) COORDINATE MAPPING: canvas.width/height assumed = image pixels

| File:Line | Code | Impact |
|-----------|------|--------|
| MpiCanvas.js:939 | const k = W / this.img.width | CRITICAL: Stroke clipping scale factor wrong. Scales image-px coords incorrectly if W is display-clamped. |
| MpiCanvas.js:940-943 | Uses k to clip: x0 = box.x * k | Stroke rendered at wrong screen position/size |
| MpiCanvas.js:442 | mask.manualCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height) | If mask canvas is MASK_MAX_EDGE (~1536), drawImage stretches |
| cropTool.js:76,79 | overlayCanvas.width in letterbox math | Already Safe: cropTool uses targetElement.naturalWidth, fallback only for empty rect |
| cropTool.js:143-145 | overlayCanvas.width / b.w in maxNorm | Already Safe: only used in allowOverflow mode as padding headroom |

**Key Issue**: Line 939 assumes overlayCanvas.width == this.img.width. Must store display scale separately.

---

## (C) SAFE: Uses this.img.width/height (source of truth)

PASS CropManager.js:41-125 -- Stores _imgW, _imgH; returns image-px coords
PASS InputController.js:437-442 -- _getImageCoords uses stackEl rect + view.scale, not canvas dims
PASS ViewManager.js:21-49 -- Uses img.width/height directly
PASS ViewManager.js:73-87 -- Receives imgW, imgH as params, not inferred
PASS MpiCanvas.js:1017 -- comp.drawPlaced(..., W / (this.img.width || W)) correctly scales

**All coordinate transforms safe if image dims passed separately.**

---

## (D) EXPORT PATHS: Server receives what size?

### Crop
- Client: getCropRect() returns image-px normalized or absolute coords => SAFE
- Server: Applies crop at full-res

### Mask
- **Client**: getMaskDataURL() => maskCtx.getImageData(0, 0, w, h) => toDataURL(image/png)
  - **CRITICAL**: Export is at canvas size, not image size. If canvas is 4096, mask PNG is 4096.
- **Server**: Expects mask to match image size. If smaller, will upscale or fail.
- **Fix needed**: Upscale mask canvas to image size before export, OR handle at server-side

### Paint  
- **Client**: paintCanvas is PAINT_MAX_EDGE (~4096 max). toDataURL at that size.
- **Server**: Sharp upscales on apply (intentional design, see PaintManager.js:32-39)
- **Status**: SAFE (already designed for this)

### Composite Hole/Underlay
- **Client**: setHole() outputs holeCanvas at its size. drawPlaced() correctly scales by W/(image.width).
- **Server**: Receives composite at canvas size
- **Status**: drawPlaced is SAFE. Hole canvas size mismatch **possible** if hole canvas != overlayCanvas.width

---

## Summary: Critical Sites

If baseCanvas/overlayCanvas change to ~4096 display copy:

1. **MpiCanvas.js:939** k = W / this.img.width => MUST add display-to-image scale factor
2. **MaskManager.js:942** getMaskDataURL() exports at canvas size => MUST upscale to image size
3. **MaskManager.js:979** Upscale conditional => MUST fix size check
4. **All mask layer initialization** => Verify _scale computation still correct for display canvas
5. **CompositeManager hole canvas** => Ensure hole size matches overlayCanvas size or scale on draw

---

## Verification  
All grep/read operations performed 2026-09-28.
