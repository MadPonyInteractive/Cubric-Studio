/**
 * focus-mode.spec.js — MPI-817.
 *
 * Focus mode hides standing chrome. The agent panel is standing chrome and was being left
 * behind: Fabio pressed F with the agent open (2026-09-19) and the chat kept its 420px of
 * the window while the topbar and the prompt dock went away.
 *
 * It is collapsed rather than hidden, and that is the whole point of this file. The panel
 * is `position: absolute` and its siblings take their `margin-left` from
 * `.main-area:has(> .agent-panel-mount--open)`. `:has()` matches on structure, so a
 * `display: none` panel STILL matches it: the obvious fix hides the chat and leaves its
 * gap behind, which looks like a broken layout rather than a missing rule. The assertion
 * below is therefore on the sibling's margin as much as on the panel's width.
 *
 * Needs the real shell. `agent-chat.spec.js` mounts the prompt box into its own host, and
 * `#agent-panel-mount` does not exist there.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

// The runner has no model weights, so the boot sync re-writes every `installed` flag to
// false and the gallery raises "No models installed" — a modal that sits over the prompt
// box and eats the click below. Every dev box has weights, so this spec was green here and
// red in CI (docs/red-master.md, cause 1; docs/testing-desktop-specs.md, trap 5).
//
// Pin one plain flat model usable — `installed` alone makes it so (isModelUsable). A getter
// rather than an assignment: the boot sync re-writes `installed` from disk on every
// `models:checked`, and a pinned property cannot be re-written, so there is no listener
// order to get right.
async function pinOneModelInstalled(window) {
  await window.evaluate(async () => {
    const { MODELS } = await import('/js/data/modelRegistry.js');
    const model = MODELS.find(m => m.id === 'sdxl-realistic');
    Object.defineProperty(model, 'installed', { get: () => true, set() {}, configurable: true });
  });
}

// PROVOKE the runner's condition so this spec fails locally without the pin instead of only
// in CI: answer /comfy/models/check with every model absent, exactly as a weightless runner
// does, and run the real sync against it.
async function provokeNoWeights(window) {
  await window.evaluate(async () => {
    const { MODELS, syncModelInstalled } = await import('/js/data/modelRegistry.js');
    const results = Object.fromEntries(MODELS.map(m => [m.id, { installed: false, deps: [] }]));
    const realFetch = window.fetch;
    window.fetch = (url, init) => /\/comfy\/models\/check/.test(String(url))
      ? Promise.resolve(new Response(JSON.stringify({ results }), {
          status: 200, headers: { 'Content-Type': 'application/json' } }))
      : realFetch(url, init);
    try { await syncModelInstalled(); } finally { window.fetch = realFetch; }
    await new Promise(r => setTimeout(r, 200));
  });
}

function makeProject(testInfo) {
  const folderPath = testInfo.outputPath('project');
  fs.mkdirSync(folderPath, { recursive: true });
  const project = { id: 'e2e-focus', name: 'E2E Focus', itemGroups: [], modelSettings: {} };
  fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
  return { ...project, folderPath };
}

test('focus mode collapses the agent panel, and takes its gap with it', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      await new Promise((r) => setTimeout(r, 300));
    });

    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
        import('/js/state.js'),
        import('/js/router.js'),
      ]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise((r) => setTimeout(r, 400));
      state.agentMode = true;
      await new Promise((r) => setTimeout(r, 400));
    }, makeProject(testInfo));

    // Width of the panel, and the margin its siblings hold open for it. Both must go.
    const geom = () => window.evaluate(() => {
      const panel = document.querySelector('#agent-panel-mount');
      const sibling = document.querySelector('#workspace-content');
      return {
        open: panel.classList.contains('agent-panel-mount--open'),
        panelW: Math.round(panel.getBoundingClientRect().width),
        siblingMargin: Math.round(parseFloat(getComputedStyle(sibling).marginLeft)),
      };
    });

    const before = await geom();
    expect(before.open, 'agent mode should have opened the panel').toBe(true);
    expect(before.panelW).toBeGreaterThan(100);
    expect(before.siblingMargin).toBeGreaterThan(100);

    // `hotkeyManager.isTextEntryElement` swallows a bare key while a textarea has focus,
    // and opening the panel may have put the caret in the chat's own field.
    const blur = () => window.evaluate(() => document.activeElement?.blur());

    await blur();
    await window.keyboard.press('f');
    await expect(window.locator('body.mpi-focus-mode')).toHaveCount(1);
    await window.waitForTimeout(500);   // the width transition

    const during = await geom();
    expect(during.panelW).toBe(0);
    expect(during.siblingMargin, 'the panel went but its gap stayed — see the :has() note above').toBe(0);
    // Still the chrome focus mode is actually for.
    await expect(window.locator('#prompt-box-mount')).toBeHidden();

    // F again gives it back: focus mode hides chrome, it does not close the agent.
    await blur();
    await window.keyboard.press('f');
    await expect(window.locator('body.mpi-focus-mode')).toHaveCount(0);
    await window.waitForTimeout(500);
    const after = await geom();
    expect(after.open).toBe(true);
    expect(after.panelW).toBe(before.panelW);
    expect(after.siblingMargin).toBe(before.siblingMargin);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

/**
 * `A` opens and closes the agent (Fabio, 2026-09-19). Bound in `agentPanel.js` rather than
 * on the PromptBox's own toggle button: that box is remounted on every workspace switch
 * and the binding would go with it, while this service is app-lifetime. Both meet at
 * `state.agentMode`.
 *
 * The third case is the one worth the file. `a` is a letter people type constantly, so the
 * binding lives or dies on `allowWhileTyping: false` — without it the panel flips on every
 * "a" of a prompt, which is worse than having no hotkey at all.
 */
test('A opens and closes the agent panel, and never fires while you are typing', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      await new Promise((r) => setTimeout(r, 300));
    });

    await pinOneModelInstalled(window);

    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
        import('/js/state.js'),
        import('/js/router.js'),
      ]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise((r) => setTimeout(r, 400));
    }, makeProject(testInfo));

    await provokeNoWeights(window);
    await expect(window.locator('.mpi-modal'), 'no "No models installed" modal over the prompt box')
      .toHaveCount(0);

    const isOpen = () => window.evaluate(() =>
      document.querySelector('#agent-panel-mount').classList.contains('agent-panel-mount--open'));
    const blur = () => window.evaluate(() => document.activeElement?.blur());

    expect(await isOpen(), 'the panel starts closed').toBe(false);

    await blur();
    await window.keyboard.press('a');
    await window.waitForTimeout(400);
    expect(await isOpen(), 'A should have opened it').toBe(true);

    await blur();
    await window.keyboard.press('a');
    await window.waitForTimeout(400);
    expect(await isOpen(), 'A again should have closed it').toBe(false);

    // Typing into the prompt box: the letter lands in the field and nothing else happens.
    const textarea = window.locator('#prompt-box-mount textarea').first();
    await textarea.click();
    await textarea.type('a fox');
    await window.waitForTimeout(400);
    expect(await isOpen(), 'typing a prompt must not open the agent').toBe(false);
    expect(await textarea.inputValue()).toBe('a fox');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-1037. F on an IMAGE in History went black (Fabio, 2026-10-07). History asks for native
 * fullscreen on the clip when one is on screen, and found it with "the first <video> under
 * #tool-container". An image has no clip, but MPI-906 had parked the mascot peek there: a
 * `<video>` with no src at opacity 0. Chromium fullscreened that, and fullscreen paints
 * black behind an invisible element. Video kept working only because its own player sits
 * ahead of the peek in the DOM.
 *
 * Asserted on the screen's real pixels, not on a class: the image must still be what you
 * see, and with Compare on (two entries, the inline split) both sides must be.
 */
async function clearBootModals(window) {
  const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
  const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
  if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 8 && await backdrops() > 0; i++) {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(400);
  }
  expect(await backdrops(), 'the boot modals must be gone').toBe(0);
}

async function importStill(window, project, rgb, filename) {
  const png = await sharp({ create: { width: 512, height: 512, channels: 3, background: rgb } }).png().toBuffer();
  const itemId = crypto.randomUUID();
  return window.evaluate(async ({ project, itemId, base64, filename }) => {
    const { Events } = await import('/js/events.js');
    const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: 512, height: 512 }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(`upload failed: ${data.error}`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('project:group-added never fired')), 30000);
      const unsub = Events.on('project:group-added', ({ group }) => {
        if (group?.history?.[0]?.id !== itemId) return;
        clearTimeout(timer); unsub(); resolve(group.id);
      });
      Events.emit('media:imported', {
        url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
        filename: data.filename, itemId, thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
        proxyPath: null, pixelDimensions: { w: 512, h: 512 }, mediaType: 'image',
      });
    });
  }, { project, itemId, base64: png.toString('base64'), filename });
}

test('F in History: an image stays on screen, Compare too, and a video still goes fullscreen', async ({}, testInfo) => {
  test.setTimeout(180000);
  const RED = { r: 200, g: 40, b: 40 };
  const BLUE = { r: 40, g: 40, b: 200 };
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.waitForTimeout(6000);
    await clearBootModals(window);

    const project = await window.evaluate(async (folderPath) => {
      const { createProject, openProject } = await import('/js/services/projectService.js');
      const p = await createProject(`mpi1037-${Date.now()}`, folderPath);
      await openProject(p);
      return p;
    }, testInfo.outputPath('projects'));
    const red = await importStill(window, project, RED, 'e2e-red_001.png');
    const blue = await importStill(window, project, BLUE, 'e2e-blue_001.png');

    await window.evaluate(async (id) => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: id });
    }, red);
    // The screen's pixel at fractions across the viewer, on its middle row. History opens in
    // Prompt mode, which shows the preview rather than the canvas; the viewer holds both.
    const pixelsAt = async (...fx) => {
      const box = await window.evaluate(() => {
        const r = document.querySelector('.mpi-canvas-viewer').getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      });
      const shot = await window.screenshot({ scale: 'css' });
      const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      return fx.map((f) => {
        const x = Math.round(box.x + box.w * f);
        const y = Math.round(box.y + box.h * 0.5);
        const i = (y * info.width + x) * 3;
        return { r: data[i], g: data[i + 1], b: data[i + 2] };
      });
    };
    const near = (px, want) => Math.abs(px.r - want.r) < 25 && Math.abs(px.g - want.g) < 25 && Math.abs(px.b - want.b) < 25;
    const fullscreenId = () => window.evaluate(() => {
      const f = document.fullscreenElement;
      return f ? (f.id || f.className || f.tagName) : null;
    });
    const pressF = async (on) => {
      await window.evaluate(() => document.activeElement?.blur());
      await window.keyboard.press('f');
      await expect(window.locator('body.mpi-focus-mode')).toHaveCount(on ? 1 : 0);
      await window.waitForTimeout(600);
    };

    // 1. Plain image, in the Prompt mode History opens in.
    await window.waitForSelector('.mpi-canvas-viewer', { timeout: 30000 });
    await expect.poll(async () => near((await pixelsAt(0.5))[0], RED), { timeout: 30000 }).toBe(true);
    await pressF(true);
    expect(await fullscreenId(), 'an image has no clip to fullscreen').toBeNull();
    const [mid] = await pixelsAt(0.5);
    expect(near(mid, RED), `the image should be on screen, saw rgb(${mid.r},${mid.g},${mid.b})`).toBe(true);
    await pressF(false);

    // 2. Compare: red is the base, blue the after side right of the split bar. The Block's
    // own two steps from Prompt mode (`compare-requested`): back to the canvas, then load.
    await window.evaluate(async ({ a, b }) => {
      const { state } = await import('/js/state.js');
      const entry = (id) => state.currentProject.itemGroups.find((g) => g.id === id).history[0];
      const viewer = document.querySelector('.mpi-canvas-viewer');
      await viewer.swapToCanvas();
      await viewer.loadCompare(entry(a), entry(b));
    }, { a: red, b: blue });
    await window.waitForFunction(() => {
      const c = document.querySelector('.mpi-canvas-viewer canvas[data-role="compare"]');
      return c && c.style.display !== 'none' && c.width > 0;
    }, null, { timeout: 30000 });

    await pressF(true);
    expect(await fullscreenId(), 'compare has no clip to fullscreen either').toBeNull();
    const [left, right] = await pixelsAt(0.35, 0.65);
    expect(near(left, RED), `compare base side, saw rgb(${left.r},${left.g},${left.b})`).toBe(true);
    expect(near(right, BLUE), `compare after side, saw rgb(${right.r},${right.g},${right.b})`).toBe(true);
    await pressF(false);

    // 3. A video still goes native fullscreen, on the viewer's own clip. No file: the
    // Block loads one only when there is a filePath, and the element is what is asserted.
    await window.evaluate(async () => {
      const [{ state }, { navigate, PAGE_GROUP_HISTORY }] = await Promise.all([
        import('/js/state.js'), import('/js/router.js'),
      ]);
      const vid = { id: 'gVideo', type: 'video', selectedIndex: 0, history: [{ id: 'iVideo', type: 'video', displayName: 'vid' }] };
      state.currentProject = { ...state.currentProject, itemGroups: [...state.currentProject.itemGroups, vid] };
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gVideo' });
    });
    await window.waitForSelector('.mpi-video-viewer', { timeout: 30000 });
    await pressF(true);
    await expect.poll(fullscreenId).toBe('mpi-video-surface__video');
    await pressF(false);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
