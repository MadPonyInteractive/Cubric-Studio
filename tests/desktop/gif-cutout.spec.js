const { test, expect } = require('@playwright/test');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-771 (UI half) — GIF cut-out tool group.
 *
 * Two tests, two boundaries (plus the mask-method switch of Decision 15:
 * Remove background / By name / By colour, all through the same track layer):
 *
 * 1. "panel routing + chip toggle" — a fixture project (`window.fetch` stubs
 *    for `/gif/ensure-frames` / `/gif-cutout/source`, never `page.route` — it
 *    does not reliably see the renderer's own fetch in this Electron setup,
 *    see ~/.claude/memory/tools/tool_electron_ui_check_fixture_fetch.md).
 *    Cheap, no real project on disk.
 *
 * 2. "real Track + real Cut-out round trip" — a REAL project, REAL uploaded
 *    stills, a REAL `POST /gif/make` card, and REAL `/gif-cutout/source` +
 *    `/gif-cutout/apply` (real ffmpeg, real files under `Media/.gif-frames/`).
 *    The ONLY thing faked is the GPU: `getEngine(forceLocal)`
 *    (js/services/comfyController.js) returns a mutable singleton, and
 *    `import('/js/services/comfyController.js')` from the page returns the
 *    SAME module instance the app uses, so `runWorkflow`/`httpBase` can be
 *    monkey-patched on both engines directly — no network-level interception
 *    needed for the one boundary (ComfyUI's `/prompt` + a raw WebSocket) this
 *    harness has no proven way to fake. A tiny Node `http` server stands in
 *    for ComfyUI's `/view` and serves a real mask PNG (white circle on
 *    black), so `applyMaskAlpha()` (routes/gifCutout.js) runs for real too —
 *    the Express server fetches the "mask" from this loopback server exactly
 *    as it would fetch a real ComfyUI `/view` URL.
 */
test.setTimeout(180000);

// ── Shared fixtures ─────────────────────────────────────────────────────────

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAFElEQVR42mNk+M9QzwAEjGQwACdfA/MhYO3qAAAAAElFTkSuQmCC';

const FRAME_HASHES = ['h1', 'h2', 'h3'];

async function setupProject(window) {
  await window.evaluate(({ imgUrl, hashes }) => {
    window.__mpi771 = { sourceCalls: [] };
    const orig = window.fetch.bind(window);
    window.fetch = (...args) => {
      const url = String(args[0] || '');
      const opts = args[1] || {};
      if (url.includes('/gif/ensure-frames')) {
        const frames = hashes.map(hash => ({ hash, delay: 10, url: imgUrl, thumbUrl: imgUrl }));
        const body = { success: true, gif: { frames, loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null } } };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/gif-cutout/source')) {
        const parsedBody = JSON.parse(opts.body || '{}');
        window.__mpi771.sourceCalls.push(parsedBody);
        const body = { success: true, videoPath: 'C:/tmp/gif-cutout-test/track.mkv', frameCount: parsedBody.frames?.length || 0, width: 8, height: 8 };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(...args);
    };
  }, { imgUrl: TINY_PNG, hashes: FRAME_HASHES });

  return window.evaluate((imgUrl) => import('/js/state.js').then(({ state }) => {
    state.currentProject = {
      id: 'pGifCutout',
      name: 'Gif Cutout Test',
      folderPath: 'C:/tmp/gif-cutout-test',
      itemGroups: [{
        id: 'gGifCutout',
        type: 'image',
        selectedIndex: 0,
        history: [{
          id: 'iGifCutout', type: 'image', filePath: imgUrl, displayName: 'mascot',
          gif: { frames: [], loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null } },
        }],
      }],
    };
  }), TINY_PNG);
}

async function openGroup(window, groupId) {
  await window.evaluate(async (id) => {
    const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
    navigate(PAGE_GROUP_HISTORY, { groupId: id });
  }, groupId);
  await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-gif-viewer'))).toBe(true);
}

// ── Test 1 — cheap: panel routing + chip toggle, no engine, no real project ─

test('gif cutout panel: routes, mounts with the right initial state, and drives chip toggle + Track request shape', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await openGroup(window, 'gGifCutout');
    // `_loadGifEntry`'s fetch is fire-and-forget from the Block's mount code —
    // wait for the frame strip to actually hold every seeded frame before
    // driving Track, or `viewer.el.getFrames()` can still read empty.
    await expect.poll(() => window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length))
      .toBe(FRAME_HASHES.length);

    // ── Panel routes ─────────────────────────────────────────────────────
    // The Cut-out button lives in the gif rail's own group (Compounds/
    // MpiHistoryTools GIF_TOOLS) — clicking it mounts MpiToolOptionsGifCutout.
    let dom = await window.evaluate(() => ({
      railHasCutout: !!document.querySelector('.mpi-history-tools__slot[data-mode="cutout"] .mpi-history-tools__btn'),
      panelBefore: !!document.querySelector('.mpi-tool-options-gif-cutout'),
    }));
    expect(dom.railHasCutout, 'gif rail must show the Cut-out group').toBe(true);
    expect(dom.panelBefore, 'no options panel mounted before a rail click').toBe(false);

    await window.evaluate(() => {
      document.querySelector('.mpi-history-tools__slot[data-mode="cutout"] .mpi-history-tools__btn button').click();
    });

    dom = await window.evaluate(() => {
      const panel = document.querySelector('.mpi-tool-options-gif-cutout');
      return {
        mounted: !!panel,
        promptField: !!document.querySelector('.mpi-tool-options-gif-cutout #prompt-slot .mpi-input'),
        promptHidden: document.querySelector('.mpi-tool-options-gif-cutout #prompt-slot')?.hidden,
        methods: [...document.querySelectorAll('.mpi-tool-options-gif-cutout #method-slot .mpi-radio-group__btn')].map(b => b.dataset.value),
        methodActive: document.querySelector('.mpi-tool-options-gif-cutout #method-slot .mpi-radio-group__btn.is-active')?.dataset.value,
        hint: document.querySelector('.mpi-tool-options-gif-cutout #hint')?.textContent || '',
        countField: !!document.querySelector('.mpi-tool-options-gif-cutout .mpi-input[type="number"], .mpi-tool-options-gif-cutout input[type="number"]'),
        trackBtnTexts: [...document.querySelectorAll('.mpi-tool-options-gif-cutout #track-slot button')].map(b => b.textContent.trim()),
        scopes: [...document.querySelectorAll('.mpi-tool-options-gif-cutout #scope-slot .mpi-radio-group__btn')].map(b => b.dataset.value),
        scopeActive: document.querySelector('.mpi-tool-options-gif-cutout #scope-slot .mpi-radio-group__btn.is-active')?.dataset.value,
        selectedDisabled: document.querySelector('.mpi-tool-options-gif-cutout #scope-slot .mpi-radio-group__btn[data-value="selected"]')?.getAttribute('aria-disabled'),
        previewHidden: document.querySelector('.mpi-tool-options-gif-cutout #preview-wrap')?.hidden,
        adjustHidden: document.querySelector('.mpi-tool-options-gif-cutout #adjust-section')?.hidden,
        chipCount: document.querySelectorAll('.mpi-tool-options-gif-cutout #chips-slot .mpi-checkbox__input').length,
        cutoutDisabled: document.querySelector('.mpi-tool-options-gif-cutout #cutout-slot button')?.disabled,
      };
    });
    expect(dom.mounted).toBe(true);
    expect(dom.promptField).toBe(true);
    expect(dom.countField, 'no count input (plan Decision 14): the chips are the count').toBe(false);
    // Decision 15: three methods, Remove background (BiRefNet) first and default.
    expect(dom.methods).toEqual(['birefnet', 'sam3', 'colour']);
    expect(dom.methodActive, 'Remove background is the default method').toBe('birefnet');
    expect(dom.promptHidden, 'no name field for Remove background').toBe(true);
    expect(dom.hint).toContain('foreground');
    // MPI-771, Fabio 2026-09-18: four buttons became two verbs + an All/Frame/
    // Selected scope, so Selected could be added without a fifth and sixth.
    expect(dom.trackBtnTexts).toEqual(['Mask', 'Clear']);
    expect(dom.scopes).toEqual(['all', 'frame', 'selected']);
    expect(dom.scopeActive, 'All is the default scope').toBe('all');
    expect(dom.selectedDisabled, 'Selected is refused until the strip has a selection').toBe('true');

    // By name: the name field and the SAM3 labels come back.
    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #method-slot .mpi-radio-group__btn[data-value="sam3"]').click());
    dom = await window.evaluate(() => ({
      promptHidden: document.querySelector('.mpi-tool-options-gif-cutout #prompt-slot')?.hidden,
      colourHidden: document.querySelector('.mpi-tool-options-gif-cutout #colour-section')?.hidden,
      hint: document.querySelector('.mpi-tool-options-gif-cutout #hint')?.textContent || '',
      trackBtnTexts: [...document.querySelectorAll('.mpi-tool-options-gif-cutout #track-slot button')].map(b => b.textContent.trim()),
      previewHidden: document.querySelector('.mpi-tool-options-gif-cutout #preview-wrap')?.hidden,
      adjustHidden: document.querySelector('.mpi-tool-options-gif-cutout #adjust-section')?.hidden,
      chipCount: document.querySelectorAll('.mpi-tool-options-gif-cutout #chips-slot .mpi-checkbox__input').length,
      cutoutDisabled: document.querySelector('.mpi-tool-options-gif-cutout #cutout-slot button')?.disabled,
    }));
    expect(dom.promptHidden).toBe(false);
    expect(dom.colourHidden).toBe(true);
    expect(dom.hint, 'the hint says the name is what stays').toContain('keep');
    // One verb per method now — By name no longer renames the buttons.
    expect(dom.trackBtnTexts).toEqual(['Mask', 'Clear']);
    expect(dom.previewHidden, 'preview/chips stay hidden before a Track run').toBe(true);
    expect(dom.adjustHidden, 'Mask Adjust stays hidden before a Track run').toBe(true);
    // The 4 chips exist from mount (OBJECT_SLOTS === max_objects, a fixed graph
    // literal, docs/masking-sam3-gif.md) — only their WRAPPER is hidden, so a
    // toggle can be driven directly without ever running Track (below).
    expect(dom.chipCount, 'the 4 fixed object chips are mounted up front').toBe(4);
    expect(dom.cutoutDisabled, 'Cut out starts disabled — no track result yet').toBe(true);

    // ── Chip toggle + "keep at least one" guard ─────────────────────────────
    // Real MpiCheckbox instances, real 'change' events — no Track needed: the
    // Set they drive is pure client state. Unchecking three of the four must
    // stick; the guard must revert the FOURTH (server-side '' means "keep
    // everything", the opposite of "keep nothing" — docs/masking-sam3-gif.md).
    const toggle = (index, checked) => window.evaluate(({ index, checked }) => {
      const inputs = document.querySelectorAll('.mpi-tool-options-gif-cutout #chips-slot .mpi-checkbox__input');
      const input = inputs[index];
      input.checked = checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { index, checked });

    await toggle(0, false);
    await toggle(1, false);
    await toggle(2, false);
    let chipState = await window.evaluate(() =>
      [...document.querySelectorAll('.mpi-tool-options-gif-cutout #chips-slot .mpi-checkbox__input')].map(i => i.checked));
    expect(chipState).toEqual([false, false, false, true]);

    // Uncheck the LAST kept chip — the guard must force it back on.
    await toggle(3, false);
    chipState = await window.evaluate(() =>
      [...document.querySelectorAll('.mpi-tool-options-gif-cutout #chips-slot .mpi-checkbox__input')].map(i => i.checked));
    expect(chipState, 'the last kept chip must be reverted, never let to zero').toEqual([false, false, false, true]);

    // ── The SELECTED scope (Fabio, 2026-09-18) ────────────────────────────
    // Ctrl-click two thumbs: the strip emits 'selection-change', the Block
    // forwards it, and the panel un-disables Selected. Toggling them back off
    // must hand the live scope back to All rather than leave a scope pointing
    // at nothing. Runs BEFORE the Track below, because a run in flight locks
    // the scope radio and turns the Mask button into Stop.
    // Dispatched rather than clicked: this test never clears the boot modals
    // and their backdrop intercepts a real click. These go through the strip's
    // OWN pointerdown/pointerup handlers, so the selection path is the real one
    // (the key NORMALISATION blind spot that hid the Backspace bug lives in
    // hotkeyManager, which this does not touch — gif-workspace.spec covers it).
    await ctrlClickThumb(window, 0);
    await ctrlClickThumb(window, 2);
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-tool-options-gif-cutout #scope-slot .mpi-radio-group__btn[data-value="selected"]')
        ?.getAttribute('aria-disabled'))).toBe('false');
    await pickScope(window, 'selected');
    await ctrlClickThumb(window, 0);
    await ctrlClickThumb(window, 2);
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-tool-options-gif-cutout #scope-slot .mpi-radio-group__btn.is-active')?.dataset.value))
      .toBe('all');
    // What a narrower scope DISPATCHES (a source video of just those frames)
    // is asserted by test 2's Frame-scope run — the same `picked` path.

    // ── Track dispatches /gif-cutout/source with the current frame list ────
    // This is the real, non-engine half of Track: folderPath + frames from
    // viewer.el.getFrames() (js/components/Organisms/MpiToolOptionsGifCutout).
    await window.evaluate(() => {
      const input = document.querySelector('.mpi-tool-options-gif-cutout #prompt-slot input');
      input.value = 'mascot';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #mask-btn-slot button').click());
    await expect.poll(() => window.evaluate(() => window.__mpi771.sourceCalls.length)).toBe(1);
    const call = await window.evaluate(() => window.__mpi771.sourceCalls[0]);
    expect(call.folderPath).toBe('C:/tmp/gif-cutout-test');
    expect(call.frames).toEqual(FRAME_HASHES.map(hash => ({ hash, delay: 10 })));

    expect(pageErrors, 'no uncaught renderer error from dispatching Track').toEqual([]);
  } finally {
    await closeApp(app);
  }
});

// ── Test 2 — real: Track + Cut-out round trip, GPU faked, everything else real ─

async function clearBootModals(window) {
  const backdrops = () => window.evaluate(
    () => document.querySelectorAll('.mpi-modal-backdrop').length);

  const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
  if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});

  for (let i = 0; i < 8 && await backdrops() > 0; i++) {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(400);
  }
  expect(await backdrops(), 'the boot modals must be gone').toBe(0);
}

/** A tiny solid-colour opaque RGB PNG of a given size (precedent: gif-make.spec.js). */
async function solidPng(r, g, b, w, h) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

/** White disc of `r` px radius on black — greyscale-as-RGB, opaque, the same
 *  shape `applyMaskAlpha()` (routes/gifCutout.js) reads off a real SAM3
 *  PreviewImage via its own `.greyscale()` pass. */
async function circleMaskPng(w, h, r) {
  const buf = Buffer.alloc(w * h * 3);
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
      const v = d <= r ? 255 : 0;
      const idx = (y * w + x) * 3;
      buf[idx] = v; buf[idx + 1] = v; buf[idx + 2] = v;
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

/** Minimal stand-in for ComfyUI's `/view?filename=...` — serves the mask PNG
 *  for `mask_*` filenames, the preview PNG for anything else. The REAL
 *  Express server (a different OS process) fetches from this over loopback
 *  exactly as it would fetch a real ComfyUI `/view` URL. */
function startMaskServer(maskBuf, previewBuf, emptyBuf) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      const filename = u.searchParams.get('filename') || '';
      // CORS like the real engine: the app starts ComfyUI with
      // `--enable-cors-header` (routes/comfy.js), and the tint and the brush's
      // base layer read mask pixels through `crossOrigin` images.
      res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' });
      // `mask_empty_*` = a track that found nothing (all black).
      res.end(filename.startsWith('mask_empty_') ? emptyBuf
        : filename.startsWith('mask_') ? maskBuf : previewBuf);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Click one gif-rail tool by its tooltip ('Cut-out', 'Mask Brush'). */
async function openRailTool(window, info) {
  await window.evaluate((name) => {
    document.querySelector(`.mpi-history-tools__slot[data-mode="cutout"] .mpi-history-tools__btn[data-info="${name}"] button`).click();
  }, info);
}

/** Ctrl-click a strip thumbnail through the strip's own pointer handlers. */
async function ctrlClickThumb(window, index) {
  await window.evaluate((i) => {
    const thumb = document.querySelector(`.mpi-frame-strip__thumb[data-index="${i}"]`);
    const opts = { bubbles: true, ctrlKey: true, pointerId: 1, clientX: 0, clientY: 0 };
    thumb.dispatchEvent(new PointerEvent('pointerdown', opts));
    window.dispatchEvent(new PointerEvent('pointerup', opts));
  }, index);
}

/** Pick who Mask and Clear act on: 'all', 'frame' or 'selected'. */
async function pickScope(window, value) {
  await window.evaluate((v) => {
    document.querySelector(`.mpi-tool-options-gif-cutout #scope-slot .mpi-radio-group__btn[data-value="${v}"]`).click();
  }, value);
  await expect.poll(() => window.evaluate(() =>
    document.querySelector('.mpi-tool-options-gif-cutout #scope-slot .mpi-radio-group__btn.is-active')?.dataset.value)).toBe(value);
}

/** Pick a Cut-out mask method (Decision 15) and wait for its buttons. */
async function pickMethod(window, value) {
  await window.evaluate((v) => {
    document.querySelector(`.mpi-tool-options-gif-cutout #method-slot .mpi-radio-group__btn[data-value="${v}"]`).click();
  }, value);
  // One verb for every method now — the scope says who it acts on.
  await expect.poll(() => window.evaluate(() =>
    document.querySelector('.mpi-tool-options-gif-cutout #mask-btn-slot button')?.textContent.trim())).toBe('Mask');
}

/** The Mask Brush canvas holds the viewer's CURRENT frame and is armed. */
async function waitEditFrame(window) {
  await expect.poll(() => window.evaluate(() => {
    const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
    const shown = document.querySelector('.mpi-gif-viewer__frame')?.getAttribute('src');
    const loaded = cv?.querySelector('canvas[data-media-url]')?.dataset.mediaUrl;
    return !!cv && cv.activeMode === 'mask' && !!shown && loaded === shown;
  }), { timeout: 15000 }).toBe(true);
}

/** A real mouse dab at image px (x, y) on the Mask Brush canvas. */
async function strokeAt(window, x, y) {
  const pt = await window.evaluate(({ x, y }) => {
    const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
    const r = cv.getBoundingClientRect();
    return { x: r.left + cv.offsetX + (x + 0.5) * cv.scale, y: r.top + cv.offsetY + (y + 0.5) * cv.scale };
  }, { x, y });
  await window.mouse.move(pt.x, pt.y);
  await window.mouse.down();
  await window.mouse.move(pt.x + 1, pt.y);
  await window.mouse.up();
}

/** Select a frame through the strip, the way a user steps frames. */
async function gotoFrame(window, idx) {
  await window.locator(`.mpi-frame-strip__thumb[data-index="${idx}"]`).click();
  await expect.poll(() => window.evaluate((i) =>
    document.querySelector('.mpi-frame-strip__thumb.is-current')?.dataset.index === String(i), idx)).toBe(true);
}

test('gif cutout: real Track dispatch + real Cut-out round trip (GPU engine faked, everything else real)', async ({}, testInfo) => {
  let app, window, maskServer;
  let projectFolderPath = null;

  try {
    ({ app, window } = await launchApp(testInfo));
    await window.waitForTimeout(6000); // shell boot settles (gif-make.spec.js precedent)
    await clearBootModals(window);

    // ── Real project on disk ────────────────────────────────────────────
    const projectName = `mpi771-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const project = await window.evaluate(async ({ name, folderPath }) => {
      const { createProject, openProject } = await import('/js/services/projectService.js');
      const p = await createProject(name, folderPath);
      await openProject(p);
      return p;
    }, { name: projectName, folderPath: testInfo.outputPath('projects') });
    projectFolderPath = project.folderPath;
    expect(project?.folderPath, 'the project must land on real disk').toBeTruthy();

    // ── Three real same-size stills -> real Make GIF ────────────────────
    // Same size on purpose (unlike gif-make.spec.js): no padding, so the cut
    // frame's pixel dimensions are exactly SZxSZ and the mask math below is
    // exact, not fit-to-canvas.
    const SZ = 64;
    const STILLS = [
      { r: 200, g: 40, b: 40, w: SZ, h: SZ, prefix: 'e2e-cutout-a' },
      { r: 40, g: 200, b: 40, w: SZ, h: SZ, prefix: 'e2e-cutout-b' },
      { r: 40, g: 40, b: 200, w: SZ, h: SZ, prefix: 'e2e-cutout-c' },
    ];

    async function importStill({ r, g, b, w, h, prefix }) {
      const buf = await solidPng(r, g, b, w, h);
      const base64 = buf.toString('base64');
      const itemId = crypto.randomUUID();
      return window.evaluate(async ({ project, itemId, base64, w, h, prefix }) => {
        const { Events } = await import('/js/events.js');
        const res = await fetch(
          `/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: `${prefix}_001.png`,
              base64Data: base64,
              autoSequence: true,
              itemId,
              mediaType: 'image',
              width: w,
              height: h,
            }),
          }
        );
        const data = await res.json();
        if (!data.success) throw new Error(`upload failed for ${prefix}: ${data.error}`);
        const groupId = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`project:group-added never fired for ${prefix}`)), 15000);
          const unsub = Events.on('project:group-added', ({ group }) => {
            if (group?.history?.[0]?.id !== itemId) return;
            clearTimeout(timer);
            unsub();
            resolve(group.id);
          });
          Events.emit('media:imported', {
            url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
            filename: data.filename,
            itemId,
            thumbPath: data.thumbPath || null,
            thumbPathLg: data.thumbPathLg || null,
            proxyPath: null,
            pixelDimensions: { w, h },
            mediaType: 'image',
          });
        });
        return { groupId, itemId };
      }, { project, itemId, base64, w, h, prefix });
    }

    const stills = [];
    for (const s of STILLS) stills.push(await importStill(s));

    await window.evaluate(async () => {
      const { navigate, PAGE_GALLERY } = await import('/js/router.js');
      navigate(PAGE_GALLERY);
    });
    const cardSel = (groupId) => `[data-group-id="${groupId}"] .mpi-group-card`;
    for (const g of stills) await window.waitForSelector(cardSel(g.groupId), { timeout: 15000 });

    for (const g of stills) await window.locator(cardSel(g.groupId)).click({ modifiers: ['Control'] });
    await window.locator(cardSel(stills[2].groupId)).click({ button: 'right' });
    const menuSel = '.mpi-ctx-menu__item[data-key="make-gif"]';
    await window.waitForSelector(menuSel);
    await window.locator(menuSel).click();

    await window.waitForSelector('.mpi-gif-viewer', { timeout: 30000 });
    await expect.poll(
      () => window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length),
      { timeout: 15000 }
    ).toBe(3);

    const gifInfo = await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      for (const g of state.currentProject.itemGroups) {
        const item = g.history[g.selectedIndex];
        if (item?.gif) return { groupId: g.id, itemId: item.id, frameCount: item.gif.frames.length };
      }
      return null;
    });
    expect(gifInfo, 'the new GIF card must land in state.currentProject.itemGroups').not.toBeNull();
    expect(gifInfo.frameCount).toBe(3);

    // ── Fake ONLY the GPU engine — same module instance the app uses ────
    const RADIUS = 20;
    const maskBuf = await circleMaskPng(SZ, SZ, RADIUS);
    const previewBuf = await solidPng(128, 128, 128, 16, 16);
    const emptyBuf = await solidPng(0, 0, 0, SZ, SZ);
    maskServer = await startMaskServer(maskBuf, previewBuf, emptyBuf);
    const maskPort = maskServer.address().port;

    await window.evaluate(async ({ port, frameCount }) => {
      const { getEngine } = await import('/js/services/comfyController.js');
      window.__mpi771 = { runParams: [], maskPrefix: 'mask_' };
      const fakeRunWorkflow = async (workflow, params, onMessage) => {
        window.__mpi771.runParams.push(params);
        const findId = (title) => Object.keys(workflow).find(
          id => (workflow[id]?._meta?.title || '').toLowerCase() === title);
        const previewId = findId('output_preview');
        const maskId = findId('output_mask');
        onMessage({ type: 'executed', data: { node: previewId, output: { images: [{ filename: 'preview.png', type: 'output', subfolder: '' }] } } });
        const images = Array.from({ length: frameCount }, (_, i) => ({ filename: `${window.__mpi771.maskPrefix}${i}.png`, type: 'output', subfolder: '' }));
        onMessage({ type: 'executed', data: { node: maskId, output: { images } } });
        return { success: true, images: [] };
      };
      const fakeHttpBase = () => `http://127.0.0.1:${port}`;
      for (const forceLocal of [false, true]) {
        const eng = getEngine(forceLocal);
        eng.runWorkflow = fakeRunWorkflow;
        eng.httpBase = fakeHttpBase;
      }
    }, { port: maskPort, frameCount: gifInfo.frameCount });

    // ── Open Cut-out: nothing to cut yet ────────────────────────────────
    await openRailTool(window, 'Cut-out');
    await pickMethod(window, 'sam3');
    await window.evaluate(() => {
      const input = document.querySelector('.mpi-tool-options-gif-cutout #prompt-slot input');
      input.value = 'mascot';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The name persists through the shared 300 ms settings debounce
    // (projectService `_enqueueToolUpdate`); the panel is about to remount.
    await expect.poll(() => window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.currentProject?.toolSettings?.gifCutout?.textPrompt;
    })).toBe('mascot');
    expect(await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #cutout-slot button')?.disabled),
      'Cut out starts disabled — no mask on any frame').toBe(true);

    // ── Brush BEFORE any track (Fabio: the brush works with no track) ────
    // Frame 0: paint a dab in the corner, outside where the track will land.
    await openRailTool(window, 'Mask Brush');
    await waitEditFrame(window);
    await window.evaluate(() => document.querySelector('.mpi-gif-viewer__edit .mpi-canvas').setBrushSize(8));
    await strokeAt(window, 6, 6);

    // Back to Cut-out: leaving the brush saved frame 0, so there is a mask now.
    await openRailTool(window, 'Cut-out');
    await expect.poll(() => window.evaluate(() =>
      document.querySelectorAll('.mpi-frame-strip__thumb--edited').length)).toBe(1);
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-tool-options-gif-cutout #cutout-slot button')?.disabled)).toBe(false);

    // ── Track All ────────────────────────────────────────────────────────
    // Fabio: "there is no feedback while SAM3 runs". Record the viewer spinner.
    await window.evaluate(() => {
      window.__mpi771.spin = [];
      const v = document.querySelector('.mpi-gif-viewer');
      const orig = v.setGenerating;
      v.setGenerating = (on) => { window.__mpi771.spin.push(on); orig(on); };
    });
    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #mask-btn-slot button').click());

    // Real /gif-cutout/source (real ffmpeg) runs before the (faked) engine
    // call, so give it real time.
    await expect.poll(() => window.evaluate(() => window.__mpi771.runParams.length), { timeout: 30000 }).toBe(1);
    let runParams = await window.evaluate(() => window.__mpi771.runParams[0]);
    expect(typeof runParams.Input_Video, 'a real temp track video path').toBe('string');
    expect(runParams.Input_Video.length).toBeGreaterThan(0);
    // No count input: every name is stamped with the 4 object slots
    // (js/utils/maskTextPrompt.js; a bare name finds ONE object).
    expect(runParams['Input_Text_Prompt.text']).toBe('mascot:4');
    expect(runParams['Input_Object_Indices.object_indices'], 'every chip starts kept -> empty string').toBe('');

    await expect.poll(
      () => window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #adjust-section')?.hidden),
      { timeout: 15000 }
    ).toBe(false);
    expect(await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #preview-wrap')?.hidden)).toBe(false);
    await expect.poll(() => window.evaluate(() => window.__mpi771.spin), { message: 'the viewer spun for the run, then stopped' })
      .toEqual([true, false]);
    // Every frame now carries a tint; the brushed frame keeps its marker.
    await expect.poll(() => window.evaluate(() =>
      document.querySelectorAll('.mpi-frame-strip__thumb-tint').length)).toBe(3);
    expect(await window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb--edited').length),
      'a re-track keeps the brush fix').toBe(1);

    // ── Toggle a chip -> cheap re-dispatch, real object_indices ─────────
    await window.evaluate(() => {
      const input = document.querySelectorAll('.mpi-tool-options-gif-cutout #chips-slot .mpi-checkbox__input')[1];
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(() => window.evaluate(() => window.__mpi771.runParams.length), { timeout: 15000 }).toBe(2);
    runParams = await window.evaluate(() => window.__mpi771.runParams[1]);
    expect(runParams['Input_Object_Indices.object_indices'], 'dropping chip 1 keeps 0,2,3').toBe('0,2,3');
    // No re-encode: the SAME video path is reused (frames unchanged) — the
    // engine note "re-dispatching object_indices is cheap" (docs/masking-sam3-gif.md).
    expect(runParams.Input_Video).toBe(await window.evaluate(() => window.__mpi771.runParams[0].Input_Video));

    // Keep chip 1 back on ('' = every object kept, the default).
    await window.evaluate(() => {
      const input = document.querySelectorAll('.mpi-tool-options-gif-cutout #chips-slot .mpi-checkbox__input')[1];
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(() => window.evaluate(() => window.__mpi771.runParams.length), { timeout: 15000 }).toBe(3);

    // ── Mask with the FRAME scope on frame 2: it finds nothing there ──────
    await gotoFrame(window, 2);
    await window.evaluate(() => { window.__mpi771.maskPrefix = 'mask_empty_'; });
    await pickScope(window, 'frame');
    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #mask-btn-slot button').click());
    await expect.poll(() => window.evaluate(() => window.__mpi771.runParams.length), { timeout: 30000 }).toBe(4);
    runParams = await window.evaluate(() => window.__mpi771.runParams[3]);
    expect(runParams.Input_Video, 'a one-frame source video, not the full one')
      .not.toBe(await window.evaluate(() => window.__mpi771.runParams[0].Input_Video));
    await expect.poll(() => window.evaluate(() =>
      document.querySelectorAll('.mpi-frame-strip__thumb-tint').length), { timeout: 15000 }).toBe(3);

    // ── Mask Adjust is set once: Invert survives a trip to the Mask Brush ─
    const invertInput = '.mpi-tool-options-gif-cutout #invert-slot .mpi-checkbox__input';
    const setInvert = (on) => window.evaluate(({ sel, on }) => {
      const input = document.querySelector(sel);
      input.checked = on;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { sel: invertInput, on });
    const savedInvert = () => window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.currentProject?.toolSettings?.gifCutout?.invert;
    });
    await setInvert(true);
    await expect.poll(savedInvert).toBe(true);

    // ── Brush frame 1: erase the centre of its track ─────────────────────
    await openRailTool(window, 'Mask Brush');
    // The GIF brush says where its fixes go (Fabio chose a note over a button).
    expect(await window.evaluate(() => document.querySelector('.mpi-tool-options-mask-brush__info')?.textContent || ''))
      .toContain('Cut-out');
    await gotoFrame(window, 1);
    await waitEditFrame(window);
    await window.evaluate(() => document.querySelector('.mpi-tool-options-mask-brush .mpi-radio-group__btn[data-value="eraser"]').click());
    await strokeAt(window, Math.floor(SZ / 2), Math.floor(SZ / 2));
    await openRailTool(window, 'Cut-out');
    await expect.poll(() => window.evaluate(() =>
      document.querySelectorAll('.mpi-frame-strip__thumb--edited').length)).toBe(2);
    expect(await window.evaluate((sel) => document.querySelector(sel)?.checked, invertInput),
      'Invert came back with the panel').toBe(true);
    await setInvert(false);
    await expect.poll(savedInvert).toBe(false);

    // ── Cut out -> real POST /gif-cutout/apply, real new history entry ──
    const historyLenNow = () => window.evaluate(async (gid) => {
      const { state } = await import('/js/state.js');
      return state.currentProject.itemGroups.find(g => g.id === gid).history.length;
    }, gifInfo.groupId);
    const before = await historyLenNow();

    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #cutout-slot button').click());
    await expect.poll(historyLenNow, { timeout: 30000 }).toBe(before + 1);

    const newEntry = await window.evaluate(async (gid) => {
      const { state } = await import('/js/state.js');
      const g = state.currentProject.itemGroups.find(x => x.id === gid);
      return g.history[g.history.length - 1];
    }, gifInfo.groupId);
    expect(newEntry.gif?.frames?.length, 'the cut entry keeps every frame').toBe(3);
    expect(newEntry.operation).toBe('gifCutout');
    expect(newEntry.pixelDimensions, 'never {0,0} (the ?×? bug)').toEqual({ w: SZ, h: SZ });

    // ── Sidecar on disk ──────────────────────────────────────────────────
    const sidecarPath = path.join(projectFolderPath, 'Media', '.meta', `${newEntry.id}.json`);
    expect(await fs.pathExists(sidecarPath), 'the new entry sidecar must exist on disk').toBe(true);
    const sidecar = await fs.readJson(sidecarPath);
    expect(sidecar.gif?.frames?.length).toBe(3);

    // ── Each cut frame's alpha follows ITS mask ──────────────────────────
    const alphaOf = async (frameIdx) => {
      const hash = sidecar.gif.frames[frameIdx].hash;
      const framePath = path.join(projectFolderPath, 'Media', '.gif-frames', `${hash}.png`);
      expect(await fs.pathExists(framePath), `cut frame ${frameIdx} must exist on disk`).toBe(true);
      const { data, info } = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
      return (x, y) => data[(y * info.width + x) * info.channels + 3];
    };
    const C = Math.floor(SZ / 2);
    const f0 = await alphaOf(0);
    expect(f0(C, C), 'frame 0: tracked centre kept').toBe(255);
    expect(f0(6, 6), 'frame 0: the brushed corner survived Track All').toBe(255);
    expect(f0(SZ - 7, SZ - 7), 'frame 0: an untouched corner is cut').toBe(0);
    const f1 = await alphaOf(1);
    expect(f1(C, C), 'frame 1: the erased centre is cut').toBe(0);
    expect(f1(C, C - 16), 'frame 1: the rest of its track is kept').toBe(255);
    const f2 = await alphaOf(2);
    expect(f2(C, C), 'frame 2: its single-frame track found nothing').toBe(0);

    // Fabio 2026-09-17: a cut-out is always a transparent GIF, and says how it was made.
    expect(sidecar.gif.output.edgeColour, 'a cut-out builds transparent').toBe('#000000');
    expect(sidecar.cutout).toEqual({
      method: 'sam3', prompt: 'mascot', objects: [0, 1, 2, 3],
      adjust: { grow: 0, fillHoles: false }, invert: false,
    });

    // ── Back on the source entry, its masks come back (no re-track) ─────
    await expect.poll(() => window.evaluate(() =>
      document.querySelectorAll('.mpi-frame-strip__thumb-tint').length), { timeout: 15000 }).toBe(0);
    await window.locator('.mpi-history-list__card').first().click();
    await expect.poll(() => window.evaluate(() =>
      document.querySelectorAll('.mpi-frame-strip__thumb-tint').length), { timeout: 15000 }).toBe(3);
    expect(await window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb--edited').length),
      'the brush fixes came back too').toBe(2);

    const runsBefore = await window.evaluate(() => window.__mpi771.runParams.length);
    // ── By colour: keyed in the renderer, no engine call ──────────────────
    // The current frame (0) is the red still, so red is keyed out: frame 0's
    // track goes black, green and blue stay white. Brush fixes still apply.
    await gotoFrame(window, 0);
    await pickMethod(window, 'colour');
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-tool-options-gif-cutout #key-colour-slot .mpi-color-picker')?.textContent || ''))
      .toContain('#c82828');

    // MPI-771 (Fabio, 2026-09-18): Pick had no icon, and MpiButton renders
    // `label` ONLY in icon mode — its plain-text branch reads `text` — so the
    // button drew as an empty grey box. The icon is what puts it in the mode
    // that renders the label, which is why one assertion covers both. Mask and
    // Clear split the row's full width, like the pickers above them.
    const layout = await window.evaluate(() => {
      const panel = document.querySelector('.mpi-tool-options-gif-cutout');
      const pick = panel.querySelector('#pick-slot button');
      const row = panel.querySelector('#track-slot');
      const [mask, clear] = [...row.querySelectorAll('button')];
      return {
        pickLabel: pick?.querySelector('.mpi-ibtn__label')?.textContent.trim() ?? null,
        pickIcon: !!pick?.querySelector('.mpi-icon'),
        // MpiCheckbox dropped `info` on the floor, so this switch was the one
        // control in the panel that said nothing on the status bar.
        edgesInfo: panel.querySelector('#edges-slot .mpi-checkbox')?.getAttribute('data-info') ?? null,
        rowW: row.getBoundingClientRect().width,
        maskW: mask.getBoundingClientRect().width,
        clearW: clear.getBoundingClientRect().width,
        gap: parseFloat(getComputedStyle(row).columnGap) || 0,
      };
    });
    expect(layout.pickLabel, 'Pick shows its label (MpiButton drops `label` without an icon)').toBe('Pick');
    expect(layout.pickIcon, 'Pick shows the eyedropper icon').toBe(true);
    expect(layout.edgesInfo, 'the edges switch reaches the status bar (MpiCheckbox renders `info`)')
      .toContain('frame edge');
    expect(Math.round(layout.maskW), 'Mask and Clear take an equal share').toBe(Math.round(layout.clearW));
    expect(Math.round(layout.maskW + layout.clearW + layout.gap), 'Mask and Clear span the row')
      .toBe(Math.round(layout.rowW));

    const spinsBefore = await window.evaluate(() => window.__mpi771.spin.length);
    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #mask-btn-slot button').click());
    await expect.poll(() => window.evaluate((n) => window.__mpi771.spin.slice(n), spinsBefore), { timeout: 15000 })
      .toEqual([true, false]);
    expect(await window.evaluate(() => window.__mpi771.runParams.length), 'By colour never calls the engine').toBe(runsBefore);

    const before2 = await historyLenNow();
    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #cutout-slot button').click());
    await expect.poll(historyLenNow, { timeout: 30000 }).toBe(before2 + 1);
    const keyed = await window.evaluate(async (gid) => {
      const { state } = await import('/js/state.js');
      const g = state.currentProject.itemGroups.find(x => x.id === gid);
      return g.history[g.history.length - 1];
    }, gifInfo.groupId);
    const keyedSidecar = await fs.readJson(path.join(projectFolderPath, 'Media', '.meta', `${keyed.id}.json`));
    expect(keyedSidecar.cutout).toEqual({
      method: 'colour', colour: '#c82828', tolerance: 16, edgesOnly: false,
      adjust: { grow: 0, fillHoles: false }, invert: false,
    });
    const keyedAlpha = async (frameIdx) => {
      const framePath = path.join(projectFolderPath, 'Media', '.gif-frames', `${keyedSidecar.gif.frames[frameIdx].hash}.png`);
      const { data, info } = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
      return (x, y) => data[(y * info.width + x) * info.channels + 3];
    };
    const k0 = await keyedAlpha(0);
    expect(k0(C, C), 'frame 0: the key colour is cut').toBe(0);
    expect(k0(6, 6), 'frame 0: the brushed corner is still kept').toBe(255);
    const k1 = await keyedAlpha(1);
    expect(k1(C, C), 'frame 1: the erased centre stays cut').toBe(0);
    expect(k1(SZ - 7, SZ - 7), 'frame 1: green is not the key, kept').toBe(255);
    const k2 = await keyedAlpha(2);
    expect(k2(C, C), 'frame 2: blue is not the key, kept').toBe(255);

    const runsAfterColour = await window.evaluate(() => window.__mpi771.runParams.length);

    // ── Remove background: the BiRefNet graph, video in, no name params ──
    await window.evaluate(async () => {
      window.__mpi771.graphs = [];
      const { getEngine } = await import('/js/services/comfyController.js');
      for (const forceLocal of [false, true]) {
        const eng = getEngine(forceLocal);
        const fake = eng.runWorkflow;
        eng.runWorkflow = (workflow, params, onMessage) => {
          window.__mpi771.graphs.push(Object.values(workflow).map(n => n.class_type));
          return fake(workflow, params, onMessage);
        };
      }
    });
    await pickMethod(window, 'birefnet');
    await window.evaluate(() => { window.__mpi771.maskPrefix = 'mask_'; });
    await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #mask-btn-slot button').click());
    await expect.poll(() => window.evaluate(() => window.__mpi771.runParams.length), { timeout: 30000 }).toBe(runsAfterColour + 1);
    const birefParams = await window.evaluate(() => window.__mpi771.runParams[window.__mpi771.runParams.length - 1]);
    expect(Object.keys(birefParams), 'BiRefNet takes the video only').toEqual(['Input_Video']);
    expect(await window.evaluate(() => window.__mpi771.graphs[0])).toContain('RemoveBackground');
    expect(await window.evaluate(() => document.querySelector('.mpi-tool-options-gif-cutout #preview-wrap')?.hidden),
      'no SAM3 object preview for Remove background').toBe(true);

    await new Promise((r) => maskServer.close(r));
    maskServer = null;
  } finally {
    if (maskServer) await new Promise((r) => maskServer.close(r));
    if (app) await closeApp(app);
    if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
  }
});

// ── Test 3 — the BASE layer's pixel rules (plan E9), real Chromium canvases ──

test('mask base layer: shows as mask, erase removes it, paint restores it, clear hides it and undo brings it back', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    const r = await window.evaluate(async () => {
      const { MaskManager } = await import('/js/components/Primitives/MpiCanvas/managers/MaskManager.js');
      const { UndoStack } = await import('/js/components/Primitives/MpiCanvas/managers/UndoStack.js');
      const mm = new MaskManager();
      mm.undo = new UndoStack();
      mm.init(20, 20);

      // An engine-style mask: opaque, white left half on black.
      const src = document.createElement('canvas');
      src.width = src.height = 20;
      const sctx = src.getContext('2d');
      sctx.fillStyle = 'black';
      sctx.fillRect(0, 0, 20, 20);
      sctx.fillStyle = 'white';
      sctx.fillRect(0, 0, 10, 20);
      await mm.setBaseFromDataURL(src.toDataURL('image/png'));

      const a = (x, y) => mm.maskCtx.getImageData(x, y, 1, 1).data[3];
      const dab = (type, x, y) => { mm.brushType = type; mm.brushSize = 4; mm.takeStrokeBox(); mm.paint(x, y); mm.takeStrokeBox(); };
      const out = { base: [a(3, 10), a(15, 10)], undoDepthAfterLoad: mm.undo.depth };

      dab('eraser', 3, 10);
      out.erased = a(3, 10);
      dab('brush', 3, 10);
      out.repainted = a(3, 10);
      dab('brush', 15, 10);
      out.paintedOutside = a(15, 10);

      mm.clear();
      out.cleared = [a(6, 5), a(15, 10)];
      out.undone = mm.undo.undo();
      mm.refresh();
      out.afterUndo = [a(6, 5), a(15, 10)];

      mm.init(20, 20);
      out.afterReload = a(6, 5);
      mm.destroy();
      return out;
    });

    expect(r.base, 'luma becomes coverage: white half masked, black half not').toEqual([255, 0]);
    expect(r.undoDepthAfterLoad, 'loading a base is not an undoable edit').toBe(0);
    expect(r.erased, 'erase removes base pixels').toBe(0);
    expect(r.repainted, 'paint puts them back').toBe(255);
    expect(r.paintedOutside, 'paint adds outside the base').toBe(255);
    expect(r.cleared, 'clear hides base and paint alike').toEqual([0, 0]);
    expect(r.undone).toBe(true);
    expect(r.afterUndo, 'undo brings both back').toEqual([255, 255]);
    expect(r.afterReload, 'a new image drops the base').toBe(0);
  } finally {
    await closeApp(app);
  }
});

// ── Test 4 — Fabio's first hands-on check (2026-09-16), fixture project ─────
//
// A stray strip drag reordered his frames and dropped every mask, the trim bar
// sat collapsed, a 320px GIF showed tiny, and Play did nothing in the Mask Brush.

const STRIP_HASHES = ['s0', 's1', 's2', 's3', 's4', 's5'];

/** Fixture with a stateful `/gif/entry` (the gif-workspace.spec.js pattern), so Update round-trips. */
async function setupStripProject(window) {
  await window.evaluate(({ imgUrl, hashes }) => {
    const store = { frames: hashes.map(hash => ({ hash, delay: 10 })), loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null } };
    window.__strip = { calls: [] };
    const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const orig = window.fetch.bind(window);
    window.fetch = (...args) => {
      const url = String(args[0] || '');
      const opts = args[1] || {};
      if (url.includes('/gif/ensure-frames')) {
        return json({ success: true, gif: { ...store, frames: store.frames.map(f => ({ ...f, url: imgUrl, thumbUrl: imgUrl })) } });
      }
      if (url.includes('/gif/entry')) {
        const body = JSON.parse(opts.body || '{}');
        window.__strip.calls.push(body);
        store.frames = body.frames;
        return json({ success: true, item: { id: body.itemId, type: 'image', filePath: imgUrl, displayName: 'strip', gif: { ...store } } });
      }
      return orig(...args);
    };
  }, { imgUrl: TINY_PNG, hashes: STRIP_HASHES });

  await window.evaluate((imgUrl) => import('/js/state.js').then(({ state }) => {
    state.currentProject = {
      id: 'pGifStrip', name: 'Gif Strip Test', folderPath: 'C:/tmp/gif-strip-test',
      itemGroups: [{
        id: 'gGifStrip', type: 'image', selectedIndex: 0,
        history: [{ id: 'iGifStrip', type: 'image', filePath: imgUrl, displayName: 'strip', gif: { frames: [], loop: 0 } }],
      }],
    };
  }), TINY_PNG);
}

test('gif strip: full trim range, frames fill the stage, a drag scrubs, hold-drag reorders under the pointer with no native drag, masks follow their frames, preview off and Play in the Mask Brush', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await setupStripProject(window);
    await openGroup(window, 'gGifStrip');
    await expect.poll(() => window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length))
      .toBe(STRIP_HASHES.length);

    // ── Trim bar: the whole GIF, not the one-frame range set before it loaded ─
    expect(await window.evaluate(() => ({
      in: document.querySelector('.mpi-gif-control-bar .mpi-trim-bar__handle--in').style.left,
      out: document.querySelector('.mpi-gif-control-bar .mpi-trim-bar__handle--out').style.left,
    }))).toEqual({ in: '0%', out: '100%' });

    // ── A 32px frame fills the stage (contained), it is not drawn at 32px ─────
    const fit = await window.evaluate(() => {
      const stage = document.querySelector('.mpi-gif-viewer__stage').getBoundingClientRect();
      const img = document.querySelector('.mpi-gif-viewer__frame');
      const r = img.getBoundingClientRect();
      return { dw: Math.abs(r.width - stage.width), dh: Math.abs(r.height - stage.height), natural: img.naturalWidth, stageH: stage.height };
    });
    expect(fit.stageH, 'the stage is bigger than the frame').toBeGreaterThan(fit.natural * 2);
    expect(fit.dw).toBeLessThan(1);
    expect(fit.dh).toBeLessThan(1);

    // ── One distinct mask per frame ───────────────────────────────────────────
    const urls = await window.evaluate(() => {
      const out = [];
      for (let i = 0; i < 6; i++) {
        const c = document.createElement('canvas');
        c.width = c.height = i + 2;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, c.width, c.height);
        out.push(c.toDataURL('image/png'));
      }
      document.querySelector('.mpi-gif-viewer').setTrackMasks(out);
      return out;
    });
    const maskAt = (i) => window.evaluate((idx) => document.querySelector('.mpi-gif-viewer').getFrameMaskURL(idx), i);
    const tintAt = (i) => window.evaluate((idx) =>
      document.querySelector(`.mpi-frame-strip__thumb[data-index="${idx}"] .mpi-frame-strip__thumb-tint`)?.style.maskImage || '', i);
    const order = () => window.evaluate(() => document.querySelector('.mpi-gif-viewer').getFrames().map(f => f.hash));
    // Visible, not just `hidden`: a `display` rule once kept the empty pill on screen.
    const pillHidden = () => window.evaluate(() => !document.querySelector('.mpi-frame-strip__pill').checkVisibility());
    const counter = () => window.evaluate(() => document.querySelector('.mpi-gif-control-bar__current').textContent);
    const thumbCentre = (i) => window.evaluate((idx) => {
      const r = document.querySelector(`.mpi-frame-strip__thumb[data-index="${idx}"]`).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, i);
    await expect.poll(() => tintAt(2)).toContain(urls[2]);

    // ── A plain drag on a thumbnail SCRUBS: nothing staged ───────────────────
    let p = await thumbCentre(0);
    await window.mouse.move(p.x, p.y);
    await window.mouse.down();
    await window.mouse.move(p.x - 140, p.y, { steps: 6 });
    await window.mouse.up();
    expect(await counter(), 'dragging left two slots moves two frames on').toBe('0002');
    expect(await pillHidden(), 'a drag must never stage a reorder').toBe(true);
    expect(await order()).toEqual(STRIP_HASHES);
    expect(await maskAt(2)).toBe(urls[2]);

    // ── A press on the strip takes focus off a text field, as a native press
    //    does (the strip owns its press; hotkeys skip a focused field) ─────────
    await window.evaluate(() => {
      const i = document.createElement('input');
      i.id = 'focus-probe';
      document.body.appendChild(i);
      i.focus();
    });
    await window.locator('.mpi-frame-strip__thumb[data-index="2"]').click();
    expect(await window.evaluate(() => document.activeElement?.id)).not.toBe('focus-probe');
    await window.evaluate(() => document.getElementById('focus-probe').remove());

    // ── Press and hold, then drag: a reorder, and the masks travel along ─────
    const holdDrag = async (from, dx) => {
      const c = await thumbCentre(from);
      await window.mouse.move(c.x, c.y);
      await window.mouse.down();
      await window.waitForTimeout(450);
      const lifted = await window.evaluate((idx) =>
        document.querySelector(`.mpi-frame-strip__thumb[data-index="${idx}"]`).classList.contains('mpi-frame-strip__thumb--lifted'), from);
      await window.mouse.move(c.x + dx, c.y, { steps: 3 });
      await window.mouse.up();
      return lifted;
    };
    const REORDERED = ['s0', 's1', 's3', 's2', 's4', 's5'];
    expect(await holdDrag(2, 70), 'a held thumbnail lifts').toBe(true);
    expect(await order()).toEqual(REORDERED);
    expect(await pillHidden()).toBe(false);
    expect(await counter(), 'the view stays on the moved frame').toBe('0003');
    expect(await maskAt(3), 'frame s2 kept its mask at its new place').toBe(urls[2]);
    expect(await maskAt(2)).toBe(urls[3]);
    expect(await tintAt(3)).toContain(urls[2]);

    // ── Discard puts the frames and their masks back ─────────────────────────
    await window.evaluate(() => document.querySelector('[data-mount="discard-btn"] button').click());
    expect(await order()).toEqual(STRIP_HASHES);
    expect(await pillHidden()).toBe(true);
    expect(await maskAt(2)).toBe(urls[2]);
    expect(await maskAt(3)).toBe(urls[3]);

    const lifted = () => window.evaluate(() => {
      const l = document.querySelector('.mpi-frame-strip__thumb--lifted');
      if (!l) return null;
      const r = l.getBoundingClientRect();
      return { idx: l.dataset.index, cx: r.left + r.width / 2 };
    });
    const clickDiscard = async () => {
      const r = await window.evaluate(() => {
        const b = document.querySelector('[data-mount="discard-btn"] button').getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      });
      await window.mouse.click(r.x, r.y);
    };

    // ── A held thumb stays under the pointer: 140 px is two slots, not four ──
    let h = await thumbCentre(1);
    await window.mouse.move(h.x, h.y);
    await window.mouse.down();
    await window.waitForTimeout(450);
    await window.mouse.move(h.x + 140, h.y, { steps: 20 });
    const held = await lifted();
    expect(held.idx, 'two slots of pointer travel = two slots').toBe('3');
    expect(Math.abs(held.cx - (h.x + 140)), 'the lifted thumb sits under the pointer').toBeLessThan(35);
    await window.mouse.up();
    expect(await order()).toEqual(['s0', 's2', 's3', 's1', 's4', 's5']);
    await clickDiscard();
    expect(await order()).toEqual(STRIP_HASHES);

    // ── A text selection over the strip must not turn a hold-drag into a
    //    native drag (the "copy" ghost), which never delivers the release ──────
    await window.evaluate(() => {
      window.__nativeDrags = 0;
      window.addEventListener('dragstart', () => { window.__nativeDrags++; }, true);
      document.getSelection().selectAllChildren(document.body);
    });
    await holdDrag(2, 70);
    expect(await window.evaluate(() => window.__nativeDrags), 'no native drag').toBe(0);
    expect(await lifted(), 'the release put the thumb down').toBe(null);
    expect(await order()).toEqual(REORDERED);
    h = await thumbCentre(2);
    await window.mouse.move(h.x + 300, h.y, { steps: 8 });
    await window.mouse.move(h.x - 300, h.y, { steps: 8 });
    expect(await order(), 'hovering with no button pressed never edits').toEqual(REORDERED);
    await clickDiscard();
    expect(await order()).toEqual(STRIP_HASHES);
    expect(await pillHidden(), 'Discard stays put').toBe(true);
    await window.evaluate(() => document.getSelection().removeAllRanges());

    // ── Update saves the order and keeps every mask ──────────────────────────
    await holdDrag(2, 70);
    expect(await order()).toEqual(REORDERED);
    await window.evaluate(() => document.querySelector('[data-mount="update-btn"] button').click());
    await expect.poll(() => window.evaluate(() => window.__strip.calls.length)).toBe(1);
    await expect.poll(pillHidden).toBe(true);
    expect(await window.evaluate(() => window.__strip.calls[0].frames.map(f => f.hash))).toEqual(REORDERED);
    expect(await maskAt(3), 'an Update never drops masks').toBe(urls[2]);
    expect(await maskAt(0)).toBe(urls[0]);
    await expect.poll(() => tintAt(3)).toContain(urls[2]);

    // ── The GIF preview button is off while the Mask Brush is up ─────────────
    const previewDisabled = () => window.evaluate(() =>
      document.querySelector('.mpi-gif-control-bar [data-mount="preview-toggle"] button').disabled);
    expect(await previewDisabled()).toBe(false);
    await openRailTool(window, 'Mask Brush');
    await waitEditFrame(window);
    expect(await previewDisabled(), 'the brush paints frames, not the built file').toBe(true);
    await openRailTool(window, 'Cut-out');
    await expect.poll(previewDisabled).toBe(false);

    // ── Play in the Mask Brush plays the frames under their tint ─────────────
    await openRailTool(window, 'Mask Brush');
    await waitEditFrame(window);
    const playBtn = '.mpi-gif-control-bar [data-mount="play"] button';
    const editState = () => window.evaluate(() => {
      const tint = document.querySelector('.mpi-gif-viewer__mask-tint');
      return {
        playing: document.querySelector('.mpi-gif-viewer__edit').classList.contains('mpi-gif-viewer__edit--playing'),
        frameHidden: document.querySelector('.mpi-gif-viewer__frame-wrap').hidden,
        tint: tint.classList.contains('mpi-gif-viewer__mask-tint--visible') && tint.classList.contains('mpi-gif-viewer__mask-tint--luma'),
      };
    });
    expect(await editState()).toEqual({ playing: false, frameHidden: true, tint: false });
    const startFrame = await counter();
    await window.evaluate((sel) => document.querySelector(sel).click(), playBtn);
    expect(await editState()).toEqual({ playing: true, frameHidden: false, tint: true });
    await expect.poll(counter, { timeout: 5000 }).not.toBe(startFrame);
    await window.evaluate((sel) => document.querySelector(sel).click(), playBtn);
    expect(await editState()).toEqual({ playing: false, frameHidden: true, tint: false });
    await waitEditFrame(window);

    expect(pageErrors).toEqual([]);
  } finally {
    await closeApp(app);
  }
});
