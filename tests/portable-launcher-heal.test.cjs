'use strict';

// MPI-954: The 1.x -> 2.0 update on Linux/macOS applied perfectly then reported
// FAILED.  Root cause: the update bundle listed root-level launcher scripts in
// files[], so the 1.5.0 applier called fs.copyFileSync on each one — which
// truncates and rewrites the SAME inode while `sh` was still reading the running
// script by byte offset.  The shell resumed at its saved offset into the new
// content and executed garbage (exit 127), so update.sh's "|| fail" branch
// wrote ok:false into update/update-result.json even though every file was
// correctly installed.
//
// The MPI-595 main() wrapper (d2379a38f) protects 2.0->2.1+ onward, but the
// script that MUST survive the rewrite is the one ALREADY INSTALLED — the 1.5.0
// launcher without the wrapper.  No change to the user's disk can help.
//
// FIX:
//   (1) Update bundles no longer list root-level launchers in files[].  They
//       stage launchers under update/pending-launchers/ instead (which IS in
//       files[], but at a path the running shell is not reading).  The
//       installed 1.x applier therefore never touches the running launchers.
//   (2) The 2.0 app installs the new launchers at first boot via renameSync
//       (new inode — any open fd on the old file is unaffected).
//   (3) The 2.0 applier itself uses temp+rename for all writes on POSIX so
//       that a launcher which somehow ends up in files[] cannot be corrupted.
//
// This file tests all three guarantees.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const APPLIER = path.join(REPO_ROOT, 'scripts', 'portable', 'apply-update.cjs');
const { healPortableLaunchers } = require('../main/launcherHeal.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// Build a minimal update bundle directory that the real applier can process.
// `files` is an array of { rel, content } objects for the manifest's files[].
// `pendingLaunchers` is an array of { name, content } objects placed under
// update/pending-launchers/ (also listed in files[]).
function makeBundle(bundleRoot, opts) {
  const { files = [], pendingLaunchers = [], platform = process.platform } = opts || {};

  for (const { rel, content } of files) {
    const target = path.join(bundleRoot, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content || '');
  }

  const pendingEntries = [];
  for (const { name, content, mode } of pendingLaunchers) {
    const target = path.join(bundleRoot, 'update', 'pending-launchers', name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content || '');
    if (process.platform !== 'win32' && mode != null) fs.chmodSync(target, mode);
    pendingEntries.push({ path: `update/pending-launchers/${name}` });
  }

  const manifestFiles = [
    ...files.map((f) => ({ path: f.rel })),
    ...pendingEntries,
  ];

  writeJson(path.join(bundleRoot, 'resources', 'cubric', 'update-manifest.json'), {
    appId: 'cubric.vision',
    platform,
    fromVersion: null,
    toVersion: '2.0.0',
    files: manifestFiles,
    preserve: [],
    delete: [],
  });
}

// ----- Test 1: applier leaves root-level launchers untouched -----

test('applier does not touch root-level launchers absent from files[]', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi954-t1-'));
  try {
    const install = path.join(dir, 'install');
    const bundle = path.join(dir, 'bundle');
    fs.mkdirSync(install, { recursive: true });

    // 1.5.0 install: sentinel launcher at the portable root
    fs.writeFileSync(path.join(install, 'update-from-zip.sh'), 'OLD CONTENT\n');
    writeJson(path.join(install, 'app', 'package.json'), { name: 'test', version: '1.5.0' });
    writeJson(path.join(install, 'resources', 'cubric', 'update-manifest.json'), {
      appId: 'cubric.vision', toVersion: '1.5.0', files: [], preserve: [],
    });

    // 2.0 bundle: launcher in pending-launchers, NOT at the root
    makeBundle(bundle, {
      files: [{ rel: 'app/package.json', content: '{"name":"test","version":"2.0.0"}\n' }],
      pendingLaunchers: [{ name: 'update-from-zip.sh', content: 'NEW CONTENT\n' }],
    });

    const run = spawnSync(process.execPath, [APPLIER, '--root', install, '--bundle', bundle], {
      encoding: 'utf8',
    });
    assert.strictEqual(run.status, 0, `applier failed: ${run.stderr || run.stdout}`);

    // Root-level launcher must be UNCHANGED
    const rootContent = fs.readFileSync(path.join(install, 'update-from-zip.sh'), 'utf8');
    assert.strictEqual(rootContent, 'OLD CONTENT\n',
      'applier rewrote the root-level launcher even though it was absent from files[]');

    // pending-launchers entry must have been written
    const pendingContent = fs.readFileSync(
      path.join(install, 'update', 'pending-launchers', 'update-from-zip.sh'), 'utf8',
    );
    assert.strictEqual(pendingContent, 'NEW CONTENT\n',
      'pending-launchers entry was not created by the applier');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ----- Test 2: boot-heal installs pending-launchers via renameSync -----

test('boot heal installs pending-launchers via renameSync, preserves +x, removes dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi954-t2-'));
  try {
    const root = path.join(dir, 'install');
    const pendingDir = path.join(root, 'update', 'pending-launchers');
    fs.mkdirSync(root, { recursive: true });

    // Old launcher at the root (simulating 1.5.0 version still on disk)
    fs.writeFileSync(path.join(root, 'start.sh'), '#!/bin/sh\necho OLD\n');

    // New launcher staged in pending-launchers (simulating what the applier wrote)
    const newContent = '#!/bin/sh\nmain() { echo NEW; }\nmain "$@"; exit $?\n';
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(path.join(pendingDir, 'start.sh'), newContent);
    if (process.platform !== 'win32') fs.chmodSync(path.join(pendingDir, 'start.sh'), 0o755);

    // The real module main.js calls at boot, not a replica of it.
    const logs = [];
    const logger = { info: (...a) => logs.push(['info', ...a]), warn: (...a) => logs.push(['warn', ...a]) };
    healPortableLaunchers(root, logger);
    assert.ok(!logs.some(([lvl]) => lvl === 'warn'), `heal warned: ${JSON.stringify(logs)}`);

    // Root launcher now carries the new content
    assert.strictEqual(
      fs.readFileSync(path.join(root, 'start.sh'), 'utf8'), newContent,
      'heal did not install the new launcher content',
    );

    // pending-launchers dir must be gone
    assert.ok(!fs.existsSync(pendingDir), 'pending-launchers dir was not removed after heal');

    // +x must be preserved on POSIX
    if (process.platform !== 'win32') {
      const stat = fs.statSync(path.join(root, 'start.sh'));
      assert.ok(stat.mode & 0o111, 'healed launcher does not have +x mode');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ----- Test 3: rename-based write does not corrupt a concurrently-reading sh -----
// On POSIX, renameSync gives the destination a new inode; any process that has
// the old path open keeps reading from the old inode undisturbed.
// copyFileSync truncates the same inode — measured to corrupt a running script.
// Skipped on Windows (Git Bash sh does not guarantee POSIX fd-follows-inode
// semantics; the protection there is the pending-launchers design in Test 1).

test('rename-based write does not corrupt a concurrently-reading sh script', (t) => {
  if (process.platform === 'win32') {
    return t.skip('POSIX fd-follows-inode test not applicable on Windows');
  }
  const sh = spawnSync('sh', ['-c', 'echo ok'], { encoding: 'utf8' });
  if (sh.status !== 0) return t.skip('no POSIX sh on this box');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi954-t3-'));
  try {
    // Old-applier rewriter: copyFileSync (truncates same inode — the bug)
    const copyRewriter = path.join(dir, 'copy-rewrite.js');
    fs.writeFileSync(copyRewriter, [
      "const fs = require('node:fs');",
      'const target = process.argv[2];',
      'const tmp = target + ".new";',
      'fs.writeFileSync(tmp, "#!/usr/bin/env sh\\necho REPLACEMENT\\necho pad\\necho pad\\n");',
      'fs.copyFileSync(tmp, target);',
    ].join('\n'));

    // New-applier rewriter: temp+rename (new inode — the fix)
    const renameRewriter = path.join(dir, 'rename-rewrite.js');
    fs.writeFileSync(renameRewriter, [
      "const fs = require('node:fs');",
      'const target = process.argv[2];',
      'const tmp = target + ".new";',
      'fs.writeFileSync(tmp, "#!/usr/bin/env sh\\necho REPLACEMENT\\necho pad\\necho pad\\n");',
      'fs.renameSync(tmp, target);',
    ].join('\n'));

    const runVictim = (rewriterPath) => {
      const script = path.join(dir, `victim-${path.basename(rewriterPath, '.js')}.sh`);
      fs.writeFileSync(script, [
        '#!/usr/bin/env sh',
        'echo START',
        `node ${JSON.stringify(rewriterPath)} "$0"`,
        'echo TAIL-RAN',
        '',
      ].join('\n'));
      return spawnSync('sh', [script], { encoding: 'utf8' });
    };

    // BEFORE (copyFileSync): TAIL-RAN must NOT appear — confirms the bug is observable
    const withCopy = runVictim(copyRewriter);
    assert.ok(withCopy.stdout.includes('START'),
      'copyFileSync victim did not start — cannot measure the bug');
    assert.ok(!withCopy.stdout.includes('TAIL-RAN'),
      'expected copyFileSync to cut the script short — has sh changed? (before-fix baseline must be measurable)');

    // AFTER (renameSync): TAIL-RAN must appear — confirms the fix works
    const withRename = runVictim(renameRewriter);
    assert.ok(withRename.stdout.includes('TAIL-RAN'),
      `rename-based write lost the script tail — fd-follows-inode semantics broken; stdout=${JSON.stringify(withRename.stdout)}`);
    assert.ok(!withRename.stdout.includes('REPLACEMENT'),
      'rename-based write ran the replacement body — the trailing exit in main() is missing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ----- Test 4: full round-trip — apply with pending-launchers, boot-heal -----

test('full round-trip: pending-launchers survive apply, boot-heal installs them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi954-t4-'));
  try {
    const install = path.join(dir, 'install');
    const bundle = path.join(dir, 'bundle');
    fs.mkdirSync(install, { recursive: true });

    // 1.5.0 install
    const oldContent = '#!/bin/sh\necho OLD UPDATE SCRIPT\n';
    fs.writeFileSync(path.join(install, 'update.sh'), oldContent);
    writeJson(path.join(install, 'app', 'package.json'), { name: 'test', version: '1.5.0' });
    writeJson(path.join(install, 'resources', 'cubric', 'update-manifest.json'), {
      appId: 'cubric.vision', toVersion: '1.5.0', files: [], preserve: [],
    });

    // 2.0 bundle: launcher only in pending-launchers
    const newContent = '#!/usr/bin/env sh\nmain() { echo NEW UPDATE SCRIPT; }\nmain "$@"; exit $?\n';
    makeBundle(bundle, {
      files: [{ rel: 'app/package.json', content: '{"name":"test","version":"2.0.0"}\n' }],
      pendingLaunchers: [{ name: 'update.sh', content: newContent, mode: 0o755 }],
    });

    // Step 1: apply with the real (current) applier, simulating the 1.x install
    const run = spawnSync(process.execPath, [APPLIER, '--root', install, '--bundle', bundle], {
      encoding: 'utf8',
    });
    assert.strictEqual(run.status, 0, `applier failed: ${run.stderr || run.stdout}`);

    // Root-level launcher must be UNCHANGED after apply
    assert.strictEqual(
      fs.readFileSync(path.join(install, 'update.sh'), 'utf8'), oldContent,
      'applier modified the root-level launcher — it must not be in files[]',
    );

    // pending-launchers dir and entry must exist
    const pendingDir = path.join(install, 'update', 'pending-launchers');
    assert.ok(fs.existsSync(pendingDir), 'pending-launchers dir was not created by the applier');
    assert.strictEqual(
      fs.readFileSync(path.join(pendingDir, 'update.sh'), 'utf8'), newContent,
      'pending launcher has unexpected content after apply',
    );

    // Step 2: the 2.0 boot heal, through the real module main.js calls
    healPortableLaunchers(install, { info() {}, warn(...a) { throw new Error(a.join(' ')); } });

    // After heal: root launcher has the new content
    assert.strictEqual(
      fs.readFileSync(path.join(install, 'update.sh'), 'utf8'), newContent,
      'boot-heal did not install the new launcher content',
    );

    // pending-launchers dir must be gone
    assert.ok(!fs.existsSync(pendingDir), 'pending-launchers dir still exists after heal');

    // +x preserved on POSIX
    if (process.platform !== 'win32') {
      const stat = fs.statSync(path.join(install, 'update.sh'));
      assert.ok(stat.mode & 0o111, 'healed launcher lost +x mode');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ----- The REAL builder: stageUpdateBundle, not a hand-built bundle -----
// The tests above prove the applier and the heal against bundles this file writes by
// hand, so they would stay green if build-portable.mjs put a launcher back at the root.
// These two drive the real stageUpdateBundle over a minimal linux full stage.

function makeFullStage(root) {
  const launchers = ['start.sh', 'start-with-terminal.sh', 'update.sh', 'update-from-zip.sh'];
  for (const name of launchers) {
    fs.writeFileSync(path.join(root, name), `#!/bin/sh\nmain() { echo ${name}; }\nmain "$@"; exit $?\n`);
    if (process.platform !== 'win32') fs.chmodSync(path.join(root, name), 0o755);
  }
  fs.mkdirSync(path.join(root, 'resources', 'cubric'), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, 'resources', 'cubric', 'connector-manifest.json'),
    path.join(root, 'resources', 'cubric', 'connector-manifest.json'),
  );
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app', 'package.json'), '{"version":"2.0.0"}\n');
  fs.mkdirSync(path.join(root, 'update'), { recursive: true });
  fs.writeFileSync(path.join(root, 'update', 'apply-update.cjs'), '// applier\n');
  return launchers;
}

async function loadBuilder() {
  const { pathToFileURL } = require('node:url');
  return import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'build-portable.mjs')).href);
}

test('stageUpdateBundle ships launchers only under update/pending-launchers, never at the root', async () => {
  const { stageUpdateBundle, PLATFORM_CONFIG } = await loadBuilder();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi954-build-'));
  try {
    const full = path.join(dir, 'full');
    const upd = path.join(dir, 'upd');
    fs.mkdirSync(full, { recursive: true });
    const launchers = makeFullStage(full);
    const manifest = await stageUpdateBundle(
      full, upd, { platform: 'linux', arch: 'x64', version: '2.0.0', clean: false }, PLATFORM_CONFIG.linux,
    );
    const listed = new Set(manifest.files.map((f) => f.path));
    for (const name of launchers) {
      assert.ok(!fs.existsSync(path.join(upd, name)), `${name} staged at the bundle root`);
      assert.ok(!listed.has(name), `${name} listed in files[] at the root: the installed applier would rewrite it`);
      assert.ok(listed.has(`update/pending-launchers/${name}`), `${name} missing from update/pending-launchers`);
      if (process.platform !== 'win32') {
        assert.ok(fs.statSync(path.join(upd, 'update', 'pending-launchers', name)).mode & 0o111, `${name} lost +x`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a delta against a 1.5.0-style baseline never deletes the root launchers', async () => {
  const { stageUpdateBundle, PLATFORM_CONFIG } = await loadBuilder();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi954-delta-'));
  try {
    const full = path.join(dir, 'full');
    const upd = path.join(dir, 'upd');
    fs.mkdirSync(full, { recursive: true });
    const launchers = makeFullStage(full);
    // 1.5.0 bundles listed every launcher at the root. Leaving them out of the new
    // bundle must not turn into a delete[]: the old update.sh relaunches through
    // start.sh, and the boot heal needs the app to start at all.
    const baselinePath = path.join(dir, 'baseline.json');
    writeJson(baselinePath, {
      toVersion: '1.5.0',
      files: [
        ...launchers.map((name) => ({ path: name, sha256: 'old' })),
        { path: 'app/package.json', sha256: 'old' },
        { path: 'update/apply-update.cjs', sha256: 'old' },
      ],
    });
    const manifest = await stageUpdateBundle(
      full, upd,
      { platform: 'linux', arch: 'x64', version: '2.0.0', clean: false, fromManifest: baselinePath },
      PLATFORM_CONFIG.linux,
    );
    for (const name of launchers) {
      assert.ok(!manifest.delete.includes(name), `delta deletes ${name}: ${JSON.stringify(manifest.delete)}`);
    }
    assert.strictEqual(manifest.fromVersion, '1.5.0');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
