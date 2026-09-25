const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-908 — the "Update available" dialog heads with Studio's `update-ready` clip instead of
 * an icon (MpiOkCancel `mascot` prop), played ONCE and held on its last frame, the rest pose
 * (Fabio 2026-09-25). The prompt is the real one, reached through updateChecker's dev force flag.
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

test('update dialog: Studio update-ready plays once when the dialog shows, then holds', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.waitForTimeout(6000); // shell boot settles
    await clearBootModals(window);

    await window.evaluate(async () => {
      localStorage.setItem('mpi_dev_force_update', '99.0.0');
      const { checkForUpdate } = await import('/js/services/updateChecker.js');
      await checkForUpdate();
    });

    const clip = window.locator('.mpi-ok-cancel__mascot');
    const state = () => window.evaluate(() => {
      const v = document.querySelector('.mpi-ok-cancel__mascot');
      return v && { t: v.currentTime, paused: v.paused, ended: v.ended, loop: v.loop };
    });

    await expect(window.locator('.mpi-ok-cancel__title', { hasText: 'Update available' })).toBeVisible();
    await expect(clip).toHaveAttribute('src', 'assets/mascot/studio/update-ready.webm');
    expect((await state()).loop).toBe(false);
    // Plays...
    await expect.poll(async () => (await state()).t, { timeout: 3000 }).toBeGreaterThan(0.2);
    // ...and ends (3s clip) on its last frame instead of looping.
    await expect.poll(async () => (await state()).ended, { timeout: 6000 }).toBe(true);
    expect((await state()).paused).toBe(true);
    // The figure crop gives the 96px-tall clip a narrower-than-square box.
    const box = await clip.boundingBox();
    expect(Math.round(box.height)).toBe(96);
    expect(box.width).toBeLessThan(96);

    expect(pageErrors).toEqual([]);
  } finally {
    await window.evaluate(() => localStorage.removeItem('mpi_dev_force_update')).catch(() => {});
    await closeApp(app);
  }
});
