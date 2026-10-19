# MPI-1207 checklist

## Phase 1 - investigation (done 2026-10-19)

- [x] Per local edit model: how the output latent is built, masked path (validation.md table)
- [x] Per cloud edit model: size field on edit (plumbing exists; fill-vs-crop needs one paid probe per family)
- [x] Bench every local edit model at a new frame (1024x1024 from a 571x1021 portrait), bare + canvas prompt
- [x] Fabio's rule: zoom / added content is fine, only bands fail
- [x] Verdict: wire Klein 4B/9B, Krea2, Qwen-Image 2.1, Boogu; Qwen Edit too, with the canvas line added to its prompt when custom size is on (Fabio)

## Phase 2 - graphs (Fabio in ComfyUI) + bench

- [ ] Fabio changes each raw: `custom AND NOT masked` gate on the edit latent (Klein: Flux2Scheduler W/H too; Boogu, Qwen Edit: add Input_Width/Height)
- [ ] Regenerate runtimes, bench each: custom on fills / custom off follows ref 1 / masked keeps source frame

## Phase 3 - wiring (after FLUX.3's "Custom size" toggle lands)

- [ ] customSizeOps + drop op from imageSizedOps per model
- [ ] sizeOptIn + qualityTier on kleinEdit / krea2Edit (/ qwenEdit if wired)
- [ ] Input_custom_size from the toggle; canvas line where the model needs it (FLUX.3, Qwen Edit)
- [ ] Cloud: one paid probe per family (price stated first), then decide
