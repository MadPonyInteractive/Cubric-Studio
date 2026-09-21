# MPI-864 — checklist

- [ ] Source one published sample generation per model across the fifteen; record model -> URL -> what it shows -> publisher.
- [ ] Put the whole set in front of Fabio and get ONE approval before anything is downloaded.
- [ ] Download the approved sources into `comfy_workflows/display/`, matching the existing `.webp` (stills) convention.
- [ ] Add `image:` / `video:` to each of the fifteen cloud ModelDefs in `js/data/modelConstants/models.js`.
- [ ] A test that fails if a cloud ModelDef ships with no `image`/`video`, so the placeholder cannot come back silently.
- [ ] `npm test` green; Fabio's eyes on the Model Library and the picker (`**Verify mode:** user-ux`).
