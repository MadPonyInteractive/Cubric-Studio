# MPI-1185 Brief - Bench PiD 1.5

Member of MPI-1179 (New Models to Test). Split out of MPI-343's "PiD 1.5" entry on 2026-10-18,
when MPI-343 merged into MPI-1179. MPI-343's `plan.md` keeps the shared method (licence first,
measure don't eyeball, REPLACE vs ADD explicit, never delete a dep entry); read it, and MPI-343's
`brief.md` (the original PiD 1.5 research), before starting.

## The question

ComfyUI v0.28.0 lists "Support PID 1.5 models" (#14894), a newer generation of the PixelDiT
upscaler we ship as `nvidia-pid`. Answer before any wiring:

- what changed in 1.5 (quality / steps / speed / VRAM);
- whether the four-checkpoint structure holds (a drop-in weight swap, or a workflow +
  `Input_Type` change);
- REPLACE vs ADD, at ~2.7 GB per leg re-uploaded to R2.

The shipped engine is past v0.28 now, so the engine gate MPI-343 named is likely gone; confirm.

## What ships today

`nvidia-pid` is one model with four VAE-locked 1024->4096 4-step bf16 checkpoints at 2.72 GB
each, selected at runtime via `Input_Type`. **Compat is the VAE latent space, not the model
name** (MPI-182).

Cross-references written after the entry (check they still hold before relying on them):
`nvidia-pid` was being converted into four upscale-dropdown plugins under MPI-553, and its
`ModelDef` was scheduled for removal on 1.5 (MPI-515). Evaluate PiD 1.5 against where
`nvidia-pid` lives today, not where it lived in 2026-08.

## Done means

A written REPLACE / ADD / DROP decision backed by a measured delta (not one generation) and a
licence check. A "no" is a complete answer and closes the card.
