/**
 * Boot prune of the mask layer TEMP store (MPI-1074).
 *
 * Every app instance owns one `%TEMP%\cubric-<uuid>`. The prune used to delete every such
 * dir but its own, so an `app:isolated` boot wiped the developer's LIVE app's persisted
 * masks. A dir now goes only when the PID stamped in it is dead.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pruneStaleMaskTemp, writeOwnerMarker, isStale, pidAlive } = require('../main/maskTempPrune.cjs');

const quiet = { info() {}, warn() {} };
const LIVE_PEER = 424242;
const DEAD_PEER = 434343;
const isAlive = (pid) => pid === LIVE_PEER;

function seed(root, name, ownerPid) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'p', 'g', 'i'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'p', 'g', 'i', 'manual.png'), 'x');
  if (ownerPid !== undefined) writeOwnerMarker(dir, ownerPid);
  return dir;
}

test('prune keeps a live peer, removes dead and long-unmarked session dirs, ignores non-session dirs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mask-prune-'));
  const own = 'cubric-' + randomUUID();
  const ownDir = seed(root, own, process.pid);
  const live = seed(root, 'cubric-' + randomUUID(), LIVE_PEER);
  const dead = seed(root, 'cubric-' + randomUUID(), DEAD_PEER);
  // No marker = a pre-MPI-1074 build, possibly still running: kept until a week untouched.
  const unmarkedFresh = seed(root, 'cubric-' + randomUUID());
  const unmarkedOld = seed(root, 'cubric-' + randomUUID());
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  fs.utimesSync(unmarkedOld, eightDaysAgo, eightDaysAgo);
  const sibling = seed(root, 'cubric-deepinfra'); // MPI-919: paid outputs, not a session
  fs.utimesSync(sibling, eightDaysAgo, eightDaysAgo);

  pruneStaleMaskTemp(root, own, quiet, isAlive);

  assert.ok(fs.existsSync(ownDir), 'own dir kept');
  assert.ok(fs.existsSync(path.join(live, 'p', 'g', 'i', 'manual.png')), 'live peer masks kept');
  assert.ok(!fs.existsSync(dead), 'dead owner pruned');
  assert.ok(fs.existsSync(unmarkedFresh), 'recent pre-marker dir kept');
  assert.ok(!fs.existsSync(unmarkedOld), 'week-old pre-marker dir pruned');
  assert.ok(fs.existsSync(sibling), 'non-session sibling untouched');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a marker carrying our own PID on another dir is a dead predecessor, not us', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mask-prune-'));
  const dir = seed(root, 'cubric-' + randomUUID(), process.pid);
  assert.strictEqual(isStale(dir, () => true), true);
  fs.writeFileSync(path.join(dir, 'owner.json'), '{not json');
  assert.strictEqual(isStale(dir, () => true), false, 'corrupt marker = unmarked, inside its grace');
  fs.rmSync(root, { recursive: true, force: true });
});

test('pidAlive sees this process alive and a reaped child dead', () => {
  assert.strictEqual(pidAlive(process.pid), true);
  const { spawnSync } = require('node:child_process');
  const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))']);
  assert.strictEqual(pidAlive(Number(child.stdout.toString())), false);
});
