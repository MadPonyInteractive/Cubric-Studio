# MPI-775: Brainstorm YuE2, the open-source song model

**This card exists to run a brainstorm (`mpi-brainstorm`), not to hold a plan.** Fabio has not
decided how to approach this. The brainstorm explores the options and produces the plan. Do not
write `plan.md` or `checklist.md` on this card before that has happened.

## Links

- Model: https://github.com/multimodal-art-projection/YuE (weights: https://huggingface.co/m-a-p/YuE2-3B)
- ComfyUI nodes: https://github.com/filliptm/ComfyUI-FL-YuE2

## Fabio's starting ideas (2026-09-15), to explore, none decided

- A Flow for it.
- An audio workspace, which the app does not have yet.
- DAW-style widgets, for example a piano roll and a track selector.

Public context: the Discord announcement of 2026-09-15 lists "a DAW-style music workspace for
YuE2" as in the works, with no promise that it lands in 2.0.

## What the model is (read from the links above, 2026-09-15)

- A ~3B song model by m-a-p: lyrics plus a style prompt become a full song with vocals. Mid-way it
  writes an editable score (ABC notation, melody and chords), then renders 48 kHz stereo audio.
- The controls that make it worth it (Fabio): notation input, changing chords, setting the notes
  the voice sings, borrowing notes from another song, adjusting the score it works from.
- The upstream README also lists covers and editing, with SheetSage2 doing audio-to-score for covers.
- **ComfyUI-FL-YuE2 nodes:** Load Models, Compose (score from style and lyrics; planning modes
  `full` / `melody` / `off`; seed), Render Music, Decode Audio (standard ComfyUI `AUDIO`), and
  **Piano Roll**, an editable score editor for melody, chords and arrangement. Check what that
  node already does before designing a piano-roll widget.
- The node pack auto-downloads ~7.8 GB into `ComfyUI/models/yue2/` (resumable, manifest-verified,
  can be switched off). Needs a BF16-capable NVIDIA GPU and a current ComfyUI with Comfy Kitchen's
  RMS/RoPE ops. Validated only on an RTX PRO 6000 Blackwell on Windows; 24 GB setups are
  unvalidated; VRAM drops with a shorter duration or a smaller decoder tile. Score token budget is
  capped at 12,000.
- The model card lists 24 GB VRAM with a measured peak of 14.08 GiB. Measure on a 16 GB card.

## Licence (read 2026-09-15, approach decided by Fabio)

- Weights: CC BY-NC 4.0. `MODEL_LICENSE` covers only the checkpoint weights. Code, upstream and
  node pack: Apache 2.0.
- **Generated songs are not addressed** in `MODEL_LICENSE`, the README or the model card. That is
  unlike FLUX.2 Klein 9B, whose licence explicitly frees outputs.
- The Hugging Face repo is not gated.
- Third-party components (YuE2-Vae, SheetSage2, MERT-v2) keep their own licences. Check each one.

**Decision (Fabio, 2026-09-15):**
- A consent-only `MODEL_LICENCES` entry, following the MiniMax Music 3 precedent: show the licence,
  the user accepts it and carries the responsibility.
- **No `verify` block.** There is no per-person grant to prove.
- **Never host the weights on R2.** They download from Hugging Face.
- Attribution through a `credit` on the deps, so it shows on the About page.
- UI copy never claims songs are commercially usable.

Mechanics: `js/data/modelConstants/licences.js`, `docs/download-manager.md` § The licence gate.

## When this card is done

When the brainstorm has produced a plan, on this card or on cards it creates; the brainstorm
decides which. Implementation is not this card's job.
