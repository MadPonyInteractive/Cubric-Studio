// MPI-1109 — an online Describe (Language Models connection) shows itself the way a cloud
// generation does: a queue job on the `cloud` lane from the click until the answer, then the
// caption in the prompt box. `/llm/describe` is stubbed so the test holds the job open.
//
// Projects live in a scratch Documents dir (APP_DOCUMENTS), never the user's.
const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

test('online Describe is a cloud-lane queue job while it runs', async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data');
  const documentsDir = testInfo.outputPath('documents');
  for (const d of [userDataDir, documentsDir]) fs.mkdirSync(d, { recursive: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.CUBRIC_E2E = '1';
  env.CUBRIC_E2E_USER_DATA = userDataDir;
  env.APP_DOCUMENTS = documentsDir;

  const app = await electron.launch({ args: ['.'], env });
  try {
    const window = await shellWindow(app);
    await window.getByRole('button', { name: /continue/i }).click();
    await window.getByRole('button', { name: /^done$/i }).click({ timeout: 8000 }).catch(() => {});

    await window.evaluate(async () => {
      const real = window.fetch.bind(window);
      window.__describeCalls = 0;
      window.fetch = (url, opts) => {
        if (String(url).includes('/llm/describe')) {
          window.__describeCalls += 1;
          return new Promise((resolve) => {
            window.__finishDescribe = () => resolve(new Response(JSON.stringify({ ok: true, text: 'a red fox in snow', model: 'probe-vl' })));
          });
        }
        return real(url, opts);
      };
      (await import('/js/services/llmService.js')).setDescribeBackendPreference('endpoint');
      const { Events } = await import('/js/events.js');
      window.__injected = null;
      Events.on('workspace:inject-prompts', (p) => { window.__injected = p.positive; });
      await (await import('/js/services/projectService.js')).createProject('Describe Probe');
      (await import('/js/utils/describeAction.js')).describeItem({ filePath: '/project-file?path=C%3A%2Fprobe.png', type: 'image' });
    });

    await expect.poll(() => window.evaluate(() => window.__describeCalls)).toBe(1);
    const running = () => window.evaluate(async () => {
      const { getGenerationQueueSnapshot } = await import('/js/services/generationService.js');
      const { generationStore } = await import('/js/services/generationStore.js');
      return {
        rows: getGenerationQueueSnapshot().runningItems.map(r => r.promptExcerpt),
        lanes: generationStore.getSnapshot().running.map(j => j.lane),
      };
    });
    expect(await running()).toEqual({ rows: ['Describe Image'], lanes: ['cloud'] });

    await window.evaluate(() => window.__finishDescribe());
    await expect.poll(() => window.evaluate(() => window.__injected)).toBe('a red fox in snow');
    await expect.poll(running).toEqual({ rows: [], lanes: [] });
  } finally {
    await app.close();
  }
});
