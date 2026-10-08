// MPI-310 — the plugin entity exists to stop a model uninstall from deleting a dep
// that no model and no Flow owns. If this fails, a plugin's own weight silently
// vanishes after an unrelated uninstall and the feature breaks with a ComfyUI
// "not found" deep in the graph.
//
// MPI-1045 retired the image-describer plugin this test was written for: its encoder is
// an engineAsset now, kept by the uninstall guards' universal rule rather than by a plugin.
// The checks below run over whichever plugins own deps today.
const assert = require('assert');
const { pathToFileURL } = require('url');
const path = require('path');

const imp = (p) => import(pathToFileURL(path.resolve(p)).href);

(async () => {
    const reg = await imp('js/data/pluginsRegistry.js');
    // MPI-579: resolve against the FULL union, not `assetDeps` alone. The dep
    // entries were split into four siblings (modelDeps / assetDeps / loraDeps /
    // nodesDeps) and `dependencies.js` re-merges them. While the only plugin dep
    // was a support weight, assetDeps happened to be enough; the LTX Video
    // upscaler needs a transformer, which lives in modelDeps, so the narrower map
    // reported a real dep as unknown.
    const depsMod = await imp('js/data/modelConstants/dependencies.js');
    const ASSET = depsMod.DEPS;
    assert.ok(ASSET, 'could not resolve the dep union export');

    const protectedIds = reg.pluginRequiredDepIds();

    // Every dep a plugin claims must actually resolve, or protection guards a ghost.
    for (const p of reg.PLUGINS) {
        for (const id of p.requiredDeps || []) {
            assert.ok(ASSET[id], `plugin ${p.id} requires unknown dep ${id}`);
            assert.ok(ASSET[id].url && ASSET[id].sha256, `dep ${id} missing url/sha256`);
            assert.ok(protectedIds.has(id), `${p.id}'s ${id} must be in the protected set`);
        }
    }

    // MPI-1045 — Describe is the engine's now, not a plugin's.
    assert.strictEqual(reg.getPlugin('image-describer'), undefined, 'image-describer is retired');
    assert.strictEqual(reg.pluginForOperation('imageDescribe'), undefined,
        'no plugin may own imageDescribe: its encoder installs with the engine');

    // Key namespacing: must not collide with Flow keys or bare model ids.
    assert.strictEqual(reg.pluginDepKey('ltx-video-upscaler'), 'plugin:ltx-video-upscaler');
    assert.ok(reg.pluginForOperation('ltxVideoUpscale'), 'op -> plugin lookup must resolve');

    // MPI-580 — the dropdown contribution point. The dep key is also the dropdown
    // value, so the round trip has to hold or a selected entry resolves to nothing.
    assert.strictEqual(
        reg.pluginFromDepKey(reg.pluginDepKey('ltx-video-upscaler'))?.id, 'ltx-video-upscaler',
        'dep key must round-trip back to its plugin');
    // A bare upscale-model FILENAME must never resolve to a plugin — that is the whole
    // reason the entry carries a namespaced value rather than a title.
    assert.strictEqual(reg.pluginFromDepKey('4x-NMKD-Siax.pth'), undefined);
    assert.strictEqual(reg.pluginFromDepKey(''), undefined);
    // Nothing is installed in Node, so no plugin contributes to either kind.
    assert.deepStrictEqual(reg.upscalePluginsFor('video'), []);
    assert.deepStrictEqual(reg.upscalePluginsFor('image'), []);

    // The registry being right is not enough — downloadManager.js must actually SEE it
    // across the ESM/CJS boundary (it loads registries via createRequire, not import).
    const dm = require('../routes/downloadManager.js');
    for (const p of reg.PLUGINS) {
        for (const id of p.requiredDeps || []) {
            // (1) Unrelated uninstall must NOT reclaim the weight.
            assert.ok(dm._pluginRequiredDepIds('krea2').has(id),
                `uninstalling an unrelated model must not delete ${p.id}'s ${id}`);
            // (2) The plugin's OWN uninstall must be able to reclaim it. Protecting it here
            //     would make the Uninstall button a silent no-op. This is the case that
            //     regressed once already.
            const owners = reg.PLUGINS.filter(o => (o.requiredDeps || []).includes(id));
            if (owners.length === 1) {
                assert.ok(!dm._pluginRequiredDepIds(reg.pluginDepKey(p.id)).has(id),
                    `${p.id} uninstalling itself must not self-protect ${id}`);
            }
            // (3) No argument = protect everything (the model-uninstall default path).
            assert.ok(dm._pluginRequiredDepIds().has(id), 'default (no exclusion) must protect');
        }
    }

    console.log('ok — plugin dep GC protection', [...protectedIds]);
})();
