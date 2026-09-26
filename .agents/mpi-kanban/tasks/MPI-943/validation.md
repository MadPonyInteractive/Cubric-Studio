# MPI-943 validation

## What shipped
- Drop images into the gallery, history (video branch), agent chat, prompt box or tool options: any disk-backed image over 3840x2160 px opens ONE `MpiOkCancel` for the whole drop, with a dropdown: Keep original size, 1-5 MP (1 MP = 1024x1024; each option shows the resulting size of the largest image). Default 2 MP, then the last choice for the session. Cancel / Escape imports nothing.
- Only the large images shrink; small ones in the same drop import untouched. The shrink is a sharp copy in a temp dir (`routes/imageImport.js`), imported through the normal upload route, so the original file is never touched. JPEG/WebP stay (q95), PNG stays, TIFF/HEIC/other land as PNG. EXIF orientation applied.
- Side win: a disk-backed image's size now comes from a header probe instead of a full renderer decode.

## Evidence (2026-09-26)
- `node --test tests/image-import-reduce.test.cjs`: 3/3. The orientation test reads PIXELS; proven to fail with `.autoOrient()` removed (dimensions alone passed on a squashed result).
- Real 16K file (16384x16384 noise JPEG, 176 MB): header probe 5 ms; shrink to 2 MP 1.2 s, rss 245 MB, output 1448x1448. Plain `sharp(file)` on it throws "Input image exceeds pixel limit".
- Same 16K file through the real app (one-off Electron spec, deleted after): dialog 126 ms after the drop; Import at 2 MP landed `imported_001.jpg` 1448x1448, sidecar `pixelDimensions` 1448x1448, card rendered, no page errors.
- `tests/desktop/image-import-reduce.spec.js`: 2/2 (one dialog for a 24 MP + 25 MP + 0.5 MP drop, both large ones shrunk to 1 MP, the small one untouched; Cancel imports nothing). Before the gallery hunk it failed with "This image is very large" (per-file fallback), which is what proves the batching.
- Full unit suite: 1990 tests, 1989 pass, 0 fail. Neighbouring desktop specs (gallery-drop-overlay-reset, agent-chat, media-picker-to-history, this one): 42/42. ESLint on the changed files: clean.

- CI on d7290b689 (run 36274288785): unit + desktop 1-4 all success.

## Not covered (by decision)
- Images already imported: re-drop from the original.
- Flow input drops (`placeContentAsset`) and agent/MCP imports: no dialog.

## Verified by Fabio (2026-09-26)
- The dialog looks good, tested live with one large image. The one-dialog-per-drop case is covered by the desktop spec above.
