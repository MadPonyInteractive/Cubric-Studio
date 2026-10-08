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
  // `suiteHash` 'h1' = the stubbed GET /agent/benchmark's current tests; zeta-chat's score has none, so it is older.
  // MPI-965: `communityTest` = the median of everyone's shared runs on the current tests. agent-pick has ours AND the
  // community's (ours wins: the third tier only fills in where nothing better exists), community-pick has only the
  // community's (it joins the scored group), omega-chat has an OLDER score of ours and a current community one (the community wins).
  { id: 'acme/agent-pick',   contextWindow: 1_048_576, vision: false, recommendedFor: ['agent'], agentTest: { passed: 23, cases: 23, runs: 3, perChat: 0.0036, suiteHash: 'h1' }, communityTest: { passed: 20, cases: 28, runs: 9, perChat: 0.004, suiteHash: 'h1' } },
  { id: 'acme/zeta-chat',    contextWindow: null,      vision: false, recommendedFor: [],        agentTest: { passed: 18, cases: 23, runs: 1, perChat: 0.0017 } },
  { id: 'acme/community-pick', contextWindow: 65_536, vision: false, recommendedFor: [],        communityTest: { passed: 26, cases: 28, runs: 3, perChat: 0.002, suiteHash: 'h1' } },
  { id: 'acme/omega-chat',   contextWindow: null,      vision: false, recommendedFor: [],        agentTest: { passed: 10, cases: 23, runs: 1, perChat: 0.0009 }, communityTest: { passed: 24, cases: 28, runs: 5, perChat: 0.0012, suiteHash: 'h1' } },
  { id: 'acme/enhance-pick', contextWindow: 131_072,   vision: false, recommendedFor: ['enhance'] },
  { id: 'acme/see-pick',     contextWindow: 327_680,   vision: true,  recommendedFor: ['describe'] },
  { id: 'acme/alpha-vision', contextWindow: null,      vision: true,  recommendedFor: [] },
  // MPI-941 Phase 11: Ollama says this one cannot call tools, so the agent row hides it.
  { id: 'acme/no-tools',     contextWindow: null,      vision: false, tools: false, recommendedFor: [] },
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
        // Its live price read is the network's; nothing here is about the benchmark.
        if (path.startsWith('/agent/benchmark')) {
          return Promise.resolve({ ok: true, json: async () => ({ ok: true, cases: 28, suiteHash: 'h1', local: false, usd: 0.1, running: null }) });
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
    // MPI-965: scores on the current tests first, best first: ours, then the two only the community has scored; the
    // model whose only score is older comes after them.
    await expect(openList).toHaveText(['acme/agent-pick', 'acme/community-pick', 'acme/omega-chat', 'acme/zeta-chat', 'acme/enhance-pick', 'acme/see-pick', 'acme/alpha-vision']);
    // Score and cost sit under the name, beside the context window; a score from older tests says so, and the
    // community's says how many runs stand behind it. Ours beats the community's where both exist (agent-pick).
    await expect(window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option-meta')).toHaveText([
      '23/23 tests · $0.36/100 chats · 1M context',
      '26/28 tests (community, 3 runs) · $0.20/100 chats · 64K context',
      '24/28 tests (community, 5 runs) · $0.12/100 chats',
      '18/23 tests (older tests) · $0.17/100 chats',
      '128K context', '320K context',
    ]);
    await toggle('#mpiSettingsAgentModelSlot');

    // Enhancement: its recommendation first, then the rest in the endpoint's order.
    await toggle('#mpiSettingsLlmEnhanceModelSlot');
    await expect(openList).toHaveText([
      '(recommended) acme/enhance-pick', 'acme/agent-pick', 'acme/zeta-chat', 'acme/community-pick', 'acme/omega-chat', 'acme/see-pick', 'acme/alpha-vision', 'acme/no-tools',
    ]);
    await toggle('#mpiSettingsLlmEnhanceModelSlot');

    // Image descriptions: only the models the endpoint flags as able to see.
    await toggle('#mpiSettingsLlmDescribeModelSlot');
    await expect(openList).toHaveText(['(recommended) acme/see-pick', 'acme/alpha-vision']);
    // Picking one persists to the describe pref.
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="acme/alpha-vision"]').click());
    // MPI-941 Phase 11: each Remote pick is kept per connection, `{ [profileId]: id }`.
    await expect.poll(() => window.evaluate(() => localStorage.getItem('cubric.llm.describeModel'))).toBe('{"deepinfra":"acme/alpha-vision"}');

    // A Remote enhance pick has its own key: the Ollama pick is left alone.
    await toggle('#mpiSettingsLlmEnhanceModelSlot');
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="acme/zeta-chat"]').click());
    expect(await window.evaluate(() => [localStorage.getItem('cubric.llm.endpointModel'), localStorage.getItem('cubric.llm.enhancerModel')]))
      .toEqual(['{"deepinfra":"acme/zeta-chat"}', 'gemma-4-e4b']);

    // ComfyUI hides the describe model row: its graph loads one baked describer.
    // Never greyed, even on a fresh profile: its encoder installs with the engine (MPI-1045).
    await toggle('#mpiSettingsLlmDescribeBackendSlot');
    const comfy = window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="comfy"]');
    await expect(comfy).not.toHaveClass(/is-disabled/);
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="comfy"]').click());
    await expect(window.locator('#mpiSettingsLlmDescribeModelGroup')).toBeHidden();

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

// MPI-941 Phase 12: "Benchmark this model". The route is stubbed and its stream events are
// emitted on the bus, as agentService's SSE bridge would; the suite itself is unit-tested
// (tests/agent-bench.test.cjs).
test('Benchmark this model: estimate in place, progress and Stop, the score on the agent row', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate((models) => {
      const realFetch = window.fetch.bind(window);
      window.__benchPosts = [];
      const reply = (body) => Promise.resolve({ ok: true, json: async () => body });
      window.fetch = (url, opts) => {
        const path = String(url);
        if (path.startsWith('/llm/connection/models')) return reply({ ok: true, profileId: 'deepinfra', models });
        if (path.startsWith('/agent/benchmark')) {
          if (opts?.method === 'POST') {
            window.__benchPosts.push([path, JSON.parse(opts.body)]);
            return reply(path.endsWith('/stop') ? { ok: true } : { ok: true, cases: 28 });
          }
          // MPI-965: the server says whether the Share tickbox shows (never for Custom) and where the public page is.
          return reply({ ok: true, cases: 28, suiteHash: 'h1', local: false, usd: 0.1, running: null, canShare: !/profileId=custom/.test(path), communityUrl: 'https://bench.example' });
        }
        return realFetch(url, opts);
      };
      // The public page opens in the user's browser through the main process: record it instead.
      window.__opened = [];
      const { ipcRenderer } = require('electron');
      const invoke = ipcRenderer.invoke.bind(ipcRenderer);
      ipcRenderer.invoke = (channel, ...args) => (channel === 'open-external' ? (window.__opened.push(args[0]), Promise.resolve(true)) : invoke(channel, ...args));
      localStorage.removeItem('mpi_agent_prefs');
      localStorage.removeItem('mpi_agent_bench_share');
      // A score from an OLDER suite (another hash) says so.
      localStorage.setItem('mpi_agent_bench', JSON.stringify({ deepinfra: { 'acme/zeta-chat': { passed: 20, cases: 26, perChat: 0.002, suiteHash: 'old', at: '2026-09-01T00:00:00Z' } } }));
    }, MODELS);

    await window.evaluate(async () => {
      const [{ Events }, { MpiRemote }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Blocks/MpiRemote/MpiRemote.js'),
      ]);
      Events.emit('slide-over:open', { title: 'Remote', component: MpiRemote });
    });

    const bench = window.locator('#mpiSettingsAgentBenchSlot .mpi-btn');
    const line = window.locator('#mpiSettingsAgentBenchLine');
    const emit = (name, data) => window.evaluate(async ([n, d]) => (await import('/js/events.js')).Events.emit(n, d), [name, data]);
    // A DOM click, as above: the fresh profile's 18+ notice covers the panel.
    const click = (sel) => window.evaluate((s) => document.querySelector(s).click(), sel);
    const clickBench = () => click('#mpiSettingsAgentBenchSlot .mpi-btn');

    await expect(window.locator('#mpiSettingsAgentBenchHint')).toHaveText('Runs our 28 agent tests on this model with pretend tools: nothing is generated or added to your projects.', { timeout: 10000 });
    await expect(bench).toHaveText('Benchmark this model');
    // MPI-965: the public page, under the hint, opens in the user's browser.
    const link = window.locator('#mpiSettingsAgentBenchLinkSlot .mpi-btn');
    await expect(link).toHaveText('See everyone\'s results');
    await click('#mpiSettingsAgentBenchLinkSlot .mpi-btn');
    expect(await window.evaluate(() => window.__opened)).toEqual(['https://bench.example/']);
    // The Share tickbox belongs to the confirm step: not on screen before it.
    const shareSlot = window.locator('#mpiSettingsAgentBenchShareSlot');
    const shareInput = window.locator('#mpiSettingsAgentBenchShareSlot .mpi-checkbox__input');
    await expect(shareSlot).toBeHidden();
    // The confirm sits in place of the button, with the estimate: Cancel puts the button back.
    await clickBench();
    await expect(line).toHaveText('About $0.10 on DeepInfra, ~14 min.');
    await expect(bench).toHaveText('Run');
    // MPI-965: the tickbox and what it sends; unticked the first time.
    await expect(shareSlot).toBeVisible();
    await expect(shareSlot).toContainText('Share the result anonymously');
    await expect(window.locator('#mpiSettingsAgentBenchShareHint')).toHaveText('Sends the model, its scores, cost and your GPU. Never prompts or keys. Shown at bench.cubric.studio.');
    await expect(shareInput).not.toBeChecked();
    await click('#mpiSettingsAgentBenchShareSlot .mpi-checkbox');
    await expect(shareInput).toBeChecked();
    expect(await window.evaluate(() => localStorage.getItem('mpi_agent_bench_share'))).toBe('true');
    await click('#mpiSettingsAgentBenchSlot2 .mpi-btn');
    await expect(bench).toHaveText('Benchmark this model');
    await expect(line).toHaveText('');
    await expect(shareSlot).toBeHidden();
    expect(await window.evaluate(() => window.__benchPosts)).toEqual([]);

    // The tick is remembered: the next confirm shows it ticked, and the run posts `share`.
    await clickBench();
    await expect(bench).toHaveText('Run');
    await expect(shareInput).toBeChecked();
    await clickBench();
    await expect(line).toHaveText('0 of 28 · 0 passed');
    const steps = window.locator('#mpiSettingsAgentBenchBar .mpi-progress__step');
    await expect(steps).toHaveCount(28);
    const results = [true, true, false, true, true, true, false, true, true, false, true, true];
    await emit('bench:case', { profileId: 'deepinfra', model: 'acme/agent-pick', done: 12, passed: 9, cases: 28, results, last: { id: 'x', title: 'x', passed: true, failures: [] } });
    await expect(line).toHaveText('12 of 28 · 9 passed');
    // The bar (Fabio 2026-09-29): one step per test, green for a pass, red for a fail, in order; the rest still track.
    await expect(window.locator('#mpiSettingsAgentBenchBar .mpi-progress__step--success')).toHaveCount(9);
    await expect(steps.nth(2)).toHaveClass(/mpi-progress__step--danger/);
    await expect(window.locator('#mpiSettingsAgentBenchBar .mpi-progress__step--danger')).toHaveCount(3);
    await expect(bench).toHaveText('Stop');
    await clickBench();
    await expect(bench).toHaveText('Stopping after this test…');
    expect(await window.evaluate(() => window.__benchPosts)).toEqual([
      ['/agent/benchmark', { profileId: 'deepinfra', model: '', share: true }],
      ['/agent/benchmark/stop', {}],
    ]);

    // The last test finished before the Stop landed: the run is whole, so it is kept (and, ticked, shared: MPI-965).
    await emit('bench:done', { profileId: 'deepinfra', model: 'acme/agent-pick', done: 28, passed: 21, cases: 28, costUsd: 0.09, perChat: 0.0032, suiteHash: 'h1', stopped: false, errored: false, shared: true, shareError: null });
    await expect(line).toHaveText('21/28 passed · $0.09 · now shown in the agent list · shared');
    await expect(bench).toHaveText('Benchmark this model');
    // Its steps stay under the line once it ends (Fabio 2026-09-29: "the progress bar ran away").
    await expect(steps).toHaveCount(28);
    await expect(window.locator('#mpiSettingsAgentBenchBar .mpi-progress__step--danger')).toHaveCount(3);
    // A toast says it ended wherever the user is (Fabio 2026-09-29: a 14-minute run is not watched).
    const toast = (text) => window.locator('.mpi-toast__msg', { hasText: text });
    await expect(toast('Benchmark of acme/agent-pick finished: 21/28 passed · $0.09 · shared.')).toHaveCount(1);
    // A share the service did not take says why; a run nobody asked to share says nothing of it.
    await emit('bench:done', { profileId: 'deepinfra', model: 'acme/agent-pick', done: 28, passed: 21, cases: 28, costUsd: 0.09, perChat: 0.0032, suiteHash: 'h1', stopped: false, errored: false, shared: false, shareError: 'could not reach bench.example' });
    await expect(line).toHaveText('21/28 passed · $0.09 · now shown in the agent list · not shared: could not reach bench.example');
    await expect(toast('finished: 21/28 passed · $0.09 · not shared: could not reach bench.example.')).toHaveCount(1);
    await emit('bench:done', { profileId: 'deepinfra', model: 'acme/agent-pick', done: 28, passed: 21, cases: 28, costUsd: 0.09, perChat: 0.0032, suiteHash: 'h1', stopped: false, errored: false, shared: false, shareError: null });
    await expect(line).toHaveText('21/28 passed · $0.09 · now shown in the agent list');
    // MPI-965: a run the CONNECTION failed is neither kept nor shared (2/28 and a dearer cost would show below if it were kept).
    await emit('bench:done', { profileId: 'deepinfra', model: 'acme/agent-pick', done: 28, passed: 2, cases: 28, costUsd: 0.5, perChat: 0.02, suiteHash: 'h1', stopped: false, errored: true, shared: false, shareError: 'the connection failed during the run' });
    await expect(line).toHaveText('The connection failed during the run · not kept · not shared');
    await expect(toast('Benchmark of acme/agent-pick hit connection errors: not kept, not shared.')).toHaveCount(1);
    await emit('bench:error', { profileId: 'deepinfra', model: 'acme/agent-pick', message: 'fetch failed' });
    await expect(toast('Benchmark of acme/agent-pick stopped: fetch failed')).toHaveCount(1);
    await window.evaluate(() => document.querySelector('#mpiSettingsAgentModelSlot .mpi-dropdown__trigger').click());
    // The user's run REPLACES our score (Fabio 2026-09-28): one number per model. zeta-chat's older run
    // still beats our older one; a score on the current tests ranks above any older one. MPI-965: the community's
    // scores sit among the current ones by score, and rank above the older ones.
    await expect(window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option-label')).toHaveText(['acme/community-pick', 'acme/omega-chat', 'acme/agent-pick', 'acme/zeta-chat', 'acme/enhance-pick', 'acme/see-pick', 'acme/alpha-vision']);
    await expect(window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option-meta')).toHaveText([
      '26/28 tests (community, 3 runs) · $0.20/100 chats · 64K context',
      '24/28 tests (community, 5 runs) · $0.12/100 chats',
      '21/28 tests · $0.32/100 chats · 1M context',
      '20/26 tests (older tests) · $0.20/100 chats',
      '128K context', '320K context',
    ]);
    // The next Benchmark click clears the old run's steps.
    await clickBench();
    await expect(bench).toHaveText('Run');
    await expect(window.locator('#mpiSettingsAgentBenchBar')).toBeEmpty();

    // MPI-965: no tickbox for Custom (the server says canShare: false), however the remembered tick stands, and
    // the run posts share: false; the public page is still there to read.
    await click('#mpiSettingsAgentBenchSlot2 .mpi-btn');
    await window.evaluate(() => document.querySelector('#mpiSettingsConnProfileSlot .mpi-dropdown__trigger').click());
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="custom"]').click());
    await expect(window.locator('#mpiSettingsConnUrlGroup')).toBeVisible();
    await expect(bench).toHaveText('Benchmark this model');
    await clickBench();
    await expect(bench).toHaveText('Run');
    await expect(shareSlot).toBeHidden();
    await expect(window.locator('#mpiSettingsAgentBenchShareHint')).toBeHidden();
    await expect(window.locator('#mpiSettingsAgentBenchShareSlot .mpi-checkbox')).toHaveCount(0);
    await expect(link).toHaveText('See everyone\'s results');
    expect(await window.evaluate(() => localStorage.getItem('mpi_agent_bench_share'))).toBe('true');
    await clickBench();
    await expect(line).toHaveText('0 of 28 · 0 passed');
    expect((await window.evaluate(() => window.__benchPosts)).at(-1)).toEqual(['/agent/benchmark', { profileId: 'custom', model: '', share: false }]);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

// MPI-993: on the Ollama connection a recommended model the user's Ollama lacks is still
// listed ("Not downloaded"), and picking it shows the Download row under that dropdown.
// The download landing re-reads the list, which drops the row. Everything the renderer
// fetches is stubbed in-page, so nothing downloads.
const VL = 'huihui_ai/qwen3-vl-abliterated:4b';

/** In-page stubs for the Ollama connection: `window.__downloaded` flips the VL model to installed. */
function stubOllamaConnection(window) {
  return window.evaluate((vl) => {
    const realFetch = window.fetch.bind(window);
    window.__downloaded = false;
    window.__pulls = [];
    const models = () => [
      { id: 'huihui_ai/gemma-4-abliterated:12b', contextWindow: null, vision: true, tools: true, recommendedFor: ['enhance'] },
      window.__downloaded
        ? { id: vl, contextWindow: null, vision: true, tools: true, recommendedFor: ['describe'] }
        : { id: vl, contextWindow: null, vision: null, tools: null, recommendedFor: ['describe'], installed: false },
      { id: 'qwen3-vl:4b', contextWindow: null, vision: true, tools: true, recommendedFor: [] },
    ];
    const json = (body) => Promise.resolve({ ok: true, json: async () => body });
    window.fetch = (url, opts) => {
      const path = String(url);
      if (path.startsWith('/llm/connection/models')) return json({ ok: true, profileId: 'ollama', models: models() });
      if (path.startsWith('/agent/benchmark')) return json({ ok: true, cases: 28, suiteHash: 'h1', local: true, usd: 0, running: null });
      if (path === '/llm/ollama') {
        return json({ running: true, platform: 'win32', install: null, defaultModelId: 'gemma-4-e4b',
          models: { [vl]: { name: vl, downloaded: window.__downloaded, size: 3_300_000_000, pull: null } } });
      }
      if (path === '/llm/ollama/pull') {
        window.__pulls.push(JSON.parse(opts.body).modelId);
        window.__downloaded = true;
        return json({ ok: true });
      }
      return realFetch(url, opts);
    };
    localStorage.setItem('mpi_llm_connection', JSON.stringify({ profileId: 'ollama' }));
    localStorage.setItem('cubric.llm.backend', 'endpoint');
    localStorage.setItem('cubric.llm.describeBackend', 'endpoint');
    localStorage.removeItem('cubric.llm.endpointModel');
    localStorage.removeItem('cubric.llm.describeModel');
    localStorage.removeItem('mpi_agent_prefs');
  }, VL);
}

test('MPI-993: a recommended Ollama model not downloaded is listed, and its row offers the download', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await stubOllamaConnection(window);
    await window.evaluate(async () => {
      const [{ Events }, { MpiRemote }] = await Promise.all([
        import('/js/events.js'),
        import('/js/components/Blocks/MpiRemote/MpiRemote.js'),
      ]);
      Events.emit('slide-over:open', { title: 'Remote', component: MpiRemote });
    });
    const label = (slot) => window.locator(`${slot} .mpi-dropdown__label`);
    const toggle = (slot) => window.evaluate((sel) => document.querySelector(sel).click(), `${slot} .mpi-dropdown__trigger`);
    const describeRow = window.locator('#mpiSettingsLlmDescribeInstallSlot .mpi-ollama-setup');

    // Nothing picked: the recommended model is the pick, and Ollama lacks it.
    await expect(label('#mpiSettingsLlmDescribeModelSlot')).toHaveText(`(recommended) ${VL}`, { timeout: 10000 });
    await toggle('#mpiSettingsLlmDescribeModelSlot');
    await expect(window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option-meta')).toHaveText(['Not downloaded']);
    await toggle('#mpiSettingsLlmDescribeModelSlot');
    await expect(describeRow).toContainText(`${VL} is not in your Ollama yet`);
    // The enhancer of record is downloaded: no row under it.
    await expect(window.locator('#mpiSettingsLlmEnhanceInstallSlot .mpi-ollama-setup')).toHaveCount(0);

    // Picking a downloaded model clears the row; picking the missing one brings it back.
    await toggle('#mpiSettingsLlmDescribeModelSlot');
    await window.evaluate(() => document.querySelector('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="qwen3-vl:4b"]').click());
    await expect(describeRow).toHaveCount(0);
    await toggle('#mpiSettingsLlmDescribeModelSlot');
    await window.evaluate((vl) => document.querySelector(`.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="${vl}"]`).click(), VL);
    await expect(describeRow).toContainText('Nothing downloads until you press Download');

    // Download: the pull names the row's model, and once it lands the list is re-read and the row goes.
    // An evaluate click, as `toggle` does: the first-run consent modal overlays a fresh profile.
    await window.evaluate(() => document.querySelector('#mpiSettingsLlmDescribeInstallSlot .mpi-ollama-setup .mpi-btn').click());
    await expect.poll(() => window.evaluate(() => window.__pulls)).toEqual([VL]);
    await expect(describeRow, 'the row outlived the download').toHaveCount(0, { timeout: 10000 });
    await toggle('#mpiSettingsLlmDescribeModelSlot');
    await expect(window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option-meta')).toHaveCount(0);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

test('MPI-993: opening a project warns once about a missing Ollama model, with a button to the Remote tab', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await stubOllamaConnection(window);
    // No start() here: shell.js starts the check at boot, and that wiring is what is proven.
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      Events.emit('project:changed', { project: {} });
    });
    const toast = window.locator('.mpi-toast-stack .mpi-toast', { hasText: 'not downloaded in Ollama' });
    await expect(toast).toContainText(`Your image description model, ${VL}, is not downloaded in Ollama yet.`, { timeout: 10000 });
    await expect(toast).toContainText('Remote tab on the home screen, under Language Models');

    await toast.locator('.mpi-toast__action').click();
    await expect(toast).toHaveCount(0, { timeout: 2000 });
    await expect(window.locator('.mpi-remote #mpiSettingsLlmDescribeModelSlot')).toBeVisible({ timeout: 10000 });

    // Once per app session: the next project open says nothing.
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('project:changed', { project: {} });
    });
    await window.waitForTimeout(1500);
    await expect(window.locator('.mpi-toast-stack .mpi-toast', { hasText: 'not downloaded in Ollama' })).toHaveCount(0);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
