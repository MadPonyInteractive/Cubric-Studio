const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-930 + MPI-931 — the local Stop path.
 *   930: a Stop before the job registers used to fire a bare interrupt and settle nothing, so an
 *        agent or MCP client waited out the 30-min JOB_TIMEOUT. Now it is remembered and the job
 *        cancels itself on register: store `cancelled`, onError, and no /prompt.
 *   931: every app instance shares ONE ComfyUI (:48188), and a bare /interrupt kills whatever it
 *        runs. Every Stop now names its own prompt_id, and a Stop with no prompt of ours on the
 *        engine sends no interrupt at all.
 *
 * SAFETY: /interrupt, /prompt and /queue are answered by a window.fetch stub and never reach a
 * real engine - an isolated app shares Fabio's, and a real interrupt here would kill his render.
 */
test.setTimeout(90000);

async function stubEngineFetch(window) {
  await window.evaluate(() => {
    window.__engineCalls = [];
    const orig = window.fetch.bind(window);
    window.fetch = (...args) => {
      const url = String(args[0] || '');
      // POSTs only: a background reconcile may GET /queue, which changes nothing.
      if (/\/(interrupt|prompt|queue)(\?|$)/.test(url) && args[1]?.method === 'POST') {
        const body = args[1]?.body ? JSON.parse(args[1].body) : null;
        window.__engineCalls.push({ path: url.replace(/^.*\/(interrupt|prompt|queue).*$/, '$1'), body });
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(...args);
    };
  });
}
const engineCalls = (window) => window.evaluate(() => window.__engineCalls);

test('MPI-930: a Stop before register ends the job cancelled, fires onError, and never reaches the engine', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await stubEngineFetch(window);
    const out = await window.evaluate(async () => {
      const { runCommand } = await import('/js/services/commandExecutor.js');
      const { generationStore } = await import('/js/services/generationStore.js');
      const exec = runCommand({ operation: 't2i', modelId: 'mpi930-none', forceLocal: true, positive: 'x' });
      const err = new Promise((resolve) => { exec.onError = (e) => resolve(e?.message); });
      exec.cancel(); // synchronously: before the async head has registered the job
      const message = await Promise.race([err, new Promise(r => setTimeout(() => r('TIMEOUT'), 15000))]);
      return { message, phase: generationStore.byId(exec.jobId)?.phase };
    });
    expect(out.message).toBe('cancelled_before_dispatch');
    expect(out.phase).toBe('cancelled');
    expect(await engineCalls(window)).toEqual([]); // no /prompt, and no bare /interrupt
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('MPI-930: deleting a still-PENDING prompt ends its wait like a Stop; a running one is left to its interrupt', async ({}, testInfo) => {
  // Found live 2026-09-26: a Stop while queued behind another instance's render deleted our
  // prompt, which then never sent a terminal - the held /connector/generate hung.
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    const got = await window.evaluate(async () => {
      const { getEngine } = await import('/js/services/comfyController.js');
      const eng = getEngine(false);
      const orig = window.fetch.bind(window);
      window.fetch = (...args) => {
        const url = String(args[0] || '');
        if (/\/queue$/.test(url)) {
          const body = args[1]?.method === 'POST' ? '{}'
            : JSON.stringify({ queue_running: [[0, 'P-run']], queue_pending: [[1, 'P-wait']] });
          return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return orig(...args);
      };
      const heard = {};
      for (const id of ['P-wait', 'P-run']) eng._promptListeners.set(id, (msg) => { heard[id] = msg.type; });
      try {
        await eng.deleteQueueItem('P-wait');
        await eng.deleteQueueItem('P-run');
      } finally {
        eng._promptListeners.delete('P-wait');
        eng._promptListeners.delete('P-run');
        window.fetch = orig;
      }
      return heard;
    });
    expect(got).toEqual({ 'P-wait': 'execution_interrupted' });
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('MPI-931: a Stop interrupts only its own prompt, including one Stopped before the ack', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await stubEngineFetch(window);
    const run = (cancelBeforeAck) => window.evaluate(async (early) => {
      const { runAutoMask } = await import('/js/services/commandExecutor.js');
      const { getEngine } = await import('/js/services/comfyController.js');
      const eng = getEngine(false);
      const realRun = eng.runWorkflow;
      let ack;
      const acked = new Promise((r) => { ack = r; });
      let finish;
      // The engine accepts the prompt when told to, then runs until finish().
      eng.runWorkflow = (_wf, _params, onMessage) => {
        ack(() => onMessage({ type: 'prompt_ack', prompt_id: early ? 'P-early' : 'P-own' }));
        return new Promise((r) => { finish = r; });
      };
      try {
        window.__engineCalls = [];
        const exec = runAutoMask({ imageUrl: '/assets/mascot/idle.png', detectorModel: 'x' });
        const sendAck = await acked;
        if (early) { exec.cancel(); sendAck(); } else { sendAck(); exec.cancel(); }
        await new Promise(r => setTimeout(r, 200));
        finish();
        return window.__engineCalls;
      } finally {
        eng.runWorkflow = realRun;
      }
    }, cancelBeforeAck);

    const after = await run(false);
    expect(after).toEqual([{ path: 'interrupt', body: expect.objectContaining({ prompt_id: 'P-own' }) }]);
    const before = await run(true);
    expect(before).toEqual([{ path: 'interrupt', body: expect.objectContaining({ prompt_id: 'P-early' }) }]);
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
