const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-1041 — an OPTIONAL model slot on the run slide. The Character Sheet Editor runs on Klein 9B
 * and needs Qwen-Image 2.1 only for Body shape and ages 12 and under, so the Flow is available
 * without Qwen. Until Qwen is on disk its slot is a row offering it: the model's name and an
 * Install button (the one install path, `downloadService.start`, so the licence gate fires);
 * while its download runs the button reads Installing; once installed the row becomes the
 * ordinary slot, with the LoRA cogwheel both slots opt into.
 *
 * `s_installedModelIds` and `downloadJobs` are stubbed, as flow-lora-button.spec.js stubs them,
 * rather than downloading 20 GB. Driven in page for the same reason that spec gives: the
 * frame is a `main-area` overlay that measures zero on the landing page.
 */
test.setTimeout(90000);

test('an optional model offers Install until it is on disk, then becomes its slot', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    await window.evaluate(async () => {
      const { MpiBaseFlow } = await import('/js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js');
      const { getFlowById } = await import('/js/data/flowsRegistry.js');
      const { state } = await import('/js/state.js');
      state.s_installedModelIds = ['klein-9b'];
      state.downloadJobs = [];
      state.currentProject = { name: 'e2e', path: 'e2e', itemGroups: [] };
      // Straight to the run slide: step 0 refuses to advance without the required sheet.
      const flow = MpiBaseFlow.mount(document.createElement('div'),
        { flow: getFlowById('character-sheet-editor'), openAt: 'run' });
      window.__mpi1041 = flow;
      flow.el.open();
    });

    const slots = window.locator('.mpi-base-flow__model-slot');
    await expect(slots).toHaveCount(2);
    // Two slots, so each carries its label (the disambiguator).
    await expect(slots.nth(1).locator('.mpi-base-flow__field-label')).toHaveText('Body shape and child ages');
    await expect(slots.nth(1).locator('.mpi-base-flow__model-name')).toHaveText('Qwen-Image 2.1');
    const install = slots.nth(1).locator('.mpi-base-flow__model-install button');
    await expect(install).toHaveText(/Install/);
    await expect(install).toBeEnabled();
    // Klein is installed: its slot keeps its cogwheel; Qwen's has none until it is installed.
    await expect(window.locator('.mpi-base-flow__model-cog')).toHaveCount(1);

    // A download starting repaints the row (the event the frame listens for).
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const { Events } = await import('/js/events.js');
      state.downloadJobs = [{ modelId: 'qwen-image-2-1', progress: 0.1 }];
      Events.emit('download:started', { modelId: 'qwen-image-2-1' });
    });
    await expect(install).toHaveText(/Installing/);
    await expect(install).toBeDisabled();

    // Installed: the Install row is gone and both slots carry a cogwheel.
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.downloadJobs = [];
      state.s_installedModelIds = ['klein-9b', 'qwen-image-2-1'];
    });
    await expect(window.locator('.mpi-base-flow__model-install')).toHaveCount(0);
    await expect(window.locator('.mpi-base-flow__model-cog')).toHaveCount(2);
    await expect(window.locator('.mpi-base-flow__model-cog').nth(1))
      .toHaveAttribute('aria-label', 'LoRAs for Qwen-Image 2.1');

    await window.evaluate(() => window.__mpi1041?.el?.destroy?.());
  } finally {
    await closeApp(app);
  }
});
