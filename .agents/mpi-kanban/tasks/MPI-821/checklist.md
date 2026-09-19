# MPI-821 — checklist

## Part 1 — Archive moves down the card context menu
- [x] `archive` entry sits directly above `delete` in `MpiGalleryGrid.js` menu items.
- [x] Desktop spec pins the ADJACENCY, not just membership.

## Part 2 — the delete confirm gains Archive
- [x] `MpiOkCancel` takes an optional `altLabel` (third action) + `okVariant`.
- [x] The gallery delete dialog offers Cancel / Archive / Delete, single and multi-select.
- [x] Archive from the dialog archives the pending groups and never deletes.
- [x] Enter still confirms Delete, proved with a real key press.

## Part 4 — "Cleanup assets" is repointed at DERIVATIVES
- [x] `cleanupRebuildableAssets()` removes `Media/.meta/<id>.thumb.*` + `.proxy.*`.
- [x] It NULLS `thumbPath` / `thumbPathLg` / `proxyPath` in each sidecar, or
      `/backfill-media-derivatives` skips the item and the card is blank forever.
- [x] `<id>.splat.ply` is kept — it is a master, not a derivative.
- [x] Dialog copy in `projectUI.js` describes the pre-share slimming step.
- [x] `node --test tests/cleanup-derivatives.test.cjs` — 3 pass.
- [ ] Live leg: Cleanup a real project, reopen, confirm thumbs and proxies rebuild.

## Part 3 — retire the reuse asset store (BLOCKED, question asked 2026-09-19)
- [ ] Scope decided: the whole `.preview-assets` store, or only the gallery-sourced copies
      (job A). Job B — agent `placeAsset` + Flow OS-file drops — has no gallery card, and
      is a published contract in three skills. See `plan.md` § Open question.
- [ ] Existing sidecars carrying `previewAssets` refs: decided (recommendation: leave them).
