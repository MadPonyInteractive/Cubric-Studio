'use strict';

// MPI-783 — a portable --dry-run stages no shippable artifact, so it must never
// write where a real build does. On 2026-09-12 a dry-run shared the real build's
// stage root, archive names and tracked source-manifest mirror: it rewrote the
// delivered 1.6.0 stage in place (skeleton + a re-hashed manifest a later delta
// would have trusted as its baseline), replaced both shipped zips, and left a
// 34k-line manifest diff in the working tree (found on MPI-782).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'build-portable.mjs');
const VERSION = require('../package.json').version;

function snapshot(root) {
  const out = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else out[path.relative(root, abs)] = fs.readFileSync(abs, 'utf8');
    }
  })(root);
  return out;
}

test('a dry-run over a real build leaves it untouched and writes no archive', () => {
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-dry-run-'));
  try {
    // A real build's outputs, under the exact names a real win32 build uses.
    const realStage = path.join(stageDir, `CubricVision-windows-x64-v${VERSION}`);
    const real = {
      [path.join(realStage, 'resources', 'cubric', 'update-manifest.json')]: '{"artifact":{"kind":"portable-stage"}}',
      [path.join(realStage, 'update.bat')]: 'REAL LAUNCHER',
      [path.join(stageDir, `CubricVision-v${VERSION}-update-only`, 'marker.txt')]: 'REAL BUNDLE',
      [path.join(stageDir, `CubricVision-windows-x64-v${VERSION}.zip`)]: 'REAL ZIP',
      [path.join(stageDir, `CubricVision-windows-x64-update-v${VERSION}.zip`)]: 'REAL UPDATE ZIP',
    };
    for (const [file, body] of Object.entries(real)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
    }
    const before = snapshot(stageDir);

    // --no-source-manifest so a regression here can never dirty the repo's tracked file.
    const run = spawnSync(process.execPath, [
      SCRIPT, '--dry-run', '--platform', 'win32', '--arch', 'x64',
      '--stage-dir', stageDir, '--no-source-manifest',
    ], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.strictEqual(run.status, 0, run.stderr);

    const after = snapshot(stageDir);
    for (const rel of Object.keys(before)) {
      assert.strictEqual(after[rel], before[rel], `dry-run rewrote real output ${rel}`);
    }
    const newFiles = Object.keys(after).filter((rel) => !(rel in before));
    assert.deepStrictEqual(newFiles.filter((rel) => /\.(zip|tar\.gz)$/.test(rel)), [], 'dry-run wrote an archive');
    assert.ok(newFiles.length > 0, 'dry-run staged nothing at all');
    for (const rel of newFiles) {
      assert.match(rel.split(path.sep)[0], /-dry-run$/, `dry-run wrote outside its own roots: ${rel}`);
    }
    const manifest = JSON.parse(after[path.join(
      `CubricVision-windows-x64-v${VERSION}-dry-run`, 'resources', 'cubric', 'update-manifest.json',
    )]);
    assert.strictEqual(manifest.artifact.kind, 'dry-run-stage');
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
});

test('a dry-run never archives and never mirrors the tracked source manifest', async () => {
  const { parseArgs } = await import(pathToFileURL(SCRIPT).href);
  const dry = parseArgs(['--dry-run']);
  assert.strictEqual(dry.archive, false);
  assert.strictEqual(dry.sourceManifest, false);
  const real = parseArgs([]);
  assert.strictEqual(real.archive, true);
  assert.strictEqual(real.sourceManifest, true);
});
