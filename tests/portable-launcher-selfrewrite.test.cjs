'use strict';

// MPI-595 Gate A — every portable shell launcher ships inside the update bundle
// that overwrites it. apply-update.cjs writes each file with fs.copyFileSync,
// which truncates and rewrites the SAME inode, while `sh` is still reading the
// running script by byte offset. Measured, with a stand-in applier rewriting a
// live script (this file's own harness below): an unwrapped script loses its
// tail entirely ("unexpected EOF"), so update.sh never reaches its relaunch —
// the MPI-422 class of failure, on the one code path nobody sees fail.
//
// The fix is a shape, not a behaviour, so only a shape test defends it: the
// body lives in main(), and the LAST line is `main "$@"; exit $?`. The trailing
// exit is load-bearing on its own — without it the shell returns from main and
// reads on from its saved offset into the NEW file, and it really does execute
// whatever now sits there.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const LAUNCHER_DIRS = [
  [path.join(REPO_ROOT, 'scripts', 'portable', 'linux'), '.sh'],
  [path.join(REPO_ROOT, 'scripts', 'portable', 'macos'), '.command'],
];
const LAST_LINE = 'main "$@"; exit $?';

function launchers() {
  const found = [];
  for (const [dir, ext] of LAUNCHER_DIRS) {
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith(ext)) found.push(path.join(dir, name));
    }
  }
  return found;
}

test('every portable launcher wraps its body so an in-place rewrite cannot cut it short', () => {
  const files = launchers();
  assert.ok(files.length >= 8, `expected the launcher set, found ${files.length}`);

  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');

    assert.ok(/^main\(\) \{$/m.test(text), `${rel}: body is not wrapped in main() {`);

    const lines = text.split('\n').filter((l) => l.trim() !== '');
    assert.strictEqual(lines[lines.length - 1], LAST_LINE, `${rel}: last line must be \`${LAST_LINE}\``);

    // CRLF would break the shebang on Linux/macOS long before the wrapper mattered.
    assert.ok(!text.includes('\r\n'), `${rel}: CRLF line endings`);
  }
});

// The harness that measured the claim above. It is the reason the shape test
// exists, so it runs with it — skipped where there is no POSIX sh to run it in.
test('a wrapped script survives being rewritten mid-run; a naked one does not', (t) => {
  const sh = spawnSync('sh', ['-c', 'echo ok'], { encoding: 'utf8' });
  if (sh.status !== 0) return t.skip('no POSIX sh on this box');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi595-'));
  try {
    // Stand-in applier: copyFileSync a different, longer script over the running one.
    const rewriter = path.join(dir, 'rewrite.js');
    fs.writeFileSync(rewriter, [
      "const fs = require('node:fs');",
      'const target = process.argv[2];',
      'const next = target + ".new";',
      'fs.writeFileSync(next, "#!/usr/bin/env sh\\necho REPLACEMENT\\necho pad\\necho pad\\necho pad\\n");',
      'fs.copyFileSync(next, target);',
    ].join('\n'));

    const body = ['echo START', `node ${JSON.stringify(rewriter)} "$0"`, 'echo TAIL-RAN'];
    const victims = {
      naked: ['#!/usr/bin/env sh', ...body, ''],
      wrapped: ['#!/usr/bin/env sh', 'main() {', ...body, '}', LAST_LINE, ''],
    };

    const run = (kind) => {
      const file = path.join(dir, `victim-${kind}.sh`);
      fs.writeFileSync(file, victims[kind].join('\n'));
      const out = spawnSync('sh', [file], { encoding: 'utf8' });
      return `${out.stdout || ''}${out.stderr || ''}`;
    };

    const naked = run('naked');
    assert.ok(naked.includes('START'), 'the naked victim never started');
    assert.ok(!naked.includes('TAIL-RAN'), 'expected the naked victim to lose its tail — has sh changed?');

    const wrapped = run('wrapped');
    assert.ok(wrapped.includes('TAIL-RAN'), 'the wrapped victim lost its tail');
    assert.ok(!wrapped.includes('REPLACEMENT'), 'the wrapped victim ran the replacement body — the trailing exit is missing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
