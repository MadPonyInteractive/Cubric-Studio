const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-1355 — 2.1.4 is the last free release. Its update prompt only points to the paid
 * version on Gumroad (founder code applied while any are left) and nothing downloads; its
 * error dialog has no support buttons, says the version is no longer supported, and
 * "Get the latest version" opens the same Gumroad page.
 *
 * open-external is swapped in main for a recorder, so no browser opens during the run.
 */
test.setTimeout(90000);

async function clearBootModals(window) {
  const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
  const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
  if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 8 && await backdrops() > 0; i++) {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(400);
  }
  expect(await backdrops()).toBe(0);
}

async function recordOpenExternal(app) {
  await app.evaluate(({ ipcMain }) => {
    globalThis.__opened = [];
    ipcMain.removeHandler('open-external');
    ipcMain.handle('open-external', (_e, url) => { globalThis.__opened.push(url); });
  });
  return () => app.evaluate(() => globalThis.__opened);
}

test('2.1.4: the update prompt opens Gumroad with the founder code, the error dialog has no support path', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.waitForTimeout(6000); // shell boot settles
    await clearBootModals(window);
    const opened = await recordOpenExternal(app);

    await window.evaluate(async () => {
      localStorage.setItem('mpi_dev_force_update', '2.2.0');
      const { checkForUpdate } = await import('/js/services/updateChecker.js');
      await checkForUpdate();
    });

    const dialog = window.locator('.mpi-ok-cancel');
    await expect(window.locator('.mpi-ok-cancel__title', { hasText: 'Cubric Studio v2.2.0 is out' })).toBeVisible();
    await expect(dialog).toContainText('There are no more updates for this version');
    await expect(dialog).toContainText('FOUNDER100');
    await expect(dialog).toContainText('63 left');
    await window.waitForTimeout(3500); // mascot clip ends on its rest pose
    await window.screenshot({ path: testInfo.outputPath('update-prompt.png') });

    await dialog.locator('button:has-text("Open Gumroad")').click();
    await expect.poll(opened).toEqual(['https://mad-pony-interactive.gumroad.com/l/ubqygr/FOUNDER100']);

    await window.evaluate(async () => {
      const { showError } = await import('/js/shell.js');
      showError('Generation failed', 'The remote GPU stopped answering.');
    });
    const err = window.locator('.mpi-error-dialog');
    await expect(err).toBeVisible();
    await expect(err).toContainText('Sorry, this version is no longer supported. To get the latest version, visit Gumroad.');
    await expect(err.locator('button:has-text("Report on GitHub")')).toHaveCount(0);
    await expect(err.locator('button:has-text("Show log file")')).toHaveCount(0);
    await expect(err.locator('button:has-text("Dismiss")')).toBeVisible();
    await window.screenshot({ path: testInfo.outputPath('error-dialog.png') });

    await err.locator('button:has-text("Get the latest version")').click();
    await expect.poll(opened).toEqual([
      'https://mad-pony-interactive.gumroad.com/l/ubqygr/FOUNDER100',
      'https://mad-pony-interactive.gumroad.com/l/ubqygr',
    ]);

    expect(pageErrors).toEqual([]);
  } finally {
    await window.evaluate(() => localStorage.removeItem('mpi_dev_force_update')).catch(() => {});
    await closeApp(app);
  }
});
