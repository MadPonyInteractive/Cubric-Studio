// MPI-1145 — `npm start nodev` runs a source build with dev_mode off in the window AND
// the forked server (main.js passes it on as CUBRIC_DEV_MODE=off); without it, dev_mode stays on.
const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

for (const nodev of [true, false]) {
  test(`dev_mode is ${nodev ? 'off with' : 'on without'} the nodev arg`, async ({}, testInfo) => {
    const userDataDir = testInfo.outputPath('user-data');
    fs.mkdirSync(userDataDir, { recursive: true });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.CUBRIC_DEV_MODE;
    env.CUBRIC_E2E = '1';
    env.CUBRIC_E2E_USER_DATA = userDataDir;
    env.APP_DOCUMENTS = testInfo.outputPath('documents');

    const app = await electron.launch({ args: nodev ? ['.', 'nodev'] : ['.'], env });
    try {
      const window = await shellWindow(app);
      const seen = await window.evaluate(async () => {
        const { APP_CONFIG } = await import('/dev_configs/app_config.js');
        const models = await fetch('/connector/models').then(r => r.text());
        return { devMode: APP_CONFIG.dev_mode, serverHasDevModel: models.includes('flux-schnell-cloud') };
      });
      expect(seen).toEqual({ devMode: !nodev, serverHasDevModel: !nodev });
    } finally {
      await app.close();
    }
  });
}
