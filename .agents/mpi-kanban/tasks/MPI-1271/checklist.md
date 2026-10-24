# MPI-1271 Checklist

- [x] Qwen-Image 2.1 graph + app wiring (38e8add8f)
- [x] Qwen Edit + SDXL raws fixed (38e8add8f), converted + baked (2026-10-24)
- [x] Krea2 raw: duplicate Input_custom_size 771 removed; 'Custom Size (latent)' 776 on control latent (any_3) — W x H empty latent when on
- [x] Chroma raw: 'Custom Size (latent)' 2807 on the depth latent (2758.true)
- [x] Klein raw: correct as Fabio wired it (latent reads the padded map); rgthree comparers kept bypassed
- [x] Sync + bake every control runtime; validator passes on all five templates
- [x] customSizeOps names control on SDXL x5, Chroma x2, Krea2 x2, Klein x2, Qwen Edit
- [x] tests: graph-pairing test in control-custom-size; op-strip tests updated; lint clean
- [x] Bench (2026-10-24): Krea2, Qwen Edit, Qwen-Image 2.1 pass (off = portrait, on = 1344x768)
- [x] SDXL fix: final resize sized from image 1 (GetImageSize 1677 <- 1609), so on came out portrait;
      1677 now reads 'Custom Size (latent)' 1775. Raw patched (patch_sdxl_outsize.py), converted on
      :48188, validated, orchestrate baked 5 SDXL runtimes (1 line each). Bench: off 816x1296, on 1344x768
- [x] Test: control branch's Get Image Size must read through Input_custom_size (fails on old SDXL)
- [x] Chroma + Klein benched via their twins on the same template (Flash/4B weights not on this box):
      chroma-hyper off 816x1296, on 1344x768. klein-9b off 816x1296, on 1360x768 — Klein re-scales
      the padded map to 1 MP (ImageScaleToTotalPixels 131) before sizing the latent, so the ratio holds
      but not the exact W x H. Klein 9B also ignored the control framing off AND on (full body from a
      head-and-shoulders depth source) — not Custom size, Fabio's call
- [x] Klein exact size (Fabio's rewire, 13:23): depth 1024 reads img1; off = depth -> 1 MP (723),
      on = depth -> pad W x H (719); latent/VAE/size read 'Custom Size (control)' 717. Comparers
      re-bypassed (bypass_klein_comparers.py — his save writes them mode 0 though the UI shows bypassed).
      Bench klein-9b: off 816x1296, on 1344x768. All 6 control-custom-size tests pass
- [ ] Eye-test: pad edges read as vertical structures (posts/door frames) on Krea2, Qwen 2.1, SDXL
- [ ] Commit SDXL raw + template + 5 runtimes + test; close-out after CI green

## Current State
SDXL fix + test uncommitted (claim cfeb6710). Bench harness fixed: no fallback to the Input_Image
preview (that produced the fake "source photo" results) and prints node_errors.
Next: Fabio decides Chroma/Klein weights download + looks at pad edges; then mpi-end-session.
Gotcha: Fabio's ComfyUI save of the Klein template keeps writing the three rgthree
Image Comparers (453/457/643) as active (mode 0) even when he bypasses them — the
committed raw (mode 4) is the good one; diff before any future Klein sync.
Pre-existing, not ours: tests/install-toast-restart.test.cjs fails against a peer's
uncommitted js/shell/notificationService.js + js/state.js.
