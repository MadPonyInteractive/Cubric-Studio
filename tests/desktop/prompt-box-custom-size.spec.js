// @ts-check
// MPI-1181: FLUX.3's edit size picker sits behind a Custom size button, off by default.
// MPI-1207: the same button on every edit-family model, checked model by model.
// Off = ratio + tier hidden AND not injected, Input_custom_size false; on = both shown,
// Width/Height injected, Input_custom_size true. Off again parks them back.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('Custom size: off hides and drops the size picker, on restores it', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
  try {
    const runs = await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const [{ Events }, { MpiPromptBox }, { getModelById }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
        import('/js/data/modelRegistry.js'),
      ]);
      Events.emit('engine:install-skipped');
      await new Promise(res => setTimeout(res, 300));
      Events.emit('ui:close-all-popups');

      const runs = {};
      for (const [id, op] of [['flux3-klein', 'edit'], ['klein-4b', 'kleinEdit'], ['krea2', 'krea2Edit'],
        ['qwen-image-2-1', 'edit'], ['boogu-edit-high', 'edit'], ['qwen-edit', 'qwenEdit']]) {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const model = getModelById(id);
        const box = MpiPromptBox.mount(host, { model, modelList: [model], operation: op });

        // The settings popup mounts outside the host: the newest one is this box's.
        const btn = () => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Custom size').pop();
        const tierHidden = () => {
          // The settings popup is closed here, so visibility is the parked wrapper's class.
          const g = btn()?.closest('div[style*="contents"]')?.parentElement?.querySelector('.hide');
          return !!g;
        };
        const snap = () => {
          const p = box.el.getRunPayload().injectionParams;
          return { custom: p.Input_custom_size, hasWidth: 'Width' in p, tierHidden: tierHidden(), active: btn()?.classList.contains('is-active'), disabled: !!btn()?.disabled };
        };
        const out = { exists: !!btn() };
        out.off = snap();
        btn().click();
        out.on = snap();
        // A drawn mask keeps the source frame: greyed out, false, picker parked (MPI-1207).
        box.el.updateContext({ hasMask: true });
        out.masked = snap();
        box.el.updateContext({ hasMask: false });
        out.unmasked = snap();
        btn().click();
        out.offAgain = snap();
        runs[id] = out;
        box.destroy?.();
        host.remove();
      }
      return runs;
    });

    for (const [id, r] of Object.entries(runs)) {
      expect(r.exists, id).toBe(true);
      expect(r.off, id).toEqual({ custom: false, hasWidth: false, tierHidden: true, active: false, disabled: false });
      expect(r.on, id).toEqual({ custom: true, hasWidth: true, tierHidden: false, active: true, disabled: false });
      expect(r.masked, id).toEqual({ custom: false, hasWidth: false, tierHidden: true, active: true, disabled: true });
      expect(r.unmasked, id).toEqual(r.on);
      expect(r.offAgain, id).toEqual({ custom: false, hasWidth: false, tierHidden: true, active: false, disabled: false });
    }
  } finally {
    await closeApp(app);
  }
});
