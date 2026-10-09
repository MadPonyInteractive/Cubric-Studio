/**
 * scene-ops.test.cjs — MPI-623. The two 3D Scene ops, `sceneConvert` and `sceneLift`.
 *
 * Both return a raw float32 depth file the MpiNodes scene node wrote under
 * `<comfy_output>/scenes/…`, reported as text through a `PreviewAny` titled
 * `Output_Depth` — the `Output_Splat` contract, so the file reaches the app over `/view`
 * from a Pod too. `runSceneOp` (commandExecutor.js) runs them directly: neither makes a
 * card, and `generationService` reads a run with no image as a cancel.
 *
 * `sceneLift`'s known depth is a FILE the app writes, so `Input_Known_Depth` must sit on
 * a class in comfyController's PATH_MEDIA_CLASSES: that is what stages it into the local
 * engine's input/ and uploads it to a Pod. On a plain text node the Pod would get a path
 * to the user's disk.
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

test('both ops are registered in all four places', async () => {
    const { COMMANDS } = await import('../js/data/commandRegistry.js');
    const { UNIVERSAL_WORKFLOWS } = await import('../js/data/modelConstants/universal_workflows.js');
    const { OPERATION_REGISTRY } = await import('../js/core/operationRegistry.js');
    const json = JSON.parse(read('operation_registry.json'));
    for (const op of ['sceneConvert', 'sceneLift']) {
        assert.strictEqual(COMMANDS[op]?.universal, true, `${op} universal in commandRegistry`);
        assert.ok(fs.existsSync(path.join(ROOT, 'comfy_workflows', UNIVERSAL_WORKFLOWS[op].workflow)), `${op} graph on disk`);
        assert.deepStrictEqual(
            { latestVersion: OPERATION_REGISTRY[op].latestVersion, appVersionIntroduced: OPERATION_REGISTRY[op].appVersionIntroduced },
            { latestVersion: json[op].latestVersion, appVersionIntroduced: json[op].appVersionIntroduced },
            `${op} mirrors agree`);
    }
});

test('the graphs load the weights the deps install', async () => {
    const { DEPS } = await import('../js/data/modelConstants/dependencies.js');
    const tail = (id, dir) => DEPS[id].filename.replace(`${dir}/`, '');
    const convert = graph('scene_convert.json');
    const lift = graph('scene_lift.json');
    const pano = Object.values(convert).find((n) => n.class_type === 'MpiPanoDepth');
    const liftNode = Object.values(lift).find((n) => n.class_type === 'MpiLiftDepth');
    const upscaler = Object.values(convert).find((n) => n.class_type === 'UpscaleModelLoader');
    assert.strictEqual(pano.inputs.model, tail('moge-vitl', 'moge'));
    assert.strictEqual(liftNode.inputs.model, tail('moge-vitl', 'moge'));
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

test('sceneLift: known depth rides a staged path node, depth out', () => {
    const g = graph('scene_lift.json');
    const known = titled(g, 'Input_Known_Depth');
    const PATH_MEDIA = read('js/services/comfyController.js').match(/PATH_MEDIA_CLASSES = new Set\(\[([\s\S]*?)\]\)/)[1];
    assert.ok(PATH_MEDIA.includes(`'${known.class_type}'`), `${known.class_type} must be a PATH_MEDIA_CLASSES node`);
    assert.strictEqual(titled(g, 'Input_Fov_X').class_type, 'MpiFloat');
    const depth = titled(g, 'Output_Depth');
    const lift = source(g, depth, 'source');
    assert.strictEqual(lift.class_type, 'MpiLiftDepth');
    assert.strictEqual(g[lift.inputs.known_depth[0]], known);
    // The ground plane is TEXT ('nx,ny,nz,d'): a path node would have the engine stage it as a file.
    const ground = titled(g, 'Input_Ground');
    assert.ok(!PATH_MEDIA.includes(`'${ground.class_type}'`), `${ground.class_type} must not be a path node`);
    assert.strictEqual(g[lift.inputs.ground[0]], ground);
    assert.ok('value' in ground.inputs, 'injected through `value`');
});

test('runSceneOp captures Output_Depth under scenes/ and never goes through runCommand', () => {
    const src = read('js/services/commandExecutor.js');
    const body = src.slice(src.indexOf('export function runSceneOp'), src.indexOf('export function runCommand'));
    assert.ok(body.includes("idsTitled('output_depth')"));
    assert.ok(body.includes("splatViewFileInfo(readComfyOutputText(nodeOutput), 'scenes')"));
    assert.ok(body.includes('Input_Known_Depth') && body.includes('Input_Fov_X') && body.includes('Input_Ground'));
    assert.ok(!body.includes('runCommand('));
});
