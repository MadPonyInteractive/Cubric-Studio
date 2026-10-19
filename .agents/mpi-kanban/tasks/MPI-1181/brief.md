# MPI-1181 brief - FLUX.3 Klein

Umbrella: MPI-1179 (New Models to Test), phase 2. Researched 2026-10-18 from Fabio's video
(<https://www.youtube.com/watch?v=gfLy2yjJ0sI>, The AI Blueprint, 2026-10-16) and the sources below.

~~Dev-gated, not a 2.1 item (Fabio, 2026-10-18).~~ **Superseded 2026-10-19: ships in 2.1.1, this
week, licence-gated (not devOnly), with Boxes.** See "2026-10-19 update" at the end: it overrides
anything above it that disagrees.

## What it is

- Black Forest Labs FLUX.3 [klein], released 2026-10-15: 5.6B open weights, first of the FLUX 3
  family. <https://bfl.ai/blog/flux-3-image-klein>
- Text-to-image, single-reference edit and multi-reference (up to 10 images) in ONE model.
  Extra: bounding boxes in the prompt (0-1000 grid) to place, recolour, move or remove things.
- Two checkpoints:

| Checkpoint | File stem | Steps | CFG | Use |
|---|---|---|---|---|
| Base | `flux3-image-klein-base-*` | 50 | 3.5 | best quality (video: clearly more natural skin) |
| Distilled | `flux3-image-klein-*` | 16 | 1 (none) | fast; video calls it slightly plastic |

  Video settings: euler + simple, 2 MP (4 MP for ~2048 px). Edit took ~35 s at 50 steps on base.

## Files (gated `auto`: accept on HF, <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy>)

| Folder | File | Size |
|---|---|---|
| diffusion_models | base / distilled `-bf16` | 11.1 GB each |
| diffusion_models | base / distilled `-int8-convrot` | 5.8 GB each |
| diffusion_models | base / distilled `-nvfp4` | 5.3 GB each (Blackwell only) |
| text_encoders | `qwen3vl_4b_bf16` / `_int8_convrot` | 8.9 / 4.9 GB |
| text_encoders | `qwen3.5_9b_flux3_prompt_upsampler_{bf16,int8_convrot,w4a8}` | 18.8 / 9.8 / 6.7 GB |
| vae | `flux2-vae` | 0.34 GB, already a dep (`assetDeps.js`) |

The repo also ships 12 official workflows (`flux3_klein{,_base}_{bf16,int8}_{t2i,i2i,mi2i}.json`).

## Shape for Cubric - ONE card with a Turbo button (Fabio, 2026-10-18)

Every checkpoint ships in all three formats (bf16, int8-convrot, nvfp4), so the format and the
base/distilled choice are separate axes. Both int8 files are 5.8 GB, so Fabio's call is **one
model card carrying both, with a Turbo button that picks between them** (it replaces the
two-card Balanced/High split briefly on this card earlier today):

- **Turbo ON** = distilled `flux3-image-klein-int8-convrot`: 16 steps, fast.
- **Turbo OFF** = base `flux3-image-klein-base-int8-convrot`: 50 steps, best quality.
- No bf16 (11.1 GB, double the download for the same model) and no nvfp4 (pays off on RTX 50xx only).

**The text encoders are the SAME for both** (checked 2026-10-18 in ComfyUI's four official
templates, `Comfy-Org/workflow_templates` `templates/image_flux3_klein{,_distilled}_{t2i,image_edit}.json`).
Every one loads `qwen3vl_4b_int8_convrot` (CLIP type `flux3`), the
`qwen3.5_9b_flux3_prompt_upsampler_w4a8` upsampler into a `Flux3LayoutPrompt` node, and
`flux2-vae`. **Only the `UNETLoader` file and the KSampler steps differ**, so Turbo is a
diffusion-model switch inside one graph. Template KSampler values: edit base 50 steps / euler,
edit distilled 16 / euler, both t2i 15 / er_sde, CFG 1 everywhere. That disagrees with the model
card's base CFG 3.5: settle it at bench time.

**How this Turbo differs from Krea 2's (Fabio, 2026-10-18):** Krea 2 runs one weight and switches
an accelerator LoRA on and off (`capabilities.turboToggle`, `krea2Turbo` control, `Input_is_Turbo`,
the graph reads `Get_turbo` for steps/CFG; see `js/data/modelConstants/models.js`,
`js/data/generationControls.js`). Here **an `MpiIfElse` node picks between two UNETLoaders**
(distilled on `true`, base on `false`), driven by the same turbo boolean, and the Turbo branch
also sets the steps. `MpiIfElse` inputs are `lazy` (`check_lazy_status`, ComfyUi-MpiNodes
`if_else.py`), so only the chosen loader runs. Check that once in the bench log.
**Both models are installed at all times:** both weights are required deps of the one card,
**11.6 GB of diffusion weights** plus the shared encoder, and the button never triggers a download.

**Fabio's read of the video: the distilled model is poor for realism next to the base.** Same
prompt and seed: plastic, oily-looking skin, and the whole picture looks less natural. Base is
the mode for photoreal work. The distilled model held up on product shots and text (coffee ad,
perfume bottle). Test that gap on photoreal prompts and say it on the Turbo control's hint.
Once, also compare base int8 against base bf16 to confirm int8 keeps base's quality edge.

- **Text encoder reuse:** we already ship `qwen3vl-abliterated-clip` (Qwen3-VL-4B abliterated
  fp8_scaled) as an engine asset. Test whether FLUX.3 accepts it before adding the 4.9 GB
  `qwen3vl_4b_int8_convrot` dep. Krea2 made the same swap.
- **Prompt upsampler:** BFL say do not run Klein without it, and every official template wires it.
  The 6.7-18.8 GB Qwen3.5-9B is a RAM risk for the 16 GB tester. Bench whether our own Enhancer /
  Cosmo recipe does the same job (BFL publish `system_prompts.json`) before shipping it.
- **Graph:** start as a COPY of `comfy_workflows/raw/klein_t2i_template.json` (add-model playbook
  01 §0a), loaders swapped in ComfyUI. The official workflows are reference only.

## Blocker - the engine

- Native support is Comfy-Org/ComfyUI PR 17064 (merged 2026-10-15), first in **v0.41.0**.
- The shipped engine pins v0.39.0 (`dev_configs/node_lock.json`). The G:\ComfyUi bench is also
  on 0.39.0.
- MOSS-Image (MPI-1180) needs v0.42.0. **One bump to >= v0.42.0 covers both.** MPI-1044's Pod
  smoke item now says to check for it first.

## Licence - FLUX Kommunity License (read 2026-10-18)

- Distribution and use only for Non-Commercial Purposes.
- "Qualifying Users" (under US$5M gross annual revenue) may use **Outputs** commercially.
- §2(e): content filtering or review of Outputs required (our child-safety gate is the
  candidate).
- §4(g): no use by sanctioned parties, and no IP proxying to hide location.
- Gate it like FLUX.2 Klein 9B (`js/data/modelConstants/licences.js`, MPI-357): licence copy +
  acceptance receipt. A NEW licence entry, never Klein 9B's text.

## Done when

A verdict in `validation.md`: wire it (open an `/mpi-add-model` card, still `devOnly`) or drop it.
It needs measured speed, VRAM and RAM for Turbo on and off, base vs distilled quality, and the TE-reuse and
upsampler answers.

## 2026-10-19 update (Fabio) - ships in 2.1.1, three workstreams

**HOLD on workflow edits:** Fabio is reworking the raw Flux Klein workflow himself (adding the
base/distilled Turbo fork). No agent edits a workflow until he hands it back; proceed from HIS file.

Release target **2.1.1, this week**, after 2.1 (MPI-1044). Licence-gated like Klein 9B, not devOnly.
The "Blocker - the engine" section above is CLEARED: 2.1 ships ComfyUI **v0.42.1** and the
G:\ComfyUi bench is on 0.42.1 too (checked 2026-10-19). Done-when is now: shipped in 2.1.1, not a verdict.

### 1. The model card (the brief above still holds)

Turbo button, int8 base/distilled, licence entry. **The prompt upsampler is OPTIONAL in the official
templates**, not mandatory: both `image_flux3_klein_t2i` and `_image_edit` route it through a
`ComfySwitchNode` (default `false` = off). So v1 can ship WITHOUT the 6.7 GB upsampler and lean on
our Enhancer, which removes the 16 GB-RAM worry. Bench with and without once.

**Upsampler research (2026-10-19, `black-forest-labs/flux-3-image-klein-pup` README, ungated, Apache 2.0):**
- It is a full fine-tune of Qwen3.5-9B (VL, vision tower frozen): SFT on short->long pairs, then
  preference tuning on its own prompts RENDERED by Klein at the same seed. That last step is the only
  thing a generic LLM lacks.
- **BFL say a substitute is fine:** "Any other LLM can do the job with the system prompts in
  `system_prompts.json`." Four prompts: `t2i`, `i2i`, `t2i_bbox`, `i2i_bbox` (copy kept in this
  card's research once benched). What they insist on is SOME upsampler: a short prompt "as typed
  gives generic output". Captions run 100-350 words (t2i), 50-150 (edit).
- Decoding: greedy, top_p 0.95, top_k 20, presence penalty 1.5 for t2i, 0 for edits. No thinking.
  Edit user message: the references first, then "Reference images follow in order (the first image,
  the second image, ...).\nUser request: ...\nOutput the caption."
- It does not refuse anything (BFL wrap it with an optional `--safety`). Our child-safety gate runs on
  the TYPED prompt; an in-graph upsampler writes after the gate. Check `docs/child-safety.md` covers
  in-graph enhance (`settleInGraphEnhance` exists) before shipping PUP.
- **Box modes write the box table themselves.** `t2i_bbox` PLANS boxes from a plain request;
  with user boxes, "the `*_bbox` prompts take the boxes as JSON after the request" and keep them
  exactly. `i2i_bbox` uses a RICHER row than `Flux3LayoutPrompt` emits: `{id, from, src_bbox, tgt_bbox, desc}`
  (moves and resizes carry both boxes; ids are class nouns `person_1`, `cup_2`, not `obj_N`). The
  exact scaffolds are `flux3/pup.py` and `flux3/bbox.py` in github.com/black-forest-labs/flux-3-image-klein:
  read them before building the Boxes payload.
- **Our Enhancer is the natural replacement:** its default backend is ComfyUI running
  `qwen3vl-abliterated-clip` (Qwen3-VL-4B), already installed with the engine (`docs/llm.md`), and it
  is the SAME weight we hope to reuse as Flux 3's text encoder. A `flux-3.recipe.js` built from BFL's
  four system prompts (`/create-enhancer-recipe`) costs users no download. Weak spot: our model recipes
  are text-only, and `i2i` wants to SEE the references (r2v describes staged pictures first, MPI-1084;
  the ComfyUI enhancer is VL, so passing the images may be possible).
- **Bench (same seed, same short prompts, t2i + edit + one box case):** (1) raw prompt, (2) PUP w4a8
  (6.7 GB), (3) Qwen3-VL-4B abliterated + BFL system prompt, (4) a Remote model + BFL system prompt.
  If (3) is close to (2), ship the recipe and no PUP. Fabio is downloading the w4a8 upsampler for (2).
- **The Klein copy's "Prompt Enhancement" group (`TextGenerate` behind `Input_enhance_prompt`) is
  dead in the app:** baked false, no UI sets it since MPI-677, only a raw `injectionParams` on
  `/connector/generate` reaches it, and `settleInGraphEnhance` (`js/services/llmService.js`) guards
  that door. The Enhance button runs its own graph with the model's recipe. Leave the group OUT of
  the Flux 3 graph unless PUP wins the bench; then it becomes the upsampler's slot. If not, PUP becomes an optional "best quality"
  download, never required (16 GB-RAM tester).

**Output size - 1K / 2K / 3K / 4K (Fabio, 2026-10-19).** FLUX.3 Klein generates up to 4K natively,
so the card gets four quality tiers, the way Qwen 2.1 / Krea 2 offer two: a new `type: 'flux3'`
with `qualityTiers: ['1k', '2k', '3k', '4k']` and a `ratios` table per tier
(`js/data/modelConstants/models.js`; Qwen 2.1's `['1k', '2k']` table is the template, every edge
/16 at least, /32 like Krea's grid). A new `type` means the type-consumer sweep (add-model playbook).
**Pin the real pixel ceiling on the bench first:** BFL's numbers seen so far are "2 MP default,
4 MP for ~2048 px", so "4K" may mean ~4 MP or a 4096 px edge (~16 MP) - measure what the model
actually holds before writing the 3k/4k rows. Big tiers on a small card get a warning, never a cap
([[project_the_users_gpu_is_the_limit]]). Edit output follows the reference unless the op is
taken off `imageSizedOps`, so decide whether the tier applies to edit too.

### 2. Ten reference images - our own node, the MpiH3References way

Core node: `ReferenceMultiLatent` ("Set Reference Multi Latent", `comfy_extras/nodes_edit_model.py`):
positive/negative/vae + an **Autogrow** `images` input (`image0`, `image1`, ... up to 100), resolution
`resize` + megapixels, outputs positive/negative/`empty_latent`. Autogrow cannot be pre-wired to 10 Mpi
loaders where some are empty: an empty `MpiLoadImage` sends the 1x1 sentinel, which core would take
as a real picture. Fabio's call: copy what `MpiH3References` (ComfyUi-MpiNodes `h3.py`) did -
**`MpiFlux3References`: 10 flat optional `ref_image_N` slots, empties (None or the 1x1 sentinel)
dropped, survivors handed to core's `ReferenceMultiLatent.execute` (delegate, never copy its maths)**.
The prompt cites references as `<ref_image_0>` (0-based, template example: "In <ref_image_0>, change
the dress color <obj_1> to red"), so like H3 the node must rewrite slot numbers to core's ordinals
once empties are dropped - or a tag points at the wrong picture. New node = `/mpi-nodes-sync`
(committed, pushed, pinned).

**BUILT 2026-10-19:** `MpiFlux3References` in ComfyUi-MpiNodes `flux3.py`, commit `3d00c16`
(local, NOT pushed until Fabio accepts it; pin bump waits for the 2.1 cut - `node_lock.json` is
held by the 2.1 release session). Slots are **0-based** `ref_image_0..9` to match FLUX 3's own
`<ref_image_0>` convention; takes `clip` + `prompt` (like the H3 node) because the tags must be
rewritten BEFORE encoding. Bare `ref_image_N` in an i2i layout table's `"from"` is renumbered too.
Headless bench test passed (bench Python, real core node + flux2-vae on CPU): 1x1 sentinel dropped,
a black image kept, tags renumbered. **Catch:** with no references core's `empty_latent` is a
4-channel SD latent - t2i must keep `EmptyFlux2LatentImage`. Not yet run inside the bench UI.

### 3. Boxes - a NEW operation, History workspace

- What the engine wants: core `CreateBoundingBoxes` (a canvas widget, ComfyUI frontend only) feeds
  `Flux3LayoutPrompt` (`comfy_extras/nodes_flux.py`, marked experimental). **That node only APPENDS
  TEXT**: `prompt + " " + json.dumps([{"id": "obj_1", "bbox": [ymin, xmin, ymax, xmax], "desc": "..."}, ...])`,
  bbox on a 0-1000 grid of the output frame (`_norm_bbox` in `nodes_bounding_boxes.py`). Colour
  palettes are ignored by FLUX.3 ("describe colours in the description"). Order: background first,
  foreground last.
- **So the app needs no box node at all:** our UI draws the boxes, the app builds that JSON and appends
  it to the prompt (or feeds `Flux3LayoutPrompt.element`). The paid template Fabio saw is
  `api_bfl_flux3_image_bboxes` (BFL cloud); the FREE local Klein templates already wire
  `CreateBoundingBoxes` -> `Flux3LayoutPrompt`. Bench that boxes really steer the LOCAL model first.
- UI (Fabio): draw several boxes, each its own border colour; move and resize them; each box has its
  own description; the prompt cites box N as `<obj_N>`; add / remove boxes from the prompt-box
  settings. Start from `MpiCanvasViewer`'s crop box (`getCropRect`/`setCropRect`, one movable,
  resizable box today) rather than a new canvas. Boxes are per-card History state, like a mask.
- MOSS-Image (MPI-1180) and Ideogram templates use the same box format
  (`image_moss_image_base_t2i_bboxes`), so build the op model-neutral: a model opts in by capability.
- **DECIDED (Fabio, 2026-10-19) - boxes are a prompt-box SETTINGS BUTTON, not an op or a Flow.** Visible
  only when the selected op supports boxes (t2i and edit on FLUX.3), else greyed out and disabled. It opens
  an overlay: RIGHT = big frame (blank at the chosen ratio for t2i, the source image for edit) where boxes
  are moved and resized; LEFT = list with "add box", each row = colour (= its border), a short prompt, a
  minus button. Store boxes normalised 0-1 + desc; each model's injection formats them (FLUX.3 0-1000
  yxyx appended JSON; MOSS absolute-centred layout JSON). Supersedes "a NEW operation" above.
- Box-capable models checked 2026-10-19: no installed model takes boxes (Qwen-Image 2.1 / Edit 2.1 have no
  box node, only prompt-text region advice). FLUX.3 = first. MOSS-Image = MPI-1180. Ideogram = trial
  board, undecided. Ming-Image-01 = dropped (Fabio checked it, did not like it).

### Bench now (no engine work needed)

Downloads go to **C:\AI** (G: has 9 GB free; the bench already maps `C:/AI/diffusion_models` and
`C:/AI/text_encoders` in `extra_model_paths.yaml`). Have: `flux2-vae`, `qwen3vl_4b_abliterated_fp8_scaled`.
Need: base int8 5.8 GB + distilled int8 5.8 GB, `qwen3vl_4b_int8_convrot` 4.9 GB only if the abliterated
TE fails, upsampler w4a8 6.7 GB only for the with/without comparison. C: had 46 GB free on 2026-10-19.

### 2.1.1 Pod smoke scope

No engine bump, so not a full smoke: FLUX.3's ops only, plus whatever else the MpiNodes pin bump for
`MpiFlux3References` touches (check the smoke-scope rule in `docs/playbooks/bump-engine/` at the
time). If the pin bump forces more, an app-side alternative is dropping empty `images.imageN` inputs
from the API prompt before submit (no node) - only if the injection rules allow it.

### Structure control (depth / pose / canny) - checked 2026-10-19

- **None from BFL.** Blog, repo README and ComfyUI's 9 FLUX.3 templates name only t2i, edit (10 refs)
  and bounding boxes. No depth/canny/pose ControlNet or Control-LoRA, none announced.
- **None from the community yet** (Hugging Face search, 4 days after release): quants, GGUFs, a PUP
  abliteration, style and restore/consistency LoRAs, no control model. CivitAI not checked (region-blocked).
- **Route to bench:** a depth map as an ordinary reference image ("follow the depth of <ref_image_0>"),
  the way FLUX.2 Klein worked before its refcontrol LoRA (MPI-354). Our Klein 4B refcontrol LoRA does
  NOT port (different model). Boxes cover layout, not pose.
- A vendor blog (kie.ai) reports pose edits weaker than FLUX.2 Klein 4B; unverified, maybe run without PUP.

### Distilled sampler settings - checked 2026-10-19

BFL HF card: 16 steps, guidance none, no sampler named. docs.comfy.org: distilled 4-16 steps (16 default),
CFG 1 fixed ("raising cfg does not help"); base t2i 50 / CFG 3.5, base edit 50 / CFG 1. Template JSONs:
distilled t2i 15 / er_sde / simple, distilled edit 16 / euler / simple. **Fabio's bench templates (0.42.1,
authoritative over the GitHub main JSON, whose base t2i read 15 / er_sde / 1): base edit 50 / CFG 1 / euler /
simple; distilled edit 16 / CFG 1, rest same; base t2i 50 / CFG 3.5.** Community (earngenix): 15 steps, res_2s_ode +
bong_tangent (RES4LYF). Bench: euler/simple vs er_sde vs res_2s_ode, 8 vs 16 steps.

**Bench 2026-10-19, base t2i, 50 steps euler/simple, same seed, 1088x896, long BFL-style prompt:** CFG 3.5
follows the prompt clearly better (orange lamp band, wooden frame, droplets, true profile with the far eye
hidden, deep shadow side); CFG 1.0 is softer and more filmic but drops prompt detail and showed a far-eye
artefact. Keep 3.5 for base t2i (costs 2x per step). First run looked CFG-insensitive only because Fabio's
graph fed the POSITIVE text into the base negative encoder (#751/#695) - fixed by him; check on hand-back.
**Turbo (distilled), same prompt/seed:** CFG 1.0 holds the prompt nearly as well as base 3.5, with the oily
sheen on forehead/nose the video warned about; CFG 3.5 overcooks it (oilier, harsher contrast, skin aged,
deeper creases) and doubles the time. Turbo locks CFG 1 - matches the docs ("raising cfg does not help").
**Turbo CFG 1, er_sde vs euler (simple, 16 steps):** er_sde cuts most of the oily sheen (drier skin, real
pores and freckles, more photographic split lighting, cooler mixed bokeh); euler keeps more literal prompt
detail (wooden frame - er_sde made it pale/metal) and one stray bright bokeh shape showed in er_sde. Pick:
er_sde for Turbo t2i (= the official distilled t2i template), euler for edits.
**Base CFG 3.5, er_sde vs euler (50 steps):** er_sde = more cinematic and textured (pores, peach fuzz,
flyaway hairs, cool window key + orange lamp split) but bends the lighting brief (blue lands on the near
side) and crushes the lower-right shadow; euler = literal and clean (warm band, wooden frame), slightly
"graded". Prompt-adherence scorecard (14 prompt items): euler wins the lighting plan (orange band across
cheekbone/nose/lip), hair tucked behind the ear, wooden frame; er_sde wins age (late 20s), vellus hair,
amber bokeh, film grain; rest tied - a near tie, euler ahead only on lighting placement.
**DECIDED (Fabio, 2026-10-19): er_sde for every t2i (base + Turbo), euler for edits.**
**Speed, 1088x896 t2i, er_sde, Fabio's GPU (bench asset panel):** base 50 steps CFG 3.5 = 42.4 s; Turbo
16 steps CFG 1 = 9.4 s (~4.5x faster).
**img2img (photo -> anime, base 50 steps, 768x1376, same seed, temp 00016-00022):** beta pushes the style
much further than simple at the same denoise (beta front-loads high-noise steps). er_sde beta 0.7 (#19) = only
fully-anime result, clean cel look, Fabio's favourite - but it slimmed her figure and moved the bottle (identity
drift); every 0.6 run (any sampler/scheduler) stays half-photo. Candidate: er_sde + beta for img2img, denoise
~0.65-0.7; beta not yet tried on plain t2i.
**t2i beta vs simple (base, 768x1376, temp 00023/00024):** simple keeps more face detail and is less crushed;
beta darker. **DECIDED (Fabio, 2026-10-19): scheduler = beta for img2img only, simple for t2i and edit.**
Settings table: t2i er_sde/simple (base 50/CFG 3.5, Turbo 16/CFG 1); img2img er_sde/beta, denoise ~0.65-0.7;
edit euler/simple (base 50, Turbo 16, CFG 1).
**Edit bench (recolour tank top to burgundy, BFL-upsampler-style prompt, MpiFlux3References in the loop):**
clean bounded edit - rib texture, straps, folds kept; face, hands, bottle, jeans, background, even the
watermark untouched. Asset panel times 93.2 s and 48.2 s at 571x1021 (which run was base vs Turbo, and
whether a model load is inside, not yet confirmed).
**Masked edit (InpaintCropImproved crop -> 1024x1024, recolour to emerald, stitch back):** clean - no sleeve
on the grown mask, hand/cigarette/chin kept, no visible seam, output stays at the source 571x1021.
89.1 s (crop 1024x1024).
**Inpaint (LanPaint KSampler, add a dog):** first run fed `SetLatentNoiseMask.samples` from
`MpiFlux3References.empty_latent` (blank) -> dog on a grey plate + halo after stitch; fix = VAEEncode of the
crop (ref_image_0) into `samples`, references stay on the conditioning. FluxGuidance in that branch is a
FLUX.1/2 leftover (no FLUX.3 template uses it). LanPaint_NumSteps 2 = 237 s; Fabio retrying at 1.
Edit cannot replace inpaint (the model does not see the mask, so it may place new content outside it).
Idea to bench: inpaint = edit + a box auto-derived from the mask's bounds (`<obj_1>` tells it WHERE) +
crop/stitch (keeps the rest) - would drop LanPaint. Boxes work for t2i AND edit.
**DECIDED (Fabio, 2026-10-19): inpaint STAYS on LanPaint** (VAEEncode of crop as the latent). Open: LanPaint_NumSteps
per mode - Fabio's hypothesis: base works at 1, Turbo may need more. Fabio still to bench: detailing, upscaling.
**DECIDED (Fabio, 2026-10-19): LanPaint_NumSteps = 1 for base AND Turbo** - both add the dog cleanly at 571x1021
(no grey plate, no seam). Turbo 41 s, base 174 s (base at NumSteps 2 was 237 s).
**Detailing: done (Fabio, 2026-10-19).** Upscaling: Fabio benching approaches; he hands back the full workflow
for the raw folder when done. **Box bench SKIPPED (Fabio, 2026-10-19):** boxes are prompt text only, so no
pre-build bench - verify they steer during the app test instead.
**Upscale bench 2026-10-19 (temp pcqmf_00076/77, photo input, 1.5x -> 2304x1536, 1x1 grid):** UltimateSDUpscale
euler/simple, steps `8 if turbo else 15`, denoise 0.3, `4x_NMKD-Siax_200k`, EMPTY prompt, negative =
ConditioningZeroOut. Fabio: plastic phone, worse eyes and mouth - 0.3 degrades instead of improving; CFG 3.5 ~= 1.0.
Read: (1) base at 15 steps x 0.3 = ~4-5 real steps, base wants 50 -> under-sampled mush; (2) empty prompt vs
zeroed negative gives CFG nothing to push on (why 3.5 = 1.0) -> lock CFG 1 for upscale; (3) Siax smooths skin.
Refs-as-conditioning per tile: too slow, dropped (Fabio). Bench next: steps first (base 50 @0.3, Turbo 16 @0.3),
then a prompt (the card's own prompt; generic texture line for imports), then the upscaler model (bench has
ClearRealityV1 / Remacri / Nomos8kDAT; app ships only Siax + AnimeSharp - a new one = new dep).
**DECIDED (Fabio, 2026-10-19): upscale + detailer CFG = base 3.5 when the prompt has text, 1.0 when empty;
Turbo always 1.0.** CFG != 1 runs the negative pass every step (~2x time) even on an empty prompt. Graph
already has `MpiAnyChecker` on `Input_Positive` (node 374) to key it on - check on hand-back.
**Upscale steps 15 vs 40 (base, CFG 3.5, denoise 0.3): no visible difference** - the under-sampling read was
wrong; keep 15 (Fabio). Plastic look comes from elsewhere: next isolate the Siax stage (its output with no
sampling vs the source) and swap the upscaler model at the same settings.
**DECIDED (Fabio, 2026-10-19): EVERY FLUX.3 op's prompt goes through the BFL upsampler rules first** - t2i,
edit, inpaint, detail, upscale (`research/bfl_pup_system_prompts.json`: t2i / i2i / t2i_bbox / i2i_bbox).
Without it results are really bad. How the app does it (local PUP weight in the graph, the Enhancer recipe,
or Cosmo) = open, decide before wiring. Upscale rerun: base 15 steps CFG 3.5 + a PUP-t2i-style caption.
Result: prompt helped a little (catchlights in the eyes, glints in the phone lenses - both named in the caption;
skin still smooth). Fabio: likely needs more denoise; er_sde on upscale was worse than euler (tried earlier).
Next: tile upscaler (preferred over grid - no seams), run WITHOUT a prompt (per-tile prompt would lie);
after that upscale is as good as it gets. **DECIDED (Fabio, 2026-10-19): tile upscale = no prompt, CFG 1.0
always** (base and Turbo).
**Tile run (temp frpkh_00055):** `ImageScaleBy` LANCZOS 1.5x (no upscale model in this path) -> `ImpactMakeTileSEGS`
(bbox 1024, crop 1.5, overlap 200) -> `DetailerForEachPipe` (guide 1024, max 1536, euler/simple, CFG 1, denoise 0.3,
15 steps, force_inpaint). Fabio: not very good. Read: it REDRAWS - phone camera bump re-laid-out, bigger flash, eyes
rounder, brows reshaped, warmer beauty makeup = identity drift, so 0.3 is already too much here, not too little.
Fabio trying 25 steps. **Result: 25 = 15, identity drift confirmed vs the original** (single-pass stays closest).
Tile math at 2304x1536, bbox 1024, min_overlap 200 = 3x2 = 6 tiles, overlap 384 px across, 512 px down; the face
sits whole inside one tile but 3-4 overlapping tiles each re-denoise it in turn (DetailerForEach pastes each
tile back before the next - likely compounding the 0.3). More tiles = more re-passes = more drift.
Fabio watched it run: one tile holds only HALF her face and re-draws it - the identity loss. More denoise =
sharper but more drift; the single pass drifts too at 0.3. **DECIDED (Fabio, 2026-10-19): upscale stays as
benched - this is what the model can do.** Last bench: upscale with Turbo (distilled), then hand-back.
**Turbo tile upscale: bad** (Fabio) - a different woman: heavier jaw, reshaped eyes, older, harsher oily contrast.
**Turbo SINGLE-PASS upscale: best identity of every upscale run** (Fabio, 2026-10-19). Upscale bench closed.
Next phase: Fabio hands back `flux3.json` -> copy to `comfy_workflows/raw/`, run the hand-back checks, wire.
**Next session topic - boxes for TEXT-TO-IMAGE:** edit-with-boxes already has a home (History workspace op,
section 3 above); t2i has none. Discuss: a Flow for it? which installed models already take boxes (Fabio thinks
none; unsure about Qwen-Image(-Edit) 2.1 - check), MOSS-Image (MPI-1180) and Ideogram share the format.

### Hand-back 2026-10-19 - `comfy_workflows/raw/flux3_t2i_template.json`

Byte copy of Fabio's bench `flux3.json` (`cmp` identical; 293 nodes). Named like `krea2_t2i_template.json`
so it routes to a generator; no `HANDLERS` prefix collision (`klein_` does not match `flux3_`).
Checks: both base negative encoders (#751 t2i, #695 edit) read `Get_negative text` - OK. Turbo picks
UNET (#689), steps 16/50 (#733), cfg 1/3.5 (#754) - OK. CFG rule on detailer (#791) and single-pass upscale
(#792) keyed on `MpiAnyChecker` of the prompt - OK. No FluxGuidance - OK. LanPaint latent = VAEEncode (#770)
of the crop, NumSteps 1, mask via bypassed MaskPreview #598 (converter forwards bypass) - OK. Samplers: t2i
er_sde/simple, i2i er_sde/beta, edit euler/simple - OK. Upscale default = single pass (`Input_Tile_Upscale`
false) - OK. **Answered (Fabio, 2026-10-19): the graph is correct as wired.** CFG is right for every op
(the settings table above is wrong where it differs - e.g. base edit runs at `Get_cfg` 3.5); Turbo is NOT
forced on upscale (the user's button decides). Generator/sync concerns only: tile path #681 still encodes the
prompt (CFG 1, so harmless), `Input_is_Turbo` baked true, `Input_Image` bakes a bench filename.
**Tiers (Fabio, 2026-10-19): 1K / 2K / 4K, 1K = base**, built the way other 1K/2K models do it; community
practice is base-resolution input + a megapixel control to go up.
How the app does it today: a static `ratios` table per tier in `models.js` (Qwen 2.1 / Krea 2: `1k` ~1 MP,
1:1 1024; `2k` long edge ~1920, 1:1 1472, every edge /32), injected as `Input_Width`/`Input_Height`. Plan:
copy that table for `1k`/`2k`, and **`4k` = the `2k` table x2 per edge** (16:9 3840x2176, 1:1 2944, ~8.4 MP;
exact ratios, every edge /64) - the megapixel step, no graph change. 8.4 MP is past BFL's stated 4 MP:
one 4k t2i on the bench decides whether the row ships as-is.
**4k bench 2026-10-19 (Turbo t2i, 3840x2176, seed 424242, er_sde 16 steps, 130 s wall, no OOM):** coherent at
8.4 MP - no doubled subjects or tiling, legible "MERCEARIA" sign, clean face/hands at 1:1, real tile/cobble
texture. Small flaws: one extra copy of the sign further up the street, hair ends slightly painterly.
**Base, same prompt/seed (50 steps, CFG 3.5, er_sde): 681 s** on Fabio's 4060 Ti, held at ~12 GB dedicated +
4.4 GB shared (dynamic VRAM spill - the app's engine behaves the same: `--lowvram` is inert under dynamic VRAM,
`routes/comfy.js` `_cudaModeArgs`). Coherent at 8.4 MP, one sign only, natural skin with pores and no oily
sheen, more of the prompt's "ordinary specifics" (crate, peel in the gutter, parking sign). 4k = 2k x2 holds
for both checkpoints; the cost is time (~11 min base on a 16 GB card).
**DECIDED (Fabio, 2026-10-19): ship `qualityTiers: ['1k', '2k', '4k']`; 1k/2k = the Qwen 2.1 table, 4k = 2k x2
per edge, for Turbo and base alike.** Big-tier time goes in a hint/warning, never a cap.
Fabio's verdict on the 4k base render: impressive for a 5B open model, below the launch hype; far buildings
and signs still want a detail pass.
Pinned: MpiNodes 3d00c16 pushed + pinned (`b6dabd2e1`, 2026-10-19). 2.1.1 already shipped (MPI-1044 closed),
so FLUX.3 lands in the NEXT release.

**Custom size (Fabio, 2026-10-19):** FLUX.3 can set an edit's output size. Graph: `Input_custom_size` ->
#798 `custom size AND NOT has_mask` -> #703 picks `EmptyFlux2LatentImage(W,H)` over the references'
`empty_latent`. App: turn `Input_custom_size` on for every UNMASKED edit (single or multi-reference) and show
the ratio + resolution picker there, so the user picks the frame instead of inheriting image 1's. Masked
edit / inpaint keep the source size (crop + stitch). t2i and img2img get ratio + resolution like every model.
Resolution tiers: **2K and 4K required** (Fabio) - real 4K ceiling still unmeasured.

**DECIDED (Fabio, 2026-10-19): upsampler = option A, an Enhancer recipe that runs AUTOMATICALLY before
every FLUX.3 run** on the installed `qwen3vl-abliterated` (no PUP download, no in-graph TextGenerate).
**It must carry the box prompts too (Fabio):** four system prompts, picked per run - no boxes: `t2i` /
`i2i`; user boxes drawn: `t2i_bbox` / `i2i_bbox`, the boxes sent as JSON after the request and kept
exactly. The `*_bbox` output already ends in the element table, so the app sends it as the prompt as-is
(no `Flux3LayoutPrompt`). `i2i_bbox` rows are `{id, from, src_bbox, tgt_bbox, desc}` with class-noun ids
(`person_1`), not `Flux3LayoutPrompt`'s `obj_N` - build the box payload from `flux3/bbox.py`. BFL's PUP repo
is Apache 2.0, so the prompts can ship verbatim (unlike Qwen's).
What exists vs what A needs (checked 2026-10-19):
- Recipe modes are `t2v`/`i2v`/`r2v` only; four BFL prompts + a box switch need a recipe-format or
  enhancer extension (the registry says "never an enhancer code change" - this is the exception, say so).
- **Edit ops never enhance today** (`ENHANCE_EXEMPT_OPS`, `js/data/commandRegistry.js:1841`); FLUX.3 edit
  must be let through (per model, not globally).
- The enhancer is TEXT-only; `i2i`/`i2i_bbox` want to SEE the references. Nearest path: MPI-1084's r2v
  describe-first (`llmService.js` ~1196); better: send the images to the VL engine directly.
- Auto-run: Flows already auto-enhance (`flowEnhance.js` `autoEnhanceDecl`, `MpiBaseFlow._autoEnhance`);
  the prompt box has no equivalent - new, and it must show itself (queue row / status) per the
  "every action shows itself" rule.
- Ops: t2i, img2img, edit, inpaint, detail, single-pass upscale through the rules; tile upscale stays
  prompt-less. Child-safety gate must see the UPSAMPLED text, not only the typed one.
- Decoding per BFL: greedy, top_p 0.95, top_k 20, presence penalty 1.5 t2i / 0 edit, no thinking;
  "TARGET CANVAS: W:H" first line when the ratio is known.

## Noticed

- 2026-10-19 (Fabio, future): a tile-upscaler FLOW that describes each tile with its own prompt - separate from
  this card's prompt-less tile upscale.
