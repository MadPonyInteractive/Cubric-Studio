# MPI-557 research - ComfyUI-H3-FaceRefine (2026-09-25)

Research only. **No work on this card before 2.0 ships** (Fabio, 2026-09-25: no new
Flows before the v2 release).

## Scope change - any region, not just faces

Fabio, 2026-09-25: *"I don't want it to be a video face detailer. I want it to later on
possibly use Sam3 to choose what we want to detail, not just the face, but anything:
hands, a face, anything."*

The card is now a **video detailer for any region, picked with SAM3**. The face is one
target among many.

## Source

- Video: Benji's AI Playground, "MiniMax H3 Fix Blurry Faces (Actually By Segment)",
  2026-09-12, 9 min - https://www.youtube.com/watch?v=zmSeO6GjBBM
- Node pack: https://github.com/Carasibana/ComfyUI-H3-FaceRefine - **MIT**, v1.1.2,
  created 2026-08-12, last push 2026-09-13, 435 stars. A 1.0.0 -> 1.1.0 change broke
  saved workflows, so the pack is still moving.

## What it is

The same idea as Impact Pack's FaceDetailer, redone for video on **MiniMax H3**,
which we already ship. The steps:

1. **Track + Crop**: run a YOLO detector on every frame and fill gaps (a fallback body
   detector, or interpolation). Smooth the centre (gaussian, 21 frames) and the size
   (51 frames; separate, because size jitter reads as shimmer). Emit a fixed-size
   crop batch plus a `transform` that records where each crop came from.
2. **Inject Video Latent**: VAE-encode the crops into the video stream of H3's AV
   latent. This is H3's missing img2img / v2v path.
3. **H3 ref2v** with the SAME character references the shot was generated with. The
   references are the identity source (level 2 in brief section 4), with no LoRA.
4. **Per-Frame Denoise**: patches the MODEL, not the latent. Denoise scales by face
   size per latent frame: full base on tiny faces, x0.35 on large ones. One pass
   covers a shot that goes from far to close.
5. **Stitch Back**: warp each crop back with one batched `grid_sample` (sub-pixel), then
   feather and composite. Only the face box is pasted, never the whole crop (88% vs
   16% of the canvas). The crop is there for sampler context.

Settings shown in the video: 8 steps (turbo LoRA), base denoise 0.40-0.45 (the
presenter's range is 0.35-0.45), canvas 768, crop_factor 2.5, detector confidence 0.30,
stitch feather 24 for a rect mask. It works even on a 960x544 (0.5 Mpx) source.

## Facts worth keeping

- **Denoise on H3 does not work like SDXL.** It is flow matching at shift 12:
  `sigma = shift*t / (1 + (shift-1)*t)`. denoise 0.05 gives sigma 0.387 and 0.25 gives
  0.800. Do NOT use `SplitSigmas`: even its last split on a 4-step schedule is 0.800.
  `steps` and `denoise` are independent in `BasicScheduler`.
- **Per-Frame Denoise must sit in the model path.** If the unpatched model reaches the
  guider, the held frames come back nearly clean and nothing reports an error.
- The granularity is one latent frame = ~3.4 pixel frames (H3 packs 17 pixel frames
  into 5 latents). The frame count snaps to H3's 17k+5 grid.
- **Mask the INPUT crop, never the output.** If the model shrinks the face, a mask
  taken from the output lets the original nose poke out past it.
- **The author says a rect mask often beats SAM.** A tight mask puts the seam on the
  silhouette, where drift shows. A loose rect puts it in hair and background. With SAM
  masks, feather 4-8; with a rect, ~24.
- Cost = canvas squared x frames. Auto canvas sizing ignores VRAM and falls into
  weight streaming, an order-of-magnitude slowdown with no error.
- Hard cuts: PySceneDetect splits shots so smoothing is not dragged across a cut.
- Undetected frames still go through H3, which keeps the result temporally
  consistent. Only the paste fades out.
- The video (5:25-7:30) swaps in a **person** detector (whole body) and a
  deepfashion (clothing) detector. The crop/track/stitch spine does not care WHAT the
  box is. That is the evidence that the any-region scope works.

## How it lines up with this card

| Brief item | Status after this research |
|---|---|
| 4. "REJECTED: MiniMax H3 ref2va" - no frame-locked v2v path | **The premise is gone.** `H3 Inject Video Latent` is that path, and our own `MpiH3EncodeAV` (MPI-711) does the same. **Fabio decides** whether to reopen; not reopened here. |
| 4. Identity level 2 needs an LTX identity LoRA | H3 ref2v gives level 2 from the character sheet, with no training. This fits the LoRA-free character system. |
| 5. `MpiFaceWindow` (new) | The pack's Track + Crop already does it, plus smoothing, gap fill and cuts. MIT, so it can be studied or ported into MpiNodes. |
| 5. `MpiBoxPaste` (new) | The pack's Stitch Back already does it (batched sub-pixel warp). |
| 3. Colour match BANNED -> detail transfer | **Conflict.** The pack uses per-channel mean/std `colour_match` (default 1.0). Our rule stands: bench with `colour_match 0` + `MpiDetailTransfer`. |
| Open q: multiple faces | Chaining several detailer passes is shown in the video (4:30). |
| Open q: subject crossing frame | Solved by the per-frame smoothed crop (`size_mode per_frame`). |

## MPI-711 caution

MPI-711 measured the H3 masked route: at denoise <=0.4 "the plate wins". For
**recolouring** that is fatal. For **detailing**, keeping the plate is the goal, so
that result does not rule this out. The open question is whether H3 at 0.35-0.45 adds
enough detail. The video says yes on skin texture. Bench it on our own clips before
trusting that.

## Choosing the region - Ultralytics or SAM3, both already shipped

Fabio, 2026-09-25: *"It doesn't need to be a face... It's just using the Ultralytics
detector. We can use SAM3, it's fine. This is just for research so that we find the best
approach."*

- **The detector is just one input.** The pack only needs a box per frame; the video
  swaps face, person and clothing detectors without touching anything else. The app
  already ships both options, so the region choice is a workflow change, not a new
  dependency.
- **Ultralytics** (already shipped, e.g. `face_yolov8n`): plugs into the pack's tracker
  as-is. Its vocabulary is limited to the classes each detector file was trained on.
- **SAM3** (already shipped; its video tracker powers GIF cut-out by name, MPI-771,
  `docs/masking-sam3.md`): text-prompted ("hand", "jacket", anything), so no vocabulary
  limit. The pack's tracker does not accept SAM3 directly, so it needs a small adapter:
  SAM3 mask batch -> per-frame box -> the pack's smoothing -> `transform`.
- Whichever picks the region, keep a feathered rect or ellipse as the default paste (see
  the author's rect-beats-SAM finding). Use the region's own mask as the paste shape only
  if the bench shows it is better.
- Open for the bench: which gives steadier boxes over a clip, the Ultralytics tracker or
  SAM3's video tracker?
- Side note: the pack's optional identity tracking (`identity_model = insightface`) pulls
  in InsightFace `buffalo_l`, whose weights are for non-commercial research only. It is
  off the path when one subject is picked by rule, by hand or by SAM3.

## If picked up after 2.0 - bench first

1. Install the pack on the bench and run its Auto Select template on 2-3 of our H3
   clips with small faces. Is it a GO by eye?
2. Same clip: pack `colour_match 1.0` vs `colour_match 0` + detail transfer.
3. Same clip, three ways to pick the region: Ultralytics face, Ultralytics person/hand,
   SAM3 by text (via the adapter). Compare how steady the box is and the result.
4. Pick the best approach, then build the Flow.

## 2026-10-29 - the SAM3 adapter, read from the pack's code

Second video: The Ai Blueprint, "MiniMax H3 Face Refinement in ComfyUI | Fix Oily Skin & Identity
Drift", 2026-10-14, 9 min - https://www.youtube.com/watch?v=UAdBqy5Y2l4. Same pack (still v1.1.2,
553 stars), used as a refine pass after a normal two-pass H3 render to cut oily skin shine (the
presenter's estimate: 50-70% less). Code read from a clone of the pack's `nodes.py`.

### The seam is `face_pick` - no fork of the tracker needed

`H3 Face Track + Crop` takes an optional `face_pick` (type `H3FACEPICK`). When it is wired the node
**skips its own detector** and reads the boxes from it (`nodes.py:1312-1346`). It is a plain dict:

```
{"version": 1, "frames": B, "src_size": (W, H),
 "boxes": [[[x0,y0,x1,y1], ...] per frame],   # empty list = nothing seen this frame
 "confs": [[c, ...] per frame],
 "segments": [(start, end), ...],             # shots; [(0, B)] for one shot
 "picks": [{"segment": (a, b), "frame": f, "box": i} | {"segment": (a, b), "absent": True}],
 "detector": str, "confidence": float, ...}
```

`frames` and `src_size` must match the images exactly (it raises otherwise). Everything after the
boxes - the centre/size smoothing, gap interpolation, the fade-out on lost frames, the canvas,
Per-Frame Denoise, Stitch Back - only reads boxes and `transform`, never "face". So the whole
any-region change is **one new MpiNodes node**:

1. `SAM3_VideoTrack` (core ComfyUI, `comfy_extras/nodes_sam3.py:260`; GIF cut-out already ships it)
   - prompted by text ("hand", "left foot") or by `initial_mask` from a click on frame 0. It keeps
   one id per object across frames.
2. `SAM3_TrackToMask` with `object_indices` = the one object -> `MASK [B,H,W]`.
3. **New node: mask -> `H3FACEPICK`.** Per frame: bbox of the mask, **squared on its longer side**
   (the tracker sizes the crop as `crop_factor` x box HEIGHT, so a foot or forearm lying flat would
   be under-cropped). Empty mask = empty box list, so the pack's own gap fill and fade-out handle a
   hidden hand. One segment per shot, one pick per segment with `box: 0`.
4. Tracker with `identity_track` **off** (its identity check is insightface, face-only; SAM3
   already holds the object id). The `detector` widget is inert with a pick wired.

### Paste shape - Fabio, 2026-10-29

*"For hands and feet, usually boxes are better than a precise mask. Even for a face, it probably
needs a little bit of growth in the mask."*

- **Hands, feet: a feathered box.** Stitch Back with no `masks` input pastes the detected rect
  (`paste_region`), grown by `mask_dilation` and blurred by `feather` (~24 for a rect).
- **Face: the SAM3 mask, grown.** Wire it to Stitch Back's `masks`, which wants it in CANVAS space,
  so the adapter (or a second small node) crops it with the same `transform` the images got. Grow
  it with `mask_dilation`, feather small (4-8, the author's SAM figure).
- Either way the mask comes from the INPUT footage, never the refined output (finding above).

### This versus Video Edit's still square (the 2026-10-29 Noticed line in brief.md)

Video Edit's masked route uses ONE still square, the union of every frame, and its doc says why:
a moving box drifted, and *"a mask pays only on a small part that stays put"*
(`docs/playbooks/add-flow/existing-flows/video-edit.md` lines 77-87). **Hands and feet are the parts
that travel**, so the union square goes big and loses the resolution the detailer exists for. The
pack's crop moves, but smoothed (centre 21 frames, size 51) and pasted back with a sub-pixel warp,
which is the opposite of the drift Video Edit measured. Bench question: on a moving hand, does the
smoothed moving crop hold without drift, where the still union square loses detail? A part that
stays put (a face in a talking head) can keep Video Edit's still square.

### Port, do not install

The pack's `requirements.txt` pulls `ultralytics`, `insightface` and `scenedetect`. Code imports the
first two lazily, so the SAM3 path never runs them, but installing the pack still installs them, and
insightface's `buffalo_l` weights are non-commercial. MIT lets us port Track + Crop, Inject Video
Latent, Per-Frame Denoise and Stitch Back into MpiNodes with credit - in line with the engine-diet
umbrella (MPI-1344). Keep `scenedetect` optional the way the pack does.

### Other notes from the video

- **The detector missing the face means no refine, silently** (6:56): skin-seg YOLO missed a face
  and the run looked like it did nothing. SAM3 by text is less likely to miss; the bench should still
  check the track preview before judging a result.
- Refine settings shown: 8 steps, euler, simple (beta and er_sde also suggested), Per-Frame Denoise
  `denoise_multiplier_small_face` 1.00 / `large_face` 0.35, `face_px_small` 30 / `large` 120,
  `smooth_frames` 9; canvas 768x768 manual, crop_factor 2.5. Refine prompt carries a
  "retention_analysis" line (identity kept, only shine removed). A hand pass needs its own prompt
  naming the part.
- LoRA stack on his render: turbo + `fal/MiniMax-H3-Realism-People-LoRA` (r34l1sm, 1.0) +
  prithivMLmods Facial-Realism + Alissonerdx `minimax_h3_lms_v1.0_r64` (sharpen, 0.55). fal was
  already REJECTED in MPI-1135 Phase 1d as a first-frame-replacing render LoRA; untested as a
  low-denoise crop refiner. ICY Realism H3 (Civitai) offered as an alternative.
- One object = one full H3 pass at the canvas size; two hands far apart = two chained runs (feed run
  1's stitched output as run 2's base), or one box when they are close.

### Bench order, revised

1. Port nothing yet: install the pack on the bench, plus a throwaway mask -> `H3FACEPICK` node.
2. One clip with a moving hand: SAM3 "hand" -> moving smoothed crop, feathered box paste,
   against Video Edit's still union square on the same clip. Watch for flicker, drift, seams.
3. A talking head: face via SAM3 with a grown mask vs the box paste.
4. GO -> port into MpiNodes, then the Flow on the Video Edit route with the moving crop as its
   region step.
