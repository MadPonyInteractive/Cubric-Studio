// MPI-819: the pre-push done gate, replayed on a REAL close from this repo's history.
//
// 250d9da4 moved MPI-811 to `done` in a board-only commit while 034d1d52 - the card's own
// fix commit - was red in CI on radial-menu.spec.js, a spec it had just edited. That is the
// push the gate exists to refuse. The other cases are the ones it must NOT refuse, because a
// gate that blocks every close during someone else's red is the freeze it was built to end.
//
// The two `gh` calls are replaced with fixtures (MPI_PREPUSH_RUNS_FILE / _FAILED_DIR); the
// git half is real. CI checks out shallow, so the history is absent there and this skips -
// the hook only ever runs on a dev box.
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// execFile, not exec: through cmd.exe a `^` is the escape character and `250d9da4^` never arrives.
const git = (...args) => execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

let sha = null;
try {
  sha = {
    close: git('rev-parse', '250d9da4^{commit}'),      // chore(MPI-811): close
    before: git('rev-parse', '250d9da4^'),
    code: git('rev-parse', '034d1d52^{commit}'),       // fix(MPI-811): the card's last code commit
    pred: git('rev-parse', 'bf266123^{commit}'),       // the run before it
  };
} catch { /* shallow clone */ }

const GIF = 'tests/desktop/gif-cutout.spec.js';
const RADIAL = 'tests/desktop/radial-menu.spec.js';

/** @param {string[]} runs newest first  @param {Record<string,string[]>} failed by run id */
function push(runs, failed = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi819-'));
  try {
    fs.writeFileSync(path.join(dir, 'runs.txt'), runs.join('\n') + '\n');
    for (const [id, specs] of Object.entries(failed)) fs.writeFileSync(path.join(dir, `${id}.txt`), specs.join('\n') + '\n');
    const r = spawnSync('bash', ['.husky/pre-push'], {
      cwd: ROOT,
      input: `refs/heads/master ${sha.close} refs/heads/master ${sha.before}\n`,
      env: { ...process.env, MPI_PREPUSH_RUNS_FILE: path.join(dir, 'runs.txt'), MPI_PREPUSH_FAILED_DIR: dir },
      encoding: 'utf8',
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const opts = { skip: sha ? false : 'history not present (shallow clone)' };

test('MPI-811 as it happened: its commit brought a NEW failing spec under an older red - refused', opts, () => {
  const r = push(
    [`${sha.close} completed failure 5`, `${sha.code} completed failure 4`, `${sha.pred} completed failure 3`],
    { 5: [GIF, RADIAL], 4: [GIF, RADIAL], 3: [GIF] });
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /MPI-811 moves to done/);
  assert.match(r.out, /radial-menu\.spec\.js/);
  assert.doesNotMatch(r.out, / {4}tests\/desktop\/gif-cutout/, 'the red that predates the card is not blamed on it');
});

test('someone else\'s red, same failing specs before and after: the close goes through', opts, () => {
  const r = push(
    [`${sha.code} completed failure 4`, `${sha.pred} completed failure 3`],
    { 4: [GIF], 3: [GIF] });
  assert.strictEqual(r.status, 0, r.out);
  assert.match(r.out, /docs\/board-only push/);
});

test('any green run carrying the commit clears it, whatever came first', opts, () => {
  const r = push(
    [`${sha.close} completed success 6`, `${sha.code} completed failure 4`, `${sha.pred} completed success 3`],
    { 4: [RADIAL] });
  assert.strictEqual(r.status, 0, r.out);
});

test('green before, red on the first run carrying it: refused without needing a spec diff', opts, () => {
  const r = push([`${sha.code} completed failure 4`, `${sha.pred} completed success 3`], { 4: [RADIAL] });
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /radial-menu\.spec\.js/);
});

test('a run in flight is no verdict: refused, and told which run to watch', opts, () => {
  const r = push([`${sha.code} in_progress - 4`, `${sha.pred} completed success 3`]);
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /gh run watch 4/);
});

test('code and close in one push: refused, and handed the push that sends the code alone', opts, () => {
  const r = push([`${sha.pred} completed success 3`]);
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes(`git push origin ${sha.code}:master`), r.out);
});

test('no runs at all (no gh, no network): fails open', opts, () => {
  const r = push([]);
  assert.strictEqual(r.status, 0, r.out);
});
