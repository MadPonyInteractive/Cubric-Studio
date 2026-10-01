// MPI-1004 — "Pick from the voice library" on Cosmo's voice card opens the Flow on its INPUTS
// with that slot's picker already in the voice library (Fabio, 2026-10-01: it used to open on
// Generate, three clicks from a voice). Through the real route: POST /connector/open-flow.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

// The runner has no weights, so its gallery opens under "No models installed" and openFlow
// refuses VIEW_BUSY (CI red on 408e03f80). Pin one model, and provoke the empty sync here so
// a dev box with weights fails the same way without the pin (docs/red-master.md, cause 1;
// the same pair as radial-menu.spec.js).
async function pinOneModelInstalled(window) {
  await window.evaluate(async () => {
    const { MODELS } = await import('/js/data/modelRegistry.js');
    const model = MODELS.find(m => m.id === 'sdxl-realistic');
    Object.defineProperty(model, 'installed', { get: () => true, set() {}, configurable: true });
  });
}
async function provokeNoWeights(window) {
  await window.evaluate(async () => {
    const { MODELS, syncModelInstalled } = await import('/js/data/modelRegistry.js');
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

test('open-flow with pickVoice lands on the inputs, the voice library showing on top', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
    });
    const folderPath = testInfo.outputPath('project').replace(/\\/g, '/');
    fs.mkdirSync(path.join(folderPath, 'Media'), { recursive: true });
    const project = { id: 'e2e-pick-voice', name: 'E2E pick voice', modelSettings: {}, itemGroups: [] };
    fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
    await pinOneModelInstalled(window);
    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([import('/js/state.js'), import('/js/router.js')]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise(r => setTimeout(r, 800));
    }, { ...project, folderPath });
    await provokeNoWeights(window);

    const res = await window.evaluate(() => fetch('/connector/open-flow', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId: 'chatter-box', fields: { positive: 'The storm is coming.' }, media: [], follow: true, pickVoice: 'audio1' }),
    }).then(r => r.json()));
    expect(res.ok, JSON.stringify(res.error)).toBe(true);
    expect(res.output.at).toBe('Inputs');

    const library = window.locator('.mpi-media-picker__voice .mpi-voice-picker');
    await expect(library).toBeVisible({ timeout: 10000 });
    await expect(window.locator('.mpi-base-flow__tick[aria-current="step"]')).toContainText('Inputs');
    // On TOP of the Flow: the point at the library's centre belongs to the library.
    const onTop = await library.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(onTop).toBe(true);
  } finally {
    await closeApp(app);
  }
});
