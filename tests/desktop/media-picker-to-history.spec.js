// MPI-887 — the Choose-media overlay's second destination: the open card's history.
//
// Composite's slot only ever took an entry already in the open card's history
// (`MpiToolOptionsComposite.js`), so two pictures living in two gallery cards could
// never be composited — which is exactly the case that needs it, an edit that changed
// something it should not have, with the original sitting in its own card.
//
// Three things pinned here:
//
//  - the toggle is OPT-IN. Openers with one destination (a Flow slot, Place, the
//    gallery toolbar) pass no label and get no toggle — a destination they cannot
//    honour would be a control that lies;
//  - with it on, a picked card becomes an entry on the OPEN card, and that entry is a
//    COPY. Deleting a history entry deletes its file, so an entry pointing at the
//    source card's file would mean deleting either card guts the other;
//  - with it off, nothing changes: the pick is still a reference chip.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

// Electron boot (splash -> local server -> shell) runs past the 30s default.
test.setTimeout(90000);

const REPO = path.resolve(__dirname, '..', '..');
// A real shipped still, copied into the fixture project: `copy-item` reads the source
// off disk, so a fabricated path takes the 404 branch and a working fix reads as broken.
const SRC_STILL = path.join(REPO, 'comfy_workflows', 'display', 'flow-head-swap.webp');

/** Leave the engine-install boot gate — an isolated user data dir has no engine. */
async function releaseBootGate(window) {
  await window.evaluate(async () => {
    const { Events } = await import('/js/events.js');
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 300));
  });
}

/**
 * A project with two image cards, each backed by real media and a real sidecar.
 * `open` is the card the workspace opens on; `other` is the one picked in the overlay.
 */
function seedProject(folderPath) {
  const mediaDir = path.join(folderPath, 'Media');
  const metaDir = path.join(mediaDir, '.meta');
  fs.mkdirSync(metaDir, { recursive: true });

  const mk = (id, stem, prompt) => {
    const abs = path.join(mediaDir, `${stem}.webp`);
    fs.copyFileSync(SRC_STILL, abs);
    const filePath = `/project-file?path=${encodeURIComponent(abs)}`;
    fs.writeFileSync(path.join(metaDir, `${id}.json`), JSON.stringify({
      id, type: 'image', filePath, displayName: stem, prompt,
      pixelDimensions: { w: 1920, h: 1080 },
    }, null, 2));
    return { abs, item: { id, type: 'image', filePath, thumbPath: filePath, name: null, pixelDimensions: { w: 1920, h: 1080 } } };
  };

  const open = mk('open-0', 'the_edit', 'the edited demon');
  const other = mk('other-0', 'the_original', 'a demon looking into a mirror');

  const project = {
    id: 'e2e-887',
    name: 'E2E 887',
    modelSettings: {},
    itemGroups: [
      { id: 'grp-open', name: 'The edit', customName: 'The edit', type: 'image', selectedIndex: 0, archived: false, history: [open.item] },
      { id: 'grp-other', name: 'The original', customName: 'The original', type: 'image', selectedIndex: 0, archived: false, history: [other.item] },
    ],
  };
  fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
  return { project, open, other, mediaDir, metaDir };
}

/** Open card `grp-open`'s history workspace on the seeded project. */
async function openHistory(window, project, folderPath) {
  await window.evaluate(async (p) => {
    const [{ state }, { navigate, PAGE_GROUP_HISTORY }] = await Promise.all([
      import('/js/state.js'),
      import('/js/router.js'),
    ]);
    state.currentProject = p;
    navigate(PAGE_GROUP_HISTORY, { groupId: 'grp-open' });
    await new Promise(r => setTimeout(r, 800));
  }, { ...project, folderPath: folderPath.replace(/\\/g, '/') });
  await expect(window.locator('#tool-container')).not.toBeEmpty({ timeout: 10000 });
}

/**
 * Open the overlay through the PromptBox's own `+` card, optionally flick the
 * "Add to history" toggle, then pick the tile captioned `caption`.
 *
 * Driven in-page rather than by locator: the media strip carries the `hide` class
 * until the prompt tool is armed, and this test is about the destination the pick
 * takes, not about which rail button reveals the strip.
 */
async function pickThroughOverlay(window, { caption, toHistory }) {
  return window.evaluate(async ({ want, flick }) => {
    document.querySelector('.mpi-prompt-box-media-strip__add').click();
    await new Promise(r => setTimeout(r, 400));

    const sw = document.querySelector('.mpi-media-picker__dest .mpi-btn');
    const sawToggle = !!sw;
    if (flick && sw) { sw.click(); }

    const captions = [...document.querySelectorAll('.mpi-media-picker__name')].map(el => el.textContent.trim());
    const tile = [...document.querySelectorAll('.mpi-media-picker__name')]
      .find(el => el.textContent.trim() === want)
      ?.closest('.mpi-media-picker__tile')
      ?.querySelector('.mpi-media-picker__tile-media');
    if (!tile) return { sawToggle, picked: false, captions };
    tile.click();
    // The copy is a server round trip, then a persist.
    await new Promise(r => setTimeout(r, 2500));
    return { sawToggle, picked: true, captions };
  }, { want: caption, flick: toHistory });
}

/** The absolute path back out of a `/project-file?path=<encoded>` URL. */
function absOf(url) {
  const s = String(url || '');
  return decodeURIComponent(s.slice(s.indexOf('path=') + 5).split('&')[0]);
}

test('the Add to history toggle turns a pick into a history entry on the open card, as a copy', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await releaseBootGate(window);
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(folderPath, { recursive: true });
    const seed = seedProject(folderPath);

    await openHistory(window, seed.project, folderPath);

    const res = await pickThroughOverlay(window, { caption: 'The original', toHistory: true });
    expect(res.sawToggle, 'the destination toggle renders on an image card history').toBe(true);
    expect(res.picked, `the other card was on screen in the overlay; saw: ${JSON.stringify(res.captions)}`).toBe(true);

    // In memory: a second entry on the OPEN card, and it is the selected one.
    const after = await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const g = state.currentProject.itemGroups.find(x => x.id === 'grp-open');
      return { count: g.history.length, selectedIndex: g.selectedIndex, filePath: g.history[g.history.length - 1]?.filePath };
    });
    expect(after.count).toBe(2);
    expect(after.selectedIndex).toBe(1);

    // Built in memory is not built: it has to survive a reload.
    const onDisk = JSON.parse(fs.readFileSync(path.join(folderPath, 'project.json'), 'utf8'));
    const openCard = onDisk.itemGroups.find(g => g.id === 'grp-open');
    expect(openCard.history).toHaveLength(2);

    // A COPY, not a second reference: its own file, the source's still there.
    const entryAbs = absOf(after.filePath);
    expect(entryAbs).not.toBe(seed.other.abs);
    expect(fs.existsSync(entryAbs)).toBe(true);
    expect(fs.existsSync(seed.other.abs), 'the source card keeps its file').toBe(true);

    // The sidecar came with it, so the entry still knows what made the picture.
    const entryId = typeof openCard.history[1] === 'string' ? openCard.history[1] : openCard.history[1].id;
    const sidecar = JSON.parse(fs.readFileSync(path.join(seed.metaDir, `${entryId}.json`), 'utf8'));
    expect(sidecar.prompt).toBe('a demon looking into a mirror');

    // The other card is untouched — a copy, never a move.
    const otherCard = onDisk.itemGroups.find(g => g.id === 'grp-other');
    expect(otherCard.history).toHaveLength(1);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

test('with the toggle off the pick is still a reference chip, and no entry is added', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await releaseBootGate(window);
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(folderPath, { recursive: true });
    const seed = seedProject(folderPath);

    await openHistory(window, seed.project, folderPath);
    const res = await pickThroughOverlay(window, { caption: 'The original', toHistory: false });
    expect(res.picked).toBe(true);

    const after = await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const g = state.currentProject.itemGroups.find(x => x.id === 'grp-open');
      return {
        count: g.history.length,
        chips: document.querySelectorAll('.mpi-prompt-box-media-strip__chip').length,
      };
    });
    expect(after.count, 'the default destination is unchanged').toBe(1);
    expect(after.chips, 'the pick staged a reference chip').toBeGreaterThan(0);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

test('an imported file lands as an entry too, and makes no second gallery card', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await releaseBootGate(window);
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(folderPath, { recursive: true });
    const seed = seedProject(folderPath);

    await openHistory(window, seed.project, folderPath);

    // Open the overlay and arm the toggle, then feed its upload card a real file.
    // The hidden input is the same handle the OS dialog fills, so this is the import
    // path end to end rather than a stand-in for it.
    await window.evaluate(async () => {
      document.querySelector('.mpi-prompt-box-media-strip__add').click();
      await new Promise(r => setTimeout(r, 400));
      document.querySelector('.mpi-media-picker__dest .mpi-btn').click();
    });
    await window.locator('.mpi-media-picker input[type=file]').setInputFiles(SRC_STILL);
    await window.waitForTimeout(3000);

    const after = await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const g = state.currentProject.itemGroups.find(x => x.id === 'grp-open');
      return { count: g.history.length, cards: state.currentProject.itemGroups.length };
    });
    expect(after.count, 'the import became an entry on the open card').toBe(2);
    // The half a "helpful" `media:imported` would break: it would ALSO build a
    // separate gallery card for the very same file.
    expect(after.cards, 'no second gallery card for the same file').toBe(2);

    const onDisk = JSON.parse(fs.readFileSync(path.join(folderPath, 'project.json'), 'utf8'));
    expect(onDisk.itemGroups).toHaveLength(2);
    expect(onDisk.itemGroups.find(g => g.id === 'grp-open').history).toHaveLength(2);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

test('an opener with one destination gets no toggle', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await releaseBootGate(window);

    // A Flow slot's picker: no `toHistoryLabel`, because a Flow slot has nowhere to
    // put a history entry. The control must not render at all.
    const sawToggle = await window.evaluate(async () => {
      const [{ MpiMediaPicker }, { state }] = await Promise.all([
        import('/js/components/Compounds/MpiMediaPicker/MpiMediaPicker.js'),
        import('/js/state.js'),
      ]);
      state.currentProject = { id: 'e2e-887-slot', name: 'Slot', itemGroups: [], modelSettings: {} };
      const picker = MpiMediaPicker.mount(document.createElement('div'), { mediaType: 'image' });
      picker.el.show();
      await new Promise(r => setTimeout(r, 300));
      const seen = !!document.querySelector('.mpi-media-picker__dest .mpi-btn');
      picker.el.hide();
      picker.el.destroy();
      return seen;
    });
    expect(sawToggle).toBe(false);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
