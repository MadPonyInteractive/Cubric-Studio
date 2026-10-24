# MPI-1191 LTX Director study (2026-10-24, research agent, read-only)

Tags: [SRC] read the source/JSON, [DOC] README/official page, [HEARSAY] third-party pages, [INFER] my deduction.
Repo: https://github.com/WhatDreamsCost/WhatDreamsCost-ComfyUI (v2.0.5, pyproject). Shallow clone read from the scratchpad
(`...\scratchpad\wdc`; nothing in the repo tree touched). Files: `ltx_director.py` (1379 l), `ltx_director_guide.py` (697),
`prompt_relay.py` (254), `patches.py` (204), `js/ltx_director.js` (timeline UI),
`example_workflows/LTX_Director_2_Workflow_Distilled.json` (33 nodes) + GGUF + FFLF v3/v6 variants.
The comfyui-mcp SKILL.md only documents the hidden `timeline_data` JSON; it has no repo URL or licence [DOC].

## 1. Timeline -> graph  [SRC]
- Three nodes do the work: `LTXDirector` (outputs model, conditioning, empty latent, guide_data, motion_guide_data, audio latent, fps),
  `LTXDirectorGuide` (injects the pictures), `LTXDirectorCropGuides` (strips them before decode).
- It does NOT use the LTXVAddGuide node as a graph node, but calls the CORE class methods inside its own node:
  `nodes_lt.LTXVAddGuide.encode`, `.get_latent_index`, `.append_keyframe` (ltx_director_guide.py L523-537).
  So it is the same appended-guide-token mechanism as our chained recipe, N pictures in one node.
- Per picture: sorted by timeline start; `frame_idx = segment.start - start_frame` (pixel frames, any value; `get_latent_index` snaps);
  if the picture is flagged `isEndFrame`, `frame_idx = start + length - 1` (its LAST frame) (ltx_director.py L1086-1089).
  So a picture's length on the timeline is its place in time; spacing in frames = start offsets. Seconds -> frames = s * frame_rate.
- Strength: `guide_strength` string, one per picture (comma list), default 1.0 each. Strength <= 0 skips the picture.
  Stage-1 vs stage-2 values are separate widgets on the two Guide nodes.
- Pictures are resized to the latent grid (target = latent_w*32 x latent_h*32) before encode. Note the hard-coded 32.
- Empty timeline + no latent: a dummy picture at strength 0 (avoids T2V artifacts) (L1094-1169).

## 2. Prompt per stretch (KEY)  [SRC]
- NOT time-masked conditionings, NOT per-segment generation, NOT LTX-native. It is "Prompt Relay" (paper-based, `prompt_relay.py`,
  `patches.py`): ONE text conditioning = `global_prompt + " " + local1 + " " + local2 ...` (map_token_indices tokenises the
  concatenation and records each local prompt's token range).
- The model is patched: every transformer block's text cross-attention (`attn2`, and `audio_attn2`) is wrapped; an additive
  Gaussian penalty mask is added to the attention logits so video frames in a segment attend mostly to that segment's tokens
  (global tokens are never penalised). Penalty = strength * relu(|frame - segment_midpoint| - window)^2 / (2 sigma^2),
  window = max(len/2 - 2, 0) latent frames, sigma = 1/ln(1/epsilon), epsilon default 0.001 (sharp edges; ~0.5+ = soft).
- Applied on the positive pass only (skipped when cond_or_uncond is uncond-only). Segment pixel lengths are converted to latent
  frames by largest-remainder, each >= 1 latent frame, full timeline pinned to the latent length.
- One or zero local prompts: relay is bypassed, plain `global, local` prompt (L797-815).
- Consequence for us: a per-gap prompt is feasible without per-segment sampling, but only via a model patch (monkey-patched
  forward, wraps KJNodes NAG if present; refuses stacking on another patch of the same key). It is NOT a graph-level trick.

## 3. Audio  [SRC, partly DOC]
- Audio segments on a track (`_build_combined_audio`, L585) are mixed to one waveform, encoded by the audio VAE into the AV latent
  with a noise mask: `use_custom_audio`, `inpaint_audio` (imported audio kept, silence/gaps generated), `override_audio`.
  Audio length is tied to the timeline length, so it fixes clip duration; the prompt relay also masks `audio_attn2`
  (separate audio epsilon/strength knobs exist in build_segments, unused by the node UI path).
- "Convert to End Frame" is a right-click toggle `isEndFrame` on an image segment (js L9668-9685): the picture is placed at
  the LAST frame of its stretch instead of the first. That is all it does (see 1). No video extension logic is in the
  keyframe path; "extend a video" = a video segment becomes motion/IC-LoRA/retake guide, a separate feature.
- We need none of it; our Flow has no audio in scope (confirm with owner).

## 4. Two stages  [SRC]
- Distilled example: LTXDirector -> LTXVConditioning (+ConditioningZeroOut negative) -> LTXDirectorGuide A -> LTXVConcatAVLatent
  -> CFGGuider(cfg 1) + SamplerCustomAdvanced (euler, BasicScheduler linear_quadratic, 4 steps, denoise 0.42 listed for the
  first scheduler) -> SeparateAV -> LTXDirectorCropGuides -> LTXVLatentUpsampler (ltx-2.3-spatial-upscaler-x2-1.1) ->
  LTXDirectorGuide B (SAME guide_data/motion_guide_data re-fed) -> ConcatAV -> sampler 8 steps denoise 1.0 -> Separate ->
  CropGuides -> VAEDecode (+ audio VAE decode) -> CreateVideo -> SaveVideo.
- So YES: guides are re-applied in stage 2 from the same data, after CropGuides removed stage-1 guides. The two Guide nodes carry
  separate settings (second one scale 0.5, image_attention 1; first 1/1) [SRC; exact stage mapping of each node not traced].
  The widget dump is ambiguous about which is which; do not copy numbers without a diff against our own two-stage graph.
- The prompt relay mask depends on latent length, so it is rebuilt per latent shape (cache keyed by Lq/Lk) and works in both stages.

## 5. LTX 2.5 compatibility, our engine  [SRC for what it needs; 2.5 itself UNVERIFIED]
- Written and shipped for LTX 2.3 (22B distilled 1.1 fp8, `gemma_3_12B_it_fp4_mixed` + `ltx-2.3_text_projection` via DualCLIPLoader,
  `taeltx2_3`, 2.3 video/audio VAEs, 2.3 spatial upscaler). The README names no 2.5 support. A 2.5 run is UNTESTED by anyone I found.
- Risks for 2.5 (Gemma 4 CLIPLoader, int8): (a) `get_raw_tokenizer` + `map_token_indices` poke at the CLIP tokenizer object
  (SentencePiece `input_ids`, EOS handling); Gemma 4 tokenizer shape unverified. (b) patches target `diffusion_model.transformer_blocks[i].attn2/audio_attn2`
  and `vae_scale_factors`; 2.5 architecture names unverified. (c) hard-coded `*32` spatial factor and 2.3 upscaler. (d) the
  guide-attention entries / `append_keyframe(guide_mask, latent_downscale_factor, causal_fix)` need a core new enough to have those kwargs:
  present in a local G:\ComfyUi core I looked at (nodes_lt.py L379); our v0.42.1 NOT checked against it. Hand-check before reuse.
- Node packs the Distilled example needs (class types in the JSON): WhatDreamsCost-ComfyUI (LTXDirector, LTXDirectorGuide,
  LTXDirectorCropGuides), ComfyUI-KJNodes (VAELoaderKJ, ModelPreviewOverrideKJ; NAG nodes in other graphs), core ComfyUI
  (UNETLoader, DualCLIPLoader, VAELoader, LTXV* nodes, KSamplerSelect, BasicScheduler, CFGGuider, SamplerCustomAdvanced, CreateVideo,
  SaveVideo, ConditioningZeroOut, LatentUpscaleModelLoader). README says ComfyUI-LTXVideo must be updated too [DOC]. The
  comfyui-mcp page also lists rgthree (Power Lora Loader), VideoHelperSuite, LTX2_NAG for its variant graph [DOC].
  Python deps imported by the pack: av, numpy, torch, PIL, aiohttp (the pack's own, plus ComfyUI's `comfy_api.latest`).
- Upshot: adopting the pack means taking a third-party GPL pack + KJNodes, plus a model patch that is unproven on 2.5. Heavy.

## 6. Licence  [SRC]
- `LICENSE` = GNU GPL v3 (full text). Copying node code or graph logic into a closed/redistributed desktop app makes the whole
  combined work GPL-3 (source offer). Using it unmodified as a separate installed node pack is the usual "aggregate" path, but
  that is a legal call for the owner. Ideas and the published paper's algorithm are not covered; code is. Do not paste code.
  Parts of the guide code are credited to "Nghtdrp" (helper functions) [SRC], so the provenance is mixed.

## 7. What our Flow should copy / skip
Copy (concepts, re-implemented with core nodes):
- N pictures on one timeline, position = start frame, 1 strength per picture, ends at start / last frame.
- A "this picture is the END of its stretch" notion (isEndFrame) for the last key, matching our idx -1.
- Guides removed (CropGuides) after stage 1 and RE-APPLIED in stage 2 with a lower strength (director re-feeds guide_data).
- Strength default per picture visible in UI; skip pictures at 0.
- Keep the 1-prompt fallback: with one prompt there is no relay.
Skip:
- Prompt Relay model patch (GPL, monkey-patches cross-attn, tokenizer-specific, untested on Gemma 4 / 2.5). If a per-gap prompt is wanted
  later, a clean-room design would be the sole route; ship v1 with ONE prompt as the card says.
- Audio track, IC-LoRA, retake, motion tracks, custom resize/compression, hidden JSON widget, JS timeline UI.
- The pack itself as a dependency (GPL, KJNodes, 2.3-only).
Our chained core `LTXVAddGuide` recipe in `outside.md` is equivalent to what the Director does inside one node; nothing in
this source contradicts it. The only extra mechanism (relay) is not required for landing on every picture.

Unverified, needs our own test: the relay on 2.5 (do not promise per-gap prompts), the Director's stage-2 strengths, and whether
v0.42.1 core has the `append_keyframe` signature the Director calls.
