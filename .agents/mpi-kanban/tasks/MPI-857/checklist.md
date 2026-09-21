# MPI-857 — checklist

- [x] `Duplicate frame` in the strip's right-click menu, beside Delete
- [x] The copy carries the source frame's cut-out mask (fresh order token, no `_viewerPos` collision)
- [x] Staged only: the pill rises, nothing reaches the server until Update/Apply
- [x] A multi-thumb Ctrl-click selection duplicates each frame after itself
- [x] `tests/desktop/gif-workspace.spec.js` covers the new row and the staged insert
- [x] `docs/gif.md` + `js/components/types.js` name the third menu row

All six verified against `b2a6ecb2`'s diff on 2026-09-21; evidence in `validation.md`.
