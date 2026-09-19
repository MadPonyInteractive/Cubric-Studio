# MPI-821 — checklist

## Part 1 — the card context menu
- [x] `archive` sits directly above `delete`; `delete` stays last.
- [x] Reorganised into three separated groups (Fabio, 2026-09-19):
      make-something-new · edit this card · files and the system.
- [x] Every row carries `info` for the status bar, including a reason on every
      disabled row. This app has no tooltips.

## Part 2 — the delete confirm gains Archive
- [x] `MpiOkCancel` takes an optional `altLabel` (third action) + `okVariant`.
- [x] The gallery delete dialog offers Cancel / Archive / Delete, single and multi-select.
- [x] Archive from the dialog archives the pending groups and never deletes.
- [x] Enter still confirms Delete, proved with a real key press.
- [x] EVERY delete now routes through the dialog — right-click Delete used to wipe
      the cards and their files with no confirmation at all.

## Part 3 — retire the reuse asset copying (NARROW scope, Fabio 2026-09-19)
- [x] `materializeGenerationFrameSnapshots` + `_snapshotRoleForMediaItem` removed,
      with their call sites in `save-generation` and `/extend-video`.
- [x] `materializePreviewAssets` records a REFERENCE (`url` = the source card's own
      project url), copies nothing, and hands `frozenParams` back untouched.
- [x] `validate-preview-assets` learned `snap.url`, or a cold-fallback Continue would
      read every snapshot as missing and block.
- [x] `placeContentAsset` + `POST /place-preview-asset` KEPT — the agent's `placeAsset`
      and a Flow's OS-file drop have no gallery card.
- [x] Existing sidecars with `previewAssets` refs: left alone. Every reader still takes
      `filePath || url`.
- [x] Orphans removed: `snapshotExt`, the dead `source` field on the `delete` event.
- [x] Docs: `docs/project-integrity.md`, `docs/data.md`, `docs/gallery.md`.

## Part 4 — "Cleanup assets" is repointed at DERIVATIVES
- [x] `cleanupRebuildableAssets()` removes `Media/.meta/<id>.thumb.*` + `.proxy.*`.
- [x] It NULLS `thumbPath` / `thumbPathLg` / `proxyPath` in each sidecar, or
      `/backfill-media-derivatives` skips the item and the card is blank forever.
- [x] `<id>.splat.ply` is kept — it is a master, not a derivative.
- [x] Dialog copy in `projectUI.js` describes the pre-share slimming step.

## Verification
- [x] `npm test` — 1386 pass, 0 fail, 1 skipped.
- [x] `tests/cleanup-derivatives.test.cjs` (3) · `tests/reuse-refs-not-copies.test.cjs` (3).
- [x] `tests/desktop/delete-offers-archive.spec.js` (3) ·
      `gallery-archive.spec.js` (3) · `gallery-cue-all.spec.js` (1).
- [x] eslint clean on every touched file.
- [ ] **user-ux (Fabio):** the menu grouping, the three-button dialog, and one real
      Reuse of a card whose input source is still in the gallery.
- [ ] Live leg: Cleanup a real project, reopen, confirm thumbs and proxies rebuild.
