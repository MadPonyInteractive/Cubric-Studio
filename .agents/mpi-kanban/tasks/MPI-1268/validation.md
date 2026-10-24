# MPI-1268 validation

Verify mode: user-ux. Verified 2026-10-24.

- Automated: `applyReorderMembers` unit test (`tests/stack-model.test.cjs`), sheet layout + numbered
  badges (`tests/image-sheet.test.cjs`); lint + test green on 4858c056f, 2baa26beb, 4f33defba.
- Isolated app ("LTX 2.5 model 11"): drag reorder persists in project.json, gallery face follows;
  Create Sheet numbers in stack order after a reorder (2, 3, 1, 4); six 16:9 panels -> 2x3 uncropped
  on 9:16 with Whole pictures.
- Fabio's look in his own app ("LTX 2.5 model 12"): reorder drag, Create Sheet, Whole pictures,
  portrait ratios -> "1" (looks right).
- Release notes: two New bullets in `docs/releases/UNRELEASED.md`.
