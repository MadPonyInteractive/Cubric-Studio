// MPI-1230: shellWindow must not hand a spec a window with a `resize` still to come.
//
// shellWindow pins the UI zoom to 1 (a fresh profile boots at 0.9, MPI-995), and a zoom
// change fires `resize`, which closes every open MpiDropdown. Chromium dispatches it on the
// next frame, but main.js keeps the window HIDDEN until the landing has content (MPI-966),
// and a hidden window draws about one frame a second. So the resize landed up to a second
// into the spec and shut a dropdown it had just opened: llm-settings-remote.spec.js failed
// at a different step on each of three attempts (CI 39601605307, "resolved to 0
// elements"). A CI runner's software decoder takes seconds over the mascot clips the
// reveal waits on; a dev box takes well under one, so the late reveal is PROVOKED here by
// holding main's `shell:landing-ready` listener for 3s.

const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

test('shellWindow leaves no late resize to close a dropdown the spec opens', async ({}, testInfo) => {
  test.setTimeout(60000);
  const userDataDir = testInfo.outputPath('user-data');
  const documentsDir = testInfo.outputPath('documents');
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(documentsDir, { recursive: true });
  const env = { ...process.env, CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userDataDir, APP_DOCUMENTS: documentsDir };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({ args: ['.'], env });
  try {
    // The main window does not exist yet when launch() returns (main waits for Express),
    // and createWindow() registers its listener synchronously after `new BrowserWindow`,
    // so it is there one tick after creation.
    await app.evaluate(({ app: electronApp }) => {
      globalThis.__heldLandingReady = 0;
      electronApp.on('browser-window-created', (_e, win) => setImmediate(() => {
        const ipc = win.webContents.ipc;
        const listeners = ipc.listeners('shell:landing-ready');
        if (!listeners.length) return;
        globalThis.__heldLandingReady += listeners.length;
        ipc.removeAllListeners('shell:landing-ready');
        ipc.once('shell:landing-ready', (...args) => setTimeout(() => listeners.forEach(l => l(...args)), 3000));
      }));
    });

    const window = await shellWindow(app);
    await window.evaluate(() => { window.__resizes = 0; window.addEventListener('resize', () => { window.__resizes++; }); });
    // Without the hold this spec proves nothing on a fast machine.
    expect(await app.evaluate(() => globalThis.__heldLandingReady), 'the reveal was not held').toBe(1);

    await window.evaluate(async () => {
      const [{ Events }, { MpiRemote }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Blocks/MpiRemote/MpiRemote.js'),
      ]);
      Events.emit('slide-over:open', { title: 'Remote', component: MpiRemote });
    });
    const trigger = '#mpiSettingsConnProfileSlot .mpi-dropdown__trigger';
    await expect(window.locator(trigger)).toHaveCount(1);
    await window.evaluate((sel) => document.querySelector(sel).click(), trigger);
    await expect(window.locator('.mpi-dropdown__list.is-open')).toHaveCount(1);
    // Longer than one hidden-window frame, and the list must still be there after it.
    await window.waitForTimeout(1500);
    expect(await window.locator('.mpi-dropdown__list.is-open').count(), 'the open dropdown closed under the spec').toBe(1);
    expect(await window.evaluate(() => window.__resizes), 'a resize landed after shellWindow returned').toBe(0);
  } finally {
    await app.close().catch(() => {});
  }
});
