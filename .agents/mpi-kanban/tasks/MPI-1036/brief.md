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
