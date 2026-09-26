// @ts-check
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-909 — the selected model's mascot peeks over the prompt box. A mount only loads the
 * clip (walking Gallery <-> History must not replay it); a model SELECTION plays it once,
 * with the mascot of that model's medium, and it hides again when the clip ends.
 */
test('prompt box: a model selection plays its mascot peek once; a mount does not', async ({}, testInfo) => {
  test.setTimeout(120000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.waitForTimeout(6000); // shell boot settles
    const name = `mpi909-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await window.evaluate(async ({ name, folderPath }) => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      Events.emit('ui:close-all-popups');
      const { createProject, openProject } = await import('/js/services/projectService.js');
      const { navigate, PAGE_GALLERY } = await import('/js/router.js');
      await openProject(await createProject(name, folderPath));
      navigate(PAGE_GALLERY);
    }, { name, folderPath: testInfo.outputPath('projects') });
    await window.waitForSelector('.mpi-prompt-box__peek-clip', { timeout: 30000 });

    const peek = () => window.evaluate(() => {
      const w = document.querySelector('.mpi-prompt-box__peek');
      const v = w?.querySelector('video');
      return { live: !!w?.classList.contains('mpi-prompt-box__peek--live'), src: v?.getAttribute('src'),
        paused: v?.paused, x: w?.style.getPropertyValue('--peek-x') };
    });

    const mounted = await peek();
    expect(mounted.src).toMatch(/assets\/mascot\/vision\/peek\.webm$/);
    expect(mounted.live).toBe(false);

    await window.evaluate(async () => {
      const { getModelById } = await import('/js/data/modelRegistry.js');
      document.querySelector('.mpi-prompt-box').setModel(getModelById('wan-22'));
    });
    const picked = await peek();
    expect(picked.src).toMatch(/assets\/mascot\/video\/peek\.webm$/);
    expect(picked.live).toBe(true);
    expect(parseFloat(picked.x)).toBeGreaterThanOrEqual(28);
    expect(parseFloat(picked.x)).toBeLessThanOrEqual(72);

    await window.waitForTimeout(1200); // mid-peek: the head is up
    const box = await window.locator('.mpi-prompt-box').boundingBox();
    // preserveOutput is failures-only; PEEK_SHOT=<file> keeps the framing shot of a green run.
    if (box) await window.screenshot({ path: process.env.PEEK_SHOT || testInfo.outputPath('peek-mid.png'),
      clip: { x: box.x, y: Math.max(0, box.y - 160), width: box.width, height: box.height + 160 } });

    await expect.poll(async () => (await peek()).live, { timeout: 6000 }).toBe(false);
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
