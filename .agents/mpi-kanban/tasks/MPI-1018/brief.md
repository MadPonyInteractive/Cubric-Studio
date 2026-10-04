# MPI-1018 brief

Wan 3.0 borrowed Wan 2.2's enhancer recipe and agent guide. It now has its own (`wan-3.0`),
built from Alibaba's official Wan 3.0 prompt guide; `wan3-cloud` points at it, which is also
what gives Cosmo `guide:wan-3.0`. The recipe stays `draft` until Stage 2.

**Waiting on Fabio:**
- Stage 2: real Wan 3.0 renders (DeepInfra, costs money).
- The flip shipped with one Stage 1 case open: r2v with no references attached, `directed`
  tier, invents `<Image 1>`. Agent's pick; reverse it if he disagrees.

Record: `docs/recipes/research/wan-3.0/validation.md`.

**Stage 2 so far (Fabio's own runs, 2026-10-04):** t2v repeat at 720p 4 s ($0.40) — "100 times
better than H3". ref2v at 480p 2 s 1:1 ($0.10, ref2v_004): Cosmo cited the girl as plain
`Image 1` and Wan kept her identity. The `<Image 1>` bracket form the Enhance recipe writes is
still unproven on a real render.

## Noticed

- Wan 3.0 square at 480p renders 640x640; the app asked for 480x480 (`_cloudVideoRatios`). Billing
  is per second, so the price is right; only the size table is off. Fabio: "bit weird, but okay".
- MiniMax H3 needs to get better (Fabio, 2026-10-04); out of scope here.

- Other models still borrow a guide: Veo -> kling-3.0, Seedream and Nano Banana -> flux-2. After 2.0.
