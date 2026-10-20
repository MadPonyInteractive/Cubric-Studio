# MPI-1207 checklist

## Phase 1 - investigation (done 2026-10-19)

- [x] Per local edit model: how the output latent is built, masked path (validation.md table)
- [x] Per cloud edit model: size field on edit (plumbing exists; fill-vs-crop needs one paid probe per family)
- [x] Bench every local edit model at a new frame (1024x1024 from a 571x1021 portrait), bare + canvas prompt
- [x] Fabio's rule: zoom / added content is fine, only bands fail
- [x] Verdict: wire Klein 4B/9B, Krea2, Qwen-Image 2.1, Boogu; Qwen Edit too, with the canvas line added to its prompt when custom size is on (Fabio)

## Phase 2 - graphs (Fabio in ComfyUI) + bench

- [x] Raws changed (agent, Fabio permission 2026-10-20): `custom AND NOT masked` gate on every edit latent; runtimes regenerated
- [ ] Regenerate runtimes, bench each: custom on fills / custom off follows ref 1 / masked keeps source frame

- [x] Custom size greyed out + false while a mask is drawn (all models, FLUX.3 too)

## Phase 3 - wiring (after FLUX.3's "Custom size" toggle lands)

- [x] customSizeOps + drop op from imageSizedOps per model (2026-10-19, uncommitted until the graphs bench)
- [x] sizeOptIn + customSize + qualityTier on kleinEdit / krea2Edit / qwenEdit
- [x] Input_custom_size from the toggle; canvas line on Qwen Edit (`canvasPrompt`, commandExecutor, unmasked only)
- [x] Cloud: one paid probe per family ($0.1336 spent): Seedream + FLUX-2 dev/Klein fill; FLUX-2 pro crops; Nano Banana stretches
- [x] Fabio decided (2026-10-20): Seedream 4/4.5/5 Pro, FLUX-2 dev, Klein 9B cloud get the button; FLUX-2 pro/max + Nano Banana do not. Wired (customSizeOps), unit suite 3446 pass (5 Pro later removed after its in-app run, next item)
- [x] One paid in-app run each on the unprobed members (Seedream 4.5, 5 Pro, FLUX-2 dev), approved: 4.5 + Dev pass, 5 Pro stretches and came off
