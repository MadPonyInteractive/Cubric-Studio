# MPI-1133: face identity for MiniMax H3 Reference to Video (ref2v_ms), research pass 1 (2026-10-13)

Research only. Nothing ships until Fabio picks. "UNVERIFIED" = read from a secondary source or a sub-agent and not
confirmed by hand. Licences marked "read by hand" were opened and read in this session.

## 1. The evidence: Fabio's ref2v_001 (Qwen 2.1 project)

minimax-h3-ref2va, ref2v_ms, 1344x768 (medium), 20 s, turbo ON, seed 4097243197. `<Picture 1>` =
`flowCharacterSheet_031` (woman), `<Picture 2>` = `flowCSFI_007` (man). Frames at 2 / 5.5 / 9 / 12 / 15 / 18.5 s
extracted and compared with the sheets (`C:/AI/MPI-1133-out/frames/`, local only).

What carries: hair (silver Dutch braids, swept dark hair), beard line, eye colour (her green, his brown), costume,
backpack, body type.

What drifts:
- **Woman, close-up at 9 s (worst):** face longer and narrower than the sheet's soft, round, young face; brows much
  darker and heavier (sheet: thin, light); cheeks hollower, jaw more angular; reads older and harder; heavier eye
  make-up. Freckles gone. Her profile at 5.5 s is closer to the sheet.
- **Man, close-up at 12 s (mild):** same person at a glance; face a bit broader and rounder, brows straighter and
  softer, eyes smaller. He holds far better than she does.

## 2. Why this happens on our graph (read in code, not guessed)

- **Identity is decided in stage 1, and stage 1 sees the sheets small.** Both H3 runtimes render stage 1 at half
  the canvas (`floor(a/64)*32`, nodes 620/621), so 1344x768 samples stage 1 at 672x384. Stage-1 references are
  `ref_image_size: match` (`Input_Refs`, node 330), which scales each picture down to the stage-1 pixel area
  (`comfy_extras/nodes_minimax_h3.py` ~line 301). A 1792x1120 sheet becomes ~640x416: **the woman's close-up face
  is ~140 px wide, the man's ~120 px**, i.e. 7-9 latent cells. The refine encoder (`Refine_Refs`, node 688) reads
  them at `max` (full 1792x1120), but the refine is 3 steps and, per `windowing.md`, "motion, identity and framing
  were all decided upstream". `ref2va.md` already records `max` as "a colour and identity win" on the refine.
- **The woman's sheet has only ONE face.** `flowCharacterSheet_031` is the headless version (front body face
  blanked to grey by the `flowCharacterSheetHeadless` leg, `Input_Remove_Head` default ON, MPI-997/1087). That is
  a deliberate design ("the whole reason this layout works as a video reference"), not a bug. The same run's
  `flowCSE_028` keeps the front face. The man's `flowCSFI_007` keeps both faces. Not proven to be the cause, but
  it is the one input difference between the character that holds and the one that drifts. Bench arm A1.
- **Turbo was on.** `turbo.md` notes a short-schedule distill re-decides identity less; unmeasured for faces. Arm A4.
- Same pattern as MPI-1096 on LTX: identity holds when the face is BIG in the reference and drifts when it is small.

## 3. Ranked shortlist

| # | Option | Licence (commercial) | 16 GB card | ComfyUI | Composes with ref2va multi-ref |
|---|---|---|---|---|---|
| 1 | Reference-layout levers (no new weights) | nothing new | yes (`max` costs time, not VRAM) | already in our graph | it IS ref2va |
| 2 | UntMods H3 FaceSwap LoRA, as a re-render pass | Apache-2.0 (read by hand) + the MiniMax H3 CLA we already hold | yes, same graph; video ref is slow | native nodes + a LoRA slot | yes, it is a ref2va LoRA |
| 3 | Per-character identity LoRA trained from the sheet (musubi-tuner) | trainer Apache-2.0; the LoRA is the user's | training UNVERIFIED on 16 GB | our user LoRA slots | yes, drops into `Input_Lora_1..6` |
| 4 | Frame-level face swap after H3 (FaceFusion / ReActor / DreamID-V) | inswapper needs a PAID InsightFace licence; DreamID-V Apache-2.0 | yes | yes (third-party) | post pass, independent |
| 5 | Alissonerdx H3 Character Swap / Head Swap LoRAs | Character Swap: custom licence, commercial OK, no SaaS; Head Swap: NO terms | yes | needs `MiniMaxH3AddGuide` (graph change) | ref2va, but guide path |
| 6 | BFSNodes "MiniMax-H3 Identity Reference + RoPE" | node GPL-3.0; no checkpoint exists | n/a | upstream only | needs a LoRA trained for it |

### 1. Reference-layout levers (rank 1: free, no licence, testable today)
- **A face close-up as its own reference** (`<Picture 3>` = her face, `<Picture 4>` = his face), named in the prompt
  ("<Picture 3> is the face of the woman in <Picture 1>"). A ~512 px square crop passes stage-1 `match` almost
  untouched (512x512 is ~1.6% over the 672x384 area, so it shrinks ~1%), so stage 1 sees the face at roughly
  2.5-3.5x the linear size it gets today, depending on how tight the crop is.
  Community guides say the same (RunDiffusion, Runware: one clean head-and-shoulders identity image, label each
  reference by number; UNVERIFIED, secondary). Up to 9 images are allowed; references ride every step, so each one
  costs time.
- **`max` on the stage-1 encoder** (sheet read at full size in stage 1). Measured before: ~1.7x wall clock with a
  sheet + video (`ref2va.md` § `max` vs `match`); "max usually gave the better result". Cost, not VRAM.
- **Sheet with the front face kept** (`flowCSE_028` instead of the headless `flowCharacterSheet_031`).
- **Turbo off** for identity-critical shots.
- **Describe the face in words** (thin light brows, round soft face, freckles): the prompt today names hair and
  clothes only, which is exactly what carried.
- **One character per reference** is already the case in ref2v_001 (two separate sheets), so that lever is spent.

### 2. UntMods FaceSwap LoRA (rank 2: best weight-based option)
https://huggingface.co/UntMods/FaceSwap_MiniMaxH3_REF2VA. `license: apache-2.0` in the card and README (read by
hand); training data not stated. 65.6 MB LoRA for the **ref2va** DiT, trigger word `Faceswap`, strength 1. Its
shared workflow (read) feeds the clip to fix through the NATIVE reference-video slot and the face image(s) through
image slots, with our same turbo LoRA; note in the graph: "Works with single or multiple Refs Images". So on our
graph it needs NO graph change: the drifted card as `<Video 1>`, face crops as pictures, the LoRA in a user slot.
**Already on this machine:** `G:/CubricModels/loras/SS_FaceSwap_MiniMax_H3_REF2VA.safetensors` (Fabio's download).
Open questions: two people in one pass (UNVERIFIED); whether lips stay in sync (it re-renders; ref2va keeps a
sounded reference video's soundtrack, MPI-1033, but the mouth is regenerated); cost: a video reference is the
expensive input (~44-52 s/step measured with a 2-3 s video ref, `ref2va.md`), so a 20 s clip needs splitting.

### 3. Per-character identity LoRA (rank 3: strongest for a recurring character, biggest build)
- **musubi-tuner** (kohya-ss, Apache-2.0), `docs/minimax_h3.md` (read): H3 FL2VA and Ref2VA, pruned int8 bases,
  `--blocks_to_swap` up to 48 of 50, text encoder block swap, `triton-windows` on Windows. Its recipe table has a
  row for exactly our case: **"Image: character identity, text-only at inference"**, teacher matching with
  `subject_ref` (the teacher sees other pictures of the subject, the student learns it), trained from images, so a
  character sheet set can be the dataset. Our ref2va graph has six user LoRA slots, so the result drops in.
- **ostris ai-toolkit** (Apache-2.0): H3 LoRA training since 2026-08 (UNVERIFIED VRAM floor).
- **alisson-anjos ai-toolkit fork** `minimax-h3-latent-guides`: identity-reference role + RL with ArcFace rewards;
  RL measured ~30 GB on a 5090 (UNVERIFIED, sub-agent read). Research-grade.
- No published VRAM floor for H3 LoRA training anywhere. On a 16 GB card it is plausible only with the pruned int8
  base + heavy block swap and lots of host RAM (UNVERIFIED); otherwise a RunPod job (costs money: ask first).
- Watch-out from `README.md` § LoRAs: a Diffusers-format H3 LoRA loads with no error and does nothing; only
  `diffusion_model.*` / `lora_unet_*` keys map. Check any trainer's output keys.

### 4. Frame-level face swap after H3 (rank 4: only route that keeps the lips EXACTLY)
Swaps pixels, does not regenerate motion, so lip sync survives. Multi-face assignment exists in both tools.
- **FaceFusion**: code OpenRAIL-AS (read by hand). Its usual swapper `inswapper_128` and the `buffalo_l`
  detector/embedder are InsightFace models: non-commercial unless licensed from InsightFace (sub-agent read the
  InsightFace site: commercial licence on request, price undisclosed). Other models (hyperswap, ghost, uniface):
  licences UNVERIFIED. **ReActor**: same InsightFace weights. Known temporal flicker.
- **DreamID-V** (ByteDance): code Apache-2.0 (repo licence), weights Apache-2.0 (HF card read), Wan 2.1 1.3B base
  (Apache-2.0), DWPose onnx; a community 16 GB ComfyUI node exists (UNVERIFIED). A second model family to ship,
  and it re-renders, so lip sync is not guaranteed.
- Detection/assignment without InsightFace: OpenCV Zoo YuNet + SFace (Apache-2.0); BFSNodes already switched to
  them (commit 187c9a1).

### 5. Alissonerdx H3 swap LoRAs (rank 5)
https://huggingface.co/Alissonerdx/Minimax-H3-ComfyUI (repo `license: other`, mixed). Read by hand:
- **Character Swap** (`..._character_swap_v1.0_ref2va_r64_gl`, 620 MB): BFS Character Swap Community License 1.1:
  commercial use free; orgs above US$1M revenue must credit; **no hosted API / SaaS / remote inference**; no
  selling as a standalone product. Shipping it as an app download needs the author's read on "remote inference"
  vs a user's own RunPod Pod. Swaps the WHOLE subject (body + clothes too), single subject unless named.
- **Head Swap** (`..._head_swap_v1.0_r32`, 310 MB): no terms anywhere = all rights reserved, same as Best-Face-ID.
- Both need the base clip on `MiniMaxH3AddGuide`, not our native reference slot: a graph change.
- `G:/CubricModels/loras/h3_character_swap_pro4500_1000.safetensors` is on disk; origin not traced.

### 6. BFSNodes H3 Identity Reference + RoPE (not a candidate today)
Upstream BFSNodes (GPL-3.0; our bench has 1.4.0, upstream is 1.94.x) has `MiniMax-H3 Identity Reference + RoPE`.
Its own guide (read): it "requires a checkpoint trained with a matching identity reference role", "they do not
guarantee the same face", no full H3 quality validation. No such checkpoint is published. Revisit if one appears.

### Checked and dropped
- `prithivMLmods/MiniMax-H3-Facial-Realism-CloseUp`, `fal/MiniMax-H3-Realism-People-LoRA`: skin realism, not
  identity (UNVERIFIED, sub-agent).
- Playtime-AI celebrity H3 LoRAs: celebrity likeness, not the user's character; may be voice LoRAs.
- HunyuanCustom: ~80 GB recommended, Tencent licence excludes EU/UK/KR. Stand-In, Phantom, MAGREF: Wan
  generators, not post passes. CodeFormer: S-Lab non-commercial. GFPGAN (Apache-2.0) restores, does not
  change identity.
- CivitAI was not reachable from the research session: H3 identity LoRAs there are unsearched.

## 4. Bench plan (nothing run yet)

Own ComfyUI from `G:/ComfyUi` on a free port (not :8188) with its own input/output/temp/user dirs, the shipped
`minimax_h3_r2va.json` runtime, every run under `gpu_lease.py run --poll 2`. No downloads needed for A and B.

**A. Layout levers** (the shipped graph, same seed 4097243197, turbo ON unless stated, 1344x768, **5 s**, a
two-shot prompt cut from ref2v_001: her close-up, then his close-up):
| arm | change from today |
|---|---|
| A0 | baseline: `flowCharacterSheet_031` + `flowCSFI_007` |
| A1 | her sheet = `flowCSE_028` (front face kept) |
| A2 | A0 + a face crop per character as `<Picture 3>` / `<Picture 4>`, named in the prompt |
| A3 | A0 with `Input_Refs.ref_image_size = max` (stage 1 reads the full sheet) |
| A4 | A0 with turbo OFF |
| A5 | the best of A1-A4 combined, second seed |

**B. UntMods FaceSwap pass**: ref2v_001's two close-ups (7.5-10.5 s, 10.5-14 s) as `<Video 1>`, the matching
face crop as `<Picture 1>`, LoRA at 1.0, `Faceswap` trigger. One pass per person. Check lip sync against the
original audio, not just the face.

Read: agent stills at the close-up frames side by side with the sheet face; Fabio's eye test decides. Cost
estimate: A = 6 runs of a 5 s clip (several minutes each on the 4060 Ti, turbo); B = 2 runs with a 3 s video
reference (~44-52 s/step measured). C (a trained LoRA) only if A and B both fall short, and only after a
training-VRAM check; a RunPod training run costs money and needs Fabio's yes first.
