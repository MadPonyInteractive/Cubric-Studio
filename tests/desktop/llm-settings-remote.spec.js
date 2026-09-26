// MPI-737: the Language Models rows on Remote — every job's model dropdown reads
// the ONE shared connection list, our recommended models first as
// "(recommended) <id>", and Image descriptions lists only models that can see.
// The agent row lists its tested models first with score and cost instead (MPI-912).
//
// `/llm/connection/models` is stubbed IN-PAGE: win.route() does not reach the
// renderer's fetch in Electron (memory: tool_electron_ui_check_fixture_fetch).
// Run with a private --output dir (memory: tool_desktop_specs_private_output_dir).

const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

const MODELS = [
  { id: 'acme/agent-pick',   contextWindow: 1_048_576, vision: false, recommendedFor: ['agent'], agentTest: { passed: 23, cases: 23, runs: 3, perChat: 0.0036 } },
  { id: 'acme/zeta-chat',    contextWindow: null,      vision: false, recommendedFor: [],        agentTest: { passed: 18, cases: 23, runs: 1, perChat: 0.0017 } },
  { id: 'acme/enhance-pick', contextWindow: 131_072,   vision: false, recommendedFor: ['enhance'] },
  { id: 'acme/see-pick',     contextWindow: 327_680,   vision: true,  recommendedFor: ['describe'] },
  { id: 'acme/alpha-vision', contextWindow: null,      vision: true,  recommendedFor: [] },
];

test('Remote rows list the connection models, recommended first', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate((models) => {
      const realFetch = window.fetch.bind(window);
      // Each init pass starts with one `/llm/models` request, sent before its first await.
      window.__llmModelsCalls = 0;
      window.fetch = (url, opts) => {
        const path = String(url);
        if (path.startsWith('/llm/connection/models')) {
          return Promise.resolve({ ok: true, json: async () => ({ ok: true, profileId: 'deepinfra', models }) });
        }
        if (path.startsWith('/llm/models')) window.__llmModelsCalls++;
        return realFetch(url, opts);
      };
      localStorage.setItem('cubric.llm.backend', 'endpoint');
      localStorage.setItem('cubric.llm.describeBackend', 'endpoint');
      localStorage.removeItem('cubric.llm.endpointModel');
      localStorage.removeItem('cubric.llm.describeModel');
      localStorage.setItem('cubric.llm.enhancerModel', 'gemma-4-e4b');
    }, MODELS);

    await window.evaluate(async () => {
      const [{ Events }, { MpiRemote }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Blocks/MpiRemote/MpiRemote.js'),
      ]);
      Events.emit('slide-over:open', { title: 'Remote', component: MpiRemote });
    });
    // MPI-789 (CI run 35150684500): the panel ran TWO init passes per open. When their
    // replies crossed, the late pass rebuilt every row after this spec had opened a
    // dropdown, and the list below resolved to 0 elements. Both requests go out inside
    // the emit, so the count is final here: no wait, and no dependence on reply order.
    expect(await window.evaluate(() => window.__llmModelsCalls), 'one open must run one init pass').toBe(1);

    const label = (slot) => window.locator(`${slot} .mpi-dropdown__label`);
    const openList = window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option-label');
    const toggle = (slot) => window.evaluate((sel) => document.querySelector(sel).click(), `${slot} .mpi-dropdown__trigger`);

    // Both jobs read "Remote", and with nothing picked each shows its recommended model.
    await expect(label('#mpiSettingsLlmEnhanceBackendSlot')).toHaveText('Remote');
    await expect(label('#mpiSettingsLlmDescribeBackendSlot')).toHaveText('Remote');
    await expect(label('#mpiSettingsLlmEnhanceModelSlot')).toHaveText('(recommended) acme/enhance-pick', { timeout: 10000 });
    await expect(label('#mpiSettingsLlmDescribeModelSlot')).toHaveText('(recommended) acme/see-pick');
    // MPI-912: the agent row has no "recommended": tested models on top, best score first,
    // each with its score and cost; the pick is still the default.
    await expect(label('#mpiSettingsAgentModelSlot')).toHaveText('acme/agent-pick');
    await toggle('#mpiSettingsAgentModelSlot');
    await expect(openList).toHaveText(['acme/agent-pick', 'acme/zeta-chat', 'acme/enhance-pick', 'acme/see-pick', 'acme/alpha-vision']);
    // Score and cost sit under the name, beside the context window.
    await expect(window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option-meta')).toHaveText([
      '23/23 tests · $0.36/100 chats · 1M context', '18/23 tests · $0.17/100 chats', '128K context', '320K context',
    ]);
    await toggle('#mpiSettingsAgentModelSlot');

    // Enhancement: its recommendation first, then the rest in the endpoint's order.
    await toggle('#mpiSettingsLlmEnhanceModelSlot');
    await expect(openList).toHaveText([
      '(recommended) acme/enhance-pick', 'acme/agent-pick', 'acme/zeta-chat', 'acme/see-pick', 'acme/alpha-vision',
    ]);
    await toggle('#mpiSettingsLlmEnhanceModelSlot');

    // Image descriptions: only the models the endpoint flags as able to see.
    await toggle('#mpiSettingsLlmDescribeModelSlot');
    await expect(openList).toHaveText(['(recommended) acme/see-pick', 'acme/alpha-vision']);
    // Picking one persists to the describe pref.
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="acme/alpha-vision"]').click());
    await expect.poll(() => window.evaluate(() => localStorage.getItem('cubric.llm.describeModel'))).toBe('acme/alpha-vision');

    // A Remote enhance pick has its own key: the Ollama pick is left alone.
    await toggle('#mpiSettingsLlmEnhanceModelSlot');
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="acme/zeta-chat"]').click());
    expect(await window.evaluate(() => [localStorage.getItem('cubric.llm.endpointModel'), localStorage.getItem('cubric.llm.enhancerModel')]))
      .toEqual(['acme/zeta-chat', 'gemma-4-e4b']);

    // ComfyUI hides the describe model row: its graph loads one baked describer.
    // A fresh E2E profile may lack the Image Describer plugin, which greys the entry.
    await toggle('#mpiSettingsLlmDescribeBackendSlot');
    const comfy = window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="comfy"]');
    if (/is-disabled/.test(await comfy.getAttribute('class'))) {
      await expect(comfy).toContainText('Install the Image Describer plugin');
      await toggle('#mpiSettingsLlmDescribeBackendSlot');
    } else {
      await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="comfy"]').click());
      await expect(window.locator('#mpiSettingsLlmDescribeModelGroup')).toBeHidden();
    }

    // The agent has one backend, so it is a fixed label, not a dropdown.
    await expect(window.locator('#mpiSettingsAgentBackend')).toHaveText('Remote · DeepInfra');
    await expect(window.locator('#mpiSettingsAgentBackend .mpi-dropdown')).toHaveCount(0);

    // Ollama's /v1 needs no key, so the key field goes away with it.
    await expect(window.locator('#mpiSettingsConnKeyGroup')).toBeVisible();
    await toggle('#mpiSettingsConnProfileSlot');
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="ollama"]').click());
    await expect(window.locator('#mpiSettingsConnKeyGroup')).toBeHidden();
    await expect(window.locator('#mpiSettingsAgentBackend')).toHaveText('Remote · Ollama (local)');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
