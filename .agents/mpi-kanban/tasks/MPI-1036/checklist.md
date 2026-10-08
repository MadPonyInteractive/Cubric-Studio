# MPI-1036 Checklist

- [x] The hidden instructions, on the bench (+ Character Swap LoRA A/B) - Fabio approved 2026-10-08
- [x] The mask path, on the bench - square box + swap LoRA, Fabio passed it 2026-10-08
- [ ] Wire the Flow
  - [x] MpiGradeMatch node, swap LoRA dep, licence key, op in 4 registries (Video edit 7)
  - [x] FlowDef video-edit, raw/ export + sync (API = builder, 0 diffs), inject + handover tests, agent docs, playbook doc (Video edit 8)
  - [ ] R2-R5 whole-frame bench runs judged
  - [ ] provisional or final preview tile (user-flows.test.cjs needs one before any push)
  - [ ] UNRELEASED.md roster + entry
  - [ ] in-app runs on app:isolated, then Fabio's eye test
- [ ] Flow graphics
