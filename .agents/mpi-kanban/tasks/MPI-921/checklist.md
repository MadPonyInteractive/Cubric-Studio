# MPI-921 checklist

- [x] Survey who calls the local server cross-origin (renderer, file:// windows, sibling apps, website, scripts)
- [x] Remove `app.use(cors())` and the `cors` dependency
- [x] Refuse a foreign `Host` (DNS rebinding), a foreign `Origin`, and `Sec-Fetch-Site` other than same-origin/none
- [x] Unit test for the guard (`tests/local-only.test.cjs`)
- [x] Live check on an `app:isolated` instance: cross-origin fetch refused, app + in-app agent still work
- [x] `npm test` green
- [x] Invariant line in `docs/PROJECT.md`
