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
