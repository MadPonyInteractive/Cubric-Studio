const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-906 — the last three waiting spots trade their still PNGs for looping clips
 * (docs/mascot-placement.md, rule 7: waiting spots use the working clip):
 *   - Model Library queued install: the model's `working` loop, built only while queued;
 *   - History peek: the op's `working` loop while a generation runs;
 *   - Starting-engine screen: Studio's `engine-starting` loop while shown.
 * Each clip must PLAY, and must be gone - src dropped, decoder freed - once the spot hides.
 */
test.setTimeout(90000);

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAFElEQVR42mNk+M9QzwAEjGQwACdfA/MhYO3qAAAAAElFTkSuQmCC';

const playing = (window, sel) => expect.poll(() => window.evaluate((s) => {
  const v = document.querySelector(s);
  return v ? v.currentTime : -1;
}, sel), { timeout: 5000 }).toBeGreaterThan(0.2);

test('queued install: one working clip per queued tile, freed when it stops waiting', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      const { MpiTileSheet } = await import('/js/components/Primitives/MpiTileSheet/MpiTileSheet.js');
      const host = document.createElement('div');
      host.id = 'tile-host';
      document.body.appendChild(host);
      window.__sheet = MpiTileSheet.mount(host, {
        items: [{ id: 'a', name: 'A', waiting: 'video' }, { id: 'b', name: 'B', waiting: false }],
      });
    });
    const clips = () => window.evaluate(() =>
      [...document.querySelectorAll('#tile-host .mpi-tile__mascot')].map(v => v.getAttribute('src')));

    expect(await clips()).toEqual(['assets/mascot/video/working.webm']);
    await playing(window, '#tile-host .mpi-tile__mascot');

    await window.evaluate(() => { window.__sheet.el.setWaiting('a', false); window.__sheet.el.setWaiting('b', 'vision'); });
    expect(await clips()).toEqual(['assets/mascot/vision/working.webm']);

    await window.evaluate(() => window.__sheet.el.destroy());
    expect(await clips()).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('starting engine: Studio engine-starting loops while shown, gone on hide', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      const { MpiStartingComfy } = await import('/js/components/Compounds/MpiStartingComfy/MpiStartingComfy.js');
      window.__boot = MpiStartingComfy.mount(document.createElement('div'));
      window.__boot.el.show();
    });
    const clip = window.locator('.mpi-starting-comfy__img');
    await expect(clip).toHaveAttribute('src', 'assets/mascot/studio/engine-starting.webm');
    expect(await clip.evaluate(v => v.loop)).toBe(true);
    await playing(window, '.mpi-starting-comfy__img');

    await window.evaluate(() => window.__boot.el.hide());
    expect(await window.evaluate(() => window.__boot.el.querySelectorAll('video').length)).toBe(0);
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('History peek: the op working loop while a generation runs, src dropped when it ends', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async (imgUrl) => {
      const { state } = await import('/js/state.js');
      state.currentProject = {
        id: 'pPeekTest', name: 'Peek Test', folderPath: 'C:/tmp/peek-test',
        itemGroups: [{ id: 'gPeek', type: 'image', selectedIndex: 0,
          history: [{ id: 'iPeek', type: 'image', filePath: imgUrl, displayName: 'img' }] }],
      };
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gPeek' });
    }, TINY_PNG);
    await expect.poll(() => window.evaluate(() => !!document.querySelector('#mascot-peek'))).toBe(true);

    const peek = window.locator('#mascot-peek');
    expect(await peek.getAttribute('src')).toBeNull(); // nothing loaded until a job runs

    const emit = (name, payload) => window.evaluate(async ([n, p]) => {
      const { Events } = await import('/js/events.js');
      Events.emit(n, p);
    }, [name, payload]);

    await emit('generation:started', { id: 'job1', scope: 'groupHistory', groupId: 'gPeek', operation: 'i2v' });
    await expect(peek).toHaveAttribute('src', 'assets/mascot/video/working.webm');
    await expect(peek).toHaveClass(/mascot-peek--visible/);
    await playing(window, '#mascot-peek');

    await emit('generation:error', { id: 'job1' });
    await expect(peek).not.toHaveClass(/mascot-peek--visible/);
    expect(await peek.getAttribute('src')).toBeNull();
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
