# Motion Context V2 (MiniMax H3 long video) - video notes

Source: YouTube `jsqHFgbjL08`, "Best MiniMax H3 Long Video Latent Context Workflow" (Prompt Mastery,
2026-09-22, 15 min). Watched from captions + description on 2026-10-29. Workflow itself not
downloaded or run (it sits behind a Gumroad pack / RunningHub).

## Claim

45 s single takes as three 15 s segments at 1.2 MP, no visible seam, picture AND sound carried.

## How it chains

- Each segment after the first is set to **context** (vs **shot** = unlinked new segment, and a
  "swap context" mode not explained). Context takes about **1 s of the previous segment's latents,
  video and audio**, and continues from them ("motion context"). Joins happen in latent space,
  not by re-encoding decoded frames.
- Mode per segment: **reference-to-video**, quality setting "max" (vs "match").
- One shared reference image (character sheet) applied to every segment; per-segment references
  allowed.
- Driven by a "Multi-Track Editor" node: segments on a timeline, drag to set lengths, modes
  text-to-video / ref-to-video / video-to-video / last-frame-to-video.
- `segment_start_number` (counts from 1) and `segment_count` (-1 = to the end). Locally the
  latents are saved per segment, so one segment can be redone; on a cloud run all render together.

## Constraints the author measured

- **Single pass only.** Latent upscale or a second sampling stage shifts pixels and the seams show.
  Resolution must be set in the one pass (0.81 MP in the demo, 1.2 MP for the showcase).
- **8 steps minimum for long chains**: picture barely degrades along the chain, **audio degrades
  noticeably** below 8 steps.
- Model: Singularity Ref2VA v1.3 (full) + the turbo 4-step v0.1 LoRA (they are trained together,
  must be paired). Text encoder NVFP4 or int8.
- Prompts: an LLM system prompt splits one scene description into linked per-segment prompts,
  each naming "picture 1" for the subject. Took the author three renders to get one right.
- Advice: start at 0.5 MP and 5-8 s segments.

## What it means for us

- Third candidate method next to MpiWindowedSampler (overlap 17, grid 5) and Viggle
  five_frame_anchor (decode + re-encode 5 anchor frames). This one keeps the overlap in latent
  space and carries the audio latent too, which is what Video Edit's window rule 2 needs.
- The no-second-pass rule collides with our draft > upscale > detail pipeline: a chained clip
  cannot be refined per window afterwards without seams. Needs a bench before we pick.
- Singularity H3 is already our own model (memory: Singularity H3 is its own model), so the model
  side may be in hand; the Multi-Track Editor node is the unknown (which pack, licence).
