// MPI-786: leaving the Projects landing must stop its preview videos.
//
// Navigation only HIDES #page-landing, so the project grid outlives the page. Its preview
// clips are `preload="auto"`; hidden and paused, each keeps a range request open until
// Chromium idle-suspends it ~15s later. The app server is HTTP/1.1 on one host, and the
// renderer already holds three EventSource streams of Chromium's six connections, so three
// such clips stalled every fetch behind the gallery: a save sat queued for 14.9s in 6 of 10
// real-app runs (0 of 10 with the release).
//
// This spec does not reproduce the stall itself: under CUBRIC_E2E the GPU is off, and with
// the fix removed the same clips held their connections in none of 9 runs. It pins the
// release instead, which is what frees them. The landing row is a fixture (a stubbed /list-projects), because the real
// list is the developer's own Documents projects, and CI has none.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

test('leaving the landing releases its preview videos, and coming back rebuilds them', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    const folderPath = testInfo.outputPath('project').replace(/\\/g, '/');
    // Every listing from here on returns ONE project whose thumbnail is a real shipped clip.
    await window.evaluate(async (fp) => {
      const project = {
        id: 'e2e-landing-release', name: 'E2E Landing Release', folderPath: fp,
        updatedAt: new Date().toISOString(),
        recentThumbnail: '/comfy_workflows/display/flow-drama-box.mp4', recentThumbnailType: 'video',
      };
      const realFetch = window.fetch;
      window.fetch = (url, opts) => (String(url).startsWith('/list-projects')
        ? Promise.resolve(new Response(JSON.stringify({ success: true, projects: [project] })))
        : realFetch(url, opts));
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      // Boot already listed the real projects; render again on the fixture.
      const { loadProjectGrid } = await import('/js/shell/projectUI.js');
      await loadProjectGrid();
    }, folderPath);

    const clip = window.locator('#projectGrid video');
    await expect(clip).toHaveCount(1, { timeout: 15000 });
    await window.evaluate(() => { window.__mpi786 = document.querySelector('#projectGrid video'); });
    expect(await window.evaluate(() => !!window.__mpi786.getAttribute('src'))).toBe(true);

    await window.evaluate(async (fp) => {
      const { state } = await import('/js/state.js');
      const router = await import('/js/router.js');
      state.currentProject = { id: 'e2e-landing-release', name: 'E2E Landing Release', folderPath: fp, itemGroups: [], modelSettings: {} };
      router.navigate(router.PAGE_GALLERY);
    }, folderPath);
    // Gone from the grid AND its load cancelled: a detached video that keeps its src
    // keeps its connection until it is collected.
    await expect.poll(() => window.evaluate(() => ({
      rows: document.querySelector('#projectGrid').childElementCount,
      src: window.__mpi786.getAttribute('src'),
      networkState: window.__mpi786.networkState,
    }))).toEqual({ rows: 0, src: null, networkState: 0 });

    // The way back rebuilds the grid: navigation's own loadProjectGrid, on the stubbed list.
    await window.evaluate(async () => {
      const router = await import('/js/router.js');
      router.navigate(router.PAGE_LANDING);
    });
    await expect(clip).toHaveCount(1, { timeout: 15000 });

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
