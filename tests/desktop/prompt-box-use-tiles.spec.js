// @ts-check
// MPI-1038 / MPI-1232: the upscale op's Use Tiles toggle, tile size picker, and
// Describe each tile checkbox. Grid is removed; 1x (detail only) exists only while
// Tiles is on; the Upscale label and the Tile size label both count the live tiles.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('Use Tiles: unlocks 1x, shows tileSize + tileDescribe, counts tiles in both labels', async ({}, testInfo) => {
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
      const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const upscaleLabel = () => [...document.querySelectorAll('.mpi-prompt-box__slider-name')].map(e => e.textContent).find(t => t.startsWith('Upscale'));
      const tileSizeLabel = () => [...document.querySelectorAll('.mpi-prompt-box__slider-name')].filter(e => isVisible(e)).map(e => e.textContent).find(t => t.startsWith('Tile size'));
      // Denoise slider value: read the <input type=range> inside the Denoise slider control.
      const denoiseValue = () => {
        const ctrl = [...document.querySelectorAll('.mpi-prompt-box__slider-control')]
          .find(el => el.querySelector('.mpi-prompt-box__slider-name')?.textContent === 'Denoise');
        const input = ctrl?.querySelector('input[type=range]');
        return input ? parseFloat(input.value) : null;
      };
      const out = {};

      // Before tiles on: 1x not available, tileSize hidden, no Describe checkbox
      out.offFactors = factors();
      out.tileSizeLabelOff = tileSizeLabel();
      out.denoiseBeforeTiles = denoiseValue();

      // Turn tiles on
      btn('Use Tiles').click();
      await new Promise(res => setTimeout(res, 50)); // allow split event to settle
      out.onFactors = factors();
      out.tilesActive = btn('Use Tiles').classList.contains('is-active');
      out.denoiseAfterTilesOn = denoiseValue();

      // Tile size label should appear (tiles section visible)
      out.tileSizeLabelOn = tileSizeLabel();

      // Set a known image size on upscaleFactor (1920x1080) and re-render labels
      const up = PROMPT_BOX_CONTROLS.upscaleFactor;
      const ts = PROMPT_BOX_CONTROLS.tileSize;
      up._size = { width: 1920, height: 1080 };
      up._renderLabel();
      ts._renderLabel?.();
      out.upscaleLabelAt15 = upscaleLabel();
      out.tileSizeLabelAt15 = tileSizeLabel();

      // Switch to 1x
      document.querySelector('.mpi-radio-group[aria-label="upscaleFactor"] .mpi-radio-group__btn[data-value="1"]').click();
      up._renderLabel();
      ts._renderLabel?.();
      out.upscaleLabelAt1 = upscaleLabel();
      out.injectAt1 = { ...PROMPT_BOX_CONTROLS.useTiles.getInjectionParams(), ...up.getInjectionParams() };

      // Describe each tile checkbox should be present (via MpiCheckbox)
      const describeCb = [...document.querySelectorAll('label')].find(l => l.textContent.includes('Describe each tile'));
      out.describePresent = !!describeCb;

      // Turn tiles off: tileSize should hide, denoise back to 0.2
      btn('Use Tiles').click();
      await new Promise(res => setTimeout(res, 50)); // allow split event to settle
      out.factorsAfterOff = factors();
      out.tileSizeLabelAfterOff = tileSizeLabel();
      out.denoiseAfterTilesOff = denoiseValue();

      return out;
    });

    expect(r.offFactors).toEqual(['1.5', '2', '3', '4']);
    expect(r.tileSizeLabelOff).toBeUndefined();  // hidden when tiles off
    expect(r.denoiseBeforeTiles).toBeCloseTo(0.2, 2); // no tiles → 0.2 default
    expect(r.onFactors).toEqual(['1', '1.5', '2', '3', '4']);
    expect(r.tilesActive).toBe(true);
    expect(r.denoiseAfterTilesOn).toBeCloseTo(0.3, 2); // tiles on, no saved → 0.3
    // Tile size label appears when tiles on (even without a size set, shows 'Tile size')
    expect(typeof r.tileSizeLabelOn).toBe('string');
    expect(r.tileSizeLabelOn).toMatch(/^Tile size/);
    // 1920x1080 x1.5 = 2880x1620 -> 8 tiles at default 1024 tile size
    expect(r.upscaleLabelAt15).toBe('Upscale · up to 8 tiles');
    expect(r.tileSizeLabelAt15).toMatch(/^Tile size · up to 8 tiles/);
    // 1920x1080 x1.0 = 1920x1080 -> 6 tiles
    expect(r.upscaleLabelAt1).toBe('Upscale · up to 6 tiles');
    expect(r.injectAt1).toEqual({ Input_Tile_Upscale: true, Input_Upscale_Factor: 1 });
    expect(r.describePresent).toBe(true);
    // After tiles off: 1x gone, tile size hidden, denoise back to 0.2
    expect(r.factorsAfterOff).toEqual(['1.5', '2', '3', '4']);
    expect(r.tileSizeLabelAfterOff).toBeUndefined();
    expect(r.denoiseAfterTilesOff).toBeCloseTo(0.2, 2); // tiles off → back to 0.2
  } finally {
    await closeApp(app);
  }
});
