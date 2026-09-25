# MPI-933 Validation

## Before

`extractImageThumb` on an 800x600 SVG returned null (2026-09-25): ffmpeg cannot read SVG, and no raster path in the app can.

## Fix

`/project-media/:id/upload` (every user import: gallery, PromptBox, history, place) renders an SVG image to PNG with sharp and never writes the `.svg`. Size: declared, long edge raised to 2048, capped at 4096. The sidecar and the response carry the PNG size; `mediaUploadService.js` takes the server size over the renderer measurement.

## Tests

`tests/svg-import.test.cjs`, 4 tests: 800x600 lands as a 2048x1536 PNG with both thumbnails and no `.svg` left; 20000x10000 via base64 caps at 4096x2048; 3000x1000 is kept; unpainted area is alpha 0. 3 of 4 red before the fix (the fourth passed only because sharp reads the `.svg` itself; a PNG-format assertion was added). Full `npm test`: 1932 pass, 0 fail.

## Not covered

- SVGs imported BEFORE this change stay `.svg` with no thumbnail; nothing converts them.
- `/project-media/:id/place-preview-asset` (agent staging into the reference store) does not convert; the agent skill already says to convert before staging.
- Not driven in the running app: the server route is tested end to end, the client change is one line.
