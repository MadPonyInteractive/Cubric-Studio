# MPI-711 — plan

Opened 2026-09-09. `brief.md` is the record of WHY this card exists and what is settled;
this file is the running plan. Read the brief first — it carries the numbers.

**Verify mode:** user-ux

Verification on this card is the user's eyes on a benched clip, plus sourced numbers with
their URLs. There is no test to run.

## Current State

**2026-09-13 — READ THIS FIRST. Phase 3 ran; long clips now go through core context windows.**
Older notes below are history; two of them are stale: the card IS in `doing`, and MpiNodes is
pushed with the pin at 1.2.12 (`dbc6a74c`) — "20a8d4d NOT pushed" is closed.

- **Works (user):** rv2v character swap from ONE reference image, keeping the source motion.
- **A reference VIDEO is not a motion source.** `source_video` + `reference_video` = **ads2v,
  content insertion** — ByteDance `assets/testcases/rv2v/rv2v_case2.json`: *"Add the video on
  the computer."* No Bernini task copies motion from a second clip; `mv2v` is a TEXT-described
  motion edit on the source (`v2v/v2v_case2.json`, the crouch). Motion transfer stays in the
  user's Wan Animate workflow; Bernini keeps "edit video with images". **Open decision:** drop
  the `Input_Video_2` slot from the flow, or relabel it as screen/billboard insertion.
- "Person from image dances like the clip" = put the dance clip in as SOURCE + the person as a
  reference image. That is plain rv2v.
- **Multi-reference rv2v (character = image0, environment = image1) is UNTESTED.** Documented
  only for r2v (`r2v/r2v.json` uses image4 as the scene); the only rv2v case is one ref. With a
  source present the image0 index base is unverified upstream. The user's bench now holds the
  dance clip + `Sofia Rossi .../photo_00004_.png` + `benches.jpg`, with a pasteable prompt in
  `Input_Positive`.
- **OOM 14:32, root-caused exactly.** Dance clip 15 s at force_rate 16 -> 237 frames -> 60
  latent x 1,560 tokens x2 (target + source context) + refs 2,120 + 1,590 = 190,910 tokens;
  FFN activation 190,910 x 13,824 x 2 B = 4.92 GiB, the log's own "Requested". The 2nd image is
  0.8%. Batching refs into one slot saves NOTHING (core makes a stream per batch image) and
  forces one resolution.
- **Fix wired, UNTESTED — `flow_bernini_video_edit_ctxwin.json`** (the original file untouched,
  new workflow id). `WanContextWindowsManual` "Context windows (high noise)"#1169 between
  `Get_high_model#1110` -> `ModelSamplingSD3#738`, and "(low noise)"#1170 between
  `Get_low_model#1111` -> `#730`: 81 / 30 / standard_uniform / pyramid / freenoise on.
  `Snap#1070` uncapped. Why it should work: `comfy/model_base.py`
  `WAN21.resize_cond_for_context_window` ("In-context cond slicing (Bernini)") slices every
  `context_latents` stream whose temporal length equals the target's, and passes 1-frame refs
  whole; the causal anchor applies to the cond slice too. ~69k tokens per window. Caveats: node
  is `is_experimental`; only 6 lightx2v steps to fuse overlaps; ~4 windows = ~4x per step; a
  `reference_video` of a different length would NOT be sliced.
- **Next action:** the user runs the ctxwin copy on the 15 s dance clip + both refs. Confirm
  `Context window 1/N` lines in `G:/ComfyUi/ComfyUI/user/comfyui.log`, then judge fit, seams in
  the overlap zones, and whether image0/image1 took the right roles.
- **Custom Mpi chunk/stitch nodes only if windows seam badly.** The Wan Animate loop
  (`D:/WORK/workflows/New Systems/Wan Animate Local.json`: `easy forLoopStart/End`, loops =
  `max(ceil(total/(block-overlap))-1,0)`) works because `WanAnimateToVideo` itself takes
  `continue_motion` + `video_frame_offset` and emits `trim_image`/`trim_latent`. Bernini has
  neither, so a chunk loop renders each chunk blind to the last.
- **Still pre-export:** split `Input_Mask_Video#1003` (now `""`, so inert), `#1148`
  `block_if_empty`, `#1086` `force_rate`. Noticed, not actioned: MpiNodes `bernini.py`
  `MpiBerniniConditioning.doit` returns 4 values against 3 `RETURN_TYPES`.

**UN-PARKED 2026-09-09/10 — the thesis is PROVEN and Bernini-R is the answer.** The card was
parked on 2026-09-09 (square mask on the H3/LanPaint route did not rescue it, `brief.md`
§ Square mask) and the board still says `todo`/`planned`, which is now WRONG: real work ran
on it on 09-09 and 09-10. **The board needs moving to `doing` — a handoff may not do it.**

What happened, in order:

1. **Bernini-R works.** The user ran ComfyUI's shipped template and got a clean localised
   edit — hair recoloured AND the background replaced, face/outfit/pose intact. H3 never
   moved hue off ~14 at any denoise; this did it in one pass. The "masking is a workaround
   imposed on a model with no native localised-edit task" framing in `brief.md` is
   vindicated.
2. **Masked beats unmasked.** The user's own finding: a full-frame edit degrades the image,
   a masked one holds. So masking still belongs on top — but as crop-and-composite
   (`InpaintCropImproved`/`InpaintStitchImproved`), NOT as H3's known-pixel conditioning.
   That answers Phase 4's first question ahead of time.
3. The user built their own bench graph, `flow_bernini_video_edit.json` (163 nodes), and it
   is reviewed and structurally clean as of 09-10 07:50.
4. **`MpiBerniniConditioning` was built** in the sibling node pack — committed as `20a8d4d`,
   **NOT pushed, and `dev_configs/node_lock.json` NOT bumped.** Both wait on the user.

The square-mask failure recorded in `brief.md` is H3-specific and does **not** transfer:
LanPaint hard-thresholds its mask and conditions on known pixels, so a square removes the
pixels it needs. Bernini has no mask input at all and conditions on in-context latents.

**2026-09-10 12:15 — the bench graph now takes a mask CLIP** (see `## Completed`). The SAM3
mask group is intact and simply unconsumed; flipping back is one link drag.

**2026-09-11 — reviewed again after the user's own edits (139 nodes, mtime 20:02).**
Structurally CLEAN: 0 dangling refs, 0 endpoint mismatches, 0 cycles. The user has SAM3
re-attached to `GrowMaskWithBlur#1145` for bench testing and `ImageToMask#1150` dead-ended,
deliberately — he mutes the bench nodes and swaps the loader back before export.

**Rate/count parity SURVIVED his rewire and is now cleaner than what was wired on 09-10:**
both loaders read `Get_fps` (`#1161` source, `#1162` mask) off `Input_Fps#1160`, and both
trims read `Get_frames` off `Snap length to 4n+1#1070` (`#1071` source, `#1149` mask). The
mask cannot disagree with the source on rate or frame count, which is what `InpaintStitch`
refuses.

**DEFECT found, must be fixed before export — one string is doing two jobs.**
`Input_Mask_Video#1003` is an `MpiString` (`'person'`) feeding `MpiAnyChecker#1002`, whose
three consumers are `MpiBlockIfEmptyList#1014 -> CLIPTextEncode "SAM3 vocabulary"#980`,
`MpiLoadVideo#1148.string` (the clip PATH) and `Set_has_mask#1004`. A segmentation
vocabulary and a file path cannot be the same value. Split into two titles
(`Input_Mask_Video` for the clip, a separate one for the bench vocabulary) and decide which
gates `has_mask`. Inert today only because `#1150` is dead-ended and `block_if_empty` is off.

Smaller, also pre-export: `CLIPTextEncode#980`'s widget reads `'hair'` while its `text` is
WIRED, so the live vocabulary is `'person'` and the widget is a lie; `MpiLoadVideo#1148`
`block_if_empty` is `False`, so an empty path yields a blank 1x1 that reaches the crop
instead of blocking; `Input_Video_2#1086` (reference video) has `force_rate` unwired while
the other two loaders read `Get_fps`.

Dead, pre-existing, NOT touched: `SetLatentNoiseMask#1116`'s output goes nowhere (orphaned
on 09-10 too — looks like an H3-route leftover).

**DECIDED 2026-09-11 — grow + fill_holes move UPSTREAM, into the mask-producing workflow.**
The mask the app sends is the mask the user APPROVED in the adjust step; growing it 6px and
filling holes afterwards means what ships is not what they approved and the preview lied.
So the clip goes `ImageToMask` -> straight into `InpaintCropImproved#1028.mask` and
`MpiMaskSquareBbox#1026.mask`, and `GrowMaskWithBlur#1145` stays as a bench-only unit test.
Nothing is lost: `InpaintCropImproved` has its own `mask_fill_holes`, `mask_expand_pixels`,
`mask_blend_pixels` and `mask_hipass_filter` inputs. This matches MPI-715's plan (fill-holes
always-on upstream, never a toggle in the consumer graph).

Next action: the user tests reference VIDEO (`Input_Video_2#1086`) and MULTIPLE reference
IMAGES (`Input_Image#1087` .. `Input_Image_4#1090`) — Phase 3, the first real use of
`MpiBerniniConditioning`'s ref slots. Prompt convention for multiple refs is `image0`,
`image1`, ... zero-indexed (ByteDance `assets/testcases/r2v/r2v.json`); with a source video
present the index base is UNVERIFIED upstream, so with ONE ref use their rv2v phrasing,
"the reference image".

The H3 + LanPaint masked route is closed on measurement (brief.md § The wall). The card is
now evaluating models with a **native localised-edit task**.

Phase 1 is done — `research/licence-and-weights.md`. It **inverts the order below**:
Capybara's MIT tag covers Glanty's project, not the weights. Its 16.7 GB transformer is
"built upon" HunyuanVideo-1.5, whose Tencent Hunyuan Community License reads
"THIS LICENSE AGREEMENT DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH
KOREA" — the H3 restriction again. Bernini-R is Apache 2.0 at ByteDance and at the Comfy-Org
repack, no territory clause, no MAU cap.

Capybara is **dropped** (user, 2026-09-09): 200 stars, ComfyUI support last touched ~7
months ago, and the Tencent territory clause on top. Not being benched at all for now.

Bench setup is done — `research/bernini-bench-setup.md`. ComfyUI v0.34.2 on the bench has
`comfy_extras/nodes_bernini.py` in core; the 1.3B is downloaded and verified; the text
encoder, the lightx2v LoRA and the correct Wan 2.1 VAE were all already on disk.

Weights are down and verified: the **14B fp8 pair** (15,574,833,216 B each). The 1.3B was
pulled then deleted — the user runs Wan 2.2 A14B comfortably on the 4060 Ti because the MoE
loads one expert at a time, so the 14B is the real candidate and the 1.3B is not worth a run.

Next action: run the hair case as **v2v** on the 14B, in the user's own copy of ComfyUI's
shipped `video_bernini_r_video_editing` template, with `task_type` set to
**Video Editing (Style / Motion)** rather than the default Content Propagation.
Two things that run counter to the H3 experience: there is **no mask input on the node at
all**, and the risk therefore inverts — H3 failed by the plate winning, this can fail by the
whole frame moving.

## Phase 1 — Source the two candidates (no downloads)

**Verify:** a table with licence / weight files / total size / VRAM for both models, every
row citing its URL, and every figure the source does not state marked `unknown` rather
than estimated.

1. Capybara (Glanty, HunyuanVideo-1.5 base) — <https://huggingface.co/Glanty/Capybara>.
   Licence is recorded as MIT in the brief; confirm on the repo itself, not a mirror.
   Enumerate the weight files and their sizes. Establish the VRAM floor at the recommended
   480p / 50 steps, and whether FP8 is required (brief notes CUDA 12.6, compute >= 8.9).
2. Bernini-R (ByteDance, Wan 2.2 renderer-only) —
   <https://docs.comfy.org/tutorials/video/bytedance/bernini-r>. **Licence is the hole**:
   the tutorial does not state one. Chase the model repo itself. A territory-restricted or
   non-commercial licence is disqualifying at product level, so this is the gate.
3. Report to the user before any weight is pulled.

## Phase 2 — Bench Capybara on the hair case

**Verify:** the user's eyes on the clip, plus hue measured inside the mask against the
brief's table. Pink is hue ~150; every H3 run landed 10.1-19.2.

Same clip, same ~1s window, instruction "make her hair pink". Judge on the numbers in
`brief.md`, not by eye alone. The ~1s window is the design point — do not raise it.

## Phase 3 — Bench Bernini-R rv2v

**Verify:** the user's eyes on a reference-guided character replacement.

The original goal, not the narrowed hair case: change this character using this image.

## Phase 4 — Decide

Only if one wins: whether masking is still wanted on top, and whether the
`MpiH3EncodeAV` / `MpiH3DecodeAV` pair carries over or is H3-specific.

## Remaining Work

- [x] Phase 1 — licence + weights + VRAM for both, sourced (`research/licence-and-weights.md`)
- [ ] Phase 2 — Capybara on the hair case
- [ ] Phase 3 — Bernini-R rv2v on character replacement
- [ ] Phase 4 — decision
- [ ] Separate card for VOID as an object-removal Flow (removal-only; NOT this card)
- [ ] At the very end: one MpiNodes release + one `dev_configs/node_lock.json` pin bump
      (commits through `287edb8` / v1.2.11 are local and unpushed by standing instruction)

## Completed

- 2026-09-10 **Mask clip input wired into the bench graph** (backup
  `flow_bernini_video_edit.bak-20260910-121510.json`). Added `Input_Mask_Video#1148`
  (`MpiLoadVideo`) -> `Trim mask to 4n+1#1149` (`ImageFromBatch`) -> `Mask clip to
  MASK#1150` (`ImageToMask`, channel red) -> `GrowMaskWithBlur#1145.mask`, in a group of
  its own. `#1145` was the ONLY cut point: everything after it (preview, `MpiMaskSquareBbox`,
  both `InpaintCropImproved`, `Set_mask`, `SetLatentNoiseMask`) is untouched.
  **The trim and the force_rate are shared with the source path** — length from
  `Snap length to 4n+1#1070`, force_rate from `MpiConvert#1067` — so the mask cannot
  disagree with `Get_input_video` on frame count, which is what `InpaintStitch` refuses.
  `SAM3_Detect#979` and the whole `Mask` group are LEFT IN PLACE, just unconsumed, so the
  user flips back with one link drag. Structural check: 0 dangling refs, 0 endpoint
  mismatches, 0 cycles, 137 nodes.
- 2026-09-09 Phase 1. Licence, weights, sizes and GPU floor sourced for both candidates,
  every figure carrying its URL — `research/licence-and-weights.md`. Nothing downloaded.
- 2026-09-09 Bench setup. Bernini-R 1.3B downloaded to `C:/AI/diffusion_models/` and
  verified on disk (2,838,276,200 B). Bench ComfyUI v0.34.2 already carries the native
  `BerniniConditioning` node. Node contract, task-inference table and the no-mask finding
  written up in `research/bernini-bench-setup.md`.

## Plan Drift

- 2026-09-09: plan.md created. The card ran on `brief.md` alone from its creation on
  2026-09-08 until now, which left `mpi-handoff` with no running notes to read.
- 2026-09-10: **Phase 2 is dead and Phase 3 is what remains.** Capybara was dropped, so
  "bench Capybara on the hair case" will not happen; Bernini-R already passed the hair case
  as v2v, which was Phase 2's actual purpose. What is left of the plan is Phase 3 (rv2v with
  references) and Phase 4 (decide), plus the two carried items — a VOID card, and the
  MpiNodes release + pin bump.
- 2026-09-10: a **dependency cycle** was found and fixed in the bench graph. The trim that
  sizes the plate had been wired to `MpiBerniniConditioning`'s `length` OUTPUT, but the trim
  feeds SAM3 → crop → packer → back into that same node's `source_video`. ComfyUI would have
  refused the graph. Repointed to `Snap length to 4n+1#1070`, which derives the same number
  from `frame_count` alone and sits upstream of everything. **General rule the node's
  docstring does not say: the `length` output may only feed things DOWNSTREAM of
  `source_video`.**
- 2026-09-09: **Phase order swapped, Bernini-R before Capybara.** The brief's licence row
  for Capybara ("MIT") is true of the project and not of the weights. Licence-first, as the
  handoff demanded, puts the Apache-2.0 model first. `brief.md` § The new direction has the
  Capybara licence cell wrong and should be corrected at close-out — leaving it as written
  is how this trap gets re-walked in three weeks.
