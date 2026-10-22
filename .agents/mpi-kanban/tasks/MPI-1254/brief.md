# MPI-1254 - Character Sheet Editor child ages: adult chest + revealing outfit reach the child sheet

Found 2026-10-22 in Fabio's eye test (session "Flux 3 on flows 5", MPI-1212). Child-safety output defect in the
SHIPPED Editor; not caused by FLUX.3 (that wiring was reverted).

## What happens
Age 12 and under runs: Klein age edit (whole sheet) -> rebuild leg (`flowCharacterSheetImages`, right-half box,
`Input_Face_Pose: 'TURNED'`, prompt "keeps the turn and expression of the first image") -> head removal.
- The CLOSE-UP is made by the Klein age step and the rebuild COPIES it (the bench saw Qwen and FLUX.3 both copy the
  input portrait, MPI-1212 cseq8_3). Klein ages the face down but keeps the adult neck/chest:
  - age 10: close-up reads ~16, adult cleavage in the halter neckline;
  - age 1: toddler face over an adult chest in the deep V ("little breasts", Fabio);
  - age 0: close-up stays the adult woman with a blanket, choker and earrings.
- The full bodies wear the adult outfit: `sheetClothes` describes the deep-V halter mini dress and the rebuild
  dresses the child in it. SHEET_CLOTHES_CHECKS pass it as ordinary clothes.
Evidence: `age-step-vs-rebuild.jpg` (Klein age step left, rebuild right; files Qwen 2.1/Media flowCSE_089-091 ->
flowCSFI_012-014, run on FLUX.3; Fabio's Qwen run for the same sheet still to compare).

## Directions (Fabio's call)
1. The child leg redraws the close-up as a child too (neck, chest, shoulders), not a copy of the aged adult crop.
2. Age-appropriate clothes for a child rebuild: a revealing neckline / adult cut is swapped for a covered one.
Confirm on Qwen first (the shipped route). Read docs/child-safety.md and memory "Easy path = strict gate" first.

## Noticed
