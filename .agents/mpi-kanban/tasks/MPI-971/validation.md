# MPI-971 validation

Verify mode: user-ux for Phases 2 and 3 (Fabio looks at a 16K result); Phases 1 and 4 self-verify.

## Phase 1 — PASSED 2026-09-30 (session 8aad9989, self-verify)

- `node --test tests/engine-input-cap.test.cjs` 5/5: exactly 4096 = original, nothing written;
  4097 = lossless PNG at 4096, `<id>.thumb.engine4096.png` under DERIVATIVE_RE, cache hit not
  re-made; EXIF 6 turned upright (3000x6000 reported, 2048x4096 copy, no orientation left);
  sidecar-less file = temp copy, nothing written beside it; the `modelSizedInputs` op list pinned,
  and upscale / detail / inpaint / imageUpscale / removeBackground / resize never carry it.
- `npm test` 2390 pass, 0 fail. ESLint clean on the four files.
- Live, my isolated instance (own profile, port, APP_DOCUMENTS; the shared engine on 48188 under a
  GPU lease; Fabio's :3000 untouched), 16384 x 16384 JPEG fixture (268 MP):
  - control, before the bare-path fix: `MpiLoadImage failed: PIL.Image.DecompressionBombError:
    Image size (268435456 pixels) exceeds limit of 178956970 pixels` (app log 11:02:21Z).
  - Klein 4B `kleinEdit` on the 16K: card landed, 1024x1024, 18.8 s; app log
    `engine-image: fix16k.jpg 16384x16384 -> 4096 copy`.
  - MiniMax H3 `i2v_ms` (very_low, 1:1, 1 s) on the 16K: video card landed.
  - Klein 4B `kleinEdit` on a 2048 x 1280 fixture: card landed, no engine-image line.
  - ComfyUI `/history`, sha256 of each staged `MpiLoadImage` path: both 16K edits and the H3
    `Input_Start_Frame` = the 4096 copy; the 2K edit = `fix2k.jpg` byte-for-byte.

## Phase 2 — automated checks PASSED 2026-09-30 (session 8fdc58f8); AWAITING Fabio's look (user-ux)

- `node --test tests/engine-mask.test.cjs` 6/6 (cap shrunk so fixtures stay small): the cut rect
  maths (square round the box, slid inside, scaled to the cap); a photo within the cap untouched;
  a non-crop op gets the mask at the photo size; crop + stitch at 1:1 and scaled-down: engine gets
  outW x outH with mask == image, the card is the source size, the masked pixels are the edit and
  every probe past the band equals the original exactly; EXIF 6 cut in upright px.
- `npm test` 2392 pass, 0 fail, 2 skipped. ESLint clean on every touched file.
- Live, my own Electron (Playwright launch, own port + profile + APP_DOCUMENTS, shared engine on
  48188 under a GPU lease, Fabio's :3000 untouched), real renderer path `enqueueGeneration` ->
  `_fitMaskedInputs` -> Klein 4B `kleinEdit` -> `_stitchOutputs` -> save-generation, mask handed
  over at the canvas's new working size (4096^2):
  | photo | mask (photo px) | cut sent to engine | card | time | outside the mask | mask centre |
  |---|---|---|---|---|---|---|
  | 16384^2 | 1600^2 | 1856^2 at 1:1 | 16384^2 PNG | 29 s | 0 bytes differ (3 tiles) | mean diff 92 |
  | 16384^2 | 12000^2 | 12256^2 -> 4096^2 | 16384^2 PNG | 34 s | 0 bytes differ | mean diff 90 |
  | 32768^2 | 3200^2 | 3456^2 at 1:1 | 32768^2 PNG | 31 s | 0 bytes differ | mean diff 107 |
  | 32768^2 | 24000^2 | 24256^2 -> 4096^2 | 32768^2 PNG (651 MB) | 61 s | 0 bytes differ | mean diff 67 |
- ComfyUI `/history` for the 16K runs: staged `Input_Image` and `Input_Mask` are 1856x1856 and
  4096x4096, status success — the engine never saw the 16K. App log: `engine-mask: ... cut {...}`
  then `engine-stitch: ... 16384x16384 <- 4096x4096 at 2064,2064`.
- Looked at: an apple inside the small square, red tulips filling the big one, clean edges.
- NOT run: the Pod path (costs money — asked). Fabio's look in his own app (user-ux).
