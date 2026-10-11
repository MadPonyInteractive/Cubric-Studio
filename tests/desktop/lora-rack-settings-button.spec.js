// MPI-1077: the settings popup's LoRA rack is headed by a `LoRA & Upscale` button
// that asks its host to open MpiModelSettings, so the overlay is reachable without
// the model picker. It shows for a local model with or without LoRAs set, never for
// a model that has no such settings, and a flat model's plain LORAS label is gone.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('LoRA rack head button opens LoRA & Upscale', async ({}, testInfo) => {
  test.setTimeout(60000);
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    const result = await window.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const [{ Events }, { state }, { MpiLoraRack }] = await Promise.all([
        import('/js/events.js'),
        import('/js/state.js'),
        import('/js/components/Compounds/MpiLoraRack/MpiLoraRack.js'),
      ]);
      Events.emit('engine:install-skipped');
      await sleep(300);

      state.currentProject = {
        id: 'e2e-lora-rack', name: 'E2E LoRA Rack', folderPath: '',
        itemGroups: [],
        modelSettings: {
          'sdxl-realistic': {
            loras: [{ name: 'probe_lora.safetensors', strengthModel: 0.7, strengthClip: 1 }],
          },
        },
      };

      const host = document.createElement('div');
      document.body.appendChild(host);
      const read = (modelId) => {
        const rack = MpiLoraRack.mount(host.appendChild(document.createElement('div')), { modelId });
        const btn = rack.el.querySelector('.mpi-lora-rack__open');
        const clicked = [];
        rack.on('settings', (d) => clicked.push(d.modelId));
        btn?.click();
        const out = {
          hidden: rack.el.hidden,
          button: !!btn,
          labels: [...rack.el.querySelectorAll('.mpi-lora-rack__label')].map(n => n.textContent),
          rows: rack.el.querySelectorAll('.mpi-lora-rack__row').length,
          clicked,
        };
        rack.el.destroy();
        return out;
      };

      return {
        withLora: read('sdxl-realistic'),
        noLora: read('krea2'),
        noSettings: read('nvidia-pid'),
        cloud: read('flux-schnell-cloud'),
      };
    });

    expect(result.withLora).toEqual({ hidden: false, button: true, labels: [], rows: 1, clicked: ['sdxl-realistic'] });
    expect(result.noLora).toMatchObject({ hidden: false, button: true, rows: 0, clicked: ['krea2'] });
    expect(result.noSettings).toMatchObject({ hidden: true, button: false, rows: 0 });
    expect(result.cloud).toMatchObject({ hidden: true, button: false });
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
