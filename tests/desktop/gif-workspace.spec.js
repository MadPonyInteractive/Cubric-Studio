const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-769 — GIF history workspace: viewer, control bar, frame strip.
 *
 * `/gif/ensure-frames` and `/gif/entry` are stubbed on `window.fetch` (never
 * `page.route` — it does not see the renderer's own fetch, see
 * ~/.claude/memory/tools/tool_electron_ui_check_fixture_fetch.md), so this
 * spec needs no real project folder or frame files on disk. It still drives
 * the real client wiring end to end: MpiGifViewer, MpiGifControlBar and
 * MpiFrameStrip mounted by the real MpiGroupHistoryBlock, real keyboard/mouse
 * events, real `/gif/entry` request bodies asserted from the stub.
 */
test.setTimeout(120000);

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAFElEQVR42mNk+M9QzwAEjGQwACdfA/MhYO3qAAAAAElFTkSuQmCC';

const FRAME_HASHES = ['h1', 'h2', 'h3', 'h4', 'h5'];

async function setupProject(window) {
  await window.evaluate(({ imgUrl, hashes }) => {
    const baseFrames = hashes.map(hash => ({ hash, delay: 5, url: imgUrl, thumbUrl: imgUrl }));
    window.__mpi769 = {
      store: { iGif: { frames: baseFrames, loop: 1, output: { maxEdge: 1024, colours: 256, edgeColour: null } } },
      calls: [],
      previewCalls: [],
      seq: 0,
    };
    const orig = window.fetch.bind(window);
    window.fetch = (...args) => {
      const url = String(args[0] || '');
      const opts = args[1] || {};
      if (url.includes('/gif/ensure-frames')) {
        const body = JSON.parse(opts.body || '{}');
        const stored = window.__mpi769.store[body.itemId] || window.__mpi769.store.iGif;
        // Mirrors the real route's `withFrameUrls`: url/thumbUrl are resolved
        // fresh from the hash on EVERY call, never carried in the stored
        // sidecar shape (`/gif/entry`'s request/response only ever carries
        // {hash, delay} — see routes/gif.js).
        const withUrls = { ...stored, frames: stored.frames.map(f => ({ ...f, url: imgUrl, thumbUrl: imgUrl })) };
        return Promise.resolve(new Response(JSON.stringify({ success: true, gif: withUrls }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/gif/entry')) {
        const body = JSON.parse(opts.body || '{}');
        window.__mpi769.calls.push(body);
        window.__mpi769.seq += 1;
        const gifEntry = { frames: body.frames, loop: body.loop, output: body.output };
        const id = body.mode === 'update' ? body.itemId : `iGifNew${window.__mpi769.seq}`;
        const item = {
          id, type: 'image',
          // A real Update mints a NEW sequenced filename (E5) — this stands
          // in for it without touching disk; it is never actually loaded as
          // an image src in this spec (preview mode is never toggled on).
          filePath: `/project-file?path=Media%2Fmascot_${window.__mpi769.seq}.gif`,
          displayName: `mascot_${window.__mpi769.seq}`,
          gif: gifEntry,
        };
        window.__mpi769.store[id] = gifEntry;
        const respBody = body.mode === 'update'
          ? { success: true, item }
          : { success: true, item, group: { id: 'gGifNew', type: 'image', operation: 'gif', items: [item] } };
        return Promise.resolve(new Response(JSON.stringify(respBody),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      // MPI-771 audit: the GIF output tool's preview. The real route runs the
      // same buildGif() Apply runs (covered for real by tests/gif-preview.test.cjs);
      // here the stub records the body so the PANEL's half can be asserted
      // without ffmpeg or a project on disk.
      if (url.includes('/gif/preview')) {
        const body = JSON.parse(opts.body || '{}');
        window.__mpi769.previewCalls.push(body);
        return Promise.resolve(new Response(JSON.stringify({
          success: true, url: imgUrl, byteSize: 2048 * window.__mpi769.previewCalls.length,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(...args);
    };
  }, { imgUrl: TINY_PNG, hashes: FRAME_HASHES });

  return window.evaluate((imgUrl) => import('/js/state.js').then(({ state }) => {
    state.currentProject = {
      id: 'pGifWorkspace',
      name: 'Gif Workspace Test',
      folderPath: 'C:/tmp/gif-workspace-test',
      itemGroups: [{
        id: 'gGif',
        type: 'image',
        selectedIndex: 0,
        history: [{
          id: 'iGif', type: 'image', filePath: imgUrl, displayName: 'mascot',
          gif: { frames: [], loop: 1, output: { maxEdge: 1024, colours: 256, edgeColour: null } },
        }],
      }],
    };
  }), TINY_PNG);
}

/** { cur: control-bar counter text, current: strip's centred thumb index } */
function readCounter(window) {
  return window.evaluate(() => ({
    cur: document.querySelector('.mpi-gif-control-bar__current')?.textContent,
    current: document.querySelector('.mpi-frame-strip__thumb.is-current')?.dataset.index,
    total: document.querySelector('.mpi-gif-control-bar__total')?.textContent,
  }));
}

function thumbCount(window) {
  return window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length);
}

test('gif workspace: no PromptBox; play/step/scrub keep the strip centred; reorder+delete stage; Update rewrites, Apply adds', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-gif-viewer'))).toBe(true);

    // Plan scope item 6 — no model generates a GIF in v1.
    expect(await window.evaluate(() => !!document.querySelector('#prompt-box-mount .mpi-prompt-box'))).toBe(false);
    // gif's own tool list: Cut-out (MPI-771), Transform + Export (MPI-773), Timing + Output (MPI-772).
    expect(await window.evaluate(() => document.querySelectorAll('.mpi-history-tools__slot').length)).toBe(5);
    // No tool is up when a GIF opens: a Crop box would cover the frames.
    expect(await window.evaluate(() => !!document.querySelector('.mpi-gif-viewer__edit:not([hidden])'))).toBe(false);

    let c = await readCounter(window);
    expect(c.cur).toBe('0000');
    expect(c.current).toBe('0');
    expect(c.total).toBe(String(FRAME_HASHES.length - 1).padStart(4, '0'));

    // Step forward — video.frame.forward (ArrowRight), reused by
    // MpiGifControlBar (docs/video-player.md § GIF control bar).
    await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    c = await readCounter(window);
    expect(c.cur).toBe('0001');
    expect(c.current).toBe('1');

    // Play (space) — fixture loop:1 runs to the last frame then stops.
    await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })));
    await expect.poll(async () => (await readCounter(window)).cur, { timeout: 5000 })
      .toBe(String(FRAME_HASHES.length - 1).padStart(4, '0'));
    c = await readCounter(window);
    expect(c.current, 'the strip centre must match the frame the counter shows').toBe(String(FRAME_HASHES.length - 1));

    // Strip gestures use the REAL mouse: the strip listens to pointer events,
    // and a synthetic MouseEvent could never start the native drag that once
    // hijacked a hold-drag (MPI-771).
    const centreOf = (sel) => window.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, sel);

    // Scrub — dragging the track to the RIGHT reveals EARLIER frames.
    const t0 = await centreOf('.mpi-frame-strip__track');
    await window.mouse.move(t0.x, t0.y);
    await window.mouse.down();
    await window.mouse.move(t0.x + 400, t0.y, { steps: 4 });
    await window.mouse.up();
    c = await readCounter(window);
    expect(Number(c.current), 'scrubbing right must move toward frame 0').toBeLessThan(FRAME_HASHES.length - 1);
    expect(c.cur, 'counter and strip centre must always agree').toBe(String(c.current).padStart(4, '0'));

    // Reorder — a PLAIN drag on a thumb only scrubs (Fabio, 2026-09-16);
    // press and hold first, then drag the thumb at index 0 two slots right.
    // Staged only: no fetch yet, but the pill appears with a non-zero change count.
    const before = await thumbCount(window);
    // Visible, not just `hidden`: a `display` rule once kept the empty pill on screen.
    expect(await window.evaluate(() => !document.querySelector('.mpi-frame-strip__pill').checkVisibility()),
      'no pill before any edit').toBe(true);
    let p0;
    const dragThumb0 = async () => {
      p0 = await centreOf('.mpi-frame-strip__thumb[data-index="0"]');
      await window.mouse.move(p0.x, p0.y);
      await window.mouse.down();
    };
    const moveAndDrop = async () => {
      await window.mouse.move(p0.x + 140, p0.y, { steps: 4 });
      await window.mouse.up();
    };
    await dragThumb0();
    await moveAndDrop();
    expect(await window.evaluate(() => !document.querySelector('.mpi-frame-strip__pill').checkVisibility()),
      'a plain drag must not stage a reorder').toBe(true);
    await dragThumb0();
    await window.waitForTimeout(450);
    await moveAndDrop();
    expect(await thumbCount(window)).toBe(before);
    expect(await window.evaluate(() => !document.querySelector('.mpi-frame-strip__pill').checkVisibility()),
      'reorder must stage a pending change').toBe(false);
    expect(await window.evaluate(() => window.__mpi769.calls.length), 'staging must not call the server').toBe(0);
    c = await readCounter(window);
    expect(c.cur, 'a reorder must re-centre on the SAME frame content').toBe(String(c.current).padStart(4, '0'));

    // Delete — ctrl-click a thumb to select it, Backspace (`gif.frame.delete`
    // — NOT Delete/`history.selection.delete`, see hotkeyRegistry.js's
    // "GIF Player" section for why sharing that key would also wipe the
    // whole history entry) drops it. Still staged, still zero server calls.
    // `ctrlKey: true` is the REAL gesture and the bug this asserts against:
    // selecting means holding Ctrl, and the hand is still holding it at the
    // Backspace. `_normalizeKey` turns that into `control+backspace`, which
    // matched no registry entry, so the key was silently dead in the app while
    // this spec passed — because a scripted press carried no modifier
    // (Fabio, 2026-09-18). Line ~215 keeps the bare-Backspace path covered.
    await window.locator('.mpi-frame-strip__thumb[data-index="1"]').click({ modifiers: ['Control'] });
    await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true })));
    await expect.poll(() => thumbCount(window)).toBe(before - 1);
    expect(await window.evaluate(() => window.__mpi769.calls.length)).toBe(0);

    // Update — rewrites the CURRENT entry: same card count, one /gif/entry
    // call with mode:'update' carrying the staged (reordered + one deleted)
    // frame list, and a NEW built-file name (E5).
    await window.evaluate(() => document.querySelector('[data-mount="update-btn"] button').click());
    // The stub records a call BEFORE its response lands; the save's DOM
    // effects come after, so wait on them rather than read them at once.
    const cardCount = () => window.evaluate(() => document.querySelectorAll('#cards-slot > *').length);
    await expect.poll(() => window.evaluate(() => window.__mpi769.calls.length)).toBe(1);
    await expect.poll(() => window.evaluate(() => !document.querySelector('.mpi-frame-strip__pill').checkVisibility()),
      'a successful save must clear the pill').toBe(true);
    let snap = await window.evaluate(() => ({ call: window.__mpi769.calls[0] }));
    expect(snap.call.mode).toBe('update');
    expect(snap.call.itemId).toBe('iGif');
    expect(snap.call.frames.length).toBe(before - 1);
    expect(await cardCount(), 'Update must not add a new history card').toBe(1);

    // Apply — stage one more delete, then Apply must ADD a new history entry
    // (mode:'new') rather than rewrite.
    await window.locator('.mpi-frame-strip__thumb[data-index="0"]').click({ modifiers: ['Control'] });
    await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })));
    await window.evaluate(() => document.querySelector('[data-mount="apply-btn"] button').click());
    await expect.poll(() => window.evaluate(() => window.__mpi769.calls.length)).toBe(2);
    await expect.poll(cardCount, 'Apply must add a new history card').toBe(2);
    snap = await window.evaluate(() => ({ call: window.__mpi769.calls[1] }));
    expect(snap.call.mode).toBe('new');
    expect(snap.call.sourceItemId).toBe('iGif');
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-771, Fabio's second pass (2026-09-18). Two things he could not see:
 *   - deleting a frame needed Ctrl-click then Backspace, and nothing on
 *     screen said so — there is now a right-click menu;
 *   - the trim handles' range was legible only as numbers in the Trim panel,
 *     so Trim read as doing nothing — the range is now painted on the strip.
 * Both are driven here through the real components with real input.
 */
test('gif strip: right-click deletes a frame and offers the mask clear; the trim range paints on the strip', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-frame-strip__thumb'))).toBe(true);
    const before = await thumbCount(window);
    expect(before).toBe(FRAME_HASHES.length);

    // ── Context menu ────────────────────────────────────────────────────
    await window.locator('.mpi-frame-strip__thumb[data-index="2"]').click({ button: 'right' });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'))).toBe(true);
    const menu = await window.evaluate(() => [...document.querySelectorAll('.mpi-ctx-menu__item')].map(b => ({
      key: b.dataset.key,
      label: b.querySelector('.mpi-ctx-menu__label')?.textContent,
      disabled: b.disabled,
    })));
    expect(menu.map(i => i.key)).toEqual(['delete', 'clear-mask']);
    expect(menu[0].label).toBe('Delete frame');
    // No cut-out has run in this fixture, so there is no mask to clear — the
    // row must say so by being dead, not by doing nothing when clicked.
    expect(menu[1].disabled, 'Clear mask must be disabled with no mask on the frame').toBe(true);

    // Delete stages exactly like the Backspace path: one fewer thumb, the
    // pill up, and still nothing sent to the server.
    await window.locator('.mpi-ctx-menu__item[data-key="delete"]').click();
    await expect.poll(() => thumbCount(window)).toBe(before - 1);
    expect(await window.evaluate(() => !!document.querySelector('.mpi-frame-strip__pill').checkVisibility()),
      'a staged delete must raise the pill').toBe(true);
    expect(await window.evaluate(() => window.__mpi769.calls.length),
      'a staged delete must reach no server').toBe(0);
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu')),
      'the menu must dismiss itself after a choice').toBe(false);

    // ── Trim range painted on the strip ─────────────────────────────────
    // Untouched, the range is every frame: nothing dimmed, and the two edge
    // bars sit on the first and last thumbs.
    const paint = () => window.evaluate(() => ({
      outside: document.querySelectorAll('.mpi-frame-strip__thumb--outside').length,
      in: document.querySelector('.mpi-frame-strip__thumb--range-in')?.dataset.index,
      out: document.querySelector('.mpi-frame-strip__thumb--range-out')?.dataset.index,
    }));
    expect(await paint()).toEqual({ outside: 0, in: '0', out: String(before - 2) });

    // Drag the IN handle to the middle of the track with the real mouse — the
    // bar owns pointer capture, so a synthetic event would not move it.
    const box = await window.locator('.mpi-trim-bar__track').boundingBox();
    await window.locator('.mpi-trim-bar__handle--in').hover();
    await window.mouse.down();
    await window.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 8 });
    await window.mouse.up();

    await expect.poll(async () => (await paint()).outside,
      'frames the Trim tool would drop must dim on the strip').toBeGreaterThan(0);
    const after = await paint();
    expect(Number(after.in), 'the in edge must have moved off frame 0').toBeGreaterThan(0);
    expect(after.out, 'the out edge must not move with the in handle').toBe(String(before - 2));

    // ── Clear this frame's mask, with a mask actually there ─────────────
    // `.mpi-gif-viewer` IS the viewer's own `el`, so its mask API is reachable
    // from here (the same handle gif-cutout.spec.js drives).
    const tinted = () => window.evaluate(() =>
      [...document.querySelectorAll('.mpi-frame-strip__thumb')]
        .filter(t => t.querySelector('.mpi-frame-strip__thumb-tint'))
        .map(t => t.dataset.index));
    await window.evaluate((n) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas');
        c.width = c.height = 4;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 4, 4);
        out.push(c.toDataURL('image/png'));
      }
      document.querySelector('.mpi-gif-viewer').setTrackMasks(out);
    }, before - 1);
    await expect.poll(async () => (await tinted()).length, 'every frame is masked').toBe(before - 1);

    await window.locator('.mpi-frame-strip__thumb[data-index="1"]').click({ button: 'right' });
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-ctx-menu__item[data-key="clear-mask"]')?.disabled),
    'with a mask on the frame the clear must be live').toBe(false);
    await window.locator('.mpi-ctx-menu__item[data-key="clear-mask"]').click();

    // Exactly that frame loses its mask; the rest keep theirs. This is the
    // index the VIEWER keys masks by, not the strip's own staged index — the
    // two diverge after a reorder, which is why the menu emits `viewerIndex`.
    await expect.poll(async () => (await tinted()).length).toBe(before - 2);
    expect(await tinted(), 'only frame 1 may lose its mask')
      .not.toContain('1');
    expect(await window.evaluate(() => document.querySelector('.mpi-gif-viewer').hasFrameMasks()),
      'the other frames keep their masks').toBe(true);
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-771 consistency audit (Fabio, 2026-09-19) — the GIF STAGE joins the shared
 * context menu.
 *
 * It was the only viewer without one: `MpiCanvasViewer` and `MpiVideoViewer` both
 * emit `*-viewer:context-menu` and the Block builds their items. Reverse and Save
 * frame each had a rail button whose whole panel was a sentence and an Apply,
 * while the video workspace has always offered both as a right-click. This spec
 * asserts the new menu and that Reverse reaches the SAME `/gif/entry` request the
 * rail used to send.
 *
 * The stage menu is deliberately not the strip's: frame-scoped verbs (Delete
 * frame, Clear THIS frame's mask) stay on the thumbnail you clicked, which the
 * test above covers.
 */
test('gif stage: right-click reverses the frames and clears every mask; Save frame is on it', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-gif-viewer__stage'))).toBe(true);

    const openMenu = async () => {
      await window.locator('.mpi-gif-viewer__stage').click({ button: 'right' });
      await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'))).toBe(true);
      return window.evaluate(() => [...document.querySelectorAll('.mpi-ctx-menu__item')].map(b => ({
        key: b.dataset.key,
        label: b.querySelector('.mpi-ctx-menu__label')?.textContent,
        disabled: b.disabled,
      })));
    };

    // ── The menu itself ─────────────────────────────────────────────────
    let menu = await openMenu();
    expect(menu.map(i => i.key)).toEqual(['save-frame', 'reverse', 'clear-masks']);
    expect(menu.map(i => i.label)).toEqual(['Save frame as image', 'Reverse frames', 'Clear all masks']);
    // Nothing is masked in this fixture yet, so the clear must be DEAD rather
    // than silently doing nothing — the rule the strip's menu already follows.
    expect(menu[2].disabled, 'Clear all masks must be disabled with no masks').toBe(true);

    // ── Reverse -> the same `/gif/entry` body the rail used to send ──────
    await window.locator('.mpi-ctx-menu__item[data-key="reverse"]').click();
    await expect.poll(() => window.evaluate(() => window.__mpi769.calls.length), { timeout: 30000 }).toBe(1);
    const body = await window.evaluate(() => window.__mpi769.calls[0]);
    expect(body.mode, 'Reverse saves a NEW entry, it never rewrites in place').toBe('new');
    expect(body.frames.map(f => f.hash)).toEqual([...FRAME_HASHES].reverse());
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu')),
      'the menu must dismiss itself after a choice').toBe(false);

    // ── Clear all masks, with masks actually there ──────────────────────
    await window.evaluate((n) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas');
        c.width = c.height = 4;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 4, 4);
        out.push(c.toDataURL('image/png'));
      }
      document.querySelector('.mpi-gif-viewer').setTrackMasks(out);
    }, FRAME_HASHES.length);
    await expect.poll(() => window.evaluate(() => document.querySelector('.mpi-gif-viewer').hasFrameMasks())).toBe(true);

    menu = await openMenu();
    expect(menu[2].disabled, 'with masks on the frames the clear must be live').toBe(false);
    await window.locator('.mpi-ctx-menu__item[data-key="clear-masks"]').click();
    await expect.poll(() => window.evaluate(() => document.querySelector('.mpi-gif-viewer').hasFrameMasks()),
      'every frame loses its mask').toBe(false);
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-771 consistency audit finding 5 (Fabio, 2026-09-19) — the GIF output tool
 * gets the preview the video workspace's GIF Maker has always had.
 *
 * Colours, longest edge and transparency were judged by applying them and looking
 * at the card that came out. The pane is deliberately the same shape as
 * `MpiToolOptionsGif`'s: an empty state, a byte badge that goes STALE when the
 * settings move past the build on screen, and a button that runs a real encode.
 *
 * The route itself is covered for real (real frames, real ffmpeg, real byte count,
 * and that it writes no entry) by `tests/gif-preview.test.cjs`; `/gif/preview` is
 * stubbed here so the panel's half needs no project on disk.
 */
test('gif output: the preview pane encodes on demand and its badge goes stale with the settings', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-frame-strip__thumb'))).toBe(true);

    await window.evaluate(() => {
      document.querySelector('.mpi-history-tools__btn[data-info="GIF output"] button').click();
    });
    await window.waitForSelector('.mpi-tool-options-gif-timing__preview');

    const pane = () => window.evaluate(() => {
      const p = document.querySelector('.mpi-tool-options-gif-timing');
      const img = p.querySelector('#preview-img');
      const badge = p.querySelector('#preview-badge');
      return {
        emptyShown: !p.querySelector('#preview-empty').hidden,
        imgShown: !img.hidden,
        imgSrc: img.getAttribute('src'),
        badgeShown: !badge.hidden,
        badgeText: badge.textContent,
        stale: badge.classList.contains('mpi-tool-options-gif-timing__badge--stale'),
      };
    });

    // ── Empty state ─────────────────────────────────────────────────────
    expect(await pane()).toMatchObject({ emptyShown: true, imgShown: false, badgeShown: false });
    expect(await window.evaluate(() => window.__mpi769.previewCalls.length),
      'mounting the tool must not encode anything on its own').toBe(0);

    // ── Generate preview -> a real request with the CURRENT frames ──────
    await window.locator('.mpi-tool-options-gif-timing #preview-btn-slot button').click();
    await expect.poll(() => window.evaluate(() => window.__mpi769.previewCalls.length)).toBe(1);
    const body = await window.evaluate(() => window.__mpi769.previewCalls[0]);
    expect(body.frames.map(f => f.hash), 'the frames on screen, not the stored list').toEqual(FRAME_HASHES);
    expect(body.output).toMatchObject({ maxEdge: 1024, colours: 256 });
    // The tool changes neither of these, so it must send the entry's own.
    expect(body.loop, "the current entry's loop rides along unchanged").toBe(1);

    await expect.poll(async () => (await pane()).imgShown).toBe(true);
    expect(await pane()).toMatchObject({ emptyShown: false, badgeShown: true, badgeText: '2 KiB', stale: false });

    // ── A settings change marks it stale, and does NOT clear it ─────────
    // The pane keeps the last build precisely so the next one can be compared
    // against it; the badge is what says the settings have moved on.
    await window.locator('.mpi-tool-options-gif-timing input[inputmode="decimal"]').nth(1).fill('64');
    await expect.poll(async () => (await pane()).stale).toBe(true);
    expect((await pane()).imgShown, 'a stale preview stays on screen to compare against').toBe(true);

    // ── Encoding again clears the stale mark and reports the new size ───
    await window.locator('.mpi-tool-options-gif-timing #preview-btn-slot button').click();
    await expect.poll(() => window.evaluate(() => window.__mpi769.previewCalls.length)).toBe(2);
    expect((await window.evaluate(() => window.__mpi769.previewCalls[1])).output.colours).toBe(64);
    await expect.poll(async () => (await pane()).badgeText).toBe('4 KiB');
    expect((await pane()).stale).toBe(false);

    // ── The other timing tools have NO pane at all ─────────────────────

    // Removed, not `[hidden]`: a class carrying `display` outranks the UA sheet,
    // which is how three inert slider rows once reached the screen (MPI-382).
    await window.evaluate(() => {
      document.querySelector('.mpi-history-tools__btn[data-info="Speed"] button').click();
    });
    await window.waitForSelector('.mpi-tool-options-gif-timing');
    expect(await window.evaluate(() => !!document.querySelector('.mpi-tool-options-gif-timing__preview')),
      'Speed is not an encoder and must not carry a preview pane').toBe(false);
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-771 — a brush fix must survive a Track landing while CUT-OUT is the open
 * tool. This broke master once (run 35437964298) and this is its cheap guard.
 *
 * Cut-out mounts the canvas as a DISPLAY surface: it shows a flipped, adjusted
 * override and never loads the frame's brush layers. Marking that canvas as the
 * "edit frame" made `_refreshEditBase()` — which a landing `setTrackMask` calls —
 * save the canvas's EMPTY manual and subtract back over the real edits, silently
 * deleting the user's fix. `gif-cutout.spec.js` catches it end to end through a
 * real cut, but only in CI (its round-trip test needs a project on disk); this
 * one runs anywhere, in two seconds, off the stubbed fixture.
 */
test('gif cut-out: a Track landing must not wipe a brushed frame', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-frame-strip__thumb'))).toBe(true);

    const openTool = (info) => window.evaluate((name) => {
      document.querySelector(`.mpi-history-tools__btn[data-info="${name}"] button`).click();
    }, info);
    /** The brushed frames, as the strip paints them. */
    const editedDots = () => window.evaluate(() =>
      [...document.querySelectorAll('.mpi-frame-strip__thumb--edited')].map(t => t.dataset.index));

    // ── Brush frame 0 ───────────────────────────────────────────────────
    await openTool('Mask Brush');
    await expect.poll(() => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      return !!cv && cv.activeMode === 'mask';
    }), { timeout: 15000 }).toBe(true);
    await window.evaluate(() => document.querySelector('.mpi-gif-viewer__edit .mpi-canvas').setBrushSize(8));
    const pt = await window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      const r = cv.getBoundingClientRect();
      return { x: r.left + cv.offsetX + 6.5 * cv.scale, y: r.top + cv.offsetY + 6.5 * cv.scale };
    });
    await window.mouse.move(pt.x, pt.y);
    await window.mouse.down();
    await window.mouse.move(pt.x + 1, pt.y);
    await window.mouse.up();

    // Leaving the brush saves the frame.
    await openTool('Cut-out');
    await expect.poll(editedDots, 'frame 0 is brushed').toEqual(['0']);

    // Track All: EVERY frame gets a mask. That matters — Cut-out's override is
    // per frame, and stepping onto an unmasked frame nulls it, which hides the
    // bug behind the normal load path.
    const centreMask = (size) => window.evaluate((n) => {
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(n / 4, n / 4, n / 2, n / 2);
      return c.toDataURL('image/png');
    }, size);
    const m = await centreMask(8);
    await window.evaluate((url) => {
      document.querySelector('.mpi-gif-viewer').setTrackMasks([url, url, url, url, url]);
    }, m);

    // Step away and back. THIS is what puts the canvas in the state that loses
    // the fix: a frame load under the override shows the flipped bitmap and
    // skips the brush layers, so the canvas holds none of them.
    for (const idx of [1, 0]) {
      await window.locator(`.mpi-frame-strip__thumb[data-index="${idx}"]`).click();
      await expect.poll(() => window.evaluate((i) =>
        document.querySelector('.mpi-frame-strip__thumb.is-current')?.dataset.index === String(i), idx)).toBe(true);
    }

    // ── A second Track result lands on frame 0 (what By colour does, per frame) ──
    await window.evaluate((url) => {
      document.querySelector('.mpi-gif-viewer').setTrackMask(0, url);
    }, await centreMask(16));

    // THE ASSERTION IS A PIXEL, not the dot. The bug left the `--edited` dot and
    // a non-null mask URL in place — it emptied the mask's CONTENTS — so both of
    // those pass while the user's fix is gone. The brushed corner is at (6,6) and
    // the track above covers only the middle, so that one pixel separates
    // "brush + track" from "track alone".
    await expect.poll(editedDots, 'a landing track must not delete the brush fix').toEqual(['0']);
    const brushedCorner = await window.evaluate(async () => {
      const url = await document.querySelector('.mpi-gif-viewer').getFrameMaskURL(0);
      if (!url) return null;
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // The composed mask is opaque B/W (white = keep), the shape the cut reads.
      return ctx.getImageData(6, 6, 1, 1).data[0];
    });
    expect(brushedCorner, 'the brushed corner is still in the mask Cut out would send').toBe(255);
  } finally {
    await closeApp(app);
  }
});
