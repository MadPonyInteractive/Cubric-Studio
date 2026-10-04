// MPI-1015 — the video screen works like the image screen (Fabio's 2.0 smoke, 2026-10-04).
//
// A video card's prompt tool was a different app: no `+` card (the strip was hidden
// behind a Start/End frame panel), a model list cut to models that animate a picture
// (so MiniMax H3 Reference, installed, never showed), and a run path that dropped every
// picture that was not a start or end frame. Pinned here:
//
//  - the strip with its `+` card, and no frame panel and no Extend / New shot;
//  - reference models are offered, and on one the open clip is a pinned "Video 1" chip
//    whose tag swaps it for the frame under the playhead as a picture, and back
//    (Fabio: a clip that is ALWAYS an input is the problem; Wan bills its seconds);
//  - what the strip holds is what the run is sent;
//  - right-click "Set as start frame" still lands a start-frame chip.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(120000);

const REPO = path.resolve(__dirname, '..', '..');
// Real files: the frame grab decodes the clip and the picker's copy reads the still.
const SRC_CLIP = path.join(REPO, 'dev_configs', 'smoke-fixtures', 'smoke-probe.mp4');
const SRC_STILL = path.join(REPO, 'comfy_workflows', 'display', 'flow-head-swap.webp');

async function releaseBootGate(window) {
  await window.evaluate(async () => {
    localStorage.setItem('mpi_maturity_acknowledged', 'true');
    const { Events } = await import('/js/events.js');
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 300));
    Events.emit('ui:close-all-popups');
  });
}

// The runner has no weights, so the boot sync marks every model absent. A getter
// survives every later sync (see media-picker-to-history.spec.js for the CI history).
// Neither model declares per-op weight groups, so `installed` is the whole answer.
async function pinInstalled(window, ids) {
  await window.evaluate(async (ids) => {
    const { MODELS } = await import('/js/data/modelRegistry.js');
    for (const id of ids) {
      const model = MODELS.find(m => m.id === id);
      Object.defineProperty(model, 'installed', { get: () => true, set() {}, configurable: true });
    }
  }, ids);
}

function seedProject(folderPath) {
  const mediaDir = path.join(folderPath, 'Media');
  const metaDir = path.join(mediaDir, '.meta');
  fs.mkdirSync(metaDir, { recursive: true });
  const url = (abs) => `/project-file?path=${encodeURIComponent(abs)}`;

  const clipAbs = path.join(mediaDir, 'the_clip.mp4');
  fs.copyFileSync(SRC_CLIP, clipAbs);
  fs.writeFileSync(path.join(metaDir, 'clip-0.json'), JSON.stringify({
    id: 'clip-0', type: 'video', filePath: url(clipAbs), displayName: 'the_clip', prompt: 'a clip',
    pixelDimensions: { w: 128, h: 128 }, duration: 2,
  }, null, 2));

  const stillAbs = path.join(mediaDir, 'a_still.webp');
  fs.copyFileSync(SRC_STILL, stillAbs);
  fs.writeFileSync(path.join(metaDir, 'still-0.json'), JSON.stringify({
    id: 'still-0', type: 'image', filePath: url(stillAbs), displayName: 'a_still', prompt: 'a still',
    pixelDimensions: { w: 1920, h: 1080 },
  }, null, 2));

  const project = {
    id: 'e2e-1015',
    name: 'E2E 1015',
    modelSettings: {},
    itemGroups: [
      { id: 'grp-clip', name: 'The clip', customName: 'The clip', type: 'video', selectedIndex: 0, archived: false,
        history: [{ id: 'clip-0', type: 'video', filePath: url(clipAbs), name: null, pixelDimensions: { w: 128, h: 128 }, duration: 2 }] },
      { id: 'grp-still', name: 'A still', customName: 'A still', type: 'image', selectedIndex: 0, archived: false,
        history: [{ id: 'still-0', type: 'image', filePath: url(stillAbs), thumbPath: url(stillAbs), name: null, pixelDimensions: { w: 1920, h: 1080 } }] },
    ],
  };
  fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
  return { project };
}

/** Boot, seed, and open the clip card's history on its prompt tool. */
async function openClipPrompt(window, testInfo, models = ['minimax-h3-ref2va', 'wan-22']) {
  await releaseBootGate(window);
  await pinInstalled(window, models);
  const folderPath = testInfo.outputPath('project');
  fs.mkdirSync(folderPath, { recursive: true });
  const { project } = seedProject(folderPath);
  await window.evaluate(async (p) => {
    const [{ state }, { navigate, PAGE_GROUP_HISTORY }] = await Promise.all([
      import('/js/state.js'),
      import('/js/router.js'),
    ]);
    state.currentProject = p;
    navigate(PAGE_GROUP_HISTORY, { groupId: 'grp-clip' });
    await new Promise(r => setTimeout(r, 1000));
  }, { ...project, folderPath: folderPath.replace(/\\/g, '/') });
  await expect(window.locator('.mpi-history-tools')).toBeVisible({ timeout: 15000 });
  await window.evaluate(async () => {
    document.querySelector('.mpi-history-tools').setMode('prompt');
    await new Promise(r => setTimeout(r, 600));
  });
}

/**
 * Pick a model through the real model picker. Not `promptBox.setModel()`: the Block
 * adopts a model only on the picker's `select`, so a direct call leaves it on the old one.
 */
async function useModel(window, name) {
  const picked = await window.evaluate(async (name) => {
    const { Events } = await import('/js/events.js');
    Events.emit('ui:open-model-picker');
    await new Promise(r => setTimeout(r, 500));
    const tile = [...document.querySelectorAll('.mpi-model-picker button')].find(b => b.textContent.includes(name));
    tile?.click();
    await new Promise(r => setTimeout(r, 600));
    return !!tile;
  }, name);
  expect(picked, `${name} is in the video screen's model picker`).toBe(true);
}

/** The strip as the user sees it: each chip's kind, badge text and role pill. */
async function chips(window) {
  return window.evaluate(() => [...document.querySelectorAll('#prompt-box-mount .mpi-prompt-box-media-strip__chip')]
    .map(c => ({
      kind: c.classList.contains('mpi-prompt-box-media-strip__chip--video') ? 'video'
        : c.classList.contains('mpi-prompt-box-media-strip__chip--image') ? 'image' : 'audio',
      badge: c.querySelector('.mpi-prompt-box-media-strip__index')?.textContent.trim() || '',
      role: c.querySelector('.mpi-prompt-box-media-strip__role')?.textContent.trim() || '',
    })));
}

test('a video card has the + strip and reference models, and no frame panel or Extend', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await openClipPrompt(window, testInfo);
    const dom = await window.evaluate(() => {
      const add = document.querySelector('#prompt-box-mount .mpi-prompt-box-media-strip__add');
      const strip = document.querySelector('#prompt-box-mount .mpi-prompt-box-media-strip');
      return {
        add: !!add?.isConnected,
        stripShown: !!strip && getComputedStyle(strip).display !== 'none',
        panel: !!document.querySelector('.mpi-tool-options-prompt'),
        text: document.querySelector('.mpi-group-history-block')?.innerText || '',
      };
    });
    expect(dom.add, 'the + card is on the video screen').toBe(true);
    expect(dom.stripShown, 'the strip is visible on the video screen').toBe(true);
    expect(dom.panel, 'the Start/End frame panel is retired').toBe(false);
    expect(dom.text).not.toMatch(/New shot|Continue video/i);

    const listed = await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('ui:open-model-picker');
      await new Promise(r => setTimeout(r, 500));
      const text = document.querySelector('.mpi-model-picker')?.innerText || '';
      Events.emit('ui:close-all-popups');
      return text;
    });
    expect(listed, 'the reference model is offered on the video screen').toContain('MiniMax H3 Reference');
    expect(listed, 'a picture-animating model still is').toContain('Wan 2.2 Smooth');
  } finally {
    await closeApp(app);
  }
});

test('on a reference model the clip is Video 1, and its tag swaps it for the frame under the playhead', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await openClipPrompt(window, testInfo);
    await useModel(window, 'MiniMax H3 Reference');
    expect(await chips(window)).toEqual([{ kind: 'video', badge: 'Video 1', role: '' }]);

    await window.evaluate(async () => {
      document.querySelector('#prompt-box-mount .mpi-prompt-box-media-strip__index--toggle').click();
      await new Promise(r => setTimeout(r, 2500)); // frame decode + upload
    });
    const asFrame = await chips(window);
    expect(asFrame).toEqual([{ kind: 'image', badge: 'Picture 1', role: '' }]);
    const frameUrl = await window.evaluate(() =>
      document.querySelector('#prompt-box-mount .mpi-prompt-box-media-strip__chip img')?.getAttribute('src') || '');
    expect(frameUrl, 'the chip shows the captured frame, not the clip').toMatch(/frame/i);

    await window.evaluate(async () => {
      document.querySelector('#prompt-box-mount .mpi-prompt-box-media-strip__index--toggle').click();
      await new Promise(r => setTimeout(r, 500));
    });
    expect(await chips(window)).toEqual([{ kind: 'video', badge: 'Video 1', role: '' }]);

    // A picture-animating model takes pictures: the clip is not a chip there.
    await useModel(window, 'Wan 2.2 Smooth');
    expect(await chips(window)).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('what the strip holds is what the run is sent: the clip and a + picture', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await openClipPrompt(window, testInfo);
    await useModel(window, 'MiniMax H3 Reference');
    const picked = await window.evaluate(async () => {
      document.querySelector('#prompt-box-mount .mpi-prompt-box-media-strip__add').click();
      await new Promise(r => setTimeout(r, 500));
      const tile = [...document.querySelectorAll('.mpi-media-picker__name')]
        .find(el => el.textContent.trim() === 'A still')
        ?.closest('.mpi-media-picker__tile')
        ?.querySelector('.mpi-media-picker__tile-media');
      if (!tile) return false;
      tile.click();
      await new Promise(r => setTimeout(r, 800));
      return true;
    });
    expect(picked, 'the still is in the + overlay').toBe(true);
    expect(await chips(window)).toEqual([
      { kind: 'video', badge: 'Video 1', role: '' },
      { kind: 'image', badge: 'Picture 1', role: '' },
    ]);

    // Hold the local lane so the run waits in the queue, where its config can be read.
    const sent = await window.evaluate(async () => {
      const [{ generationStore }, { peekCueQueue, clearCueQueue }] = await Promise.all([
        import('/js/services/generationStore.js'),
        import('/js/services/generationService.js'),
      ]);
      generationStore.register({ jobId: 'hold-1015', engine: 'local' });
      const pb = document.querySelector('#prompt-box-mount .mpi-prompt-box');
      pb.injectPrompts({ positive: 'the girl waves', negative: '' });
      document.querySelector('#prompt-box-mount .mpi-prompt-box__cue-btn').click();
      await new Promise(r => setTimeout(r, 800));
      const job = peekCueQueue()[0];
      const media = (job?.config?.mediaItems || []).map(m => ({ mediaType: m.mediaType, role: m.role, url: String(m.url) }));
      clearCueQueue();
      return { op: job?.config?.operation, media };
    });
    expect(sent.op).toBe('ref2v_ms');
    expect(sent.media.map(m => [m.mediaType, m.role])).toEqual([['video', 'inputVideo'], ['image', 'inputImage']]);
    expect(sent.media[0].url).toContain('the_clip.mp4');
  } finally {
    await closeApp(app);
  }
});

test('right-click Set as start frame lands a start-frame chip on a picture-animating model', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await openClipPrompt(window, testInfo);
    await useModel(window, 'Wan 2.2 Smooth');
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('video-viewer:context-menu', { x: 400, y: 300 });
      await new Promise(r => setTimeout(r, 300));
      document.querySelector('.mpi-ctx-menu__item[data-key="set-start"]')?.click();
      await new Promise(r => setTimeout(r, 2500));
    });
    expect(await chips(window)).toEqual([{ kind: 'image', badge: '', role: 'Start frame' }]);
  } finally {
    await closeApp(app);
  }
});
