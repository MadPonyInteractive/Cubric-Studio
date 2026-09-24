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
      if (url === '/agent/reset' || url.startsWith('/agent/reset?')) {
        // The server drops the conversation; the next history read comes back empty.
        window.__histories[new URL(url, 'http://x').searchParams.get('project') || ''] = [];
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

test('standalone chat mounts — Cosmo on the ledge', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    // MPI-777 Phase 3b: the 48px still and its "Ask me anything" label became Cosmo
    // peeking over the block's top rule, on the same clips the landing crew plays.
    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__ledge-clip--live');
    await expect(mascot).toHaveAttribute('src', /studio\/peek\.webm/);
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

test('Start over: arms, disarms, and clears the conversation on the second click', async ({}, testInfo) => {
  // `POST /agent/reset` shipped with the routes and nothing in the renderer ever called
  // it, so the only way out of a conversation was to restart the app. That bit Fabio
  // live (2026-09-19): a model that has refused once refuses again off its own
  // transcript, and switching models does not clear it.
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await window.evaluate(() => {
      window.__histories[''] = [{ kind: 'user', text: 'animate this' }, { kind: 'agent', text: 'I have to decline.' }];
    });
    await bootAndMountChat(window, false);   // panel mode — the header only exists there

    const btn = window.locator('#e2e-agent-host .mpi-agent-chat__header-action .mpi-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Start over');

    // One click ARMS, and must not have reset anything yet.
    await btn.click();
    await expect(btn).toHaveText('Sure?');
    expect(await window.evaluate(() => window.__fetchCalls.filter(c => c.url.startsWith('/agent/reset')).length)).toBe(0);

    // A click anywhere else means they did not mean it.
    await window.locator('#e2e-agent-host .mpi-agent-chat__transcript').click();
    await expect(btn).toHaveText('Start over');
    expect(await window.evaluate(() => window.__fetchCalls.filter(c => c.url.startsWith('/agent/reset')).length)).toBe(0);

    // Armed again, the second click goes through and the transcript reloads empty.
    await btn.click();
    await expect(btn).toHaveText('Sure?');
    await btn.click();
    await window.waitForTimeout(400);
    expect(await window.evaluate(() => window.__fetchCalls.filter(c => c.url.startsWith('/agent/reset')).length)).toBe(1);
    await expect(btn).toHaveText('Start over');
    expect(await window.evaluate(
      () => document.querySelector('#e2e-agent-host .mpi-agent-chat__transcript').children.length)).toBe(0);

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

test('SSE agent:working flips Cosmo to his working clip', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, true);

    await window.evaluate(() => {
      window.__fireSse('agent:working', { turnId: 't1', working: true });
    });
    // The two ledge clips are both loaded and looping; the live one is the state. It swaps
    // when the working clip's play() settles, so wait on the swap rather than a fixed sleep.
    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__ledge-clip--live');
    await expect(mascot).toHaveAttribute('src', /studio\/agent-thinking\.webm/);

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
// Part 2 — MpiPromptBox has no agent face (MPI-797 Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
// Two tests used to live here driving the Agent|Prompt toggle: Enter sends to the agent,
// Shift+Enter makes a newline. The toggle is gone and the panel's own composer owns both
// (see "panel mode has its own composer" in Part 5). What is left is the inverse, and it
// is now unconditional rather than a statement about one mode.

test('the prompt box never posts to /agent/message, in any state', async ({}, testInfo) => {
  // There is no agent mode to enter any more: the box has one face, and Enter in it can
  // only ever be a newline. generation.run is Ctrl+Enter, so plain Enter reaches nothing.
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);

    const field = window.locator('#e2e-pb-host #textarea-slot textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('just a prompt');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    const calls = await window.evaluate(() => window.__fetchCalls);
    expect(calls.filter(c => c.url === '/agent/message')).toHaveLength(0);

    // Enter made a newline in the prompt, and did not clear the field to "send" it.
    expect(await field.inputValue()).toContain('\n');

    // And it holds with the agent panel OPEN beside it — the state that used to BE agent
    // mode. The box is a prompt box either way; that is the whole of this phase.
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.agentMode = true;
    });
    await window.waitForTimeout(200);
    await field.click();
    await window.keyboard.type('still a prompt');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    const after = await window.evaluate(() => window.__fetchCalls);
    expect(after.filter(c => c.url === '/agent/message')).toHaveLength(0);

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
        // MPI-891: a result that MADE its card (history[0]) opens the gallery; a later entry
        // opens that card's history; audio has no history view, so it is always the gallery.
        itemGroups: [
          { id: 'g-in', type: 'image', items: [], history: [{ id: 'i-earlier' }] },
          { id: 'g-new', type: 'image', items: [], history: [{ id: 'i-g-new' }] },
          { id: 'g-audio', type: 'audio', items: [] },
        ],
      };
      for (const groupId of ['g-out', 'g-audio', 'g-new', 'g-in']) {
        window.__fireSse('agent:result', {
          toolCallId: groupId, ok: true,
          output: { itemId: `i-${groupId}`, groupId, type: 'image', filePath: `/tmp/${groupId}.png` },
        });
      }
    });
    await window.waitForTimeout(200);

    const cards = window.locator('#e2e-agent-host .mpi-agent-chat__result-card');
    await expect(cards).toHaveCount(4);
    for (let i = 0; i < 4; i++) await cards.nth(i).click();
    expect(await window.evaluate(() => window.__navs)).toEqual([
      { page: 'gallery', groupId: undefined },
      { page: 'gallery', groupId: undefined },
      { page: 'group-history', groupId: 'g-in' },
    ]);

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

    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__ledge-clip--live');

    // Fire working:true — Cosmo takes his working clip
    await window.evaluate(() => {
      window.__fireSse('agent:working', { turnId: 't1', working: true });
    });
    // The swap lands when play() settles: wait on it, never on a fixed sleep.
    await expect(mascot).toHaveAttribute('src', /studio\/agent-thinking\.webm/);

    // Fire working:false — back to the rest loop
    await window.evaluate(() => {
      window.__fireSse('agent:working', { turnId: 't1', working: false });
    });
    await expect(mascot).toHaveAttribute('src', /studio\/peek\.webm/);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// MPI-777 Phase 4 (MPI-843 drawing): the panel's crew ledge. Cosmo on the left, the mascot of
// the newest running job sliding in on the right, and a closed panel decoding nothing.
test('panel crew ledge: Cosmo states, the guest follows the newest job, a closed panel plays nothing', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, false);
    // A project, so the panel has a conversation for the agent's tool events to belong to.
    await openProject(window, ALPHA);

    const crew  = window.locator('#e2e-agent-host .mpi-agent-chat__crew');
    const cosmo = crew.locator('.mpi-agent-chat__crew-stand').first().locator('.mpi-agent-chat__crew-clip--live');
    // Cosmo's queue runs only while the panel is SEEN: open, away from the landing.
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.currentPage = 'gallery';
      state.agentMode = true;
    });
    const guest = window.locator('#e2e-agent-host #ac-guest');
    const heightBefore = await crew.evaluate(n => n.getBoundingClientRect().height);
    expect(heightBefore).toBe(112);
    // Full standing figures from his rotating pools, never the head peek (Fabio, 2026-09-22).
    await expect(cosmo).toHaveAttribute('src', /studio\/(idle-\d|agent-listening|greet-\d)\.webm/);
    // Feet ON the rule: the clip's measured feet row (--feet of 620) sits on the ledge's bottom edge.
    const footGap = await cosmo.evaluate((v) => {
      const r = v.getBoundingClientRect();
      const floor = v.closest('.mpi-agent-chat__crew').getBoundingClientRect().bottom;
      const feet = Number(getComputedStyle(v).getPropertyValue('--feet'));
      return Math.abs(r.top + r.height * feet / 620 - floor);
    });
    expect(footGap).toBeLessThan(1);
    await expect(window.locator('#e2e-agent-host #ac-crew-state')).toHaveText('listening');

    await window.evaluate(() => document.querySelector('#e2e-agent-host .mpi-agent-chat').setWorking(true));
    await expect(window.locator('#e2e-agent-host #ac-crew-state')).toHaveText('holding the thread');
    // Thinking is Cosmo AT THE KEYBOARD (Fabio, 2026-09-22), with its own feet row (the desk).
    await expect(cosmo).toHaveAttribute('src', /studio\/working\.webm/);
    // The a/b swap is instant, as the landing crew's: a fade read as a flicker to nothing.
    expect(await cosmo.evaluate(v => getComputedStyle(v).transitionProperty)).not.toMatch(/opacity|all/);

    // What the agent is DOING drives the ledge, not a rotation: a look brings Prism in and
    // puts Cosmo's hand on his chin; a generate call brings Lingo, who writes the prompt.
    const guestName = window.locator('#e2e-agent-host #ac-guest-name');
    const guestLive = window.locator('#e2e-agent-host #ac-guest .mpi-agent-chat__crew-clip--live');
    const fire = (name, data) => window.evaluate(([n, d]) => window.__fireSse(n, { session: 'key:/p/alpha', ...d }), [name, data]);
    await fire('agent:tool', { turnId: 't1', id: 'k1', tool: 'look', status: 'started', label: 'Looking' });
    await expect(guestName).toHaveText('Prism');
    await expect(window.locator('#e2e-agent-host #ac-guest-state')).toHaveText('looking closely');
    await expect(guestLive).toHaveAttribute('src', /vision\/getting-ready\.webm/);
    await expect(cosmo).toHaveAttribute('src', /studio\/agent-thinking\.webm/);
    // A job taking the slot from a tool guest starts its own clock (it read 29835225:08 live).
    await fire('generation:started', { id: 'g0', operation: 'upscale' });
    await expect(window.locator('#e2e-agent-host #ac-guest-state')).toHaveText(/^upscaling · 0:0\d$/);
    await fire('generation:complete', { id: 'g0' });
    await expect(window.locator('#e2e-agent-host #ac-guest-state')).toHaveText('looking closely');
    await fire('agent:tool', { turnId: 't1', id: 'k1', tool: 'look', status: 'done', label: 'Looked' });
    await expect(guest).not.toHaveClass(/mpi-agent-chat__crew-guest--in/);
    await expect(cosmo).toHaveAttribute('src', /studio\/working\.webm/);
    await fire('agent:tool', { turnId: 't1', id: 'k2', tool: 'generate', status: 'started', label: 'Generating' });
    await expect(guestName).toHaveText('Lingo');
    await expect(guestLive).toHaveAttribute('src', /prompt\/working\.webm/);
    await fire('agent:tool', { turnId: 't1', id: 'k2', tool: 'generate', status: 'done', label: 'Queued' });
    await expect(guest).not.toHaveClass(/mpi-agent-chat__crew-guest--in/);

    // A click is the landing's party trick: a puff over him, centred on his body.
    await window.locator('#e2e-agent-host #ac-cosmo').click();
    await expect(window.locator('#e2e-agent-host #ac-cosmo-fx')).toHaveAttribute('src', /studio\/transition-\w+\.webm/);
    await expect(window.locator('#e2e-agent-host #ac-cosmo-fx')).not.toHaveAttribute('src', /./, { timeout: 5000 });

    // The panel is closed (agentMode off): count every play() from here on.
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.agentMode = false;
      window.__plays = 0;
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...a) {
        if (this.closest('#e2e-agent-host')) window.__plays++;
        return orig.apply(this, a);
      };
    });

    const emit = (name, data) => window.evaluate(async ([n, d]) => {
      const { Events } = await import('/js/events.js');
      Events.emit(n, d);
    }, [name, data]);

    await emit('generation:started', { id: 'g1', operation: 'upscale' });
    await expect(guest).toHaveClass(/mpi-agent-chat__crew-guest--in/);
    await expect(guest).toHaveAttribute('data-accent', 'vision');
    await expect(window.locator('#e2e-agent-host #ac-guest-name')).toHaveText('Prism');
    await expect(window.locator('#e2e-agent-host #ac-guest-state')).toHaveText(/^upscaling · 0:0\d$/);
    // Unseen, the arrival clip is set but never played: `_syncPlay` starts it on open.
    expect(await guestLive.getAttribute('src')).toContain('vision/getting-ready.webm');

    // A newer job takes the slot; when it ends the older one still running comes back.
    await emit('generation:started', { id: 'g2', operation: 'i2v' });
    await expect(window.locator('#e2e-agent-host #ac-guest-name')).toHaveText('Reel');
    await emit('generation:complete', { id: 'g2' });
    await expect(window.locator('#e2e-agent-host #ac-guest-name')).toHaveText('Prism');

    // The last one out: the guest leaves, and after its slide-out its decoder is released.
    await emit('generation:cancelled', { id: 'g1' });
    await expect(guest).not.toHaveClass(/mpi-agent-chat__crew-guest--in/);
    await window.waitForTimeout(600);
    for (const id of ['#ac-guest-a', '#ac-guest-b']) {
      expect(await window.locator(`#e2e-agent-host ${id}`).getAttribute('src')).toBeNull();
    }

    // Nothing reflowed, and a closed panel never started a clip.
    expect(await crew.evaluate(n => n.getBoundingClientRect().height)).toBe(heightBefore);
    expect(await window.evaluate(() => window.__plays)).toBe(0);

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
test('the prompt box keeps its whole face while the agent panel is open', async ({}, testInfo) => {
  // The inverse of the test this replaces. MPI-774 gave the box an agent face: the toggle
  // swapped its text, stripped it to five columns, renumbered its chips and turned Ctrl+Enter
  // into "send to agent". MPI-797 Phase 3 deleted all of it, so the contract is now that
  // `state.agentMode` — the flag that face hung on — changes NOTHING here. Asserted as a
  // before/after on one mount, because "nothing changed" is only meaningful against a
  // measured before.
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);
    const pb = '#e2e-pb-host .mpi-prompt-box';
    // textShare below divides ONE flexing slot by the box, against fixed-width siblings, so
    // it tracks the window width: 0.6865 on a 1280 dev box, 0.6081 on the runner's 1024.
    // That is what took master red on f124f535 - measured at 1280, asserted against 1024.
    // Pin the runner's width so the number is a property of the layout, and so provoking
    // CI's condition is the default rather than something a dev box never sees
    // (docs/testing-desktop-specs.md, trap 5; docs/red-master.md, cause 1).
    await window.evaluate(() => { document.querySelector('#e2e-pb-host').style.width = '1024px'; });
    const field = window.locator(`${pb} #textarea-slot textarea`);
    const chips = window.locator(`${pb} .mpi-prompt-box-media-strip__chip`);
    const inject = (n) => window.evaluate((count) => {
      for (let i = 0; i < count; i++) {
        window.__pbInst.el.injectMedia({ url: `/assets/mascot/idle.png?${i}`, mediaType: 'image' });
      }
    }, n);
    const shown = () => window.evaluate((sel) => {
      const box = document.querySelector(sel);
      // In DOM order, which is the visual order: every column is `auto`. Keep it that way
      // so the assertion below reads as the face left to right (MPI-817 put the cog before
      // the model button). `.filter` preserves THIS list's order, not the DOM's, so this
      // array is the only thing making the expectation mean anything about order.
      // `mode-toggle-slot` is deliberately absent: MPI-797 Phase 3 deleted it, and a
      // querySelector for it below would throw rather than report it missing.
      const slots = ['op-strip-slot', 'bottom-neg-slot', 'textarea-slot', 'enhance-slot',
        'settings-cog-slot', 'settings-badge-slot', 'engine-toggle-slot', 'bottom-right-slot'];
      return {
        slots: slots.filter((id) => getComputedStyle(box.querySelector(`#${id}`)).display !== 'none'),
        textShare: box.querySelector('#textarea-slot').getBoundingClientRect().width / box.getBoundingClientRect().width,
        runCluster: [...box.querySelector('.mpi-prompt-box__col--run').children]
          .map((c) => getComputedStyle(c).display !== 'none'),
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
    await inject(1);
    await expect(chips.locator('.mpi-prompt-box-media-strip__role')).toHaveText('Start frame');
    await expect(chips.locator('.mpi-prompt-box-media-strip__index')).toHaveCount(0);

    // There is no toggle to find. Asserted by absence from the DOM, not by a hidden slot:
    // the element is deleted from the template, not display:none'd.
    await expect(window.locator(`${pb} #mode-toggle-slot`)).toHaveCount(0);
    await expect(window.locator(`${pb} .mpi-prompt-box__col--mode`)).toHaveCount(0);

    const before = await shown();
    // The full face: every column the model and op call for, Run/Stop/Clear all present.
    expect(before.slots).toContain('bottom-right-slot');
    expect(before.slots).toContain('op-strip-slot');
    expect(before.slots).toContain('enhance-slot');
    // The run cluster is runHost, stopHost, clearHost — all three on screen, none hidden
    // by name. MPI-774 used to leave only the middle one up in agent mode.
    expect(before.runCluster).toEqual([true, true, true]);

    // ── Open the agent panel. Nothing below this line may differ. ──────────────
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.agentMode = true;
    });
    await window.waitForTimeout(250);

    const after = await shown();
    expect(after.slots).toEqual(before.slots);
    expect(after.runCluster).toEqual([true, true, true]);
    expect(Math.abs(after.textShare - before.textShare)).toBeLessThan(0.01);
    // The prompt is the user's, still there, with the prompt placeholder — not swapped for
    // an empty agent field and "Talk to the agent".
    await expect(field).toHaveValue('my prompt');
    await expect(field).toHaveAttribute('placeholder', 'Type your prompt...');
    // The chip is still a start frame, not attachment number 1.
    await expect(chips.locator('.mpi-prompt-box-media-strip__role')).toHaveText('Start frame');
    await expect(chips.locator('.mpi-prompt-box-media-strip__index')).toHaveCount(0);
    // Wan 2.2's op takes two frames, so a third chip is still evicted by the op — it is not
    // an agent attachment strip that takes nine.
    await inject(2);
    await expect(chips).toHaveCount(2);

    // Ctrl+Enter runs a generation. It used to send the message to the agent instead, and
    // nothing reaches /agent/message from this box any more.
    await field.click();
    await window.keyboard.press('Control+Enter');
    await window.waitForTimeout(400);
    expect(await window.evaluate(() => window.__runs)).toBe(1);
    expect((await window.evaluate(() => window.__fetchCalls))
      .filter((c) => c.url === '/agent/message')).toHaveLength(0);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// MPI-774 Phase 7 (Fabio, 2026-09-19): the pinned settings panel. Cog SHUT, the agent picks
// the model and every setting from model defaults; cog OPEN, the user owns both and the
// agent keeps the prompt, the media, the op and the card name. Open means PINNED: the panel
// cannot be dismissed by a stray click or by Escape, only by the cog, because handing that
// ownership back by accident is worse than a popup that stays up. The dispatch half is
// agent-pinned-settings.test.cjs; this is the interaction only a real window can prove.
//
// MPI-797 Phase 3 re-homed the TRIGGER and nothing else. It used to be the prompt box's own
// `_agentMode`, set by a toggle in the box; that toggle and the whole agent face are gone,
// so the rule now reads `state.agentMode` — the same flag the local one always mirrored,
// set by the top bar's Agent button. The box is no longer stripped down for this, so the cog
// and the model button are simply always there, and the popup no longer drops its op strip:
// the user is driving this prompt box themselves now, and that op is theirs.
test('the cog pins the settings panel while the agent panel is open, and only the cog unpins it', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);
    const pb = '#e2e-pb-host .mpi-prompt-box';
    const cog = window.locator(`${pb} #settings-cog-slot button`);
    // No `--agent` variant on the popup any more, so it needs a different anchor: the
    // parameters popup is the one holding the op strip. `body > .mpi-popup` alone is a
    // strict-mode violation — MpiRatioSelector portals its own popup to body too.
    const popup = window.locator('body > .mpi-popup:has(.mpi-prompt-box__settings-ops)');
    const setAgentMode = (on) => window.evaluate(async (v) => {
      const { state } = await import('/js/state.js');
      state.agentMode = v;
    }, on);
    const pinnedFlag = () => window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.agentSettingsPinned;
    });

    await window.evaluate(async () => {
      const { getModelById } = await import('/js/data/modelRegistry.js');
      window.__pbInst.el.setModel(getModelById('wan-22'));
    });

    // Panel shut: nothing is pinned, and the cog is an ordinary popup trigger.
    expect(await pinnedFlag()).toBe(false);
    expect(await cog.getAttribute('data-info')).toBe('Generation parameters');
    await cog.click();
    await expect(popup).toHaveClass(/is-active/);
    expect(await pinnedFlag()).toBe(false);
    // ...and an ordinary popup closes on an outside click.
    await window.mouse.click(5, 5);
    await window.waitForTimeout(150);
    await expect(popup).not.toHaveClass(/is-active/);

    await setAgentMode(true);
    // The two columns the pinned panel is made of are always on screen now.
    await expect(cog).toBeVisible();
    await expect(window.locator(`${pb} #settings-badge-slot button`)).toBeVisible();
    // Opening it has to be readable BEFORE the click — this is the status-bar line.
    await expect.poll(() => cog.getAttribute('data-info'))
      .toBe('In agent mode, when you open this panel, you control the settings and the model, not the agent.');
    // An open panel alone pins nothing: the cog has to be OPENED.
    expect(await pinnedFlag()).toBe(false);

    await cog.click();
    await expect(popup).toHaveClass(/is-active/);
    expect(await pinnedFlag()).toBe(true);

    // The op strip STAYS in it now (MPI-797 Phase 3). It used to be hidden by
    // `.mpi-prompt-box__popup--agent` because the box was the agent's face and the op was
    // the agent's; the user drives this box themselves while the panel is open, so hiding
    // their own op selector was wrong. The handover has never included the op.
    expect(await window.evaluate(() => {
      const el = document.querySelector('body > .mpi-popup .mpi-prompt-box__settings-ops');
      return el ? getComputedStyle(el).display : 'missing';
    })).not.toBe('none');

    // A click on the page outside the panel does NOT hand the settings back.
    await window.mouse.click(5, 5);
    await window.waitForTimeout(150);
    await expect(popup).toHaveClass(/is-active/);
    expect(await pinnedFlag()).toBe(true);

    // Neither does Escape.
    await window.keyboard.press('Escape');
    await window.waitForTimeout(150);
    await expect(popup).toHaveClass(/is-active/);
    expect(await pinnedFlag()).toBe(true);

    // The cog is the way out, and it hands the settings straight back to the agent.
    await cog.click();
    await expect(popup).not.toHaveClass(/is-active/);
    expect(await pinnedFlag()).toBe(false);

    // Closing the agent panel with the cog still open unpins it too: the ownership is a
    // panel-open meaning of "this popup is open", and with no agent there is nobody to take
    // it from. This is the line `_applyAgentView` used to carry, and the one reason Phase 3
    // could not simply delete the toggle block outright.
    await cog.click();
    expect(await pinnedFlag()).toBe(true);
    await setAgentMode(false);
    await window.waitForTimeout(150);
    expect(await pinnedFlag()).toBe(false);
    // The copy goes back with it.
    await expect.poll(() => cog.getAttribute('data-info')).toBe('Generation parameters');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// Fabio, 2026-09-19, found while checking the pinned panel: resize the window and the
// settings popup opens in the wrong place, and it takes a SECOND click to settle.
//
// Two faults, both measured in this window before the fix:
//  1. `.mpi-popup` transitioned `all`, so `left`/`bottom` SLID over 200ms. Every owner of
//     the primitive positions it from JS then clamps it to the viewport in a rAF — which
//     fires ~16ms in and so measured the element at its OLD position. The clamp subtracted
//     an overflow belonging to where the popup used to be: the first reopen after a
//     1280 -> 1100 resize landed 128px too far left (overflowRight -188 against a correct
//     -60), and the second reopen finally settled. That is the "click twice" exactly.
//  2. Nothing repositioned an OPEN popup on a window resize: measured +120px off the right
//     edge. Survivable while any click shut it; MPI-774 Phase 7 pins it open in agent mode,
//     so it became the normal case.
//
// The assertion is "on screen, first time, every time" — a fixed pixel would just be the
// arithmetic again.
test('the settings popup survives a window resize: on screen, first open, no second click', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);
    const pb = '#e2e-pb-host .mpi-prompt-box';
    const cog = window.locator(`${pb} #settings-cog-slot button`);

    const geom = () => window.evaluate(() => {
      const p = document.querySelector('body > .mpi-popup');
      const r = p.getBoundingClientRect();
      // MPI-817: where the caret actually lands, against the control it claims to belong
      // to. The caret is a ::after with no box of its own, so it is read off the custom
      // property the popup sets and measured from the popup's own left edge. This is the
      // one that drifts: the caret defaults to the popup's middle, and a clamp moves the
      // popup without moving the cog.
      const cogR = document.querySelector('#e2e-pb-host .mpi-prompt-box #settings-cog-slot button')
        .getBoundingClientRect();
      const arrowX = parseFloat(getComputedStyle(p).getPropertyValue('--popup-arrow-x'));
      return {
        transitionProperty: getComputedStyle(p).transitionProperty,
        left: Math.round(r.left),
        overflowRight: Math.round(r.right - window.innerWidth),
        width: Math.round(r.width),
        caretOffCog: Math.round(r.left + arrowX - (cogR.left + cogR.width / 2)),
      };
    });

    await cog.click();
    await window.waitForTimeout(400);
    const first = await geom();
    // The coordinates must NOT be animated, or the rAF clamp measures a moving element.
    expect(first.transitionProperty).not.toContain('all');
    expect(first.transitionProperty).toContain('opacity');
    expect(first.overflowRight).toBeLessThanOrEqual(0);
    expect(first.left).toBeGreaterThanOrEqual(0);
    // The caret points at the cog, not at the popup's middle. Live, it was landing on the
    // model button next door and reading as the model's popup (Fabio, 2026-09-19).
    expect(Math.abs(first.caretOffCog)).toBeLessThanOrEqual(1);

    // Shrink the window while the panel is OPEN — the pinned-in-agent-mode case.
    await app.evaluate(async ({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1100, 800);
    });
    await window.waitForTimeout(600);
    const stillOpen = await geom();
    expect(stillOpen.overflowRight).toBeLessThanOrEqual(0);
    expect(stillOpen.left).toBeGreaterThanOrEqual(0);

    // And the FIRST reopen at the new size is already right — no second click.
    await cog.click(); await window.waitForTimeout(300);
    await cog.click(); await window.waitForTimeout(600);
    const reopen1 = await geom();
    expect(reopen1.overflowRight).toBeLessThanOrEqual(0);
    expect(reopen1.left).toBeGreaterThanOrEqual(0);
    // The narrower window clamps harder, so this is where the caret drifts furthest.
    expect(Math.abs(reopen1.caretOffCog)).toBeLessThanOrEqual(1);

    // A second reopen lands in the SAME place. Before the fix these differed by 128px.
    await cog.click(); await window.waitForTimeout(300);
    await cog.click(); await window.waitForTimeout(600);
    expect((await geom()).left).toBe(reopen1.left);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('the prompt bar runs textarea-slot straight into enhance-slot', async ({}, testInfo) => {
  // This pinned `mode-toggle-slot` between the two. MPI-797 Phase 3 deleted that slot, and
  // the pair closing up is exactly what proves it: an ordering assertion that still passed
  // with a stale slot in the middle would prove nothing.
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountPromptBox(window);

    const ids = await window.evaluate(() => {
      const pb = document.querySelector('#e2e-pb-host .mpi-prompt-box');
      return Array.from(pb.children).map(c => c.id).filter(Boolean);
    });

    expect(ids).not.toContain('mode-toggle-slot');
    expect(ids.indexOf('enhance-slot')).toBe(ids.indexOf('textarea-slot') + 1);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('agent panel: the real shell mount is closed by default, opens on state.agentMode and pushes the workspace right', async ({}, testInfo) => {
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

    // MPI-797: Phase 1 moved the setter to the top bar's Agent button and Phase 3 deleted
    // the prompt box's toggle. `agentPanel.js` reacts to the STATE and does not care who
    // sets it, which is what this drives — the button's own surface is MpiProjectName's.
    await window.evaluate(() => { window.__testState.agentMode = true; });
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

    await window.evaluate(() => { window.__testState.agentMode = false; });
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

// MPI-797 Phase 2. The panel used to have no input of its own — it borrowed
// MpiPromptBox's agent mode over `agent:send`. Phase 3 deleted that toggle AND the event,
// so this IS the send path now, and the History workspace mounts no prompt box at all. The attachment number is the second half: the user and the agent refer to
// "1", never to "the start frame".
test('panel mode has its own composer: Enter sends, and dropped images are numbered', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, false);

    const field = window.locator('#e2e-agent-host textarea');
    await expect(field).toBeVisible();
    await field.click();
    await window.keyboard.type('hello from the panel');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    const calls = await window.evaluate(() => window.__fetchCalls);
    const msgCall = calls.find(c => c.url === '/agent/message');
    expect(msgCall).toBeTruthy();
    expect(msgCall.body.text).toBe('hello from the panel');

    // Two files, so the index is proven rather than a hardcoded "1".
    await window.evaluate(() => {
      const dt = new DataTransfer();
      for (const name of ['plate_a.png', 'plate_b.png']) {
        const blob = new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' });
        dt.items.add(new File([blob], name, { type: 'image/png' }));
      }
      document.getElementById('e2e-agent-host').firstElementChild
        .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
    });

    // Scoped to the input row: the sent bubble draws the same chip from the same helper,
    // so an unscoped locator counts both and the "composer cleared" check below passes
    // on the bubble's copies.
    const nums = window.locator(
      '#e2e-agent-host .mpi-agent-chat__input-row .mpi-agent-chat__attachment-num');
    await expect(nums).toHaveCount(2);
    expect(await nums.allTextContents()).toEqual(['1', '2']);

    // Sending carries the numbers into the bubble (Fabio, 2026-09-20): a follow-up says
    // "make 2 warmer" and 2 has to still be on screen, pointing at the same picture.
    await field.click();
    await window.keyboard.type('take the style from 2');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(400);

    const inBubble = window.locator(
      '#e2e-agent-host .mpi-agent-chat__attachments--in-bubble .mpi-agent-chat__attachment-num');
    expect(await inBubble.allTextContents()).toEqual(['1', '2']);
    await expect(nums).toHaveCount(0);   // and the composer's own strip is cleared

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// Every other spec here mounts into a plain host div, which cannot see one line of the
// panel's own CSS — all of it is scoped to `#agent-panel-mount`. Both of the faults Fabio
// caught by eye (the hint stranded above the `>`, the box never collapsing) lived exactly
// there, so this one drives the REAL panel.
test('the real panel composer is one line at rest, with the glyph on the text baseline', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
      Events.emit('ui:close-all-popups');
      await new Promise(r => setTimeout(r, 100));
      localStorage.removeItem('mpi_agent_panel_width');
      document.getElementById('app-shell').classList.remove('hide');
      const { state } = await import('/js/state.js');
      state.agentMode = true;
    });
    await window.waitForTimeout(900);

    const m = await window.evaluate(() => {
      const p = document.getElementById('agent-panel-mount');
      const ta = p.querySelector('textarea');
      const wrap = p.querySelector('.mpi-agent-chat__input-wrap');
      const cs = getComputedStyle(ta);
      return {
        fieldH: Math.round(ta.getBoundingClientRect().height),
        wrapH: Math.round(wrap.getBoundingClientRect().height),
        inlineHeight: ta.style.height,
        minHeight: cs.minHeight,
        glyph: getComputedStyle(wrap, '::before').content,
      };
    });

    // The panel is CLOSED at boot, so a mount-time measurement reads scrollHeight 0 and
    // writes `height: 0px`. Nothing inline is the correct state: `rows="1"` sizes it.
    expect(m.inlineHeight).toBe('');
    // The floor has to go with the padding, or the text sits at the top of a 42px box
    // while the glyph centres in it.
    expect(m.minHeight).toBe('0px');
    expect(m.fieldH).toBeLessThan(25);
    // One line means the glyph's box and the field's box are the same height — that is
    // what puts them on the same baseline instead of 21px apart.
    expect(m.wrapH).toBe(m.fieldH);
    expect(m.glyph).toContain('>');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// Fabio, 2026-09-20, seen in his own app: the box grew with a long message and stayed
// grown and empty after every send. `textareaEl.value = ''` fires no `input` event, and
// `input` is all MpiInput's auto-height listens to, so nothing re-measured. The fix is
// the Primitive's own setValue; this pins the height coming back.
test('the composer collapses back to one line after a send', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await installStubs(window);
    await bootAndMountChat(window, false);

    const field = window.locator('#e2e-agent-host textarea');
    await expect(field).toBeVisible();
    const oneLine = await field.evaluate(el => el.getBoundingClientRect().height);

    await field.click();
    // Real keystrokes, so auto-height runs the way it does for a user.
    await window.keyboard.type('the last time you used image-to-image to convert the '
      + 'gunslinger, can you instead use KREA2 and its style for anime, then animate a '
      + 'two-second video of it');
    await window.waitForTimeout(200);
    const grown = await field.evaluate(el => el.getBoundingClientRect().height);
    expect(grown).toBeGreaterThan(oneLine);   // the harness reproduced the growth

    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    expect(await field.inputValue()).toBe('');
    const after = await field.evaluate(el => el.getBoundingClientRect().height);
    expect(after).toBe(oneLine);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// Fabio, 2026-09-20: the chips stay to the LEFT of the `>`, which he likes — but an op
// can take nine images, two videos and two audio files, and he can reach that state. The
// field therefore has a floor and the strip is what gives way, shrinking and scrolling.
// Without the floor thirteen chips leave nowhere to type, which is the whole point of
// this row.
test('thirteen attachments shrink and scroll the strip; the field keeps its floor', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  try {
    await installStubs(window);
    await bootAndMountChat(window, false);

    // A narrow host, so the squeeze is real rather than hidden by a wide window.
    await window.evaluate(() => {
      document.getElementById('e2e-agent-host').style.width = '420px';
    });

    // Real decodable bytes: a broken image sizes to its alt text, not to 40px, and would
    // measure the squeeze wrong in both directions.
    await window.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const dt = new DataTransfer();
      for (let i = 1; i <= 13; i++) dt.items.add(new File([bytes], `drop_${i}.png`, { type: 'image/png' }));
      document.getElementById('e2e-agent-host').firstElementChild
        .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      await new Promise(r => setTimeout(r, 800));
    }, PNG_B64);

    const m = await window.evaluate(() => {
      const host = document.getElementById('e2e-agent-host');
      const strip = host.querySelector('.mpi-agent-chat__input-row .mpi-agent-chat__attachments');
      const row = host.querySelector('.mpi-agent-chat__input-row');
      return {
        chips: strip.querySelectorAll('.mpi-agent-chat__attachment').length,
        stripScrolls: strip.scrollWidth > strip.clientWidth + 1,
        fieldW: Math.round(host.querySelector('.mpi-agent-chat__input-wrap').getBoundingClientRect().width),
        rowOverflowX: row.scrollWidth - row.clientWidth,
      };
    });

    expect(m.chips).toBe(13);
    expect(m.stripScrolls).toBe(true);
    expect(m.fieldW).toBeGreaterThanOrEqual(140);  // the 9rem floor
    expect(m.rowOverflowX).toBe(0);                // the row itself never overflows

    // Numbering runs past one digit.
    const nums = window.locator('#e2e-agent-host .mpi-agent-chat__attachment-num');
    expect(await nums.allTextContents()).toEqual(
      ['1','2','3','4','5','6','7','8','9','10','11','12','13']);

    // A block caret parked on the hint reads as a rendering fault, so the hint stands
    // down on focus rather than on the first keystroke.
    await window.locator('#e2e-agent-host textarea').focus();
    const placeholderColor = await window.evaluate(() => getComputedStyle(
      document.querySelector('#e2e-agent-host textarea'), '::placeholder').color);
    expect(placeholderColor).toBe('rgba(0, 0, 0, 0)');

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
    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__ledge-clip--live');
    expect(await mascot.getAttribute('src')).toContain('studio/peek.webm');

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

    // Sent from the panel: the open project, by folder and name only. Typed into the
    // panel's own composer, because MPI-797 Phase 3 deleted `agent:send` — that emit was
    // standing in for the prompt box's toggle, and both halves are gone.
    const composer = window.locator('#e2e-agent-host .mpi-agent-chat__input-row textarea');
    await expect(composer).toBeVisible();
    await composer.click();
    await window.keyboard.type('from the panel');
    await window.keyboard.press('Enter');
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
    const mascot = window.locator('#e2e-agent-host .mpi-agent-chat__ledge-clip--live');
    expect(await mascot.getAttribute('src')).toContain('studio/peek.webm');

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
