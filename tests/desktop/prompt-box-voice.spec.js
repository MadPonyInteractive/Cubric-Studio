// MPI-1012 — Text to Speech is a prompt-box model now, and its one input is a VOICE.
//
// Pinned on the gallery box:
//  - on `tts` the `+` card says "Add a voice" and opens the picker on audio, with the voice
//    library and the mic card (the gallery hands the recorder down as a prop);
//  - `tts` stays dim, with its reason, until a voice is staged, and lights up once one is;
//  - Sound & Music takes nothing at all, so the `+` card is absent there, and it comes back
//    on an image model as "Add a reference image".
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

// Electron boot (splash -> local server -> shell) runs past the 30s default.
test.setTimeout(90000);

// The runner has no weights, so the boot sync writes every `installed` flag false, and the
// PromptBox only mounts on an installed model (docs/testing-desktop-specs.md trap 5). Pin two
// (a getter survives the sync's re-write): SDXL for the box to mount on, Chatterbox for the
// agent hand-over, which only switches to a model the gallery lists as installed. Then PROVOKE
// the runner's condition so a missing pin fails here, not only in CI. Same shape as
// media-picker-to-history.spec.js.
async function readyApp(window) {
  await window.evaluate(async () => {
    const [{ Events }, { MODELS, syncModelInstalled }] = await Promise.all([
      import('/js/events.js'),
      import('/js/data/modelRegistry.js'),
    ]);
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 300));
    for (const id of ['sdxl-realistic', 'chatterbox']) {
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
  });
}

/** Put the mounted box on `modelId` and read the `+` card and the tts chip back. */
function onModel(window, modelId) {
  return window.evaluate(async (id) => {
    const { MODELS } = await import('/js/data/modelRegistry.js');
    document.querySelector('.mpi-prompt-box').setModel(MODELS.find(m => m.id === id));
    await new Promise(r => setTimeout(r, 200));
    const add = document.querySelector('.mpi-prompt-box-media-strip__add');
    const tts = document.querySelector('.mpi-radio-group__btn[data-value="tts"]');
    return {
      add: add ? add.getAttribute('aria-label') : null,
      ttsDim: tts ? tts.getAttribute('aria-disabled') === 'true' : null,
      ttsInfo: tts ? tts.dataset.info : null,
    };
  }, modelId);
}

test('Text to Speech: the + adds a voice and the op waits for one; Sound & Music has no +', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await readyApp(window);
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(path.join(folderPath, 'Media'), { recursive: true });
    const project = { id: 'e2e-1012', name: 'E2E 1012', modelSettings: {}, itemGroups: [] };
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

    const tts = await onModel(window, 'chatterbox');
    expect(tts.add).toBe('Add a voice');
    expect(tts.ttsDim, 'no voice staged: the op is dim').toBe(true);
    expect(tts.ttsInfo).toContain('needs a voice');

    const picker = await window.evaluate(async () => {
      document.querySelector('.mpi-prompt-box-media-strip__add').click();
      await new Promise(r => setTimeout(r, 400));
      const seen = {
        audio: !!document.querySelector('.mpi-media-picker[data-accent="audio"]'),
        mic: !!document.querySelector('.mpi-media-picker__tile--mic'),
        voice: !!document.querySelector('.mpi-media-picker__tile--voice'),
      };
      document.querySelector('.mpi-media-picker__actions .mpi-btn').click();
      await new Promise(r => setTimeout(r, 200));
      return seen;
    });
    expect(picker, 'the + opens on audio with the library and the mic').toEqual({ audio: true, mic: true, voice: true });

    const voiced = await window.evaluate(async () => {
      document.querySelector('.mpi-prompt-box').injectMedia({ url: '/project-file?path=C%3A%2Fvoice.wav', mediaType: 'audio', name: 'voice.wav' });
      await new Promise(r => setTimeout(r, 200));
      return document.querySelector('.mpi-radio-group__btn[data-value="tts"]').getAttribute('aria-disabled') === 'true';
    });
    expect(voiced, 'a staged voice lights the op up').toBe(false);

    expect((await onModel(window, 'stable-audio-3')).add, 'Sound & Music takes nothing, so no + card').toBe(null);
    expect((await onModel(window, 'sdxl-realistic')).add).toBe('Add a reference image');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

// The agent's voice card, "Pick from the voice library" on Text to Speech: agentDispatch's
// `prompt.open` leaves `state.s_promptOpen` and navigates, because navigation is async and an
// event would reach no gallery yet. The gallery takes it on MOUNT: the box on Chatterbox/tts,
// the line in it, the picker open in the library. Nothing runs.
test('the agent hand-over opens the gallery box on Text to Speech, line filled, voice library open', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await readyApp(window);
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(path.join(folderPath, 'Media'), { recursive: true });
    const project = { id: 'e2e-1012b', name: 'E2E 1012b', modelSettings: {}, itemGroups: [] };
    fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));

    const seen = await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
        import('/js/state.js'),
        import('/js/router.js'),
      ]);
      state.currentProject = p;
      state.s_promptOpen = { modelId: 'chatterbox', operation: 'tts', prompt: 'The storm is coming.', controls: null, pickVoice: true };
      navigate(PAGE_GALLERY);
      await new Promise(r => setTimeout(r, 1500));
      return {
        taken: state.s_promptOpen === null,
        tts: !!document.querySelector('.mpi-radio-group__btn.is-active[data-value="tts"]'),
        line: document.querySelector('.mpi-prompt-box textarea')?.value ?? null,
        library: !!document.querySelector('.mpi-media-picker__voice'),
      };
    }, { ...project, folderPath: folderPath.replace(/\\/g, '/') });

    expect(seen.taken, 'the gallery took the hand-over').toBe(true);
    expect(seen.tts, 'the box is on Text to Speech').toBe(true);
    expect(seen.line).toBe('The storm is coming.');
    expect(seen.library, 'the picker opened in the voice library').toBe(true);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
