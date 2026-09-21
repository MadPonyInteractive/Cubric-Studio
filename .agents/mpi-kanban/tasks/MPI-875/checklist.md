# MPI-875 — checklist

## 1 — the clamp

- [x] `POST /deepinfra/generate` keeps the first `batch` outputs and drops the rest
- [x] The drop is logged with BOTH counts, and no upstream body
- [x] A test asserts a 2-image response to a 1-image request yields one viewUrl
- [x] That test proven RED with the clamp backed out, green with it in

## 2 — the ranking

- [x] Every cloud op carries a rank below the last local model for that task
- [x] Every cloud op carries a note naming the price, read from `estimateCost()`
- [x] Local rankings are unchanged — the locals' own ranks do not move
- [x] A test asserts both: cloud ranks last, and the note quotes a price

## Verification

- [x] `npm test` green — 1710 tests, 1708 pass, 0 fail, 1 todo (MPI-867's, declared)
- [x] `npm run lint:components` green, and `eslint` clean on all four changed files
- [ ] Fabio: an unprompted agent t2i reaches for a local model
