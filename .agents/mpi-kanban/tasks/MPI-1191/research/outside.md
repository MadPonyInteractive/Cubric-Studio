# MPI-1191 outside research (2026-10-24, research agent, read-only)

Tags: [SRC] read the source/JSON, [DOC] official doc, [HEARSAY] community.

## Official

- NO official N>2 keyframe template for LTX 2.5 anywhere. Only the 2-key first+last graph. [SRC]
- Core blueprint "First & Last Frame to Video (LTX-2.5)" (ComfyUI `blueprints/`, = template
  `video_ltx2_5_flf2v.json`): ResizeImageMaskNode -> LTXVPreprocess(18) -> LTXVAddGuide idx 0 str 0.7
  -> LTXVAddGuide idx -1 str 0.7, BEFORE LTXVConcatAVLatent (hard rule). LTXVConditioning fps 25,
  LTXVDualCFGGuider [1,1], SamplerEulerAncestral, ManualSigmas `1.0, 0.99375, 0.9875, 0.98125, 0.975,
  0.909375, 0.725, 0.421875, 0.0`, length = s*fps+1, tail SeparateAV -> LTXVCropGuides -> VAEDecodeTiled. [SRC]
- Core `LTXVAddGuide` (nodes_lt.py, v0.42.1): frame_idx in PIXEL frames; 1-frame image takes any idx;
  9+ frames need idx % 8 == 0 (rounds down). Negative idx = (latent_len - existing_guides - 1)*8 + 1 + idx,
  so -1 stays the last frame whatever the chain order. Guides are APPENDED tokens, noise mask
  max(0, 1 - strength); LTXVCropGuides strips them before decode. [SRC]
- 2.5 learned keyframe position embedding: automatic (checkpoint flag `use_keyframes_abs_pos_embedding`),
  no node/param. The mask EXCLUDES appended guide tokens, so an LTXVAddGuide at idx>0 does not get the
  marker from the code. Whether our int8 checkpoint sets the flag: UNVERIFIED. Do not market "learned
  keyframes" until checked. [SRC, training unknown]
- Core `nodes_lt_keyframes.py` (LTXVAddGeneratedKeyframes etc., v0.42.1 has them) = model-invented anchors,
  not user pictures. Not needed. [SRC/DOC]
- ComfyUI-LTXVideo main v1.1.0 has `example_workflows/2.5/` (T2V/I2V one/two-stage, IC-LoRA, HDR) but no
  keyframe example and no multi-keyframe node. Our pin 3b9c5cde is enough. [SRC]
- Version: core v0.42.1 + pin 3b9c5cde need NO bump for chained core guides. [SRC]

## Recipe derived (N keys, distilled 2.5)

- L = 8k+1. Key 0 at idx 0, key N-1 at idx -1, middle keys snapped to multiples of 8 (inference).
- One LTXVAddGuide per key, chained in time order, all before ConcatAVLatent.
- Strength: 0.7 official ends; community 0.3-0.7 for middles [HEARSAY]. Start 0.7 ends / 0.5 middles.
- One prompt for the whole clip (no per-segment prompting found in any LTX workflow).
- Two-stage: re-inject the keys at the refine stage (community: 0.7 base, 1.0 refine) [HEARSAY].
- KJNodes `LTXVAddGuideMulti` exists (one node, N guides) - skip: chained core nodes are equivalent.
- Community 3-key graphs: RuneXX (Kijai HF LTXV2_comfy discussion 25), nextdiffusion / ltxworkflow 2.3
  first-middle-last tutorials [HEARSAY].

## Failure modes [HEARSAY unless noted]

- Brightness flash at a key: strength too high. End frame snapping in early: lower last-key strength.
- Last frame not landing: raise end strength, lower CFG, room between keys.
- Morph/dissolve between far keys: negatives "morph, dissolve, glitch", static camera; more keys = more
  failures (one report: 2 pictures fine, 3 not). Expect several seeds.
- Line-art drifting photoreal: NO documented fix. Untested: refine strength 1.0, style words, lower
  LTXVPreprocess. Needs our own test on drawings.
- Keys closer than 8 frames collide (one latent frame); keep >= 16 apart (inference).
