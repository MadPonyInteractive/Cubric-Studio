// MPI-1167 — the Landing star: a starred project lists first, the click does not open it,
// the star survives a grid rebuild, and unstarring drops it back to its last-opened place.
//
// Projects live in a scratch Documents dir (APP_DOCUMENTS), never the user's.
const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

test('a starred project lists first and unstarring restores the recent order', async ({}, testInfo) => {
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

    // Oldest first, so the recent order is Star C, Star B, Star A.
    await window.evaluate(async () => {
      const { createProject } = await import('/js/services/projectService.js');
      for (const name of ['Star A', 'Star B', 'Star C']) {
        await createProject(name);
        await new Promise(r => setTimeout(r, 20));
      }
      await (await import('/js/shell/projectUI.js')).loadProjectGrid();
    });
    const order = () => window.evaluate(() => [...document.querySelectorAll('.mpi-landing__pl-row h4')]
      .map(h => h.textContent).filter(n => n.startsWith('Star ')));
    await expect.poll(order, { timeout: 15000 }).toEqual(['Star C', 'Star B', 'Star A']);

    const rowA = window.locator('.mpi-landing__pl-row', { hasText: 'Star A' });
    await rowA.hover();
    await rowA.locator('.mpi-landing__pl-star button').click();

    await expect.poll(order).toEqual(['Star A', 'Star C', 'Star B']);
    await expect(window.locator('#page-landing')).toBeVisible();
    expect(await window.evaluate(() => import('/js/state.js').then(({ state }) => !!state.currentProject))).toBe(false);
    if (process.env.STAR_SHOT) await window.screenshot({ path: process.env.STAR_SHOT });

    // Persisted: a rebuilt grid reads it back from the registry.
    await window.evaluate(async () => (await import('/js/shell/projectUI.js')).loadProjectGrid());
    await expect.poll(order).toEqual(['Star A', 'Star C', 'Star B']);
    await expect(rowA.locator('.mpi-landing__pl-star button')).toHaveClass(/is-active/);

    await rowA.hover();
    await rowA.locator('.mpi-landing__pl-star button').click();
    await expect.poll(order).toEqual(['Star C', 'Star B', 'Star A']);
    await window.evaluate(async () => (await import('/js/shell/projectUI.js')).loadProjectGrid());
    await expect.poll(order).toEqual(['Star C', 'Star B', 'Star A']);
  } finally {
    await app.close();
  }
});
