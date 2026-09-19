# MPI-826 — validation

## What shipped, and what deliberately did not

`state.gallerySort` was the only gallery view setting with no persistence —
`gallerySizeLevel`, `galleryShowInfo` and `galleryVolume` all round-trip through
Storage. "Oldest first" lasted until the app closed.

**Only `order` now persists.** `scope` and the three filters (`hiddenKinds`, `marks`,
`previews`) stay in memory, because MPI-678 put them there on purpose and that reason
still holds. Its note in `js/state.js` was explicit:

> Deliberately NOT mirrored to Storage: `gallerySort` is in-memory, so the scope resets
> to 'active' every launch. Nobody should relaunch into a gallery that looks wiped.

That reasoning is about anything that can EMPTY THE GRID — `scope: 'archived'` and each
filter can, and a filter restored invisibly at boot reads as a broken gallery. `order`
empties nothing (the same note: "order: 'newest'|'oldest', hides nothing"), so it is the
one part that is safe to carry across launches. The split also matches SHOW ALL, which
already resets exactly the filters and keeps exactly `order` and `scope`.

So the key is a scalar, `mpi_gallery_sort_order`, not a mirror of the object — there is
no second field that may ever join it without reopening MPI-678.

**Fabio asked for "the gallery sort" to persist and I described it to him as "order and
scope".** Delivering scope too would reverse a recorded decision, so it is not in this
card; if he wants the archive scope to survive as well, that is a one-line change and his
call to make.

## Evidence

`tests/gallery-sort-persist.test.cjs` drives the REAL `js/state.js` — it imports cleanly
in node with a `localStorage` and a `fetch` stub — so this is the boot path and the
subscriber, not a re-implementation of them.

Green on the fix:

```
✔ the sort order is restored from the store on boot (8.8791ms)
✔ changing the sort writes the order, and ONLY the order (2.195ms)
✔ a fresh or corrupt store opens on newest (2.2744ms)
ℹ pass 3  ℹ fail 0
```

RED on pre-fix code — `state.js`, `storage.js` and `storageKeys.js` restored from `HEAD`,
the test file untouched:

```
✖ the sort order is restored from the store on boot
✖ changing the sort writes the order, and ONLY the order
✔ a fresh or corrupt store opens on newest
ℹ pass 1  ℹ fail 2
```

The third passes on pre-fix code by coincidence — `newest` is also the hardcoded default —
so it is a guard against a corrupt store, not a guard against this regression. The middle
case is the one that pins the split: it asserts the store holds exactly one key after a
write that set a scope and all three filters.

`npm test` and `npx eslint` results are on the card's checklist.
