# MPI-1041 checklist

- [x] Bench Q1 - dress a naked sheet by words (all three panels, back included) - PASS with wording L1 at 2 MP, batch 3 (batch 1's wording re-laid the sheet, batch 2)
- [x] Bench Q2 - story-state edit ("bruised face, torn dirty clothes") - PASS 6 of 6, batch 5
- [x] Bench Q3 - body shape and age by words - FAIL on Klein 9B in all three structures (batches 5-6)
- [x] Bench Hairstyle field - free 5/6; face lock pixel-holds identity, must skip the back panel (batch 8)
- [x] Bench Q4 - free edit vs mask-locked edit - per-panel head+hair lock wins for clothes, batch 4
- [x] Bench Q5 - headless front body after an edit - free edit regrows the head 3/3; the Clothes lock keeps it headless 3/3 (batch 7)
- [ ] Flow plan from the verdicts (/mpi-create-plan)
