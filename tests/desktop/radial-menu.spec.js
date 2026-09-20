// MPI-811: the user radial is back on Tab, and it replaced the MPI-589/611 Tab ring
// this spec used to cover (it was flows-tab-ring.spec.js).
//
// Three things here fail silently and are the whole point of the spec:
//  - MpiOverlay stashes every sibling of its mount target into a `display: none` div.
//    Put the radial in that stash and Tab still fires, still navigates on release, and
//    draws NOTHING — no error anywhere. #radial-mount is a body child that body-mode
//    overlays spare by name, which is what keeps it drawn over EVERY surface.
//  - Drawn is not the same as on top: the overlay z-index is handed out at runtime, so
//    the radial's own 19000 is checked with elementFromPoint, which Playwright's
//    visibility check cannot do.
//  - The four destinations sit on the DIAGONALS, not the cardinal points the
//    renderer spaces items on by default. A wrong angle is a menu that still
//    works and is in the wrong place.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

function makeProject(testInfo, itemGroups = []) {
  const folderPath = testInfo.outputPath('project');
  fs.mkdirSync(folderPath, { recursive: true });
  const project = { id: 'e2e-radial', name: 'E2E Radial', itemGroups, modelSettings: {} };
  fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
  return { ...project, folderPath };
}

async function releaseBootGate(window) {
  await window.evaluate(async () => {
    const { Events } = await import('/js/events.js');
    Events.emit('engine:install-skipped');
    await new Promise(r => setTimeout(r, 300));
  });
}

async function openGallery(window, project) {
  await window.evaluate(async (p) => {
    const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
      import('/js/state.js'),
      import('/js/router.js'),
    ]);
    state.currentProject = p;
    navigate(PAGE_GALLERY);
    await new Promise(r => setTimeout(r, 400));
  }, project);
}

/** Where we are: 'FLOWS' when the library is up, else the current page. */
function where(window) {
  return window.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return document.querySelector('.mpi-overlay--body .mpi-flow-library') ? 'FLOWS' : state.currentPage;
  });
}

// The radial reads raw pointer-lock deltas off `mousemove`, so aiming is a synthetic
// event with movementX/Y rather than a real cursor — Playwright's mouse cannot produce
// deltas inside a pointer lock, and the lock request itself is refused in a test window
// (that fires `pointerlockerror`, never `pointerlockchange`, so the menu stays up).
// 400 is far past the 40px dead zone even after the devicePixelRatio divide.
const AIM = {
  gallery:   [-400, -400],  // top-left
  models:    [-400,  400],  // bottom-left
  flows:     [ 400, -400],  // top-right
  workspace: [ 400,  400],  // bottom-right
};

async function holdTab(window) {
  await window.keyboard.down('Tab');
  await expect(window.locator('.mpi-radial--visible')).toBeVisible({ timeout: 5000 });
}

async function aim(window, action) {
  await window.evaluate(([x, y]) => {
    document.querySelector('.mpi-radial')
      .dispatchEvent(new MouseEvent('mousemove', { movementX: x, movementY: y, bubbles: true }));
  }, AIM[action]);
}

/** Hold Tab, aim at `action`, release — the whole gesture. */
async function pick(window, action) {
  await holdTab(window);
  await aim(window, action);
  await expect(window.locator(`.mpi-radial__item[data-action="${action}"]`))
    .toHaveClass(/mpi-radial__item--active/, { timeout: 2000 });
  await window.keyboard.up('Tab');
}

/** Is the radial the top thing under its own centre? Sees stacking, unlike toBeVisible. */
function onTop(window) {
  return window.evaluate(() => {
    const r = document.querySelector('.mpi-radial').getBoundingClientRect();
    return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      ?.closest('.mpi-radial');
  });
}

// MPI-818: a runner has NO weights. An EMPTY project with zero usable models raises the
// "No models installed" MpiOkCancel at gallery mount (MpiGalleryBlock § Zero-installed
// check), and Tab is gated behind any `.mpi-modal` on purpose (hotkeyRegistry, MPI-811:
// a modal is a question, and navigating out orphans it). So the one test here with an
// empty project was red in CI and green on every dev box, where the weights are.
// Pin one plain flat model usable — `installed` alone makes it so (isModelUsable), and
// gallery-cue-all.spec.js stubs the same one. A getter rather than an assignment: the
// boot sync re-writes `installed` from disk on every `models:checked`, and a pinned
// property cannot be re-written, so there is no listener order to get right
// (docs/testing-desktop-specs.md, trap 5).
async function pinOneModelInstalled(window) {
  await window.evaluate(async () => {
    const { MODELS } = await import('/js/data/modelRegistry.js');
    const model = MODELS.find(m => m.id === 'sdxl-realistic');
    Object.defineProperty(model, 'installed', { get: () => true, set() {}, configurable: true });
  });
}

// What the boot sync does on a runner with no weights: /comfy/models/check reports every
// model absent and every `installed` flag is re-written from that answer. A dev box has
// weights, so the real sync never resolves empty here — this makes it (provoke, do not
// wait: trap 5). With the pin above the spec stays green; without it, the dialog is up.
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

test('the four destinations sit on their diagonals', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    await openGallery(window, makeProject(testInfo, [
      { id: 'grp1', name: 'Group 1', type: 'image', history: [], selectedIndex: 0 },
    ]));

    await holdTab(window);
    const placed = await window.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll('.mpi-radial__item')].map(b => [
        b.dataset.action,
        // --rx grows right, --ry grows DOWN (it is added to `top`).
        [Math.sign(parseFloat(b.style.getPropertyValue('--rx'))),
         Math.sign(parseFloat(b.style.getPropertyValue('--ry')))],
      ])));
    await window.keyboard.up('Tab');

    expect(placed).toEqual({
      gallery:   [-1, -1],   // top-left
      models:    [-1,  1],   // bottom-left
      flows:     [ 1, -1],   // top-right
      workspace: [ 1,  1],   // bottom-right
    });
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

test('the radial reaches the card, the gallery, Flows and the model picker', async ({}, testInfo) => {
  test.setTimeout(120000);
  const { app, window, consoleErrors, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    // MPI-848: the Models leg PICKS, and only falls back to the Library at zero installs.
    // A dev box has weights and a runner has none, so the leg is environment-dependent
    // unless one model is pinned usable here.
    await pinOneModelInstalled(window);
    await openGallery(window, makeProject(testInfo, [
      { id: 'grp1', name: 'Group 1', type: 'image', history: [], selectedIndex: 0 },
    ]));

    expect(await where(window)).toBe('gallery');

    await pick(window, 'workspace');
    await expect.poll(() => where(window), { timeout: 5000 }).toBe('group-history');

    await pick(window, 'gallery');
    await expect.poll(() => where(window), { timeout: 5000 }).toBe('gallery');

    await pick(window, 'flows');
    await expect(window.locator('.mpi-overlay--body .mpi-flow-library')).toBeVisible({ timeout: 5000 });

    // The Library is a BODY overlay — the case that stashes the whole #app-shell. The
    // radial has to open over it, on top of it, and take the gallery leg back out.
    await holdTab(window);
    expect(await onTop(window)).toBe(true);
    await aim(window, 'gallery');
    await window.keyboard.up('Tab');
    await expect(window.locator('.mpi-overlay--body .mpi-flow-library')).toHaveCount(0);
    await expect.poll(() => where(window), { timeout: 5000 }).toBe('gallery');

    await pick(window, 'models');
    await expect(window.locator('.mpi-model-picker')).toBeVisible({ timeout: 5000 });
    await expect(window.locator('.mpi-model-library'), 'the leg picks, it does not install')
      .toHaveCount(0);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

test('with no card to return to, Latest Workspace is dimmed and cannot be picked', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    await pinOneModelInstalled(window);
    await openGallery(window, makeProject(testInfo, []));
    await provokeNoWeights(window);
    await expect(window.locator('.mpi-modal'), 'no "No models installed" prompt over the gallery')
      .toHaveCount(0);

    await holdTab(window);
    await expect(window.locator('.mpi-radial__item[data-action="workspace"]'))
      .toHaveClass(/mpi-radial__item--disabled/);
    await aim(window, 'workspace');
    // Aimed straight at it and it still refuses to light up — the resolver drops it.
    await expect(window.locator('.mpi-radial__item[data-action="workspace"]'))
      .not.toHaveClass(/mpi-radial__item--active/);
    await window.keyboard.up('Tab');

    await window.waitForTimeout(500);
    expect(await where(window)).toBe('gallery');
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

// MPI-611's rule survives the radial: the Flows leg is the flow you are IN. It is
// PARKED — hidden, not destroyed — and comes back as the SAME instance, which is the
// half a re-mount would fake.
test('the Flows leg parks an open flow and comes back to the same instance', async ({}, testInfo) => {
  test.setTimeout(120000);
  const { app, window, consoleErrors, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    await openGallery(window, makeProject(testInfo, [
      { id: 'grp1', name: 'Group 1', type: 'image', history: [], selectedIndex: 0 },
    ]));

    // Straight through the event the Library's Open button emits — the flow's own
    // availability gate lives in the Library, and this spec is about the RADIAL.
    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('flow:open', { flowId: 'outpaint' });
      await new Promise(r => setTimeout(r, 800));
      // Stamp the live node so a re-mount cannot pass as a restore.
      document.querySelector('.mpi-base-flow').dataset.ringMark = 'same-instance';
    });
    await expect(window.locator('.mpi-base-flow')).toBeVisible();

    // Not stashed is only half of it — it has to PAINT over the flow's overlay, whose
    // z-index the overlay manager hands out at runtime.
    await holdTab(window);
    expect(await onTop(window)).toBe(true);
    await aim(window, 'gallery');
    await window.keyboard.up('Tab');
    await expect(window.locator('.mpi-base-flow')).toHaveCount(0);
    await expect.poll(() => where(window), { timeout: 5000 }).toBe('gallery');

    await pick(window, 'flows');
    await expect(window.locator('.mpi-base-flow')).toBeVisible({ timeout: 5000 });
    expect(await window.locator('.mpi-base-flow').getAttribute('data-ring-mark')).toBe('same-instance');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

// Focus mode used to `display: none` #radial-mount — harmless while the radial was a
// dev-only ring, silent once Tab opened it: the key still fired and still navigated.
test('focus mode does not hide the radial', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    await openGallery(window, makeProject(testInfo, [
      { id: 'grp1', name: 'Group 1', type: 'image', history: [], selectedIndex: 0 },
    ]));

    await window.keyboard.press('f');
    await expect(window.locator('body.mpi-focus-mode')).toHaveCount(1);
    // The chrome focus mode IS for stays hidden — this is not a licence to show it all.
    await expect(window.locator('#prompt-box-mount')).toBeHidden();

    await holdTab(window);
    expect(await onTop(window)).toBe(true);
    await aim(window, 'workspace');
    await window.keyboard.up('Tab');
    await expect.poll(() => where(window), { timeout: 5000 }).toBe('group-history');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});

// The Model Library used to BLOCK Tab (MPI-378 → MPI-811's first cut). Fabio, 2026-09-19:
// the radial is the app's selector, so it has to reach out of every surface, not just the
// ones that happen not to stash it.
test('the radial opens over the Model Library and takes you out of it', async ({}, testInfo) => {
  test.setTimeout(90000);
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await releaseBootGate(window);
    await openGallery(window, makeProject(testInfo, [
      { id: 'grp1', name: 'Group 1', type: 'image', history: [], selectedIndex: 0 },
    ]));

    await window.evaluate(async () => {
      const { Events } = await import('/js/events.js');
      Events.emit('models:open');
      await new Promise(r => setTimeout(r, 800));
    });
    await expect(window.locator('.mpi-overlay--body')).toBeVisible();

    await holdTab(window);
    expect(await onTop(window)).toBe(true);
    await aim(window, 'gallery');
    await window.keyboard.up('Tab');

    // Closed properly — `hide()`, which restores everything it stashed — rather than
    // navigated behind. A leftover `.mpi-overlay-stash` means the shell is still in it.
    await expect(window.locator('.mpi-overlay--body')).toHaveCount(0);
    await expect(window.locator('.mpi-overlay-stash')).toHaveCount(0);
    await expect(window.locator('#app-shell')).toBeVisible();
    expect(await where(window)).toBe('gallery');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
