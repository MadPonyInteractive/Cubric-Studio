'use strict';

// MPI-616 — the portable build's Authenticode signing pass. The real proof is a CI
// build whose binaries all read Valid; these pin the pieces that would silently
// ship an unsigned build instead of failing it.

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.join(__dirname, '..');
const load = () => import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'build-portable.mjs')).href);

test('--sign is opt-in: a plain build never signs, the flag turns it on', async () => {
  const { parseArgs } = await load();
  assert.strictEqual(parseArgs([]).sign, false);
  assert.strictEqual(parseArgs(['--sign']).sign, true);
});

test('only PE binaries are signing candidates', async () => {
  const { isSignable } = await load();
  for (const f of ['CubricStudio.exe', 'ffmpeg.dll', 'resources/app/node_modules/sharp/build/x.node', 'UV/UV.EXE']) {
    assert.ok(isSignable(f), f);
  }
  for (const f of ['resources/app/main.js', 'LICENSE', 'locales/en-US.pak', 'snapshot_blob.bin']) {
    assert.ok(!isSignable(f), f);
  }
});

test('--sign with no signing setup fails the build, naming every missing variable', async () => {
  const { resolveSigningEnv, SIGNING_ENV } = await load();
  assert.throws(() => resolveSigningEnv({}), (err) => SIGNING_ENV.every((name) => err.message.includes(name)));
  assert.throws(() => resolveSigningEnv({ ARTIFACT_SIGNING_SIGNTOOL: 'x' }), /ARTIFACT_SIGNING_DLIB/);
  const env = { ARTIFACT_SIGNING_SIGNTOOL: 'a', ARTIFACT_SIGNING_DLIB: 'b', ARTIFACT_SIGNING_METADATA: 'c' };
  assert.deepStrictEqual(resolveSigningEnv(env), { signtool: 'a', dlib: 'b', metadata: 'c' });
});

// The pass re-reads every binary after signing and fails on anything not Valid, so a
// status reader that misparses would either ship unsigned or fail every build. Electron's
// own dist is the census fixture: electron.exe unsigned, d3dcompiler_47.dll Microsoft-signed.
test('authenticode status reads the census truth off Electron\'s dist', { skip: process.platform !== 'win32' }, async () => {
  const { authenticodeStatus } = await load();
  const dist = path.join(REPO_ROOT, 'node_modules', 'electron', 'dist');
  const exe = path.join(dist, 'electron.exe');
  const msDll = path.join(dist, 'd3dcompiler_47.dll');
  const status = await authenticodeStatus([exe, msDll]);
  assert.strictEqual(status.get(exe), 'NotSigned', JSON.stringify([...status]));
  assert.strictEqual(status.get(msDll), 'Valid');
});
