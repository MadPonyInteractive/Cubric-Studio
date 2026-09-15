'use strict';

// MPI-762 — grow a network volume from Remote settings.
//
// The route is the boundary between the renderer and the user's RunPod account: it
// forwards ONLY a whole-number size to RunPod's PATCH /networkvolumes/{id} and refuses
// anything else before RunPod is called. RunPod itself refuses a size that is not larger
// than the current one, so grow-only is enforced there and passed back as-is.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The logger resolves its path at require time; keep the run out of the real app.log.
process.env.APP_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mpi762-'));

const { router, client, setApiKeyResolver } = require('../routes/runpodRemote');

setApiKeyResolver(async () => 'rpa_test');

/** PATCH /runpod/volumes/:id off a throwaway server. */
async function patch(id, body) {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/runpod/volumes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('client.updateVolume sends PATCH /networkvolumes/{id} with the size only', async () => {
  const realFetch = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts };
    return new Response(JSON.stringify({ id: 'vol-1', size: 80 }), { status: 200 });
  };
  let r;
  try {
    r = await client.updateVolume('rpa_test', 'vol-1', 80);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(r.ok, true);
  assert.equal(seen.url, 'https://rest.runpod.io/v1/networkvolumes/vol-1');
  assert.equal(seen.opts.method, 'PATCH');
  assert.deepEqual(JSON.parse(seen.opts.body), { size: 80 });
});

test('route forwards a valid size alone and passes RunPod\'s answer through', async () => {
  const calls = [];
  const real = client.updateVolume;
  client.updateVolume = async (_key, id, size) => {
    calls.push({ id, size });
    return size > 55
      ? { ok: true, status: 200, json: { id, size } }
      : { ok: false, status: 400, json: { error: 'size must be greater than the current size' } };
  };
  try {
    const grown = await patch('vol-1', { size: 60, name: 'renamed' });
    assert.equal(grown.status, 200);
    assert.deepEqual(grown.json, { id: 'vol-1', size: 60 });

    const shrunk = await patch('vol-1', { size: 50 });
    assert.equal(shrunk.status, 400);
    assert.match(shrunk.json.error, /greater than/);
  } finally {
    client.updateVolume = real;
  }
  assert.deepEqual(calls, [{ id: 'vol-1', size: 60 }, { id: 'vol-1', size: 50 }]);
});

test('route refuses a missing, non-positive, fractional, string or over-cap size without calling RunPod', async () => {
  let called = 0;
  const real = client.updateVolume;
  client.updateVolume = async () => {
    called += 1;
    return { ok: true, status: 200, json: {} };
  };
  try {
    for (const body of [{}, { size: 0 }, { size: -10 }, { size: 60.5 }, { size: '60' }, { size: 4001 }]) {
      const r = await patch('vol-1', body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.json.error, 'invalid_size', JSON.stringify(body));
    }
  } finally {
    client.updateVolume = real;
  }
  assert.equal(called, 0);
});
