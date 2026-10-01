// MPI-1004 — "Pick from the voice library" on Cosmo's voice card opens the Flow on its INPUTS
// with that slot's picker already in the voice library (Fabio, 2026-10-01: it used to open on
// Generate, three clicks from a voice). Through the real route: POST /connector/open-flow.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

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
    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([import('/js/state.js'), import('/js/router.js')]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise(r => setTimeout(r, 800));
    }, { ...project, folderPath });

    const res = await window.evaluate(() => fetch('/connector/open-flow', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId: 'chatter-box', fields: { positive: 'The storm is coming.' }, media: [], follow: true, pickVoice: 'audio1' }),
    }).then(r => r.json()));
    expect(res.ok).toBe(true);
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
