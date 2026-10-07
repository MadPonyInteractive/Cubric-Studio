# MPI-1036 - Video Edit Flow on MiniMax H3 Reference

Opened 2026-10-06 with Fabio. Replaces MPI-711's Bernini route: reference models now do
localised video edits, and Bernini was built before open reference video models existed.
MPI-711 (`done`) keeps the measurement record, including why H3 + LanPaint masking failed.

## Decided (Fabio, 2026-10-06)

- **Model: MiniMax H3 Reference** (`minimax-h3-ref2va`, graph `comfy_workflows/minimax_h3_r2va.json`).
  Fabio has swapped characters, recoloured and changed clothes in existing clips with it.
- **ONE Flow, not one per task.** Every task is the same graph - the clip as `<Video 1>`, an
  optional photo as `<Picture 1>`, a hidden instruction plus the user's own words. Only the
  instruction changes, so a "What to change" picker selects it: **Swap the person / Swap the
  head / Change the outfit / Anything else**. The picker also decides whether the photo is
  required. Precedent: Character Sheet's Style picker (`Input_Recipe`).
- **Photo optional.** No photo = the model invents from the words ("add a hat", "make the
  shirt red").
- **Optional mask step in v1**, the way Detail, Inpaint and Edit already respect masks on
  images. Why: crop-and-stitch round a small region renders ten times faster or more (an
  object, a small animal), and everything outside it stays the source's own pixels at the
  source's resolution. Proven on Bernini (MPI-711). The mask step is **MPI-715** (mask clip
  transport + adjust gizmo), which the video detailer MPI-557 also needs - so MPI-715 lands
  before or with this.
- Umbrella: **MPI-897** (localised editing). MPI-745 (LTX video head swap, deferred) covers the
  same job as the Swap the head option.

## What today's H3 runs say the Flow must handle

Source: MPI-1033 `validation.md` runs 1-5, `docs/models/h3/ref2va.md` § "Lip-sync holds".

- **Edits overshoot or fall short.** "Black horse, red wagon cover": horse black, cover stayed
  beige. "Emerald dress": green, but the cut changed too. The hidden instruction must say
  plainly to keep everything else the same.
- **Unmasked, the whole frame is redrawn and comes back smaller.** SSIM vs source 0.52-0.70; a
  1344x768 source came back 832x448. The mask step is the answer for small edits.
- **Two instruction variants per option, with and without a photo.** `MpiH3References` strips a
  tag naming an empty slot, so one template would read "...the person from ." when no photo is
  attached.
- **The soundtrack survives** a sounded `<Video 1>` (0.96-0.97 envelope) with no graph change.
- **Slow.** 5 s (124 frames) = 1080-1140 s on the 4060 Ti, turbo on; 3 s = 610 s. Long clips
  get a warning, never a cap.

## Character Swap LoRA - akatz-ai, checked 2026-10-07

<https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA> - Fabio's find, a candidate
for the Swap the person option only.

- **One file**, `h3_character_swap_pro4500_1000.safetensors`, 155,110,320 B, rank 16,
  model-only, strength 1.0, no trigger word. 348 likes / 23k downloads by 10-07.
- **Trained on the exact transformer we ship**: their `training/base-model-files.json` sha256
  `9255f52b...` = our `minimax-h3-ref2va-transformer` dep.
- **Licence: the MiniMax H3 Community License itself** - same territory exclusion, so the
  existing H3 gate covers it. Host it like the transformer (download from HF), not on R2,
  until someone argues it the way MPI-517 argued the VAE.
- **Its README's example prompt is the starting point for the hidden instruction** (README §
  Use): name the target person in `<Video 1>`, take identity/outfit/style from `<Picture 1>`,
  keep camera, background, lighting, objects and other people, match position/scale/pose/
  movement, never show the reference sheet. It needs WHO to replace, so the Flow needs a
  "Who to replace" field (default "the person"). Training captions were the short form,
  "Swap <who> in <Video 1> with the character in <Picture 1>."
- **Author's limits (v1, 1,000 steps, trained on still edits, not moving targets):** best on
  short continuous shots of 4-5 s; long windows drift; hard cuts turn into zooms; close-up
  expressions do not follow; stronger expression prompts sometimes cancel the swap. Their
  audio was the SOURCE track remuxed in post - so the Flow should mux the source audio back
  for swaps rather than trust the generated track.
- **Untested here:** stacking with our turbo 8-step LoRA (they tried "a 768p Turbo 8-step
  LoRA"), and whether it helps or fights Swap the head (it carries the outfit over too).
- Their bench workflow ships in the repo: `examples/H3 Character Swap v1 Ref2VA.json`.

## Constraints

- **Licence.** H3's licence excludes the EU, UK, USA and South Korea; the Flow sits behind the
  same `MpiLicenceGate` as the model (`docs/models/h3/README.md` § Licence). Keep the hidden
  instructions model-neutral so a later open reference model (LTX 2.5, others) can replace H3
  without a new Flow.
- Prompt tags are SLOT numbers, rewritten in `MpiH3References` (`docs/models/h3/ref2va.md`).

## Open - Fabio's calls

- **Video head swap free or paid?** The image Head Swap is a paid Gumroad Flow. Proposed: free
  inside Video Edit until its quality on video is judged.
- **What "Anything else" allows.** Free text + our uncensored text encoder on real footage can
  undress real people ("remove the shirt"). Decide the policy before it ships.

## Noticed
