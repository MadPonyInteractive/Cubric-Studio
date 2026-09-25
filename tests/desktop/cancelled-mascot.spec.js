const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-908 — a Stopped job's gallery card stays up while the op's mascot plays `cancelled`
 * ONCE (headless walk-off), then goes. A late complete (MPI-195: the interrupt returned
 * output anyway) takes the card at once, and a `generation:cancelled` that is not a Stop
 * (cache hit, text output) removes it at once, as before.
 *
 * Real project + real MpiGalleryBlock; the jobs are fake registry entries, cancelled
 * through `activeGenerations.cancel`, which is what every Stop button calls.
 */
test.setTimeout(120000);

async function clearBootModals(window) {
  const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
  const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
  if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 8 && await backdrops() > 0; i++) {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(400);
  }
  expect(await backdrops()).toBe(0);
}

test('gallery: a Stopped card plays the op mascot cancelled once, then goes', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.waitForTimeout(6000); // shell boot settles
    await clearBootModals(window);

    const name = `mpi908-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await window.evaluate(async ({ name, folderPath }) => {
      const { createProject, openProject } = await import('/js/services/projectService.js');
      const { navigate, PAGE_GALLERY } = await import('/js/router.js');
      await openProject(await createProject(name, folderPath));
      navigate(PAGE_GALLERY);
    }, { name, folderPath: testInfo.outputPath('projects') });
    await window.waitForSelector('.mpi-gallery-block', { timeout: 30000 });

    const start = (id) => window.evaluate(async (gid) => {
      const { activeGenerations } = await import('/js/services/activeGenerations.js');
      const { state } = await import('/js/state.js');
      activeGenerations.start({
        id: gid, scope: 'gallery', tempId: `${gid}-tmp`, operation: 't2i', exec: { cancel() {} },
        projectPath: state.currentProject.folderPath,
        placeholderGroup: { id: `${gid}-tmp`, type: 'image', name: 'Generating...', selectedIndex: 0, width: 1024, height: 1024,
          history: [{ id: 'x', operation: 't2i', inputPreview: true }], isGenerating: true },
      });
    }, id);
    const stop = (id) => window.evaluate(async (gid) => {
      const { activeGenerations } = await import('/js/services/activeGenerations.js');
      activeGenerations.cancel(gid);
    }, id);
    const clip = () => window.evaluate(() => {
      const v = [...document.querySelectorAll('.mpi-group-card__mascot-clip')]
        .find(x => x.getAttribute('src')?.endsWith('/cancelled.webm'));
      const c = v?.closest('.mpi-group-card');
      return v ? { src: v.getAttribute('src'), loop: v.loop, idle: !!c?.classList.contains('mpi-group-card--mascot-idle'), t: v.currentTime } : null;
    });
    const mascotSrcs = () => window.evaluate(() =>
      [...document.querySelectorAll('.mpi-group-card__mascot-clip')].map(v => v.getAttribute('src')).filter(Boolean));

    // 1. A Stop: the card stays, playing Vision's cancelled once, big and centred, then goes.
    await start('mpi908-a');
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/getting-ready.webm');
    await stop('mpi908-a');
    await expect.poll(() => clip()).toMatchObject({ src: 'assets/mascot/vision/cancelled.webm', loop: false, idle: true });
    await expect.poll(async () => (await clip())?.t ?? 0, { timeout: 3000 }).toBeGreaterThan(0.5);
    await expect.poll(mascotSrcs, { timeout: 9000 }).toEqual([]);

    // 2. A late complete during the clip takes the card at once.
    await start('mpi908-b');
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/getting-ready.webm');
    await stop('mpi908-b');
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/cancelled.webm');
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('generation:complete', { id: 'mpi908-b', tempId: 'mpi908-b-tmp', cancelled: true });
    });
    await expect.poll(mascotSrcs, { timeout: 1500 }).toEqual([]);

    // 3. Not a Stop (cache hit / text output): gone at once, no clip.
    await start('mpi908-c');
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/getting-ready.webm');
    await window.evaluate(async () => {
      const { activeGenerations } = await import('/js/services/activeGenerations.js');
      const { Events } = await import('/js/events.js');
      activeGenerations.end('mpi908-c', { revokePreview: true });
      Events.emit('generation:cancelled', { id: 'mpi908-c', tempId: 'mpi908-c-tmp', extraTempIds: [] });
    });
    await expect.poll(mascotSrcs, { timeout: 1500 }).toEqual([]);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
