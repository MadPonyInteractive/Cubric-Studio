// @ts-check
// MPI-1060 (Fabio, 2026-10-11): on LTX Reference to Video every picture's tag is a toggle.
// Click it and that picture becomes the clip's start frame (Input_Start_Frame, not on the
// reference sheet); click it again and it is a Picture n once more. One start frame at most.
// Before this the start-frame slot was reachable from the prompt box only as a 10th picture.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('a picture tag on LTX ref2v toggles that picture to the start frame and back', async ({}, testInfo) => {
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
      const mk = (id, modelId) => {
        const host = document.createElement('div');
        host.id = id;
        document.body.appendChild(host);
        const model = getModelById(modelId);
        const pb = MpiPromptBox.mount(host, { model, modelList: [model], operation: 'ref2v_ms' });
        pb.el.clearMedia();
        pb.el.setOperation('ref2v_ms');
        for (const n of ['a', 'b', 'c']) pb.el.injectMedia({ url: `C:/fixture/${n}.png`, mediaType: 'image' });
        pb.el.setOperation('ref2v_ms');
      };
      mk('pb-ltx', 'ltx-23-balanced');
      mk('pb-h3', 'minimax-h3-ref2va');
    });

    const ltx = window.locator('#pb-ltx');
    const tags = () => ltx.locator('.mpi-prompt-box-media-strip__chip').evaluateAll(chips =>
      chips.map(c => c.querySelector('.mpi-prompt-box-media-strip__index')?.textContent.trim()));
    const startRoles = () => window.evaluate(() => document.querySelector('#pb-ltx .mpi-prompt-box')
      .getMediaItems().map(m => m.role === 'inputStartFrame'));
    const toggle = (i) => ltx.locator('.mpi-prompt-box-media-strip__chip').nth(i)
      // The bare boxes mount below the shell, outside the viewport: click via the DOM.
      .locator('.mpi-prompt-box-media-strip__index--toggle').evaluate(b => b.click());

    expect(await tags()).toEqual(['Picture 1', 'Picture 2', 'Picture 3']);

    // MPI-1080 (Fabio): the tag sits ABOVE the picture, never on it, and fits its chip; the
    // remove X lives inside the picture's corner, off the tag, and the strip's scroll box
    // clips neither. The tag is an outlined button, with no swap icon in it.
    const geo = await ltx.locator('.mpi-prompt-box-media-strip__chip').first().evaluate(chip => {
      const r = (sel) => chip.querySelector(sel).getBoundingClientRect();
      const tag = r('.mpi-prompt-box-media-strip__tag');
      const frame = r('.mpi-prompt-box-media-strip__frame');
      const x = r('.mpi-prompt-box-media-strip__remove');
      const strip = chip.closest('.mpi-prompt-box-media-strip').getBoundingClientRect();
      return {
        tagOverPicture: tag.bottom - frame.top,
        tagOverflow: tag.right - chip.getBoundingClientRect().right,
        xInFrame: x.top >= frame.top && x.right <= frame.right && x.left >= frame.left,
        xOverTag: x.top < tag.bottom && x.left < tag.right,
        tagTop: tag.top - strip.top,
        icons: chip.querySelectorAll('.mpi-prompt-box-media-strip__tag svg').length,
      };
    });
    expect(geo.tagOverPicture, JSON.stringify(geo)).toBeLessThanOrEqual(0);
    expect(geo.tagOverflow, JSON.stringify(geo)).toBeLessThanOrEqual(0);
    expect(geo.xInFrame, JSON.stringify(geo)).toBe(true);
    expect(geo.xOverTag, JSON.stringify(geo)).toBe(false);
    expect(geo.tagTop).toBeGreaterThanOrEqual(0);
    expect(geo.icons).toBe(0);

    await toggle(1);
    expect(await tags()).toEqual(['Picture 1', 'Start frame', 'Picture 2']);
    expect(await startRoles()).toEqual([false, true, false]);

    // Taking the start frame elsewhere gives the first one back to the sheet.
    await toggle(2);
    expect(await tags()).toEqual(['Picture 1', 'Picture 2', 'Start frame']);
    expect(await startRoles()).toEqual([false, false, true]);

    // Clicking it again makes it a picture once more.
    await toggle(2);
    expect(await tags()).toEqual(['Picture 1', 'Picture 2', 'Picture 3']);
    expect(await startRoles()).toEqual([false, false, false]);

    // Fabio: dragging the start-frame chip to a new place turned it back into a picture.
    // The start frame is the picture he clicked, wherever it moves.
    await toggle(0);
    expect(await tags()).toEqual(['Start frame', 'Picture 1', 'Picture 2']);
    await window.evaluate(() => {
      const chips = [...document.querySelectorAll('#pb-ltx .mpi-prompt-box-media-strip__chip')];
      const a = chips[0].getBoundingClientRect();
      const b = chips[1].getBoundingClientRect();
      const y = a.top + a.height / 2;
      chips[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: a.left + a.width / 2, clientY: y }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: b.left + b.width * 0.75, clientY: y }));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    expect(await tags()).toEqual(['Picture 1', 'Start frame', 'Picture 2']);
    expect(await startRoles()).toEqual([false, true, false]);

    // H3 has no start-frame slot: its tags stay plain labels.
    const h3 = window.locator('#pb-h3');
    await expect(h3.locator('.mpi-prompt-box-media-strip__chip')).toHaveCount(3);
    await expect(h3.locator('.mpi-prompt-box-media-strip__index--toggle')).toHaveCount(0);
  } finally {
    await closeApp(app);
  }
});
