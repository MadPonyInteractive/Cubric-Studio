// MPI-749: gallery kinds, the FILTER panel, and the gallery toolbar in the project bar.
//
// Each of these fails silently, which is why they are pinned end to end:
//  - The kind chip and the filter read ONE table (js/utils/assetKinds.js) off the
//    SELECTED item. A chip on the wrong card, or a filter disagreeing with it, looks
//    like a styling slip rather than the contract breaking.
//  - A hidden kind must light the FILTER dot: filters behind a button that leave no
//    trace read as missing assets.
//  - The panel is a body portal that must close itself on pointer leave and leave no
//    node behind.
//  - navigation mounts the toolbar into MpiProjectName on the gallery page ONLY; a leak
//    onto group-history puts gallery controls over a history entry.
//  - The stats readout yields to the toolbar only below the measured bar width.
// Fixture media is REAL shipped media: a src that 404s takes the missing-media path
// (docs/gallery.md), which empties the card and makes a passing build read as broken.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(120000);

const D = (name) => `/comfy_workflows/display/${name}`;
const at = (minute) => new Date(Date.UTC(2026, 8, 14, 12, minute)).toISOString();

function fixtureGroups() {
  const g = (id, minute, type, file, thumb, { favourite = false, item = {} } = {}) => ({
    id, type, name: id, selectedIndex: 0, archived: false, favourite, createdAt: at(minute),
    history: [{
      id: `${id}-item`, type, filePath: D(file), thumbPath: D(thumb),
      pixelDimensions: { w: 1280, h: 720 }, ...item,
    }],
  });
  return [
    g('img1', 1, 'image', 'flow-head-swap.webp', 'flow-head-swap.webp'),
    g('img2', 2, 'image', 'flow-outpaint.webp', 'flow-outpaint.webp', { favourite: true }),
    g('vid1', 3, 'video', 'flow-drama-box.mp4', 'flow-drama-box.webp'),
    g('vid2', 4, 'video', 'flow-ltx-extend.mp4', 'flow-ltx-extend.webp', { favourite: true }),
    g('scene1', 5, 'image', 'flow-character-sheet.webp', 'flow-character-sheet.webp', { item: { splatPath: '/none.ply' } }),
    // No selected item at all, so its kind comes from the `{ type: group.type }` fallback.
    // It is also the card the group-history step opens: the history workspace resolves an
    // item's file through `/project-file`, where the display-media paths above do not
    // exist, and the failed load surfaces as an uncaught rejection that is not this card's.
    { id: 'empty1', type: 'image', name: 'empty1', selectedIndex: 0, archived: false, favourite: false, createdAt: at(6), history: [] },
  ];
}
const ALL = ['empty1', 'img1', 'img2', 'scene1', 'vid1', 'vid2'];

function makeProject(testInfo) {
  const folderPath = testInfo.outputPath('project');
  fs.mkdirSync(folderPath, { recursive: true });
  const project = { id: 'e2e-filters', name: 'E2E Filters', itemGroups: fixtureGroups(), modelSettings: {} };
  fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
  return { ...project, folderPath: folderPath.replace(/\\/g, '/') };
}

async function releaseBootGate(window) {
  await window.evaluate(async () => {
    const { Events } = await import('/js/events.js');
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 300));
  });
}

async function go(window, page, params) {
  await window.evaluate(async ({ page: p, params: ps }) => {
    const router = await import('/js/router.js');
    router.navigate(router[p], ps);
    await new Promise(r => setTimeout(r, 800));
  }, { page, params });
}

/** Group ids currently rendered as gallery cards, sorted. */
function cards(window) {
  return window.evaluate(() =>
    [...document.querySelectorAll('.mpi-gallery-grid__row-wrap')].map(el => el.dataset.groupId).sort());
}

/** Is the stats readout shown with the project bar forced to `width` px? */
function statsShownAt(window, width) {
  return window.evaluate(async (w) => {
    const bar = document.querySelector('.mpi-project-name');
    bar.style.width = `${w}px`;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const out = {
      shown: getComputedStyle(document.querySelector('.mpi-project-name__stats')).display !== 'none',
      nameToCentre: Math.round(rect('.mpi-project-name__centre').left - rect('.mpi-project-name__text').right),
      centreToToolbar: rect('.mpi-gallery-toolbar')
        ? Math.round(rect('.mpi-gallery-toolbar').left - rect('.mpi-project-name__centre').right)
        : null,
    };
    bar.style.width = '';
    return out;
  }, width);
}

test('kind chips, the FILTER panel and the gallery toolbar in the project bar', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    await window.evaluate(async (p) => {
      const { state } = await import('/js/state.js');
      state.currentProject = p;
    }, makeProject(testInfo));
    await go(window, 'PAGE_GALLERY');
    await expect.poll(() => cards(window)).toEqual(ALL);

    const filter = window.locator('.mpi-gallery-toolbar__filter');
    const panel = window.locator('.mpi-popup--gallery-filter');
    const row = (label) => window.locator('.mpi-gallery-toolbar__toggle', { hasText: label });

    await test.step('the toolbar is in the project bar and the grid lost its second row', async () => {
      await expect(window.locator('.mpi-project-name__toolbar .mpi-gallery-toolbar')).toHaveCount(1);
      await expect(window.locator('.mpi-gallery-grid__tabs')).toHaveCount(0);
    });

    await test.step('the kind chip shows on video and 3D Scene cards only', async () => {
      const chips = await window.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll('.mpi-gallery-grid__row-wrap')].map((wrap) => {
          const chip = wrap.querySelector('.mpi-group-card__kind');
          return [wrap.dataset.groupId, !!chip && getComputedStyle(chip).display !== 'none'];
        })));
      expect(chips).toEqual({ empty1: false, img1: false, img2: false, scene1: true, vid1: true, vid2: true });
    });

    await test.step('hiding Images removes the image cards, keeps the scene and lights the dot', async () => {
      await expect(filter).not.toHaveClass(/mpi-gallery-toolbar__filter--filtered/);
      await filter.click();
      await expect(panel).toHaveCount(1);
      const rows = await window.evaluate(() => [...document.querySelectorAll('.mpi-gallery-toolbar__row')]
        .map(r => r.textContent.replace(/\s+/g, ' ').trim()));
      expect(rows).toEqual(['Images On', 'Videos On', '3D Scenes On', 'Favourites Off', 'Previews Off']);

      await row('Images').click();
      await expect(panel).toHaveCount(1); // a row click keeps the panel open
      await expect.poll(() => cards(window)).toEqual(['scene1', 'vid1', 'vid2']);
      await expect(filter).toHaveClass(/mpi-gallery-toolbar__filter--filtered/);
      await expect(filter).toHaveAttribute('data-info', 'Filtered: Videos, 3D Scenes');
    });

    await test.step('Favourites only is ANDed with the hidden kind', async () => {
      await row('Favourites').click();
      await expect.poll(() => cards(window)).toEqual(['vid2']);
      await expect(filter).toHaveAttribute('data-info', 'Filtered: Videos, 3D Scenes · Favs');
    });

    await test.step('leaving the panel closes it, and no portal is left behind', async () => {
      await window.mouse.move(4, 600);
      await expect(panel).toHaveCount(0, { timeout: 3000 });
      await expect(filter).toHaveAttribute('aria-expanded', 'false');
    });

    await test.step('an empty filter says so, and SHOW ALL brings every card back', async () => {
      await filter.click();
      await row('Previews').click();
      await expect(window.locator('.mpi-gallery-grid__scope-empty-title')).toHaveText('No cards match');
      await window.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await window.locator('.mpi-gallery-grid__scope-empty .mpi-btn').click();
      await expect.poll(() => cards(window)).toEqual(ALL);
      await expect(filter).not.toHaveClass(/mpi-gallery-toolbar__filter--filtered/);
    });

    await test.step('the stats readout yields only below the cut, and nothing overlaps at a 950 window', async () => {
      expect((await statsShownAt(window, 1600)).shown).toBe(true);
      const narrow = await statsShownAt(window, 918);
      expect(narrow.shown).toBe(false);
      expect(narrow.nameToCentre).toBeGreaterThanOrEqual(8);
      expect(narrow.centreToToolbar).toBeGreaterThanOrEqual(8);
    });

    await test.step('group-history has no toolbar and keeps its readout; the gallery gets exactly one back', async () => {
      await go(window, 'PAGE_GROUP_HISTORY', { groupId: 'empty1' });
      await expect(window.locator('.mpi-gallery-toolbar')).toHaveCount(0);
      await expect(window.locator('.mpi-project-name__toolbar')).toBeEmpty();
      expect((await statsShownAt(window, 918)).shown).toBe(true);

      await go(window, 'PAGE_GALLERY');
      await expect(window.locator('.mpi-gallery-toolbar')).toHaveCount(1);
      await expect(panel).toHaveCount(0);
    });

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
