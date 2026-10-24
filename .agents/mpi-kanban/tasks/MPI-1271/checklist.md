# MPI-1271 Checklist

- [x] Qwen-Image 2.1 graph + app wiring (38e8add8f)
- [x] Qwen Edit + SDXL raws fixed (38e8add8f), converted + baked (2026-10-24)
- [x] Krea2 raw: duplicate Input_custom_size 771 removed; 'Custom Size (latent)' 776 on control latent (any_3) — W x H empty latent when on
- [x] Chroma raw: 'Custom Size (latent)' 2807 on the depth latent (2758.true)
- [x] Klein raw: correct as Fabio wired it (latent reads the padded map); rgthree comparers kept bypassed
- [x] Sync + bake every control runtime; validator passes on all five templates
- [x] customSizeOps names control on SDXL x5, Chroma x2, Krea2 x2, Klein x2, Qwen Edit
- [x] tests: graph-pairing test in control-custom-size; op-strip tests updated; lint clean
- [ ] Bench render per graph, Custom size on and off (needs Fabio's go — GPU)
- [ ] Commit generated + app files; close-out after CI green

## Current State
Everything wired and baked, uncommitted. Next: Fabio's go for bench renders.
Gotcha: Fabio's ComfyUI save of the Klein template keeps writing the three rgthree
Image Comparers (453/457/643) as active (mode 0) even when he bypasses them — the
committed raw (mode 4) is the good one; diff before any future Klein sync.
Pre-existing, not ours: tests/install-toast-restart.test.cjs fails against a peer's
uncommitted js/shell/notificationService.js + js/state.js.
