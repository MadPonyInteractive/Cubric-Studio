# MPI-933 Checklist

- [x] `/project-media/:id/upload`: an SVG image renders to PNG (declared size, long edge raised to 2048, capped at 4096); the `.svg` is never written (Fabio: replace it).
- [x] Sidecar and response carry the PNG's pixel size; `mediaUploadService.js` uses it.
- [x] Thumbnails exist for the imported SVG.
- [x] Test: sourcePath and base64 imports, small and huge declared sizes, alpha kept.
