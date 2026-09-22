'use strict';

/**
 * The agent generation relay (MPI-546) — routes/connector.js.
 *
 * `POST /connector/generate` is the contract; the SSE hop to the renderer is the
 * disposable half. These tests drive the REAL router over a real socket with a
 * fake renderer, because the failure that matters is silent: a job that is never
 * delivered, or a result that never settles its caller, both look like a hung app
 * rather than a broken relay.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

const connectorRoutes = require('../routes/connector');

/** Boot the router on an ephemeral port; returns the base URL and a stop(). */
async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(connectorRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * A fake renderer: subscribes to the job stream and resolves once the server has
 * confirmed the subscription with its `connected` frame. Waiting for that frame
 * is load-bearing — POSTing /connector/generate before the server has registered
 * the subscriber races into a false APP_UNAVAILABLE.
 */
async function fakeRenderer(base) {
  const ac = new AbortController();
  const res = await fetch(`${base}/connector/jobs/stream`, { signal: ac.signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  async function readFrame() {
    for (;;) {
      const idx = buffer.indexOf('\n\n');
      if (idx !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const event = /^event: (.+)$/m.exec(raw)?.[1];
        const data = /^data: (.+)$/m.exec(raw)?.[1];
        return { event, data: data ? JSON.parse(data) : null };
      }
      const { value, done } = await reader.read();
      if (done) throw new Error('stream closed before a frame arrived');
      buffer += decoder.decode(value, { stream: true });
    }
  }

  const hello = await readFrame();
  assert.equal(hello.event, 'connected');

  return { readFrame, close: () => ac.abort() };
}

const postJson = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json().then((json) => ({ status: r.status, json })));

test('generate → job frame → result settles the waiting caller', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    // Don't await yet — the route holds this open until the renderer reports back.
    const pending = postJson(`${base}/connector/generate`, {
      modelId: 'krea2',
      operation: 't2i',
      positive: 'a lone rider at dusk',
    });

    const frame = await renderer.readFrame();
    assert.equal(frame.event, 'job');
    assert.equal(frame.data.capability, 'generation.submit');
    assert.ok(frame.data.jobId, 'job carries an id to report against');
    assert.deepEqual(frame.data.input, {
      modelId: 'krea2',
      operation: 't2i',
      positive: 'a lone rider at dusk',
      negative: '',
      injectionParams: {},
    });

    const ack = await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, {
      ok: true,
      output: { itemId: 'item-9', filePath: 'C:/out/rider.png' },
    });
    assert.equal(ack.json.received, true, 'a live job id is settled, not dropped');

    const { json } = await pending;
    assert.equal(json.ok, true);
    assert.equal(json.output.itemId, 'item-9');
    assert.equal(json.output.filePath, 'C:/out/rider.png');
  } finally {
    renderer.close();
    await stop();
  }
});

test('an error result from the renderer reaches the caller intact', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    const pending = postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i' });
    const frame = await renderer.readFrame();
    await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, {
      ok: false,
      error: { code: 'NO_PROJECT', message: 'No project is open in Vision. Open one first.' },
    });
    const { json } = await pending;
    assert.equal(json.ok, false);
    assert.equal(json.error.code, 'NO_PROJECT');
  } finally {
    renderer.close();
    await stop();
  }
});

test('no subscribed renderer yields APP_UNAVAILABLE rather than hanging', async () => {
  const { base, stop } = await startServer();
  try {
    const { json } = await postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i' });
    assert.equal(json.ok, false);
    assert.equal(json.error.code, 'APP_UNAVAILABLE');
  } finally {
    await stop();
  }
});

test('modelId and operation are required', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    const missingOp = await postJson(`${base}/connector/generate`, { modelId: 'krea2' });
    assert.equal(missingOp.status, 400);
    assert.equal(missingOp.json.error.code, 'BAD_REQUEST');

    const missingModel = await postJson(`${base}/connector/generate`, { operation: 't2i' });
    assert.equal(missingModel.status, 400);
  } finally {
    renderer.close();
    await stop();
  }
});

test('a job goes to ONE renderer only — never broadcast', async () => {
  // Found in the MPI-546 live smoke: the relay wrote each frame to every
  // subscriber, so two renderers (a dev browser tab beside the Electron window)
  // both dispatched the same job. The user pays for two generations and sees one
  // result, because the first reply settles the caller and the rest are dropped.
  const { base, stop } = await startServer();
  const first = await fakeRenderer(base);
  const second = await fakeRenderer(base);
  try {
    const pending = postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i' });

    // Newest subscriber wins — it is the renderer the user is looking at.
    const frame = await second.readFrame();
    assert.equal(frame.event, 'job');

    // The older one must see NOTHING. Race its next frame against a settled
    // timer: if the frame wins, the job was broadcast.
    const leaked = await Promise.race([
      first.readFrame().then(() => true),
      new Promise((r) => setTimeout(() => r(false), 250)),
    ]);
    assert.equal(leaked, false, 'the older renderer must not receive the job');

    await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
    assert.equal((await pending).json.ok, true);
  } finally {
    first.close();
    second.close();
    await stop();
  }
});

// ── Card naming (MPI-776) ───────────────────────────────────────────────────
//
// While a project is open the renderer owns its itemGroups and writes the whole
// array back on every save, so a name has to travel the relay like open-project.

test('rename-card relays card.rename; a null name reaches the renderer to clear it', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    const pending = postJson(`${base}/connector/rename-card`, { groupId: 'g-1', name: 'Marshall' });
    const frame = await renderer.readFrame();
    assert.equal(frame.data.capability, 'card.rename');
    assert.deepEqual(frame.data.input, { groupId: 'g-1', name: 'Marshall' });
    await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, {
      ok: true, output: { groupId: 'g-1', cardName: 'Marshall', displayName: 'Marshall' },
    });
    const { json } = await pending;
    assert.equal(json.ok, true);
    assert.equal(json.output.cardName, 'Marshall');

    const clearing = postJson(`${base}/connector/rename-card`, { groupId: 'g-1', name: null });
    const clearFrame = await renderer.readFrame();
    assert.equal(clearFrame.data.input.name, null);
    await postJson(`${base}/connector/jobs/${clearFrame.data.jobId}/result`, { ok: true, output: {} });
    assert.equal((await clearing).json.ok, true);
  } finally {
    renderer.close();
    await stop();
  }
});

test('rename-card refuses a missing groupId or name before relaying anything', async () => {
  // No renderer subscribed: a body that got past validation would answer APP_UNAVAILABLE.
  const { base, stop } = await startServer();
  try {
    const noId = await postJson(`${base}/connector/rename-card`, { name: 'Marshall' });
    assert.equal(noId.status, 400);
    assert.equal(noId.json.error.code, 'BAD_REQUEST');

    const noName = await postJson(`${base}/connector/rename-card`, { groupId: 'g-1' });
    assert.equal(noName.status, 400);
    assert.equal(noName.json.error.code, 'BAD_REQUEST');
  } finally {
    await stop();
  }
});

test('generate relays cardName on both branches and refuses a non-string one', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    for (const body of [
      { modelId: 'krea2', operation: 't2i', positive: 'a rider', cardName: 'Rider at dusk' },
      { flowId: 'drama-box', fields: { positive: 'Hello.' }, cardName: 'Welcome line' },
    ]) {
      const pending = postJson(`${base}/connector/generate`, body);
      const frame = await renderer.readFrame();
      assert.equal(frame.data.input.cardName, body.cardName);
      await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
      await pending;
    }

    const bad = await postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i', cardName: 7 });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, 'INVALID_CARD_NAME');
  } finally {
    renderer.close();
    await stop();
  }
});

test('a result for an unknown job id is a no-op, never an error', async () => {
  const { base, stop } = await startServer();
  try {
    const { status, json } = await postJson(`${base}/connector/jobs/not-a-real-job/result`, { ok: true });
    assert.equal(status, 200);
    assert.equal(json.received, false);
  } finally {
    await stop();
  }
});

test('capabilities reports generationSubmit only while a renderer is subscribed', async () => {
  const { base, stop } = await startServer();
  try {
    const before = await fetch(`${base}/connector/capabilities`).then((r) => r.json());
    assert.equal(before.generationSubmit, false);

    const renderer = await fakeRenderer(base);
    const during = await fetch(`${base}/connector/capabilities`).then((r) => r.json());
    assert.equal(during.generationSubmit, true);
    renderer.close();
  } finally {
    await stop();
  }
});

// ── Media on a model submit (MPI-765) ───────────────────────────────────────
//
// The modelId branch hardcoded `mediaItems: []` and refused every op with a required
// image slot (MEDIA_UNSUPPORTED), so Klein Edit and every reference-driven op were
// unreachable from an agent. The renderer handler imports the DOM; the resolver it
// delegates to (`generationControls.js`) does not, which is why it is tested here.

const { findModelDef, resolveAgentMedia } = require('../js/data/generationControls.js');

test('a modelId submit relays media; a text submit carries no media key', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    const media = [{ role: 'inputImage', url: '/project-file?path=C%3A%2Fp%2FMedia%2F.preview-assets%2Fa.png' }];
    const pending = postJson(`${base}/connector/generate`, {
      modelId: 'klein-9b', operation: 'kleinEdit', positive: 'turn him', media,
    });
    const frame = await renderer.readFrame();
    // Dropped here, the renderer sees no image and answers MEDIA_REQUIRED for one the caller sent.
    assert.deepEqual(frame.data.input.media, media);
    await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, { ok: true, output: {} });
    assert.equal((await pending).json.ok, true);

    const textPending = postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i', media: [] });
    const textFrame = await renderer.readFrame();
    assert.equal('media' in textFrame.data.input, false);
    await postJson(`${base}/connector/jobs/${textFrame.data.jobId}/result`, { ok: true, output: {} });
    await textPending;
  } finally {
    renderer.close();
    await stop();
  }
});

test('media comes back in DECLARED slot order, whatever order the caller sent', () => {
  // Klein Edit's slots are ordinal: injection strips the role and item order is the
  // meaning. Returned in the caller's order, the REFERENCE gets edited — with ok:true.
  const r = resolveAgentMedia('kleinEdit', findModelDef('klein-9b'), [
    { role: 'inputImage2', url: '/ref.png' },
    { role: 'inputImage', url: '/plate.png' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.mediaItems.map((m) => [m.role, m.url, m.mediaType]), [
    ['inputImage', '/plate.png', 'image'],
    ['inputImage2', '/ref.png', 'image'],
  ]);
});

test('a bad media entry is a named BAD_REQUEST, never a silent drop', () => {
  const klein = findModelDef('klein-9b');
  const unknown = resolveAgentMedia('kleinEdit', klein, [{ role: 'image1', url: '/a.png' }]);
  assert.equal(unknown.code, 'BAD_REQUEST');
  assert.match(unknown.message, /inputImage, inputImage2, inputImage3/);

  assert.equal(resolveAgentMedia('kleinEdit', klein, [{ role: 'inputImage' }]).code, 'BAD_REQUEST');

  // Given twice, the executor's type fallback routes the second copy into the next
  // slot, so a 1-image edit silently gets a different picture as its reference.
  const twice = resolveAgentMedia('kleinEdit', klein, [
    { role: 'inputImage', url: '/a.png' }, { role: 'inputImage', url: '/b.png' },
  ]);
  assert.equal(twice.code, 'BAD_REQUEST');
});

// ── look reports the image's SHAPE (MPI-774 Phase 7) ─────────────────────────

test('every look carries imageSize, not just a boxed one', async () => {
  // Without it the agent cannot know a ratio is about to centre-crop the picture:
  // it is the only route that tells the caller an image's shape. Fabio animated a
  // 4:5 still on a 16:9 canvas and the head left the frame.
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const sharp = require('sharp');
  const imagePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mpi-look-')), 'tall.png');
  await sharp({ create: { width: 1024, height: 1280, channels: 3, background: '#888' } })
    .png().toFile(imagePath);

  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    const pending = postJson(`${base}/connector/describe`, { imagePath });
    const frame = await renderer.readFrame();
    assert.equal(frame.data.capability, 'agent.describe');
    await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, {
      ok: true, output: { text: 'a grey rectangle' },
    });

    const { json } = await pending;
    assert.equal(json.ok, true);
    assert.equal(json.output.text, 'a grey rectangle', 'the description still comes through');
    assert.deepEqual(json.output.imageSize, { w: 1024, h: 1280 });
  } finally {
    renderer.close();
    await stop();
    fs.rmSync(path.dirname(imagePath), { recursive: true, force: true });
  }
});

test('a required slot is filled BY ROLE: a reference alone is MEDIA_REQUIRED', () => {
  // The shared predicate takes any image for a required image slot. On this path that
  // let a lone `inputImage2` through, and ordinal injection made the reference the
  // picture being edited, with ok:true. Caught live on the first real run.
  const r = resolveAgentMedia('kleinEdit', findModelDef('klein-9b'), [{ role: 'inputImage2', url: '/ref.png' }]);
  assert.equal(r.code, 'MEDIA_REQUIRED');
  assert.match(r.message, /"inputImage"/);
});

/*
 * Cancel (Fabio, live 2026-09-20): the route holds a submit open for the whole render, so a
 * caller had nothing to point at until it was too late to matter. `requestId` IS that handle:
 * the submit goes out under it, and `/connector/cancel` names it back to the renderer.
 */
test('a submit sent with a requestId can be cancelled by it, and only while it is in flight', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    const requestId = 'req-cowgirl-anime-0001';
    const pending = postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i', positive: 'anime', requestId });
    const submit = await renderer.readFrame();
    assert.equal(submit.data.jobId, requestId, 'the job goes out under the caller id, so a cancel can name it');
    assert.equal(submit.data.input.requestId, undefined, 'and it is not part of what gets generated');

    const dup = await postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i', positive: 'again', requestId });
    assert.equal(dup.json.error.code, 'DUPLICATE_REQUEST_ID');

    // The cancel is relayed; the fake renderer does what agentDispatch does: reports the
    // cancel done, and the cancelled submit reports CANCELLED through its own onCancel.
    const cancelling = postJson(`${base}/connector/cancel`, { requestId });
    const cancel = await renderer.readFrame();
    assert.equal(cancel.data.capability, 'generation.cancel');
    assert.deepEqual(cancel.data.input, { jobId: requestId });
    await postJson(`${base}/connector/jobs/${requestId}/result`, { ok: false, error: { code: 'CANCELLED', message: 'cancelled' } });
    await postJson(`${base}/connector/jobs/${cancel.data.jobId}/result`, { ok: true, output: { cancelled: true, was: 'pending' } });

    assert.deepEqual((await cancelling).json, { ok: true, output: { cancelled: true, was: 'pending' } });
    assert.equal((await pending).json.error.code, 'CANCELLED', 'the held submit resolves, it is not left hanging');

    // Settled: the route answers by itself, nothing is relayed.
    const again = await postJson(`${base}/connector/cancel`, { requestId });
    assert.equal(again.json.error.code, 'NOT_IN_FLIGHT');
    assert.equal((await postJson(`${base}/connector/cancel`, {})).status, 400);
    const badId = await postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i', requestId: 'no' });
    assert.equal(badId.json.error.code, 'INVALID_REQUEST_ID');
  } finally {
    renderer.close();
    await stop();
  }
});

// The renderer half cannot run here (it enqueues into the real generation queue), so its
// wiring is pinned on the source: both enqueue sites remember the queue id, the handler is
// registered, and it goes through the queue's OWN cancel functions — the ones the Cue panel
// calls — never around them, or the lane would not drain and the next job never promote.
test('the renderer cancels a relayed job through the Cue queue\'s own cancel functions', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'shell', 'agentDispatch.js'), 'utf8');
  assert.match(src, /'generation\.cancel': _cancelGeneration,/);
  assert.equal(src.match(/if \(!_settled\.has\(jobId\)\) _queueJobs\.set\(jobId, queued\.queueJobId\);/g)?.length, 2,
    'a model op AND a Flow both record their queue id');
  assert.match(src, /cancelPendingCueJob\(queueJobId\)\.length \? 'pending'\s+: cancelRunningCueJob\(queueJobId\) \? 'running'/);
  assert.match(src, /_settled\.add\(jobId\);\s+_queueJobs\.delete\(jobId\);/, 'dropped the moment the job reports');
});

// MPI-876 — POST /connector/quote, the read the agent's spend gate takes before it fires.
// It is a separate route rather than a flag on the submit for one reason, and this is the
// test of that reason: on a money path the failure has to fall towards spending nothing.

test('quote relays its own capability, carrying the named params and the fan-out count', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    const pending = postJson(`${base}/connector/quote`, {
      modelId: 'krea2',
      operation: 't2i',
      ratio: '16:9',
      qualityTier: '2k',
      count: 6,
    });

    const frame = await renderer.readFrame();
    assert.equal(frame.data.capability, 'generation.quote');
    // The size fields are the price: `priceImageUnits` scales by area, so a quote that
    // dropped the ratio would name the money for a picture nobody asked for.
    assert.deepEqual(frame.data.input, {
      modelId: 'krea2',
      operation: 't2i',
      injectionParams: {},
      ratio: '16:9',
      qualityTier: '2k',
      count: 6,
    });

    await postJson(`${base}/connector/jobs/${frame.data.jobId}/result`, {
      ok: true,
      output: { billed: true, modelName: 'Krea 2', count: 6, usd: 0.4, display: 'about $0.40' },
    });
    const { json } = await pending;
    assert.equal(json.output.display, 'about $0.40');
  } finally {
    renderer.close();
    await stop();
  }
});

test('neither route can be talked into being the other', async () => {
  const { base, stop } = await startServer();
  const renderer = await fakeRenderer(base);
  try {
    // A submit that asks to be a quote is still a submit — `input` is built from a
    // whitelist, so the field is dropped rather than obeyed. The dangerous direction is
    // the other one: a caller that believed it was only pricing something, and generated.
    postJson(`${base}/connector/generate`, { modelId: 'krea2', operation: 't2i', positive: 'x', quoteOnly: true });
    const submit = await renderer.readFrame();
    assert.equal(submit.data.capability, 'generation.submit');
    assert.equal(submit.data.input.quoteOnly, undefined);
    await postJson(`${base}/connector/jobs/${submit.data.jobId}/result`, { ok: true, output: {} });

    // And a quote never dispatches, whatever else the body carries.
    postJson(`${base}/connector/quote`, { modelId: 'krea2', operation: 't2i', positive: 'x', seed: 7 });
    const quote = await renderer.readFrame();
    assert.equal(quote.data.capability, 'generation.quote');
    await postJson(`${base}/connector/jobs/${quote.data.jobId}/result`, { ok: true, output: { billed: false } });

    // A body naming neither a model op nor a Flow is refused before anything is relayed.
    const bad = await postJson(`${base}/connector/quote`, {});
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, 'BAD_REQUEST');
  } finally {
    renderer.close();
    await stop();
  }
});
