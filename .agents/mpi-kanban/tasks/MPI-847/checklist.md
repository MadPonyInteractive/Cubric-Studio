# MPI-847 — checklist

- [ ] `TRANSFORM_MIN_MAX_EDGE` floor in `routes/gifTransform.js`.
- [ ] Desktop spec assertion back to `{1080,1920}` with the reason.
- [ ] Node test: a source entry carrying `maxEdge: 512` must not cap a crop at 512.
- [ ] `docs/gif.md` records the floor and why it is not inheritable.
- [ ] gif-transform node + desktop specs green, lint clean.
