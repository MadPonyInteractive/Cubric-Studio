# MPI-1041 checklist

- [x] Bench Q1 - dress a naked sheet by words (all three panels, back included) - PASS with wording L1 at 2 MP, batch 3 (batch 1's wording re-laid the sheet, batch 2)
- [x] Bench Q2 - story-state edit ("bruised face, torn dirty clothes") - PASS 6 of 6, batch 5
- [x] Bench Q3 - body shape and age by words - FAIL on Klein 9B in all three structures (batches 5-6)
- [x] Bench Hairstyle field - free 5/6; face lock pixel-holds identity, must skip the back panel (batch 8)
- [x] Bench Q4 - free edit vs mask-locked edit - per-panel head+hair lock wins for clothes, batch 4
- [x] Bench Q5 - headless front body after an edit - free edit regrows the head 3/3; the Clothes lock keeps it headless 3/3 (batch 7)
- [x] Bench body shape + age on other editors, 5 edits each (batch 9): body -> Qwen-Image 2.1 only; older -> Qwen 2.1 or Boogu; younger -> nobody
- [x] Bench Loraholic's Krea 2 age slider (batch 10): FAIL 0 of 4 - too weak inside an edit; younger still has no editor
- [x] Bench age by EXACT target age on Klein (batch 11): older 70 PASS all panels; younger partial (misses panels, hair drift, adult body size)
- [x] Bench the exact-age prompts on Qwen-Image 2.1 (batch 12): weakest on age - out
- [x] Tune the age wording (batches 13-15): neutral template + "what a child lacks" clause passes 3 of 3 on Klein
- [x] Child-sized body (batches 16-17): edit wording fails; edit + from-images REBUILD passes on both sheets
- [ ] Flow plan from the verdicts (/mpi-create-plan)
