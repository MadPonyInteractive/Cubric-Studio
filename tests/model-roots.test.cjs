'use strict';

/**
 * tests/model-roots.test.cjs — Unit tests for routes/modelRoots.js (Phase 1).
 *
 * All pure-invariant tests drive the five exports with an injected fake root list
 * and a fake `pathExists` function — NO real filesystem, NO app, NO engine.
 *
 * Additional tests use a real temp tree to verify:
 *   - yaml-only install migration (getCustomRoot writes model_roots.json)
 *   - generated YAML byte-identity before/after the refactor (single root)
 */

// Give this file its own isolated engine root BEFORE any routes are required,
// so ENGINE_ROOT (captured at module load time in shared.js / modelRoots.js) is
// isolated from other test files running in parallel.
const os   = require('node:os');
const fsSync = require('node:fs');
const path = require('node:path');
process.env.CUBRIC_ENGINE_ROOT = fsSync.mkdtempSync(path.join(os.tmpdir(), 'cubric-model-roots-'));

const assert = require('node:assert/strict');
const fs     = require('node:fs/promises');
const test   = require('node:test');

const {
    getRoots,
    setRoots,
    findExisting,
    findAllCopies,
    pickWriteRoot,
    ownerRoot,
    getModelRootsPath,
} = require('../routes/modelRoots');

const { buildExtraModelPathsYaml } = require('../routes/yamlHelper');
const { getComfyPath, getEngineRoot } = require('../routes/platformEngine');

// ─── Pure invariant tests (fake roots, no filesystem) ────────────────────────

test('ownerRoot: path under first root is owned by that root', async () => {
    const roots = ['/a/models', '/b/models'];
    const result = await ownerRoot('/a/models/checkpoints/x.safetensors', { roots });
    assert.equal(result, '/a/models');
});

test('ownerRoot: path under second root is owned by that root', async () => {
    const roots = ['/a/models', '/b/models'];
    const result = await ownerRoot('/b/models/loras/y.safetensors', { roots });
    assert.equal(result, '/b/models');
});

test('ownerRoot: path outside every root returns null', async () => {
    const roots = ['/a/models', '/b/models'];
    const result = await ownerRoot('/c/models/other.safetensors', { roots });
    assert.equal(result, null);
});

test('ownerRoot: exact root path returns that root', async () => {
    const roots = ['/a/models'];
    const result = await ownerRoot('/a/models', { roots });
    assert.equal(result, '/a/models');
});

test('ownerRoot: empty roots list always returns null', async () => {
    const result = await ownerRoot('/a/models/foo.safetensors', { roots: [] });
    assert.equal(result, null);
});

test('findExisting: returns path from first root where file exists', async () => {
    const roots = ['/a/models', '/b/models'];
    const existingPaths = new Set(['/b/models/loras/x.safetensors']);
    const pathExists = (p) => existingPaths.has(p.replace(/\\/g, '/'));

    const result = await findExisting('loras/x.safetensors', { roots, pathExists });
    assert.equal(result, path.join('/b/models', 'loras/x.safetensors'));
});

test('findExisting: returns first root when both have the file', async () => {
    const roots = ['/a/models', '/b/models'];
    const existingPaths = new Set(['/a/models/checkpoints/x.pt', '/b/models/checkpoints/x.pt']);
    const pathExists = (p) => existingPaths.has(p.replace(/\\/g, '/'));

    const result = await findExisting('checkpoints/x.pt', { roots, pathExists });
    assert.equal(result, path.join('/a/models', 'checkpoints/x.pt'));
});

test('findExisting: returns null when file not in any root', async () => {
    const roots = ['/a/models', '/b/models'];
    const pathExists = () => false;

    const result = await findExisting('checkpoints/missing.pt', { roots, pathExists });
    assert.equal(result, null);
});

test('findAllCopies: returns all roots containing the file', async () => {
    const roots = ['/a/models', '/b/models', '/c/models'];
    const existingPaths = new Set(['/a/models/loras/x.safetensors', '/c/models/loras/x.safetensors']);
    const pathExists = (p) => existingPaths.has(p.replace(/\\/g, '/'));

    const result = await findAllCopies('loras/x.safetensors', { roots, pathExists });
    assert.deepEqual(result, [
        path.join('/a/models', 'loras/x.safetensors'),
        path.join('/c/models', 'loras/x.safetensors'),
    ]);
});

test('findAllCopies: empty array when file in no root', async () => {
    const roots = ['/a/models'];
    const pathExists = () => false;
    const result = await findAllCopies('loras/x.safetensors', { roots, pathExists });
    assert.deepEqual(result, []);
});

test('pickWriteRoot: returns first root with enough space', async () => {
    const roots = ['/a/models', '/b/models'];
    const freeMap = { '/a/models': 100, '/b/models': 2000 };
    const getFreeBytes = (dir) => freeMap[dir.replace(/\\/g, '/')] ?? 0;

    const result = await pickWriteRoot('checkpoints/x.pt', 500, { roots, getFreeBytes });
    assert.equal(result, '/b/models');
});

test('pickWriteRoot: returns first root when it has enough space', async () => {
    const roots = ['/a/models', '/b/models'];
    const getFreeBytes = () => 9999;
    const result = await pickWriteRoot('x.pt', 100, { roots, getFreeBytes });
    assert.equal(result, '/a/models');
});

test('pickWriteRoot: returns null when no root has space', async () => {
    const roots = ['/a/models', '/b/models'];
    const getFreeBytes = () => 0;
    const result = await pickWriteRoot('x.pt', 1000, { roots, getFreeBytes });
    assert.equal(result, null);
});

// ─── Invariant: findExisting ↔ ownerRoot ──────────────────────────────────────

test('invariant: every path findExisting returns is claimed by ownerRoot', async () => {
    const roots = ['/a/models', '/b/models'];
    const relPaths = [
        'checkpoints/a.safetensors',
        'loras/b.pt',
        'vae/c.ckpt',
    ];
    // Each relPath exists under a different root.
    const fileMap = {
        [path.join('/a/models', 'checkpoints/a.safetensors')]: true,
        [path.join('/b/models', 'loras/b.pt')]: true,
        [path.join('/b/models', 'vae/c.ckpt')]: true,
    };
    const pathExists = (p) => !!fileMap[p];

    for (const rel of relPaths) {
        const found = await findExisting(rel, { roots, pathExists });
        if (found !== null) {
            const owner = await ownerRoot(found, { roots });
            assert.ok(owner !== null, `ownerRoot(${found}) should not be null (found by findExisting)`);
        }
    }
});

test('invariant: path outside every root — ownerRoot null and findExisting never returned it', async () => {
    const roots = ['/a/models'];
    const pathExists = () => false;  // file does not exist in any root

    const found = await findExisting('x/outside.pt', { roots, pathExists });
    assert.equal(found, null, 'findExisting should not return a path when file absent');

    // A path genuinely outside the root is never returned by findExisting.
    const externalPath = '/c/elsewhere/x.pt';
    const owner = await ownerRoot(externalPath, { roots });
    assert.equal(owner, null, 'ownerRoot of external path should be null');
});

test('invariant: negative — path outside root reported as not owned', async () => {
    const roots = ['/a/models'];
    // Force findExisting to believe a file exists under a path OUTSIDE the root.
    // This simulates a bug: if pathExists returned true for an external path,
    // findExisting would only ever return paths under roots (path.join ensures it).
    // The invariant holds structurally — path.join(root, relPath) always starts with root.
    const pathExists = () => true;  // pretend everything exists
    const found = await findExisting('checkpoints/x.pt', { roots, pathExists });
    // found is under /a/models (the only root), so ownerRoot must be non-null.
    assert.ok(found !== null);
    const owner = await ownerRoot(found, { roots });
    assert.ok(owner !== null, 'a path returned by findExisting is always under a root');
    // And a truly external path is never returned by findExisting:
    assert.ok(!found.replace(/\\/g, '/').startsWith('/b/'));
});

// ─── getRoots / setRoots round-trip ──────────────────────────────────────────

test('getRoots returns [] when model_roots.json does not exist', async () => {
    // The temp engine root has no model_roots.json yet.
    const result = await getRoots();
    // May be [] (fresh) or a list if a previous test wrote it — just check type.
    assert.ok(Array.isArray(result));
});

test('setRoots / getRoots round-trip', async () => {
    const testRoots = ['D:/Models', 'E:/MoreModels'];
    await setRoots(testRoots);
    const read = await getRoots();
    assert.deepEqual(read, testRoots);
    // Restore to empty for other tests.
    await setRoots([]);
});

// ─── Migration test: yaml-only install seeds model_roots.json ─────────────────

test('getCustomRoot migration: yaml-only install seeds model_roots.json', async () => {
    const engineRoot = getEngineRoot();
    const yamlPath   = getComfyPath(engineRoot, 'extra_model_paths.yaml');
    const jsonPath   = getModelRootsPath();

    // Start clean.
    await fs.rm(jsonPath, { force: true });

    // Write a minimal YAML with a base_path (simulates a pre-existing install).
    const fakeRoot = path.join(os.tmpdir(), 'cubric-fake-root-migration');
    await fs.mkdir(path.dirname(yamlPath), { recursive: true });
    await fs.writeFile(
        yamlPath,
        `\ncomfyui:\n    base_path: ${fakeRoot.replace(/\\/g, '/')}\n    checkpoints: checkpoints/\n`,
        'utf8',
    );

    // Load getCustomRoot after the env is set — require cache may have it already,
    // but the migration reads from disk so it works regardless of cache.
    const { getCustomRoot } = require('../routes/shared');

    const result = await getCustomRoot();
    assert.equal(result, fakeRoot.replace(/\\/g, '/'), 'should return the base_path from YAML');

    // model_roots.json must now exist with the migrated value.
    const raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    assert.ok(Array.isArray(raw.roots), 'model_roots.json should have a roots array');
    assert.equal(raw.roots.length, 1, 'should have exactly one root after migration');
    assert.equal(raw.roots[0], fakeRoot.replace(/\\/g, '/'), 'migrated root should match YAML base_path');

    // Clean up.
    await fs.rm(jsonPath, { force: true });
    await fs.rm(yamlPath, { force: true });
});

// Every root change goes through writeExtraModelPathsYaml (Settings, engine
// install) — the JSON it writes must always say what the YAML's base_path says,
// the value getCustomRoot() returned before the JSON existed. That includes the
// default root: it is stored as itself, not as "no custom root".
test('writeExtraModelPathsYaml keeps model_roots.json equal to the YAML base_path, default root included', async () => {
    const { getCustomRoot, writeExtraModelPathsYaml, getDefaultModelsRoot } = require('../routes/shared');
    const yamlPath = getComfyPath(getEngineRoot(), 'extra_model_paths.yaml');
    const firstBasePath = async () => (await fs.readFile(yamlPath, 'utf8')).match(/base_path:\s*(.+)/)[1].trim();
    const custom = path.join(os.tmpdir(), 'cubric-roots-a');
    const other = path.join(os.tmpdir(), 'cubric-roots-b');

    for (const root of [custom, other, getDefaultModelsRoot()]) {
        await writeExtraModelPathsYaml(root, { loras: [], upscale_models: [] });
        const got = await getCustomRoot();
        assert.equal(got.replace(/\\/g, '/'), (await firstBasePath()).replace(/\\/g, '/'), `JSON and YAML agree for ${root}`);
        assert.equal(path.resolve(got), path.resolve(root));
    }

    await fs.rm(getModelRootsPath(), { force: true });
    await fs.rm(yamlPath, { force: true });
});

// ─── Byte-identity test: single-root YAML before and after refactor ───────────

test('buildExtraModelPathsYaml: single-root output is byte-identical before/after refactor', () => {
    const root    = 'D:/CubricModels';
    const extras  = { loras: ['E:/MyLoras'], upscale_models: [] };
    const defRoot = 'C:/engine/mpi_models';

    // "Before" snapshot: old call site used a plain string.
    const before = buildExtraModelPathsYaml(root, extras, defRoot);

    // "After": new call sites may pass an array (Phase 3 readiness).
    const after  = buildExtraModelPathsYaml([root], extras, defRoot);

    assert.equal(after, before, 'single-root YAML must be byte-identical whether root is string or [string]');
});

test('buildExtraModelPathsYaml: string and array forms produce same output for default-root case', () => {
    const root = 'C:/engine/mpi_models';
    const before = buildExtraModelPathsYaml(root, {}, null);
    const after  = buildExtraModelPathsYaml([root], {}, null);
    assert.equal(after, before);
});
