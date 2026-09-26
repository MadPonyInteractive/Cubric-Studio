// @ts-check
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-909 — the selected model's mascot peeks over the prompt box. A mount only loads the
 * clip (walking Gallery <-> History must not replay it); a model SELECTION plays it once,
 * with the mascot of that model's medium, and it hides again when the clip ends.
 *
 * The box is mounted on its own with explicit models, not reached through the gallery:
 * the CI runner has no models installed, so the gallery shows "No models installed" and
 * never mounts a prompt box (red master on 474a09f6).
 */
test('prompt box: a model selection plays its mascot peek once; a mount does not', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const [{ Events }, { MpiPromptBox }, { getModelById }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
        import('/js/data/modelRegistry.js'),
      ]);
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
      Events.emit('ui:close-all-popups');
      const host = document.createElement('div');
      host.id = 'pb-peek';
      host.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999';
      document.body.appendChild(host);
      const sdxl = getModelById('sdxl-realistic');
      window.__peekBox = MpiPromptBox.mount(host, { model: sdxl, modelList: [sdxl, getModelById('wan-22')], operation: 't2i' });
    });

    const peek = () => window.evaluate(() => {
      const w = document.querySelector('#pb-peek .mpi-prompt-box__peek');
      const v = w?.querySelector('video');
      return { live: !!w?.classList.contains('mpi-prompt-box__peek--live'), src: v?.getAttribute('src'),
        x: w?.style.getPropertyValue('--peek-x') };
    });

    const mounted = await peek();
    expect(mounted.src).toMatch(/assets\/mascot\/vision\/peek\.webm$/);
    expect(mounted.live).toBe(false);

    await window.evaluate(async () => {
      const { getModelById } = await import('/js/data/modelRegistry.js');
      window.__peekBox.el.setModel(getModelById('wan-22'));
    });
    const picked = await peek();
    expect(picked.src).toMatch(/assets\/mascot\/video\/peek\.webm$/);
    expect(picked.live).toBe(true);
    expect(parseFloat(picked.x)).toBeGreaterThanOrEqual(28);
    expect(parseFloat(picked.x)).toBeLessThanOrEqual(72);

    await expect.poll(async () => (await peek()).live, { timeout: 8000 }).toBe(false);
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
