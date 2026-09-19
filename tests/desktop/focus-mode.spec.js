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
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

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

    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
        import('/js/state.js'),
        import('/js/router.js'),
      ]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise((r) => setTimeout(r, 400));
    }, makeProject(testInfo));

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
