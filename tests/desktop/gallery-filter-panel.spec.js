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
// MPI-785: the heart became a card MARK. A click marks a dot, a hold opens the shape
// menu, the pick reaches project.json, and a legacy `favourite: true` reads as a dot.
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
    g('img2', 2, 'image', 'flow-outpaint.webp', 'flow-outpaint.webp', { favourite: 'square' }),
    // A pre-MPI-785 heart: must read as a dot.
    g('vid1', 3, 'video', 'flow-drama-box.mp4', 'flow-drama-box.webp', { favourite: true }),
    g('vid2', 4, 'video', 'flow-ltx-extend.mp4', 'flow-ltx-extend.webp', { favourite: 'square' }),
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

/**
 * Arm a probe for the next pointerdown: when the card-mark menu enters the DOM, and when
 * it is fully drawn (opaque, no CSS transition left running). Read with readHoldProbe.
 */
function armHoldProbe(window) {
  return window.evaluate(() => {
    const t = window.__holdProbe = {};
    document.addEventListener('pointerdown', () => { t.down = performance.now(); }, { capture: true, once: true });
    const obs = new MutationObserver(() => {
      const popup = document.querySelector('.mpi-popup--card-mark');
      if (!popup) return;
      obs.disconnect();
      t.inDom = performance.now();
      const settle = () => {
        if (getComputedStyle(popup).opacity === '1' && popup.getAnimations().length === 0) {
          t.drawn = performance.now();
        } else requestAnimationFrame(settle);
      };
      settle();
    });
    obs.observe(document.body, { childList: true });
  });
}

/** ms from pointerdown to the menu in the DOM, and to the menu fully drawn. */
async function readHoldProbe(window) {
  await window.waitForFunction(() => window.__holdProbe?.drawn);
  return window.evaluate(() => {
    const t = window.__holdProbe;
    return { inDom: Math.round(t.inDom - t.down), drawn: Math.round(t.drawn - t.down) };
  });
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

/** The persisted `favourite` of one group, straight off project.json. */
function savedMark(folderPath, id) {
  const saved = JSON.parse(fs.readFileSync(path.join(folderPath, 'project.json'), 'utf8'));
  return saved.itemGroups.find(g => g.id === id)?.favourite;
}

/** Path data of the icon a card's mark button is drawing. */
function markDrawn(window, id) {
  return window.evaluate((gid) => document
    .querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${gid}"] .mpi-group-card__fav-wrap .mpi-ibtn__icon svg`)
    ?.innerHTML.replace(/\s+/g, ' ').trim(), id);
}

test('kind chips, the FILTER panel and the gallery toolbar in the project bar', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    const project = makeProject(testInfo);
    await window.evaluate(async (p) => {
      const { state } = await import('/js/state.js');
      state.currentProject = p;
    }, project);
    await go(window, 'PAGE_GALLERY');
    await expect.poll(() => cards(window)).toEqual(ALL);

    const filter = window.locator('.mpi-gallery-toolbar .mpi-gallery-filter__button');
    const panel = window.locator('.mpi-popup--gallery-filter');
    const row = (label) => window.locator('.mpi-gallery-filter__toggle', { hasText: label });

    await test.step('the toolbar is in the project bar and the grid lost its second row', async () => {
      await expect(window.locator('.mpi-project-name__toolbar .mpi-gallery-toolbar')).toHaveCount(1);
      await expect(window.locator('.mpi-gallery-grid__tabs')).toHaveCount(0);
    });

    await test.step('every card with an item shows a kind chip; an empty card does not', async () => {
      // MPI-736 round 7: image and audio badge too, so the chip is on every real card.
      // `empty1` is the edge that change created — `kindOfItem`'s last row matches
      // anything, so without the `selected ?` guard an empty card claims to be an image.
      const chips = await window.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll('.mpi-gallery-grid__row-wrap')].map((wrap) => {
          const chip = wrap.querySelector('.mpi-group-card__kind');
          return [wrap.dataset.groupId, !!chip && getComputedStyle(chip).display !== 'none'];
        })));
      expect(chips).toEqual({ empty1: false, img1: true, img2: true, scene1: true, vid1: true, vid2: true });
    });

    await test.step('each chip wears its media family accent, and resolves to a real colour', async () => {
      // The attribute is half the story: [data-accent] only rebinds --accent-heat, so a
      // wrong or missing value fails silently and the chip inherits #app-shell's accent.
      // Assert the attribute AND that the two families actually render different colours.
      const chips = await window.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll('.mpi-gallery-grid__row-wrap')].map((wrap) => {
          const chip = wrap.querySelector('.mpi-group-card__kind');
          return [wrap.dataset.groupId, chip ? {
            accent: chip.dataset.accent ?? null,
            color: getComputedStyle(chip).color,
          } : null];
        })));
      expect(chips.empty1.accent).toBe(null);
      expect(chips.img1.accent).toBe('vision');
      expect(chips.img2.accent).toBe('vision');
      expect(chips.scene1.accent).toBe('vision');
      expect(chips.vid1.accent).toBe('video');
      expect(chips.vid2.accent).toBe('video');
      expect(chips.img1.color).not.toBe(chips.vid1.color);
    });

    await test.step('card marks: a legacy heart is a dot, click marks a dot, hold picks a shape', async () => {
      const markBtn = (id) => window.locator(
        `.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card__fav-wrap .mpi-btn`);
      const menu = window.locator('.mpi-popup--card-mark');
      const DOT = '<circle cx="12" cy="12" r="10"></circle>';
      const TRIANGLE = '<path d="M12 2.5l11 19H1z"></path>';

      expect(await markDrawn(window, 'vid1')).toBe(DOT);
      await expect(markBtn('vid1')).toHaveClass(/is-active/);

      // Click = dot, click again = none.
      await markBtn('img1').click();
      expect(await markDrawn(window, 'img1')).toBe(DOT);
      await expect.poll(() => savedMark(project.folderPath, 'img1')).toBe('dot');
      await markBtn('img1').click();
      await expect(markBtn('img1')).not.toHaveClass(/is-active/);
      await expect.poll(() => savedMark(project.folderPath, 'img1')).toBe(false);

      // Hold = the menu; releasing on the button itself changes nothing.
      await markBtn('img1').hover();
      await armHoldProbe(window);
      await window.mouse.down();
      await expect(menu).toHaveCount(1, { timeout: 2000 });
      // The timer is the whole wait: no entrance transition and no late mount on top of it.
      // A hold that FELT like 1.5 s measured 408 ms here with the timer at 400 (MPI-785).
      const hold = await readHoldProbe(window);
      const holdMs = await window.evaluate(async () =>
        (await import('/js/components/Compounds/MpiGalleryGrid/cardMarkMenu.js')).MARK_HOLD_MS);
      testInfo.annotations.push({ type: 'mark hold ms', description: JSON.stringify({ holdMs, ...hold }) });
      expect(hold.inDom).toBeLessThan(holdMs + 250);
      expect(hold.drawn - hold.inDom).toBeLessThan(100);
      await window.mouse.up();
      await expect(menu).toHaveCount(1);
      await expect(markBtn('img1')).not.toHaveClass(/is-active/);
      await expect(menu.locator('.mpi-gallery-grid__mark-option')).toHaveCount(3);

      await menu.locator('[aria-label="Triangle"]').click();
      await expect(menu).toHaveCount(0);
      expect(await markDrawn(window, 'img1')).toBe(TRIANGLE);
      await expect.poll(() => savedMark(project.folderPath, 'img1')).toBe('triangle');
      // No card opened on the way (the history page would have unmounted the grid).
      expect(await cards(window)).toEqual(ALL);
    });

    await test.step('hiding Images removes the image cards, keeps the scene and lights the dot', async () => {
      await expect(filter).not.toHaveClass(/mpi-gallery-filter__button--filtered/);
      await filter.click();
      await expect(panel).toHaveCount(1);
      const rows = await window.evaluate(() => [...document.querySelectorAll('.mpi-gallery-filter__row')]
        .map(r => r.textContent.replace(/\s+/g, ' ').trim()));
      expect(rows).toEqual(['Images On', 'Videos On', '3D Scenes On', 'Dots Off', 'Squares Off', 'Triangles Off', 'Previews Off']);

      // MPI-736 round 7: a KIND row carries its family accent, so an active row fills with
      // that colour and agrees with the card's corner chip. A mark row and the previews
      // flag are not media types and keep the workspace accent — no attribute at all.
      const rowAccents = await window.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll('.mpi-gallery-filter__row')].map((r) => [
          r.textContent.replace(/\s+/g, ' ').trim().split(' ')[0],
          { accent: r.dataset.accent ?? null, bg: getComputedStyle(r).backgroundColor },
        ])));
      expect(rowAccents.Images.accent).toBe('vision');
      expect(rowAccents.Videos.accent).toBe('video');
      expect(rowAccents['3D'].accent).toBe('vision');
      expect(rowAccents.Dots.accent).toBe(null);
      expect(rowAccents.Previews.accent).toBe(null);
      // Both are On, so both are filled — and the fills must actually differ, which is what
      // fails if [data-accent] stops rebinding --accent-heat for the row.
      expect(rowAccents.Images.bg).not.toBe(rowAccents.Videos.bg);

      await row('Images').click();
      await expect(panel).toHaveCount(1); // a row click keeps the panel open
      await expect.poll(() => cards(window)).toEqual(['scene1', 'vid1', 'vid2']);
      await expect(filter).toHaveClass(/mpi-gallery-filter__button--filtered/);
      await expect(filter).toHaveAttribute('data-info', 'Filtered: Videos, 3D Scenes');
    });

    await test.step('a mark filter is ANDed with the hidden kind, and marks OR together', async () => {
      await row('Squares').click();
      await expect.poll(() => cards(window)).toEqual(['vid2']);
      await expect(filter).toHaveAttribute('data-info', 'Filtered: Videos, 3D Scenes · Squares');
      await row('Dots').click();
      await expect.poll(() => cards(window)).toEqual(['vid1', 'vid2']);
      await row('Dots').click();
      await expect.poll(() => cards(window)).toEqual(['vid2']);
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
      await expect(filter).not.toHaveClass(/mpi-gallery-filter__button--filtered/);
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
