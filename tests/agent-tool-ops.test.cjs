/**
 * agent-tool-ops.test.cjs — the agent's image tools with no model (MPI-904, MPI-941 Phase 3).
 *
 * `toolRun` turns a tool call's `fields` into the universal op the History rail runs and the
 * params the rail sends for it, so an agent upscale and a rail upscale are one graph.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = require('node:path').join(__dirname, '..');
const esm = (p) => import('file://' + require('node:path').join(repoRoot, p).replace(/\\/g, '/'));

test('imageUpscale: Siax at x2 by default, with the file name the rail dropdown sends', async () => {
    const { toolRun } = await esm('js/shell/agentToolOps.js');
    assert.deepEqual(toolRun('imageUpscale', {}), {
        ok: true, operation: 'imageUpscale',
        injectionParams: { Upscale_Factor: 2, Upscale_Using_Model: true, Upscale_Model: '4x_NMKD-Siax_200k.pth' },
    });
    const anime = toolRun('imageUpscale', { upscaler: '4x-AnimeSharp', factor: 1.5 });
    assert.equal(anime.injectionParams.Upscale_Model, '4x-AnimeSharp.pth');
    assert.equal(anime.injectionParams.Upscale_Factor, 1.5);
});

test('imageUpscale: an unknown upscaler or factor is refused by name, never guessed', async () => {
    const { toolRun } = await esm('js/shell/agentToolOps.js');
    const a = toolRun('imageUpscale', { upscaler: 'RealESRGAN' });
    assert.equal(a.ok, false);
    assert.equal(a.code, 'INVALID_FIELD');
    assert.match(a.message, /describe_model with "imageUpscale"/);
    assert.equal(toolRun('imageUpscale', { factor: 8 }).code, 'INVALID_FIELD');
});

test('removeBackground: transparent by default, a flat colour as the 0xRRGGBB int the graph wants', async () => {
    const { toolRun } = await esm('js/shell/agentToolOps.js');
    assert.deepEqual(toolRun('removeBackground', {}).injectionParams, { Input_Bg_Use_Color: false });
    assert.deepEqual(toolRun('removeBackground', { background: '#ff8000' }).injectionParams, { Input_Bg_Use_Color: true, Input_Bg_Color: 0xff8000 });
    assert.equal(toolRun('removeBackground', { background: 'white' }).code, 'INVALID_FIELD');
});

test('crop: the largest rect of the ratio inside the picture, through the resize op at scale 1', async () => {
    const { toolRun } = await esm('js/shell/agentToolOps.js');
    const sq = toolRun('crop', { ratio: '1:1' }, { w: 1280, h: 800 });
    assert.equal(sq.operation, 'resize');
    assert.deepEqual(sq.injectionParams, { width: 800, height: 800, keep_proportion: 'crop', crop_position: 'center', divisible_by: 2, upscale_method: 'lanczos' });
    // A tall picture to 16:9 keeps its full width; the height is what goes.
    const wide = toolRun('crop', { ratio: '16:9', position: 'top' }, { w: 3000, h: 4000 });
    assert.equal(wide.injectionParams.width, 3000);
    assert.equal(wide.injectionParams.height, 1686);
    assert.equal(wide.injectionParams.crop_position, 'top');
});

test('crop: needs a ratio from the list, and the picture size', async () => {
    const { toolRun } = await esm('js/shell/agentToolOps.js');
    assert.equal(toolRun('crop', {}, { w: 10, h: 10 }).code, 'INVALID_FIELD');
    assert.equal(toolRun('crop', { ratio: '7:3' }, { w: 10, h: 10 }).code, 'INVALID_FIELD');
    assert.equal(toolRun('crop', { ratio: '1:1', position: 'middle' }, { w: 10, h: 10 }).code, 'INVALID_FIELD');
    assert.equal(toolRun('crop', { ratio: '1:1' }, null).ok, false);
});

test('downscale: a megapixel count at the source proportions, through the resize op, even-sized', async () => {
    const { toolRun } = await esm('js/shell/agentToolOps.js');
    // 1 MP is ComfyUI's 1024 x 1024, as the History rail's MP family counts it (MPI-796).
    const one = toolRun('downscale', {}, { w: 6000, h: 4000 });
    assert.equal(one.operation, 'resize');
    assert.deepEqual(one.injectionParams, { width: 1254, height: 836, keep_proportion: 'crop', crop_position: 'center', divisible_by: 2, upscale_method: 'lanczos' });
    const half = toolRun('downscale', { megapixels: 0.5 }, { w: 4000, h: 4000 });
    assert.equal(half.injectionParams.width, 724);
    assert.equal(half.injectionParams.height, 724);
});

test('downscale: never enlarges, and needs a positive number and the picture size', async () => {
    const { toolRun } = await esm('js/shell/agentToolOps.js');
    const small = toolRun('downscale', { megapixels: 2 }, { w: 1024, h: 1024 });
    assert.equal(small.ok, false);
    assert.equal(small.code, 'ALREADY_SMALLER');
    assert.match(small.message, /imageUpscale/);
    assert.equal(toolRun('downscale', { megapixels: 0 }, { w: 4000, h: 4000 }).code, 'INVALID_FIELD');
    assert.equal(toolRun('downscale', { megapixels: 'big' }, { w: 4000, h: 4000 }).code, 'INVALID_FIELD');
    assert.equal(toolRun('downscale', { megapixels: 1 }, null).ok, false);
});

test('every tool names its op, a note and the one picture slot the universal op takes', async () => {
    const { AGENT_TOOL_OPS, toolOperation } = await esm('js/shell/agentToolOps.js');
    const { getCommand } = await esm('js/data/commandRegistry.js');
    assert.deepEqual(AGENT_TOOL_OPS.map(t => t.op), ['imageUpscale', 'removeBackground', 'crop', 'downscale']);
    for (const t of AGENT_TOOL_OPS) {
        assert.ok(t.note.length > 40, t.op);
        const runs = getCommand(toolOperation(t.op));
        assert.equal(runs.universal, true, `${t.op} runs a universal op`);
        assert.equal(runs.mediaInputs[0].key, t.media[0].role, `${t.op}'s slot is the op's own`);
    }
});
