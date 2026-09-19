# MPI-826 — checklist

- [x] `mpi_gallery_sort_order` added to `storageKeys.js`, with the reason for its narrowness
- [x] Storage getter/setter heal anything that is not `oldest` to `newest`
- [x] `state.js` seeds `gallerySort.order` from Storage and mirrors it on change
- [x] `scope`, `hiddenKinds`, `marks` and `previews` stay in memory — MPI-678 is not reopened
- [x] MPI-678's comment updated to say what now persists and why the rest does not
- [x] Test drives the REAL `state.js` boot path and subscriber, not a re-implementation
- [x] Proven RED on pre-fix code (`pass 1, fail 2`)
- [x] `npm test` green — 1419 tests, 1418 pass, 0 fail, 1 skipped
- [x] `npx eslint` clean, exit 0
