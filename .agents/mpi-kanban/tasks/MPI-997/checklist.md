# MPI-997 Checklist

- [x] Raw graphs split: A (sheet only) + B (head removal, path input); synced; B proven on the bench
- [x] flowService chain: `when` + `input` + version landing + leg-2 tempId; tests
- [x] Character Sheet FlowDef `chain`; typedef; inject-titles skips a chain's `when` field
- [x] Op `flowCharacterSheetHeadless` in 4 files (filePrefix = the Flow's)
- [x] Graph pins moved to B; inject titles case for B
- [x] Result-pane chain toggle + desktop spec (built on my pick; Fabio's look open)
- [x] Docs: existing-flows/character-sheet.md, 01-descriptor-and-ops.md, ui/result-pane.md
- [x] UNRELEASED line
- [x] Live: connector run into a closed project (found + fixed the dropped leg 2), toggle run in Electron
- [x] Mirrored sheet: layout clause up front in all four recipes (prompt route; no flip); bench-proven
- [x] Fabio's look (2026-10-01: toggle + fixed sheet in the app, "Looking good")
- [x] Leg 2 frees VRAM (`#901 MpiClearVram` before Output_Image)
