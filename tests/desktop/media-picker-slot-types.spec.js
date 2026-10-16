// MPI-1161 — the prompt box's `+` opens Choose media on every type the model takes.
//
// It used to open the picker as an image slot whatever the model, so on LTX (which takes
// an audio track) the audio cards opened hidden, on MiniMax H3 references (video and
// audio too) both did, and 3D Scenes — typed `image` — always showed though no op takes
// one. Pinned here: the tiles the picker OPENS with, per model, and 3D Scenes never.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

const MODELS = ['sdxl-realistic', 'ltx-23', 'minimax-h3-ref2va'];

// Same pinning as prompt-box-voice.spec.js: the runner has no weights, and the box only
// mounts on an installed model.
async function readyApp(window) {
  await window.evaluate(async (ids) => {
    const [{ Events }, { MODELS, syncModelInstalled }] = await Promise.all([
      import('/js/events.js'),
      import('/js/data/modelRegistry.js'),
    ]);
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 300));
    for (const id of ids) {
      const model = MODELS.find(m => m.id === id);
      Object.defineProperty(model, 'installed', { get: () => true, set() {}, configurable: true });
    }
    const results = Object.fromEntries(MODELS.map(m => [m.id, { installed: false, deps: [] }]));
    const realFetch = window.fetch;
    window.fetch = (url, init) => /\/comfy\/models\/check/.test(String(url))
      ? Promise.resolve(new Response(JSON.stringify({ results }), {
          status: 200, headers: { 'Content-Type': 'application/json' } }))
      : realFetch(url, init);
    try { await syncModelInstalled(); } finally { window.fetch = realFetch; }
    await new Promise(r => setTimeout(r, 200));
  }, MODELS);
}

function group(id, type, name, item) {
  return {
    id, type, customName: name, name: id, createdAt: '2026-10-16T10:00:00Z',
    selectedIndex: 0, archived: false, favourite: false,
    history: [{ id: `${id}-1`, type, filePath: `C:/none/${id}`, pixelDimensions: { w: 640, h: 360 }, name: null, ...item }],
  };
}

/** Put the box on `modelId`, click `+`, read the tile titles the picker opens with. */
function openedTiles(window, modelId) {
  return window.evaluate(async (id) => {
    const { MODELS } = await import('/js/data/modelRegistry.js');
    document.querySelector('.mpi-prompt-box').setModel(MODELS.find(m => m.id === id));
    await new Promise(r => setTimeout(r, 200));
    const add = document.querySelector('.mpi-prompt-box-media-strip__add');
    add.click();
    await new Promise(r => setTimeout(r, 400));
    const titles = [...document.querySelectorAll('.mpi-media-picker__tile-media[title]')].map(b => b.title).sort();
    const accept = document.querySelector('.mpi-media-picker input[type="file"]')?.accept ?? null;
    document.querySelector('.mpi-media-picker__actions .mpi-btn').click();
    await new Promise(r => setTimeout(r, 200));
    return { titles, accept, label: add.getAttribute('aria-label') };
  }, modelId);
}

test('Choose media opens on every type the model takes, and never on 3D Scenes', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await readyApp(window);
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(path.join(folderPath, 'Media'), { recursive: true });
    const project = {
      id: 'e2e-1161', name: 'E2E 1161', modelSettings: {},
      itemGroups: [
        group('g-img', 'image', 'IMG'),
        group('g-vid', 'video', 'VID'),
        group('g-aud', 'audio', 'AUD'),
        group('g-scn', 'image', 'SCN', { splatPath: 'C:/none/scene.ply' }),
      ],
    };
    fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));

    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
        import('/js/state.js'),
        import('/js/router.js'),
      ]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise(r => setTimeout(r, 800));
    }, { ...project, folderPath: folderPath.replace(/\\/g, '/') });
    await expect(window.locator('.mpi-prompt-box')).toHaveCount(1, { timeout: 10000 });

    const sdxl = await openedTiles(window, 'sdxl-realistic');
    expect(sdxl.titles, 'an image model: images only, no 3D Scene').toEqual(['IMG']);
    expect(sdxl.accept).toBe('image/*');
    expect(sdxl.label).toBe('Add a reference image');

    const ltx = await openedTiles(window, 'ltx-23');
    expect(ltx.titles, 'LTX takes an audio track').toContain('AUD');
    expect(ltx.titles).not.toContain('SCN');

    const h3 = await openedTiles(window, 'minimax-h3-ref2va');
    expect(h3.titles, 'H3 references take video and audio too').toEqual(['AUD', 'IMG', 'VID']);
    expect(h3.accept).toBe('image/*,video/*,audio/*');
    expect(h3.label).toBe('Add a reference');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
