const fs = require('fs');
const path = require('path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');
const { getComfyPath } = require('../../routes/platformEngine');

// MPI-778: every instance on this checkout shares ONE engine root, so the engine's
// input/ and output/ are shared too. An instance that never started the engine
// (every E2E run skips the local engine gate) must leave them alone on quit, or it
// deletes what the user's live app staged for a generation still in flight.
// The engine root here is a scratch dir, so the failing direction deletes nothing real.
test('an instance that did not start the engine leaves its input/output alone on quit', async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data');
  const engineRoot = testInfo.outputPath('engine');
  fs.mkdirSync(userDataDir, { recursive: true });

  const sentinels = ['input', 'output'].map((dir) => {
    const file = path.join(getComfyPath(engineRoot, dir), 'live-app-sentinel.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'staged by another instance');
    return file;
  });

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.CUBRIC_E2E = '1';
  env.CUBRIC_E2E_USER_DATA = userDataDir;
  env.CUBRIC_ENGINE_ROOT = engineRoot;

  const app = await electron.launch({ args: ['.'], env });
  try {
    await shellWindow(app);
  } finally {
    await app.close();
  }

  for (const file of sentinels) {
    expect(fs.existsSync(file), `${file} was deleted on quit`).toBe(true);
  }
});
