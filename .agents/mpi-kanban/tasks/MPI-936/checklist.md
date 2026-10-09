# MPI-936 Checklist

Playbook: `docs/playbooks/add-model/README.md` (via `/mpi-add-model`). Engine v0.39.0 landed (MPI-1043).
Scope widened 2026-10-08 (Fabio): Klein 9B's seven ops, inpaint included. Plan: `plan.md`.

- [x] Phase 0.1 transformer survey (`research/weights.md`)
- [x] Phase 0.2 accelerator-LoRA survey (`research/weights.md`)
- [x] Phase 0.4 accelerator strength axes: Fun-Acc 4-step NOT runnable on core 0.39 (PDD head bank); Viggle 6-step = plain PEFT, needs a sigma node; fast tier deferred
- [x] Phase 0.5 samplers/steps/cfg from the official Comfy templates (`research/graph.md`)
- [x] Phase 0.6 dep-reuse pass: encoder REUSES `boogu-qwen3vl-8b-clip` (stock Qwen3-VL-8B, Apache-2.0, proven); transformer + VAE new, HF-only
- [x] Phase 0.8 `docs/models/qwen-image-2/` hub (seven ops, ControlNet, alpha rules)
- [x] Weights on `G:\CubricModels`, sha256 verified (transformer, VAE, encoder, ControlNet union)
- [x] Phase 0.9 graph proven on the bench, all seven ops (`research/bench-results.md` runs 2-3), exported to `comfy_workflows/raw/qwen_image_2_1.json` (541caee9a), runtime converted + validated + staged
- [x] Converter: an autogrow input with `min: 0` may be empty (`scripts/workflow-to-api.mjs`)
- [x] Licence gate: `QWEN_IMAGE_21` descriptor keyed `qwen-image-2-1`, bundled LICENSE + NOTICE, `poweredBy` = §3.c notice
- [x] Deps: `qwen-image-21-transformer`, `vae-qwen-image-21`, `qwen-image-21-controlnet-union` (HF-primary, `noMirror`, sha256 pinned, credit)
- [x] ModelDef in models.js: seven ops, opInject, controlTypes x4, `multiReference8`, user LoRA rack
- [x] progressStages: deliberately NO entry (Klein's shape; counts recorded in the comment)
- [x] Rank: IMAGE_ORDER + EDIT, last, with notes (research licence, alpha, 8 refs)
- [x] Agent guide `docs/agent/models/flux-2.md` names the model, ops, alpha, 8 refs, licence
- [x] Preview `comfy_workflows/display/qwen-image-2-1.webp`: Fabio picked A (Lisbon tram, bench seed 21), 896x1088, 119 KB
- [x] NC badge on the Model Library tile (eye-test: Fabio "looks good", 2026-10-08)
- [x] Detail + upscale at half steps (12 of 25), Fabio 2026-10-08
- [x] Agent read-back + three agent tests (21/21; transparency note moved to t2i)
- [x] One generation per op in the real app; RGBA output survives capture (t2i 69%, edit 59% clear)
- [x] Pod yaml maps `model_patches` (mpi-ci c57f7dd, pushed); release:check passes
- [x] REOPEN 2026-10-09: MpiClearVram spliced before Output_Image (raw + runtime), validator + 55 injection tests green
- [ ] REOPEN: live check, engine VRAM drops after a Qwen 2.1 run (needs the GPU)
- [ ] REOPEN: encoder A/B, Boogu fp8_scaled vs the templates int8_convrot (Fabio decides on the result)
