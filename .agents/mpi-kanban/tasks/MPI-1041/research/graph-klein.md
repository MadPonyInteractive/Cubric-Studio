# MPI-1041 A2 - Klein 9B edit graph `flow_character_sheet_edit`

One change on a finished 3-panel sheet (front body | back body | 3/4 portrait) by words. Klein 9B, no NSFW LoRA. Output size = input size.
Source `comfy_workflows/raw/flow_character_sheet_edit.json` (LiteGraph, 61 nodes) is written by `research/bench-tools/build_edit_graph.py`;
the runtime file `comfy_workflows/flow_character_sheet_edit.json` (60 nodes) is its single-file convert against the app engine (48188).
Not registered as an op yet (Phase B). Not opened in the ComfyUI editor - verified by convert + `verify-workflow` + real bench runs.

## Node map (titles the app touches in bold; ids = runtime file)

| part | nodes |
|---|---|
| inputs | **Input_Image** `MpiLoadImage` (2, w/h out), **Input_Positive** `MpiText` `string` (3, the WHOLE prompt), **Input_Seed** `MpiInt` (4), **Input_Lock** `MpiInt` `int` (5) |
| size math (`MpiMath`) | 6 `a*b/1048576` (w,h -> megapixels) / 7 `a // 4` front width + back x / 8 `a // 2` portrait x / 9 `a // 2 - a // 4` back width / 10 `a - a // 2` portrait width |
| lock switches | 11 `MpiCompare` Input_Lock `>` 0 "locked?" / 12 `==` 1 "all three panels?" |
| SAM3 lock mask | 13 SAM3 Model, 14/15 vocabularies "head, hair, face" (lock 1) / "face" (lock 2) -> 16 `MpiIfElse` (by 12) -> 17 CLIPTextEncode; 18/20/22 `ImageCrop` front / back / portrait -> 19/21/23 `SAM3_Detect` 0.5 / 2 / union; 24 empty `SolidMask` -> 25 `MpiIfElse` back = SAM3 at lock 1, empty at lock 2; 26 canvas `SolidMask` w x h -> 27/28/29 `MaskComposite add` at x 0 / W//4 / W//2 -> 30 `MpiMaskFillHoles` -> 31 `GrowMask` 6 tapered -> 32 `InvertMask` (white = may change) -> 33 `MpiMaskSquareBbox` 64 |
| Klein edit | 34 UNET `flux-2-klein-9b-int8-convrot`, 35 CLIP `qwen_3_8b_int8_convrot` (flux2), 36 VAE; 44 text -> 45 ZeroOut, 46 ReferenceLatent; 42 VAEEncode of 41; 50 CFGGuider cfg 1, 51 Flux2Scheduler 4 steps, 52 `SamplerCustomAdvanced` lcm (free) / 53 `SetLatentNoiseMask` + 54 `LanPaint_KSampler` euler_ancestral (locked) via 55 `MpiIfElse` |
| exact size + result | 39 `InpaintCropImproved` (target = loader w/h) -> 40 `MpiIfElse` picture (crop when locked) -> 41 `ImageScaleToTotalPixels` (megapixels <- 6); 56 decode -> 57 `InpaintStitchImproved` (locked) / 58 `ImageScale` lanczos to loader w/h (free) -> 59 `MpiIfElse` -> 60 `MpiClearVram` -> 61 **Output_Image** `PreviewImage` |

Pruned from the template's edit path: style / LoRA chain, enhance, depth, upscale, Input_Image_2/3, Input_Mask loader, NSFW LoRA. All 23 shared
nodes carry the template's widget values (diffed value by value: only the two intended links differ - megapixels and the crop target).

## Why it is built this way

- **Exact size:** `megapixels = w*h/2^20` (batch 6) returns 1792x1120; `resolution_steps` 16 rounds any other size, so the free path ends on a
  lanczos resize to the loader's w/h (identity on a multiple of 16) and the masked path crops to w x h and stitches onto the original.
  A4's 1824x1152 (megapixels 2) does not occur: all 16 outputs equal their input size.
- **Lock = batch 4's mask, built in-graph.** Same SAM3 settings, per-panel crops 1/4 | 1/4 | 1/2 of the width, composite, fill holes, grow 6, invert.
  Lock 2 skips the back panel (batch 8: SAM3 "face" on a back view marks the back of the head).
- **Lazy:** every branch sits behind `MpiIfElse`. **Trap found on the first bench run: `MpiClearVram` is `OUTPUT_NODE = True`** - ComfyUI runs it on every
  prompt, so a "free SAM3" splice on the lock branch dragged SAM3 front + portrait in at Input_Lock 0 (36 s proof run). Removed; the only
  always-run nodes now are the loader, the end clear and the preview (checked with `output_node` in /object_info). ComfyUI evicts SAM3 itself when
  Klein loads (not tried on a 12 GB card).
- Input_Lock values: 0 free edit (Condition, Age - they change the face) | 1 "head, hair, face" x3 (Clothes, Accessories) | 2 "face" x2 (Hairstyle).

## Does the lock match batch 4, and does lock 1 hold the portrait face? (mask-only runs, 3-10 s each)

- **Identical to batch 4's mask PNG** with "head, hair": nude sheet, lock 1, 0.000% of pixels differ (462243 locked px each). (Numbers only - no edit ran on that sheet.)
- **A4's gap, confirmed:** with "head, hair" SAM3 marks the photo portrait's HAIR only (inner face locked **5%**); the clothes runs then drifted the portrait face 3.9-5.3 / 255
  (= batch 3's free 4.5-7.8). Fisher was already 100% / 100%. Lock 2 ("face"): photo portrait 99% / front 95%; fisher 59% / 47% (skin only, beard / hat / brows editable).
- **Vocabulary A/B, lock 1** (`run_graph_klein.sh vocab`, 6 mask-only runs, 11:47-11:48; overlays `lock_overlay_{photo,fisher}_vocab_added.jpg`, green = "head, hair", magenta = added by "face"):

| sheet | portrait inner face locked | hair still locked front / back / portrait | pixels added outside the old lock's box +16 | sheet locked |
|---|---|---|---|---|
| photo | 5% -> **100%** | 100 / 100 / 100% | 0 (adds the face skin, +153690 px; neck and jacket stay open) | 13.8% -> 21.5% |
| fisher | 100% -> 100% | 100 / 100 / 100% | 0 (+15 / +39 / +127 px) | 28.8% -> 28.8% |
| nude (numbers only) | n/a | 100 / 100 / 100% | 0 (+185 / 0 / +2248 px) | 23.0% -> 23.2% |

  **Adopted** (rule: both portrait faces >= 95%, hair stays locked on all three panels, no body or clothes pulled in): the lock-1 vocabulary is now "head, hair, face".
  Re-run of the three photo clothes cases: portrait inner-face drift 0.0 (was 3.9-5.3), front face 0.0.

## Lazy proof (WebSocket `executing` events, cafe sheet, seed 43; a run counts only if its image comes back)

| Input_Lock | SAM3_Detect front / back / portrait | crop + bbox | free sampler | LanPaint + stitch | guard resize |
|---|---|---|---|---|---|
| 0 | skipped / skipped / skipped | skipped | RAN | skipped | RAN |
| 1 | RAN / RAN / RAN | RAN | skipped | RAN | skipped |
| 2 | RAN / skipped / RAN | RAN | skipped | RAN | skipped |

(The first attempt loaded a copied sheet by absolute path: 1-2 s runs, every node still fired `executing`, no image came back - the loader most likely blocked. A node list alone is not a proof.)

## Results (bench :8188, seed 42, clothed sheets, G:/ComfyUi/ComfyUI/output/mpi1041_age/graph_klein/`<case>`.png; layout = front / back / portrait shift in px)

| case | sheet | s | layout | size | verdict (by eye, vs its batch) |
|---|---|---|---|---|---|
| clo_tee, lock 1 | photo / fisher | 70 / 79 | 0/0/0 / 0/0/-2 | 1792x1120 | PASS (b4): outfit on all 3 panels, back included; hair, hat, beard held; photo face now pinned (drift 0.0) |
| clo_biker, lock 1 | photo / fisher | 72 / 79 | 0/0/0 / 0/0/-1 | same | PASS: jacket + dress + boots on all 3; no head tilt (b3's residual gone) |
| clo_armour, lock 1 | photo / fisher | 79 / 79 | 0/0/0 / 0/0/-1 | same | PASS: armour + cloak hood down on the back; layout held (silhouette -22 px = the cloak) |
| hair_bob, lock 2 | photo / fisher | 73 / 76 | -3/-4/+70 / -2/-130/+176 | same | PASS (b8): blonde bob on front, BACK and portrait, face kept (photo portrait diff 1.5). The deltas are the new hair outline: torso centres within 3 px |
| cond_beaten, lock 0 | photo / fisher | 33 / 33 | -1/0/0 / -1/0/-4 | same | PASS (b5): bruised, cut face and torn dirty clothes front AND back |
| age10, lock 0 | photo / fisher | 33 / 33 | -1/0/0 / -2/-1/-5 | same | PASS (b15): same child on 3 panels, red curls kept / boy, hat, jacket; photo reads ~15, b15 ~13 |
| age30, lock 0 | photo / fisher | 34 / 37 | -1/0/0 / -1/-1/-5 | same | PASS (b15): younger adult, hair kept / clean-shaven, dark hair |
| mp1_age10 (A/B, megapixels 1) | photo / fisher | 15 / 19 | -2/0/+1 / -2/0/-4 | same | PASS, a touch younger than exact size; the guard upscales it to the sheet size |

`layout.py` bar (heads within 16 px): met on 14 of 16 files; the 2 misses are the hair_bob files (new hair outline, bodies held - see above). All 16 outputs = input size.
The three photo clothes rows are the re-run with the adopted vocabulary (`clophoto`, `GPU 0 leased` 11:48:48 - 11:52:31); the fisher rows and every other row ran with "head, hair"
(the fisher lock-1 mask changes by 15-127 px only, so the fisher clothes cases were not re-run). Full run: `GPU 0 leased` 11:25:05 - 11:43:01.

## Rebuild

```
python .agents/mpi-kanban/tasks/MPI-1041/research/bench-tools/build_edit_graph.py build          # raw/ (LF, trailing newline)
COMFY_URL=http://127.0.0.1:48188 node scripts/workflow-to-api.mjs comfy_workflows/raw/flow_character_sheet_edit.json > tmp   # then cp over the runtime file
node scripts/verify-workflow.mjs comfy_workflows/flow_character_sheet_edit.json
COMFY_URL=http://127.0.0.1:48188 node scripts/validate-injection-rules.mjs comfy_workflows/flow_character_sheet_edit.json
```
Rebuild + re-convert reproduce both files byte for byte. Bench: `run_graph_klein.sh` under `gpu_lease.py run` (masks, lazy proof, 16 cases, size, layout, pairs);
slices by one argument after the file: `vocab` (lock-1 vocabulary A/B, mask-only), `clophoto` (the three lock-1 clothes cases on the photo sheet).

## For Phase B

- Inject `Input_Positive` -> `string`, `Input_Seed` / `Input_Lock` -> `int`, `Input_Image` -> `string` (all as the shipped Klein graph does). Weight is baked `flux-2-klein-9b-int8-convrot`
  under the title "Load Diffusion Model"; the arch variant swap (variant-injection.md) applies as for `klein_9b_t2i`.
- Age at exact size ran 33 s vs 15 s at 1 MP; both pass. Cases above used the sheet size 1792x1120 only - another size is untested (the guard resize covers non-multiples of 16 by design).
