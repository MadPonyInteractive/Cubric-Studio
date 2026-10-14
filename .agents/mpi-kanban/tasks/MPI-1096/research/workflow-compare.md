# LTX 2.3 Ref-to-Video: Workflow Face-Identity Comparison

**Context:** Our `ltx_i2v_t2v_int8.json` faces drift when two characters share the sheet or the
face is small in frame. This compares our graph against the Lightricks official Ingredients
single-stage and the Best-Face-ID CharacterSheet workflows.

> HF model card for `Lightricks/LTX-2.3-22b-IC-LoRA-Ingredients` returned HTTP 401 (gated repo,
> no token). The example workflow JSON on disk was used instead. Items marked **INFERRED** lack a
> verified citation.

---

## Comparison Table

| Setting | Ours (int8 Balanced) | Official Ingredients (single-stage) | Best-Face-ID CharacterSheet (upscale) | Likely effect on face identity |
|---|---|---|---|---|
| **Base model** | `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors` | `ltx-2.3-22b-dev.safetensors` (dev, bf16) | `ltx-2.3-22b-dev-Q6_K.gguf` (Q6_K GGUF) | int8 loses micro-detail vs Q6_K (~6.5-bit) or bf16 dev |
| **Distilled how** | Pre-baked int8 transformer | `ltx-2.3-22b-distilled-lora-384-1.1.safetensors` @ **0.5** (node 4922) | Same distilled LoRA @ **0.6** (node 67) | LoRA-based distillation at 0.5–0.6 keeps the dev model's full capacity; pre-baked int8 loses it |
| **Text encoder** | `CLIPTextEncode` — text-only | `GemmaAPITextEncode` (Gemma-3 12B, multimodal — sees the reference image) (nodes 5020/5021) | `TextGenerate` (Gemma) auto-rewrites prompt with face attrs extracted from the reference photo (node 79) | **Biggest gap.** Official and BestFaceID get face-anchored text conditioning; we rely on the user writing face attributes |
| **Stages** | 2 (stage-1 + upsampler + stage-2) | 1 (single pass, `LTXVPreprocess` + manual sigmas) | 2 (stage-1 + upsampler + stage-2) | — |
| **IC guide at stage 1** | `LTXAddVideoICLoRAGuide` node 905: frame_idx=0, strength=1, latent_downscale_factor=1, use_tiled_encode=**False** | `LTXAddVideoICLoRAGuide` node 5012: same params, use_tiled_encode=**False** | `LTXIdentityOverlapConditioning` node 2242: source_id=2, strength=1, layout=overlap, ref_resize_mode=**native_resolution** (TASS-RoPE) | BestFaceID's TASS-RoPE gives the reference a distinct RoPE phase tag; the model can distinguish reference from generated frames |
| **IC guide at stage 2** | `LTXAddVideoICLoRAGuide` node 910: same, use_tiled_encode=**True** | n/a | `LTXIdentityOverlapConditioning` node 2243: same native_resolution | Our two-stage re-inject is correct (matches Lipdub official) |
| **Reference image resolution** | Resized to clip size: 960×512 Medium, 960×576 High | `ResizeImageMaskNode` shorter dim = 544 → ~960×544 | **Fixed 1536×1024**, `ref_resize_mode=native_resolution` regardless of video size | BestFaceID keeps ~3× more face pixels than our Medium sheet. At 960×512 with two chars, each face ~330 px wide; at 1536×1024 still 768 px wide |
| **RepeatImageBatch amount** | Wired to frame count (node 76 `MpiWanSeconds` at 24 fps) | PrimitiveInt 241 frames → full clip length | Full clip length via SetNode / GetNode chain | Both repeat to clip length — no difference |
| **Guide strength** | 1 (node 905/910 `strength`) | 1 (node 5012) | 1 (node 2242/2243) | Same |
| **latent_downscale_factor** | 1 (nodes 905, 910) | 1 (node 5012) | n/a (different mechanism) | Same |
| **IC LoRA strength** | 1 (node 900 `LTXICLoRALoaderModelOnly`) | 1 (node 5011) | BestFaceID LoRA @ 1, base close-up @ 0.2 for extra identity (node 2188) | Same for Ingredients LoRA |
| **CFG** | 1 (nodes 293, 330) | 1 (node 4828) | 1 (node 81/135) | Same |
| **Stage-1 sampler** | `euler_ancestral_cfg_pp` (node 157) | `euler_ancestral_cfg_pp` (node 4831) | `BasicScheduler linear_quadratic` / `SamplerCustomAdvanced` (node 66/91) | Same as official for stage 1 |
| **Stage-1 sigmas** | `1.0→0.99375→…→0.421875→0.0` (node 140, 8 steps) | Same 8-step schedule (node 5025) | Same 8-step schedule (node 68) | Same |
| **Stage-2 sigmas** | `0.85, 0.7250, 0.4219, 0.0` (node 28) | n/a | `0.85, 0.7250, 0.4219, 0.0` (node 134) | Same; stage-2 denoise starts at 0.85 (deep enough to reshape faces) |
| **Extra LoRAs** | Transition LoRA (node 191); detailer-merged `softenhance_abliterated_detailer_merged` (node 387) @ clip+model | Distilled LoRA only | Distilled LoRA @ 0.6 + FaceID LoRA(s) | Detailer LoRA pushes faces toward model's generic "good-skin" aesthetic; transition LoRA unknown effect on faces |
| **NAG** | `LTX2_NAG` scale=11, alpha=0.25, tau=2.5 (node 426) | None | None | **INFERRED:** NAG at scale 11 amplifies model priors (generic face ideal), pulling away from the reference distribution |
| **Normalization** | `LTXVNormalizingSampler` video_normalization_factors=1.1 on frame 0 (node 70) | Not present | Not present | 1.1 first-frame boost may over-weight the start frame vs reference content |
| **Prompt format** | `### Reference Sheet Description` + `### Target Description` (auto-rewritten in app) | Same two-section format, but encoded by Gemma-3 multimodal | `ref_t2v:` prefix + Gemma auto-adds face attributes from the reference photo | Our Ingredients-style prompt is correct; face attrs are empty unless the user writes them |
| **SolidMask / SetLatentNoiseMask** | Node 200: applied to audio latent only (i2v path), NOT video | None | `SolidMask(value=0)` node 171 → `SetLatentNoiseMask` node 170 applied to VIDEO latent before stage-2 upscale | BestFaceID zero-masks the latent so stage-2 refines rather than re-generates the reference area; we don't do this for video |
| **Output resolution in examples** | Medium 960×512, High 960×576 (app) | 960×544, 121 frames | 768×768, 121 frames (but ref stays at 1536×1024) | — |

---

## Ranked Differences Most Likely to Cost Face Identity

### 1. No multimodal text encoder (Gemma-3)
**Evidence:** Nodes 5020/5021 in official Ingredients, node 79 (`TextGenerate`) in BestFaceID.
Both use Gemma-3 to look at the reference image and generate text that describes the face
(skin tone, hair, eyes, expression). This text embedding is fused with the IC guide, so the
model gets a DOUBLE lock on the identity — latent overlap AND textual description.
Our `CLIPTextEncode` is text-only; identity attributes appear in the text only when the user
types them, and even then CLIP's embedding space is less fine-grained for face attributes.

**Bench test:** same sheet + same prompt, but manually add Gemma-style identity description
("dark brown eyes, narrow nose, defined jaw, short black hair") to our prompt. If face holds
better, Gemma is the lever. No new weights needed — pure prompt change.

### 2. Reference image resolution too small (sheet squeezed to clip size)
**Evidence:** Our `ImageResizeKJv2` node 903 pads/resizes to clip dimensions (960×512 Medium).
BestFaceID CharacterSheet node 2242/2243: `ref_resize_mode=native_resolution` keeps the ref
at its full 1536×1024. At 960×512 with two characters each face is ~330 px wide; at 1536×1024
with one character the face is ~700 px wide. The VAE encoder runs on the reference at this size,
so fewer face pixels → coarser latent representation → less identity information in the guide.

**Bench test:** pass a high-res sheet (1536×1024 or 1920×1024) to the current graph **without**
resizing to clip size — change node 903 to output at native size. Compare face hold vs current.
Needs a graph patch; ~30 min to wire and run (2 clips, same seed).

### 3. Detailer LoRA + transition LoRA pulling faces generic
**Evidence:** Node 387 `LTXVConditioning` with `softenhance_abliterated_detailer_merged.safetensors`
at strength_model=1, strength_clip=1. "Softenhance" and "detailer" both describe LoRAs trained
to produce smooth, aesthetically-ideal skin and facial structure — the opposite of face-specific
identity. The transition LoRA (node 191) is for scene transition, unknown effect on faces.

**Bench test:** run the same clip with node 387 strength set to 0 (bypass detailer). Compare
side-by-side. If faces hold better, the detailer is the lever. Single model swap, ~30 min.

### 4. NAG at scale 11 amplifying generic-face prior
**Evidence:** Node 426 `LTX2_NAG`, scale=11. NAG is a form of guidance that pushes the output
toward the model's own high-confidence distribution — which for faces means "attractive,
symmetrical, common" rather than "this specific person." Scale 11 is relatively aggressive.
Official and BestFaceID use no NAG at all.

**INFERRED** — no published LTX-specific NAG ablation on identity tasks.

**Bench test:** run with NAG scale lowered to 5 or disabled (scale=1). Compare face hold.
~30 min, no new weights.

### 5. Two characters sharing one sheet
**Evidence:** MPI-1096 bench: single character on sheet = identity holds (Fabio's eye test, both
seeds). Two characters + 20 s = both faces drift. `ref2v_002` with only characters (no setting)
also drifts (Pass 2 evidence). The Ingredients LoRA training data used one-subject sheets;
the BestFaceID CharacterSheet was also trained on single-subject 4-panel sheets. Splitting the
sheet area 50/50 halves face pixel density for each subject.

**Bench test already proposed (MPI-1096):** two characters on one sheet vs. one character per
sheet, two IC guide nodes with different source_id (2 and 3 using TASS-RoPE), same seed.
Needs the BestFaceID approach (LTXIdentityOverlapConditioning) or a multi-subject Ingredients
extension.

### 6. int8 convrot quantization (vs Q6_K or bf16+LoRA)
**Evidence:** Node 4 loads `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`.
BestFaceID uses `Q6_K.gguf` (better quantization curve); official uses `dev.safetensors` bf16.
The convrot variant applies an orthogonal transformation before quantizing, which helps on most
tasks but still loses bits relative to higher-precision formats. Face micro-details (freckles,
wrinkle lines) are exactly the kind of high-frequency content that quantization rounds away.

**INFERRED** — no direct A/B on the same ref-to-video task at different quant levels for our box.

**Bench test:** if a bf16 or Q8 version of the distilled transformer fits in VRAM (16 GB 4060 Ti),
run the same clip. The bf16 won't fit; Q8_K is borderline (~22 GB). Could test on a 24 GB Pod.

### 7. Zero-mask for video latent not applied at stage 2
**Evidence:** BestFaceID `SolidMask(value=0)` node 171 → `SetLatentNoiseMask` node 170 applied
to the video latent before stage-2 upscale. Our `SetLatentNoiseMask` node 200 is wired to
the audio latent (node 198 `LTXVAudioVAEEncode`), not the video latent. A zero noise mask
at stage 2 tells the sampler to refine without re-generating, preserving the reference content
from stage 1 through the upscale. Without it, stage 2's deep start (0.85 sigma) can reshape faces.

**Bench test:** wire `SolidMask(value=0)` to the video latent before the stage-2 sampler call.
~1 h to wire safely; run two clips, compare.
