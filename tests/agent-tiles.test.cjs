'use strict';

/**
 * agent-tiles.test.cjs — MPI-1038.
 *
 * Use Tiles and the upscale factor were PromptBox-only: the agent and MCP could not ask for
 * either, and an agent upscale injected neither, so it ran the graph's baked 1.5x with no
 * tiles whatever the open panel showed. Same ladder as denoise (agent-denoise.test.cjs):
 * asked, else the project's own, else the default. Tiles on turns Grid off and is the only
 * way to 1x (detail only), as in the PromptBox.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveNamedParams, namedParamsFor } = require('../js/data/generationControls.js');
const { MODELS } = require('../js/data/modelConstants/models.js');

const KREA2 = MODELS.find((m) => m.id === 'krea2');
const KLEIN = MODELS.find((m) => m.id === 'klein-9b');

test('describe_model lists tiles and the factors on upscale, and nothing on t2i', () => {
    assert.equal(namedParamsFor(KREA2, 'upscale').tiles, true);
    assert.deepEqual(namedParamsFor(KREA2, 'upscale').upscaleFactors, [1, 1.5, 2, 3, 4]);
    assert.equal(namedParamsFor(KREA2, 't2i').tiles, undefined);
    assert.equal(namedParamsFor(KREA2, 't2i').upscaleFactors, undefined);
    const noTiles = { ...KREA2, capabilities: {} };
    assert.equal(namedParamsFor(noTiles, 'upscale').tiles, undefined, 'a graph without the Tile Upscale group');
    assert.deepEqual(namedParamsFor(noTiles, 'upscale').upscaleFactors, [1.5, 2, 3, 4]);
});

test('asked tiles + 1x reach the graph, and Grid goes off', () => {
    for (const model of [KREA2, KLEIN]) {
        const r = resolveNamedParams(null, model, 'upscale', { tiles: true, upscaleFactor: 1 });
        assert.equal(r.ok, true, model.id);
        assert.equal(r.injectionParams.Input_Tile_Upscale, true);
        assert.equal(r.injectionParams.Input_Upscale_Factor, 1);
        assert.equal(r.injectionParams.Input_Auto_Grid, false);
    }
});

test('unset, an agent upscale runs the defaults: no tiles, no grid, 1.5x', () => {
    const r = resolveNamedParams(null, KREA2, 'upscale', {});
    assert.equal(r.injectionParams.Input_Tile_Upscale, false);
    assert.equal(r.injectionParams.Input_Auto_Grid, false);
    assert.equal(r.injectionParams.Input_Upscale_Factor, 1.5);
});

test('with a project, unset values are what its panel says: shared tiles, per-op factor', () => {
    const project = {
        shared: { image: { useTiles: true } },
        modelSettings: { krea2: { operations: { upscale: { upscaleFactor: 1, useGrid: true } } } },
    };
    const r = resolveNamedParams(project, KREA2, 'upscale', {});
    assert.equal(r.injectionParams.Input_Tile_Upscale, true);
    assert.equal(r.injectionParams.Input_Upscale_Factor, 1);
    assert.equal(r.injectionParams.Input_Auto_Grid, false, 'tiles on wins over a saved Grid');
    const asked = resolveNamedParams(project, KREA2, 'upscale', { tiles: false, upscaleFactor: 2 });
    assert.equal(asked.injectionParams.Input_Tile_Upscale, false, 'asked wins');
    assert.equal(asked.injectionParams.Input_Auto_Grid, true, 'and the saved Grid is back');
});

test('1x without tiles, a bad factor, or tiles off an upscale op are refused by name', () => {
    assert.equal(resolveNamedParams(null, KREA2, 'upscale', { upscaleFactor: 1 }).code, 'INVALID_UPSCALE_FACTOR');
    assert.equal(resolveNamedParams(null, KREA2, 'upscale', { upscaleFactor: 2.5 }).code, 'INVALID_UPSCALE_FACTOR');
    assert.equal(resolveNamedParams(null, KREA2, 'upscale', { tiles: 'yes' }).code, 'INVALID_TILES');
    assert.equal(resolveNamedParams(null, KREA2, 't2i', { tiles: true }).code, 'INVALID_TILES');
    assert.equal(resolveNamedParams(null, KREA2, 't2i', { upscaleFactor: 2 }).code, 'INVALID_UPSCALE_FACTOR');
    assert.equal(resolveNamedParams(null, KREA2, 't2i', {}).injectionParams.Input_Tile_Upscale, undefined, 'nothing injected off upscale');
});

test('the route, the routine steps, the MCP tool and the in-app agent all carry both', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
    for (const [file, list] of [[['routes', 'connector.js'], 'NAMED_PARAM_KEYS'], [['js', 'data', 'routineModel.js'], '_MODEL_NAMED_KEYS'], [['services', 'agentLoop.mjs'], '_SENT_KEYS']]) {
        assert.match(read(...file), new RegExp(`const ${list} = \\[[^\\]]*'tiles', 'upscaleFactor'`), list);
    }
    for (const file of [['services', 'agentLoop.mjs'], ['routes', 'mcp.js']]) {
        assert.match(read(...file), /tiles: \{ type: 'boolean', description: '[^']*WHOLE prompt/, file.join('/'));
        assert.match(read(...file), /upscaleFactor: \{ type: 'number'/, file.join('/'));
    }
});

test('through the settings gate: an agent asks for tiles; an open panel runs ITS tiles', () => {
    const { resolveSettingsOwner } = require('../js/shell/agentDispatch.js');
    const run = (owner) => resolveNamedParams(owner.project, owner.model, 'upscale', owner.named).injectionParams;

    const free = run(resolveSettingsOwner({ modelId: 'krea2', tiles: true, upscaleFactor: 1 }, false, null, null));
    assert.equal(free.Input_Tile_Upscale, true);
    assert.equal(free.Input_Upscale_Factor, 1);

    const panel = { shared: { image: { useTiles: true } }, modelSettings: { krea2: { operations: { upscale: { upscaleFactor: 2 } } } } };
    const pinned = run(resolveSettingsOwner({ modelId: 'krea2', tiles: false }, true, panel, KREA2));
    assert.equal(pinned.Input_Tile_Upscale, true, 'the agent`s tiles: false is dropped');
    assert.equal(pinned.Input_Upscale_Factor, 2);
});
