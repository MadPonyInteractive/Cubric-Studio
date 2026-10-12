// MPI-1110 — Cleanup assets shows itself: a Transfers row (and the right-edge flash) from the
// confirm until the server answers, then the "Cleanup complete" toast.
//
// Projects live in a scratch Documents dir (APP_DOCUMENTS), never the user's. The cleanup
// route is stubbed as well, so the test holds the job open while it looks at the row.
const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

test('Cleanup assets is a Transfers row while it runs', async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data');
  const documentsDir = testInfo.outputPath('documents');
  for (const d of [userDataDir, documentsDir]) fs.mkdirSync(d, { recursive: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.CUBRIC_E2E = '1';
  env.CUBRIC_E2E_USER_DATA = userDataDir;
  env.APP_DOCUMENTS = documentsDir;

  const app = await electron.launch({ args: ['.'], env });
  try {
    const window = await shellWindow(app);
    await window.getByRole('button', { name: /continue/i }).click();
    await window.getByRole('button', { name: /^done$/i }).click({ timeout: 8000 }).catch(() => {});

    await window.evaluate(() => {
      const real = window.fetch.bind(window);
      window.__cleanupCalls = 0;
      window.fetch = (url, opts) => {
        if (String(url).includes('/project/cleanup-assets')) {
          window.__cleanupCalls += 1;
          return new Promise((resolve) => {
            window.__finishCleanup = () => resolve(new Response(JSON.stringify({ success: true, removed: 3 })));
          });
        }
        return real(url, opts);
      };
    });

    await window.evaluate(async () => {
      await (await import('/js/services/projectService.js')).createProject('Cleanup Probe');
      await (await import('/js/shell/projectUI.js')).loadProjectGrid();
    });
    const row = window.locator('.mpi-landing__pl-row:not(.mpi-landing__pl-row--loading)', { hasText: 'Cleanup Probe' }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click({ button: 'right' });
    await window.getByText('Cleanup assets…').click();
    await window.getByRole('button', { name: /^cleanup$/i }).click();

    await expect.poll(() => window.evaluate(() => window.__cleanupCalls)).toBe(1);
    const jobs = () => window.evaluate(() => import('/js/state.js').then(({ state }) => state.cpuJobs.map(j => j.label)));
    expect(await jobs()).toEqual(['Cleaning up Cleanup Probe']);
    await expect(window.locator('.mpi-queue-flash')).toBeVisible();

    await window.evaluate(() => window.__finishCleanup());
    await expect.poll(jobs).toEqual([]);
    await expect(window.getByText('Removed 3 cached assets.')).toBeVisible();
  } finally {
    await app.close();
  }
});
