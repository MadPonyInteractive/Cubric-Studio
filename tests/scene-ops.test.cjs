/**
 * scene-ops.test.cjs — MPI-623. The 3D Scene ops: `sceneConvert` and `scenePathVideo`.
 *
 * sceneConvert returns a raw float32 depth file the MpiNodes scene node wrote under
 * `<comfy_output>/scenes/…`, reported as text through a `PreviewAny` titled
 * `Output_Depth` — the `Output_Splat` contract, so the file reaches the app over `/view`
 * from a Pod too. `sceneLift` (Take picture's fill lift) never shipped and is gone.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const graph = (f) => JSON.parse(read(`comfy_workflows/${f}`));
const titled = (g, t) => Object.values(g).find((n) => n._meta?.title?.toLowerCase() === t.toLowerCase());
const source = (g, node, input) => g[node.inputs[input][0]];

test('a scene depth path becomes a /view file dict under scenes/', async () => {
    const { splatViewFileInfo } = await import('../js/utils/comfyOutputUrls.js');
    // The bench run of 2026-10-07 (Windows) and the Pod's Linux shape.
    assert.deepStrictEqual(splatViewFileInfo('D:\\WORK\\Images\\Outputs\\scenes\\pano_depth_00001_.f32', 'scenes'),
        { filename: 'pano_depth_00001_.f32', subfolder: 'scenes', type: 'output' });
    assert.deepStrictEqual(splatViewFileInfo('/workspace/comfyui/output/scenes/lift_depth_00003_.f32', 'scenes'),
        { filename: 'lift_depth_00003_.f32', subfolder: 'scenes', type: 'output' });
    assert.strictEqual(splatViewFileInfo('D:\\out\\splats\\run\\export.ply', 'scenes'), null);
    assert.strictEqual(splatViewFileInfo('D:\\out\\scenes', 'scenes'), null);
});

test('sceneConvert is registered in all four places, sceneLift in none', async () => {
    const { COMMANDS } = await import('../js/data/commandRegistry.js');
    const { UNIVERSAL_WORKFLOWS } = await import('../js/data/modelConstants/universal_workflows.js');
    const { OPERATION_REGISTRY } = await import('../js/core/operationRegistry.js');
    const json = JSON.parse(read('operation_registry.json'));
    for (const op of ['sceneConvert']) {
        assert.strictEqual(COMMANDS[op]?.universal, true, `${op} universal in commandRegistry`);
        assert.ok(fs.existsSync(path.join(ROOT, 'comfy_workflows', UNIVERSAL_WORKFLOWS[op].workflow)), `${op} graph on disk`);
        assert.deepStrictEqual(
            { latestVersion: OPERATION_REGISTRY[op].latestVersion, appVersionIntroduced: OPERATION_REGISTRY[op].appVersionIntroduced },
            { latestVersion: json[op].latestVersion, appVersionIntroduced: json[op].appVersionIntroduced },
            `${op} mirrors agree`);
    }
    assert.deepStrictEqual([COMMANDS.sceneLift, UNIVERSAL_WORKFLOWS.sceneLift, OPERATION_REGISTRY.sceneLift, json.sceneLift], [undefined, undefined, undefined, undefined],
        'sceneLift never shipped (not in v2.0.1): removed, not deprecated');
    assert.ok(!fs.existsSync(path.join(ROOT, 'comfy_workflows', 'scene_lift.json')));
    assert.ok(!read('js/services/commandExecutor.js').includes('runSceneOp'));
    assert.ok(!read('routes/projects.js').includes('/scene-layer'));
});

test('the graphs load the weights the deps install', async () => {
    const { DEPS } = await import('../js/data/modelConstants/dependencies.js');
    const tail = (id, dir) => DEPS[id].filename.replace(`${dir}/`, '');
    const convert = graph('scene_convert.json');
    const pano = Object.values(convert).find((n) => n.class_type === 'MpiPanoDepth');
    const upscaler = Object.values(convert).find((n) => n.class_type === 'UpscaleModelLoader');
    assert.strictEqual(pano.inputs.model, tail('moge-vitl', 'moge'));
    assert.strictEqual(upscaler.inputs.model_name, tail('4x-AnimeSharp', 'upscale_models'));
});

test('sceneConvert: image in, 8K texture + pano depth out', () => {
    const g = graph('scene_convert.json');
    assert.strictEqual(titled(g, 'Input_Image').class_type, 'MpiLoadImage');
    const out = titled(g, 'Output_Image');
    assert.strictEqual(out.class_type, 'SaveImage');
    const scale = source(g, out, 'images');
    assert.deepStrictEqual([scale.inputs.width, scale.inputs.height], [8192, 4096]);
    const depth = titled(g, 'Output_Depth');
    assert.strictEqual(depth.class_type, 'PreviewAny');
    assert.strictEqual(source(g, depth, 'source').class_type, 'MpiPanoDepth');
});

// P2: the camera-path video. A card-making op (enqueueGeneration), so it is checked apart from sceneConvert.
test('scenePathVideo: registered in all four places, its plugin owning every weight the graph loads', async () => {
    const { COMMANDS } = await import('../js/data/commandRegistry.js');
    const { UNIVERSAL_WORKFLOWS } = await import('../js/data/modelConstants/universal_workflows.js');
    const { OPERATION_REGISTRY } = await import('../js/core/operationRegistry.js');
    const { DEPS } = await import('../js/data/modelConstants/dependencies.js');
    const json = JSON.parse(read('operation_registry.json'));
    assert.strictEqual(COMMANDS.scenePathVideo?.universal, true);
    assert.strictEqual(COMMANDS.scenePathVideo.mediaType, 'video', 'the result is a video card');
    assert.strictEqual(UNIVERSAL_WORKFLOWS.scenePathVideo.workflow, 'scene_path_video.json');
    assert.deepStrictEqual(json.scenePathVideo, { ...OPERATION_REGISTRY.scenePathVideo, universal: true });

    const plugins = read('js/data/pluginsRegistry.js');
    const owned = plugins.slice(plugins.indexOf("id: 'scene-path'")).match(/requiredDeps: \[([^\]]*)\]/)[1].match(/'[^']+'/g).map((s) => s.slice(1, -1));
    const g = graph('scene_path_video.json');
    const leaf = (id) => DEPS[id].filename.split('/').slice(1).join('\\'); // a weight's name in its folder, as the graph lists it
    const loads = Object.values(g).flatMap((n) => ['unet_name', 'lora_name', 'clip_name', 'vae_name'].filter((k) => k in n.inputs).map((k) => n.inputs[k]));
    assert.deepStrictEqual(loads.sort(), owned.map(leaf).sort(), 'every weight the graph loads is the plugin\'s, and nothing else');
    for (const id of owned) assert.ok(DEPS[id].sha256 && DEPS[id].bytes, `${id} is pinned`);
    assert.ok(DEPS['ComfyUI-GGUF']?.type === 'custom_nodes', 'the GGUF loader installs with the engine');
});

test('scenePathVideo: one staged guide video, split into guide over holes, Wan out at 16 fps', () => {
    const g = graph('scene_path_video.json');
    const PATH_MEDIA = read('js/services/comfyController.js').match(/UPLOAD_PICKER_KEYS = \{([^}]*)\}/)[1];
    const video = titled(g, 'Input_Video');
    assert.ok(PATH_MEDIA.includes(video.class_type), `${video.class_type} is staged (local input/ or a Pod upload)`);
    const wan = Object.values(g).find((n) => n.class_type === 'MpiWanMaskedVideo');
    const guide = source(g, wan, 'guide'), holes = source(g, wan, 'holes');
    for (const crop of [guide, holes]) {
        assert.strictEqual(crop.class_type, 'ImageCrop');
        assert.strictEqual(g[crop.inputs.image[0]], video);
        assert.deepStrictEqual([crop.inputs.width, crop.inputs.height, crop.inputs.x], [1440, 720, 0]);
    }
    assert.deepStrictEqual([guide.inputs.y, holes.inputs.y], [0, 720], 'the guide on top, its holes below');
    assert.deepStrictEqual([wan.inputs.width, wan.inputs.height], [1440, 720]);
    // P3: as many frames as the guide holds (a short path renders fewer), never a fixed 81.
    const count = source(g, wan, 'length');
    assert.strictEqual(count.class_type, 'GetImageSize');
    assert.strictEqual(g[count.inputs.image[0]], guide);
    assert.strictEqual(wan.inputs.length[1], 2, 'its batch_size output');
    assert.strictEqual(source(g, wan, 'positive').class_type, 'CLIPTextEncode');
    assert.strictEqual(g[source(g, wan, 'positive').inputs.text[0]], titled(g, 'Input_Positive'));
    const sampler = Object.values(g).find((n) => n.class_type === 'KSampler');
    assert.deepStrictEqual([sampler.inputs.steps, sampler.inputs.cfg], [8, 1], 'the distill LoRA\'s settings');
    assert.strictEqual(g[sampler.inputs.seed[0]], titled(g, 'Input_Seed'));
    const out = titled(g, 'Output_Video');
    assert.strictEqual(out.class_type, 'MpiSaveVideo');
    assert.strictEqual(out.inputs.fps, 16);
});
