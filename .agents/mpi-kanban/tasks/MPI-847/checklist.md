# MPI-847 — checklist

- [x] `TRANSFORM_MIN_MAX_EDGE` floor in `routes/gifTransform.js`.
- [x] Desktop spec assertion back to `{1080,1920}` with the reason.
- [x] Node test: a source entry carrying `maxEdge: 512` must not cap a crop at 512.
- [x] `docs/gif.md` records the floor and why it is not inheritable.
- [x] gif-transform node + desktop specs green, lint clean.
