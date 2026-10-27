// @ts-check
// MPI-1312 (Fabio, 2026-10-27): Qwen-Image 2.1, FLUX.3 and Klein take several pictures, but
// typing `@` in their prompt offered nothing — their edit slots carried no tag. Each model
// must now list its pictures and write the words its own encoder reads.
// Unit half: tests/ref-tag-picker.test.cjs.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('@ names each staged picture on the multi-picture edit models', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window } = await launchApp(testInfo);
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
      for (const [modelId, operation] of [['qwen-image-2-1', 'edit'], ['flux3-klein', 'edit'], ['klein-9b', 'kleinEdit']]) {
        const host = document.createElement('div');
        host.id = `pb-${modelId}`;
        document.body.appendChild(host);
        const model = getModelById(modelId);
        const pb = MpiPromptBox.mount(host, { model, modelList: [model], operation });
        pb.el.clearMedia();
        pb.el.setOperation(operation);
        pb.el.injectMedia({ url: 'C:/fixture/robot.png', mediaType: 'image' });
        pb.el.injectMedia({ url: 'C:/fixture/camera.png', mediaType: 'image' });
      }
    });

    const pick = async (modelId) => {
      const box = window.locator(`#pb-${modelId} textarea`).first();
      // focus, not click: the three boxes stack, and on CI's smaller window one box's chips
      // cover the next one's textarea, so a click never lands.
      await box.focus();
      await box.fill('');
      await window.keyboard.type('the robot from @');
      const offered = await window.locator(`#pb-${modelId} .mpi-prompt-box__ref-picker-tag`).allTextContents();
      await window.keyboard.press('ArrowDown');
      await window.keyboard.press('Enter');
      return { offered, prompt: await box.inputValue() };
    };

    expect(await pick('qwen-image-2-1')).toEqual({ offered: ['Image 1', 'Image 2'], prompt: 'the robot from <image2> ' });
    expect(await pick('flux3-klein')).toEqual({ offered: ['Image 1', 'Image 2'], prompt: 'the robot from the second image ' });
    expect(await pick('klein-9b')).toEqual({ offered: ['Image 1', 'Image 2'], prompt: 'the robot from image 2 ' });
  } finally {
    await closeApp(app);
  }
});
