'use strict';

// MPI-1213 — a locked node's git SUBMODULES are installed by the app, never by the node.
//
// A GitHub archive zip leaves submodule folders empty. comfyui_ultimatesdupscale's
// __init__.py then downloads Coyote-A's unpinned master with Python urllib at import; on a
// tester's fresh Windows PC Python's SSL rejected github.com, so the pack never imported
// and "Repair engine" re-extracted the same empty folder. node_lock now pins the submodule
// and the installer fills it with Node, sha256-checked. These lock the three halves:
//   1. the pin exists and is complete (an absent sha256 would skip the check silently),
//   2. an empty submodule folder reads as DRIFT, so existing installs heal on boot,
//   3. the installer fills it from a verified archive, and refuses a wrong one.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// Throwaway engine, set BEFORE requiring the routes — they capture ENGINE_ROOT at require
// time (docs/testing-harnesses.md § 2).
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1213-'));
process.env.CUBRIC_ENGINE_ROOT = path.join(SCRATCH, 'engine');
process.env.CUBRIC_MODELS_ROOT = path.join(SCRATCH, 'models');

const nodeLock = require('../dev_configs/node_lock.json');
const { DEPS } = require('../js/data/modelConstants/dependencies.js');
const { resolveComfyPath, checkUniversalWorkflowDepsStatus, getNodeSubmodules, NODE_COMMIT_MARKER } = require('../routes/shared');
const { _installNodeSubmodules } = require('../routes/downloadManager');

after(() => fs.removeSync(SCRATCH));

const USDU = 'ComfyUI-UltimateSDUpscale';
const SUB = 'repositories/ultimate_sd_upscale';

// MPI-1343 dropped the pack (ported into MpiNodes), so no locked node has a submodule today.
// The machinery stays for the next one: the test puts USDU's last pin back into the cached
// lock and DEPS, which are the same objects the routes read.
nodeLock.nodes[USDU] ??= {
    source: 'git-commit',
    repo: 'ssitu/ComfyUI_UltimateSDUpscale',
    commit: 'bebd5696fddd61cb0d08949a222c508898ab5577',
    filename: 'comfyui_ultimatesdupscale',
    installRequirements: false,
    submodules: {
        [SUB]: {
            repo: 'Coyote-A/ultimate-upscale-for-automatic1111',
            commit: '2322caa480535b1011a1f9c18126d85ea444f146',
            sha256: '0797d41bad17b4bd9c41fae0ff4ea110cc364c1d2a06e13b27ca78fd0d4c57d7',
        },
    },
};
DEPS[USDU] ??= {
    id: USDU, name: 'ComfyUI Ultimate SD Upscale', type: 'custom_nodes',
    filename: 'comfyui_ultimatesdupscale', url: 'https://x', installRequirements: false, size: '940KB',
};

// Minimal STORED zip (no compression) — enough for bsdtar and extract-zip alike.
function makeZip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, text] of Object.entries(files)) {
        const n = Buffer.from(name);
        const data = Buffer.from(text);
        const crc = zlib.crc32(data);
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4);
        lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
        lh.writeUInt16LE(n.length, 26);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
        ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
        ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
        locals.push(lh, n, data);
        centrals.push(ch, n);
        offset += 30 + n.length + data.length;
    }
    const cd = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(locals.length / 3, 8); end.writeUInt16LE(locals.length / 3, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
}

async function usduFolder() {
    const { localPath } = await resolveComfyPath(DEPS[USDU], null, {});
    await fs.remove(localPath);
    await fs.ensureDir(path.join(localPath, SUB)); // what the GitHub archive leaves
    await fs.writeFile(path.join(localPath, '__init__.py'), '');
    await fs.writeFile(path.join(localPath, NODE_COMMIT_MARKER), nodeLock.nodes[USDU].commit);
    return localPath;
}

test('the USDU submodule is pinned to a commit and an archive sha256', () => {
    const sub = nodeLock.nodes[USDU].submodules?.[SUB];
    assert.ok(sub, `node_lock ${USDU} declares ${SUB}`);
    assert.equal(sub.repo, 'Coyote-A/ultimate-upscale-for-automatic1111');
    assert.match(sub.commit, /^[0-9a-f]{40}$/);
    assert.match(sub.sha256, /^[0-9a-f]{64}$/);
    // Every declared submodule, not only this one: no sha = no check at all.
    for (const [id, e] of Object.entries(nodeLock.nodes)) {
        for (const [rel, s] of Object.entries(e.submodules || {})) {
            assert.match(s.sha256 || '', /^[0-9a-f]{64}$/, `${id} ${rel} has no sha256`);
            assert.match(s.commit || '', /^[0-9a-f]{40}$/, `${id} ${rel} has no commit`);
        }
    }
    const [resolved] = getNodeSubmodules(USDU);
    assert.equal(resolved.url, `https://github.com/${sub.repo}/archive/${sub.commit}.zip`);
});

test('an empty submodule folder at the right commit reads as drift; a filled one does not', async () => {
    const folder = await usduFolder();
    assert.ok((await checkUniversalWorkflowDepsStatus()).driftedDeps.includes(USDU));

    await fs.writeFile(path.join(folder, SUB, 'README.md'), 'x');
    assert.ok(!(await checkUniversalWorkflowDepsStatus()).driftedDeps.includes(USDU));
});

test('the installer fills the submodule from a verified archive', async () => {
    const folder = await usduFolder();
    const sub = nodeLock.nodes[USDU].submodules[SUB];
    const top = `ultimate-upscale-for-automatic1111-${sub.commit}`;
    const zip = makeZip({ [`${top}/scripts/ultimate-upscale.py`]: '# usdu', [`${top}/LICENSE`]: 'GPL' });
    const pinned = sub.sha256;
    const urls = [];
    const download = async (url, dest) => { urls.push(url); await fs.writeFile(dest, zip); };
    try {
        // Pin the fixture's hash in the cached lock the route reads.
        sub.sha256 = crypto.createHash('sha256').update(zip).digest('hex');
        await _installNodeSubmodules(folder, USDU, download);
    } finally {
        sub.sha256 = pinned;
    }
    assert.deepEqual(urls, [`https://github.com/${sub.repo}/archive/${sub.commit}.zip`]);
    assert.equal(await fs.readFile(path.join(folder, SUB, 'scripts', 'ultimate-upscale.py'), 'utf8'), '# usdu');
    assert.ok(!(await fs.pathExists(`${path.join(folder, SUB)}.mpi-staging`)), 'staging removed');

    // Filled = nothing to do: no second download.
    await _installNodeSubmodules(folder, USDU, download);
    assert.equal(urls.length, 1);
});

test('an archive with the wrong sha256 is refused and the folder stays empty', async () => {
    const folder = await usduFolder();
    const zip = makeZip({ 'x-1/scripts/ultimate-upscale.py': 'tampered' });
    await assert.rejects(
        _installNodeSubmodules(folder, USDU, async (url, dest) => fs.writeFile(dest, zip)),
        /SHA256 mismatch/,
    );
    assert.deepEqual(await fs.readdir(path.join(folder, SUB)), []);
    assert.ok(!(await fs.pathExists(`${path.join(folder, SUB)}.mpi-staging`)), 'staging removed');
});
