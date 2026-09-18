// MPI-774: Agent chat UI — in-page smoke tests.
//
// All HTTP (/agent/*) and SSE (/agent/stream) traffic is stubbed IN-PAGE so
// these specs never require a live agent backend. win.route() does not reach
// the renderer's fetch in Electron (memory note: tool_electron_ui_check_fixture_fetch).
//
// Private --output dir per spec (memory note: tool_desktop_specs_private_output_dir):
// testInfo.outputPath() returns a path unique to THIS spec run, so parallel
// suites never collide on the same test-results sub-directory.
//
// Maturity gate must be cleared before any UI interaction.

const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

// ── In-page stub installer ────────────────────────────────────────────────────

async function installStubs(window) {
  await window.evaluate(async () => {
    // 18+ gate — spec uses localStorage key directly
    localStorage.setItem('mpi_maturity_acknowledged', 'true');

    // fetch stub. One conversation per project (Phase 3c): the server keys each by its
    // folder and names the key in every reply. The client never builds a key, so the stub
    // uses a visibly different one ('key:<folder>') to prove it only echoes what it got.
    window.__fetchCalls = [];
    window.__histories = {}; // folderPath ('' = landing) -> entries
    window.__messageReply = null; // a canned POST /agent/message reply, e.g. BUSY
    const keyOf = (folderPath) => (folderPath ? `key:${folderPath}` : '');
    window.fetch = async (url, opts) => {
      window.__fetchCalls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : undefined });
      if (url === '/agent/history' || url.startsWith('/agent/history?')) {
        const folderPath = new URL(url, 'http://x').searchParams.get('project') || '';
        const entries = window.__histories[folderPath] || [];
        return { ok: true, json: async () => ({ ok: true, session: keyOf(folderPath), entries, working: false, pendingConfirm: null }) };
      }
      if (url === '/agent/message') {
        const body = JSON.parse(opts.body);
        const reply = window.__messageReply
          || { ok: true, turnId: 't1', session: keyOf(body.project && body.project.folderPath), attachments: [] };
        return { ok: true, json: async () => reply };
      }
      if (url === '/agent/confirm') {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: false, json: async () => ({}) };
    };

    // The chat listens on the app bus, fed by ONE EventSource the shell opened at boot
    // (agentService.agentInitStream, bridge covered by tests/agent-service-bus.test.cjs).
    // That stream predates this stub, so an SSE event is simulated where the chat reads it.
    // Every server event names its conversation; the default is the landing page's.
    const { Events } = await import('/js/events.js');
    window.__fireSse = (name, data) => Events.emit(name, { session: '', ...data });

    // EventSource stub (for anything opened after this point)
    window.__sseListeners = {};
    window.EventSource = class {
      constructor() {}
      addEventListener(name, fn) {
        window.__sseListeners[name] = window.__sseListeners[name] || [];
        window.__sseListeners[name].push(fn);
      }
      close() {}
    };
  });
}

// ── Helper: boot the app, clear gates, mount agent chat ──────────────────────

async function bootAndMountChat(window, standalone) {
  await window.evaluate(async (standalone_) => {
    const [{ Events }, { MpiAgentChat }] = await Promise.all([
      import('/js/events.js'),
      import('/js/components/Compounds/MpiAgentChat/MpiAgentChat.js'),
    ]);
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 200));
    Events.emit('ui:close-all-popups');
    await new Promise(r => setTimeout(r, 100));

    const host = document.createElement('div');
    host.id = 'e2e-agent-host';
    host.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--surface-bar)';
    document.body.appendChild(host);
    const inst = MpiAgentChat.mount(host, { standalone: standalone_ });
    window.__agentInst = inst;
    await new Promise(r => setTimeout(r, 200));
  }, standalone);
}

// ── Helper: boot the app, clear gates, mount MpiPromptBox ───────────────────

async function bootAndMountPromptBox(window) {
  await window.evaluate(async () => {
    const [{ Events }, { MpiPromptBox }] = await Promise.all([
      import('/js/events.js'),
      import('/js/components/Organisms/MpiPromptBox/MpiPromptBox.js'),
    ]);
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 300));
    Events.emit('ui:close-all-popups');
    await new Promise(r => setTimeout(r, 100));

    const host = document.createElement('div');
    host.id = 'e2e-pb-host';
    host.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--surface-bar)';
    document.body.appendChild(host);
    const inst = MpiPromptBox.mount(host, {});
    window.__pbInst = inst;
    await new Promise(r => setTimeout(r, 300));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Part 1 — standalone MpiAgentChat (landing page surface)
// ─────────────────────────────────────────────────────────────────────────────

test('standalone chat mounts — mascot visible', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__mascot');
    await expect(mascot).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('Enter in standalone input sends one POST /agent/message', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    const field = window.locator('#e2e-agent-host textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('hello agent');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    const calls = await window.evaluate(() => window.__fetchCalls);
    const msgCall = calls.find(c => c.url === '/agent/message');
    expect(msgCall).toBeTruthy();
    expect(msgCall.body.text).toBe('hello agent');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('Shift+Enter in standalone input does NOT send', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    const field = window.locator('#e2e-agent-host textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('no send yet');
    await window.keyboard.press('Shift+Enter');
    await window.waitForTimeout(200);

    const calls = await window.evaluate(() => window.__fetchCalls);
    const msgCalls = calls.filter(c => c.url === '/agent/message');
    expect(msgCalls).toHaveLength(0);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('SSE agent:message event renders text in transcript', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(() => {
      window.__fireSse('agent:message', { turnId: 't1', id: 'm1', text: 'Hello from agent!' });
    });
    await window.waitForTimeout(200);

    const transcript = window.locator('#e2e-agent-host .mpi-agent-chat__transcript');
    await expect(transcript).toContainText('Hello from agent!');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('SSE agent:working flips mascot to waiting state', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(() => {
      window.__fireSse('agent:working', { turnId: 't1', working: true });
    });
    await window.waitForTimeout(200);

    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__mascot');
    const src = await mascot.getAttribute('src');
    expect(src).toContain('waiting.png');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('SSE agent:tool renders label line (not args.prompt)', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(() => {
      window.__fireSse('agent:tool', {
        turnId: 't1',
        id: 'tool1',
        tool: 'generate_image',
        status: 'started',
        label: 'Generating image',
      });
    });
    await window.waitForTimeout(200);

    const transcript = window.locator('#e2e-agent-host .mpi-agent-chat__transcript');
    await expect(transcript).toContainText('Generating image');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('confirm card Yes button calls POST /agent/confirm', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(() => {
      window.__fireSse('agent:confirm', {
        turnId: 't1',
        confirmId: 'c1',
        kind: 'install',
        modelId: 'test-model',
        modelName: 'Test Model',
        downloadGb: 4.2,
      });
    });
    await window.waitForTimeout(200);

    const yesBtn = window.locator('#e2e-agent-host .mpi-agent-chat__confirm-card button, #e2e-agent-host .mpi-agent-chat__confirm-card .mpi-btn').first();
    await expect(yesBtn).toBeVisible();
    await yesBtn.click();
    await window.waitForTimeout(300);

    const calls = await window.evaluate(() => window.__fetchCalls);
    const confirmCall = calls.find(c => c.url === '/agent/confirm');
    expect(confirmCall).toBeTruthy();
    expect(confirmCall.body.confirmId).toBe('c1');
    expect(confirmCall.body.yes).toBe(true);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('SSE agent:error renders error line', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(() => {
      window.__fireSse('agent:error', { turnId: 't1', code: 'AGENT_ERR', message: 'Something went wrong' });
    });
    await window.waitForTimeout(200);

    const errLine = window.locator('#e2e-agent-host .mpi-agent-chat__entry--error');
    await expect(errLine).toBeVisible();
    await expect(errLine).toContainText('Something went wrong');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('landing page has #landingAgentSlot with agent chat', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);

    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
      Events.emit('ui:close-all-popups');
      await new Promise(r => setTimeout(r, 200));
    });

    const slot = window.locator('#landingAgentSlot');
    await expect(slot).toBeVisible();
    const chat = window.locator('#landingAgentSlot .mpi-agent-chat');
    await expect(chat).toBeVisible();

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 2 — MpiPromptBox Agent|Prompt toggle surface
// ─────────────────────────────────────────────────────────────────────────────

test('PromptBox agent mode: Enter sends exactly one POST /agent/message', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);

    // Enter agent mode
    const modeBtn = window.locator('#e2e-pb-host .mpi-prompt-box__col--mode .mpi-ibtn');
    await modeBtn.click();
    await window.waitForTimeout(200);

    // Type and press Enter in the prompt textarea
    const field = window.locator('#e2e-pb-host #textarea-slot textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('agent prompt send');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(400);

    const calls = await window.evaluate(() => window.__fetchCalls);
    const msgCalls = calls.filter(c => c.url === '/agent/message');
    expect(msgCalls).toHaveLength(1);
    expect(msgCalls[0].body.text).toBe('agent prompt send');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('PromptBox agent mode: Shift+Enter adds newline, does not send', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);

    // Enter agent mode
    const modeBtn = window.locator('#e2e-pb-host .mpi-prompt-box__col--mode .mpi-ibtn');
    await modeBtn.click();
    await window.waitForTimeout(200);

    const field = window.locator('#e2e-pb-host #textarea-slot textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('line one');
    await window.keyboard.press('Shift+Enter');
    await window.keyboard.type('line two');
    await window.waitForTimeout(200);

    // No send yet
    const calls = await window.evaluate(() => window.__fetchCalls);
    const msgCalls = calls.filter(c => c.url === '/agent/message');
    expect(msgCalls).toHaveLength(0);

    // Value has a newline
    const value = await field.inputValue();
    expect(value).toContain('\n');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('PromptBox prompt mode: Enter does NOT post to /agent/message', async ({}, testInfo) => {
  // generation.run is Ctrl+Enter, so plain Enter in the textarea never reaches
  // generation in prompt mode — our agent-mode handler also returns early when
  // _agentMode=false. Assert no /agent/message call either way.
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);

    // Do NOT toggle agent mode — stay in Prompt mode

    const field = window.locator('#e2e-pb-host #textarea-slot textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('just a prompt');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    const calls = await window.evaluate(() => window.__fetchCalls);
    const msgCalls = calls.filter(c => c.url === '/agent/message');
    expect(msgCalls).toHaveLength(0);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 3 — additional SSE surface tests
// ─────────────────────────────────────────────────────────────────────────────

test('SSE agent:result renders result card; agent:compacting renders compacting line', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    // Fire result event with an output item
    await window.evaluate(() => {
      window.__fireSse('agent:result', {
        toolCallId: 'tc1',
        ok: true,
        output: { itemId: 'item1', groupId: 'g1', type: 'image', filePath: '/tmp/test.png' },
      });
    });
    await window.waitForTimeout(200);

    const resultCard = window.locator('#e2e-agent-host .mpi-agent-chat__result-card');
    await expect(resultCard).toBeVisible();

    // Fire compacting event
    await window.evaluate(() => {
      window.__fireSse('agent:compacting', { turnId: 't1', on: true });
    });
    await window.waitForTimeout(200);

    const compactingLine = window.locator('#e2e-agent-host .mpi-agent-chat__entry--compacting');
    await expect(compactingLine).toBeVisible();
    await expect(compactingLine).toContainText('Compact');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// Fabio's landing check (2026-09-17): the result image was broken (the renderer item's filePath is
// already a /project-file url, and the chat wrapped it again), a carried request showed no bubble
// until a reload, and list numbers were the colour of the panel.
test('a result in the real shape loads; a carried request draws once; list markers show', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  const png = require('path').resolve(__dirname, '../../assets/mascot/idle.png').replace(/\\/g, '/');
  try {
    await installStubs(window);
    await window.evaluate(() => {
      window.__histories[''] = [{ id: 'u1', kind: 'user', text: 'From Alpha: open Beta', attachments: [] }];
    });
    await bootAndMountChat(window, true);

    await window.evaluate((abs) => {
      window.__fireSse('agent:result', {
        toolCallId: 'real', ok: true,
        output: { itemId: 'i1', groupId: 'g1', type: 'image', filePath: `/project-file?path=${encodeURIComponent(abs)}` },
      });
      window.__fireSse('agent:user', { turnId: 't9', id: 'u1', text: 'From Alpha: open Beta', attachments: [] });
      window.__fireSse('agent:user', { turnId: 't9', id: 'u2', text: 'From Beta: make a fox', attachments: [{ id: 'att_9', name: 'f.png' }] });
      window.__fireSse('agent:message', { turnId: 't9', id: 'm1', text: '1. one\n2. two' });
    }, png);

    const img = window.locator('#e2e-agent-host .mpi-agent-chat__result-card img');
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

    const bubbles = window.locator('#e2e-agent-host .mpi-agent-chat__entry--user');
    await expect(bubbles).toHaveCount(2);
    await expect(bubbles.nth(1)).toContainText('From Beta: make a fox');
    expect(await bubbles.nth(1).locator('img').getAttribute('src')).toBe('/agent/attachment/att_9');

    const colors = await window.evaluate(() => {
      const li = document.querySelector('#e2e-agent-host .mpi-agent-chat__entry--message li');
      const probe = document.createElement('span');
      probe.style.color = 'var(--ink-2)';
      document.body.appendChild(probe);
      const out = { marker: getComputedStyle(li, '::marker').color, ink2: getComputedStyle(probe).color };
      probe.remove();
      return out;
    });
    expect(colors.marker).toBe(colors.ink2);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('a result card opens its card history, only for a card the open project holds', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(async () => {
      const [router, { state }] = await Promise.all([import('/js/router.js'), import('/js/state.js')]);
      window.__navs = [];
      // Record instead of loading: the shell's own callback would mount a real history view.
      router.onNavigate((page, params) => window.__navs.push({ page, groupId: params.groupId }));
      state.currentProject = {
        id: 'p1', name: 'P', folderPath: '/p',
        itemGroups: [{ id: 'g-in', type: 'image', items: [] }, { id: 'g-audio', type: 'audio', items: [] }],
      };
      for (const groupId of ['g-out', 'g-audio', 'g-in']) {
        window.__fireSse('agent:result', {
          toolCallId: groupId, ok: true,
          output: { itemId: `i-${groupId}`, groupId, type: 'image', filePath: `/tmp/${groupId}.png` },
        });
      }
    });
    await window.waitForTimeout(200);

    const cards = window.locator('#e2e-agent-host .mpi-agent-chat__result-card');
    await expect(cards).toHaveCount(3);
    for (let i = 0; i < 3; i++) await cards.nth(i).click();
    expect(await window.evaluate(() => window.__navs)).toEqual([{ page: 'group-history', groupId: 'g-in' }]);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('Mascot flips back to idle when agent:working false follows true', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__mascot');

    // Fire working:true — should switch to waiting.png
    await window.evaluate(() => {
      window.__fireSse('agent:working', { turnId: 't1', working: true });
    });
    await window.waitForTimeout(200);
    expect(await mascot.getAttribute('src')).toContain('waiting.png');

    // Fire working:false — should switch back to idle.png
    await window.evaluate(() => {
      window.__fireSse('agent:working', { turnId: 't1', working: false });
    });
    await window.waitForTimeout(200);
    expect(await mascot.getAttribute('src')).toContain('idle.png');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 4 — MPI-774 panel layout, toggle position, history replay
// ─────────────────────────────────────────────────────────────────────────────

// MPI-797 (Fabio, 2026-09-17): in Agent mode the box is an agent box — its own text and a
// usage hint, only the toggle beside it, no generation from the run hotkey, and image chips
// that are numbered, never "Start frame".
test('PromptBox Agent mode: own text and hint, the toggle, Stop but no Run, numbered chips', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);
    const pb = '#e2e-pb-host .mpi-prompt-box';
    const field = window.locator(`${pb} #textarea-slot textarea`);
    const toggle = window.locator(`${pb} .mpi-prompt-box__col--mode .mpi-ibtn`);
    const chips = window.locator(`${pb} .mpi-prompt-box-media-strip__chip`);
    const inject = (n) => window.evaluate((count) => {
      for (let i = 0; i < count; i++) {
        window.__pbInst.el.injectMedia({ url: `/assets/mascot/idle.png?${i}`, mediaType: 'image' });
      }
    }, n);
    const shown = () => window.evaluate((sel) => {
      const box = document.querySelector(sel);
      const slots = ['op-strip-slot', 'bottom-neg-slot', 'textarea-slot', 'mode-toggle-slot', 'enhance-slot',
        'settings-badge-slot', 'settings-cog-slot', 'engine-toggle-slot', 'bottom-right-slot'];
      return {
        slots: slots.filter((id) => getComputedStyle(box.querySelector(`#${id}`)).display !== 'none'),
        textShare: box.querySelector('#textarea-slot').getBoundingClientRect().width / box.getBoundingClientRect().width,
      };
    }, pb);

    // A model whose op has a start and a last frame (Wan 2.2, i2v_ms).
    await window.evaluate(async () => {
      const { getModelById } = await import('/js/data/modelRegistry.js');
      window.__pbInst.el.setModel(getModelById('wan-22'));
      window.__pbInst.el.setOperation('i2v_ms');
      window.__runs = 0;
      window.__pbInst.on('run', () => { window.__runs += 1; });
    });
    await field.click();
    await window.keyboard.type('my prompt');
    const promptFace = await shown();
    expect(promptFace.slots).toContain('bottom-right-slot');
    // One staged image in Prompt mode: the start-frame pill, no number.
    await inject(1);
    await expect(chips.locator('.mpi-prompt-box-media-strip__role')).toHaveText('Start frame');
    await expect(chips.locator('.mpi-prompt-box-media-strip__index')).toHaveCount(0);

    // The toggle is the agent's head (MPI-797): the Studio robot, as tall as the Enhance
    // button beside it, muted while off, full colour while on.
    const head = toggle.locator('img.mpi-ibtn__img');
    await expect(head).toHaveAttribute('src', 'assets/mascot/studio/logo.webp');
    await expect.poll(() => head.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    const enhance = window.locator(`${pb} #enhance-slot .mpi-ibtn`);
    await expect(enhance).toBeVisible();
    const [toggleBox, enhanceBox, headBox] = await Promise.all([toggle, enhance, head].map((l) => l.boundingBox()));
    expect(Math.abs(toggleBox.height - enhanceBox.height)).toBeLessThanOrEqual(1);
    expect(headBox.height).toBeGreaterThanOrEqual(enhanceBox.height - 4);    await window.mouse.move(0, 0);
    await expect.poll(() => head.evaluate((el) => getComputedStyle(el).filter)).toBe('grayscale(1)');

    await toggle.click();
    await expect.poll(() => head.evaluate((el) => getComputedStyle(el).filter)).toBe('none');    await expect(field).toHaveValue('');
    await expect(field).toHaveAttribute('placeholder', 'Talk to the agent. Shift+Enter for a new line, Enter to send.');
    const agentFace = await shown();
    // The run column STAYS in agent mode (MPI-774 fix 6, Fabio): the agent has no cancel
    // tool, so the user's Stop is the only way to halt a generation it started, and
    // hiding the column wholesale took Stop with it. Run and Clear are hidden by name.
    expect(agentFace.slots).toEqual(['textarea-slot', 'mode-toggle-slot', 'bottom-right-slot']);
    expect(agentFace.textShare).toBeGreaterThan(0.8);
    expect(await window.evaluate((sel) => {
      const col = document.querySelector(`${sel} .mpi-prompt-box__col--run`);
      return [...col.children].map((c) => ({
        stop: c.classList.contains('mpi-prompt-box__stop-host'),
        shown: getComputedStyle(c).display !== 'none',
      }));
    }, pb)).toEqual([{ stop: false, shown: false }, { stop: true, shown: true }, { stop: false, shown: false }]);

    // The same chip is now just number 1. Two more on an op that takes two (start and last
    // frame): all three stay, numbered, no frame pill.
    await expect(chips.locator('.mpi-prompt-box-media-strip__index')).toHaveText(['1']);
    await expect(chips.locator('.mpi-prompt-box-media-strip__role')).toHaveCount(0);
    await inject(2);
    await expect(chips).toHaveCount(3);
    expect(await chips.locator('.mpi-prompt-box-media-strip__index').allTextContents()).toEqual(['1', '2', '3']);
    await expect(chips.locator('.mpi-prompt-box-media-strip__role')).toHaveCount(0);

    // The run hotkey starts no generation: it sends the message, as Enter does.
    await field.click();
    await window.keyboard.type('hello agent');
    await window.keyboard.press('Control+Enter');
    await window.waitForTimeout(400);
    expect(await window.evaluate(() => window.__runs)).toBe(0);
    const sent = (await window.evaluate(() => window.__fetchCalls)).filter((c) => c.url === '/agent/message');
    expect(sent.map((c) => c.body.text)).toEqual(['hello agent']);
    await expect(field).toHaveValue('');
    await expect(chips).toHaveCount(0);

    // Back to Prompt mode: the prompt is still there, and the chips fit the op again.
    await inject(3);
    await toggle.click();
    await expect(field).toHaveValue('my prompt');
    await expect(field).toHaveAttribute('placeholder', 'Type your prompt...');
    // Wan 2.2 takes a start and a last frame: the third chip goes, the frame pills return.
    await expect(chips).toHaveCount(2);
    expect(await chips.locator('.mpi-prompt-box-media-strip__role').allTextContents()).toEqual(['Start frame', 'Last frame']);
    expect((await shown()).slots).toContain('bottom-right-slot');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('toggle sits between textarea-slot and enhance-slot in the prompt bar', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);

    // Verify DOM order: textarea-slot → mode-toggle-slot → enhance-slot
    const order = await window.evaluate(() => {
      const pb = document.querySelector('#e2e-pb-host .mpi-prompt-box');
      const slots = Array.from(pb.children).map(c => c.id).filter(id => [
        'textarea-slot', 'mode-toggle-slot', 'enhance-slot',
      ].includes(id));
      return slots;
    });

    expect(order[0]).toBe('textarea-slot');
    expect(order[1]).toBe('mode-toggle-slot');
    expect(order[2]).toBe('enhance-slot');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('agent panel: the real shell mount is closed by default, opens from the toggle and pushes the workspace right', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);

    // The shell (js/shell.js -> initAgentPanel) mounted the chat into #agent-panel-mount at
    // boot. Show the app shell as an open project would, and measure the REAL layout.
    const measure = () => window.evaluate(() => {
      const rect = (id) => document.getElementById(id).getBoundingClientRect();
      const panel = document.getElementById('agent-panel-mount');
      return {
        chat: !!panel.querySelector('.mpi-agent-chat'),
        open: panel.classList.contains('agent-panel-mount--open'),
        panelWidth: Math.round(rect('agent-panel-mount').width),
        panelTop: Math.round(rect('agent-panel-mount').top),
        panelBottom: Math.round(rect('agent-panel-mount').bottom),
        panelRight: Math.round(rect('agent-panel-mount').right),
        topbarBottom: Math.round(rect('workspace-topbar').bottom),
        statusTop: Math.round(rect('shell-info-bar').top),
        toolsLeft: Math.round(rect('tool-container').left),
        promptLeft: Math.round(rect('prompt-box-mount').left),
        controlsLeft: Math.round(rect('controls-mount').left),
      };
    });
    await window.evaluate(async () => {
      localStorage.removeItem('mpi_agent_panel_width');
      document.getElementById('app-shell').classList.remove('hide');
      const { state } = await import('/js/state.js');
      window.__testState = state;
      state.agentMode = false;
    });
    await window.waitForTimeout(500);

    const closed = await measure();
    expect(closed.chat).toBe(true);
    expect(closed.open).toBe(false);
    expect(closed.panelWidth).toBe(0);

    const toggle = window.locator('#e2e-pb-host .mpi-prompt-box__col--mode .mpi-ibtn');
    await toggle.click();
    await window.waitForTimeout(600); // width transition is --t-base
    expect(await window.evaluate(() => window.__testState.agentMode)).toBe(true);

    const opened = await measure();
    expect(opened.open).toBe(true);
    // Fabio, 2026-09-16: 420 wide, and BELOW the topbar so its row (back link, project name,
    // toolbar chips) keeps its own area.
    expect(opened.panelWidth).toBe(420);
    expect(opened.panelTop).toBeGreaterThanOrEqual(opened.topbarBottom);
    expect(opened.toolsLeft - closed.toolsLeft).toBe(opened.panelWidth);
    // MPI-797: full height down to the status bar, and the prompt box and controls start
    // right of it, so nothing covers the chat.
    expect(opened.panelBottom).toBe(opened.statusTop);
    expect(opened.promptLeft).toBe(opened.panelRight);
    expect(opened.controlsLeft).toBe(opened.panelRight);

    // Dragging the edge resizes it, the layout follows, the width is stored and clamped.
    const handle = window.locator('#agent-panel-mount > .mpi-resize-handle');
    const drag = async (toX) => {
      const box = await handle.boundingBox();
      await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await window.mouse.down();
      await window.mouse.move(toX, box.y + box.height / 2, { steps: 5 });
      await window.mouse.up();
      await window.waitForTimeout(100);
    };
    await drag(opened.panelRight - 60);
    const narrower = await measure();
    expect(narrower.panelWidth).toBe(360);
    expect(narrower.promptLeft).toBe(narrower.panelRight);
    expect(await window.evaluate(() => localStorage.getItem('mpi_agent_panel_width'))).toBe('360');
    await drag(opened.panelRight - 400);
    expect((await measure()).panelWidth).toBe(280);
    expect(await window.evaluate(() => localStorage.getItem('mpi_agent_panel_width'))).toBe('280');

    await toggle.click();
    await window.waitForTimeout(600);
    const toggled = await measure();
    expect(await window.evaluate(() => window.__testState.agentMode)).toBe(false);
    expect(toggled.panelWidth).toBe(0);
    expect(toggled.promptLeft).toBe(closed.promptLeft);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('history replay: user + agent entries visible after remount (kind-based, not role-based)', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(() => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');

      // Stub fetch with history containing kind:'user' and kind:'agent'
      window.__fetchCalls = [];
      window.fetch = async (url, opts) => {
        window.__fetchCalls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : undefined });
        if (url === '/agent/history') {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              session: '',
              working: false,
              pendingConfirm: null,
              entries: [
                { id: 'u1', kind: 'user', text: 'Hello agent', attachments: [] },
                { id: 'a1', kind: 'agent', text: 'Hello user!' },
              ],
            }),
          };
        }
        if (url === '/agent/message') {
          return { ok: true, json: async () => ({ ok: true, turnId: 't1', attachments: [] }) };
        }
        return { ok: false, json: async () => ({}) };
      };
      // SSE stub
      window.__sseListeners = {};
      window.__fireSse = (name, data) => {
        (window.__sseListeners[name] || []).forEach(fn => fn({ data: JSON.stringify(data) }));
      };
      window.EventSource = class {
        constructor() {}
        addEventListener(name, fn) {
          window.__sseListeners[name] = window.__sseListeners[name] || [];
          window.__sseListeners[name].push(fn);
        }
        close() {}
      };
    });

    await bootAndMountChat(window, true);

    // Wait for history to load
    await window.waitForTimeout(500);

    // Both entries should be visible
    const userBubble = window.locator('#e2e-agent-host .mpi-agent-chat__entry--user');
    await expect(userBubble).toBeVisible();
    await expect(userBubble).toContainText('Hello agent');

    const agentMsg = window.locator('#e2e-agent-host .mpi-agent-chat__entry--message');
    await expect(agentMsg).toBeVisible();
    await expect(agentMsg).toContainText('Hello user!');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('POST /agent/message body carries mode from getAgentPrefs and profileId from getLlmConnection', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    // Seed prefs BEFORE stubs so agentService reads them at send-time.
    // profileId now lives in mpi_llm_connection (getLlmConnection); mode in mpi_agent_prefs.
    await window.evaluate(() => {
      localStorage.setItem('mpi_agent_prefs', JSON.stringify({ mode: 'ask' }));
      localStorage.setItem('mpi_llm_connection', JSON.stringify({ profileId: 'openrouter' }));
    });
    await installStubs(window);
    await bootAndMountChat(window, true);

    const field = window.locator('#e2e-agent-host textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('prefs check');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(400);

    const calls = await window.evaluate(() => window.__fetchCalls);
    const msgCall = calls.find(c => c.url === '/agent/message');
    expect(msgCall).toBeTruthy();
    expect(msgCall.body.profileId).toBe('openrouter');
    expect(msgCall.body.mode).toBe('ask');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 5 — MPI-774 Phase 3c: one conversation per project
// ─────────────────────────────────────────────────────────────────────────────

const ALPHA = { id: 'pa', name: 'Alpha', folderPath: '/p/alpha', itemGroups: [] };
const BETA = { id: 'pb', name: 'Beta', folderPath: '/p/beta', itemGroups: [] };

/** Make `project` the open one, the way projectService announces a switch. */
async function openProject(window, project) {
  await window.evaluate(async (p) => {
    const [{ Events }, { state }] = await Promise.all([import('/js/events.js'), import('/js/state.js')]);
    state.currentProject = p;
    Events.emit('project:changed', { project: p });
  }, project);
  await window.waitForTimeout(300);
}

/** A second chat in its own host, for tests that need the landing chat and the panel side by side. */
async function mountSecondChat(window, standalone) {
  await window.evaluate(async (standalone_) => {
    const { MpiAgentChat } = await import('/js/components/Compounds/MpiAgentChat/MpiAgentChat.js');
    const host = document.createElement('div');
    host.id = 'e2e-agent-host-2';
    host.style.cssText = 'position:fixed;top:0;left:0;width:400px;z-index:9999;background:var(--surface-bar)';
    document.body.appendChild(host);
    MpiAgentChat.mount(host, { standalone: standalone_ });
    await new Promise(r => setTimeout(r, 200));
  }, standalone);
}

test('a chat renders only its own conversation\'s events', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(() => {
      window.__fireSse('agent:message', { session: 'key:/p/alpha', turnId: 't1', id: 'm-other', text: 'not for the landing page' });
      window.__fireSse('agent:working', { session: 'key:/p/alpha', turnId: 't1', working: true });
      window.__fireSse('agent:message', { turnId: 't2', id: 'm-mine', text: 'for the landing page' });
    });
    await window.waitForTimeout(200);

    const messages = window.locator('#e2e-agent-host .mpi-agent-chat__entry--message');
    await expect(messages).toHaveCount(1);
    await expect(messages).toContainText('for the landing page');
    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__mascot');
    expect(await mascot.getAttribute('src')).toContain('idle.png');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('the panel swaps conversations with the project, and switching back restores it', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await window.evaluate(() => {
      window.__histories['/p/alpha'] = [
        { id: 'ua', kind: 'user', text: 'alpha question', attachments: [] },
        { id: 'aa', kind: 'agent', text: 'alpha answer' },
      ];
    });
    await bootAndMountChat(window, false);
    const entries = window.locator('#e2e-agent-host .mpi-agent-chat__entry');

    await openProject(window, ALPHA);
    await expect(window.locator('#e2e-agent-host .mpi-agent-chat__entry--message')).toContainText('alpha answer');
    await window.evaluate(() => window.__fireSse('agent:message', { session: 'key:/p/alpha', turnId: 't1', id: 'live', text: 'live in alpha' }));
    await expect(window.locator('#e2e-agent-host')).toContainText('live in alpha');

    await openProject(window, BETA);
    await expect(entries).toHaveCount(0);
    await window.evaluate(() => window.__fireSse('agent:message', { session: 'key:/p/alpha', turnId: 't2', id: 'away', text: 'alpha while away' }));
    await window.waitForTimeout(200);
    await expect(entries).toHaveCount(0);

    await openProject(window, ALPHA);
    await expect(window.locator('#e2e-agent-host .mpi-agent-chat__entry--user')).toContainText('alpha question');
    await expect(window.locator('#e2e-agent-host .mpi-agent-chat__entry--message')).toContainText('alpha answer');

    // Sent from the panel: the open project, by folder and name only.
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('agent:send', { text: 'from the panel', attachments: [] });
    });
    await window.waitForTimeout(300);
    const calls = await window.evaluate(() => window.__fetchCalls);
    const posts = calls.filter(c => c.url === '/agent/message');
    expect(posts.length).toBeGreaterThanOrEqual(1);
    for (const p of posts) expect(p.body.project).toEqual({ folderPath: '/p/alpha', name: 'Alpha' });
    const historyUrls = calls.map(c => c.url).filter(u => u.startsWith('/agent/history'));
    expect(historyUrls).toContain('/agent/history?project=%2Fp%2Falpha');
    expect(historyUrls).toContain('/agent/history?project=%2Fp%2Fbeta');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('the landing chat keeps the landing page\'s conversation while a project is loaded', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await window.evaluate(() => {
      window.__histories[''] = [{ id: 'al', kind: 'agent', text: 'landing answer' }];
      window.__histories['/p/alpha'] = [{ id: 'aa', kind: 'agent', text: 'alpha answer' }];
    });
    await bootAndMountChat(window, true);
    await openProject(window, ALPHA);

    const messages = window.locator('#e2e-agent-host .mpi-agent-chat__entry--message');
    await expect(messages).toHaveCount(1);
    await expect(messages).toContainText('landing answer');

    const field = window.locator('#e2e-agent-host textarea');
    await field.click();
    await window.keyboard.type('make something');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);
    const post = (await window.evaluate(() => window.__fetchCalls)).find(c => c.url === '/agent/message');
    expect(post.body.project).toBeNull();

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('when the landing conversation moves into a project, both chats reload', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await window.evaluate(() => {
      window.__histories[''] = [{ id: 'u1', kind: 'user', text: 'make a fox', attachments: [] }];
    });
    await bootAndMountChat(window, true);  // the landing chat
    await openProject(window, ALPHA);
    await mountSecondChat(window, false);  // the project panel, on Alpha
    const landing = window.locator('#e2e-agent-host .mpi-agent-chat__entry');
    const panel = window.locator('#e2e-agent-host-2 .mpi-agent-chat__entry');
    await expect(landing).toHaveCount(1);
    await expect(panel).toHaveCount(0);

    // The server moved the conversation: it is Alpha's now, and the landing page starts fresh.
    await window.evaluate(async () => {
      window.__histories['/p/alpha'] = window.__histories[''];
      window.__histories[''] = [];
      const { Events } = await import('/js/events.js');
      Events.emit('agent:session', { from: '', to: 'key:/p/alpha' });
    });
    await window.waitForTimeout(300);
    await expect(landing).toHaveCount(0);
    await expect(panel).toHaveCount(1);
    await expect(panel).toContainText('make a fox');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('a BUSY reply shows its message and stops working', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await window.evaluate(() => {
      window.__messageReply = { ok: false, error: { code: 'BUSY', message: 'The agent is still answering. Wait for it to finish.' } };
    });
    await bootAndMountChat(window, true);

    const field = window.locator('#e2e-agent-host textarea');
    await field.click();
    await window.keyboard.type('are you there');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    await expect(window.locator('#e2e-agent-host .mpi-agent-chat__entry--error')).toContainText('still answering');
    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__mascot');
    expect(await mascot.getAttribute('src')).toContain('idle.png');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
