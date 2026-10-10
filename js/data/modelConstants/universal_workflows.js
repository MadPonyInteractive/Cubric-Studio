// ── Universal Workflows (not model-tied) ──────────────────────────────────────
// Available regardless of which model is active.
// Keys must match commandRegistry entries marked universal: true.
//
// Dependencies for universal workflows are the universal DEPS set (dependencies.js):
// every type:'custom_nodes' node + every engineAsset:true weight (MPI-222). They are
// installed automatically with the engine and are never tracked per-workflow.

/**
 * @typedef {Object} UniversalWorkflowDef
 * @property {string} workflow - Workflow filename in comfy_workflows/
 * @property {Record<string, string>} [byModel] - MPI-591. For a Flow whose picked model selects
 *   a DIFFERENT GRAPH rather than different params inside one. Keyed by model id; a run whose
 *   `flowModelIds` names one of these gets that file, and anything else falls through to
 *   `workflow`. Reach for `modelParams` (flowsRegistry) FIRST — it swaps widgets inside one
 *   graph and is the right answer whenever the candidates share a node set. This is only for
 *   candidates that do not.
 */

/** @type {Record<string, UniversalWorkflowDef>} */
export const UNIVERSAL_WORKFLOWS = {
    interpolate: {
        workflow: 'video_interpolate.json',
    },
    videoUpscale: {
        workflow: 'video_upscale.json',
    },
    imageUpscale: {
        workflow: 'image_upscale.json',
    },
    // MPI-579. Universal by wiring, but its weights belong to the LTX 2.3 Balanced
    // stack, not the universal DEPS set — the plugin's availability gate owns that.
    ltxVideoUpscale: {
        workflow: 'ltx_video_upscale.json',
    },
    removeBackground: {
        workflow: 'remove_background.json',
    },
    // MPI-623. Their weight (moge-vitl) belongs to the `scene-convert` plugin, not the engine.
    sceneConvert: {
        workflow: 'scene_convert.json',
    },
    sceneLift: {
        workflow: 'scene_lift.json',
    },
    // Its weights belong to the `scene-path` plugin; ComfyUI-GGUF installs with the engine.
    scenePathVideo: {
        workflow: 'scene_path_video.json',
    },
    autoMaskImg: {
        workflow: 'img_auto_mask.json',
    },
    // MPI-771: SAM3 video-track cut-out for the GIF workspace. Dispatched by
    // `runGifCutoutTrack` (commandExecutor.js), not the generic `runCommand`
    // path — see `commandRegistry.js`'s `gifCutoutSam3` entry for why it still
    // gets one.
    gifCutoutSam3: {
        workflow: 'gif_cutout_sam3.json',
    },
    // MPI-771 Decision 15: BiRefNet (the shipped `birefnet` engine asset) as the GIF
    // cut-out's "Remove background" method. Same runner, same Output_Mask batch.
    gifCutoutBirefnet: {
        workflow: 'gif_cutout_birefnet.json',
    },
    // Text-only (caption) workflow: returns a string via Output_prompt and saves no
    // file, so its op declares `outputKind: 'text'` (MPI-310). Runs through the normal
    // generation queue like any other op — the MPI-308 note that it bypasses the queue
    // is obsolete.
    imageDescribe: {
        workflow: 'image_descriptor.json',
    },
    resize: {
        workflow: 'resize.json',
    },
    resizeVideo: {
        workflow: 'resize_video.json',
    },
    // MPI-591 — the first op whose graph is chosen by the model. Extending a clip on
    // LTX 2.3 and on MiniMax H3 are different node sets end to end (LTXVAudioVideoMask +
    // LTXVConcatAVLatent + LTXVSeparateAVLatent against an H3 nested AV latent +
    // MiniMaxH3AddGuide), so no widget swap inside one file could express it.
    // `workflow` stays the LTX graph because `requiredModels[0]` is `ltx-23-balanced` —
    // the candidate every existing extend ran on, and the one the picker stars.
    flowLtxExtend: {
        workflow: 'flow_ltx_extend.json',
        byModel: {
            // fl2va, and this REVERSES the ref2va entry that stood here until 2026-09-27
            // (MPI-591 Phase 8, Fabio: "FL2VA should be the default one for sure. It should
            // land instead of referencing the video"). The graph moved with the id: its
            // UNETLoader now takes minimax_h3_fl2va_pruned_int8_convrot, the turbo LoRA is
            // the fl2v-trained 8-step, and MpiH3References is gone in favour of
            // MpiH3ImageToVideo + MpiH3MaskedPrefix. Both weights are supplied ONLY by this
            // model's dep set, so the id and the graph have to move together — naming
            // ref2va now would gate on a 19.53GB weight the graph no longer loads and then
            // fail value_not_in_list, which is the same trap the old comment described in
            // the other direction.
            //
            // Why fl2va is the right DiT here: it continues from PIXELS, which is what an
            // extend is. It also ignores reference images rather than erroring on them, so
            // leaving the old reference path wired would have been dead weight that looked
            // alive.
            'minimax-h3': 'flow_h3_extend.json',
        },
    },
    flowLtxFoley: {
        workflow: 'flow_ltx_foley.json',
    },
    // MPI-594 — Krea 2 edit. The image it loads is ALREADY padded by the app, so the
    // graph has no rect, no mask and no fill colour of its own.
    flowOutpaint: {
        workflow: 'flow_outpaint.json',
    },
    // MPI-567, rebuilt Klein-only in MPI-621 — the drawing is composited onto the
    // user's photo, a crop sized FROM the drawing is taken around it, Klein 9B edits
    // that crop, and the user's box is stitched back. One model, one pass; the SDXL
    // render, the background removal and the flat paste are gone. The model is a
    // declared slot, so this op adds no download of its own.
    flowScribObj: {
        workflow: 'flow_draw_it_in.json',
    },
    // MPI-620 — Scribble. Pruned from the SDXL t2i template rather than the Draw It In
    // graph: two control arms only (scribble + canny), so it carries no openpose or depth
    // preprocessor. Sizing is derived, not injected — `GetImageSize` reads the scaled
    // input and drives `EmptyLatentImage`, so the drawing's own dimensions are the output's.
    flowScribble: {
        workflow: 'flow_scribble.json',
    },
    // MPI-596 - Object Stamp. Draw It In's graph with the scribble swapped for a real
    // object, plus a second reference arm and a second crop of the CLEAN scene to the
    // same region (law 7 - matched framing is what stops the doll's-house failure).
    // ONE file serves both modes: three MpiAnySwitch nodes on Input_Mode pick the crop
    // source, reference 2 and the baked instruction. The model is a declared slot, so
    // this op adds no download of its own.
    flowObjectStamp: {
        workflow: 'flow_object_stamp.json',
    },
    // MPI-1036 — Video Edit. One single-pass H3 r2v turbo graph; masked vs whole frame is
    // routed in-graph off Input_Target, never by a second file.
    flowVideoEdit: {
        workflow: 'flow_video_edit.json',
    },
    // MPI-607 — Chatterbox voice conversion. Five nodes, no model loader: two
    // MpiLoadAudio paths into FL_ChatterboxVC, out through a native SaveAudio.
    flowVoiceChanger: {
        workflow: 'flow_voice_changer.json',
    },
    // MPI-663 — Stems. Seven nodes, no model loader: an MpiLoadAudio path into
    // AudioSeparation (Hybrid Demucs v3), out through four SaveAudioAdvanced saves.
    flowStems: {
        workflow: 'flow_stems.json',
    },
    // MPI-664 — MiniMax Music 3. Forty-six nodes: the bench graph's DiT + text encoder
    // + audio VAE, plus 31 string nodes that assemble the structured caption around the
    // enhancer's three prose blocks.
    flowTextToMusic: {
        workflow: 'flow_minimax_music.json',
    },
    // `flowChatterBox` and `flowSoundAndMusic` left in MPI-1012: Text to Speech and Sound
    // & Music are model ops now (`tts` on chatterbox, `t2a` on stable-audio-3, models.js).
    // MPI-504 — Krea2 t2i: the sheet alone since MPI-997.
    flowCharacterSheet: {
        workflow: 'flow_character_sheet.json',
    },
    // MPI-1042 — Character Sheet from Images. Qwen-Image 2.1 draws the whole sheet in one
    // sampling; Klein 9B needs two (the portrait alone, then the body views referencing it,
    // stitched) - no node set in common, so the pick selects the graph. Both files come from
    // tasks/MPI-1042/research/bench-tools/build_bench_v2.py --flow.
    flowCharacterSheetImages: {
        workflow: 'flow_character_sheet_from_images.json',
        byModel: {
            'klein-9b': 'flow_character_sheet_from_images_klein.json',
        },
    },
    // MPI-997 — Character Sheet's chained leg 2: SAM3 removes the front body's head from
    // a finished sheet (no model; SAM3 installs with the engine).
    flowCharacterSheetHeadless: {
        workflow: 'flow_character_sheet_headless.json',
    },
    // MPI-1041 — Character Sheet Editor: one change on a finished sheet. Klein 9B with an
    // in-graph SAM3 lock, and the Qwen-Image 2.1 twin for Body shape.
    flowCharacterSheetEdit: {
        workflow: 'flow_character_sheet_edit.json',
    },
    flowCharacterSheetEditQwen: {
        workflow: 'flow_character_sheet_edit_qwen.json',
    },
    // MPI-504 — text-only, like imageDescribe. Its encoder weight is
    // `qwen3vl-abliterated-clip`, an engineAsset (MPI-1045), so this op adds no
    // download of its own.
    promptEnhance: {
        workflow: 'qwen3vl_4b_prompt_enhancer.json',
    },
};
