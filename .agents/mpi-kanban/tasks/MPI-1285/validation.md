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

- Done by Fabio, 2026-10-25: the button, the Preview gate and real GPU runs of the r2va graph
  (the first executions of the new routing). His Superman/truck
  board, 3 s clips, wall times as the cards show them:

  | run | size | time |
  |---|---|---|
  | H3 Reference, Fast Motion on, turbo on (mode 1, one hop) | 1920x1088 | 7m 24s |
  | H3 Reference, Fast Motion on, turbo off (mode 0) | 1344x768 | 5m 11s |
  | H3 Reference, Fast Motion on, turbo on (mode 0) | 1344x768 | 4m 10s |
  | H3 Reference, Fast Motion off, new graph (sol-attn) | 1344x768 | 2m 38s |
  | H3 Reference, Fast Motion off, before | 1344x768 | 2m 56s |
  | MiniMax H3 (fl2va), BEFORE sol-attn (baseline) | 1344x768 | 3m 28s |

  sol-attn on the Fast Motion-off path: 2m 56s -> 2m 38s (~10%, one sample each). Mode 0
  costs more than the half-size path, as expected (stage 1 drawn at full size).
  Tearing with turbo off is the old ref2va DiT (MPI-1284), not this card.
- Done by Fabio, 2026-10-25: MiniMax H3 (fl2va) with sol-attn, a Reuse of the baseline run
  (same settings, same start frame), 1344x768, 3 s: **3m 28s -> 2m 32s**, 56 s faster (~27%,
  one sample each). The first GPU execution of the fl2va sol-attn graph; it ran clean.
- (pending) The Superman request through Cosmo comes back with Fast Motion on, set by Cosmo.
