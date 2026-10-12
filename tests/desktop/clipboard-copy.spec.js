const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-1071 — every Copy button is `navigator.clipboard.writeText`, and main.js's
 * permission handler refused it (`clipboard-sanitized-write`) from 2.0.0: Settings' MCP
 * link and the Transcribe result both failed with only a log line. Only a real renderer
 * under main.js's own session handler can catch that, so this writes from the window and
 * reads it back from the main process. The user's clipboard is put back afterwards.
 */
test.setTimeout(60000);

test('the renderer may write text to the clipboard', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  const before = await app.evaluate(({ clipboard }) => clipboard.readText());

  try {
    const marker = `cubric-copy-${Date.now()}`;
    await window.bringToFront();
    const err = await window.evaluate((t) => navigator.clipboard.writeText(t)
      .then(() => null, (e) => String(e?.message || e)), marker);
    expect(err, 'writeText was refused').toBeNull();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(marker);
  } finally {
    await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), before);
    await closeApp(app);
  }
});
