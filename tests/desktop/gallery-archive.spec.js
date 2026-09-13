// MPI-678 — the gallery archive scope.
//
// Archive ships as a SCOPE (`gallerySort.scope`), not a seventh filter chip. That
// distinction is the whole design and it is what these tests pin:
//
//  - `favorites` is ADDITIVE — a fav still shows under All/Images. Archive is
//    SUBTRACTIVE, so an archived card must be absent from every active-scope filter
//    and the active cards absent from the archive.
//  - Because the scope gates BEFORE the filter switch, the type tabs keep working
//    inside the archive. A seventh chip would have cost exactly that, in the one
//    bucket big enough to need it. If someone later "simplifies" the gate into the
//    filter switch, the Images-inside-the-archive assertion is what fails.
//  - The persist leg is the part with a server round trip, so it is asserted against
//    the bytes on disk rather than against the in-memory group.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

// Electron boot (splash -> local server -> shell) runs past the 30s default.
test.setTimeout(90000);

// Real shipped stills. A src that 404s takes the missing-media path, which empties
// the card media and makes a passing fix read as broken (MPI-631/633).
const STILL = '/comfy_workflows/display/flow-head-swap.webp';

/** Two images + one video, so the type filter has something to narrow. */
function fixtureGroups() {
  return [
    { id: 'arc-img-1', type: 'image', name: 'Image One',  selectedIndex: 0, archived: false },
    { id: 'arc-img-2', type: 'image', name: 'Image Two',  selectedIndex: 0, archived: false },
    { id: 'arc-vid-1', type: 'video', name: 'Video One',  selectedIndex: 0, archived: false },
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

/** Mount the grid standalone in a fixed-size host; returns nothing. */
async function mountGrid(window, groups) {
  await window.evaluate(async (gs) => {
    const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
    const { state } = await import('/js/state.js');
    window.__arc?.grid?.el?.destroy?.();
    window.__arc?.host?.remove();

    const host = document.createElement('div');
    host.id = 'arc-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:1600px;height:900px;z-index:0;';
    document.body.appendChild(host);

    // The scope is in-memory and resets per launch; set it explicitly so the test
    // never inherits another spec's leftover.
    state.gallerySort = { order: 'newest', filter: 'all', scope: 'active' };
    window.__arc = { grid: MpiGalleryGrid.mount(host, { groups: gs }), host };
    await new Promise(r => setTimeout(r, 300));
  }, groups);
}

/** Group ids currently rendered as cards, in render order. */
function visibleIds(window) {
  return window.evaluate(() =>
    [...document.querySelectorAll('#arc-host .mpi-gallery-grid__row-wrap')]
      .map(el => el.dataset.groupId));
}

/** Drive the toolbar/filter the way the UI does — through the state proxy. */
async function setSort(window, patch) {
  await window.evaluate(async (p) => {
    const { state } = await import('/js/state.js');
    state.gallerySort = { ...state.gallerySort, ...p };
    await new Promise(r => setTimeout(r, 250));
  }, patch);
}

test('an archived card leaves the gallery, is reachable under the archive scope, and comes back', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000); // shell boot settles
    await mountGrid(window, fixtureGroups());

    expect(await visibleIds(window)).toHaveLength(3);

    // Archive one image. `setGroups` is the component's supported entry point for
    // new data, so the flag flip goes through it rather than a private reference.
    const withOneArchived = fixtureGroups().map(g =>
      g.id === 'arc-img-1' ? { ...g, archived: true } : g);
    await window.evaluate(async (gs) => {
      window.__arc.grid.el.setGroups(gs);
      await new Promise(r => setTimeout(r, 300));
    }, withOneArchived);

    // Subtractive: gone from the ACTIVE grid entirely.
    const active = await visibleIds(window);
    expect(active).toHaveLength(2);
    expect(active).not.toContain('arc-img-1');

    // Present under the archive scope, and ONLY it.
    await setSort(window, { scope: 'archived' });
    expect(await visibleIds(window)).toEqual(['arc-img-1']);

    // The design claim: the type tabs keep working INSIDE the archive. `Videos`
    // narrows the archive to nothing; `Images` brings the archived image back.
    await setSort(window, { filter: 'videos' });
    expect(await visibleIds(window)).toHaveLength(0);
    await setSort(window, { filter: 'images' });
    expect(await visibleIds(window)).toEqual(['arc-img-1']);

    // An empty archive must SAY so — a blank grid is the one way this reads as
    // deletion. (Filtered to videos above, the archive is empty.)
    await setSort(window, { filter: 'videos' });
    await expect(window.locator('#arc-host .mpi-gallery-grid__scope-empty')).toBeVisible();

    // Restored: back to the active scope, un-archived, and the grid is whole again.
    await setSort(window, { filter: 'all', scope: 'active' });
    await window.evaluate(async (gs) => {
      window.__arc.grid.el.setGroups(gs);
      await new Promise(r => setTimeout(r, 300));
    }, fixtureGroups());
    expect(await visibleIds(window)).toHaveLength(3);
  } finally {
    await closeApp(app);
  }
});

test('the context-menu entry is labelled off the card, not the scope', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);
    await mountGrid(window, fixtureGroups());

    const menuLabel = async () => window.evaluate(async () => {
      const card = document.querySelector('#arc-host .mpi-gallery-grid__row-wrap .mpi-group-card');
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 40 }));
      await new Promise(r => setTimeout(r, 200));
      const item = document.querySelector('.mpi-ctx-menu__item[data-key="archive"]');
      const text = item?.textContent?.trim() || null;
      document.body.click();
      return text;
    });

    expect(await menuLabel()).toContain('Archive');

    // Same card, archived: the entry inverts. It reads the card's own `archived`,
    // which is what makes multi-select safe — the scope gate guarantees every card
    // in view shares one value, so there is no mixed state to resolve.
    await window.evaluate(async (gs) => {
      window.__arc.grid.el.setGroups(gs);
      const { state } = await import('/js/state.js');
      state.gallerySort = { ...state.gallerySort, scope: 'archived' };
      await new Promise(r => setTimeout(r, 300));
    }, fixtureGroups().map(g => ({ ...g, archived: true })));

    expect(await menuLabel()).toContain('Return to gallery');
  } finally {
    await closeApp(app);
  }
});

test('`archived` survives the round trip to project.json', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    const folderPath = testInfo.outputPath('archive-project');
    fs.mkdirSync(folderPath, { recursive: true });
    const jsonPath = path.join(folderPath, 'project.json');
    fs.writeFileSync(jsonPath, JSON.stringify({
      id: 'e2e-archive', name: 'E2E Archive', itemGroups: [], modelSettings: {},
    }, null, 2));

    // The serializer -> /update-project -> disk leg is the only part of this card
    // with a server round trip, so it is asserted against the BYTES, not memory.
    await window.evaluate(async ({ fp, groups }) => {
      const [{ state }, { persistGroups }] = await Promise.all([
        import('/js/state.js'),
        import('/js/services/projectService.js'),
      ]);
      state.currentProject = {
        id: 'e2e-archive', name: 'E2E Archive', folderPath: fp,
        itemGroups: groups, modelSettings: {},
      };
      await persistGroups();
    }, { fp: folderPath.replace(/\\/g, '/'), groups: fixtureGroups().map(g =>
      g.id === 'arc-img-1' ? { ...g, archived: true } : g) });

    const onDisk = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const byId = Object.fromEntries(onDisk.itemGroups.map(g => [g.id, g]));

    expect(byId['arc-img-1'].archived).toBe(true);
    // Written explicitly rather than left undefined — an absent key would still read
    // as falsy, so this asserts the serializer really carries the field.
    expect(byId['arc-img-2'].archived).toBe(false);
    expect(byId['arc-vid-1'].archived).toBe(false);
  } finally {
    await closeApp(app);
  }
});
