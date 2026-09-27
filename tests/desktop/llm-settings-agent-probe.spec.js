// MPI-905: the agent's floor moved to 64K (OLLAMA_AGENT_CONTEXT), and "Test tool use"
// (MpiLlmSettings#_renderAgentProbe) grew a `contextWindow` warning to match — a probed
// model under 64K forgets early turns sooner than the agent's own local floor allows.
//
// `/agent/probe` is stubbed IN-PAGE: win.route() does not reach the renderer's fetch in
// Electron (memory: tool_electron_ui_check_fixture_fetch). `/llm/connection/models` is
// stubbed too so the row above never depends on real network.

const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test('Test tool use warns under 64K context, not at or above it', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    // A fresh profile boots straight into the 18+ gate (js/shell.js
    // _maybeShowMaturityWarning), a real modal whose backdrop covers the whole
    // window, chained into the changelog on Continue — dismiss both before
    // touching anything else.
    try {
      await window.locator('.mpi-ok-cancel__actions .mpi-btn', { hasText: 'Continue' }).click({ timeout: 5000 });
    } catch { /* already acknowledged in this profile */ }
    try {
      await window.locator('.mpi-changelog__actions .mpi-btn', { hasText: 'Done' }).click({ timeout: 5000 });
    } catch { /* nothing new to announce in this profile */ }

    await window.evaluate(() => {
      const realFetch = window.fetch.bind(window);
      window.__probeContextWindow = 32768;
      window.fetch = (url, opts) => {
        const path = String(url);
        if (path.startsWith('/llm/connection/models')) {
          return Promise.resolve({ ok: true, json: async () => ({ ok: true, profileId: 'deepinfra', models: [] }) });
        }
        if (path.startsWith('/agent/probe')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              tools: true,
              model: 'acme/agent-pick',
              latencyMs: 5,
              message: 'Connected. Model called a tool in 5 ms.',
              contextWindow: window.__probeContextWindow,
            }),
          });
        }
        return realFetch(url, opts);
      };
    });

    await window.evaluate(async () => {
      const [{ Events }, { MpiRemote }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Blocks/MpiRemote/MpiRemote.js'),
      ]);
      Events.emit('slide-over:open', { title: 'Remote', component: MpiRemote });
    });

    const probeButton = window.locator('#mpiSettingsAgentProbeSlot .mpi-btn', { hasText: 'Test tool use' });
    const result = window.locator('#mpiSettingsAgentProbeResult');
    await expect(probeButton).toBeVisible({ timeout: 10000 });

    // Under 64K: the window label shows, and the warning is appended and colored.
    await probeButton.click();
    await expect(result).toContainText('32K context', { timeout: 10000 });
    await expect(result).toContainText('Under 64K context: long chats will forget early turns sooner. Pick a model with 64K or more.');
    await expect(result).toHaveClass(/mpi-settings__hint--warn/);

    // At or above 64K: no warning, and the warn color is cleared.
    await window.evaluate(() => { window.__probeContextWindow = 131072; });
    await probeButton.click();
    await expect(result).toContainText('128K context', { timeout: 10000 });
    await expect(result).not.toContainText('Under 64K context');
    await expect(result).not.toHaveClass(/mpi-settings__hint--warn/);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
