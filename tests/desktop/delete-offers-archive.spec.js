// MPI-821 — Archive is the way out of a delete.
//
// Archive replaced the hidden `.preview-assets` copy store, so a deleted card is now
// what breaks a later Reuse of it. Two consequences are pinned here:
//
//  - the card context menu puts Archive DIRECTLY above Delete. Position is the claim:
//    they are the same decision, and Archive mid-list read as an unrelated feature.
//  - the delete confirm offers a THIRD action. Cancel / Archive / Delete, with Delete
//    still the `ok` — Enter was the gesture that opened the dialog, so Enter must not
//    quietly archive instead.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

// A real shipped still: a src that 404s empties the card and makes a passing fix
// read as broken (MPI-631/633).
const STILL = '/comfy_workflows/display/flow-head-swap.webp';

function fixtureGroups() {
  return [
    { id: 'del-img-1', type: 'image', name: 'Image One', selectedIndex: 0, archived: false },
    { id: 'del-img-2', type: 'image', name: 'Image Two', selectedIndex: 0, archived: false },
  ].map(g => ({
    ...g,
    history: [{
      id: `${g.id}-item`,
      type: g.type,
      filePath: STILL,
      thumbPath: STILL,
      pixelDimensions: { w: 1920, h: 1080 },
    }],
  }));
}

async function mountGrid(window, groups) {
  await window.evaluate(async (gs) => {
    const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
    const { state } = await import('/js/state.js');
    window.__del?.grid?.el?.destroy?.();
    window.__del?.host?.remove();

    const host = document.createElement('div');
    host.id = 'del-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:1600px;height:900px;z-index:0;';
    document.body.appendChild(host);

    state.gallerySort = { ...(await import('/js/utils/galleryFilter.js')).DEFAULT_GALLERY_SORT };
    window.__del = { grid: MpiGalleryGrid.mount(host, { groups: gs }), host };
    await new Promise(r => setTimeout(r, 300));
  }, groups);
}

test('Archive sits directly above Delete in the card context menu', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);
    await mountGrid(window, fixtureGroups());

    const keys = await window.evaluate(async () => {
      const card = document.querySelector('#del-host .mpi-gallery-grid__row-wrap .mpi-group-card');
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 40 }));
      await new Promise(r => setTimeout(r, 200));
      const ks = [...document.querySelectorAll('.mpi-ctx-menu__item')].map(el => el.dataset.key);
      document.body.click();
      return ks;
    });

    expect(keys).toContain('archive');
    expect(keys).toContain('delete');
    // Adjacency, not just membership — a re-order that drops Archive back into the
    // middle of the list still contains both keys.
    expect(keys.indexOf('archive')).toBe(keys.indexOf('delete') - 1);
    // Delete stays last: it is the danger entry and the menu's floor.
    expect(keys[keys.length - 1]).toBe('delete');
  } finally {
    await closeApp(app);
  }
});

test('the delete confirm offers Cancel / Archive / Delete, and Enter still confirms Delete', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    // The dialog is mounted standalone: what is under test is MpiOkCancel's third
    // action, and the gallery's own wiring is one `on('alt')` over it.
    const shape = await window.evaluate(async () => {
      const { MpiOkCancel } = await import('/js/components/Compounds/MpiOkCancel/MpiOkCancel.js');
      const fired = [];
      const dialog = MpiOkCancel.mount(document.createElement('div'), {
        title: 'Delete',
        text: 'Permanently delete the selected cards and their media files?',
        okLabel: 'Delete',
        okVariant: 'danger',
        altLabel: 'Archive',
        cancelLabel: 'Cancel',
      });
      dialog.on('ok', () => fired.push('ok'));
      dialog.on('alt', () => fired.push('alt'));
      dialog.on('cancel', () => fired.push('cancel'));
      window.__okc = { dialog, fired };
      dialog.el.show();
      await new Promise(r => setTimeout(r, 300));

      const buttons = [...document.querySelectorAll('.mpi-ok-cancel__actions .mpi-btn')];
      return {
        labels: buttons.map(b => b.textContent.trim()),
        deleteIsDanger: buttons[2]?.classList.contains('mpi-btn--danger'),
      };
    });

    expect(shape.labels).toEqual(['Cancel', 'Archive', 'Delete']);
    expect(shape.deleteIsDanger).toBe(true);

    // A REAL Enter: the confirm leg is `Hotkeys.bind('modal.confirm')` on a window
    // keydown, so a synthetic event would prove nothing about the binding.
    await window.keyboard.press('Enter');
    await window.waitForTimeout(250);
    expect(await window.evaluate(() => [...window.__okc.fired])).toEqual(['ok']);

    const fired = await window.evaluate(async () => {
      window.__okc.dialog.el.show();
      await new Promise(r => setTimeout(r, 300));
      [...document.querySelectorAll('.mpi-ok-cancel__actions .mpi-btn')]
        .find(b => b.textContent.trim() === 'Archive')?.click();
      await new Promise(r => setTimeout(r, 200));
      const out = [...window.__okc.fired];
      window.__okc.dialog.el.hide();
      window.__okc.dialog.destroy?.();
      return out;
    });

    // Enter confirmed the gesture that opened the dialog; Archive is a click only.
    expect(fired).toEqual(['ok', 'alt']);
  } finally {
    await closeApp(app);
  }
});
