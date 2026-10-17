# MPI-1163 checklist

- [x] Failing test: a stall past the retry budget fails over to the mirror (partial kept)
- [x] Failing test: a zero-progress stall fails over; a 4xx / local error does not
- [x] Change in routes/downloadManager.js error handler
- [x] HF mirror holds each engine-asset weight (HF API paths-info + sha256, not an HTTP probe)
- [x] npm test green (3381 pass, 0 fail, 2026-10-17)
- [x] docs/releases/UNRELEASED.md line; docs/download-manager.md section
