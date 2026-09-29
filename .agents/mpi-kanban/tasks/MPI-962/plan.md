# MPI-962 Plan - Big photos (umbrella): EXIF rotation and 16K performance

## Current State

- Umbrella created 2026-09-28 at Fabio's request, out of MPI-949 Phase 5 (stack crop), where the EXIF
  crop bug was confirmed. Photographers are a core audience; the tester runs an RTX 3060 12 GB with
  **16 GB system RAM** and loads 16K photos.
- **Members** (each keeps its own brief; nothing is closed or merged here):
  - **MPI-959** - Crop cuts the wrong region on EXIF-rotated photos. Decision (Fabio): BOTH fixes -
    rotate on import AND auto-orient in every server consumer of canvas coordinates.
  - **MPI-961** - Big photos (16K) make History unusable: canvas lags, masks near impossible to draw.
    Design B approved 2026-09-28 (display copy + detail layer) - MPI-961 brief § Design, own large plan.
  - **MPI-963** - Landing project card blank when the newest card is huge. `findRecentProjectThumbnail`
    (`routes/projects.js`) serves the ORIGINAL file, not the sidecar `thumbPath`. Found 2026-09-28 by
    Fabio on the Big Photos Test project (newest card = the 32K import).
  - **MPI-971** - Engine ops fail on 16K+ photos: `MpiLoadImage` hits Pillow's decompression-bomb
    limit. Added 2026-09-29 by the umbrella sweep (Fabio's yes). Detection (SAM3 / text / detector)
    is FIXED app-side in MPI-961 (`49c4b4884`); inpaint / localised edit, i2i and upscale on 16K+
    still send the original and die at load. `needs-decision` (A lift the node limit, B the app
    never sends more than the op needs, or both) - card description.
- **Related, not a member:** MPI-957 (Canvas aliases large images when zoomed out) - closed
  2026-09-29 on Fabio's eye-test.
- **Status 2026-09-29:** MPI-961 and MPI-963 closed, Fabio verified; the detail layer was deferred by
  Fabio (MPI-961 closed without it). MPI-959 closed (`28547517d`, Fabio verified). Open: MPI-971.
- **2.0 gate (Fabio 2026-09-29):** MPI-959 and MPI-971 both land before 2.0 - UNRELEASED.md already
  says "Big photos just work ... import, thumbnail and edit", which is false until they do.
- **Fallback that exists today:** the Resize tool's `rotation` lets a user rotate by hand - the answer
  for files whose tag is wrong (MPI-959 brief § "Why rotate-on-import alone sometimes does not work").

## Parallel Batch 1: EXIF fix + 16K measurement (disjoint)

- [x] (closed `28547517d`, Fabio verified) **MPI-959 EXIF orientation (auto).** Auto-orient before planning in `cropExtended` and in
  `imageComposite.js` (`compositeThroughMask`, `compositeOverlay`); bake orientation on import in the
  upload route. Grep every other `sharp(` consumer that takes canvas coordinates or a canvas-sized
  overlay. Check the four "why it fails" cases from the brief on real files.
  Ownership: `services/imageCrop.js`, `services/imageComposite.js`, the upload route in
  `routes/projects.js` (`/project-media/:projectId/upload` ~:1410, `upload-raw` ~:1785),
  `routes/imageImport.js`, NEW `tests/image-orientation.test.cjs`, `tests/desktop/crop-resize-output.spec.js`.
  **Verify:** the unit test (ramp image, orientation 6 and 8; crop and composite outputs equal the
  upright result; an imported orientation-6 file lands upright with orientation 1);
  `crop-resize-output.spec.js` + `stack-crop.spec.js` green; Fabio crops a real portrait phone photo -
  one is already in project Big Photos Test: `Media/imported_001.jpg`, raw 4096x3072, orientation 6.
- [x] **MPI-963 landing thumbnail** (closed `99d1a63b0`, Fabio verified) - SAME WORKER as MPI-959, after it (both edit `routes/projects.js`).
  Prefer the sidecar `thumbPath` in `findRecentProjectThumbnail` AND in the History entry list
  (`MpiHistoryList.js` ~:138-141 feeds images their ORIGINAL - Fabio saw 16K rows paint top-down, the
  32K row broken); check what the Landing card renders for a video (`recentThumbnailType`). Brief:
  `tasks/MPI-963/brief.md`. Ownership: `findRecentProjectThumbnail` in `routes/projects.js`, its
  Landing consumer, `js/components/Compounds/MpiHistoryList/MpiHistoryList.js`, tests. **Verify:** a unit test on a temp project whose newest sidecar
  points at a file too big to decode returns the `thumbPath`; the Big Photos Test card shows a picture
  after a full quit + relaunch.
- [x] **MPI-961 measure = MPI-961 plan Phase 1** (its own large plan now; this line is its pointer). DevTools Performance + Memory on a real 16K photo in
  `npm run app:isolated`: frame time during a mask stroke, full-size copies alive after open / Mask /
  entry switch, main-thread decode. Write `tasks/MPI-961/research/investigation.md` with numbers and
  file:line culprits, then a `plan.md` choosing techniques from the brief's list.
  Ownership: `.agents/mpi-kanban/tasks/MPI-961/` only. No code edits.
  **Verify:** `investigation.md` names the top time and memory costs with measurements, not guesses.

## Phase 2: 16K performance fix (user-ux)

- [x] (MPI-961 closed `bbe115e93`, Fabio verified; detail layer deferred by Fabio) Implement MPI-961's `plan.md`: design B approved 2026-09-28 (display copy ~2x screen + a
  screen-sized full-res detail layer on zoom settle; full res only on the server) - MPI-961
  brief § Design. Fixtures: project "Big Photos Test" (16K) + `~/Pictures/Big Photos Test/` (32K). Touches `js/components/Primitives/MpiCanvas/**` and `MpiCanvasViewer.js` -
  start only after MPI-957 closes and no live claim holds them.
  **Verify:** the Phase-1 measurements re-run on the same file show the fix; the tester draws a mask on
  a 16K photo and it keeps up.

## Phase 3: Engine ops on 16K+ photos (MPI-971)

- [ ] **Fabio chose B (2026-09-29), no node-limit lift:** inpaint / localised edit, i2i and upscale
  each reach the engine at a size it can load - localised edits cropped around the mask server-side
  and stitched back, whole-image ops on a loadable copy. MPI-971 needs its own plan first (upscale
  on a 16K source is the open design question). Ownership set by that plan: the server routes that
  stage the input.
  **Verify:** each of the three ops runs on the 16K in Big Photos Test (and the 32K for B) on a
  16 GB-RAM budget.

## Verification

**Verify mode:** user-ux

Batch 1's MPI-959 half is `auto` plus one Fabio check on a real phone photo; the MPI-961 half is research.
Phase 2 is `user-ux`: only the tester's machine tells whether 16K feels usable.

## Plan Drift

- 2026-09-28: MPI-963 added (NEW SCOPE, not a gap): found while baselining MPI-961. Rides with
  MPI-959's worker because both edit `routes/projects.js`.
- 2026-09-28: MPI-961 got its own large plan; Batch 1's "MPI-961 measure" item is that plan's Phase 1.
- 2026-09-29: MPI-971 added as a member (umbrella sweep, Fabio's yes): it pointed at this umbrella
  but was missing from the plan, so the 2.0 list read Big photos as nearly done without it.
