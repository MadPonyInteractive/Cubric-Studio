# MPI-1036 Checklist

- [x] The hidden instructions, on the bench (+ Character Swap LoRA A/B) - Fabio approved 2026-10-08
- [x] The mask path, on the bench - square box + swap LoRA, Fabio passed it 2026-10-08
- [ ] Wire the Flow
  - [x] MpiGradeMatch node, swap LoRA dep, licence key, op in 4 registries (Video edit 7)
  - [x] FlowDef video-edit, raw/ export + sync (API = builder, 0 diffs), inject + handover tests, agent docs, playbook doc (Video edit 8)
  - [x] R2-R5 whole-frame bench runs judged (Video edit 9-10: R2d, R3f, R4e, R6d pass)
  - [x] Prompts in the vendor video-editing format; one single-pass graph, whole-frame clip at 0.75 (Video edit 12-13: S1x/S3x/S4x/S6x pass, suite green)
  - [ ] provisional or final preview tile (user-flows.test.cjs needs one before any push)
  - [x] UNRELEASED.md entry (Video edit 15; no Flows roster bullet exists in UNRELEASED - 2.0 roster is in the shipped notes)
  - [x] in-app runs on app:isolated (A3 pass; A2 cut short by an app restart), then Fabio's eye test (Video edit 15: E1/E2 head swap, "Looks good")
  - [x] Square that cannot hold the mask -> whole frame (Video edit 14: crown + hip seam, nodes 55/24); limits written into video-edit.md + docs/agent/flows.md
  - [x] (Video edit 15: agent:test case video-hair-to-video-edit 3/3 + bite, real model, fake tools; docs already in) Cosmo (Fabio 2026-10-09): one live agent run - "change her hair in this video" must route to Video Edit; add to docs/agent/flows.md what the eye test taught: hair LENGTH follows the clip unless the picture shows where it ends (ask for a head-and-shoulders picture or make a character sheet first), and a mask only pays on a small part that stays put (a dancer's head boxes most of the frame)
  - [x] Video edit 16 (Fabio 2026-10-10): whole-frame STRETCH fixed (the reference clip keeps the render's shape, nodes 43/44; check_shapes over 12 sources x 6 tiers, all within 1%)
  - [x] Video edit 16: Resolution field Input_Quality (576p default .. 4K; masked crop follows) + the user LoRA cogwheel on Video Edit, Upscale Video, Extend Video (both graphs), Character Sheet from Images (both graphs); Foley/Outpaint none (Fabio). flow-lora-rack RACKS test; full suite 2967/0
  - [x] Video edit 16: Flow input slots show a 512 thumbnail, cached per Flow (Fabio: a 2K still reloaded on every visit)
  - [ ] Fabio's eye: a whole-frame run no longer stretches (1080p run on the Pod in flight), a LoRA via the Upscale Video cogwheel changes the result, stage 1 thumbnail no longer reloads
- [ ] Flow graphics
