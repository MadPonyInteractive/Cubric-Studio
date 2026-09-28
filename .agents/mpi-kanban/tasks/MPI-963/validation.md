# MPI-963 validation

## Phase 1 - 2026-09-28, session 9bb6f112 (on master `47e8e796c`)

### Change

- `MpiHistoryList.js` `_makeCard`: an image row loads `item.thumbPath || item.filePath` (video
  unchanged: thumb only).
- `routes/projects.js` `findRecentProjectThumbnail`: the newest candidate's sidecar `thumbPath`,
  resolved to disk and checked to exist, typed `image`; the original (typed by extension) only when
  no thumb is recorded or it is gone. Exported for the unit test.

### Checks

- New `tests/recent-project-thumbnail.test.cjs`: newest image -> its thumb URL + `image`; a video
  with a thumb -> the thumb + `image`; no thumb recorded / thumb missing on disk -> the original with
  its own type. 3/3 pass (fails on HEAD: the function returned the original and was not exported).
- New `tests/desktop/history-list-thumbs.spec.js` (2048^2 import): the History row's `src` is the
  sidecar `.thumb.webp`, not `e2e-row_001.png`, and it decodes at <= 512 px. PASS; **FAILS on HEAD**
  (`Received string: ...\Media\e2e-row_001.png`) - run by swapping `MpiHistoryList.js` to its HEAD
  blob and back (`scratchpad/head_check.py`, restore verified byte-equal).
- `npm test`: 2194 tests, 2192 pass, 0 fail. Desktop `landing-grid-release`, `history-modes`,
  `history-list-thumbs`: 3/3. `npx eslint` on both files: clean.

### Measured (MPI-961 rig, `node perf.cjs full 16k mpi963-idle`, NO row simulation, GPU idle
`17 %, 1267 MiB` -> `19 %, 4503 MiB`; code = MPI-961 Phase 2 + this)

Rows: three 512 px `.thumb.webp`, all loaded 153 ms after History opened.

| 16K step | Phase 1 as-is (HEAD `256e8b11d`) | now |
|---|---|---|
| History open: pixels on screen | 37.1 s | **6.5 s** |
| ... longest main-thread block | 27.8 s | 3.55 s (the 16K canvas's first paint - MPI-961 Phase 3) |
| Crop -> Mask | 2.6 s | 32 ms |
| Mask -> Paint | 0.34 s | 34 ms |
| Paint -> Prompt | 11.7 s | **2.1 s** (0 long tasks) |
| Prompt -> Mask | 10.5 s | **4.3 s** (one 2.39 s block: the remounted canvas's first 16K paint) |

(Part of the gain is MPI-961 Phase 2, `47e8e796c`; the rows share is MPI-961 validation.md
§ Control: open 37.1 -> 5.0 s with rows alone.)

### Pending

- Fabio (user-ux): full quit + relaunch; Landing card for Big Photos Test shows a picture; the 16K
  card's rows no longer paint top-down; the 32K row shows its thumbnail.
