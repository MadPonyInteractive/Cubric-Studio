// MPI-1022: the commit-time half of the done gate. Code and a card's move to `done` may not
// share a commit, because the pre-push done gate (MPI-819) could never pass it.
//
// Runs scripts/precommit-done-gate.sh inside a throwaway repo, so this repo's shared index
// is never touched. Under `sh`, as husky runs it - and not `bash`, which on a Windows box
// can resolve to the WSL launcher in System32 before Git Bash.
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'precommit-done-gate.sh').replace(/\\/g, '/');
const CARD = '.agents/mpi-kanban/tasks/MPI-1/task.json';
const card = (column, maturity) => JSON.stringify({ id: 'MPI-1', column, maturity }, null, 2) + '\n';

/** A repo holding MPI-1 in `doing` plus one code file; `stage` stages this commit's changes. */
function gate(stage) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1022-'));
  const git = (...args) => execFileSync('git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=.no-hooks', ...args],
    { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
    git('add', rel);
  };
  try {
    git('init', '-q');
    write(CARD, card('doing', 'in-progress'));
    write('js/a.js', '1\n');
    git('commit', '-q', '-m', 'base');
    stage(write, git, dir);
    const r = spawnSync('sh', [SCRIPT], { cwd: dir, encoding: 'utf8' });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('code and a done move in one commit: refused, naming the card and the code to commit alone', () => {
  const r = gate((write) => { write('js/a.js', '2\n'); write(CARD, card('done', 'complete')); });
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /MPI-1 moves to done/);
  assert.match(r.out, / {6}js\/a\.js/);
  assert.doesNotMatch(r.out, / {6}\.agents\//, 'the card files are what gets left out');
});

test('the close on its own: passes', () => {
  const r = gate((write) => write(CARD, card('done', 'complete')));
  assert.strictEqual(r.status, 0, r.out);
});

test('code with the card still in doing: passes', () => {
  const r = gate((write) => { write('js/a.js', '2\n'); write(CARD, card('doing', 'validating')); });
  assert.strictEqual(r.status, 0, r.out);
});

test('a card closed as rejected beside code: passes, it ships nothing to judge', () => {
  const r = gate((write) => { write('js/a.js', '2\n'); write(CARD, card('done', 'rejected')); });
  assert.strictEqual(r.status, 0, r.out);
});

test('concluding a merge: passes, the incoming commits are not this commit', () => {
  const r = gate((write, git, dir) => {
    write('js/a.js', '2\n');
    write(CARD, card('done', 'complete'));
    fs.writeFileSync(path.join(dir, '.git', 'MERGE_HEAD'), git('rev-parse', 'HEAD') + '\n');
  });
  assert.strictEqual(r.status, 0, r.out);
});
