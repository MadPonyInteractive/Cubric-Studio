# MPI-971 checklist

Derived from `plan.md` (2026-09-30). The plan holds the detail; this is the tick list.

- [x] Phase 1: engine copy (lossless PNG, long edge 4096, EXIF upright, sidecar-less works, cached) + renderer pre-pass on model-resolution ops (registry flag, unmasked runs only)
- [x] Phase 1 verify: unit tests (4096, 4097, EXIF 6, sidecar-less, cache hit); 16K Klein Edit + i2v first frame on the local engine land a card; app.log shows the copy staged; <=4096 stages the original
- [ ] Phase 2: localised edits crop around the mask, run, stitch back through the mask (user-ux)
  - [x] built + automated verify (engine-mask tests 6/6, npm test 2392/0, live 16K + 32K small/big masks: source-size cards, 0 bytes differ outside)
  - [x] Detail joins the cut (cropsToMask + 0.45 reach): engine-mask 8/8, npm test 2394/0, live 16K Klein 9B detail
  - [x] Fabio looks at a 16K localised edit in his app (2026-09-30: Detail, masked Klein Edit, masked Inpaint all 16K)
  - [ ] Pod path: one run proves the upload carries the cut (costs money, ask first)
- [x] Phase 3: remove background on the capped copy + alpha onto the original; upscale guard (P-A) (user-ux) — Detail done by Phase 2's cut
  - [x] built + automated verify (engine-mask 10/10, upscale-limit 2/2, npm test 2412/0; live 16K cut-outs clear + green = 16384^2 cards, original RGB exact; 16K upscale refused before dispatch; rail greys all four factors on the 16K, none on the 2K)
  - [x] Fabio looks at a 16K Remove Background + the Upscale rail on a 16K in his app (2026-09-30, "All tests passed")
  - [x] the upscale refusal carries `userMessage` / `code` so the in-app agent names the reason (live: TOO_BIG + reason)
- [x] Phase 4: Flows with source-coordinate inputs work on a 16K or refuse with a reason (Draw It In 16K card live; Scribble engine copy; Outpaint refused; load backstop for everything else)
- [ ] Preservation: docs rule "the engine never gets more than ENGINE_MAX_EDGE"; add-model playbook note; MPI-962 plan + UNRELEASED line
