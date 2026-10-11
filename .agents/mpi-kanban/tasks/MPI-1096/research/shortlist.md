# MPI-1096 research pass 1: face identity for LTX 2.3 (2026-10-11)

**Status: UNVERIFIED.** A web-research sub-agent's reading of model cards and posts; no link opened by hand, no
licence read, nothing run. Verify each claim before acting on it.

## No official option
Lightricks' LTX-2.3 IC-LoRA collection (as read): Ingredients, Motion-Track-Control, LipDub, Union-Control, HDR. No
face-identity IC-LoRA for 2.3 or 2.5.

## Ranked shortlist
1. **LTX-Best-Face-ID** (Alissonerdx) - https://huggingface.co/Alissonerdx/LTX-Best-Face-ID. Reference-to-video
   identity LoRA for LTX-2.3 22B, one reference photo, ArcFace identity loss + TASS-RoPE (arXiv 2606.02441). ~1 GB.
   Nodes: ComfyUI-BFSNodes `LTXIdentityOverlapConditioning` (installs insightface); for i2v, 10S-Comfy-nodes
   `LTXFaceIdentityReinforcer`. Licence NOT stated; insightface/ArcFace weights historically non-commercial. Card
   notes: face bleeds into background, weaker on wide/full-body shots.
2. **AviadDahan LTX-2.3-ID-LoRA-CelebVHQ-3K** - https://huggingface.co/AviadDahan/LTX-2.3-ID-LoRA-CelebVHQ-3K, nodes
   https://github.com/ID-LoRA/ID-LoRA-LTX2.3-ComfyUI. ~1.1 GB. Trained on CelebV-HQ (dataset is research-only:
   commercial risk). Self-reported benchmarks only. CHECK: may be the same "ID-LoRA" family as our talkvid voice
   ID-LoRA (docs/models/ltx/audio-input.md).
3. **Face-dominant reference** (no new weights): big head-and-shoulders crop on the sheet; for i2v a good face still
   as frame 0. Community advice, no evidence quality. **Ref2v half tested 2026-10-11, did not fix it:** `ref2v_003`
   (X2.3 references, Pod, high 1216x704, sheet ONLY so it passes untouched, face crop ~1/3 of the sheet). Agent read
   it as another man; **Fabio, side by side: "I think it's the same guy this time around. His face seems a bit wider
   and with more detail, but that can be attributed to the camera lens and aperture."** So identity carries when the
   face is big on the sheet and drifts when it shares the sheet with a setting (`ref2v_002`, same pictures + forest:
   "not the same guy"). Size alone does NOT explain it: `layoutSheet` puts the face panel at ~783 px wide alone vs
   ~665 px with the forest beside it (-15%). A/B `ref2v_005`: ref2v_002's prompt AND seed (2876282417), sheet only:
   agent's read of frame 1 = much closer to the sheet (narrow face, thin brows, light eyes). **Fabio: "that looks more
   like the same guy."** So a second picture on the sheet costs identity beyond the 15% pixel loss; a bigger face
   crop is not the lever. Candidate: give the character(s) far more of the sheet, or its own sheet.
4. **Face-swap second pass** - an LTX-2.3 face-swap workflow listed on RunComfy; LoRA and licence unknown. No
   ReActor/FaceFusion + LTX pipeline found.
5. **Per-character LoRA** via LTX Trainer (https://ltx.io/model/ltx-trainer): 20-30+ images, 500-2000 steps, 32 GB
   VRAM floor (RunPod, not user hardware), Linux. Strongest for a recurring character; per-version retrain.

## Licence check (2026-10-11, HF API + both README.md read by hand)
- **Best-Face-ID:** `license: other` with NO terms anywhere in the README: no grant = all rights reserved, so we cannot
  ship or re-host it without the author's written permission. Three files: `Best_FaceID_v1.0_LoRA`,
  `Best_FaceID_CharacterSheet_v1.0_LoRA` (continuation trained on a 4-panel sheet: face close-up + full-body
  front/side/back on white, carries clothing too; README: add the base LoRA at ~0.2 if identity is weak) and an
  optional ArcFace projector (unused by the sheet LoRA). Training used InsightFace `buffalo_l` ArcFace (non-commercial
  models) as a LOSS; the BFS node auto-installs insightface, so check whether inference needs its weights. Example
  references are celebrity clips (likely CelebV-HQ-style data). Created 2026-07-05. README limits: reference can look
  "pasted" (first-frame/mask tendency), identity weak with a generic prompt, base checkpoint biased to close-ups.
- **AviadDahan CelebVHQ-3K:** `license: other`, no terms. NOT a face LoRA for our case: it is the CelebV-HQ sibling of
  the TalkVid-3K ID-LoRA we already ship (`ltx23-lora-talkvid`, voice-ID; same paper arXiv 2603.10256, strategy
  `audio_ref_only_ic`). CelebV-HQ is a research-only dataset. Drop it.

## Searched, nothing found
PuLID / InstantID / IP-Adapter / ConsisID / Phantom / Lynx / Stand-In ports to LTX; ReActor/FaceFusion with LTX
output; any LTX-2.5 identity LoRA.

## Open questions for the bench
- Licence of each candidate (commercial use) and of insightface if a node pulls it in.
- Does a face LoRA stack with the Ingredients IC-LoRA and the talkvid voice ID-LoRA in one graph? Nobody has published it.
