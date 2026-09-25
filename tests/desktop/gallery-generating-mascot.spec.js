const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-906 — the generating card plays the OP'S mascot: `getting-ready` big and centred
 * until the first preview frame, then `working` in the corner, and it lets go of both
 * decoders when the card stops generating.
 *
 * Asserts on the clips' `src`, never on which one is live: the handover waits for a
 * PRESENTED frame, and the desktop suite's window is parked off-screen and presents
 * none. The swap's flicker is proven on screencast frames, not here.
 */
test.setTimeout(90000);

test('generating card: op mascot getting-ready, then working, then released', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000); // shell boot settles

    await window.evaluate(async () => {
      const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
      const host = document.createElement('div');
      host.id = 'mpi906-host';
      host.style.cssText = 'position:fixed;inset:0;width:1200px;height:900px;z-index:0;';
      document.body.appendChild(host);
      const groups = [
        // A flow / agent placeholder: no history, so the media type decides.
        { id: 'mpi906-video', type: 'video', history: [], selectedIndex: 0, width: 1024, height: 576, isGenerating: true },
        // A gallery placeholder carrying its op: the op decides, over a type that disagrees.
        { id: 'mpi906-op', type: 'video', history: [{ id: 'x', operation: 't2i', inputPreview: true }], selectedIndex: 0,
          width: 1024, height: 1024, isGenerating: true },
      ];
      window.__mpi906 = { grid: MpiGalleryGrid.mount(host, { groups }), host, groups };
    });

    const srcs = (id) => window.evaluate((gid) => {
      const card = window.__mpi906.grid.el.getCardByGroupId(gid);
      if (!card) return null;   // the grid renders on a timer
      return { cls: card.className, clips: [...card.querySelectorAll('.mpi-group-card__mascot-clip')].map(v => v.getAttribute('src')) };
    }, id);

    await expect.poll(() => srcs('mpi906-video')).toMatchObject({ clips: expect.arrayContaining(['assets/mascot/video/getting-ready.webm']) });
    expect((await srcs('mpi906-video')).cls).toContain('mpi-group-card--mascot-idle');
    expect((await srcs('mpi906-op')).clips).toContain('assets/mascot/vision/getting-ready.webm');

    // First preview frame → the corner, working.
    await window.evaluate(() => window.__mpi906.grid.el.updatePreview('mpi906-video', '/comfy_workflows/display/flow-scribble.webp'));
    const cooking = await srcs('mpi906-video');
    expect(cooking.cls).toContain('mpi-group-card--mascot-cooking');
    expect(cooking.clips).toContain('assets/mascot/video/working.webm');

    // Done → no mascot, and no src left holding a decoder.
    await window.evaluate(() => {
      const g = { ...window.__mpi906.groups[0], isGenerating: false };
      window.__mpi906.grid.el.getCardByGroupId('mpi906-video').refreshGroup(g);
    });
    const done = await srcs('mpi906-video');
    expect(done.cls).not.toContain('mpi-group-card--mascot-');
    expect(done.clips).toEqual([null, null]);
  } finally {
    await window.evaluate(() => {
      window.__mpi906?.grid?.el?.destroy?.();
      window.__mpi906?.host?.remove();
      delete window.__mpi906;
    }).catch(() => {});
    await closeApp(app);
  }
});
