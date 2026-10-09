// @ts-check
// MPI-1038: the upscale op's Use Tiles toggle. Grid and Tiles turn each other off, 1x
// (detail only) exists only while Tiles is on, and the Upscale label counts the tiles.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('Use Tiles: exclusive with Use Grid, unlocks 1x, counts its tiles', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
  try {
    const r = await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const [{ Events }, { MpiPromptBox }, { getModelById }, { PROMPT_BOX_CONTROLS }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
        import('/js/data/modelRegistry.js'),
        import('/js/components/Organisms/MpiPromptBox/PromptBoxControls.js'),
      ]);
      Events.emit('engine:install-skipped');
      await new Promise(res => setTimeout(res, 300));
      Events.emit('ui:close-all-popups');

      const host = document.createElement('div');
      document.body.appendChild(host);
      const krea2 = getModelById('krea2');
      MpiPromptBox.mount(host, { model: krea2, modelList: [krea2], operation: 'upscale' });

      const btn = (label) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
      const factors = () => [...document.querySelectorAll('.mpi-radio-group[aria-label="upscaleFactor"] .mpi-radio-group__btn')]
        .map(b => b.dataset.value).filter(v => ['1', '1.5', '2', '3', '4'].includes(v));
      const label = () => [...document.querySelectorAll('.mpi-prompt-box__slider-name')].map(e => e.textContent).find(t => t.startsWith('Upscale'));
      const out = {};
      out.offFactors = factors();
      btn('Use Tiles').click();
      out.onFactors = factors();
      out.tilesActive = btn('Use Tiles').classList.contains('is-active');

      const up = PROMPT_BOX_CONTROLS.upscaleFactor;
      up._size = { width: 1920, height: 1080 };
      up._renderLabel();
      out.labelAt15 = label();
      document.querySelector('.mpi-radio-group[aria-label="upscaleFactor"] .mpi-radio-group__btn[data-value="1"]').click();
      out.labelAt1 = label();
      out.injectAt1 = { ...PROMPT_BOX_CONTROLS.useTiles.getInjectionParams(), ...up.getInjectionParams() };

      btn('Use Grid').click();
      out.afterGrid = {
        tilesActive: btn('Use Tiles').classList.contains('is-active'),
        gridActive: btn('Use Grid').classList.contains('is-active'),
        factors: factors(),
        value: up.value,
        label: label(),
        inject: { ...PROMPT_BOX_CONTROLS.useTiles.getInjectionParams(), ...PROMPT_BOX_CONTROLS.useGrid.getInjectionParams() },
      };

      btn('Use Tiles').click();
      out.gridAfterTiles = btn('Use Grid').classList.contains('is-active');
      return out;
    });

    expect(r.offFactors).toEqual(['1.5', '2', '3', '4']);
    expect(r.onFactors).toEqual(['1', '1.5', '2', '3', '4']);
    expect(r.tilesActive).toBe(true);
    // 1920x1080 x1.5 = 2880x1620 -> 4 x 2 tiles; x1 -> 3 x 2 (tileCount.js, Impact's maths).
    expect(r.labelAt15).toBe('Upscale · 8 tiles');
    expect(r.labelAt1).toBe('Upscale · 6 tiles');
    expect(r.injectAt1).toEqual({ Input_Tile_Upscale: true, Input_Upscale_Factor: 1 });
    expect(r.afterGrid).toEqual({
      tilesActive: false, gridActive: true, factors: ['1.5', '2', '3', '4'], value: 1.5, label: 'Upscale',
      inject: { Input_Tile_Upscale: false, Input_Auto_Grid: true },
    });
    expect(r.gridAfterTiles).toBe(false);
  } finally {
    await closeApp(app);
  }
});
