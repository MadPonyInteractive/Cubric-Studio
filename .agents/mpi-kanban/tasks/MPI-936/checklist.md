# MPI-936 Checklist

Playbook: `docs/playbooks/add-model/README.md` (via `/mpi-add-model`). Blocked on MPI-1043 (engine v0.39.0).

- [x] Phase 0.1 transformer survey (`research/weights.md`)
- [x] Phase 0.2 accelerator-LoRA survey (`research/weights.md`)
- [x] Phase 0.5 samplers/steps/cfg from the official Comfy templates (`research/graph.md`)
- [ ] Phase 0.6 dep-reuse pass (nothing reusable expected: every weight is new and research-licensed)
- [ ] Phase 0.8 `docs/models/qwen-image-2/` hub
- [ ] Phase 0.9 graph authored + proven on the bumped bench, saved to `comfy_workflows/raw/`
- [ ] Wiring checklist (playbook README) incl. licence gate + NC badge + bundled LICENSE + attribution notice
- [ ] Deps point at Comfy-Org/Qwen-Image-2.1 on HF, never R2
- [ ] One generation per op in the real app; RGBA output survives capture
- [ ] Agent knowledge (07): rank, note, guide, licence must-say
