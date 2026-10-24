# MPI-1268 checklist

Not dev-gated (Fabio 2026-10-24, confirmed again in "LTX 2.5 model 11").

## Phase 1: Reorder
- [ ] `applyReorderMembers` in `js/data/stackModel.js` + unit test
- [ ] `projectService.reorderStack`
- [ ] Stack History strip: hold-and-drag reorder, picks follow
- [ ] lint + test; isolated app: drag, reopen, order kept, gallery face follows
- [ ] Fabio's look

## Phase 2: Create Sheet
- [ ] order-keeping layout mode in `js/utils/sheetLayout.js` + test
- [ ] `numbered` flag in `routes/imageSheet.js` + preview badge in `MpiImageSheet`
- [ ] stack card menu "Create Sheet" (`MpiGalleryGrid.js` + the Gallery Block)
- [ ] lint + test; isolated app: numbered sheet in stack order, reorder follows
- [ ] Fabio's look

## Close
- [ ] `docs/stacks.md`; UNRELEASED entry (file held by a peer today, coordinate)
