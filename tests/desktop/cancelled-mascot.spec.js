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
      return v ? { src: v.getAttribute('src'), loop: v.loop, idle: !!c?.classList.contains('mpi-group-card--mascot-idle'), t: v.currentTime,
        name: c?.querySelector('.mpi-group-card__name')?.textContent } : null;
    });
    const mascotSrcs = () => window.evaluate(() =>
      [...document.querySelectorAll('.mpi-group-card__mascot-clip')].map(v => v.getAttribute('src')).filter(Boolean));

    // 1. A Stop: the card stays, playing Vision's cancelled once, big and centred, then goes.
    await start('mpi908-a');
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/getting-ready.webm');
    await stop('mpi908-a');
    await expect.poll(() => clip()).toMatchObject({ src: 'assets/mascot/vision/cancelled.webm', loop: false, idle: true, name: 'Cancelling...' });
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

    // 4. MPI-929: a cloud Stop settles through onError, so generation:error follows the Stop.
    //    It must not cut the clip short: the card still walks off, then goes.
    await start('mpi929-d');
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/getting-ready.webm');
    await stop('mpi929-d');
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/cancelled.webm');
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('generation:error', { id: 'mpi929-d', tempId: 'mpi929-d-tmp', extraTempIds: [] });
    });
    await expect.poll(async () => (await clip())?.t ?? 0, { timeout: 3000 }).toBeGreaterThan(0.5);
    await expect.poll(mascotSrcs, { timeout: 9000 }).toEqual([]);

    // 5. MPI-928: a Stop on a cloud job already sent cannot un-bill it, so the result is still
    //    coming. No walk-off: the card keeps cooking until the paid result lands, then goes.
    await window.evaluate(async () => {
      const { activeGenerations } = await import('/js/services/activeGenerations.js');
      const { state } = await import('/js/state.js');
      activeGenerations.start({
        id: 'mpi928-e', scope: 'gallery', tempId: 'mpi928-e-tmp', operation: 't2i',
        exec: { cancel() {}, stopKeepsResult: true },
        projectPath: state.currentProject.folderPath,
        placeholderGroup: { id: 'mpi928-e-tmp', type: 'image', name: 'Generating...', selectedIndex: 0, width: 1024, height: 1024,
          history: [{ id: 'x', operation: 't2i', inputPreview: true }], isGenerating: true },
      });
    });
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/getting-ready.webm');
    await stop('mpi928-e');
    await window.waitForTimeout(1500);
    expect(await mascotSrcs()).not.toContain('assets/mascot/vision/cancelled.webm');
    expect((await mascotSrcs()).length).toBe(1);
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('generation:complete', { id: 'mpi928-e', tempId: 'mpi928-e-tmp', cancelled: true });
    });
    await expect.poll(mascotSrcs, { timeout: 1500 }).toEqual([]);

    // 5b. MPI-937: that paid result FAILED instead (seen live, nano-banana-2). Nothing is
    //     coming, so the card gets the walk-off its Stop put off, then goes.
    await window.evaluate(async () => {
      const { activeGenerations } = await import('/js/services/activeGenerations.js');
      const { state } = await import('/js/state.js');
      activeGenerations.start({
        id: 'mpi937-f', scope: 'gallery', tempId: 'mpi937-f-tmp', operation: 't2i',
        exec: { cancel() {}, stopKeepsResult: true },
        projectPath: state.currentProject.folderPath,
        placeholderGroup: { id: 'mpi937-f-tmp', type: 'image', name: 'Generating...', selectedIndex: 0, width: 1024, height: 1024,
          history: [{ id: 'x', operation: 't2i', inputPreview: true }], isGenerating: true },
      });
    });
    await expect.poll(mascotSrcs).toContain('assets/mascot/vision/getting-ready.webm');
    await stop('mpi937-f');
    await window.waitForTimeout(500);
    expect(await mascotSrcs()).not.toContain('assets/mascot/vision/cancelled.webm');
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('generation:error', { id: 'mpi937-f', tempId: 'mpi937-f-tmp', extraTempIds: [] });
    });
    await expect.poll(() => clip()).toMatchObject({ src: 'assets/mascot/vision/cancelled.webm', loop: false });
    await expect.poll(async () => (await clip())?.t ?? 0, { timeout: 3000 }).toBeGreaterThan(0.5);
    await expect.poll(mascotSrcs, { timeout: 9000 }).toEqual([]);

    // 6. MPI-928: the card that landed says why a Stopped run is in the gallery; others do not.
    const badgeText = () => window.evaluate(() =>
      [...document.querySelectorAll('.mpi-group-card__top-badge-row--charged')].map(r => r.textContent));
    await window.evaluate(async () => {
      const { addGroup } = await import('/js/services/projectService.js');
      const { createItemGroup, createImageItem } = await import('/js/data/projectModel.js');
      const item = (charged) => createImageItem({ operation: 't2i', modelId: 'flux-schnell-cloud',
        generationSettings: charged ? { chargedAfterStop: true } : {} });
      await addGroup(createItemGroup('image', { name: 'charged', history: [item(true)] }));
      await addGroup(createItemGroup('image', { name: 'plain', history: [item(false)] }));
    });
    await expect.poll(badgeText).toEqual(['CHARGED AFTER STOP']);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
