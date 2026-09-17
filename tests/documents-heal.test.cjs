'use strict';
/**
 * tests/documents-heal.test.cjs — Documents folder resolver and heal (MPI-708 §D3).
 *
 * Verifies that _getDocumentsFolder (called via getProjectsRoot /
 * getProjectPathsRegistryFile) resolves the correct folder, renames the old
 * folder atomically when app major >= 2, rewrites affected registry entries,
 * and falls back safely when the rename fails.
 *
 * Never touches the real Documents folder. All work is inside OS temp dirs.
 */

// Redirect ENGINE_ROOT before any require of shared.js (ENGINE_ROOT is captured
// at module load time).
const os   = require('node:os');
const fsN  = require('node:fs');
const path = require('node:path');

const ENGINE = fsN.mkdtempSync(path.join(os.tmpdir(), 'cubric-docs-heal-eng-'));
process.env.CUBRIC_ENGINE_ROOT = ENGINE;

const test   = require('node:test');
const assert = require('node:assert/strict');

const {
    getProjectsRoot,
    getProjectPathsRegistryFile,
    _testResetDocumentsFolder,
} = require('../routes/shared');

// fs-extra is the 'fs' inside shared.js; patch renameSync on it to simulate failures.
const fsExtra = require('fs-extra');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a fresh temp Documents directory, point APP_DOCUMENTS at it,
 * and reset the memo so the next call re-runs resolution.
 */
function makeDocs() {
    const docs = fsN.mkdtempSync(path.join(os.tmpdir(), 'cubric-docs-'));
    process.env.APP_DOCUMENTS = docs;
    _testResetDocumentsFolder();
    return docs;
}

/** Write a project-paths.json into a folder (creates the folder if needed). */
function writeRegistry(folder, entries) {
    fsN.mkdirSync(folder, { recursive: true });
    fsN.writeFileSync(
        path.join(folder, 'project-paths.json'),
        JSON.stringify({ paths: entries }, null, 2) + '\n',
        'utf8'
    );
}

/** Read back the registry from a folder. Returns the paths array or null. */
function readRegistry(folder) {
    const file = path.join(folder, 'project-paths.json');
    if (!fsN.existsSync(file)) return null;
    return JSON.parse(fsN.readFileSync(file, 'utf8')).paths;
}

// ── test cases ───────────────────────────────────────────────────────────────

test('old folder only, v2: resolves new, renamed, registry entries inside old rewritten, outside untouched', () => {
    process.env.CUBRIC_TEST_APP_VERSION = '2.0.0';
    const docs   = makeDocs();
    const oldDir = path.join(docs, 'Cubric Vision');
    const newDir = path.join(docs, 'Cubric Studio');

    fsN.mkdirSync(path.join(oldDir, 'Projects'), { recursive: true });

    // One entry inside old, one outside
    const insideOld  = oldDir.replace(/\\/g, '/') + '/ExternalProjects';
    const outsideOld = 'C:/Users/Other/Projects';
    writeRegistry(oldDir, [insideOld, outsideOld]);

    const root    = getProjectsRoot();
    const regFile = getProjectPathsRegistryFile();

    // Resolved to new folder
    assert.equal(root,    path.join(newDir, 'Projects'));
    assert.equal(regFile, path.join(newDir, 'project-paths.json'));

    // Physical rename happened
    assert.ok(!fsN.existsSync(oldDir), 'old folder should be gone after rename');
    assert.ok( fsN.existsSync(newDir), 'new folder should exist after rename');

    // Registry entries: inside → rewritten; outside → untouched
    const entries = readRegistry(newDir);
    const expectedInside = newDir.replace(/\\/g, '/') + '/ExternalProjects';
    assert.deepEqual(entries, [expectedInside, outsideOld]);
});

test('new folder only: resolves new, nothing renamed', () => {
    process.env.CUBRIC_TEST_APP_VERSION = '2.0.0';
    const docs   = makeDocs();
    const newDir = path.join(docs, 'Cubric Studio');

    fsN.mkdirSync(path.join(newDir, 'Projects'), { recursive: true });

    assert.equal(getProjectsRoot(),            path.join(newDir, 'Projects'));
    assert.equal(getProjectPathsRegistryFile(), path.join(newDir, 'project-paths.json'));
    // Old never existed — nothing to rename
    assert.ok(!fsN.existsSync(path.join(docs, 'Cubric Vision')));
});

test('both folders present: resolves new, renames nothing (old survives)', () => {
    process.env.CUBRIC_TEST_APP_VERSION = '2.0.0';
    const docs   = makeDocs();
    const oldDir = path.join(docs, 'Cubric Vision');
    const newDir = path.join(docs, 'Cubric Studio');

    fsN.mkdirSync(path.join(oldDir, 'Projects'), { recursive: true });
    fsN.mkdirSync(path.join(newDir, 'Projects'), { recursive: true });

    assert.equal(getProjectsRoot(),            path.join(newDir, 'Projects'));
    assert.equal(getProjectPathsRegistryFile(), path.join(newDir, 'project-paths.json'));

    // Old folder must still exist — we never rename when new already exists
    assert.ok(fsN.existsSync(oldDir), 'old folder must survive when new folder already exists');
});

test('neither folder exists, v2: resolves to new name (fresh install)', () => {
    process.env.CUBRIC_TEST_APP_VERSION = '2.0.0';
    const docs   = makeDocs();
    const newDir = path.join(docs, 'Cubric Studio');

    // No folder created — neither exists
    assert.equal(getProjectsRoot(),            path.join(newDir, 'Projects'));
    assert.equal(getProjectPathsRegistryFile(), path.join(newDir, 'project-paths.json'));
});

test('neither folder exists, v1: resolves to old name', () => {
    process.env.CUBRIC_TEST_APP_VERSION = '1.6.1';
    const docs   = makeDocs();
    const oldDir = path.join(docs, 'Cubric Vision');

    assert.equal(getProjectsRoot(),            path.join(oldDir, 'Projects'));
    assert.equal(getProjectPathsRegistryFile(), path.join(oldDir, 'project-paths.json'));
});

test('old folder only, v1.x: resolves old, renames NOTHING', () => {
    process.env.CUBRIC_TEST_APP_VERSION = '1.5.0';
    const docs   = makeDocs();
    const oldDir = path.join(docs, 'Cubric Vision');
    const newDir = path.join(docs, 'Cubric Studio');

    fsN.mkdirSync(path.join(oldDir, 'Projects'), { recursive: true });

    assert.equal(getProjectsRoot(),            path.join(oldDir, 'Projects'));
    assert.equal(getProjectPathsRegistryFile(), path.join(oldDir, 'project-paths.json'));

    // New folder must NOT exist — no rename on v1
    assert.ok(!fsN.existsSync(newDir), 'new folder must not be created by a v1 build');
    // Old folder is intact
    assert.ok(fsN.existsSync(oldDir), 'old folder must still exist on v1');
});

test('rename failure (EBUSY): resolves old, old folder intact, no new folder created', () => {
    process.env.CUBRIC_TEST_APP_VERSION = '2.0.0';
    const docs   = makeDocs();
    const oldDir = path.join(docs, 'Cubric Vision');
    const newDir = path.join(docs, 'Cubric Studio');

    fsN.mkdirSync(path.join(oldDir, 'Projects'), { recursive: true });
    writeRegistry(oldDir, ['C:/SomeOther/Path']);

    // Stub fs-extra's renameSync to throw on the folder rename.
    // The registry atomic swap also uses renameSync; we only block the folder rename.
    const origRenameSync = fsExtra.renameSync;
    fsExtra.renameSync = (src, dst) => {
        if (dst === newDir) {
            throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
        }
        return origRenameSync.call(fsExtra, src, dst);
    };

    let root, regFile;
    try {
        root    = getProjectsRoot();
        regFile = getProjectPathsRegistryFile();
    } finally {
        fsExtra.renameSync = origRenameSync;
    }

    // Resolved to OLD folder (fallback)
    assert.equal(root,    path.join(oldDir, 'Projects'));
    assert.equal(regFile, path.join(oldDir, 'project-paths.json'));

    // Old folder still exists with its contents
    assert.ok( fsN.existsSync(oldDir), 'old folder must be intact after failed rename');
    assert.ok(!fsN.existsSync(newDir), 'new folder must not exist after failed rename');

    // Registry is untouched (heal never ran because rename failed first)
    const entries = readRegistry(oldDir);
    assert.deepEqual(entries, ['C:/SomeOther/Path']);
});
