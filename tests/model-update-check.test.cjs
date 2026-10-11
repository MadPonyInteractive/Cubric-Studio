/**
 * MPI-1065 — an update that adds a dep to an installed model must not make it vanish
 * silently. The toast reads the Models library's own partial answer (`partialInstall`),
 * so the bar and the toast can never disagree about which model is "missing files".
 */
const test = require('node:test');
const assert = require('node:assert');

const { partialInstall, resolveFullUniverse, depSizeBytes, depsHeldOutsideModels } = require('../js/data/modelConstants/resolveModelDeps.js');
const { DEPS } = require('../js/data/modelConstants/dependencies.js');
const { MODELS } = require('../js/data/modelConstants/models.js');
const { missingFilesMessage, modelsMissingFiles } = require('../js/shell/modelUpdateCheck.js');

const ltx = MODELS.find(m => m.id === 'ltx-23');
const universe = resolveFullUniverse(ltx, null, 'local');
const deps = universe.map(id => DEPS[id]);
const NEW_DEP = 'ltx23-lora-ingredients';

test('a dep added to an installed model reads partial (the 2.0 -> 2.1 LTX case)', () => {
    assert.ok(universe.includes(NEW_DEP), 'fixture: LTX 2.3 carries the Ingredients LoRA');
    const status = new Map(universe.map(id => [id, id !== NEW_DEP]));
    const p = partialInstall(deps, status);
    assert.strictEqual(p.hasPartialProgress, true);
    const missing = p.totalBytes - p.downloadedBytes;
    assert.ok(Math.abs(missing - 1.22 * 1024 ** 3) < 1024 ** 2, `missing ${missing} should be the LoRA's 1.22GB`);
});

test('a fully installed model is not partial', () => {
    assert.strictEqual(partialInstall(deps, new Map(universe.map(id => [id, true]))).hasPartialProgress, false);
});

test('a model never touched is not partial', () => {
    assert.strictEqual(partialInstall(deps, new Map(universe.map(id => [id, false]))).hasPartialProgress, false);
});

test('under 1 GB of the model\'s own files on disk is not partial (shared support files only)', () => {
    const small = deps.filter(d => d.type !== 'custom_nodes').sort((a, b) => a.size.localeCompare(b.size))
        .find(d => /MB$/i.test(d.size));
    assert.ok(small, 'fixture: LTX has a sub-GB dep');
    const status = new Map(universe.map(id => [id, id === small.id]));
    assert.strictEqual(partialInstall(deps, status).hasPartialProgress, false);
});

test('custom nodes never count as the model\'s files', () => {
    const node = { id: 'n', type: 'custom_nodes', size: '5GB' };
    const weight = { id: 'w', type: 'checkpoints', size: '2GB' };
    assert.strictEqual(partialInstall([node, weight], new Map([['n', true], ['w', false]])).hasPartialProgress, false);
});

test('the message names each model and the total size, singular and plural', () => {
    const one = missingFilesMessage([{ name: 'LTX 2.3', missingBytes: 1.31e9 }]);
    assert.strictEqual(one, 'LTX 2.3 needs 1.3GB from an update. Install it in Models.');
    const two = missingFilesMessage([{ name: 'LTX 2.3', missingBytes: 1.31e9 }, { name: 'LTX 2.3 Balanced', missingBytes: 1.31e9 }]);
    assert.match(two, /^LTX 2\.3 and LTX 2\.3 Balanced need 2\.6GB from an update\. Install them in Models\.$/);
    assert.doesNotMatch(one + two, /—/, 'no em dashes in user copy');
});

// ── modelsMissingFiles: which models the toast names ──────────────────────────────
// A fake disk over the REAL ModelDefs: `onDisk` lists dep ids present; a model is usable
// when every dep of its universe is on disk (the flat-model rule).
function scan(ids, onDisk) {
    const models = MODELS.filter(m => !m.provider);
    const disk = new Set(onDisk);
    const universe = m => resolveFullUniverse(m, null, 'local');
    return modelsMissingFiles(models, {
        universe,
        statusOf: id => new Map(universe(MODELS.find(m => m.id === id)).map(d => [d, disk.has(d)])),
        isUsable: m => universe(m).every(d => disk.has(d)),
        deps: DEPS,
    }).map(m => m.id).filter(id => ids.includes(id));
}
const universeOf = id => resolveFullUniverse(MODELS.find(m => m.id === id), null, 'local');

test('LTX High installed, then the Ingredients LoRA joins both tiers: only High is named', () => {
    const disk = universeOf('ltx-23').filter(id => id !== NEW_DEP);
    assert.deepStrictEqual(scan(['ltx-23', 'ltx-23-balanced'], disk), ['ltx-23']);
});

test('a never-installed sibling sharing a big encoder is not named (the Boogu false alarm)', () => {
    // Qwen 2.1 installed but for its new VAE; Boogu shares only the 8.7GB text encoder.
    const disk = universeOf('qwen-image-2-1').filter(id => id !== 'vae-qwen-image-21-texturefix');
    assert.deepStrictEqual(scan(['qwen-image-2-1', 'boogu-edit-high', 'boogu-edit-balanced'], disk), ['qwen-image-2-1']);
});

test('a fully installed model is never named', () => {
    assert.deepStrictEqual(scan(['ltx-23'], universeOf('ltx-23')), []);
});

test('the tier is in the name only where two cards share one', () => {
    const qwen = MODELS.find(m => m.id === 'qwen-image-2-1');
    const [solo] = modelsMissingFiles([qwen], {
        universe: m => resolveFullUniverse(m, null, 'local'),
        statusOf: () => new Map(universeOf('qwen-image-2-1').filter(id => id !== 'vae-qwen-image-21-texturefix').map(d => [d, true])),
        isUsable: () => false,
        deps: DEPS,
    });
    assert.strictEqual(solo.name, 'Qwen-Image 2.1');
    const models = MODELS.filter(m => m.id === 'ltx-23' || m.id === 'ltx-23-balanced');
    const disk = new Set(universeOf('ltx-23').filter(id => id !== NEW_DEP));
    const [hit] = modelsMissingFiles(models, {
        universe: m => resolveFullUniverse(m, null, 'local'),
        statusOf: () => new Map([...disk].map(d => [d, true])),
        isUsable: () => false,
        deps: DEPS,
    });
    assert.strictEqual(hit.name, 'LTX 2.3 High');
});

// ── MPI-1078: a plugin's, Flow's or the engine's file is not a model's progress ────
const { PLUGINS } = require('../js/data/pluginsRegistry.js');
const { FLOWS } = require('../js/data/flowsRegistry.js');
const held = depsHeldOutsideModels(DEPS, [...PLUGINS, ...FLOWS]);
const partialOf = (id, onDisk) => {
    const u = universeOf(id);
    return partialInstall(u.map(d => DEPS[d]), new Map(u.map(d => [d, onDisk.includes(d)])), held);
};

test('Wan 2.2 with only the scene-path plugin\'s encoder + VAE on disk is not partial', () => {
    const disk = ['umt5_xxl_fp8_e4m3fn_scaled', 'wan_2.1_vae'];
    for (const d of disk) assert.ok(held.has(d), `fixture: ${d} is a plugin dep`);
    assert.strictEqual(partialOf('wan-22', disk).hasPartialProgress, false);
    assert.strictEqual(partialOf('wan22-5b', disk).hasPartialProgress, false);
});

test('Krea 2 with only the engine\'s Qwen3-VL encoder on disk is not partial', () => {
    assert.ok(held.has('qwen3vl-abliterated-clip'), 'fixture: the encoder is an engine asset');
    assert.strictEqual(partialOf('krea2', ['qwen3vl-abliterated-clip']).hasPartialProgress, false);
    assert.strictEqual(partialOf('krea2-nsfw', ['qwen3vl-abliterated-clip']).hasPartialProgress, false);
});

test('a held dep that is MISSING is still the model\'s work', () => {
    // Wan 2.2 on disk but for the plugin's encoder: partial, and the encoder is what is left.
    const p = partialOf('wan-22', universeOf('wan-22').filter(d => d !== 'umt5_xxl_fp8_e4m3fn_scaled'));
    assert.strictEqual(p.hasPartialProgress, true);
    assert.ok(Math.abs(p.totalBytes - p.downloadedBytes - depSizeBytes(DEPS.umt5_xxl_fp8_e4m3fn_scaled.size)) < 1024);
});

test('the toast never names a model whose only files on disk are held elsewhere', () => {
    const models = MODELS.filter(m => !m.provider);
    const disk = new Set(['umt5_xxl_fp8_e4m3fn_scaled', 'wan_2.1_vae', 'qwen3vl-abliterated-clip']);
    const universe = m => resolveFullUniverse(m, null, 'local');
    assert.deepStrictEqual(modelsMissingFiles(models, {
        universe,
        statusOf: id => new Map(universe(MODELS.find(m => m.id === id)).map(d => [d, disk.has(d)])),
        isUsable: m => universe(m).every(d => disk.has(d)),
        deps: DEPS,
        held,
    }), []);
});
