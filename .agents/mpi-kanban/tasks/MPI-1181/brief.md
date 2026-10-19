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
