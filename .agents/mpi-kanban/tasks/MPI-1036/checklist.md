# MPI-1036 Checklist

- [x] The hidden instructions, on the bench (+ Character Swap LoRA A/B) - Fabio approved 2026-10-08
- [x] The mask path, on the bench - square box + swap LoRA, Fabio passed it 2026-10-08
- [ ] Wire the Flow
  - [x] MpiGradeMatch node, swap LoRA dep, licence key, op in 4 registries (Video edit 7)
  - [x] FlowDef video-edit, raw/ export + sync (API = builder, 0 diffs), inject + handover tests, agent docs, playbook doc (Video edit 8)
  - [x] R2-R5 whole-frame bench runs judged (Video edit 9-10: R2d, R3f, R4e, R6d pass)
  - [x] Prompts in the vendor video-editing format; one single-pass graph, whole-frame clip at 0.75 (Video edit 12-13: S1x/S3x/S4x/S6x pass, suite green)
  - [ ] provisional or final preview tile (user-flows.test.cjs needs one before any push)
  - [ ] UNRELEASED.md roster + entry
  - [ ] in-app runs on app:isolated (A3 pass; A2 cut short by an app restart), then Fabio's eye test
  - [x] Square that cannot hold the mask -> whole frame (Video edit 14: crown + hip seam, nodes 55/24); limits written into video-edit.md + docs/agent/flows.md
  - [x] (Video edit 15: agent:test case video-hair-to-video-edit 3/3 + bite, real model, fake tools; docs already in) Cosmo (Fabio 2026-10-09): one live agent run - "change her hair in this video" must route to Video Edit; add to docs/agent/flows.md what the eye test taught: hair LENGTH follows the clip unless the picture shows where it ends (ask for a head-and-shoulders picture or make a character sheet first), and a mask only pays on a small part that stays put (a dancer's head boxes most of the frame)
- [ ] Flow graphics
