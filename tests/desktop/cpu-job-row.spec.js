// MPI-1104 — a CPU job is a row in the queue panel's Transfers list: the moving sweep
// while it has no real %, a plain bar once it reports one, gone when it ends.
const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

test('a CPU job shows in Transfers with the sweep, then leaves', async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data');
  fs.mkdirSync(userDataDir, { recursive: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.CUBRIC_E2E = '1';
  env.CUBRIC_E2E_USER_DATA = userDataDir;
  env.APP_DOCUMENTS = testInfo.outputPath('documents');  // never the user's projects

  const app = await electron.launch({ args: ['.'], env });
  try {
    const window = await shellWindow(app);
    await window.evaluate(async () => {
      const { MpiQueuePanel } = await import('/js/components/Compounds/MpiQueuePanel/MpiQueuePanel.js');
      const { runCpuJob } = await import('/js/services/cpuJobs.js');
      const host = document.createElement('div');
      host.id = 'cpu-job-host';
      document.body.appendChild(host);
      MpiQueuePanel.mount(host, {});
      window.__cpuJob = new Promise((resolve) => {
        runCpuJob('Copying 3 files', (setProgress) => new Promise((done) => {
          window.__cpuProgress = setProgress;
          window.__cpuDone = done;
        })).then(resolve);
      });
    });

    const row = window.locator('#cpu-job-host .mpi-queue-panel__transfer--cpu');
    await expect(row).toHaveCount(1);
    await expect(row.locator('.mpi-queue-panel__transfer-name')).toHaveText('Copying 3 files');
    await expect(row.locator('.mpi-queue-panel__transfer-meta')).toHaveText('Working');
    await expect(row.locator('.mpi-progress')).toHaveClass(/mpi-progress--loading/);
    await expect(row.locator('.mpi-queue-panel__transfer-cancel')).toHaveCount(0);

    await window.evaluate(() => window.__cpuProgress(0.4));
    await expect(row.locator('.mpi-queue-panel__transfer-meta')).toHaveText('40%');
    await expect(row.locator('.mpi-progress')).not.toHaveClass(/mpi-progress--loading/);

    await window.evaluate(async () => { window.__cpuDone(); await window.__cpuJob; });
    await expect(row).toHaveCount(0);
    await expect(window.locator('#cpu-job-host .mpi-queue-panel__transfers')).toBeHidden();

    // A download whose bytes are all in and is now verifying (MPI-140): the sweep and
    // "verifying", never a still full bar carrying the last speed (MPI-623 report).
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.downloadJobs = [{ modelId: 'verify-probe', status: 'downloading', progress: 1, speed: '97.5 MB/s', indeterminate: true, phase: 'verifying' }];
    });
    const dl = window.locator('#cpu-job-host .mpi-queue-panel__transfer--download');
    await expect(dl.locator('.mpi-queue-panel__transfer-meta')).toHaveText('Download · verifying');
    await expect(dl.locator('.mpi-progress')).toHaveClass(/mpi-progress--loading/);
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.downloadJobs = [{ modelId: 'verify-probe', status: 'downloading', progress: 0.5, speed: '10 MB/s', indeterminate: false }];
    });
    await expect(dl.locator('.mpi-queue-panel__transfer-meta')).toHaveText('Download · 50% · 10 MB/s');
    await expect(dl.locator('.mpi-progress')).not.toHaveClass(/mpi-progress--loading/);
  } finally {
    await app.close();
  }
});
