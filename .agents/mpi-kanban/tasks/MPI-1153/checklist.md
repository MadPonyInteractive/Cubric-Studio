# MPI-1153 Checklist

- [x] MPI-997's reason checked: superseded by MPI-1087 (the leg ran every run)
- [x] Head branch cloned into both graphs, raw + runtime (`research/patch_raw_versions.py`); converter output identical
- [x] `outputVersions` on flowCharacterSheet + flowCharacterSheetImages; chain leg `inGraph: true`
- [x] From-images `Input_Headless` gate; Sheet Editor rebuild leg sends false
- [x] Tests: flow-legs, flow-model-choice, desktop flow-chain-toggle (chained + inGraph); npm test green
- [x] Live: both Flows + Editor Age 10 on an isolated app (validation.md)
- [x] Docs: character-sheet.md, character-sheet-from-images.md, 01/02 playbook, result-pane.md
- [ ] Commit, push, CI green, close
