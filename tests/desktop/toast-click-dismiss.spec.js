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

    // MPI-788: a click before the open fade has painted a frame. Opacity is still 0, so
    // the close asks for no change, no transition runs, and a toast waiting on
    // `transitionend` stayed invisible in the stack forever. The real click above hit this
    // only when boot kept the renderer busy (3 of 4 local runs); a click in the same task
    // as the mount hits it every time.
    expect(await window.evaluate(async () => {
      const { MpiToast } = await import('/js/components/Primitives/MpiToast/MpiToast.js');
      const wrap = document.createElement('div');
      document.body.appendChild(wrap);
      const t = MpiToast.mount(wrap, { message: 'clickme early', duration: 60000, sound: false });
      const closed = new Promise(r => t.on('close', () => { wrap.remove(); r('closed'); }));
      t.el.click();
      return Promise.race([closed, new Promise(r => setTimeout(() => r('stuck'), 1000))]);
    }), 'REGRESSION: a toast clicked before its open fade never left').toBe('closed');
    await expect(toast('early')).toHaveCount(0);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// MPI-993: a toast can carry ONE action button. Pressing it runs the action and closes the
// toast; a click anywhere else on the toast still only dismisses it (MPI-784 above).
test('a toast action button runs once and closes the toast; the rest of the toast only dismisses', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, consoleErrors, pageErrors } = await launchApp(testInfo);

  try {
    await window.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const [{ Events }, { StatusBar }] = await Promise.all([
        import('/js/events.js'),
        import('/js/shell/statusBar.js'),
      ]);
      Events.emit('engine:install-skipped');
      await sleep(300);
      window.__actions = [];
      // Through StatusBar.notify, the path every caller takes.
      StatusBar.notify('actionme pressed', 'warning', 60000, { sound: false, action: { text: 'Go there', onClick: () => window.__actions.push('pressed') } });
      StatusBar.notify('actionme body', 'info', 60000, { sound: false, action: { text: 'Go there', onClick: () => window.__actions.push('body') } });
    });

    const toast = (name) => window.locator('.mpi-toast-stack .mpi-toast', { hasText: `actionme ${name}` });
    await expect(toast('pressed')).toHaveClass(/mpi-toast--open/);
    await expect(toast('body')).toHaveClass(/mpi-toast--open/);

    await toast('pressed').locator('.mpi-toast__action').click();
    await expect(toast('pressed'), 'pressing the action left the toast up').toHaveCount(0, { timeout: 1000 });

    // The message, not the button: dismisses, never navigates.
    await toast('body').locator('.mpi-toast__msg').click();
    await expect(toast('body')).toHaveCount(0, { timeout: 1000 });
    expect(await window.evaluate(() => window.__actions), 'the action ran twice, or on a click that missed it').toEqual(['pressed']);

    // A throwing action must not strand the toast on screen.
    await window.evaluate(async () => {
      const { StatusBar } = await import('/js/shell/statusBar.js');
      StatusBar.notify('actionme throws', 'info', 60000, { sound: false, action: { text: 'Boom', onClick: () => { throw new Error('boom'); } } });
    });
    await toast('throws').locator('.mpi-toast__action').click();
    await expect(toast('throws'), 'a throwing action stranded the toast').toHaveCount(0, { timeout: 1000 });

    // The throw surfaces as a page error, and it is the only one.
    expect(pageErrors).toHaveLength(1);
    expect(pageErrors[0]).toContain('boom');
    // clientLogger reports the same uncaught throw to the console; nothing else may appear.
    expect(consoleErrors.filter(e => !e.includes('boom'))).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
