const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-908 — the empty states loop a mascot clip (js/utils/mascotLoop.js).
 *
 * The crop is the part that can silently not work: `object-view-box` must change the clip's
 * natural size, or a 64px spot shows a 38px robot in a mostly empty square. So the width a
 * 64px-tall clip lays out at is asserted against the MEASURED crop, not just the markup.
 */
test.setTimeout(90000);

test('empty states: the crop sizes the clip to its figure; "No cards match" plays the filtered kind', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.waitForTimeout(6000); // shell boot settles

    // no-results is cropped to 525x465, peek to 413x184 (mascotLoop.js CROP).
    const widthAt64 = (clip) => window.evaluate(async (c) => {
      const { mascotLoop } = await import('/js/utils/mascotLoop.js');
      const host = document.createElement('div');
      host.innerHTML = mascotLoop('studio', c, 'e2e-mascot');
      const v = host.firstElementChild;
      v.style.height = '64px';
      document.body.appendChild(host);
      if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
      const w = v.getBoundingClientRect().width;
      host.remove();
      return { w, muted: v.muted, loop: v.loop, autoplay: v.autoplay };
    }, clip);
    const nr = await widthAt64('no-results');
    expect(nr.w).toBeCloseTo(64 * 525 / 465, 0);
    expect(nr).toMatchObject({ muted: true, loop: true, autoplay: true });
    expect((await widthAt64('peek')).w).toBeCloseTo(64 * 413 / 184, 0);

    // A filter that shows only videos and matches nothing: Reel shrugs, not Cosmo.
    await window.evaluate(async () => {
      const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
      const { state } = await import('/js/state.js');
      const { PANEL_KINDS } = await import('/js/utils/assetKinds.js');
      window.__mpi908Sort = state.gallerySort;
      state.gallerySort = { ...state.gallerySort, hiddenKinds: PANEL_KINDS.map(k => k.kind).filter(k => k !== 'video') };
      const host = document.createElement('div');
      host.id = 'mpi908-host';
      host.style.cssText = 'position:fixed;inset:0;width:1200px;height:900px;z-index:0;';
      document.body.appendChild(host);
      const groups = [{ id: 'g', type: 'image', selectedIndex: 0, history: [{ id: 'i', type: 'image', filePath: '/comfy_workflows/display/flow-scribble.webp' }] }];
      window.__mpi908 = { grid: MpiGalleryGrid.mount(host, { groups }), host };
    });
    const mascot = window.locator('#mpi908-host .mpi-gallery-grid__scope-empty-mascot');
    await expect(mascot).toHaveAttribute('src', 'assets/mascot/video/no-results.webm');

    expect(pageErrors).toEqual([]);
  } finally {
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      if (window.__mpi908Sort) state.gallerySort = window.__mpi908Sort;
      window.__mpi908?.grid?.el?.destroy?.();
      window.__mpi908?.host?.remove();
    }).catch(() => {});
    await closeApp(app);
  }
});
