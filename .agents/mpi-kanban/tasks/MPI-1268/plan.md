# MPI-1268 Stacks: reorder members + right-click Create Sheet (numbered, stack order)

## Current State

- 2026-10-24 ("LTX 2.5 model 10"): planned from the research in
  `tasks/MPI-1231/research/codebase-2026-10-24.md` § Stacks. Member of umbrella MPI-1267 (LTX 2.5
  release). Nothing built. Reorder is general (any stack); Storyboard (MPI-1231) needs both pieces.
- Dev gate: both features are general gallery features; they ship dark until the LTX 2.5 release only
  if Fabio wants that (Open call 1).

## Phase 1: Reorder - `user-ux`

- [ ] Pure `applyReorderMembers(groups, stackId, orderedIds)` in `js/data/stackModel.js` (next to
  `applyRemoveMembers` :171): rejects a set that is not exactly the current members.
  `projectService.reorderStack(stackId, ids)` copied from `removeFromStack` (:633): one persist, emits
  `project:group-updated`; the closed-project route only if a server path needs it (none known).
  **Verify:** unit test (reorder, bad set refused, face = new first member).
- [ ] `MpiGroupHistoryBlock` stack strip: `allowReorder: true` + `on('reorder')` -> `reorderStack`, map
  indices through `_stripIds` (not `stack.members`: `_stackMembers` drops history-less members, :249),
  remap `_picked`; `_syncStack` repaints. Precedent `MpiFrameStrip.js:313-324`. Teardown via the
  stored unsubscribe. **Verify:** `npm run lint` + `npm test`; isolated app (`npm run app:isolated`):
  drag a member, reopen the project, order kept, gallery face follows; Fabio's look.

## Phase 2: Create Sheet - `user-ux`

- [ ] `js/utils/sheetLayout.js`: a grids-only, ORDER-KEEPING mode (`_grids` :110), since the exhaustive
  trees (`_trees` :59-87) break reading order. `routes/imageSheet.js`: `numbered` body flag -> one
  number badge per cell, top-left, in `renderSheet` (:56). Mirror as a CSS badge in the
  `MpiImageSheet` preview (tokens from `styles/01_base.css`, BEM). **Verify:** unit test of the order
  mode; a route test that a numbered sheet's cells keep member order.
- [ ] Stack card menu entry "Create Sheet" (`MpiGalleryGrid.js` item list :1686-1744, copy the
  `unstack` pattern :1721, emit in `onSelect` :1759, document the event :137); the Block expands the
  stack (`expandStacks`) and opens `MpiImageSheet` in numbered, stack-order mode. Image stacks with
  >= 2 stills only; otherwise the entry is disabled with the reason. Shows itself (dialog + progress,
  the result card lands). **Verify:** lint + test; isolated app: right-click a 5-member stack ->
  numbered sheet in stack order; reorder, sheet again, order follows; Fabio's look.

## Plan Drift

- None yet.

## Verification

**Verify mode:** user-ux

Both phases end with Fabio's look in the app. Docs: `docs/stacks.md` (reorder, Create Sheet) and
`docs/gallery-selection.md` if the sheet dialog changes.

## Open calls (Fabio)

1. Dev-gate these two or ship them in the next bug-fix release? My pick: ship them as soon as they
   pass (they are not LTX features and carry no risk to 2.5).

## Preservation Notes

- Ask before touching `.claude/rules/` (component/event maps) if a new event is added.
