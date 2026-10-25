# MPI-1285 validation

## Automated (H3 Singularity 10, 2026-10-25)

- Raw r2va edited by script, converted against the app engine (48188, ComfyUI 0.42.1, which
  has core BlockSparseAttention): converter self-check and injection rules passed, runtime
  baked. Runtime diff against HEAD: +12 nodes (switch, base, mode, refine size, hop 2 and its
  pick, one-pass pick, sol-attn), `Upscale Factor` removed, 12 rewired inputs, nothing else.
- Every tier x ratio (28 cells) x switch state, evaluated through MpiNodes' own `safe_math` on
  the RUNTIME graph's expressions: every cell delivers its labelled size, every stage-1 latent
  is even, and switch-off plans (stage 1, upscale target, Window Frames ceiling) are identical
  to before. Switch on: very_low/low/medium one pass; high/very_high/2K one hop from the base;
  4K and 21:9 2K two hops (2x base, then the target).
- `npm run lint` clean; `npm test` 3669 tests, 0 fail. One budget raised on purpose:
  agent tool schemas 16,394 -> 16,494 bytes for Cosmo's `fastMotion` (noted in the test).

## Not run yet

- No GPU execution of the new graph by me: the engine on this box is Fabio's live session.
  His in-app run is the first real execution (one-pass and upscale modes).

## Fabio in the app

- (pending) Button beside Turbo on H3 Reference only; Preview greys out at Medium and below
  with Fast Motion on; the Superman request through Cosmo comes back with Fast Motion on.
