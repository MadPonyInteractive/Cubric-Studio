// MPI-904 (MPI-941 Phase 3) — the agent's image tools run with NO model.
//
// `POST /connector/generate { operation, fields, media }` with no modelId goes through the real
// route, the real job stream and the real renderer submit (`agentDispatch._submitTool`), and
// must reach the Cue queue as the History rail's own universal op: same op, same params, the
// source card as its destination.
//
// SAFETY: an isolated app shares Fabio's ComfyUI. Before any job can dispatch, every fetch but
// the connector's own is made to hang, so the first job blocks the lane on its first engine
// call and never reaches the engine; the jobs behind it stay PENDING, where their config reads.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

const STILL = path.join(__dirname, '..', '..', 'comfy_workflows', 'display', 'boogu-edit-balanced.webp');

test('a tool call with no modelId queues the rail\'s universal op on the source card', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
    });

    const folderPath = testInfo.outputPath('project').replace(/\\/g, '/');
    fs.mkdirSync(path.join(folderPath, 'Media'), { recursive: true });
    const src = `${folderPath}/Media/src.webp`;
    fs.copyFileSync(STILL, src);
    const url = `/project-file?path=${encodeURIComponent(src)}`;
    const project = {
      id: 'e2e-tool-ops', name: 'E2E tool ops', modelSettings: {},
      itemGroups: [{ id: 'card-1', type: 'image', name: 'card-1', selectedIndex: 0,
        history: [{ id: 'card-1-item', type: 'image', filePath: url }] }],
    };
    fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([import('/js/state.js'), import('/js/router.js')]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise(r => setTimeout(r, 800));
    }, { ...project, folderPath });

    const media = [{ role: 'inputImage', url }];
    const post = (body) => window.evaluate((b) => fetch('/connector/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
    }).then(r => r.json()), body);

    // Refused in the renderer before anything queues: the crop read the picture, then the ratio.
    const badRatio = await post({ operation: 'crop', fields: { ratio: '7:3' }, media });
    expect(badRatio.error?.code).toBe('INVALID_FIELD');
    const noPicture = await post({ operation: 'imageUpscale', fields: {} });
    expect(noPicture.error?.code).toBe('MEDIA_REQUIRED');

    const natural = await window.evaluate((u) => new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
      im.src = u;
    }), url);

    // From here nothing but the connector gets an answer, so nothing reaches the engine.
    await window.evaluate(() => {
      const orig = window.fetch.bind(window);
      window.fetch = (...args) => (String(args[0] || '').startsWith('/connector/') ? orig(...args) : new Promise(() => {}));
    });
    // Not awaited: the route holds its reply until the job ends, and these never end.
    for (const body of [
      { operation: 'imageUpscale', fields: { upscaler: '4x-AnimeSharp' }, media }, // takes the lane and hangs
      { operation: 'imageUpscale', fields: { upscaler: '4x-AnimeSharp', factor: 3 }, media },
      { operation: 'crop', fields: { ratio: '1:1', position: 'top' }, media },
    ]) {
      await window.evaluate((b) => { fetch('/connector/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); }, body);
      await window.waitForTimeout(400);
    }
    const pending = await window.evaluate(async () => {
      const { peekCueQueue } = await import('/js/services/generationService.js');
      for (let i = 0; i < 50 && peekCueQueue().length < 2; i += 1) await new Promise(r => setTimeout(r, 100));
      return peekCueQueue().map(j => ({
        operation: j.config.operation, modelId: j.config.model?.id ?? null, byAgent: j.config.byAgent,
        injectionParams: j.config.injectionParams, role: j.config.mediaItems?.[0]?.role,
        scope: j.opts.scope, groupId: j.opts.groupId,
      }));
    });

    expect(pending).toHaveLength(2);
    const [upscale, crop] = pending;
    expect(upscale).toEqual({
      operation: 'imageUpscale', modelId: null, byAgent: true, role: 'inputImage',
      injectionParams: { Upscale_Factor: 3, Upscale_Using_Model: true, Upscale_Model: '4x-AnimeSharp.pth' },
      scope: 'groupHistory', groupId: 'card-1',
    });
    const side = Math.floor(Math.min(natural.w, natural.h) / 2) * 2;
    expect(crop).toMatchObject({ operation: 'resize', modelId: null, scope: 'groupHistory', groupId: 'card-1' });
    expect(crop.injectionParams).toMatchObject({ width: side, height: side, keep_proportion: 'crop', crop_position: 'top' });
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
