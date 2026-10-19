'use strict';

// MPI-1199 — RunPod answered a network-volume create with a 500 while the volume was
// made and billing. A 5xx must adopt the volume that appeared, never report "not created".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi1199-'));

const { client } = require('../routes/runpodRemote');

const OLD = { id: 'old1', name: 'cubric-vision-EU-RO-1', dataCenter: 'EU-RO-1' };
const NEW = { id: 'new1', name: 'cubric-vision-EU-RO-1', dataCenter: 'EU-RO-1', size: 50 };

/** Stub fetch: GET lists return `lists` in turn (last one repeats), POST returns `post`. */
async function withRunPod({ lists, post }, fn) {
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async (_url, opts = {}) => {
    if ((opts.method || 'GET') === 'POST') return new Response(JSON.stringify(post.body), { status: post.status });
    const list = lists[Math.min(n++, lists.length - 1)];
    return new Response(JSON.stringify(list), { status: 200 });
  };
  try { return await fn(); } finally { globalThis.fetch = real; }
}

const spec = { name: 'cubric-vision-EU-RO-1', size: 50, dataCenterId: 'EU-RO-1' };

test('a 500 whose volume appeared is adopted as a success', async () => {
  const r = await withRunPod({ lists: [[OLD], [OLD, NEW]], post: { status: 500, body: {} } },
    () => client.createVolume('key', spec));
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
  assert.equal(r.json.id, 'new1');
});

test('a 500 with no new volume stays a failure (never adopts the old one)', { timeout: 10000 }, async () => {
  const r = await withRunPod({ lists: [[OLD]], post: { status: 500, body: { error: 'boom' } } },
    () => client.createVolume('key', spec));
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
});

test('a 4xx is a real refusal and is not re-listed', async () => {
  let gets = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, opts = {}) => {
    if ((opts.method || 'GET') === 'POST') return new Response(JSON.stringify({ error: 'bad size' }), { status: 400 });
    gets += 1;
    return new Response('[]', { status: 200 });
  };
  try {
    const r = await client.createVolume('key', spec);
    assert.equal(r.status, 400);
    assert.equal(gets, 1, 'only the pre-create snapshot');
  } finally { globalThis.fetch = real; }
});
