# MPI-1172 validation

- Code: `ccc19b6c6` — both graphs (raw + API) save the drawing as `Output_Image_0`; `flowScribble` and
  `flowScribObj` declare `outputVersions`.
- Tests: `tests/flow-output-versions.test.cjs` pins the capture, its source node and the version order;
  full `npm test` 3399 pass, 0 fail.
- Cloud path: `cloudEditPass2` keeps node 199 on both graphs, `cloudEditPass1` drops it (checked by script).
- Live: Fabio ran Scribble on 2026-10-18 — History shows the drawing first, then the result.
  Draw It In runs the same mechanism (same op shape, capture off its Paint On Photo composite); not run live.
