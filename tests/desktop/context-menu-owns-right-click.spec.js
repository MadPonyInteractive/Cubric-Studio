// MPI-1016 — an open MpiContextMenu owns the right button.
//
// The menu opens with its corner under the cursor. A second right-click there landed
// on the menu, nothing prevented it, and Electron raised `context-menu` — which dev
// mode answers with a native Copy / Select All / Inspect Element menu ON TOP of ours.
// A right-click on a spot nobody owns left our menu open under the native one too.
//
// Counted at the main-process `context-menu` event (listeners swapped for a counter,
// so no native menu pops during the run): that event fires exactly when the page did
// not prevent the right-click, which is the whole bug.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

const STILL = '/comfy_workflows/display/flow-head-swap.webp';

test('a right-click on an open menu stays ours, and one elsewhere closes it', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);
    // A fresh profile's 18+ / changelog modals sit above everything, and real mouse
    // input hit-tests (same clearing as gallery-gif-hover.spec.js).
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await window.locator('.mpi-modal-backdrop').count(); i++) {
      await window.keyboard.press('Escape');
      await window.waitForTimeout(400);
    }
    expect(await window.locator('.mpi-modal-backdrop').count()).toBe(0);

    await app.evaluate(({ BrowserWindow }) => {
      global.__nativeMenus = 0;
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.removeAllListeners('context-menu');
        w.webContents.on('context-menu', () => { global.__nativeMenus += 1; });
      }
    });

    const card = await window.evaluate(async (still) => {
      const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
      const host = document.createElement('div');
      // Above the shell, below the menu's 9999.
      host.style.cssText = 'position:fixed;top:0;left:0;width:1200px;height:700px;z-index:9000;';
      document.body.appendChild(host);
      MpiGalleryGrid.mount(host, { groups: [{
        id: 'ctx-1', type: 'image', name: 'One', selectedIndex: 0, archived: false,
        history: [{ id: 'ctx-1-item', type: 'image', filePath: still, thumbPath: still, pixelDimensions: { w: 1920, h: 1080 } }],
      }] });
      await new Promise(r => setTimeout(r, 300));
      const r = host.querySelector('.mpi-group-card').getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }, STILL);

    const nativeMenus = () => app.evaluate(() => global.__nativeMenus);
    const menuOpen = () => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'));

    await window.mouse.click(card.x, card.y, { button: 'right' });
    await window.waitForTimeout(200);
    expect(await menuOpen()).toBe(true);
    expect(await nativeMenus()).toBe(0);

    // The second right-click, same spot: the menu's corner is under the cursor.
    await window.mouse.click(card.x + 4, card.y + 4, { button: 'right' });
    await window.waitForTimeout(200);
    expect(await nativeMenus(), 'a right-click on our menu fell through to the native one').toBe(0);
    expect(await menuOpen()).toBe(true);

    // A spot nobody owns: the native menu is dev mode's business, ours must be gone.
    await window.mouse.click(1180, 690, { button: 'right' });
    await window.waitForTimeout(200);
    expect(await menuOpen(), 'our menu stayed open under the native one').toBe(false);
  } finally {
    await closeApp(app);
  }
});
