// @ts-check
// MPI-1181: FLUX.3's edit size picker sits behind a Custom size button, off by default.
// Off = ratio + tier hidden AND not injected, Input_custom_size false; on = both shown,
// Width/Height injected, Input_custom_size true. Off again parks them back.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('Custom size: off hides and drops the size picker, on restores it', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
  try {
    const r = await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const [{ Events }, { MpiPromptBox }, { getModelById }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
        import('/js/data/modelRegistry.js'),
      ]);
      Events.emit('engine:install-skipped');
      await new Promise(res => setTimeout(res, 300));
      Events.emit('ui:close-all-popups');

      const host = document.createElement('div');
      document.body.appendChild(host);
      const flux3 = getModelById('flux3-klein');
      const box = MpiPromptBox.mount(host, { model: flux3, modelList: [flux3], operation: 'edit' });

      const btn = () => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Custom size');
      const tierHidden = () => {
        // The settings popup is closed here, so visibility is the parked wrapper's class.
        const g = btn()?.closest('div[style*="contents"]')?.parentElement?.querySelector('.hide');
        return !!g;
      };
      const snap = () => {
        const p = box.el.getRunPayload().injectionParams;
        return { custom: p.Input_custom_size, hasWidth: 'Width' in p, tierHidden: tierHidden(), active: btn()?.classList.contains('is-active') };
      };
      const out = { exists: !!btn() };
      out.off = snap();
      btn().click();
      out.on = snap();
      btn().click();
      out.offAgain = snap();
      return out;
    });

    expect(r.exists).toBe(true);
    expect(r.off).toEqual({ custom: false, hasWidth: false, tierHidden: true, active: false });
    expect(r.on).toEqual({ custom: true, hasWidth: true, tierHidden: false, active: true });
    expect(r.offAgain).toEqual({ custom: false, hasWidth: false, tierHidden: true, active: false });
  } finally {
    await closeApp(app);
  }
});
