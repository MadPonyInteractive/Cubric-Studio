# MPI-962 Plan - Big photos (umbrella): EXIF rotation and 16K performance

## Current State

- Umbrella created 2026-09-28 at Fabio's request, out of MPI-949 Phase 5 (stack crop), where the EXIF
  crop bug was confirmed. Photographers are a core audience; the tester runs an RTX 3060 12 GB with
  **16 GB system RAM** and loads 16K photos.
- **Members** (each keeps its own brief; nothing is closed or merged here):
  - **MPI-959** - Crop cuts the wrong region on EXIF-rotated photos. Decision (Fabio): BOTH fixes -
    rotate on import AND auto-orient in every server consumer of canvas coordinates.
  - **MPI-961** - Big photos (16K) make History unusable: canvas lags, masks near impossible to draw.
    Research first; no technique is chosen until the lag is measured on a real 16K file.
- **Related, not a member:** MPI-957 (Canvas aliases large images when zoomed out) is in `doing` /
  `validating` on the same draw path. Phase 2 reads what it landed first.
- **Fallback that exists today:** the Resize tool's `rotation` lets a user rotate by hand - the answer
  for files whose tag is wrong (MPI-959 brief § "Why rotate-on-import alone sometimes does not work").

## Parallel Batch 1: EXIF fix + 16K measurement (disjoint)

- [ ] **MPI-959 EXIF orientation (auto).** Auto-orient before planning in `cropExtended` and in
  `imageComposite.js` (`compositeThroughMask`, `compositeOverlay`); bake orientation on import in the
  upload route. Grep every other `sharp(` consumer that takes canvas coordinates or a canvas-sized
  overlay. Check the four "why it fails" cases from the brief on real files.
  Ownership: `services/imageCrop.js`, `services/imageComposite.js`, the upload route in
  `routes/projects.js` (`/project-media/:projectId/upload` ~:1410, `upload-raw` ~:1785),
  `routes/imageImport.js`, NEW `tests/image-orientation.test.cjs`, `tests/desktop/crop-resize-output.spec.js`.
  **Verify:** the unit test (ramp image, orientation 6 and 8; crop and composite outputs equal the
  upright result; an imported orientation-6 file lands upright with orientation 1);
  `crop-resize-output.spec.js` + `stack-crop.spec.js` green; Fabio crops a real portrait phone photo.
- [ ] **MPI-961 measure (research, read-only).** DevTools Performance + Memory on a real 16K photo in
  `npm run app:isolated`: frame time during a mask stroke, full-size copies alive after open / Mask /
  entry switch, main-thread decode. Write `tasks/MPI-961/research/investigation.md` with numbers and
  file:line culprits, then a `plan.md` choosing techniques from the brief's list.
  Ownership: `.agents/mpi-kanban/tasks/MPI-961/` only. No code edits.
  **Verify:** `investigation.md` names the top time and memory costs with measurements, not guesses.

## Phase 2: 16K performance fix (user-ux)

- [ ] Implement MPI-961's `plan.md` (likely a display proxy / mip levels + full resolution only at Apply,
  per the measurements). Touches `js/components/Primitives/MpiCanvas/**` and `MpiCanvasViewer.js` -
  start only after MPI-957 closes and no live claim holds them.
  **Verify:** the Phase-1 measurements re-run on the same file show the fix; the tester draws a mask on
  a 16K photo and it keeps up.

## Verification

**Verify mode:** user-ux

Batch 1's MPI-959 half is `auto` plus one Fabio check on a real phone photo; the MPI-961 half is research.
Phase 2 is `user-ux`: only the tester's machine tells whether 16K feels usable.

## Plan Drift

(none yet)
