// MPI-784: clicking a toast dismisses it at once.
//
// Before this, a toast had no click handler at all — clicking one did nothing and it
// sat there until its reading-time window ran out (or forever, for duration 0).
// The click goes through the toast's own dismiss(), so the checks below also pin
// that a clicked toast frees its slot for the queue.
//
// Real mouse clicks through Playwright, not el.click(): the stack is
// pointer-events:none and the mascot overhangs the toast, so hit-testing is part of
// what is being proven.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('clicking a toast dismisses it immediately and promotes the queued one', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, consoleErrors, pageErrors } = await launchApp(testInfo);

  try {
    await window.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const [{ Events }, { MpiToast }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Primitives/MpiToast/MpiToast.js'),
      ]);
      Events.emit('engine:install-skipped');
      await sleep(300);

      window.__toastCloses = [];
      // 'two' is persistent (duration 0) — a click is the only way it ever leaves.
      for (const [name, duration] of [['one', 60000], ['two', 0], ['three', 60000]]) {
        const wrap = document.createElement('div');
        document.body.appendChild(wrap);
        const t = MpiToast.mount(wrap, { message: `clickme ${name}`, duration, sound: false });
        t.on('close', () => { window.__toastCloses.push(name); wrap.remove(); });
      }
    });

    const toast = (name) => window.locator('.mpi-toast-stack .mpi-toast', { hasText: `clickme ${name}` });
    const visibleNames = () => window.$$eval('.mpi-toast-stack .mpi-toast:not(.mpi-toast--queued)',
      els => els.map(el => (el.textContent.match(/clickme (\w+)/) || [])[1]).filter(Boolean));

    await expect(toast('one')).toHaveClass(/mpi-toast--open/);
    await expect(toast('three')).toHaveClass(/mpi-toast--queued/);
    expect(await visibleNames()).toEqual(['one', 'two']);

    // A 60s toast must be gone well inside a second of the click (close fade is ~280ms).
    await toast('one').click();
    await expect(toast('one'), 'REGRESSION: clicking a toast did not dismiss it').toHaveCount(0, { timeout: 1000 });
    await expect(toast('three'), 'a clicked toast did not free its slot for the queue')
      .not.toHaveClass(/mpi-toast--queued/);
    expect(await visibleNames()).toEqual(['two', 'three']);

    await toast('two').click();
    await expect(toast('two'), 'a persistent toast ignored the click').toHaveCount(0, { timeout: 1000 });

    await toast('three').click();
    await expect(toast('three')).toHaveCount(0, { timeout: 1000 });

    expect(await window.evaluate(() => window.__toastCloses)).toEqual(['one', 'two', 'three']);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
