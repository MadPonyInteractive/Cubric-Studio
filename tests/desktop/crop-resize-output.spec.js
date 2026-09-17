const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-795 / MPI-796 — the size a crop or a resize actually produces.
 *
 * MPI-795: a RESOLUTION crop wrote the box's own pixels instead of the typed
 * W x H when a dimension was left at the value the panel displayed. The saved
 * crop entry is partial and Apply read it bare. It also sent a stale size when
 * Apply came straight after an edit, inside the save debounce. Both paths run
 * here against a real file on disk, and the written file is measured.
 *
 * MPI-796: Resize's MP and SCALE types derive width/height from the source.
 * Applying needs the engine, so this reads the params Apply would send.
 */
test.setTimeout(90000);

const SRC_W = 400;
const SRC_H = 300;

async function makeProject(testInfo) {
  const folder = testInfo.outputPath('project');
  const media = path.join(folder, 'Media');
  fs.mkdirSync(media, { recursive: true });
  const src = path.join(media, 'src.png');
  const png = await sharp({ create: { width: SRC_W, height: SRC_H, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .png().toBuffer();
  fs.writeFileSync(src, png);

  const now = new Date().toISOString();
  const group = { id: 'gDims', type: 'image', selectedIndex: 0 };
  const project = {
    id: 'pDims', name: 'Dims', folderPath: folder, createdAt: now, updatedAt: now, toolSettings: {},
    itemGroups: [{
      ...group,
      history: [{
        id: 'iDims', type: 'image', displayName: 'src',
        filePath: `/project-file?path=${encodeURIComponent(src)}`,
        pixelDimensions: { w: SRC_W, h: SRC_H },
      }],
    }],
  };
  // On disk a group lists history ids; the settings save and the crop append write here.
  fs.writeFileSync(path.join(folder, 'project.json'),
    JSON.stringify({ ...project, itemGroups: [{ ...group, history: ['iDims'] }] }, null, 2));
  return { media, project };
}

async function openGroup(window, project) {
  await window.evaluate(async (p) => {
    const { state } = await import('/js/state.js');
    state.currentProject = p;
    const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
    navigate(PAGE_GROUP_HISTORY, { groupId: p.itemGroups[0].id });
  }, project);
  await expect(window.locator('.mpi-history-tools')).toBeVisible();
}

async function setTool(window, mode, panelSelector) {
  await window.evaluate((m) => document.querySelector('.mpi-history-tools').setMode(m), mode);
  const panel = window.locator(panelSelector);
  await expect(panel).toBeVisible();
  // PROMPT mode shows a preview surface with no canvas behind it; the canvas
  // (and the source image a tool reads) exists again once another tool is up.
  await expect.poll(() => window.evaluate(() =>
    document.querySelector('.mpi-canvas-viewer').getSourceElement()?.naturalWidth ?? 0,
  )).toBe(SRC_W);
  return panel;
}

/** Wait for the next PNG the app writes into Media/ and return its size. */
async function nextOutputSize(media, seen) {
  let file = null;
  await expect.poll(() => {
    file = fs.readdirSync(media).find(f => f.endsWith('.png') && !seen.has(f)) ?? null;
    return file;
  }, { timeout: 15000 }).not.toBeNull();
  seen.add(file);
  // Read through a buffer: sharp keeps file handles open, which fails the output-dir cleanup.
  let size = null;
  await expect.poll(async () => {
    size = await sharp(fs.readFileSync(path.join(media, file))).metadata()
      .then(({ width, height }) => ({ width, height }))
      .catch(() => null);
    return size;
  }).not.toBeNull();
  return size;
}

test('a RESOLUTION crop writes the typed size, whatever the box covers', async ({}, testInfo) => {
  const { media, project } = await makeProject(testInfo);
  const seen = new Set(['src.png']);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await openGroup(window, project);
    const panel = await setTool(window, 'crop', '.mpi-tool-options-crop');
    const apply = panel.getByRole('button', { name: 'Apply' });
    await panel.locator('.mpi-tool-options-crop__family').getByText('RESOLUTION', { exact: true }).click();

    // Width typed. Height stays at the 1080 the panel shows and is never touched,
    // so the saved entry has no res_h at all.
    const width = panel.locator('#res-w-slot input');
    await width.fill('200');
    await width.press('Enter');
    // The user resizes the box: it no longer covers 200 x 1080.
    await window.evaluate(() => document.querySelector('.mpi-canvas-viewer').setCropSize(100, 540));
    await window.waitForTimeout(1000); // every settings save has landed
    await apply.click();
    expect(await nextOutputSize(media, seen)).toEqual({ width: 200, height: 1080 });

    // Height saved as 150, then edited to 120 and applied straight from the field.
    // The saved copy still says 150 at that moment.
    const height = panel.locator('#res-h-slot input');
    await height.fill('150');
    await height.press('Enter');
    await window.waitForTimeout(1000);
    await height.fill('120');
    await apply.click();
    expect(await nextOutputSize(media, seen)).toEqual({ width: 200, height: 120 });

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('Resize MP and SCALE derive the size from the source and keep its proportions', async ({}, testInfo) => {
  const { project } = await makeProject(testInfo);
  const { app, window } = await launchApp(testInfo);
  try {
    await openGroup(window, project);
    const panel = await setTool(window, 'resize', '.mpi-tool-options-resize');
    const family = (label) => panel.locator('#resize-family-slot').getByText(label, { exact: true }).click();
    const sent = () => window.evaluate(() => {
      const { width, height } = document.querySelector('.mpi-tool-options-resize').getParams();
      return { width, height };
    });
    const shown = async () => ({
      width: Number(await panel.locator('#resize-derived-width-slot input').inputValue()),
      height: Number(await panel.locator('#resize-derived-height-slot input').inputValue()),
    });

    await family('SCALE');
    await expect(panel.locator('#resize-derived-pair')).toBeVisible();
    await expect(panel.locator('#resize-free-pair')).toBeHidden();
    await expect.poll(sent).toEqual({ width: 200, height: 150 }); // default ÷2
    await panel.locator('#resize-scale-slot').getByText('÷4', { exact: true }).click();
    await expect.poll(sent).toEqual({ width: 100, height: 75 });
    expect(await shown()).toEqual({ width: 100, height: 75 });

    await family('MP');
    await expect(panel.locator('#resize-scale-slot')).toBeHidden();
    const mp = panel.locator('#resize-megapixels-slot input');
    await mp.fill('0.25');
    await mp.press('Enter');
    const k = Math.sqrt((0.25 * 1024 * 1024) / (SRC_W * SRC_H));
    const want = { width: Math.round(SRC_W * k), height: Math.round(SRC_H * k) };
    await expect.poll(sent).toEqual(want);
    expect(await shown()).toEqual(want);

    // Back to FREE: its inputs show the size Apply will send, not a stale one.
    await family('FREE');
    await expect(panel.locator('#resize-derived-pair')).toBeHidden();
    expect(Number(await panel.locator('#resize-width-slot input').inputValue())).toBe(want.width);
    expect(Number(await panel.locator('#resize-height-slot input').inputValue())).toBe(want.height);
  } finally {
    await closeApp(app);
  }
});
