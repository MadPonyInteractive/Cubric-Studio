// ── Model Definitions ─────────────────────────────────────────────────────────
/**
 * @typedef {Object} ModelDef
 * @property {string}   id           - Unique identifier
 * @property {string}   name         - Display name
 * @property {string}   [dropdownMeta] - Short UI category shown in compact model selectors
 * @property {string}   [type]       - Model family (e.g. 'sdxl', 'wan'); also the default enhancer-recipe key
 * @property {string}   [enhanceRecipe] - Explicit enhancer-recipe id, overriding `type` when they diverge. Both keys are read by `resolveRecipe()` in `js/data/recipes/registry.js` — the LOCAL recipe index (MPI-35, MPI-677). They used to name a recipe inside the sibling Cubric Prompt app (MPI-5); the recipes moved here, so the keys kept their values and changed their address.
 * @property {'deepinfra'} [provider] - CLOUD model (MPI-851). Its presence is the whole discriminator: a model with a `provider` has no weights, no ComfyUI graph and no engine — it runs on the user's own API key at the provider, who bills them directly. It MUST declare no `dependencies`, `commonDeps`, `operations`, `workflows`, `engines` or `variants`: the dep resolver, the orphan sweep and the install UI all key on those, and an empty `dependencies: []` reads as INSTALLED by accident in two places (`resolveModelDeps.js` `[].every()`, `routes/comfy.js` `allPresent`). "Installed" for these means A KEY IS SAVED — see `hasCloudKey()` in modelRegistry.js, which `isModelUsable`/`isOperationInstalled` answer from before they ever consult the dep cache. Dispatch branches at `generationService.js`'s `runCommand` call and never reaches ComfyUI.
 * @property {{endpointId:string, body?:Record<string,*>, imageField?:string}} [cloud] - The provider-side call this model makes. `endpointId` is the provider's own model id (`black-forest-labs/FLUX-1-schnell`), which is ALSO the key `dev_configs/deepinfra-prices.json` prices it under — the two must stay equal or the estimate silently describes another model. `body` is constant fields merged into every request (leave a field out to take the provider's own default; DeepInfra's default step count is what its published price assumes). `imageField` names the body field a reference image goes in, for edit ops.
 * @property {'image'|'video'} mediaType
 * @property {'low'|'balanced'|'high'} [sizeTier] - Weight-size tier (MPI-168). Shown as a Low/Balanced/High badge + L/B/H marker. A model has ONE tier; siblings ship as separate cards. Absent → treated as 'balanced' by UI.
 * @property {string}   [modelFamily] - Soft grouping key for same-base-model tier variants, e.g. 'LTX-2.3' (MPI-168). Drives tier clustering + the "show L/B/H only when 2+ tiers of a family installed" rule. UI-only; no resolver effect.
 * @property {boolean}  [featured]   - Editorial spotlight flag for the Model Library ("hot / new / best right now"). Featured models sort FIRST within their sub-grid (stable) and carry a gold sparkle star badge. Purely a curation signal — set as many as you like, add/remove freely; no cap, no resolver effect. Consumed only by MpiModelManager (sort) + MpiTileSheet (the `.mpi-tile__flag--featured` badge). See also [deprecated] below.
 * @property {boolean}  [deprecated] - Editorial sunset flag, the mirror of `featured` (MPI-514): the model is on its way OUT of the Model Library and users should stop investing in it. Renders a warning badge in the same tile slot as the star, with the same hover explainer. Purely a curation signal, no resolver effect and no sort effect. NOT the same field as the `deprecated` flag on OPERATIONS in operationRegistry.js, which is a history-compatibility marker and invisible to users. Set it when a removal card exists; delete it with the ModelDef on the release that removes the model.
 * @property {{multiStage?:boolean, audio?:boolean, negativePrompt?:boolean, styleLoras?:boolean, tierSelect?:boolean}} [capabilities] - Drives capability-gated UI on SHARED ops: multiStage shows the previewStage toggle; audio shows the audio media slot; styleLoras shows the style picker + Stylization slider; tierSelect shows the runtime speed/quality tier radio (Qwen-Image-Edit's qwenTier → Input_Tier, MPI-300) for models whose tiers share one weight set instead of shipping as sibling cards. Absent → false. EXCEPTION: negativePrompt defaults to TRUE when absent (a model supports negatives unless it opts out) — set `negativePrompt: false` for distilled cfg-1.0 models (Krea2-Turbo) where the negative prompt has no effect and NAG cannot rescue it. Hides the prompt box's positive/negative toggle; the stored negativePrompt value is still persisted. THERE IS NO `promptEnhance` FLAG ANY MORE (MPI-728, 2026-09-12): MPI-677 deleted the in-workflow toggle and re-pointed the flag at ComfyUI-backend eligibility, and this card deleted that too. The standalone enhancer graph carries its OWN `CLIPLoader` — proven by running it on an idle bench with no generation model loaded at all — so the ComfyUI enhance backend is offered on EVERY model. The flag's surviving reading, "the enhance costs no extra VRAM here", was measured TRUE on krea2/krea2-nsfw (same encoder file AND same CLIP type, so ComfyUI's cache hits) and FALSE on klein-4b/klein-9b (`qwen_3_4b` / `qwen_3_8b_int8_convrot`, type `flux2` — a different weight AND a different cache key). SINCE 2026-09-13 THE KLEIN HALF IS TRUE TOO, with no flag: the enhance borrows the generation model's own encoder wherever it can generate, derived from the workflow's CLIPLoader as this note asked (`enhancerClipParams` in `js/services/llmService.js`). Do not re-add a hand-set boolean for it.
 * @property {string[]} [styleLoraLabels] - Style-LoRA display names, index-aligned with the workflow's MpiMath gates and MpiPromptList trigger lines. Index 0 must be the no-style entry (every gate zeroed); its label is free text. Required when `capabilities.styleLoras` is true.
 * @property {string[]} [styleLoraImages] - Style card images for the picker, filenames in comfy_workflows/display/, INDEX-ALIGNED with styleLoraLabels. Index 0 is the no-style baseline (the same prompt with the rack off) — ship every card from the SAME prompt so the grid reads as a comparison. Optional: a missing entry (or the whole array) renders a placeholder card, so a model can ship styles before its art exists. See docs/playbooks/add-model/05-prompt-and-styles.md §9.
 * @property {Record<string, Array<{label:string,w:number,h:number,icon:string}>>} [ratios] - Per-type ratio table (MPI-174), keyed by quality tier (quality-mode models) or 'portrait'/'landscape' (orientation-mode). First model declaring it for a NEW `type` wins; existing types (flux/sdxl/wan/wan5b/ltx) keep their built-in tables in js/utils/ratios.js — do not redeclare them here.
 * @property {string[]} [qualityTiers] - Ordered quality-tier ids for a NEW `type` (MPI-174), e.g. ['low','medium','high']. Presence ⇒ quality UI mode (tier radio); absent + `ratios` present ⇒ orientation mode. Consumed via qualityTiersFor() in js/utils/ratios.js and the v3 project migration.
 * @property {Record<string, Object>} [opInject] - Per-OP constant workflow params THIS model always injects, keyed by operation id then node title (MPI-354). For a model whose ops are branches of ONE master graph selected by a value private to that model — FLUX.2 Klein maps each op to an `Input_wf_type` int, a numbering no shared op could own. Merged in commandExecutor._buildParams AFTER the op's own `injectParams` and BEFORE the user's controls. A model that declares this MUST cover every op in `supportedOps`: a missing entry does not error, it runs the graph's default branch and returns the wrong operation's output, so the executor warns on a gap. Prefer the op's `injectParams` when the constant is a property of the OP rather than of this model.
 * @property {string[]} [styleOps] - Operations where this model's style rack is live (MPI-354). REQUIRED for any model with `capabilities.styleLoras` — the old DEFAULT_STYLE_OPS fallback was deleted in MPI-365 once all six style models declared their own, so an undeclared model now shows no rack anywhere (loud and one line to fix, rather than silently inheriting a reach wrong for its graph). Only consulted when `capabilities.styleLoras` is true; the op's `components` still decides whether the control exists at all.
 * @property {string[]} [imageSizedOps] - Operations whose OUTPUT SHAPE comes from the input image rather than from `Input_Width`/`Input_Height` (MPI-354) — typically because the graph scales the input to a megapixel target. The ratio picker is hidden on these ops (see modelShowsRatio in commandRegistry.js); everything else about them is unchanged. Defaults to none, so every model that does not declare it keeps the picker on every op exactly as before. This is a property of the MODEL's graph, not of the op: every model's `control` now derives its size from the input, but each does so through a different node and SDXL's did NOT until the MPI-365 master template swapped its ControlNet branch onto ImageScaleToTotalPixels. VERIFY IN THE GRAPH, never from the op name — Chroma's depth was mis-declared for exactly that reason until 2026-08-02, and the symptom was a padded gallery card, not an error.
 * @property {Record<string, *>} [controlDefaults] - Per-MODEL starting values for PromptBox controls, keyed by control id (MPI-365) — e.g. `{ stylization: 0.6 }`. Resolved in PromptBoxControls._resolveDefault AFTER an op default and BEFORE the global PROMPT_CONTROL_DEFAULTS, so an op-specific default still wins and every undeclared model is unaffected. Use this when the right starting value is a property of the MODEL's weights rather than of the op: a heavily distilled checkpoint whose style LoRAs artefact at full strength wants one number across its whole rack, which an op default (shared by every model running that op) cannot express. This sets only the STARTING value; where an edited value is stored is still the control's `scope`.
 * @property {string[]} [controlTypes] - Which structures this model's `control` op can copy, as CONTROL_TYPES ids, in PICKER ORDER (MPI-365). The value injected into `Input_Control_Net` comes from CONTROL_TYPES in commandRegistry.js, NOT from this list's order, so display order is free — SDXL lists depth first while its graph numbers pose first. A list of ONE (Klein/Krea2/Chroma, depth-only) hides the picker entirely, which is correct: those graphs have no `Input_Control_Net` node to switch. Declaring a type the graph cannot run is the silent failure this field exists to prevent — the switch falls through to its baked branch and returns a plausible image made the wrong way, so VERIFY against the graph's own Control note before adding one.
 * @property {string[]} [batchOps] - Operations where the batch control is REAL (MPI-365). `Input_Batch_Size` reaches only `EmptyLatentImage` in every graph we ship, so an op sampling a VAE-encoded latent silently returns one image while the control claims N. Defaults to every op, so a model that stays silent behaves exactly as before. Distinct from `capabilities.batch: false`, which is the model-WIDE off switch — use that when batch works nowhere (Krea2/Klein/Qwen), and this when it works on some ops and not others (Chroma `['t2i']`, SDXL `['t2i']` since the master template). See modelShowsBatch in commandRegistry.js.
 * @property {string}   [image]      - Preview still filename in comfy_workflows/display/ (image models)
 * @property {string}   [video]      - Preview clip filename in comfy_workflows/display/; card plays it muted+looping on hover (video models)
 * @property {string}   [defaultUpscale]  - Dep id of the default upscale model for this model (image models only)
 * @property {string[]} supportedOps - Operation keys from commandRegistry.js
 * @property {Record<string,string>} workflows - op key → workflow filename
 * @property {string[]} [dependencies] - Flat dep ids (models whose ops are NOT separably installable). Treated as commonDeps with no operations by the resolver.
 * @property {string[]} [commonDeps] - Always-required dep ids (operations-keyed models only): VAE, encoder, shared nodes.
 * @property {Record<string,{deps:string[]}>} [operations] - Per-operation unique dep ids (operations-keyed models only). Resolved into a flat list by resolveModelDeps.js before download.
 * @property {boolean}  installed    - Resolved at runtime by syncModelInstalled(); not set here
 */

// ── Cloud ratio aspect sets (MPI-853) ────────────────────────────────────────
// The generators that turn these into tables are `_cloudRatios` / `_cloudVideoRatios`,
// under the array. These lists must sit ABOVE it: `const` has no usable hoist, so
// declaring them below would throw on the first cloud model that reads one.

/** Portrait and landscape sets, INDEX-MIRRORED — the ratio flip maps by index, so the
 *  two lists must stay the same length and the same order. See FLUX_RATIOS' note. */
const IMG_PORTRAIT = ['1:1', '3:4', '4:5', '9:16'];
const IMG_LANDSCAPE = ['1:1', '4:3', '5:4', '16:9'];

/** Seedream takes free pixels, so one flat list per tier covers both orientations —
 *  the shape WAN_RATIOS already uses for a quality-tier model. */
const SEEDREAM_ASPECTS = ['1:1', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];

/** Straight from each model's own `aspect_ratio` / `ratio` enum, minus 'adaptive'
 *  (a policy, not a shape) and minus any label with no icon. Wan offers no 21:9. */
const SEEDANCE_ASPECTS = ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9'];
const WAN3_ASPECTS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const VEO_ASPECTS = ['9:16', '16:9'];

/** @type {ModelDef[]} */
export const MODELS = [
    {
        id: 'sdxl-realistic',
        sizeTier: 'low',
        name: 'SDXL Realistic',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        defaultUpscale: '4x-NMKD-Siax',
        image: 'sdxl-real-01.webp',
        type: 'sdxl',
        supportedOps: ['t2i', 'i2i', 'control', 'inpaint', 'upscale', 'detail'],
        // Batch multiplies EmptyLatentImage only, and t2i is now the ONLY branch that
        // samples it. This CHANGED with the master template (MPI-365): the old graph
        // gated depth with Input_depth_reference and kept the empty latent; control now
        // VAE-encodes the input (KSampler.latent_image <- MpiAnySwitch on wf_type,
        // any_3 = VAEEncode), so a batch > 1 there would claim N and return one.
        batchOps: ['t2i'],
        // Same graph change, same class of lie on the other axis: control scales the
        // INPUT image to a megapixel target (ImageScaleToTotalPixels) instead of reading
        // Input_Width/Height, so the ratio picker cannot describe its output. i2i still
        // resizes to our dimensions (ImageResizeKJv2) and keeps the picker.
        imageSizedOps: ['control', 'detail', 'upscale'],
        // SDXL is the only model whose control switch offers more than depth: ONE
        // ControlNet-Union checkpoint behind four SetUnionControlNetType nodes and four
        // AIO_Preprocessor annotators, both switched by Input_Control_Net.
        controlTypes: ['depth', 'pose', 'scribble', 'canny'],
        // Input_Control_strength -> MpiNormalizeValue -> ControlNetApplyAdvanced.strength.
        capabilities: { controlStrength: true },
        // Op -> the Input_wf_type value selecting its branch. MUST cover every entry in
        // supportedOps: a gap does not error, it runs the graph default and returns a
        // plausible image from the WRONG op. Slot 5 stopped being dead with the MPI-615
        // re-export — it is a LanPaint inpaint branch now. 4 is still unused here, kept
        // numbered to match Klein/Krea2/Chroma.
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            inpaint: { Input_wf_type: 5 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        gen_speed: 'fast',
        description: 'This image generator uses the famous Juggernaut XL model as its base. It can create different styles but is best suited for realistic images.',
        workflows: {
            // MPI-365: ONE file for all five ops — the branch is chosen by opInject's
            // Input_wf_type and lazy evaluation prunes the rest at run time. The old
            // upscaler_sdxl_realistic.json / detailer_sdxl_realistic.json are deleted.
            t2i:     't2i_sdxl_realistic.json',
            i2i:     't2i_sdxl_realistic.json',
            control: 't2i_sdxl_realistic.json',
            inpaint: 't2i_sdxl_realistic.json',
            upscale: 't2i_sdxl_realistic.json',
            detail:  't2i_sdxl_realistic.json',
        },
        dependencies: [
            'sdxl-realistic',
            '4x-NMKD-Siax',
            'controlnet-union-sdxl',   // the ONE ControlNet behind all four control types
            'ComfyUI-MpiNodes',
            'ComfyUI-UltimateSDUpscale',
            // MPI-365: MaskDetailerPipe/To-FromBasicPipe were always needed by the detail
            // op and were never declared — latent until the master template made every
            // node submit-validated on EVERY run, which turns the gap fatal.
            'ComfyUI-Impact-Pack',
            'comfyui-kjnodes',          // ImageResizeKJv2 — the i2i resize
            // AIO_Preprocessor x4: DepthAnythingV2 / Openpose / Scribble / CannyEdge.
            // Canny and Scribble are weightless filters; OpenPose auto-downloads its
            // body/hand/face annotators on first use, DepthAnythingV2 its own.
            'comfyui_controlnet_aux',
            // MPI-615, the inpaint branch (wf_type 5): a square-bbox crop around the
            // mask, LanPaint over the crop, stitched back. Both packs are custom_nodes,
            // so the engine installs them either way — declared so the graph's needs are
            // readable here and the uninstall sweep never strands them.
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved
            'LanPaint',                      // LanPaint_KSampler — mask-conditioned sampling
        ],
    },
    {
        id: 'sdxl-nsfw',
        sizeTier: 'low',
        name: 'SDXL NSFW',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        defaultUpscale: '4x-NMKD-Siax',
        image: 'sdxl-real-05.webp',
        type: 'sdxl',
        supportedOps: ['t2i', 'i2i', 'control', 'inpaint', 'upscale', 'detail'],
        // Batch multiplies EmptyLatentImage only, and t2i is now the ONLY branch that
        // samples it. This CHANGED with the master template (MPI-365): the old graph
        // gated depth with Input_depth_reference and kept the empty latent; control now
        // VAE-encodes the input (KSampler.latent_image <- MpiAnySwitch on wf_type,
        // any_3 = VAEEncode), so a batch > 1 there would claim N and return one.
        batchOps: ['t2i'],
        // Same graph change, same class of lie on the other axis: control scales the
        // INPUT image to a megapixel target (ImageScaleToTotalPixels) instead of reading
        // Input_Width/Height, so the ratio picker cannot describe its output. i2i still
        // resizes to our dimensions (ImageResizeKJv2) and keeps the picker.
        imageSizedOps: ['control', 'detail', 'upscale'],
        // SDXL is the only model whose control switch offers more than depth: ONE
        // ControlNet-Union checkpoint behind four SetUnionControlNetType nodes and four
        // AIO_Preprocessor annotators, both switched by Input_Control_Net.
        controlTypes: ['depth', 'pose', 'scribble', 'canny'],
        // Input_Control_strength -> MpiNormalizeValue -> ControlNetApplyAdvanced.strength.
        capabilities: { controlStrength: true },
        // Op -> the Input_wf_type value selecting its branch. MUST cover every entry in
        // supportedOps: a gap does not error, it runs the graph default and returns a
        // plausible image from the WRONG op. Slot 5 stopped being dead with the MPI-615
        // re-export — it is a LanPaint inpaint branch now. 4 is still unused here, kept
        // numbered to match Klein/Krea2/Chroma.
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            inpaint: { Input_wf_type: 5 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        gen_speed: 'fast',
        description: 'This spicy image generator uses one of the best NSFW models available for SDXL, the famous Lustify model by Coyotte.',
        workflows: {
            // MPI-365: ONE file for all five ops — the branch is chosen by opInject's
            // Input_wf_type and lazy evaluation prunes the rest at run time. The old
            // upscaler_sdxl_nsfw.json / detailer_sdxl_nsfw.json are deleted.
            t2i:     't2i_sdxl_nsfw.json',
            i2i:     't2i_sdxl_nsfw.json',
            control: 't2i_sdxl_nsfw.json',
            inpaint: 't2i_sdxl_nsfw.json',
            upscale: 't2i_sdxl_nsfw.json',
            detail:  't2i_sdxl_nsfw.json',
        },
        dependencies: [
            'sdxl-nsfw',
            '4x-NMKD-Siax',
            'controlnet-union-sdxl',   // the ONE ControlNet behind all four control types
            'ComfyUI-MpiNodes',
            'ComfyUI-UltimateSDUpscale',
            // MPI-365: MaskDetailerPipe/To-FromBasicPipe were always needed by the detail
            // op and were never declared — latent until the master template made every
            // node submit-validated on EVERY run, which turns the gap fatal.
            'ComfyUI-Impact-Pack',
            'comfyui-kjnodes',          // ImageResizeKJv2 — the i2i resize
            // AIO_Preprocessor x4: DepthAnythingV2 / Openpose / Scribble / CannyEdge.
            // Canny and Scribble are weightless filters; OpenPose auto-downloads its
            // body/hand/face annotators on first use, DepthAnythingV2 its own.
            'comfyui_controlnet_aux',
            // MPI-615, the inpaint branch (wf_type 5): a square-bbox crop around the
            // mask, LanPaint over the crop, stitched back. Both packs are custom_nodes,
            // so the engine installs them either way — declared so the graph's needs are
            // readable here and the uninstall sweep never strands them.
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved
            'LanPaint',                      // LanPaint_KSampler — mask-conditioned sampling
        ],
    },
    {
        id: 'ill-anime-beauty',
        sizeTier: 'low',
        name: 'ILL Anime Beauty',
        dropdownMeta: 'ANIME',
        mediaType: 'image',
        defaultUpscale: '4x-AnimeSharp',
        image: 'sdxl-anime-08.webp',
        type: 'sdxl',
        enhanceRecipe: 'illustrious',   // the Illustrious tag-grammar recipe (MPI-25,
                                       // Stage 1 green 24/24). WITHOUT this line the bare
                                       // type 'sdxl' matches the SDXL PHOTOGRAPHY
                                       // recipe exactly, so no alias can reach here.
        supportedOps: ['t2i', 'i2i', 'control', 'inpaint', 'upscale', 'detail'],
        // Batch multiplies EmptyLatentImage only, and t2i is now the ONLY branch that
        // samples it. This CHANGED with the master template (MPI-365): the old graph
        // gated depth with Input_depth_reference and kept the empty latent; control now
        // VAE-encodes the input (KSampler.latent_image <- MpiAnySwitch on wf_type,
        // any_3 = VAEEncode), so a batch > 1 there would claim N and return one.
        batchOps: ['t2i'],
        // Same graph change, same class of lie on the other axis: control scales the
        // INPUT image to a megapixel target (ImageScaleToTotalPixels) instead of reading
        // Input_Width/Height, so the ratio picker cannot describe its output. i2i still
        // resizes to our dimensions (ImageResizeKJv2) and keeps the picker.
        imageSizedOps: ['control', 'detail', 'upscale'],
        // SDXL is the only model whose control switch offers more than depth: ONE
        // ControlNet-Union checkpoint behind four SetUnionControlNetType nodes and four
        // AIO_Preprocessor annotators, both switched by Input_Control_Net.
        controlTypes: ['depth', 'pose', 'scribble', 'canny'],
        // Input_Control_strength -> MpiNormalizeValue -> ControlNetApplyAdvanced.strength.
        capabilities: { controlStrength: true },
        // Op -> the Input_wf_type value selecting its branch. MUST cover every entry in
        // supportedOps: a gap does not error, it runs the graph default and returns a
        // plausible image from the WRONG op. Slot 5 stopped being dead with the MPI-615
        // re-export — it is a LanPaint inpaint branch now. 4 is still unused here, kept
        // numbered to match Klein/Krea2/Chroma.
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            inpaint: { Input_wf_type: 5 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        gen_speed: 'fast',
        description: 'Illustrous workflows for Anime style images with an extra shine using AlchemyMix V176.',
        workflows: {
            // MPI-365: ONE file for all five ops — the branch is chosen by opInject's
            // Input_wf_type and lazy evaluation prunes the rest at run time. The old
            // upscaler_ill_anime_beauty.json / detailer_ill_anime_beauty.json are deleted.
            t2i:     't2i_ill_anime_beauty.json',
            i2i:     't2i_ill_anime_beauty.json',
            control: 't2i_ill_anime_beauty.json',
            inpaint: 't2i_ill_anime_beauty.json',
            upscale: 't2i_ill_anime_beauty.json',
            detail:  't2i_ill_anime_beauty.json',
        },
        dependencies: [
            'ill-anime-beauty',
            '4x-AnimeSharp',
            'controlnet-union-sdxl',   // the ONE ControlNet behind all four control types
            'ComfyUI-MpiNodes',
            'ComfyUI-UltimateSDUpscale',
            // MPI-365: MaskDetailerPipe/To-FromBasicPipe were always needed by the detail
            // op and were never declared — latent until the master template made every
            // node submit-validated on EVERY run, which turns the gap fatal.
            'ComfyUI-Impact-Pack',
            'comfyui-kjnodes',          // ImageResizeKJv2 — the i2i resize
            // AIO_Preprocessor x4: DepthAnythingV2 / Openpose / Scribble / CannyEdge.
            // Canny and Scribble are weightless filters; OpenPose auto-downloads its
            // body/hand/face annotators on first use, DepthAnythingV2 its own.
            'comfyui_controlnet_aux',
            // MPI-615, the inpaint branch (wf_type 5): a square-bbox crop around the
            // mask, LanPaint over the crop, stitched back. Both packs are custom_nodes,
            // so the engine installs them either way — declared so the graph's needs are
            // readable here and the uninstall sweep never strands them.
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved
            'LanPaint',                      // LanPaint_KSampler — mask-conditioned sampling
        ],
    },
    {
        id: 'ill-anime',
        sizeTier: 'low',
        name: 'ILL Anime',
        dropdownMeta: 'ANIME',
        mediaType: 'image',
        defaultUpscale: '4x-AnimeSharp',
        image: 'sdxl-anime-06.webp',
        type: 'sdxl',
        enhanceRecipe: 'illustrious',   // the Illustrious tag-grammar recipe (MPI-25,
                                       // Stage 1 green 24/24). WITHOUT this line the bare
                                       // type 'sdxl' matches the SDXL PHOTOGRAPHY
                                       // recipe exactly, so no alias can reach here.
        supportedOps: ['t2i', 'i2i', 'control', 'inpaint', 'upscale', 'detail'],
        // Batch multiplies EmptyLatentImage only, and t2i is now the ONLY branch that
        // samples it. This CHANGED with the master template (MPI-365): the old graph
        // gated depth with Input_depth_reference and kept the empty latent; control now
        // VAE-encodes the input (KSampler.latent_image <- MpiAnySwitch on wf_type,
        // any_3 = VAEEncode), so a batch > 1 there would claim N and return one.
        batchOps: ['t2i'],
        // Same graph change, same class of lie on the other axis: control scales the
        // INPUT image to a megapixel target (ImageScaleToTotalPixels) instead of reading
        // Input_Width/Height, so the ratio picker cannot describe its output. i2i still
        // resizes to our dimensions (ImageResizeKJv2) and keeps the picker.
        imageSizedOps: ['control', 'detail', 'upscale'],
        // SDXL is the only model whose control switch offers more than depth: ONE
        // ControlNet-Union checkpoint behind four SetUnionControlNetType nodes and four
        // AIO_Preprocessor annotators, both switched by Input_Control_Net.
        controlTypes: ['depth', 'pose', 'scribble', 'canny'],
        // Input_Control_strength -> MpiNormalizeValue -> ControlNetApplyAdvanced.strength.
        capabilities: { controlStrength: true },
        // Op -> the Input_wf_type value selecting its branch. MUST cover every entry in
        // supportedOps: a gap does not error, it runs the graph default and returns a
        // plausible image from the WRONG op. Slot 5 stopped being dead with the MPI-615
        // re-export — it is a LanPaint inpaint branch now. 4 is still unused here, kept
        // numbered to match Klein/Krea2/Chroma.
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            inpaint: { Input_wf_type: 5 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        gen_speed: 'fast',
        description: 'Illustrous workflows for Anime style images using AnimeMix V8.',
        workflows: {
            // MPI-365: ONE file for all five ops — the branch is chosen by opInject's
            // Input_wf_type and lazy evaluation prunes the rest at run time. The old
            // upscaler_ill_anime.json / detailer_ill_anime.json are deleted.
            t2i:     't2i_ill_anime.json',
            i2i:     't2i_ill_anime.json',
            control: 't2i_ill_anime.json',
            inpaint: 't2i_ill_anime.json',
            upscale: 't2i_ill_anime.json',
            detail:  't2i_ill_anime.json',
        },
        dependencies: [
            'ill-anime',
            '4x-AnimeSharp',
            'controlnet-union-sdxl',   // the ONE ControlNet behind all four control types
            'ComfyUI-MpiNodes',
            'ComfyUI-UltimateSDUpscale',
            // MPI-365: MaskDetailerPipe/To-FromBasicPipe were always needed by the detail
            // op and were never declared — latent until the master template made every
            // node submit-validated on EVERY run, which turns the gap fatal.
            'ComfyUI-Impact-Pack',
            'comfyui-kjnodes',          // ImageResizeKJv2 — the i2i resize
            // AIO_Preprocessor x4: DepthAnythingV2 / Openpose / Scribble / CannyEdge.
            // Canny and Scribble are weightless filters; OpenPose auto-downloads its
            // body/hand/face annotators on first use, DepthAnythingV2 its own.
            'comfyui_controlnet_aux',
            // MPI-615, the inpaint branch (wf_type 5): a square-bbox crop around the
            // mask, LanPaint over the crop, stitched back. Both packs are custom_nodes,
            // so the engine installs them either way — declared so the graph's needs are
            // readable here and the uninstall sweep never strands them.
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved
            'LanPaint',                      // LanPaint_KSampler — mask-conditioned sampling
        ],
    },
    {
        id: 'pony-mix',
        sizeTier: 'low',
        name: 'PONY Mix',
        dropdownMeta: 'STYLIZED',
        mediaType: 'image',
        defaultUpscale: '4x-AnimeSharp',
        image: 'sdxl-pony-13.webp',
        type: 'sdxl',
        enhanceRecipe: 'pony',   // the Pony V6 XL tag-grammar recipe (MPI-25,
                                 // Stage 1 green 24/24). WITHOUT this line the bare
                                 // type 'sdxl' matches the SDXL PHOTOGRAPHY
                                 // recipe exactly, so no alias can reach here.
        supportedOps: ['t2i', 'i2i', 'control', 'inpaint', 'upscale', 'detail'],
        // Batch multiplies EmptyLatentImage only, and t2i is now the ONLY branch that
        // samples it. This CHANGED with the master template (MPI-365): the old graph
        // gated depth with Input_depth_reference and kept the empty latent; control now
        // VAE-encodes the input (KSampler.latent_image <- MpiAnySwitch on wf_type,
        // any_3 = VAEEncode), so a batch > 1 there would claim N and return one.
        batchOps: ['t2i'],
        // Same graph change, same class of lie on the other axis: control scales the
        // INPUT image to a megapixel target (ImageScaleToTotalPixels) instead of reading
        // Input_Width/Height, so the ratio picker cannot describe its output. i2i still
        // resizes to our dimensions (ImageResizeKJv2) and keeps the picker.
        imageSizedOps: ['control', 'detail', 'upscale'],
        // SDXL is the only model whose control switch offers more than depth: ONE
        // ControlNet-Union checkpoint behind four SetUnionControlNetType nodes and four
        // AIO_Preprocessor annotators, both switched by Input_Control_Net.
        controlTypes: ['depth', 'pose', 'scribble', 'canny'],
        // Input_Control_strength -> MpiNormalizeValue -> ControlNetApplyAdvanced.strength.
        capabilities: { controlStrength: true },
        // Op -> the Input_wf_type value selecting its branch. MUST cover every entry in
        // supportedOps: a gap does not error, it runs the graph default and returns a
        // plausible image from the WRONG op. Slot 5 stopped being dead with the MPI-615
        // re-export — it is a LanPaint inpaint branch now. 4 is still unused here, kept
        // numbered to match Klein/Krea2/Chroma.
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            inpaint: { Input_wf_type: 5 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        gen_speed: 'fast',
        description: 'This image generator uses the AnimerJei V3 PONY model. It is a stylized model that can create different animation styles.',
        workflows: {
            // MPI-365: ONE file for all five ops — the branch is chosen by opInject's
            // Input_wf_type and lazy evaluation prunes the rest at run time. The old
            // upscaler_pony_mix.json / detailer_pony_mix.json are deleted.
            t2i:     't2i_pony_mix.json',
            i2i:     't2i_pony_mix.json',
            control: 't2i_pony_mix.json',
            inpaint: 't2i_pony_mix.json',
            upscale: 't2i_pony_mix.json',
            detail:  't2i_pony_mix.json',
        },
        dependencies: [
            'pony-mix',
            '4x-AnimeSharp',
            'controlnet-union-sdxl',   // the ONE ControlNet behind all four control types
            'ComfyUI-MpiNodes',
            'ComfyUI-UltimateSDUpscale',
            // MPI-365: MaskDetailerPipe/To-FromBasicPipe were always needed by the detail
            // op and were never declared — latent until the master template made every
            // node submit-validated on EVERY run, which turns the gap fatal.
            'ComfyUI-Impact-Pack',
            'comfyui-kjnodes',          // ImageResizeKJv2 — the i2i resize
            // AIO_Preprocessor x4: DepthAnythingV2 / Openpose / Scribble / CannyEdge.
            // Canny and Scribble are weightless filters; OpenPose auto-downloads its
            // body/hand/face annotators on first use, DepthAnythingV2 its own.
            'comfyui_controlnet_aux',
            // MPI-615, the inpaint branch (wf_type 5): a square-bbox crop around the
            // mask, LanPaint over the crop, stitched back. Both packs are custom_nodes,
            // so the engine installs them either way — declared so the graph's needs are
            // readable here and the uninstall sweep never strands them.
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved
            'LanPaint',                      // LanPaint_KSampler — mask-conditioned sampling
        ],
    },
    {
        // Chroma (Flash) — Flux-family image model, balanced tier. Extra vs SDXL:
        // RES4LYF custom node (ClownShark sampler + ReChromaPatcher), and its LoRAs take
        // MODEL strength only (loraStrengths: ['model']) — the MpiLoraModel node has no
        // clip input. MPI-217.
        //
        // MPI-365: collapsed from three runtime files to ONE master graph; the branch is
        // the injected `Input_wf_type` (see opInject). The Flash/Hyper split is NOT a
        // runtime tier — they are two separate checkpoints, so generate_chroma.py bakes
        // one file per tier and each card names its own.
        id: 'chroma-flash',
        sizeTier: 'balanced',
        modelFamily: 'Chroma',
        name: 'Chroma Flash',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        defaultUpscale: '4x-NMKD-Siax',
        image: 'chroma-flash-01.webp',
        type: 'chroma',
        supportedOps: ['t2i', 'i2i', 'control', 'upscale', 'detail'],
        loraStrengths: ['model'],
        gen_speed: 'fast',
        capabilities: {
            // Five style LoRAs on one MpiStyleLoras bank (MPI-365).
            styleLoras: true,
            // Chroma reaches control through a FLUX ControlNet (depth is its only type),
            // so it has a strength to expose: Input_Control_strength → MpiNormalizeValue
            // → ControlNetApplyAdvanced.strength. The normalize node remaps the slider's
            // 0-1 to 0-0.5 in-graph, because measured on this model anything past ~0.5
            // starts producing artefacts. (Chroma has no in-graph enhancer node and no
            // Output_prompt capture; since MPI-728 that costs it nothing — enhancement is
            // its own dispatch, on every model.)
            controlStrength: true,
        },
        // One master graph ⇒ the rack reaches every op, detail and upscale included.
        // Depth is the only structure this graph can copy, so the type picker stays
        // hidden and the op reads exactly as the old single-purpose one did.
        controlTypes: ['depth'],
        styleOps: ['t2i', 'i2i', 'control', 'detail', 'upscale'],
        // depth/detail/upscale inherit their shape from the input image, so the ratio
        // picker is hidden there. depth was WRONGLY excluded until 2026-08-02 on the
        // belief that it read Input_Width/Input_Height through MpiCrop. Traced in the
        // graph: MpiCrop feeds the *i2i* latent (VAEEncode 2616); depth's latent is
        // VAEEncode 2762 <- ImageScaleToTotalPixels(megapixels: 1) <- Input_Image, so
        // depth never reads them. Only t2i's EmptyLatentImage does.
        //
        // That one omission caused THREE user-visible symptoms, all one bug: the picker
        // claimed a shape the user would not get (8:5 picked, 1280x768 produced), the
        // `ratio` control injected Width/Height it had no right to, and the gallery
        // placeholder — sized `injectionParams.Width || 0` — reserved a cell of the
        // requested shape and padded the real image inside it. Hiding the picker fixes
        // all three, because a control that is not mounted contributes no injection.
        imageSizedOps: ['control', 'detail', 'upscale'],
        // Batch reaches ONLY EmptyLatentImage, which only t2i samples from here — depth
        // and i2i both start from a VAE-encoded latent, so a batch > 1 there returned one
        // image while the control claimed N. Narrower than SDXL's list, which keeps depth
        // because its depth switches the conditioning pipe rather than the latent.
        batchOps: ['t2i'],
        // Style strength starts at 0.6, not the global 1.0. BOTH Chroma checkpoints are
        // heavily distilled, and at 0.8 or 1.0 the style LoRAs stop styling and start
        // producing artefacts (user-measured). 0.6 is also what the graph's
        // Input_Style_Selector.strength_model is baked to, so the UI now agrees with the
        // template instead of overriding it on every fresh prompt. Applies across the
        // whole rack (styleOps) — which is why it is a MODEL default and not an op one.
        controlDefaults: { stylization: 0.6 },
        // Op → the `Input_wf_type` value that selects its branch. MUST cover every entry
        // in supportedOps; commandExecutor warns loudly if one is missing, because the
        // failure mode is a plausible image from the WRONG op rather than an error.
        // 4 and 5 are dead slots, kept so the numbering matches Klein and Krea2.
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        styleLoraLabels: ['None', 'B&W Sketch', 'Lenovo', 'Brushwork', 'Anime'],
        // Index-aligned with styleLoraLabels; index 0 is the no-style baseline. Both
        // Chroma cards share the rack, so the same set applies to Hyper.
        styleLoraImages: [
            'chroma-style-none.webp', 'chroma-style-bwsketch.webp', 'chroma-style-lenovo.webp',
            'chroma-style-brushwork.webp', 'chroma-style-anime.webp',
        ],
        description: 'Chroma is a high-detail Flux-family image generator. It can produce some really hardcore high quality NSFW but can sometimes struggle with hands.',
        workflows: {
            // MPI-365: ONE file for all five ops — the branch is chosen by opInject's
            // Input_wf_type and lazy evaluation prunes the rest at run time.
            t2i: 'chroma_t2i.json',
            i2i: 'chroma_t2i.json',
            control: 'chroma_t2i.json',
            upscale: 'chroma_t2i.json',
            detail: 'chroma_t2i.json',
        },
        dependencies: [
            'chroma1-hd-flash',
            't5xxl-fp16',
            'vae-flux-ae',
            '4x-NMKD-Siax',
            'controlnet-union-flux',         // depth op — the only FLUX.1-dev-licensed weight
            'chroma-style-bwsketch',
            'chroma-style-lenovo',
            'chroma-style-brushwork',
            'chroma-style-anime',
            'RES4LYF',
            'ComfyUI-MpiNodes',
            'ComfyUI-UltimateSDUpscale',
            'ComfyUI-Impact-Pack',           // MaskDetailerPipe (detail op)
            'comfyui_controlnet_aux',        // DepthAnythingV2Preprocessor (+ its own weight)
        ],
    },
    {
        // Chroma (Hyper) — LOW-tier sibling of Chroma Flash. Same op shape, same support
        // stack (RES4LYF/MpiNodes/UltimateSDUpscale, t5xxl-fp16, vae-flux-ae, Siax); only
        // the diffusion weight differs (int8 Danrisi mix + Hyper/Turbo distill → faster,
        // ~9.2GB vs Flash's 17GB). Clustered with Flash via modelFamily:'Chroma'; the L/B
        // badge disambiguates. Separately installable alongside Flash (NOT mutually
        // exclusive).
        //
        // MPI-365: shares Flash's master graph — same template, different bake. Hyper is
        // tier 3 and Flash is tier 2, and generate_chroma.py stamps ClownModelLoader plus
        // Input_Tier into each output file. Two loaders in ONE graph would force BOTH
        // downloads (ComfyUI validates every combo widget at submit time, even on a
        // lazily-skipped branch), which is exactly what the per-tier bake avoids.
        id: 'chroma-hyper',
        sizeTier: 'low',
        modelFamily: 'Chroma',
        name: 'Chroma Hyper',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        defaultUpscale: '4x-NMKD-Siax',
        image: 'chroma-hyper-01.webp',
        type: 'chroma',
        supportedOps: ['t2i', 'i2i', 'control', 'upscale', 'detail'],
        loraStrengths: ['model'],
        gen_speed: 'fast',
        // Identical rack + branch shape to Flash — see that card for the reasoning.
        capabilities: {
            styleLoras: true,
            controlStrength: true,
        },
        // Depth is the only structure this graph can copy, so the type picker stays
        // hidden and the op reads exactly as the old single-purpose one did.
        controlTypes: ['depth'],
        styleOps: ['t2i', 'i2i', 'control', 'detail', 'upscale'],
        // Shares Flash's master graph, so it shares the depth-is-image-sized fix too —
        // and the same batch reality: only t2i samples an EmptyLatentImage. Hyper is the
        // MORE distilled of the two, so the 0.6 style strength matters at least as much.
        imageSizedOps: ['control', 'detail', 'upscale'],
        batchOps: ['t2i'],
        controlDefaults: { stylization: 0.6 },
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        styleLoraLabels: ['None', 'B&W Sketch', 'Lenovo', 'Brushwork', 'Anime'],
        styleLoraImages: [
            'chroma-style-none.webp', 'chroma-style-bwsketch.webp', 'chroma-style-lenovo.webp',
            'chroma-style-brushwork.webp', 'chroma-style-anime.webp',
        ],
        description: 'A faster, lighter Chroma — the same high-detail Flux-family image generator distilled to run quicker at low VRAM. Great for realistic, hardcore NSFW; hands can still struggle.',
        workflows: {
            t2i: 'chroma_hyper_t2i.json',
            i2i: 'chroma_hyper_t2i.json',
            control: 'chroma_hyper_t2i.json',
            upscale: 'chroma_hyper_t2i.json',
            detail: 'chroma_hyper_t2i.json',
        },
        dependencies: [
            'chroma1-hd-hyper',
            't5xxl-fp16',
            'vae-flux-ae',
            '4x-NMKD-Siax',
            'controlnet-union-flux',         // depth op — the only FLUX.1-dev-licensed weight
            'chroma-style-bwsketch',
            'chroma-style-lenovo',
            'chroma-style-brushwork',
            'chroma-style-anime',
            'RES4LYF',
            'ComfyUI-MpiNodes',
            'ComfyUI-UltimateSDUpscale',
            'ComfyUI-Impact-Pack',           // MaskDetailerPipe (detail op)
            'comfyui_controlnet_aux',        // DepthAnythingV2Preprocessor (+ its own weight)
        ],
    },
    {
        // ── Krea 2 — MPI-282, collapsed to a single card in MPI-316 ────────────────
        // ONE Krea2 SFW card, BOTH speed tiers. The Raw (un-distilled) weight gives a
        // working cfg + negative prompt, which drives the identity-edit LoRA cleanly.
        // The old separate Turbo card is GONE: the `Accelerator Lora` (turbo-distill,
        // an SVD delta extracted FROM Raw) reconstructs the Turbo transformer at
        // strength 1.0, so the fast tier is now a runtime toggle on this same weight
        // rather than a second ~12GB download. capabilities.turboToggle drives it.
        //
        // One universal graph serves t2i/i2i/depth/edit (switched at runtime), and the
        // krea2Turbo control injects Input_is_Turbo (MPI-365, was the Input_Tier int):
        // false = quality (cfg 3, 40 steps, working negative), true = fast (cfg 1, 12+6
        // steps, accelerator LoRA at 1.0 — the negative is computed then discarded, so
        // the PromptBox hides the negative toggle).
        // See docs/models/krea2/README.md "Krea2 as an EDITOR".
        id: 'krea2',
        // 'balanced', not 'high': the accelerator LoRA means one install now covers both
        // speeds, so this is no longer the heavyweight half of a tier pair (MPI-316).
        sizeTier: 'balanced',
        featured: true,
        // NO modelFamily (MPI-316). The family field drives the H/B/L tier letter, which
        // only makes sense when siblings are TIERS of the same model. Krea2's two cards
        // are CONTENT variants (SFW / NSFW) that a user can install side by side — the
        // tier split they used to represent is now a runtime toggle. Keeping the family
        // rendered "Krea 2 H" / "Krea 2 NSFW H": a tier letter on a content distinction,
        // and the same letter on both, so it disambiguated nothing.
        name: 'Krea 2',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        image: 'krea2-turbo-sfw.webp',
        defaultUpscale: '4x-NMKD-Siax',
        type: 'krea2',
        enhanceRecipe: 'krea-2',   // the Krea 2 recipe (MPI-16). Note the id is
                                   // 'krea-2', NOT 'krea2' — resolveRecipe() matches on the exact
                                   // modelId and silently falls back to the FLUX recipe on a miss.
        supportedOps: ['t2i', 'i2i', 'control', 'krea2Edit', 'inpaint', 'upscale', 'detail'],
        loraStrengths: ['model'],   // style LoRAs are model-only (no CLIP side)
        capabilities: {
            multiStage: false, audio: false, negativePrompt: true, styleLoras: true,
            batch: false, turboToggle: true,
            // MPI-365: the depth branch became a LINE — image 1 is the depth map, image 2
            // the subject posed into it. Krea2 stops at TWO: its Input_Image_3 was
            // bypassed out of the graph, so it does NOT declare `depthSubject3`.
            depthSubject: true,
            // Krea2 reaches control through a control-LoRA (Krea2ControlLoRALoader), so it
            // has a strength to expose — the `controlStrength` slider drives its
            // Input_Control_strength. Qwen conditions on the control image directly and
            // has no equivalent knob.
            controlStrength: true,
        },
        // Op → the `Input_wf_type` value that selects its branch in the ONE master graph
        // (MPI-365). MUST cover every entry in supportedOps — a gap does not error, it
        // runs the graph's DEFAULT branch (wf_type 1 = t2i) and returns a plausible image
        // from the wrong op; commandExecutor warns on the gap for exactly that reason.
        // 1 t2i · 2 i2i · 3 depth · 4 edit · 5 inpaint · 6 detail · 7 upscale. Slot 5 was
        // dead until MPI-615: edit takes an optional Input_Mask and re-renders the whole
        // crop, which is a different job from holding everything outside the mask still.
        // The re-export gave it a LanPaint branch that does the latter, and the branch
        // reads Get_turbo for its own steps/cfg — hence krea2Turbo on the op.
        //
        // Declaring opInject makes commandExecutor REPLACE the op's own injectParams
        // rather than merge them. That mattered while the shared ops still carried
        // Input_Is_i2i / Input_Is_Edit / Input_depth_reference; all three are gone now,
        // so REPLACE and merge would agree — the branch is dead weight (MPI-365 GC).
        opInject: {
            t2i:       { Input_wf_type: 1 },
            i2i:       { Input_wf_type: 2 },
            control:   { Input_wf_type: 3 },
            krea2Edit: { Input_wf_type: 4 },
            inpaint:   { Input_wf_type: 5 },
            detail:    { Input_wf_type: 6 },
            upscale:   { Input_wf_type: 7 },
        },
        // The rack lives in the ONE graph, so it reaches every op — including detail and
        // upscale, which the pre-migration default (DEFAULT_STYLE_OPS) excludes and which
        // the old rack-less krea2_detailer/upscaler files could not offer.
        // Depth is the only structure this graph can copy, so the type picker stays
        // hidden and the op reads exactly as the old single-purpose one did.
        controlTypes: ['depth'],
        styleOps: ['t2i', 'i2i', 'control', 'krea2Edit', 'inpaint', 'detail', 'upscale'],
        // MPI-365: every op EXCEPT t2i/i2i now derives its output shape from the input
        // image (ImageScaleToTotalPixels replaced ImageResizeKJv2), so the ratio picker
        // is hidden there. t2i/i2i still generate at our Input_Width/Height.
        imageSizedOps: ['control', 'krea2Edit', 'detail', 'upscale'],
        styleLoraLabels: [
            'None', 'Dark Brush', 'Dot Matrix', 'Kids Drawing', 'Neon Drip',
            'Rainy Window', 'Retro Anime', 'Soft Water Color', 'Sunset Blur', 'Vintage Tarot',
            'MidJourney',
        ],
        // Style card images for the picker (index-aligned with styleLoraLabels;
        // comfy_workflows/display/). Index 0 = the no-style baseline gen. All four
        // Krea2 variants share the same style rack, so the same set applies.
        styleLoraImages: [
            'krea2-style-none.webp', 'krea2-style-darkbrush.webp', 'krea2-style-dotmatrix.webp',
            'krea2-style-kidsdrawing.webp', 'krea2-style-neondrip.webp', 'krea2-style-rainywindow.webp',
            'krea2-style-retroanime.webp', 'krea2-style-softwatercolor.webp', 'krea2-style-sunsetblur.webp',
            'krea2-style-vintagetarot.webp', 'krea2-style-midjourney.webp',
        ],
        gen_speed: 'balanced',
        description: 'Krea 2 at full quality — the un-distilled Raw weight with a working negative prompt. Edit an image with a prompt (changes only what you ask; add a second reference image to pull from both), plus the distinctive photographic look, ten style LoRAs, depth reference, up to 2K. Uses the most VRAM and is slower than Turbo — best on a high-end NVIDIA card.',
        workflows: {
            // MPI-365: ONE file for all six ops — the branch is chosen by opInject's
            // Input_wf_type above. The separate krea2_detailer_* / krea2_upscaler_*
            // runtime files are GONE; their nodes (MaskDetailerPipe, UltimateSDUpscale,
            // UpscaleModelLoader) now live in this master graph.
            // Tier is NOT a file axis either (MPI-316) — krea2Turbo injects
            // Input_is_Turbo to pick the sampler chain at runtime.
            t2i:       'krea2_t2i_sfw.json',
            i2i:       'krea2_t2i_sfw.json',
            control:   'krea2_t2i_sfw.json',
            krea2Edit: 'krea2_t2i_sfw.json',
            inpaint:   'krea2_t2i_sfw.json',
            upscale:   'krea2_t2i_sfw.json',
            detail:    'krea2_t2i_sfw.json',
        },
        qualityTiers: ['1k', '2k'],
        dependencies: [
            'krea2-raw-transformer',     // ONLY difference from the NSFW card's deps
            'krea2-lora-accelerator',    // turbo-distill delta — REQUIRED: it IS the fast tier (MPI-316)
            'qwen3vl-abliterated-clip',   // shared with the image-describer plugin
            'vae-qwen-image',            // shared — already on R2, zero upload
            'krea2-lora-depth-control',
            'krea2-lora-identity-edit',  // instruct-edit LoRA (baked into the edit path); dep of both Krea2 cards
            'krea2-lora-filterbypass',   // always-on bypass node; strength baked per variant (SFW 1.0 / NSFW 0.0)
            'krea2-style-darkbrush',
            'krea2-style-dotmatrix',
            'krea2-style-kidsdrawing',
            'krea2-style-neondrip',
            'krea2-style-rainywindow',
            'krea2-style-retroanime',
            'krea2-style-softwatercolor',
            'krea2-style-sunsetblur',
            'krea2-style-vintagetarot',
            'krea2-style-midjourney',
            '4x-NMKD-Siax',
            'RES4LYF',                   // ClownsharKSampler_Beta (both stages)
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',           // ImageResizeKJv2, ResizeImageMaskNode
            'ComfyUI-Impact-Pack',       // MaskDetailerPipe, To/FromBasicPipe
            'ComfyUI-UltimateSDUpscale',
            'ComfyUI-Krea2-ControlNet',
            'comfyui_controlnet_aux',
            // MPI-615, the inpaint branch (wf_type 5). InpaintCropImproved was already
            // in the graph on the edit path and had never been declared; LanPaint is new
            // with the branch. Both are custom_nodes, so the engine installs them either
            // way — declared so the graph's needs are readable here.
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved
            'LanPaint',                      // LanPaint_KSampler — mask-conditioned sampling
            'comfyui-krea2edit',         // dual-conditioning edit nodes (Krea2EditModelPatch + GroundedEncode)
        ],
    },
    {
        // ── Krea 2 NSFW — MPI-282, collapsed to a single card in MPI-316 ───────────
        // Lustify-Krea Raw int8 weight. Same rationale as the SFW card above: one card,
        // both tiers, the accelerator LoRA standing in for the deleted Turbo weight.
        id: 'krea2-nsfw',
        sizeTier: 'balanced',   // see the SFW card
        featured: true,
        // NO modelFamily — see the SFW card above.
        name: 'Krea 2 NSFW',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        image: 'krea2-turbo-nsfw.webp',
        defaultUpscale: '4x-NMKD-Siax',
        type: 'krea2',
        enhanceRecipe: 'krea-2',   // see the SFW card
        supportedOps: ['t2i', 'i2i', 'control', 'krea2Edit', 'inpaint', 'upscale', 'detail'],
        loraStrengths: ['model'],
        capabilities: {
            multiStage: false, audio: false, negativePrompt: true, styleLoras: true,
            batch: false, turboToggle: true,
            // MPI-365: the depth branch became a LINE — image 1 is the depth map, image 2
            // the subject posed into it. Krea2 stops at TWO: its Input_Image_3 was
            // bypassed out of the graph, so it does NOT declare `depthSubject3`.
            depthSubject: true,
            // Krea2 reaches control through a control-LoRA (Krea2ControlLoRALoader), so it
            // has a strength to expose — the `controlStrength` slider drives its
            // Input_Control_strength. Qwen conditions on the control image directly and
            // has no equivalent knob.
            controlStrength: true,
        },
        // Op → the `Input_wf_type` value that selects its branch in the ONE master graph
        // (MPI-365). MUST cover every entry in supportedOps — a gap does not error, it
        // runs the graph's DEFAULT branch (wf_type 1 = t2i) and returns a plausible image
        // from the wrong op; commandExecutor warns on the gap for exactly that reason.
        // 1 t2i · 2 i2i · 3 depth · 4 edit · 5 inpaint · 6 detail · 7 upscale. Slot 5 was
        // dead until MPI-615: edit takes an optional Input_Mask and re-renders the whole
        // crop, which is a different job from holding everything outside the mask still.
        // The re-export gave it a LanPaint branch that does the latter, and the branch
        // reads Get_turbo for its own steps/cfg — hence krea2Turbo on the op.
        //
        // Declaring opInject makes commandExecutor REPLACE the op's own injectParams
        // rather than merge them. That mattered while the shared ops still carried
        // Input_Is_i2i / Input_Is_Edit / Input_depth_reference; all three are gone now,
        // so REPLACE and merge would agree — the branch is dead weight (MPI-365 GC).
        opInject: {
            t2i:       { Input_wf_type: 1 },
            i2i:       { Input_wf_type: 2 },
            control:   { Input_wf_type: 3 },
            krea2Edit: { Input_wf_type: 4 },
            inpaint:   { Input_wf_type: 5 },
            detail:    { Input_wf_type: 6 },
            upscale:   { Input_wf_type: 7 },
        },
        // The rack lives in the ONE graph, so it reaches every op — including detail and
        // upscale, which the pre-migration default (DEFAULT_STYLE_OPS) excludes and which
        // the old rack-less krea2_detailer/upscaler files could not offer.
        // Depth is the only structure this graph can copy, so the type picker stays
        // hidden and the op reads exactly as the old single-purpose one did.
        controlTypes: ['depth'],
        styleOps: ['t2i', 'i2i', 'control', 'krea2Edit', 'inpaint', 'detail', 'upscale'],
        // MPI-365: every op EXCEPT t2i/i2i now derives its output shape from the input
        // image (ImageScaleToTotalPixels replaced ImageResizeKJv2), so the ratio picker
        // is hidden there. t2i/i2i still generate at our Input_Width/Height.
        imageSizedOps: ['control', 'krea2Edit', 'detail', 'upscale'],
        styleLoraLabels: [
            'None', 'Dark Brush', 'Dot Matrix', 'Kids Drawing', 'Neon Drip',
            'Rainy Window', 'Retro Anime', 'Soft Water Color', 'Sunset Blur', 'Vintage Tarot',
            'MidJourney',
        ],
        // Style card images for the picker (index-aligned with styleLoraLabels;
        // comfy_workflows/display/). Index 0 = the no-style baseline gen. All four
        // Krea2 variants share the same style rack, so the same set applies.
        styleLoraImages: [
            'krea2-style-none.webp', 'krea2-style-darkbrush.webp', 'krea2-style-dotmatrix.webp',
            'krea2-style-kidsdrawing.webp', 'krea2-style-neondrip.webp', 'krea2-style-rainywindow.webp',
            'krea2-style-retroanime.webp', 'krea2-style-softwatercolor.webp', 'krea2-style-sunsetblur.webp',
            'krea2-style-vintagetarot.webp', 'krea2-style-midjourney.webp',
        ],
        gen_speed: 'balanced',
        description: 'The spicy Lustify Krea weights at full quality — the un-distilled Raw weight with a working negative prompt. Edit an image with a prompt (changes only what you ask; add a second reference image to pull from both), plus the photographic look, ten style LoRAs, depth reference, up to 2K. int8 weight: fastest on NVIDIA RTX (Turing+); uses the most VRAM and is slower than Turbo.',
        workflows: {
            // ONE file for all six ops (MPI-365) — see the SFW card above.
            t2i:       'krea2_t2i_nsfw.json',
            i2i:       'krea2_t2i_nsfw.json',
            control:   'krea2_t2i_nsfw.json',
            krea2Edit: 'krea2_t2i_nsfw.json',
            inpaint:   'krea2_t2i_nsfw.json',
            upscale:   'krea2_t2i_nsfw.json',
            detail:    'krea2_t2i_nsfw.json',
        },
        qualityTiers: ['1k', '2k'],
        dependencies: [
            'krea2-raw-transformer-nsfw',   // ONLY difference from the SFW card's deps
            'krea2-lora-accelerator',    // turbo-distill delta — REQUIRED: it IS the fast tier (MPI-316)
            'qwen3vl-abliterated-clip',   // shared with the image-describer plugin
            'vae-qwen-image',
            'krea2-lora-depth-control',
            'krea2-lora-identity-edit',
            'krea2-lora-filterbypass',
            'krea2-style-darkbrush',
            'krea2-style-dotmatrix',
            'krea2-style-kidsdrawing',
            'krea2-style-neondrip',
            'krea2-style-rainywindow',
            'krea2-style-retroanime',
            'krea2-style-softwatercolor',
            'krea2-style-sunsetblur',
            'krea2-style-vintagetarot',
            'krea2-style-midjourney',
            '4x-NMKD-Siax',
            'RES4LYF',
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',
            'ComfyUI-Impact-Pack',
            'ComfyUI-UltimateSDUpscale',
            'ComfyUI-Krea2-ControlNet',
            'comfyui_controlnet_aux',
            // MPI-615, the inpaint branch (wf_type 5). InpaintCropImproved was already
            // in the graph on the edit path and had never been declared; LanPaint is new
            // with the branch. Both are custom_nodes, so the engine installs them either
            // way — declared so the graph's needs are readable here.
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved
            'LanPaint',                      // LanPaint_KSampler — mask-conditioned sampling
            'comfyui-krea2edit',
        ],
    },
    {
        // NVIDIA PiD generative upscaler — one model, 4 VAE-locked paths picked at
        // runtime via the pidVariant control (Input_Type switch). Prompt-box driven
        // (needs an image + optional prompt). Only op = `pid`. Research + decisions:
        // docs/models/pid/upscaler.md.
        id: 'nvidia-pid',
        sizeTier: 'low',
        name: 'NVIDIA PiD Upscaler',
        dropdownMeta: 'UPSCALE',
        mediaType: 'image',
        image: 'nvidia-pid.webp',
        type: 'pid',
        // Reuse the sdxl prompt-enhance recipe — PiD has no 'pid' recipe in Cubric
        // Prompt, and the prompt is optional guidance for an image upscale (§6 sweep).
        enhanceRecipe: 'sdxl',
        // No model-settings gear: PiD takes no upscale model and no LoRAs.
        showSettings: false,
        supportedOps: ['pid'],
        gen_speed: 'fast',
        description: 'NVIDIA PiD generative 4x image upscaler. This upscaler offers you 4 different models. (Flux/SD3/Qwen/SDXL) Each providing you different results. Like with any other model, you should reuse the prompt that generated the initial image or describe the image for better results. ',
        workflows: {
            pid: 'nvidia_pid.json',
        },
        dependencies: [
            'pid-flux1', 'pid-sdxl', 'pid-sd3', 'pid-qwenimage',
            'vae-flux-ae', 'vae-sdxl', 'vae-sd3', 'vae-qwen-image',
            'pid-gemma',
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',
        ],
    },
    // ── FLUX.2 Klein 4B (MPI-354) ──────────────────────────────────────────────
    // Apache-2.0, 4B, the FASTEST image model we ship — and the only path to object
    // REMOVAL. Research: docs/models/klein/ (README + removal + refcontrol + licences).
    //
    // FIRST MODEL ON THE ONE-MASTER-TEMPLATE SHAPE. Every op is a branch of a single
    // graph (klein_t2i.json) selected at run time by an injected `Input_wf_type` int —
    // see `opInject` below. ComfyUI's lazy evaluation prunes the unselected branches, so
    // one file costs nothing (t2i 4.03 s vs depth 7.46 s on the same 196-node graph).
    // Consequences that differ from every earlier model:
    //   * the STYLE RACK reaches every op, including detail and upscale — hence
    //     `styleOps`. Krea2's detailer/upscaler are separate rack-less files.
    //   * `opInject` is mandatory, not decorative: a missing entry silently runs the
    //     graph's default branch and returns the wrong operation's image.
    //
    // ONE tier: the distilled int8 checkpoint already runs at cfg 1.0 / 4 steps, so the
    // base+turbo pair was dropped (2026-07-27). turboToggle FALSE, and negativePrompt
    // FALSE because at cfg 1.0 the negative is bit-identical (max diff 0).
    // Orientation-mode ratios (type 'klein' → FLUX_RATIOS): one output class, so a
    // quality-tier radio would offer a single choice. Bigger output is the upscale op.
    {
        id: 'klein-4b',
        // 4.07GB int8 transformer. Rough 2026-07-28 readings: ~5GB for most ops, low teens
        // for a multi-reference edit — estimates, not measurements. 'low' is right and then
        // some: every op was verified with only ~6GB of the card free, spilling to system RAM
        // and completing. The minimum card is NOT set here — the Model Library derives it
        // from the weights via tradeTable() (footprint.js), labelled an estimate.
        sizeTier: 'low',
        featured: true,
        // The SIZE goes in the name (MPI-619). 4B and 9B are one architecture, but the
        // public knows them as two named models and their LoRAs do not interchange, so a
        // shared name plus an L/B letter read as one model in two speeds — which is how a
        // 9B style LoRA got picked for a 4B run (MPI-614). Boogu and LTX keep the letter:
        // those siblings really are one model at two qualities.
        name: 'FLUX.2 Klein 4B',
        // Gained the family key with the 9B card (MPI-598) — the two ARE size tiers of one
        // model, which is what this field is for. UI-only, no resolver effect, and the L/B
        // letter only renders once both are installed, so a 4B-only user sees no change.
        modelFamily: 'FLUX.2-Klein',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        image: 'klein-4b.webp',
        defaultUpscale: '4x-NMKD-Siax',
        type: 'klein',
        enhanceRecipe: 'flux',   // no 'klein' recipe is registered
        supportedOps: ['t2i', 'i2i', 'control', 'kleinEdit', 'inpaint', 'detail', 'upscale'],
        loraStrengths: ['model'],   // MpiLoraModel is model-only; no CLIP side
        capabilities: {
            multiStage: false, audio: false, negativePrompt: false, styleLoras: true,
            batch: false, turboToggle: false,
            // Klein's depth branch shares the edit branch's ReferenceLatent chain, so
            // further images are meaningful there: image 1 supplies the depth, images 2
            // and 3 the subject(s) posed into it. Unlocks depth's optional `inputImage2`
            // / `inputImage3` slots (capability-gated in filterMediaInputsForModel).
            // MPI-365: the depth line now runs to TWO references, matching the graph's
            // Input_Image_2/_3. SDXL/Chroma declare neither and stay 1-image.
            depthSubject: true,
            depthSubject3: true,
            // Klein reaches control through `flux2_klein_4b_refcontrol_depth` on a
            // LoraLoaderModelOnly, so the same Control Strength slider drives it
            // (Input_Control_strength → node 143's strength_model). Klein's LoRA bites
            // SOFTER than Krea2's: usable around 0.2-0.3 where Krea2 wants 0.6-0.8.
            controlStrength: true,
        },
        // Op → the `Input_wf_type` value that selects its branch. MUST cover every entry
        // in supportedOps; commandExecutor warns loudly if one is missing, because the
        // failure mode is a plausible image from the WRONG op rather than an error.
        // 1 t2i · 2 i2i · 3 depth · 4 edit · 5 inpaint/remove · 6 detail · 7 upscale.
        opInject: {
            t2i:           { Input_wf_type: 1 },
            i2i:           { Input_wf_type: 2 },
            control:       { Input_wf_type: 3 },
            kleinEdit:     { Input_wf_type: 4 },
            inpaint:       { Input_wf_type: 5 },
            detail:        { Input_wf_type: 6 },
            upscale:       { Input_wf_type: 7 },
        },
        // The rack is in the ONE graph, so it is live on every op — including detail and
        // upscale, which the pre-Klein default (DEFAULT_STYLE_OPS) excludes.
        // Depth is the only structure this graph can copy, so the type picker stays
        // hidden and the op reads exactly as the old single-purpose one did.
        controlTypes: ['depth'],
        styleOps: ['t2i', 'i2i', 'control', 'kleinEdit', 'inpaint', 'detail', 'upscale'],
        // Ops whose output shape comes from the INPUT image (scaled to a megapixel
        // target), not from Input_Width/Height — so the ratio picker is hidden there.
        // Klein's depth and edit branches both do this; t2i/i2i still take our ratio.
        imageSizedOps: ['control', 'kleinEdit'],
        // Index-aligned with the MpiStyleSelector's trigger lines and its MpiStyleLoras
        // banks (verified against the baked graph: bank 1 = muppets/cartoon/jojo/anime/
        // chibi, bank 2 = doodle/vintage/aesthetic). Index 0 = no style, selector 0.
        styleLoraLabels: [
            'None', 'Muppets', 'Cartoon', 'Jojo', 'Anime',
            'Chibi', 'Doodle', 'Vintage', 'Aesthetic',
        ],
        styleLoraImages: [
            'klein-style-none.webp', 'klein-style-muppets.webp', 'klein-style-cartoon.webp',
            'klein-style-jojo.webp', 'klein-style-anime.webp', 'klein-style-chibi.webp',
            'klein-style-doodle.webp', 'klein-style-vintage.webp', 'klein-style-aesthetic.webp',
        ],
        gen_speed: 'fast',
        description: 'The fastest image model in Cubric Studio, and the only one that can REMOVE things — mask an object, run Inpaint with the prompt left empty, and it is gone in about four seconds. Apache-2.0 and only 4B, so it runs where the big models will not. Generate from text, reshape an image, follow a depth reference, edit with up to three reference images, detail and upscale — all with eight style LoRAs available on every operation. Quality is modest next to Krea 2; this one is built for speed and for cleaning images up.',
        workflows: {
            // ONE file for all seven ops — the branch is chosen by opInject above.
            t2i:           'klein_t2i.json',
            i2i:           'klein_t2i.json',
            control: 'klein_t2i.json',
            kleinEdit:     'klein_t2i.json',
            inpaint:       'klein_t2i.json',
            detail:        'klein_t2i.json',
            upscale:       'klein_t2i.json',
        },
        dependencies: [
            'klein-4b-transformer',
            'qwen3-4b-clip',                 // Qwen3-4B TEXT-ONLY — not any Qwen-VL we host
            'vae-flux2',                     // FLUX.2 VAE — not FLUX.1's ae.safetensors
            // 'klein-lora-outpaint' DROPPED (MPI-603) — LanPaint replaced the green-plate
            // workaround it was baked in for and no graph loads it. Its loraDeps entry
            // STAYS, unprotected on purpose: that is what lets the orphan sweep reclaim
            // the 72MB from users who already downloaded it.
            'klein-lora-refcontrol-depth',   // baked on the depth branch; IS the depth op
            'klein-lora-nsfw',               // baked + PROMPT-gated; never loads on a clean prompt
            'klein-style-muppets',
            'klein-style-cartoon',
            'klein-style-jojo',
            'klein-style-anime',
            'klein-style-chibi',
            'klein-style-doodle',
            'klein-style-vintage',
            'klein-style-aesthetic',
            '4x-NMKD-Siax',                  // shared engineAsset (upscale op)
            'ComfyUI-MpiNodes',              // 20 Mpi* classes incl. MpiStyleSelector/Loras
            'comfyui-kjnodes',               // ImageResizeKJv2, GrowMaskWithBlur
            'ComfyUI-Impact-Pack',           // MaskDetailerPipe, ToBasicPipe
            'ComfyUI-UltimateSDUpscale',     // UltimateSDUpscale (upscale op)
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved (still one pair)
            'comfyui_controlnet_aux',        // DepthAnythingV2Preprocessor (+ its own weight)
            'LanPaint',                      // LanPaint_KSampler — REAL mask-conditioned inpaint (MPI-598)
        ],
    },
    // ── FLUX.2 Klein 9B (MPI-598) ──────────────────────────────────────────
    // The SAME graph as klein-4b at a bigger size. generate_klein.py bakes both runtime
    // files from the one template (klein_t2i_template.json), swapping four weight names
    // plus the whole style rack — so there is no 9B twin template to keep in sync, and
    // any graph change lands on both sizes at once. Do not hand-author a 9B graph.
    //
    // THE LICENCE GATE ARMS ITSELF. `MODEL_LICENCES` in licences.js already keys the FLUX
    // Non-Commercial descriptor to the exact string 'klein-9b' (reserved by MPI-357), so
    // this ModelDef landing is what makes the proof step reachable for the first time —
    // the user requests access at Black Forest Labs and pastes a Hugging Face token before
    // the download unlocks. Nothing to wire here; do not add a `licence` field.
    // Outputs are commercially usable (NCL §2.d) — the bar is on using the MODEL.
    //
    // ITS OWN SEVEN STYLES, not 4B's eight. Three are the same creator's 9B build of the
    // weight 4B ships (anime/chibi/doodle); muppets and jojo have no 9B weight in
    // existence; the rest are substitutes by other creators, so the LABELS differ from
    // 4B's rather than mirroring them — 'Comic' is a pulp comic LoRA, not JoJo. Do not
    // "restore parity" with the 4B list: it would rename a weight after a style it does
    // not produce. Provenance + licences: loraDeps.js § Klein 9B style LoRAs.
    //
    // `Input_is_9b` is GONE. It existed only to route around both halves of the styles
    // system while 9B had none, and a filename swap could never have expressed a 7-vs-8
    // difference in labels and trigger text — so generate_klein.py bakes the whole rack
    // (slots + trigger lines) per size instead, from the same single template.
    //
    // HOSTING: the four weights ARE on R2 — verified by HEAD, every Content-Length
    // byte-exact against its dep `bytes` (2026-08-22). The seven style LoRAs went up in
    // the same pass. Do not trust a comment for this; the check is one `curl -sI` per URL
    // and this note was wrong once already.
    {
        id: 'klein-9b',
        // 'balanced' against 4B's 'low' — the two are genuine SIZE TIERS of one model, the
        // case modelFamily exists for. (MPI-316 rejected the family field for Krea2 because
        // those siblings are CONTENT variants; that reasoning does not reach here.) The
        // L/B badge only renders once 2+ tiers of the family are installed, so a 4B-only
        // user sees no change from 4B gaining the family key.
        sizeTier: 'balanced',
        featured: false,          // 4B carries the featured slot for the family
        name: 'FLUX.2 Klein 9B',  // see 4B's note — the size is part of the name (MPI-619)
        modelFamily: 'FLUX.2-Klein',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        image: 'klein-9b.webp',
        defaultUpscale: '4x-NMKD-Siax',
        type: 'klein',            // NOT a new type — reuses 4B's, so no consumer sweep
        enhanceRecipe: 'flux',
        supportedOps: ['t2i', 'i2i', 'control', 'kleinEdit', 'inpaint', 'detail', 'upscale'],
        loraStrengths: ['model'],
        capabilities: {
            multiStage: false, audio: false, negativePrompt: false, styleLoras: true,
            batch: false, turboToggle: false,
            depthSubject: true,
            depthSubject3: true,
            controlStrength: true,
        },
        // `negativePrompt: false` for the same measured reason as 4B: at cfg 1.0 the
        // negative is bit-identical, and the template no longer carries Input_Negative.
        // `turboToggle: false` because there is nothing to toggle — MPI-600 benched the
        // 9B turbo LoRA and the KV variant and rejected both, so one checkpoint ships.
        opInject: {
            t2i:           { Input_wf_type: 1 },
            i2i:           { Input_wf_type: 2 },
            control:       { Input_wf_type: 3 },
            kleinEdit:     { Input_wf_type: 4 },
            inpaint:       { Input_wf_type: 5 },
            detail:        { Input_wf_type: 6 },
            upscale:       { Input_wf_type: 7 },
        },
        controlTypes: ['depth'],
        // Same reach as 4B: the rack lives in the ONE graph both sizes are baked from, so
        // it is live on every op including detail and upscale.
        styleOps: ['t2i', 'i2i', 'control', 'kleinEdit', 'inpaint', 'detail', 'upscale'],
        imageSizedOps: ['control', 'kleinEdit'],
        // Index-aligned with the 9B graph's trigger lines and its MpiStyleLoras banks
        // (bank 1 = cartoon/comic/anime/chibi/doodle, bank 2 = vintage/aesthetic + three
        // empty slots). Index 0 = no style, selector 0. SEVEN styles — the labels are NOT
        // 4B's, see the header comment.
        styleLoraLabels: [
            'None', 'Storybook', 'Comic', 'Anime',
            'Chibi', 'Doodle', 'Vintage', 'Watercolour',
        ],
        // All eight produced and on disk in comfy_workflows/display/ (2026-08-22), index 0
        // being the no-style baseline: the same prompt with the rack off, so the grid reads
        // as a comparison. A missing entry falls back to a placeholder card — which is what
        // let the rack ship testable before the art existed.
        styleLoraImages: [
            'klein-9b-style-none.webp', 'klein-9b-style-storybook.webp', 'klein-9b-style-comic.webp',
            'klein-9b-style-anime.webp', 'klein-9b-style-chibi.webp', 'klein-9b-style-doodle.webp',
            'klein-9b-style-vintage.webp', 'klein-9b-style-watercolour.webp',
        ],
        gen_speed: 'balanced',
        description: 'FLUX.2 Klein at 9B — the same seven operations as the 4B card with more detail and stronger prompt adherence, traded against speed and a non-commercial model licence you confirm before downloading (the IMAGES you make stay commercially usable). Needs roughly 15GB of video memory at peak, so on a 16GB card the margin is thin; the 4B card is the one to use if you hit out-of-memory. Seven style LoRAs are available on every operation — a different set from the 4B card, because most styles have no 9B version at all. Reference-driven placement lands about two times in three on every 9B weight tested, and it fails quietly — if it places the wrong person, or nobody, run it again.',
        workflows: {
            // ONE file for all seven ops, baked by generate_klein.py from the shared template.
            t2i:           'klein_9b_t2i.json',
            i2i:           'klein_9b_t2i.json',
            control:       'klein_9b_t2i.json',
            kleinEdit:     'klein_9b_t2i.json',
            inpaint:       'klein_9b_t2i.json',
            detail:        'klein_9b_t2i.json',
            upscale:       'klein_9b_t2i.json',
        },
        dependencies: [
            'klein-9b-transformer',
            'qwen3-8b-clip',                 // Qwen3-8B TEXT-ONLY at CLIPLoader type flux2 —
                                             // NOT qwen3-4b-clip (4B) and NOT the Qwen3-VL 8B
            'vae-flux2',                     // shared with 4B
            'klein-9b-lora-refcontrol-depth',// baked on the depth branch; IS the depth op
            'klein-9b-lora-nsfw',            // baked + PROMPT-gated; never loads on a clean prompt
            // NO outpaint LoRA: none exists for 9B, and the 4B one is deprecated (MPI-603).
            // Seven styles, NOT the 4B eight — different weights, different labels.
            'klein-9b-style-storybook',
            'klein-9b-style-comic',
            'klein-9b-style-anime',
            'klein-9b-style-chibi',
            'klein-9b-style-doodle',
            'klein-9b-style-vintage',
            'klein-9b-style-watercolour',
            '4x-NMKD-Siax',                  // shared engineAsset (upscale op)
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',
            'ComfyUI-Impact-Pack',
            'ComfyUI-UltimateSDUpscale',
            'comfyui-inpaint-cropandstitch',
            'comfyui_controlnet_aux',
            'LanPaint',                      // LanPaint_KSampler — REAL mask-conditioned inpaint
        ],
    },
    // ── Boogu-Image-Edit (MPI-257) ─────────────────────────────────────────
    // Unified 10B instruction image-edit (Apache-2.0). ONE graph, three quality
    // TIERS shipped as three sibling cards (shared modelFamily + name; the L/B/H
    // badge disambiguates). Each card installs only its tier's transformer; the
    // runtime file (generate_boogu.py) bakes the tier's UNETLoader weight + the
    // Input_Tier int that selects that tier's sampler chain. See
    // docs/playbooks/add-model/03-model-registry.md § "Multi-tier models".
    //
    // Op = the existing `edit` (image+prompt → whole-image edit, dims from source,
    // no ratio picker). `type: 'boogu'` is new → only consumer is `enhanceRecipe ??
    // type` (set below). No ratios/qualityTiers: edit has no size selector, like PiD.
    // User LoRA rack (Input_Lora_1..6) is live → settings gear shown, model-only.
    // High/Balanced run cfg 4/3.5 (negatives fire); Low is turbo cfg 1 (negatives
    // ignored, negativePrompt:false).
    {
        id: 'boogu-edit-high',
        sizeTier: 'high',
        modelFamily: 'Boogu-Image-Edit',
        name: 'Boogu Image Edit',
        dropdownMeta: 'EDIT',
        mediaType: 'image',
        image: 'boogu-edit-high.webp',
        type: 'boogu',
        enhanceRecipe: 'flux',   // no 'boogu' recipe is registered; keep 'boogu' out of the sweep
        supportedOps: ['edit'],
        loraStrengths: ['model'],
        capabilities: { multiStage: false, audio: false, negativePrompt: true },
        gen_speed: 'slow',
        description: 'Boogu Image Edit is a unified 10B instruction image editor. Describe the change you want and it edits the image while preserving the rest. The High tier uses the full bf16 weights at 30 steps for the best quality; needs the most VRAM.',
        workflows: {
            edit: 'boogu_edit_high.json',
        },
        dependencies: [
            'boogu-edit-transformer-high',
            'boogu-qwen3vl-8b-clip',
            'vae-flux-ae',            // shared — already on R2, zero upload
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',        // SetNode/GetNode
            'ComfyUI-Impact-Pack',    // To/FromBasicPipe
            'comfyui-inpaint-cropandstitch', // InpaintCropImproved/StitchImproved (localised edit)
        ],
    },
    // Balanced = turbo int8_convrot (promoted from 'low'). fp8_scaled Balanced tier DROPPED
    // — dark/underexposed on Blackwell (sm_120), MPI-266. int8_convrot is Blackwell-safe,
    // faster, and higher quality than fp8_scaled on all NVIDIA (ComfyUI dev consensus). Still
    // a cfg-1 turbo (8-step) ⇒ negatives are a no-op → negativePrompt:false (unchanged).
    {
        id: 'boogu-edit-balanced',
        sizeTier: 'balanced',
        modelFamily: 'Boogu-Image-Edit',
        name: 'Boogu Image Edit',
        dropdownMeta: 'EDIT',
        mediaType: 'image',
        image: 'boogu-edit-balanced.webp',
        type: 'boogu',
        enhanceRecipe: 'flux',
        supportedOps: ['edit'],
        loraStrengths: ['model'],
        capabilities: { multiStage: false, audio: false, negativePrompt: false },
        gen_speed: 'balanced',
        description: 'Boogu Image Edit is a unified 10B instruction image editor. Describe the change you want and it edits the whole image while preserving the rest. The Balanced tier uses a distilled turbo (int8) weight at 8 steps — fast, lower VRAM, and consistent across NVIDIA GPUs. Fastest on NVIDIA RTX (Turing+); older or non-NVIDIA GPUs may be slow. Its understanding is not as deep as the High tier, but it is still a capable image editor.',
        workflows: {
            edit: 'boogu_edit_balanced.json',
        },
        dependencies: [
            'boogu-edit-transformer-balanced',
            'boogu-qwen3vl-8b-clip',
            'vae-flux-ae',
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',
            'ComfyUI-Impact-Pack',
            'comfyui-inpaint-cropandstitch', // localised edit — MPI-428
        ],
    },
    // ── Video Models ───────────────────────────────────────────────────
    {
        id: 'wan-22',
        sizeTier: 'balanced',
        modelFamily: 'Wan-2.2',
        name: 'Wan 2.2 Smooth',
        dropdownMeta: 'VIDEO',
        mediaType: 'video',
        // branchingContinue: per-stage LoRAs vary the stage-2 result, so WAN
        // previews expose Continue (branch a new card) + Finish. LTX omits it
        // (no per-stage LoRA variance → Finish-only). See commandRegistry
        // commandAllowsBranchingContinue.
        // motion: WAN's i2v workflow has an Input_Motion_Intensity node, so the
        // motion control is live. LTX has no such node → omits motion → the
        // MpiPromptBox motionIntensity control is hidden for it.
        // singleFileStages (MPI-452/MPI-456): WAN migrated to MpiStageLatents, so ONE
        // graph now serves both passes and the `_stage2` twins are DELETED. This flag is
        // what stops resolveWorkflowFile naming them. It is not cosmetic — a stale twin
        // still on disk would be found and RUN, silently producing the old graph's
        // output, which is worse than H3's missing-file 404 because nothing errors.
        capabilities: { multiStage: true, audio: false, branchingContinue: true, motion: true, singleFileStages: true },
        video: 'wan22_preview.mp4',
        type: 'wan',
        // Which LoRA strength knobs the settings UI shows for this model. Wan
        // workflows read strength_model only — strength_clip is inert — so we
        // surface just the Model slider. Omit → both (default). Future models
        // that are clip-only can set ['clip'].
        loraStrengths: ['model'],
        loraStages: [
            { key: 'high', label: 'HIGH NOISE', injectionPrefix: 'Lora_High' },
            { key: 'low', label: 'LOW NOISE', injectionPrefix: 'Lora_Low' },
        ],
        // MPI-470: t2v_ms DEPRECATED — image-to-video only. LTX 2.3 (plus H3 and the 5B
        // card) covers text-to-video, and the t2v pair was a third-party community merge
        // costing 27.1GB; the i2v pair is our own. The `wan-22-t2v-*` DEPS entries are
        // deliberately KEPT (see modelDeps.js) so the uninstall orphan sweep can still
        // reclaim them from existing users' disks. Nothing may re-add t2v_ms here without
        // restoring the deleted wan22_t2v graph + its template.
        supportedOps: ['i2v_ms'],
        gen_speed: 'fast',
        description: "This video generator uses the Wan 2.2 SmoothMix models. Providing any style in image to video. It's fast and completely uncensored. It creates videos at 16 fps, so it is advisable to interpolate them later.",
        workflows: {
            i2v_ms: 'wan22_i2v.json',
        },
        // FLAT dependencies. This was the last `commonDeps` + `operations{}` model in
        // the library, kept after MPI-470 dropped t2v_ms only so the op-keyed resolver
        // still had a live exemplar. That cost a one-entry "Operations: Image to Video"
        // toggle row on the model card — a choice with nothing to choose. Per-model
        // operation GROUPS are gone as a product shape: a model installs as one unit,
        // and an op it can run is an op it ships with. Same dep set, same bytes on
        // disk, so an existing install stays installed.
        dependencies: [
            'wan_2.1_vae',
            'umt5_xxl_fp8_e4m3fn_scaled',
            'ComfyUI-MpiNodes',
            'ComfyUI-VideoHelperSuite',
            'comfyui-kjnodes',
            'wan-22-i2v-high',
            'wan-22-i2v-low',
            'ComfyUI-PainterI2Vadvanced',
        ],
    },
    {
        id: 'ltx-23',
        // MPI-200: this is now the HIGH (quality-ceiling) tier — the bf16 transformer.
        // The balanced tier ships as the separate `ltx-23-balanced` card below (same
        // modelFamily), per the sizeTier contract "one tier per card". The L/B/H badge
        // + dropdown letter surface only when 2+ tiers of LTX-2.3 are installed.
        sizeTier: 'high',
        modelFamily: 'LTX-2.3',
        name: 'LTX 2.3',
        dropdownMeta: 'VIDEO',
        mediaType: 'video',
        // MPI-128: dual-latent (video+audio) stage-2 staging wired, so the
        // previewStage toggle + preview→Finish are unlocked. multiStage:true shows
        // the toggle on the shared _ms ops. NO branchingContinue → Finish-only
        // (Continue button hidden): the refined LTX workflow locks stage-2 to
        // stage-1 and the prompt has no effect on the continuation, so a re-prompted
        // branch is meaningless. audio:true surfaces the audio media slot + the
        // Reference|Original mode UI.
        // singleFileStages (MPI-466): LTX migrated onto MpiStageLatents, so ONE graph
        // carries both passes and `resolveWorkflowFile` must stop appending _stage2 —
        // that twin no longer exists and Finish would 404 on it.
        capabilities: { multiStage: true, audio: true, singleFileStages: true },
        video: 'ltx23_high_preview.mp4',
        type: 'ltx',
        // LTX has 6 flat user LoRA slots (Input_Lora_1..6), no high/low staging →
        // no loraStages. The Input_Lora_* nodes have a live strength_clip input
        // (default 1.0) and some LTX LoRAs use it, so surface both knobs. (MPI-224)
        loraStrengths: ['model', 'clip'],
        supportedOps: ['t2v_ms', 'i2v_ms'],
        gen_speed: 'medium',
        description: 'This video generator is one of the best open source models available. It comes with synchronized audio — reference-voice and direct-audio modes.',
        // ONE graph for both ops (MPI-466). t2v / start-frame / end-frame / both are
        // reachable in the same file because routing derives from which media strings
        // are filled, not from an op boolean — so the op→file map no longer encodes
        // the mode. supportedOps still splits them: it drives which media slots the UI
        // offers, which is a different question from which graph runs.
        workflows: {
            t2v_ms: 'ltx_i2v_t2v.json',
            i2v_ms: 'ltx_i2v_t2v.json',
        },
        // MPI-190: engine split REVERTED, GGUF fully removed. cu130 (MPI-187/189)
        // collapsed the aimdo cold-fault tax that was the GGUF transformer's only
        // justification, so both engines now run the SAME bf16 transformer + the SAME
        // workflow files — no `engines:` block, no `_gguf` suffix. The bf16 also removes
        // the ComfyUI-GGUF dequant upcast spike that OOM'd LTX i2v on the 24GB 4090
        // (MPI-185). bf16 i2v proven CLEAN on the 4090; the Q8 weights + GGUF deps are
        // deleted (R2 + registry).
        // FLAT model: one transformer serves both t2v and i2v, so there is no
        // separable install unit — both ops ship together (like an image model).
        // `dependencies` (not commonDeps/operations) ⇒ no per-op install toggle in
        // the manager; install once, both ops work. When a future op needs its OWN
        // weights, split it into operations{} then and a toggle appears.
        // First model with non-merged baked LoRAs (transition/soft/talkvid) shipped
        // as deps, NOT user slots — see [[project-ltx-transition-lora-enables-lipsync]].
        //
        // NO engine split (MPI-190): the bf16 transformer runs on BOTH engines now, so
        // it sits in `dependencies` with the rest — no `engines:` block. The Gemma CLIP
        // (fp4_mixed) is likewise shared. The baked LoRA is the merged
        // soft+abliterated+detailer file. (MPI-168)
        dependencies: [
            'ltx23-transformer-bf16',
            'ltx23-video-vae',
            'ltx23-audio-vae',
            // 22MB tiny TAEHV, live previews only (MPI-508). It feeds the `vae` input of
            // MpiVideoSamplingPreview, which decodes real frames instead of the blocky
            // latent_rgb_factors fallback (MPI-575 moved this off KJNodes' node).
            'ltx23-preview-taehv',
            'ltx23-text-projection',
            'ltx23-gemma-clip',
            'ltx23-spatial-upscaler',
            'ltx23-lora-merged',
            'ltx23-lora-transition',
            'ltx23-lora-talkvid',
            'ComfyUI-LTXVideo',
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',
        ],
    },
    {
        // MPI-200: LTX-2.3 BALANCED tier. Same base as `ltx-23` HIGH, but the 42GB
        // bf16 transformer is replaced by a 20GB one that FITS 32GB — which kills the
        // aimdo stage-2 eviction thrash MPI-197 traced (bf16-never-fits → 48s@10s /
        // 116s@20s stage boundary). Same modelFamily so the two cluster under one
        // L/B/H badge.
        // MPI-466: the arch-gated PAIR (fp8_scaled / mxfp8_block32) became ONE int8
        // weight that runs on every GPU, so `variants.arch` is gone and with it the
        // `_fp8`/`_mxfp8` workflow suffixes. This card is now a pure QUALITY tier —
        // the only difference from HIGH is which transformer the graph loads.
        id: 'ltx-23-balanced',
        sizeTier: 'balanced',
        modelFamily: 'LTX-2.3',
        name: 'LTX 2.3',
        dropdownMeta: 'VIDEO',
        mediaType: 'video',
        capabilities: { multiStage: true, audio: true, singleFileStages: true },
        video: 'ltx23_balanced_preview.mp4',
        type: 'ltx',
        // Same LoRA node shape as ltx-23 High: live strength_clip input, surface
        // both knobs. (MPI-224)
        loraStrengths: ['model', 'clip'],
        supportedOps: ['t2v_ms', 'i2v_ms'],
        gen_speed: 'fast',
        description: 'This video generator is one of the best open source models available. It comes with synchronized audio — reference-voice and direct-audio modes. A faster tier that trades a little quality for speed and lighter VRAM use.',
        // The int8 sibling of the High card's file — same graph, different transformer
        // baked by generate_ltx.py. No suffix is resolved any more: the arch axis that
        // produced one is gone, so the filename is named outright.
        workflows: {
            t2v_ms: 'ltx_i2v_t2v_int8.json',
            i2v_ms: 'ltx_i2v_t2v_int8.json',
        },
        // The High card's set with the int8 transformer in place of the bf16. Every
        // other weight — both VAEs, the Gemma CLIP, the projection, the upscaler and
        // the three baked LoRAs — is shared, and the base is still distilled-1.1, so
        // the LoRAs stay on the generation they were tuned against.
        dependencies: [
            'ltx23-transformer-int8',
            'ltx23-video-vae',
            'ltx23-audio-vae',
            // Same 22MB preview decoder as the High tier (MPI-508) — shared, one download.
            'ltx23-preview-taehv',
            'ltx23-text-projection',
            'ltx23-gemma-clip',
            'ltx23-spatial-upscaler',
            'ltx23-lora-merged',
            'ltx23-lora-transition',
            'ltx23-lora-talkvid',
            // Foley V2A (MPI-536) — the ltx-foley FLOW's LoRA, on THIS tier only.
            // Its graph bakes the int8 transformer, so the High card cannot run the
            // Flow; listing it there too would cost those users 216MB for nothing.
            // The three LoRAs above sit on both tiers because the shipped t2v/i2v
            // graphs load them on both — that is not the case here.
            'ltx23-lora-foley',
            'ComfyUI-LTXVideo',
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',
        ],
    },
    {
        id: 'minimax-h3',
        // THE ID IS LOAD-BEARING BEYOND THIS FILE. MPI-451's licence gate looks up
        // MODEL_LICENCES by model id in js/data/modelConstants/licences.js, and its H3
        // descriptor is keyed 'minimax-h3'. Rename this and the lookup MISSES — no error,
        // no warning, H3 just installs with no consent step, which is precisely what the
        // flow-down commitment in our authorization forbids. Confirmed with the MPI-451
        // session 2026-08-06 before this def was written.
        sizeTier: 'balanced',
        featured: true,
        modelFamily: 'MiniMax-H3',
        name: 'MiniMax H3',
        // The computed floor (25% of 33.9GB of weights, rounded up onto the 8GB grid)
        // lands on 16GB and reads as "your 12GB card need not apply". Users run H3 on
        // 8GB with community GGUF quants; we ship int8, so 12 is the honest floor for
        // OUR weights. Declared per-model rather than by moving K, which would re-floor
        // every model in the library. See footprint.js `minVramGb`.
        minVramGb: 12,
        dropdownMeta: 'VIDEO',
        mediaType: 'video',
        // multiStage: the ONE graph carries both sampler passes and picks between them
        // with the MpiStageLatents widgets `Input_Video_Latent.is_preview` /
        // `.is_continue` (node 320), so there is no _stage2 twin file.
        // singleFileStages says exactly that to resolveWorkflowFile, which otherwise
        // appends _stage2 to EVERY multi-stage model and 404s Finish on a file that must
        // never exist (MPI-452). Declared rather than probed so the resolver stays pure.
        // NO branchingContinue → Finish-only, same call as LTX: stage 2 resumes from the
        // stage-1 latent, so a re-prompted branch would not honour the new prompt.
        // audio is deliberately ABSENT even though H3 outputs sound. capabilities.audio
        // surfaces an audio INPUT slot plus the audioMode/useAudio controls
        // (MpiPromptBox.js), and fl2va accepts no audio — it only EMITS it, muxed into
        // the mp4 by MpiSaveVideo(use_audio: true). The reference model that does take
        // audio in is ref2va (minimax-h3-ref2va), and that one wants audio: true.
        // negativePrompt: false because H3 HAS no negative input — neither variant's graph
        // carries an Input_Negative node, and there is no way to force one (the conditioning
        // comes out of a single Qwen3-VL encode). Without this the box rendered a negative
        // field that injection silently skipped: the user typed a stop that never reached
        // the model, and nothing said so. Confirmed by the user 2026-08-07 (MPI-475).
        // h3TurboToggle arms the `h3Turbo` control (MPI-505), which injects Input_is_Turbo.
        // Its OWN flag, not krea2's `turboToggle`: that one is wired to a control which
        // also emits `prompt:krea2-turbo` to hide the negative toggle, and both controls
        // would then share one perModel storage key across two model families.
        capabilities: { multiStage: true, singleFileStages: true, negativePrompt: false, h3TurboToggle: true },
        video: 'minimax_h3_preview.mp4',
        // type drives the ratio ladder. 'h3' is NOT arbitrary: RATIO_MODES.h3,
        // BUILTIN_RATIOS.h3 and BUILTIN_QUALITY_TIERS.h3 were all authored against this
        // string in js/utils/ratios.js (MPI-449) and tests/ratio-modes-exhaustive.test.cjs
        // guards the set. Native is `medium` (768x1344) since MPI-704 — it was `high`
        // until 2026-09-06, and moved because native output reads as draft grade under a
        // label that promised otherwise. `high` (960x1664) and above extrapolate past the
        // trained canvas — final-render tiers, not iterate tiers, because 2x the pixels
        // costs 3.3x the time.
        type: 'h3',
        // Six flat user slots on MpiLoraModelClip, which exposes model AND clip strength.
        // The clip half matters here more than usual: H3's "clip" is the Qwen3-VL tower
        // and it ingests the KEYFRAME as well as the prompt. NOTE for anyone adding a
        // LoRA dep — model_lora_keys_unet has no H3 branch, so a Diffusers-format H3 LoRA
        // loads with NO ERROR and does nothing; only plain diffusion_model.* /
        // lora_unet_* keys map. (MPI-449 § 4a)
        loraStrengths: ['model', 'clip'],
        // _ms ops because the model IS multi-stage. One workflow file serves both: the
        // op does not select a branch here — routing derives from which media is present
        // (has_img1/has_img2), so t2v and i2v are the same graph with an empty vs filled
        // Input_Start_Frame.
        supportedOps: ['t2v_ms', 'i2v_ms'],
        gen_speed: 'slow',
        description: 'Generates video with synchronized stereo audio in a single pass — no separate audio step. Strong at natural motion and camera movement.',
        workflows: {
            t2v_ms: 'minimax_h3_fl2va.json',
            i2v_ms: 'minimax_h3_fl2va.json',
        },
        // FLAT dependencies (not commonDeps/operations): ONE transformer serves both ops,
        // so there is no separable install unit and no per-op toggle in the manager.
        // The TRANSFORMER is not on R2 and that is deliberate — see
        // minimax-h3-fl2va-transformer in modelDeps.js for the licence reasoning. Two
        // deps here ARE R2-primary and are exceptions of different kinds: the int8 video
        // VAE (MPI-517, a supply reason) and the text encoder (MPI-653/MPI-698, out of
        // the CLA's scope entirely). Both are argued on their own dep in assetDeps.js —
        // read the section header there before citing either. The encoder and both VAEs
        // are shared with the minimax-h3-ref2va card.
        dependencies: [
            'minimax-h3-fl2va-transformer',
            // int8_convrot Heretic, NOT the 14.61GB nvfp4_awq. MPI-698 swapped to nvfp4
            // to stop the int8 pair OOM-killing a 54GB Pod, and the swap was REVERTED the
            // same day on output quality (entity duplication). The Pod OOM is therefore
            // BACK and is a known open cost — evidence and the tier plan are on the
            // `h3-qwen3vl-32b-clip` dep in assetDeps.js.
            'h3-qwen3vl-32b-clip',
            // int8_convrot, NOT the fp16 build — REQUIRES core >= v0.31.0 (MPI-517).
            'vae-minimax-h3-video-int8',
            'vae-minimax-h3-audio',
            // 1.82GB turbo distill (MPI-505; lightx2v in MPI-508, v1.0 resized in MPI-662,
            // the full 8-step v1.0 in MPI-687). NOT shared with ref2va — that card takes
            // its own ref2v-trained distill, so installing both models downloads two turbo
            // LoRAs. A flat dep like krea2's accelerator rather than an opt-in extra: turbo
            // is a per-run toggle, so the weight has to be on disk before the user can flip
            // it. Since MPI-687 the arm is an MpiIfElse switch, so with turbo OFF the LoRA
            // node is bypassed outright and the file is never read.
            // The 0.41GB 4-step 'minimax-h3-turbo-lora' it replaces stays defined in
            // loraDeps.js so the orphan sweep can still reclaim it — just not listed here.
            'minimax-h3-fl2va-turbo-8step',
            // The two-pass shape's upscaler — node + weight, both hard deps since MPI-687.
            // Stage 1 samples at half-res, the weight lifts the video half of the packed AV
            // latent, a 3-step refine rebuilds detail. Shared with ref2va, one download.
            'Comfyui_Minimax_h3_latent_Upscaler',
            'minimax-h3-latent-upscaler',
            // 22MB tiny TAE, live previews only (MPI-508). H3 has NO core previewer path
            // at all — its latent format names no decoder — so without this every H3
            // preview is a latent2rgb colour blob. Read by KJNodes' ModelPreviewOverrideKJ,
            // never by ComfyUI itself. Shared with ref2va, one download.
            'taeh3-decoder',
            'ComfyUI-MpiNodes',
        ],
    },
    {
        // MPI-475. The reference half of H3, and a SEPARATE model rather than an op on
        // 'minimax-h3' for three independent reasons, any one of them sufficient:
        // a different DiT (another 20.97GB, not a variant); MiniMaxH3ReferenceToVideo
        // sets `minimax_refs` and NEVER `minimax_keyframes`, so it cannot express
        // start/end-frame conditioning at all; and it additionally requires audio_vae
        // and ref_image_size, which fl2va has no inputs for.
        //
        // The id must stay in step with js/data/modelConstants/licences.js, which already
        // maps 'minimax-h3-ref2va' to the same MINIMAX_H3 descriptor as fl2va. Receipts
        // are keyed by LICENCE id, so a user who accepted during an fl2va install gets NO
        // second dialog here. That silence is deliberate — do not read it as a missing gate.
        id: 'minimax-h3-ref2va',
        featured: true,
        sizeTier: 'balanced',
        modelFamily: 'MiniMax-H3',
        name: 'MiniMax H3 Reference',
        // Same 12GB floor as fl2va, and not by copy-paste: the two dep sets weigh within
        // 0.12GB of each other (47.91GB here, 48.03GB there — the transformers are
        // 19.53GB each, 28.09GB is shared, and only the turbo LoRAs differ since
        // MPI-662), so the computed floor is the identical 16GB overstatement.
        minVramGb: 12,
        dropdownMeta: 'VIDEO',
        mediaType: 'video',
        // multiStage + singleFileStages: the ONE graph carries both sampler passes and
        // picks between them on the MpiStageLatents widgets (node 320), exactly as fl2va
        // does — so there is no _stage2 twin and resolveWorkflowFile must not look for one.
        // NO branchingContinue → Finish-only: stage 2 resumes from the stage-1 latent, so
        // a re-prompted branch could not honour the new prompt.
        //
        // audio: true, UNLIKE fl2va. Here it is load-bearing rather than cosmetic —
        // filterMediaInputsForModel hard-drops every audio slot from a model that does not
        // declare it, so without this the three audio reference wells vanish.
        // negativePrompt: false is what keeps that honest: capabilities.audio also arms
        // the MPI-474 audio-negative stop, and this graph has no Input_Negative_Audio node
        // (nor an Input_Negative) to receive either prompt. Dropping the whole negative
        // toggle removes both in one move instead of shipping two fields that inject
        // nowhere. NOTE: 'minimax-h3' above has the same missing-Input_Negative shape and
        // does NOT set this — pre-existing, tracked on MPI-475, not fixed here.
        // h3TurboToggle: same toggle as fl2va, but since MPI-662 it arms a DIFFERENT
        // weight at a DIFFERENT strength — this card's own ref2v distill at 1.0, against
        // fl2va's v1.0 at 0.75. (See the fl2va card for why this is not krea2's
        // `turboToggle`.)
        capabilities: { multiStage: true, singleFileStages: true, audio: true, negativePrompt: false, h3TurboToggle: true },
        // ponytail: the fl2va clip, on loan. A ref2va showcase has to wait for a run judged
        // on the CORRECT transformer — every r2va result before the 2026-08-07 re-export
        // came off the fl2va DiT and ignored its references, so no existing clip can be
        // trusted to show what this model does. Swap the filename, nothing else.
        video: 'minimax_h3_preview.mp4',
        // Same ratio ladder as fl2va — 'h3' is an existing type, so no consumer sweep.
        type: 'h3',
        loraStrengths: ['model', 'clip'],
        // ONE op. There is no t2v/i2v split to make: references never become frames, so
        // every run is the same shape and the presence of chips is the only variable.
        supportedOps: ['ref2v_ms'],
        gen_speed: 'slow',
        description: 'Keeps a character, place or voice consistent across generations from reference images alone — no training. Takes up to 9 images, 3 videos and 3 audio references, and outputs video with synchronized audio.',
        workflows: {
            ref2v_ms: 'minimax_h3_r2va.json',
        },
        // FLAT dependencies: one transformer, one op. The encoder and both VAEs are the
        // SAME dep ids fl2va uses, so installing this on top of fl2va downloads only the
        // 20.97GB transformer. The TRANSFORMER is not on R2 — see
        // minimax-h3-ref2va-transformer in modelDeps.js for the licence reasoning; the
        // int8 video VAE (MPI-517) and the text encoder (MPI-653/MPI-698) are the two
        // exceptions, each argued on its own dep in assetDeps.js.
        dependencies: [
            'minimax-h3-ref2va-transformer',
            // int8_convrot Heretic — see the fl2va card above for why the MPI-698 nvfp4
            // swap was reverted, and what it costs on a 54GB Pod.
            'h3-qwen3vl-32b-clip',
            // int8_convrot, NOT the fp16 build — REQUIRES core >= v0.31.0 (MPI-517).
            'vae-minimax-h3-video-int8',
            'vae-minimax-h3-audio',
            // Its OWN turbo distill since MPI-662 — NOT the fl2va weight, and MPI-687
            // re-proved that by measurement: the fl2v weight bound cleanly on this graph
            // but lost on grain and background detail at matched motion. MPI-687 moved it
            // from the 4-step v0.1 to the full 8-step v1.0, which is what lifted the
            // "shiny and plasticky" 4-step signature the refine could not recover from.
            // Both strength gates are gone — the arm is an MpiIfElse switch at strength 1.0
            // — so the old 1.0-vs-0.75 harmonisation warning no longer applies.
            // Installing both models downloads two turbo LoRAs (1.82GB each).
            'minimax-h3-ref2va-turbo-8step',
            // Same upscaler node + weight as fl2va (MPI-687) — shared, one download.
            'Comfyui_Minimax_h3_latent_Upscaler',
            'minimax-h3-latent-upscaler',
            // Same preview decoder as fl2va (MPI-508) — shared, one download.
            'taeh3-decoder',
            'ComfyUI-MpiNodes',
        ],
    },
    {
        id: 'wan22-5b',
        sizeTier: 'low',
        modelFamily: 'Wan-2.2',
        name: 'Wan 2.2 5B',
        dropdownMeta: 'VIDEO',
        mediaType: 'video',
        // Wan 2.2 TI2V-5B: one small transformer serves BOTH t2v + i2v (combined,
        // LTX-shape). SINGLE-STAGE (no ×2 upscaler stage) → multiStage:false, so no
        // previewStage/Continue. audio:false (no audio). NO branchingContinue →
        // Finish-only. motion NOT set: the 5B workflow has no Input_Motion_Intensity
        // node, so the motionIntensity control stays hidden (unlike wan-22 14B).
        capabilities: { multiStage: false, audio: false },
        video: 'wan22_5b_preview.mp4',
        type: 'wan5b',
        // Ships the quanhaol 4-step Turbo distill as a MODEL-ONLY LoRA (str 0.8,
        // baked in the workflow). No high/low staging (5B is dense, not MoE) → no
        // loraStages; user LoRA slots are flat model-strength only.
        loraStrengths: ['model'],
        // Reuse the wan enhance recipe (no 'wan5b' recipe is registered).
        enhanceRecipe: 'wan',
        // SINGLE-STAGE ops (t2v/i2v, NOT the multi-stage t2v_ms/i2v_ms) — matches
        // capabilities.multiStage:false. First video model to use the non-_ms ops.
        supportedOps: ['t2v', 'i2v'],
        gen_speed: 'fast',
        description: 'This fast low-tier video generator is a lightweight version of Wan 2.2.',
        // Combined transformer: both ops ship together (LTX pattern). generate_wan5b.py
        // bakes Input_Text_to_video from the template into the two runtime files.
        workflows: {
            t2v: 'wan5b_t2v.json',
            i2v: 'wan5b_i2v.json',
        },
        // FLAT deps (like LTX) — no per-op install toggle. clip (umt5) is SHARED with
        // the 14B card (already hosted); vae + model + turbo-lora are 5B-specific.
        dependencies: [
            'wan22-5b-model',
            'wan22-5b-turbo-lora',
            'wan2.2_vae',
            'umt5_xxl_fp8_e4m3fn_scaled',
            'ComfyUI-MpiNodes',
            'ComfyUI-VideoHelperSuite',
            'comfyui-kjnodes',
        ],
    },
    // Qwen-Image-Edit-2511 (MPI-300) — ONE card, not three.
    //
    // All three speed tiers share the SAME int8 transformer + TE + VAE; only the
    // accelerator Lightning LoRA differs. Three sibling cards would therefore have
    // pollute the library and make the user install ~20GB three times. Instead the
    // tier is a RUNTIME radio (`qwenTier` → Input_Tier, an MpiInt driving the graph's
    // MpiAnySwitch model path + step count): 1=Quality (raw ~20-step, no accelerator),
    // 2=Turbo (8-step LoRA), 3=Hyper (4-step LoRA). PiD's pidResolution is the
    // precedent for a runtime selector standing in for card variants.
    //
    // Op = qwenEdit (its own, NOT Boogu's shared `edit`) — three image slots, the tier
    // radio, and its own style rack. Output follows the source image dimensions
    // (ImageScaleToTotalPixels off the input), so there is no ratio picker, like PiD.
    {
        id: 'qwen-edit',
        sizeTier: 'balanced',
        modelFamily: 'Qwen-Image-Edit',
        name: 'Qwen Image Edit',
        dropdownMeta: 'EDIT',
        mediaType: 'image',
        image: 'qwen-edit.webp',
        type: 'qwen',
        enhanceRecipe: 'flux',   // no 'qwen' recipe is registered; keep 'qwen' out of the sweep
        // MPI-365: TWO ops now, both branches of the one master graph. Pose and depth
        // are not separate ops — they are the two `controlTypes` below.
        supportedOps: ['qwenEdit', 'control'],
        loraStrengths: ['model'],   // style LoRAs are model-only (no CLIP side)
        // tierSelect gates the qwenTier radio in MpiPromptBox._refreshOpSlot(). No prompt
        // enhancer in this graph (no TextGenerate node), which since MPI-728 costs it
        // nothing — enhancement is its own dispatch, on every model.
        capabilities: {
            multiStage: false, audio: false, negativePrompt: true, styleLoras: true,
            tierSelect: true, batch: false,
            // Qwen takes three images natively, so the control LINE runs to two
            // references: image 1 is the control map, images 2-3 the subject(s). Same
            // slots the edit op already used.
            depthSubject: true,
            depthSubject3: true,
            // NO controlStrength: Qwen conditions on the control IMAGE directly — there
            // is no ControlNet and no control LoRA, so nothing has a strength to scale.
            // Its graph has no Input_Control_strength node; the slider stays hidden.
        },
        // Op → the `Input_wf_type` value selecting its branch. Qwen's numbering is its
        // OWN (1 edit · 2 control) — it shares nothing with Klein's or Krea2's, which is
        // exactly why the value is model-private and lives here rather than on the
        // shared op. MUST cover every entry in supportedOps.
        //
        // NOTE the graph's baked Input_wf_type default is 2, so a missing entry here
        // would silently run CONTROL and return a plausible wrong image — the reason
        // commandExecutor warns on a gap and generate_qwen.py asserts the node exists.
        opInject: {
            qwenEdit: { Input_wf_type: 1 },
            control:  { Input_wf_type: 2 },
        },
        // Which structures this graph can copy, in picker order. Index into the control
        // switch comes from CONTROL_TYPES, not from this list — see commandRegistry.js.
        // Depth first because it is the one users reach for; the graph's own numbering
        // (1 = pose) is unaffected by the display order.
        controlTypes: ['depth', 'pose'],
        // One graph ⇒ the rack reaches both ops.
        styleOps: ['qwenEdit', 'control'],
        // Every Qwen op keeps the SOURCE image dimensions (ImageScaleToTotalPixels off
        // the input; Input_Width/Height were bypassed out of the graph), so the ratio
        // picker is hidden on all of them.
        imageSizedOps: ['qwenEdit', 'control'],
        // INDEX-ALIGNED with the workflow's seven MpiMath gates (`b if a == N`) and its
        // MpiPromptList trigger lines; index 0 = no style (every gate zeroed). NOTE the
        // two anime entries: slot 2 is Qwen-Anime-V2 (3D) and slot 3 is animal_style.
        // which is an anime-2D LoRA despite the filename. Confirmed by the user — do not
        // "correct" this pair to match the filenames.
        styleLoraLabels: [
            'None', 'Illustration', 'Anime 3D', 'Anime 2D',
            'Anime Zankuro', '3D', 'Caricature', 'SnapShot',
        ],
        // Style card images for the picker (index-aligned with styleLoraLabels;
        // comfy_workflows/display/). Index 0 = the no-style baseline gen.
        styleLoraImages: [
            'qwen-style-none.webp', 'qwen-style-illustration.webp', 'qwen-style-anime3d.webp',
            'qwen-style-anime2d.webp', 'qwen-style-zankuro.webp', 'qwen-style-3d.webp',
            'qwen-style-caricature.webp', 'qwen-style-snapshot.webp',
        ],
        gen_speed: 'fast',
        description: 'Qwen Image Edit 2511 is an instruction image editor: give it an image and describe the change, and it edits while preserving the rest. Takes up to three reference images at once, ships seven built-in style LoRAs, and keeps the source image dimensions. Pick a tier per run — Quality for the best result, Turbo or Hyper when you want it fast. It is at its best COMBINING images: take a character, face, garment, or object from one image and place it into another, and it keeps the reference recognisable. Refer to your images BY NUMBER in the prompt — "place the man and the woman from image 2 into the scene from image 1" — in the order you added them. (This is the opposite of Krea 2, which wants images described in natural language instead.) Single-image instruction edits are its weak side — simple attribute changes like recolouring a shirt work, but bigger rewrites tend to be ignored or come back with the framing and faces degraded. For those, try Boogu Image Edit or Krea 2.',
        workflows: {
            // ONE file for all three ops — branch chosen by opInject above (MPI-365).
            qwenEdit: 'qwen_edit.json',
            control:  'qwen_edit.json',
        },
        dependencies: [
            'qwen-edit-transformer',
            'qwen-edit-qwen25vl-7b-clip',
            'vae-qwen-image',            // shared with Krea2 — already on R2, zero upload
            'qwen-edit-lightning-4step', // Hyper tier accelerator
            'qwen-edit-lightning-8step', // Turbo tier accelerator
            'qwen-edit-style-illustration',
            'qwen-edit-style-anime3d',
            'qwen-edit-style-anime2d',
            'qwen-edit-style-zankuro',
            'qwen-edit-style-3d',
            'qwen-edit-style-caricature',
            'qwen-edit-style-snapshot',
            'ComfyUI-MpiNodes',
            // MPI-365: AIO_Preprocessor (DepthAnythingV2) + OpenposePreprocessor feed the
            // new depth/pose branches. There is NO ControlNet checkpoint — the maps go
            // into Qwen's own image conditioning — so this is a NODE dependency only.
            // It pulls its annotator weights itself on first use; DepthAnythingV2's are
            // already cached by Klein, the OpenPose ones (body/hand/face) are new.
            'comfyui_controlnet_aux',
        ],
    },

    // ── Cloud models (MPI-851) ────────────────────────────────────────────────
    // No weights, no graph, no engine. They run at DeepInfra on the key the prompt
    // enhancer and the agent already hold, and DeepInfra bills the user directly —
    // see the MPI-849 umbrella for why there is no credit system. Everything that
    // makes one work is the `provider` field above; the rest of this entry is an
    // ordinary ModelDef, so ratios, the op strip and Reuse behave as they always do.
    //
    // FLUX Schnell is the cheapest real generation on the platform (about $0.0005 at
    // 1 MP), which is what makes it the one that proves the path end to end. The rest
    // of Fabio's fifteen land with their tiles and preview art in MPI-853.
    {
        id: 'flux-schnell-cloud',
        name: 'FLUX Schnell (Cloud)',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: {
            endpointId: 'black-forest-labs/FLUX-1-schnell',
            // Deliberately empty. DeepInfra's own default step count is the one its
            // published per-image price assumes, so sending our own would quote the
            // user one number and bill them another.
            body: {},
            // The batch cap USED to be a hand-written `maxBatch: 4` here. It now comes
            // from the snapshot's own `limits.num_images.maximum` via `batchFieldFor()`
            // in deepinfraSizing.js — the same 4, one fewer number to keep true, and the
            // only way the fourteen models added below could each be capped correctly:
            // eleven have no native batch at all and Veo calls its own `sample_count`.
        },
        image: 'flux-schnell-cloud.webp',
        mediaType: 'image',
        type: 'flux',
        supportedOps: ['t2i'],
        // Distilled at cfg 1: a negative prompt does nothing, and the endpoint has no
        // field to put one in.
        capabilities: { negativePrompt: false },
        // Batch is REAL here and costs four times as much, because the provider bills per
        // image. It is the same control SDXL uses, capped at the same 4.
        batchOps: ['t2i'],
        description: 'FLUX Schnell running in the cloud on your own DeepInfra key, so it needs no GPU, no download and no engine. Four-step distilled: fast, cheap (about $0.0005 an image) and good at clean graphic images, product shots and quick concepts. You pay DeepInfra directly for what you use, and nothing is stored here but the picture.',
        // A cloud model ships no graph. The key is the install.
        workflows: {},
    },

    // ── The catalogue — Fabio's fifteen, 2026-09-20 (MPI-853) ─────────────────
    //
    // Every ratio table below is GENERATED by `_cloudRatios` / `_cloudVideoRatios`
    // (defined under the array — function declarations hoist) from the bounds the model
    // itself publishes, captured into `dev_configs/deepinfra-prices.json` by
    // scripts/sync-deepinfra-prices.mjs. Fifteen hand-typed tables would be fifteen
    // chances to quote a size the provider rejects, and nothing would catch it: an
    // out-of-range size is not an error here, it is a bill for the wrong picture.
    //
    // WHAT THE PIXELS MEAN DIFFERS BY MODEL, and the picker cannot show that:
    //   - FLUX 2 and Seedream get these pixels, near enough — they take real dimensions.
    //   - Nano Banana / Gemini take ONLY an `aspect_ratio` label. Their numbers here are
    //     nominal ~1 MP, which is all those models return anyway; the route sends the
    //     label and throws the pixels away.
    //   - The video models take a resolution TIER plus a ratio, so their numbers are the
    //     nominal frame at that tier.
    // deepinfraSizing.js is where that translation happens, once, for all of them.

    // ── Seedream ──────────────────────────────────────────────────────────────
    {
        id: 'seedream-4-cloud',
        name: 'Seedream 4',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'ByteDance/Seedream-4', body: {}, imageField: 'image' },
        // STAND-IN recipe, not an authored one. A model `type` with no recipe does
        // NOT fall back harmlessly — it resolves to `chroma`, a tag-soup SDXL-era
        // recipe that would be actively wrong here, and `tests/recipe-registry.test.cjs`
        // § testResolutionAudit exists to catch exactly that. `flux-2` is the closest
        // shipped recipe for these: natural-language, instruction-following, no tag
        // soup. Each of the new families deserves its own recipe via
        // /create-enhancer-recipe; until then this is an explicit choice rather than
        // a silent fallthrough.
        enhanceRecipe: 'flux-2',
        image: 'seedream-4-cloud.webp',
        mediaType: 'image',
        type: 'seedream4',
        qualityTiers: ['2k', '4k'],
        ratios: {
            '2k': _cloudRatios(SEEDREAM_ASPECTS, 2048, { min: 1280, max: 4096, step: 64 }),
            '4k': _cloudRatios(SEEDREAM_ASPECTS, 4096, { min: 1280, max: 4096, step: 64 }),
        },
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        capabilities: { negativePrompt: false, batch: false },
        description: 'ByteDance Seedream 4, running at DeepInfra on your own key — no GPU, no download. Strong at photographic scenes and readable text in the image, at 2K or 4K. About $0.04 an image, billed to you by DeepInfra.',
        workflows: {},
    },
    {
        id: 'seedream-45-cloud',
        name: 'Seedream 4.5',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'ByteDance/Seedream-4.5', body: {}, imageField: 'image' },
        // Stand-in, as above — see the note on seedream-4-cloud.
        enhanceRecipe: 'flux-2',
        image: 'seedream-45-cloud.webp',
        mediaType: 'image',
        type: 'seedream4',
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        capabilities: { negativePrompt: false, batch: false },
        description: 'Seedream 4.5 — the same shape as Seedream 4 with a newer checkpoint behind it: better prompt following and cleaner faces, at the same $0.04 an image. Runs at DeepInfra on your own key.',
        workflows: {},
    },
    {
        id: 'seedream-5-pro-cloud',
        name: 'Seedream 5.0 Pro',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        // `image_2`..`image_4` exist upstream; the route sends one reference, so the
        // extra slots are unused here rather than half-wired. This is also the only
        // model in the fifteen that bills per EXTRA input image ($0.0033 each) — which
        // is exactly why a second slot is not worth adding by accident.
        cloud: { endpointId: 'ByteDance/Seedream-5.0-Pro', body: {}, imageField: 'image' },
        // Stand-in, as above — see the note on seedream-4-cloud.
        enhanceRecipe: 'flux-2',
        image: 'seedream-5-pro-cloud.webp',
        mediaType: 'image',
        type: 'seedream5',
        // NO '1k' tier, deliberately. Its own field description says 1.5K "costs the same
        // as 1K and generates better images", so shipping 1K would offer a worse picture
        // at an identical price. 2K is the model's dearer band ($0.099 vs $0.0495).
        qualityTiers: ['1.5k', '2k'],
        ratios: {
            '1.5k': _cloudRatios(SEEDREAM_ASPECTS, 1536, { min: 1280, max: 4096, step: 64 }),
            '2k': _cloudRatios(SEEDREAM_ASPECTS, 2048, { min: 1280, max: 4096, step: 64 }),
        },
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        capabilities: { negativePrompt: false, batch: false },
        description: 'Seedream 5.0 Pro, the top of the Seedream line, on your own DeepInfra key. About $0.05 an image up to 1.5K and about $0.10 above it — the tier selector is what moves you between the two.',
        workflows: {},
    },

    // ── FLUX 2 ────────────────────────────────────────────────────────────────
    {
        id: 'flux2-dev-cloud',
        name: 'FLUX 2 Dev',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'black-forest-labs/FLUX-2-dev', body: {}, imageField: 'input_image_1' },
        image: 'flux2-dev-cloud.webp',
        mediaType: 'image',
        type: 'flux2',
        // The ONE model in the fifteen whose price scales with AREA and step count, so
        // this table is authored at the 1 MP class its published $0.01 assumes. A bigger
        // ratio row here would quietly raise every quote.
        ratios: {
            portrait: _cloudRatios(IMG_PORTRAIT, 1024, { min: 128, max: 1920 }),
            landscape: _cloudRatios(IMG_LANDSCAPE, 1024, { min: 128, max: 1920 }),
        },
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        enhanceRecipe: 'flux-2',
        capabilities: { negativePrompt: false, batch: false },
        description: 'FLUX 2 Dev in the cloud on your own DeepInfra key. The open FLUX 2 weights without the download: about $0.01 an image at this size. Price rises with pixels on this one, so a larger ratio costs more.',
        workflows: {},
    },
    {
        id: 'flux2-pro-cloud',
        name: 'FLUX 2 Pro',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'black-forest-labs/FLUX-2-pro', body: {}, imageField: 'input_image' },
        image: 'flux2-pro-cloud.webp',
        mediaType: 'image',
        type: 'flux2pro',
        // 256-1440, NOT the 128-1920 its Dev sibling takes. Same family, different box —
        // the reason these two cannot share a ratio type.
        ratios: {
            portrait: _cloudRatios(IMG_PORTRAIT, 1024, { min: 256, max: 1440 }),
            landscape: _cloudRatios(IMG_LANDSCAPE, 1024, { min: 256, max: 1440 }),
        },
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        enhanceRecipe: 'flux-2',
        capabilities: { negativePrompt: false, batch: false },
        description: 'FLUX 2 Pro on your own DeepInfra key — Black Forest Labs\' hosted tier, sharper and more literal than Dev. A flat $0.015 an image whatever size you pick.',
        workflows: {},
    },
    {
        id: 'flux2-max-cloud',
        name: 'FLUX 2 Max',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'black-forest-labs/FLUX-2-max', body: {}, imageField: 'input_image' },
        image: 'flux2-max-cloud.webp',
        mediaType: 'image',
        type: 'flux2pro',
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        enhanceRecipe: 'flux-2',
        capabilities: { negativePrompt: false, batch: false },
        description: 'FLUX 2 Max, the top FLUX tier, on your own DeepInfra key. The best prompt adherence of the three and the dearest at a flat $0.10 an image — worth it for a final, not for exploring.',
        workflows: {},
    },

    // ── Nano Banana / Gemini ──────────────────────────────────────────────────
    //
    // These four take NO dimensions at all — one `aspect_ratio` label from a fixed list,
    // and they return about 1 MP whatever you ask. The pixels below are nominal so the
    // picker has something to draw; the route sends the label.
    //
    // Their published list also offers '2:3' and '3:2', which are NOT shipped: there is
    // no rect_2_3 / rect_3_2 in js/utils/icons.js, and drawing one of the neighbouring
    // rectangles instead would tell the user a shape they are not getting. Fabio's call,
    // 2026-09-21. Add the two icons and they can join the table unchanged.
    {
        id: 'nano-banana-2-lite-cloud',
        name: 'Nano Banana 2 Lite',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'google/nano-banana-2-lite', body: {}, imageField: 'image' },
        // Stand-in, as above — see the note on seedream-4-cloud.
        enhanceRecipe: 'flux-2',
        image: 'nano-banana-2-lite-cloud.webp',
        mediaType: 'image',
        type: 'nanobanana',
        ratios: {
            portrait: _cloudRatios(IMG_PORTRAIT, 1024),
            landscape: _cloudRatios(IMG_LANDSCAPE, 1024),
        },
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        capabilities: { negativePrompt: false, batch: false },
        description: 'Google\'s Nano Banana 2 Lite on your own DeepInfra key — the cheap end of the family at about $0.034 an image, and very good at edits that keep the rest of the picture intact. Output is about 1 MP whatever ratio you pick.',
        workflows: {},
    },
    {
        id: 'nano-banana-2-cloud',
        name: 'Nano Banana 2',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'google/nano-banana-2', body: {}, imageField: 'image' },
        // Stand-in, as above — see the note on seedream-4-cloud.
        enhanceRecipe: 'flux-2',
        image: 'nano-banana-2-cloud.webp',
        mediaType: 'image',
        type: 'nanobanana',
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        capabilities: { negativePrompt: false, batch: false },
        // Its content filter refused this product's material twice during the research
        // while BOTH its cheaper and its dearer sibling accepted the identical request
        // (01d § 3). Shipped on Fabio's call. `CONTENT_FILTERED` in cloudExecutor.js is
        // the copy a user meets when it happens, and a refused call is not billed.
        description: 'Nano Banana 2 on your own DeepInfra key, about $0.067 an image. The middle of Google\'s family: better at faces and fine detail than Lite. Its content filter is stricter than either sibling\'s — if it refuses, try Lite or Pro, and nothing is charged for a refusal.',
        workflows: {},
    },
    {
        id: 'nano-banana-pro-cloud',
        name: 'Nano Banana Pro',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        // DeepInfra publishes this model a SECOND time as `google/gemini-3-pro-image` —
        // byte-identical pricing and input fields, and that card's own description calls
        // itself Nano Banana Pro. It shipped briefly as its own tile so both searchable
        // names were on the grid; Fabio dropped that tile on 2026-09-21 (MPI-864) because
        // two tiles for one model sells one thing twice. `deepinfraPricing.js` still prices
        // the second endpoint — the equivalence is a fact about DeepInfra, not about our
        // roster, and a saved history item naming it must still quote. Do not put it back
        // on the grid.
        cloud: { endpointId: 'google/nano-banana-pro', body: {}, imageField: 'image' },
        // Stand-in, as above — see the note on seedream-4-cloud.
        enhanceRecipe: 'flux-2',
        image: 'nano-banana-pro-cloud.webp',
        mediaType: 'image',
        type: 'nanobanana',
        supportedOps: ['t2i', 'edit'],
        imageSizedOps: ['edit'],
        capabilities: { negativePrompt: false, batch: false },
        description: 'Nano Banana Pro on your own DeepInfra key, about $0.134 an image — the strongest of the family at text in the image and at following a long prompt exactly. Google also calls it Gemini 3 Pro Image; it is the same model either way.',
        workflows: {},
    },

    // ── Video ─────────────────────────────────────────────────────────────────
    {
        id: 'seedance-15-pro-cloud',
        name: 'Seedance 1.5 Pro',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'ByteDance/Seedance-1.5-Pro', body: {}, imageField: 'first_frame_image' },
        video: 'seedance-15-pro-cloud.mp4',
        mediaType: 'video',
        type: 'seedance',
        qualityTiers: ['480p', '720p', '1080p'],
        ratios: {
            '480p': _cloudVideoRatios(SEEDANCE_ASPECTS, 480),
            '720p': _cloudVideoRatios(SEEDANCE_ASPECTS, 720),
            '1080p': _cloudVideoRatios(SEEDANCE_ASPECTS, 1080),
        },
        supportedOps: ['t2v', 'i2v'],
        enhanceRecipe: 'seedance-1.5',
        capabilities: { negativePrompt: false, batch: false },
        description: 'ByteDance Seedance 1.5 Pro on your own DeepInfra key — no GPU and no 30 GB download. Clips of 4 to 12 seconds with real camera movement. Billed per token, which works out at about $0.30 for five seconds at 1080p; shorter and smaller clips cost proportionally less.',
        workflows: {},
    },
    {
        id: 'seedance-2-cloud',
        name: 'Seedance 2.0',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'ByteDance/Seedance-2.0', body: {}, imageField: 'first_frame_image' },
        video: 'seedance-2-cloud.mp4',
        mediaType: 'video',
        type: 'seedance',
        supportedOps: ['t2v', 'i2v'],
        enhanceRecipe: 'seedance-2.0',
        capabilities: { negativePrompt: false, batch: false },
        // Its own feed publishes the CHEAP "with reference video" token band, which a
        // plain call does not get; deepinfraPricing.js overrides it with the measured
        // dear band. That override is why this description can quote $2.07 honestly.
        description: 'Seedance 2.0, the newest ByteDance video model, on your own DeepInfra key. Clips up to 15 seconds and a clear step up in motion and coherence — and much dearer than 1.5 Pro: about $2.07 for five seconds at 1080p. Check the estimate before you run it.',
        workflows: {},
    },
    {
        id: 'wan3-cloud',
        name: 'Wan 3.0',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        // Wan spells its tiers '1080P' and names its ratio field `ratio`, alone among the
        // six video models. Nothing here encodes that — deepinfraSizing.js reads both off
        // the snapshot, which is the whole reason it reads them off the snapshot.
        cloud: { endpointId: 'Wan-AI/Wan3.0-Video', body: {}, imageField: 'media' },
        video: 'wan3-cloud.mp4',
        mediaType: 'video',
        type: 'wan3',
        qualityTiers: ['480p', '720p', '1080p'],
        ratios: {
            '480p': _cloudVideoRatios(WAN3_ASPECTS, 480),
            '720p': _cloudVideoRatios(WAN3_ASPECTS, 720),
            '1080p': _cloudVideoRatios(WAN3_ASPECTS, 1080),
        },
        supportedOps: ['t2v', 'i2v'],
        enhanceRecipe: 'wan-2.2',
        capabilities: { negativePrompt: false, batch: false },
        description: 'Wan 3.0 on your own DeepInfra key — the hosted Wan, up to 30 seconds a clip. Priced per second and per tier: $0.05/s at 480p, $0.10/s at 720p, $0.20/s at 1080p, so five seconds at 1080p is about $1.00. Dropping a tier genuinely halves it.',
        workflows: {},
    },
    {
        id: 'veo-31-fast-cloud',
        name: 'Veo 3.1 Fast',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'google/veo-3.1-fast', body: {}, imageField: 'image' },
        // Stand-in, as with the image models above. `kling-3.0` is the closest
        // shipped recipe for Veo: a modern cloud video model prompted in cinematic
        // natural language rather than in Wan's shot-list style.
        enhanceRecipe: 'kling-3.0',
        video: 'veo-31-fast-cloud.mp4',
        mediaType: 'video',
        type: 'veo',
        qualityTiers: ['720p', '1080p'],
        ratios: {
            '720p': _cloudVideoRatios(VEO_ASPECTS, 720),
            '1080p': _cloudVideoRatios(VEO_ASPECTS, 1080),
        },
        supportedOps: ['t2v', 'i2v'],
        // Veo is the ONLY one of the fifteen that takes a negative prompt, and the only
        // video model with a native batch — `sample_count`, up to 4, one call and one
        // bill. Four Veo clips is about $12.80: MPI-854's single batch confirm is not a
        // nicety on this model.
        capabilities: { negativePrompt: true, batch: true },
        batchOps: ['t2v', 'i2v'],
        description: 'Google Veo 3.1 Fast on your own DeepInfra key, with sound. Fixed eight-second clips at $0.15 a second — about $1.20 each. The cheaper of the two Veos and the one to explore with.',
        workflows: {},
    },
    {
        id: 'veo-31-cloud',
        name: 'Veo 3.1',
        dropdownMeta: 'CLOUD',
        provider: 'deepinfra',
        cloud: { endpointId: 'google/veo-3.1', body: {}, imageField: 'image' },
        // Stand-in, as above — see the note on seedream-4-cloud.
        enhanceRecipe: 'kling-3.0',
        video: 'veo-31-cloud.mp4',
        mediaType: 'video',
        type: 'veo',
        supportedOps: ['t2v', 'i2v'],
        capabilities: { negativePrompt: true, batch: true },
        batchOps: ['t2v', 'i2v'],
        description: 'Google Veo 3.1 on your own DeepInfra key, with sound — the best video model in this list and the dearest. Fixed eight-second clips at $0.40 a second, about $3.20 each, so a batch of four is roughly $12.80. Read the estimate first.',
        workflows: {},
    },
];

// ── Cloud ratio generators (MPI-853) ─────────────────────────────────────────
//
// Declared after MODELS and called from inside it: function declarations hoist, so this
// keeps the array unbroken. The aspect LISTS cannot live here — `const` has no usable
// hoist — so they sit above the array with the rest of the module's constants.

/**
 * An area-preserving ratio table: every row is about `sidePx` squared, so changing the
 * ratio does not quietly change the price on a model billed by pixels.
 *
 * @param {string[]} aspects - 'W:H' labels, which must each have a rect_W_H icon
 * @param {number} sidePx - the square side whose AREA every row matches
 * @param {{min?:number, max?:number, step?:number}} [bounds] - the model's own limits
 */
function _cloudRatios(aspects, sidePx, bounds = {}) {
    const { min = 0, max = Infinity, step = 32 } = bounds;
    const area = sidePx * sidePx;
    return aspects.map((label) => {
        const [aw, ah] = label.split(':').map(Number);
        const aspect = aw / ah;
        const w = Math.sqrt(area * aspect);
        const h = Math.sqrt(area / aspect);
        // One factor for both sides, so the shape survives the model's box. Shrink to
        // clear the maximum first, then grow to clear the minimum.
        const scale = Math.min(max / Math.max(w, h), 1) * Math.max(min / Math.min(w, h), 1);
        return {
            label,
            w: _snapSide(w * scale, step),
            h: _snapSide(h * scale, step),
            icon: `rect_${label.replace(':', '_')}`,
        };
    });
}

/**
 * A video table, where the tier names the SHORT side: '1080p' 16:9 is 1920x1080 and
 * '1080p' 9:16 is 1080x1920, which is what those tier names mean everywhere else in the
 * app. These pixels are nominal — the route sends the tier and the ratio label.
 */
function _cloudVideoRatios(aspects, shortPx) {
    return aspects.map((label) => {
        const [aw, ah] = label.split(':').map(Number);
        const long = Math.round(shortPx * Math.max(aw, ah) / Math.min(aw, ah));
        const wide = aw >= ah;
        return {
            label,
            w: wide ? long : shortPx,
            h: wide ? shortPx : long,
            icon: `rect_${label.replace(':', '_')}`,
        };
    });
}

/** Round to the model's grid, never to zero. */
function _snapSide(value, step) {
    return Math.max(step, Math.round(value / step) * step);
}
