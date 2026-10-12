// MPI-1105 — a job entering the queue flashes the right edge in its subject colour for
// ~3 s with an "Open queue" button; nothing while the Cue panel is already open.
const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

test('queue:added flashes the right edge, Open queue opens Cue, then it goes', async ({}, testInfo) => {
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
    const flash = window.locator('.mpi-queue-flash');
    // A fresh profile shows the age gate, then What's New; both sit over the page.
    await window.getByRole('button', { name: /continue/i }).click();
    await window.getByRole('button', { name: /^done$/i }).click({ timeout: 8000 }).catch(() => {});
    await expect(flash).toHaveCount(1);
    await expect(flash).toBeHidden();

    // A CPU job is what calls it in practice: runCpuJob emits on start.
    await window.evaluate(async () => {
      const { runCpuJob } = await import('/js/services/cpuJobs.js');
      window.__flashJob = runCpuJob('Probe', () => new Promise((done) => { window.__flashDone = done; }), { mediaType: 'video' });
    });
    await expect(flash).toBeVisible();
    await expect(flash).toHaveAttribute('data-subject', 'video');
    const box = await flash.boundingBox();
    const vw = await window.evaluate(() => window.innerWidth);
    expect(Math.round(box.width)).toBe(100);
    expect(Math.round(box.x + box.width)).toBe(vw);
    // The whole strip is the button.
    const btn = await window.locator('.mpi-queue-flash__open').boundingBox();
    expect(Math.round(btn.width)).toBe(100);
    expect(Math.round(btn.height)).toBe(Math.round(box.height));
    await expect(window.locator('.mpi-queue-flash__label')).toHaveText('Queue');
    // The strip is the queue colour, not a flat grey: its gradient names the video accent.
    const bg = await window.evaluate(() => getComputedStyle(document.querySelector('.mpi-queue-flash__strip')).backgroundImage);
    expect(bg).toContain('gradient');

    // A fresh profile opens a first-run dialog whose backdrop covers the edge; dispatch past it.
    await window.locator('.mpi-queue-flash__open').dispatchEvent('click');
    await expect(flash).toBeHidden();
    await expect(window.locator('.mpi-slide-over--queue[aria-expanded="true"]')).toHaveCount(1);
    await expect(window.locator('.mpi-queue-panel__transfer--cpu')).toHaveCount(1);

    // Cue open: a new job does not flash, its row is already in view.
    await window.evaluate(() => import('/js/events.js').then(({ Events }) => Events.emit('queue:added', { mediaType: 'audio' })));
    await expect(flash).toBeHidden();

    await window.evaluate(async () => { window.__flashDone(); await window.__flashJob; });
    await window.evaluate(() => import('/js/events.js').then(({ Events }) => Events.emit('ui:close-all-popups')));
    await expect(window.locator('.mpi-slide-over--queue[aria-expanded="true"]')).toHaveCount(0);

    // Closed again: audio flashes green and leaves by itself after ~3 s.
    await window.evaluate(() => import('/js/events.js').then(({ Events }) => Events.emit('queue:added', { mediaType: 'audio' })));
    await expect(flash).toHaveAttribute('data-subject', 'audio');
    await expect(flash).toBeVisible();
    await expect(flash).toBeHidden({ timeout: 4500 });

    // Q toggles Cue on the projects page: once open, once closed (not twice per press).
    const cue = window.locator('.mpi-slide-over--queue[aria-expanded="true"]');
    // Focus off any field so Q reaches the hotkey. Never a click at a fixed y: the CI runner's
    // window is shorter than 800 px and a click outside the body waits out the test (2026-10-12).
    await window.evaluate(() => document.activeElement?.blur?.());
    await window.keyboard.press('q');
    await expect(cue).toHaveCount(1);
    await window.keyboard.press('q');
    await expect(cue).toHaveCount(0);
  } finally {
    await app.close();
  }
});
