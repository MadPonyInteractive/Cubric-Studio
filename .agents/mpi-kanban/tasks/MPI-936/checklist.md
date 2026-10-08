# MPI-936 Checklist

Playbook: `docs/playbooks/add-model/README.md` (via `/mpi-add-model`). Engine v0.39.0 landed (MPI-1043).

- [x] Phase 0.1 transformer survey (`research/weights.md`)
- [x] Phase 0.2 accelerator-LoRA survey (`research/weights.md`)
- [x] Phase 0.4 accelerator strength axes: Fun-Acc 4-step NOT runnable on core 0.39 (PDD head bank); Viggle 6-step = plain PEFT, needs a sigma node; fast tier deferred
- [x] Phase 0.5 samplers/steps/cfg from the official Comfy templates (`research/graph.md`)
- [x] Phase 0.6 dep-reuse pass: encoder REUSES `boogu-qwen3vl-8b-clip` (stock Qwen3-VL-8B, Apache-2.0, proven); transformer + VAE new, HF-only
- [x] Phase 0.8 `docs/models/qwen-image-2/` hub
- [x] Weights on `G:\CubricModels`, sha256 verified (transformer, VAE, encoder)
- [ ] Phase 0.9 graph proven on the bench (`research/bench/graph.py`, one graph = t2i + edit + masked edit), exported to `comfy_workflows/raw/qwen_image_2_1.json`, synced
- [x] Licence gate: `QWEN_IMAGE_21` descriptor keyed `qwen-image-2-1`, bundled LICENSE + NOTICE, `poweredBy` = §3.c notice
- [x] Deps: `qwen-image-21-transformer`, `vae-qwen-image-21` (HF-primary, `noMirror`, sha256 pinned, credit)
- [ ] ModelDef (`t2i` + shared `edit` op, `multiReference8`), progressStages (counted live), rank + note
- [ ] NC badge on the Model Library tile (eye-test)
- [ ] Agent guide names the model (recipe pick), read-back, three agent tests
- [ ] One generation per op in the real app; RGBA output survives capture
