// MPI-936 draft ModelDef, held OUT of models.js until comfy_workflows/qwen_image_2_1.json exists
// (tests/inject-params-titles.test.cjs fails on a model whose workflow file is missing).
// Paste it back after the qwen-edit entry (before the next section) once the raw is synced.
    // ── Qwen-Image 2.1 (MPI-936) ───────────────────────────────────────────
    // Text-to-image AND instruction editing in one 7B model, with native transparent
    // (RGBA) output. NOT Qwen Image Edit 2511 above: different transformer, encoder and
    // VAE, nothing shared. Notes: docs/models/qwen-image-2/.
    //
    // RESEARCH LICENCE. `MODEL_LICENCES['qwen-image-2-1']` gates the install and flags the
    // tile non-commercial; the images are not commercially usable either. Renaming this id
    // without moving that key drops the gate SILENTLY.
    //
    // ONE graph in Klein's shape (Fabio 2026-10-08: "the Klein one ... has everything"):
    // Input_wf_type picks the op, numbered as Klein's. Up to eight references through the
    // shared `edit` op (`multiReference8`); a painted mask crops reference 1 round it,
    // LanPaint repaints the crop and it is stitched back (a masked edit and inpaint share
    // that path, as on Klein). `control` is the 2.1 Fun ControlNet Union (one patch,
    // switched by Input_Control_Net at CONTROL_TYPES' indices, like SDXL's union).
    {
        id: 'qwen-image-2-1',
        sizeTier: 'balanced',
        name: 'Qwen-Image 2.1',
        dropdownMeta: 'PHOTO',
        mediaType: 'image',
        image: 'qwen-image-2-1.webp',
        defaultUpscale: '4x-NMKD-Siax',
        type: 'qwen21',
        enhanceRecipe: 'flux',
        supportedOps: ['t2i', 'i2i', 'control', 'edit', 'inpaint', 'detail', 'upscale'],
        loraStrengths: ['model'],
        capabilities: {
            multiStage: false, audio: false,
            // cfg 1: the negative does nothing, so the graph carries no Input_Negative.
            negativePrompt: false,
            batch: false,
            multiReference: true, multiReference8: true,
            controlStrength: true,
        },
        opInject: {
            t2i:     { Input_wf_type: 1 },
            i2i:     { Input_wf_type: 2 },
            control: { Input_wf_type: 3 },
            edit:    { Input_wf_type: 4 },
            inpaint: { Input_wf_type: 5 },
            detail:  { Input_wf_type: 6 },
            upscale: { Input_wf_type: 7 },
        },
        controlTypes: ['depth', 'pose', 'scribble', 'canny'],
        // edit follows reference 1 (the encoder's latent); control is sized on the input;
        // detail stitches back into the source; upscale is the source times the factor.
        imageSizedOps: ['edit', 'control', 'detail', 'upscale'],
        qualityTiers: ['1k', '2k'],
        // Krea 2's grid: 1k is the FLUX set, 2k the larger class. Every edge is /32.
        ratios: {
            '1k': {
                portrait: [
                    { label: '1:1', w: 1024, h: 1024, icon: 'rect_1_1' },
                    { label: '3:4', w: 896, h: 1152, icon: 'rect_3_4' },
                    { label: '4:5', w: 896, h: 1088, icon: 'rect_4_5' },
                    { label: '5:8', w: 800, h: 1280, icon: 'rect_5_8' },
                    { label: '9:16', w: 768, h: 1344, icon: 'rect_9_16' },
                ],
                landscape: [
                    { label: '1:1', w: 1024, h: 1024, icon: 'rect_1_1' },
                    { label: '4:3', w: 1152, h: 896, icon: 'rect_4_3' },
                    { label: '5:4', w: 1088, h: 896, icon: 'rect_5_4' },
                    { label: '8:5', w: 1280, h: 800, icon: 'rect_8_5' },
                    { label: '16:9', w: 1344, h: 768, icon: 'rect_16_9' },
                ],
            },
            '2k': {
                portrait: [
                    { label: '1:1', w: 1472, h: 1472, icon: 'rect_1_1' },
                    { label: '3:4', w: 1248, h: 1664, icon: 'rect_3_4' },
                    { label: '4:5', w: 1280, h: 1600, icon: 'rect_4_5' },
                    { label: '5:8', w: 1120, h: 1792, icon: 'rect_5_8' },
                    { label: '9:16', w: 1088, h: 1920, icon: 'rect_9_16' },
                ],
                landscape: [
                    { label: '1:1', w: 1472, h: 1472, icon: 'rect_1_1' },
                    { label: '4:3', w: 1664, h: 1248, icon: 'rect_4_3' },
                    { label: '5:4', w: 1600, h: 1280, icon: 'rect_5_4' },
                    { label: '8:5', w: 1792, h: 1120, icon: 'rect_8_5' },
                    { label: '16:9', w: 1920, h: 1088, icon: 'rect_16_9' },
                ],
            },
        },
        gen_speed: 'balanced',
        description: 'Qwen-Image 2.1 makes images from text AND edits them, with up to eight reference images, and it also does image-to-image, structure control (depth, pose, scribble, canny), inpaint, detail and upscale. Text-to-image and edits can return a transparent background: ask for "transparent background, alpha channel" in the prompt. Licensed for research or evaluation only. You confirm that before downloading, and it covers the images you make too: they are not for commercial use.',
        workflows: {
            // ONE file for all seven ops.
            t2i:     'qwen_image_2_1.json',
            i2i:     'qwen_image_2_1.json',
            control: 'qwen_image_2_1.json',
            edit:    'qwen_image_2_1.json',
            inpaint: 'qwen_image_2_1.json',
            detail:  'qwen_image_2_1.json',
            upscale: 'qwen_image_2_1.json',
        },
        dependencies: [
            'qwen-image-21-transformer',  // HF-primary, research licence
            'boogu-qwen3vl-8b-clip',      // stock Qwen3-VL-8B (Apache-2.0), shared with Boogu
            'vae-qwen-image-21',          // HF-primary, research licence
            'qwen-image-21-controlnet-union', // HF-primary, research licence; IS the control op
            '4x-NMKD-Siax',               // shared engineAsset (upscale op)
            'ComfyUI-MpiNodes',
            'comfyui-kjnodes',            // ImageResizeKJv2 - the i2i resize
            'ComfyUI-UltimateSDUpscale',
            'comfyui_controlnet_aux',     // AIO_Preprocessor x4, as SDXL's
            'comfyui-inpaint-cropandstitch', // masked edit, inpaint, detail
            'LanPaint',                   // LanPaint_KSampler - masked edit + inpaint
        ],
    },
