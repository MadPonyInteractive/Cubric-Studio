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
  source's resolution. Proven on Bernini (MPI-711). ~~The mask step is **MPI-715** (mask clip
  transport + adjust gizmo), which the video detailer MPI-557 also needs - so MPI-715 lands
  before or with this.~~ **Superseded 2026-10-08:** the mask step is a text field + SAM3 + a
  square box, no MPI-715 (§ Phase 2).
- Umbrella: **MPI-897** (localised editing). MPI-745 (LTX video head swap, deferred) covers the
  same job as the Swap the head option.

## The main use (Fabio, 2026-10-07) - read this first

**Performance capture.** A user films a performance on a phone or camera, picks a character
image (and optionally a background), and the character performs it. Known, heavily used
workflow among AI filmmakers and small studios. So the headline option is the picture-supplies-
the-look mode (bench run F): the clip is ONLY the performance. Swaps inside an existing clip
are secondary.

What that changes:
- The **face and voice** are the performance, not just the body. The bench dance clip tests
  neither. Judge on an acting/talking clip: expressions, lip-sync, the performer's own voice
  carried over (MPI-1033: a sounded `<Video 1>` keeps its soundtrack and lips follow `<Audio 1>`).
- Depth or line-art input (runs F_depth / F_lineart) stops phone-footage quality leaking, but
  may lose the mouth and eyes; pose with face landmarks (DWPose, on the bench) is the other
  candidate.
- Prior art on this machine: Fabio's Wan Animate workflow
  (`D:/WORK/workflows/New Systems/Wan Animate Local.json`) does exactly this job; MPI-711 kept
  motion transfer there. The same performance clip through both is the fair comparison.

## Fabio's verdict on the bench runs (2026-10-08)

- **"Very good results. I'm happy."** H3 Reference does this with fewer nodes and less hassle
  than Bernini or Wan Animate, so both leave the board (MPI-711 done, MPI-289 rejected; Fabio
  keeps them on the Trello board).
- **Raw clip for the main objective.** Depth / canny / line art stay useful for other inputs -
  e.g. a simple Blender render (bare walls for a sense of space, an untextured character
  shape) - not for real footage.
- **Invented legwear is GOOD, not a flaw:** nothing was prompted, and it made nice shorts.
- G (background from the cat photo's bedroom): "a very good job indeed".

## Added 2026-10-07 (Fabio, after the first bench A/B)

- **The photo input for a swap is a character SHEET** (front + back), not a single portrait.
  A front-only photo leaves the back of the head unknown and the source's hair comes back
  when the subject turns away (runs C and D, both).
- **Background choice for Swap the person: keep the video's room, or take the photo's.**
  With the photo's room the clip is only a motion guide (H3 already does image + video ->
  "she performs the dance", `docs/models/h3/ref2va.md`). The instruction must lead with "make
  the woman in the picture do the same dance as the woman in the video, using the video ONLY
  as a reference" - otherwise the video's poor quality carries into the result (Fabio). The swap LoRA was trained to keep the
  SOURCE scene, so it is expected ON for "keep video background" and OFF for "photo background".
- **New option: Change the background** - keep the person, take the room from an image.
- **Idea (Fabio): feed the clip as line art or a depth map** when it is only a motion guide, so
  its picture quality cannot reach the result (seen done with Blender line renders into H3).
  The bench has `comfyui_controlnet_aux` with Depth Anything V2 Large and LineartStandard;
  runs F_depth / F_lineart test it. Only for the photo-background mode - keeping the video's
  room needs its real pixels.
- **All prompts follow the H3 r2v recipe shape** (`js/data/recipes/minimax-h3.recipe.js`, r2v):
  look line, a reference line giving every asset a job and naming what a content reference
  must NOT supply, one `[Shot 1]`, camera line, the two sound fields, constraints last.
- **Flow UI (Fabio):** a dropdown for the operation, and a switch or radio for which
  background to keep (video's or picture's).
- **Several characters.** The swap LoRA replaces ONE character per run (its README: trained on
  single-character targets only, two-character inference untested). Fabio has swapped two at
  once WITHOUT the LoRA. So: one person -> LoRA on; two people in one pass -> LoRA off, one
  picture per character; or two passes, LoRA on, the second run on the first one's result.
- **Run E (mirror shot as the only picture, LoRA + turbo, 591 s) - PROVEN, Fabio:** a picture
  that shows the character's back IS used when the performer turns away - dark bun, no source
  blonde left. Usable video. Side effects, put down to the photo's very different angle: the
  first 1.6 s show the photo itself before a hard cut to the dance, and the source's shorts
  stayed (the photo never shows her legwear). A plain-background front/back sheet avoids both.
- **Runs F / F_depth / F_lineart / G (576x1024, turbo, LoRA off, recipe-shaped prompts):**
  - **F with the RAW clip is the best of the three.** Character, bathroom and the photo's clean
    sharp look all came through; the clip's blur and watermark did NOT; the dance and the turn
    to the back follow the source; the back shows her bun. 981 s.
  - **Depth and line art bought nothing on this clip and cost identity:** both turned her bun
    into long loose hair from behind (the source dancer's hair silhouette travels in both), and
    the depth run gave her black briefs instead of shorts. 1,751 / 1,761 s - but that is
    partly the bench run's own error: the preprocessors output 1024x1820, 3.2x the target's
    pixels, so a fair timing needs `resolution` = the output size.
  - So the quality leak was the PROMPT, not the pixels: with the recipe shape and "the clip is
    only the choreography", raw footage did not carry its quality across. Depth/line art stay a
    candidate only for faces/lip-sync, untested.
  - Legwear is invented in every F run (the photo shows bare legs under the sweater) - the
    character sheet should show the whole outfit.
  - **G (keep the dancer, bedroom from the cat photo): works.** Dancer kept as she is, the room
    and its light replaced, the vanity mirror even reflects her. The TikTok overlay SURVIVED the
    "no text" line - in keep-the-video modes it is part of the kept pixels. 1,011 s.
- Bench resolution so far 480x864 (0.41 MP, ~1.3 MB per 5 s clip); the F/G batch runs 576x1024.
- **Remove on-screen text** (captions, usernames, watermarks) and **match the photo's quality**
  belong in the hidden instruction; Higgsfield does both on the same clip. Bench runs F and G
  test them.
- Bench so far (seed 904234, 480x864, 124 frames, turbo 8 steps): LoRA on 611 s (incl. load),
  off 510 s. LoRA on kept the room slightly closer (background diff 14.2 vs 16.4 /255) and kept
  the TikTok overlay; off dropped it. Fabio: LoRA on is a bit closer to the character.

## Phase 2 - mask path bench (2026-10-08)

Clip: last 3 s of Fabio's `new (3).mp4` (medium shot -> close-up, sound), 576x1024, 73 frames.
Edit: cat ears -> small red demon horns, and remove them. SAM3 "cat ears" held both ears in every
frame. All turbo 8 steps, LoRA off, seed 904234, source audio muxed back. Outputs
`D:/WORK/Images/Outputs/mpi1036/{M_,M2_,M3_,M4_,U_}*`.

- **Speed: masked 512x512 crop samples at 12.3 s/step vs 44 s/step whole frame (3.6x);**
  whole run 150-176 s vs 422 s (2.4-2.8x). The crop is still 44% of this frame's pixels; a
  smaller object in a bigger frame gains more. SAM3 in-graph adds ~75 s incl. load (the Flow's
  mask arrives ready from MPI-715, so that is not edit time). ComfyUI caches the SAM3 + crop
  output across runs with the same settings - a timing that reuses it is not a cold run.
- **H3 r2v does not reproduce the crop pixel for pixel:** the head drifts up to ~20 px in the
  512 crop and the motion is re-performed, close but not exact. Everything below follows from it.
- **M1, ear-shaped mask (+12 px):** clip untouched outside (1.35/255 vs codec noise), but the
  horns land further in than the wide ears were and get CLIPPED by the mask, and a pale
  ear-shaped GHOST shows on the wall: H3 renders the crop's wall a touch lighter.
- **M2, mask grown +32 px + `ComposeColorMatch` (Mickmumpitz, Grade match surround, band 48):**
  both horns whole, ghost nearly gone (faint outline on remove), caption kept, no seam on the
  body. The grade match is the ghost fix; it fits gain+offset on the band outside the mask.
- **M3, Fabio's still square (`MpiMaskSquareBbox`, padding 64, union of every frame) + grade
  match:** horns bold and whole, ears fully gone, no ghost - but the box's lower edge crosses her
  moving hands and hair, and the blend there shows a DOUBLE EXPOSURE (two hand positions) and a
  hair seam. The caption inside the box was removed by the "no text" line, the TikTok mark
  outside it stayed.
- **M4, same box, padding 128 (clamped to the 576 frame width):** worse - the first frames turned
  her hair RED (the "red horns" bled into a bigger regenerated area) and the wall pinkish, then
  dark again: colour flicker plus a red/brown seam at the box edge. A bigger box = more of the
  frame re-rendered = more drift.
- **Whole frame (U):** clean bold horns, but the caption and watermark vanish and by 2.6 s her
  pose and framing have drifted from the source (30/255 outside the ears).
- **OUT OF SYNC - Fabio spotted it; measured.** Frame rules are NOT the cause here: the node
  (`comfy_extras/nodes_minimax_h3.py`) trims a reference video to the output length and snaps it
  to 17k+5; ours is 73 frames at 24 fps in and out, and the mask is made from the same 73 frames.
  The cause is that a reference video is not frame-locked (`minimax_refs`, never
  `minimax_keyframes`): in EVERY run H3's output starts in sync, falls 2-4 frames BEHIND the
  source through her fast lunge (frames ~5-30), catches up, and ends ~1 frame ahead. Measured by
  best-matching each output crop frame against the input crop within +-12 frames.
- **M5 = Fabio's still square (pad 64) as the RENDER area via `InpaintCropImproved`
  `optional_context_mask`, the grown shape (+32, blend 24) + grade match as the PASTE area.**
  Her face stays the source's, horns whole, no seam on her hands (outside drift 1.36/255).
- **Re-sync before the stitch (`resync.py`, no new render, 39 s):** for each source frame pick
  the output frame that best matches it outside the edit band (+-6, kept monotonic), then stitch.
  Paste-edge drift in the fast frames: horns 3.53 -> 2.91 (-18%), remove 3.62 -> 3.30 (-9%);
  slow frames unchanged. A Flow would need this as a node (none on the bench does it).
- **Fabio's eye test (2026-10-08): every shape-mask paste FAILS** (ghosting round the ears) and
  the box drifted out of sync. Shape-only masking dropped; the square box is the one to land.
- **THE SWAP LoRA FIXES THE BOX'S SYNC.** Same box (pad 64) + akatz-ai Character Swap LoRA at
  1.0 under the turbo LoRA: lag in the fast frames 2.27 -> **0.00** (every frame matched), drift
  inside the box 5.09 -> 2.97/255, no hair seam or doubled fists at the box edge, horns made.
  It was trained to keep the source's position, pose and movement, and that holds for edits,
  not only swaps. 185 s. So the LoRA is NOT swap-only: it goes on for every masked edit.
- **Camera line** ("locked off, it is the woman who leans in", Fabio's idea that a crop hides who
  moves): lag 2.63 alone, 0.00 with the LoRA - adds nothing measurable. Fabio: could be a Flow
  toggle; the numbers say the LoRA already covers it.
- **Soundtrack paired with `<Video 1>`** (`ref_video_audios`): skipped on Fabio's call.
- Re-sync is moot once the LoRA is on.
- **Fabio's verdict (2026-10-08): PASS** for box + swap LoRA (horns and remove), box + LoRA +
  camera line, AND the plain box re-timed by `resync.py` (no LoRA) - so re-sync is a working
  fallback where the LoRA is unwanted. Plain box and every shape mask fail. Whole frame stays
  the fallback for edits a box cannot hold.
- **Phase 2 recipe:** SAM3 (text) -> `MpiMaskSquareBbox` padding 64 (still square, union of all
  frames) -> `InpaintCropImproved` (context 1.25, blend 24, target 512) -> H3 turbo 8 steps +
  swap LoRA 1.0 -> `ComposeColorMatch` grade match on the band outside the box -> stitch, source
  audio muxed. In masked mode the hidden instruction must NOT carry "no text": it removes text
  inside the box only.
- **DECIDED (Fabio, 2026-10-08): the mask step is a TEXT field.** The user names the object
  ("cat ears"), SAM3 finds it in-graph, the square box goes round it. No painted mask: painting
  means every frame or keyframed mask moves - too complex. **MPI-715 is no longer a dependency.**
- **Phase 3 parts check (2026-10-08):** SAM3 ships with the engine (`sam3-multiplex`,
  `assetDeps.js`); `MpiMaskSquareBbox` is in the pinned MpiNodes (`3e8d7d2`); KJNodes and
  Inpaint-CropAndStitch are in `node_lock.json`. NOT shipped: the swap LoRA (a new dep, HF
  download behind the H3 gate) and `ComposeColorMatch` (Mickmumpitz pack, bench only) - the grade
  match needs a shipped node: KJNodes `ColorMatch`, or a small MpiNodes node.

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

## Decided - Fabio, 2026-10-08 (were the open calls)

- **Video head swap is FREE** inside Video Edit - once it is tested on video (not benched yet).
- **Clothing removal stays an option; no refusal.** Example use: the user supplies a torso image
  and replaces the torso of a man in a shirt so he looks ready for a fight. If it needs its own
  wording it becomes its own entry in the operation dropdown (the Bernini-workflow pattern: the
  user picks the operation type, the hidden prompt follows it) - same dropdown as decided
  2026-10-06/07, not a separate Flow.

## Noticed
