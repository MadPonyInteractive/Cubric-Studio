# MPI-1185 Brief - Bench PiD 1.5

Member of MPI-1267 (LTX 2.5 release) since 2026-10-24; before that MPI-1179 (New Models to
Test), split out of MPI-343's "PiD 1.5" entry on 2026-10-18. MPI-343's `plan.md` keeps the shared
method (licence first, measure don't eyeball, never delete a dep entry); read it, and MPI-343's
`brief.md` (the original PiD 1.5 research), before starting.

## Fabio's call (2026-10-24)

PiD 1.5 is an UPGRADE to the PiD we ship, and it goes out in the LTX 2.5 release. Test the two
side by side, old vs new, on the same inputs. **If 1.5 wins, it replaces the old one** (he expects
it will). If it loses, the old one stays and this card closes with the findings. ADD (shipping
both) is not the plan; raise it with Fabio only if the bench shows each one clearly wins at
different jobs. The swap stays off users until the LTX 2.5 release, like every member of it.
Retiring the old weights follows `docs/playbooks/add-model/README.md` § "Removing or re-tiering"
(never delete the dep entry).

## The question

ComfyUI v0.28.0 lists "Support PID 1.5 models" (#14894), a newer generation of the PixelDiT
upscaler we ship as `nvidia-pid`. Answer before any wiring:

- what changed in 1.5 (quality / steps / speed / VRAM);
- whether the four-checkpoint structure holds (a drop-in weight swap, or a workflow +
  `Input_Type` change);
- what the replace costs: ~2.7 GB per leg re-uploaded to R2, and a re-download for users.

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

A written old-vs-new comparison backed by a measured delta (not one generation) and a licence
check. 1.5 wins: it replaces `nvidia-pid`, wired on this card, gated until the LTX 2.5 release.
1.5 loses: a "no" is a complete answer and closes the card.
