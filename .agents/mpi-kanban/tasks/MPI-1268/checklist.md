# MPI-1268 checklist

Not dev-gated (Fabio 2026-10-24, confirmed again in "LTX 2.5 model 11").

## Phase 1: Reorder
- [x] `applyReorderMembers` in `js/data/stackModel.js` + unit test
- [x] `projectService.reorderStack`
- [x] Stack History strip: hold-and-drag reorder, picks follow
- [x] lint + test; isolated app: drag, project.json order kept, gallery face follows
- [x] Fabio's look (2026-10-24, "1")

## Phase 2: Create Sheet
- [x] order-keeping layout mode in `js/utils/sheetLayout.js` + test
- [x] `numbered` flag in `routes/imageSheet.js` + preview badge in `MpiImageSheet`
- [x] stack card menu "Create Sheet" (`MpiGalleryGrid.js` + the Gallery Block)
- [x] lint + test; isolated app: numbered sheet in stack order after a reorder (2, 3, 1, 4)
- [x] Fabio's look (2026-10-24, "1")

## Close
- [x] `docs/stacks.md` (202 lines, 2 over the cap)
- [x] UNRELEASED entry (two New bullets)
