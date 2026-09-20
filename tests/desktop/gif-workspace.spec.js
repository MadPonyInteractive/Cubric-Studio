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
    // Four groups since MPI-836: Cut-out, Transform, Output, Export. The
    // Timing group went with Trim, Speed and Loop count.
    expect(await window.evaluate(() => document.querySelectorAll('.mpi-history-tools__slot').length)).toBe(4);
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
 *
 * MPI-857 adds the menu's third row, Duplicate frame — asserted here because
 * nothing else pins the row order or that a copy stages without a server call.
 */
test('gif strip: right-click duplicates and deletes a frame and offers the mask clear; the trim range paints on the strip', async ({}, testInfo) => {
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
    expect(menu.map(i => i.key)).toEqual(['duplicate', 'delete', 'clear-mask']);
    expect(menu[0].label).toBe('Duplicate frame');
    expect(menu[1].label).toBe('Delete frame');
    // No cut-out has run in this fixture, so there is no mask to clear — the
    // row must say so by being dead, not by doing nothing when clicked.
    expect(menu[2].disabled, 'Clear mask must be disabled with no mask on the frame').toBe(true);

    // Duplicate (MPI-857) stages a copy right AFTER the frame, the way every
    // other strip edit stages: one more thumb, the pill up, no server call.
    await window.locator('.mpi-ctx-menu__item[data-key="duplicate"]').click();
    await expect.poll(() => thumbCount(window)).toBe(before + 1);
    expect(await window.evaluate(() => !!document.querySelector('.mpi-frame-strip__pill').checkVisibility()),
      'a staged duplicate must raise the pill').toBe(true);
    expect(await window.evaluate(() => window.__mpi769.calls.length),
      'a staged duplicate must reach no server').toBe(0);
    // The copy lands directly after its source: the hash repeats, and only there.
    expect(await window.evaluate(() =>
      document.querySelector('.mpi-frame-strip').getStagedFrames().map(f => f.hash)),
    ).toEqual(['h1', 'h2', 'h3', 'h3', 'h4', 'h5']);
    // ...and Discard takes it back, so the rest of this test runs on the original
    // list — and the menu closed on the choice, so the delete re-opens it.
    await window.evaluate(() => document.querySelector('[data-mount="discard-btn"] button').click());
    await expect.poll(() => thumbCount(window)).toBe(before);

    // Delete stages exactly like the Backspace path: one fewer thumb, the
    // pill up, and still nothing sent to the server.
    await window.locator('.mpi-frame-strip__thumb[data-index="2"]').click({ button: 'right' });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'))).toBe(true);
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

    // A GIF carries no audio, so MpiTrimBar's wave layer must paint NOTHING here. Left
    // to `mask-image: none` it is UNMASKED, a solid slab from cap to cap (MPI-834). And
    // the bar keeps the 28px track: the 44px one exists for a waveform it never has.
    expect(await window.evaluate(() => ({
      wave: document.querySelector('.mpi-gif-control-bar .mpi-trim-bar__wave').getClientRects().length,
      track: document.querySelector('.mpi-gif-control-bar .mpi-trim-bar__track').getBoundingClientRect().height,
    }))).toEqual({ wave: 0, track: 28 });

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

    // Reverse is not over when its REQUEST is. The response reloads the viewer
    // with the new entry's frames, and a new frame list makes every position-keyed
    // mask meaningless, so `_syncMasks` throws them away. Planting masks before
    // that reload landed let it wipe them a beat later — the poll below then sat
    // out its five seconds on a store that would never refill (MPI-861: one
    // failure in four when this spec shares a run with gif-cutout.spec.js).
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-gif-viewer').getFrames().map(f => f.hash).join(',')),
    'the reversed entry must be loaded before any mask is planted on it',
    ).toBe([...FRAME_HASHES].reverse().join(','));

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
    // Fields since MPI-836: 0 rate, 1 loop, 2 longest edge, 3 colours.
    await window.locator('.mpi-tool-options-gif-timing input[inputmode="decimal"]').nth(3).fill('64');
    await expect.poll(async () => (await pane()).stale).toBe(true);
    expect((await pane()).imgShown, 'a stale preview stays on screen to compare against').toBe(true);

    // ── Encoding again clears the stale mark and reports the new size ───
    await window.locator('.mpi-tool-options-gif-timing #preview-btn-slot button').click();
    await expect.poll(() => window.evaluate(() => window.__mpi769.previewCalls.length)).toBe(2);
    expect((await window.evaluate(() => window.__mpi769.previewCalls[1])).output.colours).toBe(64);
    await expect.poll(async () => (await pane()).badgeText).toBe('4 KiB');
    expect((await pane()).stale).toBe(false);

    // ── MPI-836: the TRIM RANGE and the rate are part of what it built ──
    // The preview runs the same `_gifOutputEntry()` Apply does, so a moved handle
    // changes the file it would produce — the badge has to say so, exactly as a
    // colour change does, or the pane shows a build of frames nobody asked for.
    await window.evaluate(() => document.querySelector('.mpi-gif-control-bar .mpi-trim-bar').setRange(1, 2));
    await expect.poll(async () => (await pane()).stale, { timeout: 5000 }).toBe(true);

    await window.locator('.mpi-tool-options-gif-timing #preview-btn-slot button').click();
    await expect.poll(() => window.evaluate(() => window.__mpi769.previewCalls.length)).toBe(3);
    const ranged = await window.evaluate(() => window.__mpi769.previewCalls[2]);
    expect(ranged.frames.map(f => f.hash), 'the preview encodes the trimmed range').toEqual(['h2', 'h3']);

    // ...and so is the frame rate, which is this panel's since MPI-836.
    await window.locator('.mpi-tool-options-gif-timing input[inputmode="decimal"]').first().fill('20');
    await expect.poll(async () => (await pane()).stale, { timeout: 5000 }).toBe(true);
    await window.locator('.mpi-tool-options-gif-timing #preview-btn-slot button').click();
    await expect.poll(() => window.evaluate(() => window.__mpi769.previewCalls.length)).toBe(4);
    expect((await window.evaluate(() => window.__mpi769.previewCalls[3])).frames.map(f => f.delay),
      'a typed rate retimes what the preview builds').toEqual([5, 5]);
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

/**
 * MPI-771, Fabio's SECOND pass (2026-09-19). Four of his five items, in one
 * launch — the fifth (the "Mask Preview" label and Cut out moving below the
 * strip) is pure panel order and is his to look at.
 *
 * Each assertion is written against the BUG, not the fix: run it on HEAD~ and
 * every one of them fails. The tint one especially — it asserts the DOM state
 * the flash comes from, because a CSS transition mid-fade is not something a
 * spec can catch in the act.
 */
test('gif second pass: Shift ranges the strip, the mask toggles carry between tools, Space plays in Cut-out, and the tint hides without a white frame', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-frame-strip__thumb'))).toBe(true);

    const selected = () => window.evaluate(() =>
      [...document.querySelectorAll('.mpi-frame-strip__thumb.is-selected')].map(t => t.dataset.index).sort());

    // ── 1. Shift is a RANGE, not a second Ctrl ──────────────────────────
    // It was `const modifier = e.ctrlKey || e.metaKey || e.shiftKey` with one
    // toggle behind it, so a Shift-click selected exactly the thumb under the
    // pointer and this came back as ['3'].
    await window.locator('.mpi-frame-strip__thumb[data-index="0"]').click();
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-frame-strip__thumb.is-current')?.dataset.index)).toBe('0');
    await window.locator('.mpi-frame-strip__thumb[data-index="3"]').click({ modifiers: ['Shift'] });
    expect(await selected(), 'Shift must take the whole run from the anchor').toEqual(['0', '1', '2', '3']);

    // Shrinking the range keeps the same anchor rather than adding to it.
    await window.locator('.mpi-frame-strip__thumb[data-index="1"]').click({ modifiers: ['Shift'] });
    expect(await selected(), 'a second Shift-click re-ranges from the anchor').toEqual(['0', '1']);

    // Ctrl is untouched: it still toggles the one thumb, and it re-anchors.
    await window.locator('.mpi-frame-strip__thumb[data-index="4"]').click({ modifiers: ['Control'] });
    expect(await selected()).toEqual(['0', '1', '4']);
    await window.locator('.mpi-frame-strip__thumb[data-index="2"]').click({ modifiers: ['Shift'] });
    expect(await selected(), 'Ctrl moved the anchor to 4, so the range runs back to 2').toEqual(['2', '3', '4']);

    // A plain click drops the selection again.
    await window.locator('.mpi-frame-strip__thumb[data-index="0"]').click();
    expect(await selected()).toEqual([]);

    const openTool = (info) => window.evaluate((name) => {
      document.querySelector(`.mpi-history-tools__btn[data-info="${name}"] button`).click();
    }, info);
    const stripUp = () => window.evaluate(() => !!document.querySelector('.mpi-mask-strip__invert'));
    const isPlaying = () => window.evaluate(() => document.querySelector('.mpi-gif-viewer').isPlaying());

    // ── 2. Space PLAYS in Cut-out ───────────────────────────────────────
    // `canvas.pan.start` and `video.playPause` share the key, so the control
    // bar has to stand one down — but Cut-out mounts the strip with
    // `brush: false`, so a bare left-drag already pans there and Space is
    // free. It used to stand down for ANY canvas tool, so this stayed false.
    await openTool('Cut-out');
    await expect.poll(stripUp, { timeout: 15000 }).toBe(true);
    await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })));
    await expect.poll(isPlaying, 'Space must play in Cut-out').toBe(true);
    await window.evaluate(() => document.querySelector('.mpi-gif-viewer').pause());

    // ── 3. The mask display toggles carry across the tool switch ────────
    // Both tools mount MpiMaskStrip with `dest: 'mask'`, so they already share
    // the settings key; what broke is WHEN it is read. The strip reads once at
    // mount, and `settings:tool:update` is debounced 300 ms before it reaches
    // `state.currentProject`. Both clicks below are in ONE synchronous task,
    // so not a millisecond of that debounce can elapse between them — which is
    // exactly the window a real toggle-then-switch lands in.
    // Read the CANVAS, not the button. The button's `is-active` class is set by
    // the strip itself and survives a mount that never reached the canvas, so an
    // assertion on it passes under the bug - the trap this card has now hit four
    // times. `isMaskInverted()` is the mask's own state.
    const invertOn = () => window.evaluate(() => ({
      canvas: !!document.querySelector('.mpi-gif-viewer').isMaskInverted(),
      button: !!document.querySelector('.mpi-mask-strip__invert')?.classList.contains('is-active'),
    }));
    expect(await invertOn(), 'invert starts off').toEqual({ canvas: false, button: false });
    await window.evaluate(() => {
      // The strip's invert is an ICON button, and MpiButton's icon mode makes the
      // <button> itself the root — there is no inner one to reach for.
      document.querySelector('.mpi-mask-strip__invert').click();
      document.querySelector('.mpi-history-tools__btn[data-info="Mask Brush"] button').click();
    });
    await expect.poll(() => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      return !!cv && cv.activeMode === 'mask';
    }), { timeout: 15000 }).toBe(true);
    expect(await invertOn(), 'the Mask Brush must inherit the invert Cut-out just set')
      .toEqual({ canvas: true, button: true });

    // ── 3b. Double-click snaps the view back, in a mask tool that does not paint ──
    // Same narrowing as Space: the gate was "a mask mode is up", so Cut-out - which
    // mounts the strip with `brush: false` and therefore pans on a bare drag - could
    // not double-click back to fit either (Fabio, 2026-09-19). The Mask Brush keeps
    // it, where a double-click is two dabs.
    await openTool('Cut-out');
    await expect.poll(stripUp, { timeout: 15000 }).toBe(true);
    const zoomOut = () => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      cv.isManagedView = false;
      cv.scale = cv.scale * 3;
      cv.offsetX -= 40;
      return cv.scale;
    });
    const zoomed = await zoomOut();
    await window.locator('.mpi-gif-viewer__edit .mpi-canvas').dblclick({ position: { x: 20, y: 20 } });
    await expect.poll(() => window.evaluate(() =>
      document.querySelector('.mpi-gif-viewer__edit .mpi-canvas').scale), { timeout: 5000 })
      .not.toBe(zoomed);

    // Back to the Mask Brush: the two sections below are about the tool that DOES
    // own the drag, and the tint one needs a plain mask rather than Cut-out's
    // flipped override (which never nulls, so the tint would not hide at all).
    await openTool('Mask Brush');
    await expect.poll(() => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      return !!cv && cv.activeMode === 'mask';
    }), { timeout: 15000 }).toBe(true);

    // ── 4. Space is still the CANVAS's where the tool owns the drag ─────
    // The Mask Brush paints on a bare drag, so hold-Space is its only pan and
    // it keeps the key. Narrowing the gate must not give this one back.
    expect(await isPlaying()).toBe(false);
    await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })));
    await window.waitForTimeout(300);
    expect(await isPlaying(), 'Space belongs to the brush, which pans with it').toBe(false);

    // ── 5. Leaving a masked run hides the tint WITHOUT a white frame ────
    // `_setTint(null)` used to drop `--luma` first, while `--visible` and the
    // previous frame's mask-image were both still set: `mask-mode` fell back
    // to `alpha` over an OPAQUE B/W bitmap (alpha 255 everywhere), so
    // `--mask-fill` covered the whole stage for the length of the opacity
    // transition. The fix hides and leaves the mask alone, so the invariant a
    // spec CAN see is that the hidden element still carries both.
    const m = await window.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(2, 2, 4, 4);
      return c.toDataURL('image/png');
    });
    // Frames 3 and 4 stay unmasked: playback has to cross out of the run.
    await window.evaluate((url) => {
      const v = document.querySelector('.mpi-gif-viewer');
      [0, 1, 2].forEach(i => v.setTrackMask(i, url));
    }, m);
    await window.evaluate(() => document.querySelector('.mpi-gif-viewer').setFrameIndex(0));
    // The BUTTON, not Space — Space is the brush's here, which is the point above.
    await window.evaluate(() => document.querySelector('[data-mount="play"] button').click());
    await expect.poll(() => window.evaluate(() =>
      !document.querySelector('.mpi-gif-viewer__mask-tint').classList.contains('mpi-gif-viewer__mask-tint--visible')),
    { timeout: 10000 }, 'playback must reach an unmasked frame and hide the tint').toBe(true);
    const tint = await window.evaluate(() => {
      const t = document.querySelector('.mpi-gif-viewer__mask-tint');
      return { luma: t.classList.contains('mpi-gif-viewer__mask-tint--luma'), mask: t.style.maskImage };
    });
    expect(tint.luma, 'the hidden tint must keep mask-mode: luminance through the fade').toBe(true);
    expect(tint.mask, 'and must keep the bitmap it is fading out').not.toBe('');
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-771, Fabio 2026-09-19: "I move to the mask brush ... and I'm presented with
 * an inverted mask that is painting the character and not the background. Not
 * okay."
 *
 * The workspace rule is that the highlight marks what DISAPPEARS. Cut-out obeyed
 * it by handing the canvas an already-flipped bitmap; the Mask Brush drew the raw
 * stored mask, so the same frame highlighted opposite regions in the two tools and
 * the brush asked you to clean up the thing you were not looking at.
 *
 * The store still holds "what stays" - untouched. `MpiCanvas` gained a real
 * COMPLEMENT display (`displayInverted` only ever recoloured the same region,
 * which is why Cut-out had to flip the bitmap), the viewer owns the flag so both
 * tools share it, and the brush swaps paint/erase so a stroke grows what you see.
 *
 * Asserted on the OVERLAY's alpha, per region, because that is the pixel the
 * complaint is about - a flag or a button class would pass under the bug.
 */
test('gif mask display: Cut-out and the Mask Brush highlight the SAME region, and a brush stroke grows it', async ({}, testInfo) => {
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
    const canvasReady = () => expect.poll(() => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      return !!cv && cv.activeMode === 'mask';
    }), { timeout: 15000 }).toBe(true);

    // The stored mask is everything BUT the middle disc - what gets cut, which
    // is what a Background run proposes and Add commits (MPI-859). The disc
    // survives; the store needs no translation to say so.
    const disc = await window.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = 'white'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = 'black'; x.beginPath(); x.arc(32, 32, 18, 0, Math.PI * 2); x.fill();
      return c.toDataURL('image/png');
    });
    await window.evaluate((u) => {
      document.querySelector('.mpi-gif-viewer').setTrackMasks([u, u, u, u, u]);
    }, disc);

    /** Which REGION carries the tint, read off the overlay the mask is drawn on. */
    const tinted = () => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      const ov = cv.querySelector('canvas[data-role="overlay"]');
      const c = ov.getContext('2d');
      const a = (x, y) => c.getImageData(x, y, 1, 1).data[3] > 40;
      return {
        disc: a(Math.round(ov.width / 2), Math.round(ov.height / 2)),
        background: a(Math.round(ov.width * 0.06), Math.round(ov.height * 0.06)),
      };
    });

    // ── Invert OFF: the highlight is what GOES, so it is the BACKGROUND ──
    await openTool('Cut-out');
    await canvasReady();
    await expect.poll(tinted, { timeout: 10000 })
      .toEqual({ disc: false, background: true });

    await openTool('Mask Brush');
    await canvasReady();
    await expect.poll(tinted, 'the brush must highlight the SAME region Cut-out does', { timeout: 10000 })
      .toEqual({ disc: false, background: true });

    // ── A stroke GROWS what you can see ──────────────────────────────────
    // Under the complement the canvas paints the inverse of the display, so the
    // viewer swaps brush/eraser: "Paint" must still add tint under the cursor.
    // Dead centre starts untinted (it is the disc, what stays).
    await window.evaluate(() => document.querySelector('.mpi-gif-viewer__edit .mpi-canvas').setBrushSize(24));
    // From the canvas's OWN image size - the fixture frame is 32x32, and a
    // hardcoded 64-space coordinate lands off the image entirely.
    const centre = await window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      const r = cv.getBoundingClientRect();
      const ov = cv.querySelector('canvas[data-role="overlay"]');
      return {
        x: r.left + cv.offsetX + (ov.width / 2) * cv.scale,
        y: r.top + cv.offsetY + (ov.height / 2) * cv.scale,
      };
    });
    await window.mouse.move(centre.x, centre.y);
    await window.mouse.down();
    await window.mouse.move(centre.x + 2, centre.y);
    await window.mouse.up();
    await expect.poll(tinted, 'a Paint stroke must ADD tint where the cursor was', { timeout: 10000 })
      .toEqual({ disc: true, background: true });

    // ...and it must reach the STORE the right way round: the store holds what
    // gets CUT (MPI-859), so the painted centre has to come back WHITE - the
    // stroke is in the mask, with no paint/erase swap translating it.
    const centrePixel = await window.evaluate(async () => {
      const url = await document.querySelector('.mpi-gif-viewer').getFrameMaskURL(0);
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.getContext('2d').getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1).data[0];
    });
    expect(centrePixel, 'painting over what you see must ADD that area to the mask').toBeGreaterThan(128);

    // ── Invert ON: a cut-time switch, NOT a redraw (MPI-859) ──
    // The tint is the mask, as in the image workspace; Invert says the mask is
    // what SURVIVES the cut. A tint that moved here would put Cut-out and the
    // brush on opposite regions again, which is what this test exists to stop.
    // Re-seed first: the stroke above deliberately punched the disc's middle out,
    // and sampling dead centre of a ring would say "no tint" for the wrong reason.
    await window.evaluate((u) => {
      const v = document.querySelector('.mpi-gif-viewer');
      v.clearFrameMasks('all');
      v.setTrackMasks([u, u, u, u, u]);
    }, disc);
    await openTool('Cut-out');
    await canvasReady();
    await window.evaluate(() => {
      const slot = document.querySelector('#invert-slot');
      (slot.querySelector('input[type="checkbox"]') || slot.firstElementChild).click();
    });
    // Wait for the toggle to LAND before reading the tint: an unchanged value
    // passes a poll instantly, so without this the assertion could run before
    // the click did anything and prove nothing.
    await expect.poll(() => window.evaluate(() => {
      const slot = document.querySelector('#invert-slot');
      const box = slot.querySelector('input[type="checkbox"]');
      return box ? box.checked : slot.firstElementChild?.getAttribute('aria-checked') === 'true';
    }), { timeout: 10000 }).toBe(true);
    await expect.poll(tinted, 'Invert must not move the tint', { timeout: 10000 })
      .toEqual({ disc: false, background: true });

    await openTool('Mask Brush');
    await canvasReady();
    await expect.poll(tinted, 'and the brush shows the same mask', { timeout: 10000 })
      .toEqual({ disc: false, background: true });
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-771, Fabio 2026-09-19, minutes after the test above shipped: a stroke
 * painted in the Mask Brush ACROSS the subject's edge read as "goes" in the brush
 * and as "stays" in Cut-out - a light untinted hole in the background tint, with
 * the subject untouched.
 *
 * The test above let it through twice over: it stroked dead centre only, never
 * across the edge into the background, and it read the STORE after the stroke
 * but never went BACK to Cut-out to read what Cut-out DISPLAYS.
 *
 * One stroke, four sample points, three surfaces (brush overlay, store, Cut-out
 * overlay). Every surface must say the same thing about every point.
 */
test('gif mask display: a brush stroke ACROSS the subject edge reads the same in the store and in Cut-out', async ({}, testInfo) => {
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
    const canvasReady = () => expect.poll(() => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      return !!cv && cv.activeMode === 'mask';
    }), { timeout: 15000 }).toBe(true);

    // Same stored mask as above: the middle DISC is "what stays". In the 32x32
    // frame that is centre 16, radius 9 - so the disc's LEFT edge is at x = 7.
    const disc = await window.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = 'white'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = 'black'; x.beginPath(); x.arc(32, 32, 18, 0, Math.PI * 2); x.fill();
      return c.toDataURL('image/png');
    });
    await window.evaluate((u) => {
      document.querySelector('.mpi-gif-viewer').setTrackMasks([u, u, u, u, u]);
    }, disc);

    // Fractions of the frame, so they survive any overlay / mask resolution.
    // The stroke runs along y = 0.5 from x = 0.10 (background) to x = 0.34 (disc).
    const POINTS = {
      strokeInDisc: [0.34, 0.5],        // was kept, the stroke must put it IN the mask
      strokeInBackground: [0.10, 0.5],  // was dropped already, must STAY dropped
      discUntouched: [0.62, 0.5],       // kept, nowhere near the stroke
      backgroundUntouched: [0.06, 0.06],
    };

    /** Per point: does the overlay carry tint there? Tint = "this goes". */
    const overlayGoes = () => window.evaluate((pts) => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      const ov = cv.querySelector('canvas[data-role="overlay"]');
      const c = ov.getContext('2d');
      const out = {};
      for (const [k, [fx, fy]] of Object.entries(pts)) {
        out[k] = c.getImageData(Math.round(ov.width * fx), Math.round(ov.height * fy), 1, 1).data[3] > 40;
      }
      return out;
    }, POINTS);

    /** Per point: does the STORE drop it? The store holds what gets CUT (MPI-859), so white = goes. */
    const storeGoes = () => window.evaluate(async (pts) => {
      const url = await document.querySelector('.mpi-gif-viewer').getFrameMaskURL(0);
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const out = {};
      for (const [k, [fx, fy]] of Object.entries(pts)) {
        const d = x.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data;
        // Alpha-encoded or opaque B/W: "in the mask" needs BOTH light and opaque.
        // BEFORE / AFTER below did not change when the store flipped - the screen
        // and the store now agree without a translation, which is the whole fix.
        out[k] = d[0] >= 128 && d[3] >= 128;
      }
      return out;
    }, POINTS);

    const BEFORE = { strokeInDisc: false, strokeInBackground: true, discUntouched: false, backgroundUntouched: true };
    const AFTER = { strokeInDisc: true, strokeInBackground: true, discUntouched: false, backgroundUntouched: true };

    // ── Before the stroke, all three surfaces agree ──────────────────────
    await openTool('Cut-out');
    await canvasReady();
    await expect.poll(overlayGoes, 'Cut-out, before any stroke', { timeout: 10000 }).toEqual(BEFORE);
    await openTool('Mask Brush');
    await canvasReady();
    await expect.poll(overlayGoes, 'Mask Brush, before any stroke', { timeout: 10000 }).toEqual(BEFORE);

    // ── The stroke: background -> across the edge -> into the disc ───────
    await window.evaluate(() => document.querySelector('.mpi-gif-viewer__edit .mpi-canvas').setBrushSize(4));
    const at = (fx, fy) => window.evaluate(([x, y]) => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      const r = cv.getBoundingClientRect();
      const ov = cv.querySelector('canvas[data-role="overlay"]');
      return { x: r.left + cv.offsetX + ov.width * x * cv.scale, y: r.top + cv.offsetY + ov.height * y * cv.scale };
    }, [fx, fy]);
    const from = await at(...POINTS.strokeInBackground);
    const to = await at(...POINTS.strokeInDisc);
    await window.mouse.move(from.x, from.y);
    await window.mouse.down();
    await window.mouse.move((from.x + to.x) / 2, from.y, { steps: 6 });
    await window.mouse.move(to.x, to.y, { steps: 6 });
    await window.mouse.up();

    await expect.poll(overlayGoes, 'Mask Brush: the stroke reads "goes" on BOTH sides of the edge', { timeout: 10000 })
      .toEqual(AFTER);
    expect(await storeGoes(), 'the STORE must drop the stroke on both sides of the edge').toEqual(AFTER);

    // ── Back to Cut-out: it must DISPLAY the same stroke the same way ────
    await openTool('Cut-out');
    await canvasReady();
    await expect.poll(overlayGoes, 'Cut-out must show the brush stroke as "goes", not as a hole in the tint', { timeout: 10000 })
      .toEqual(AFTER);
    // The cause, pinned: the override bitmap is composed already, so a brush
    // layer left on this canvas is applied a SECOND time, on top of the flip.
    expect(await window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      return { manual: !!cv.getManualURL(), subtract: !!cv.getSubtractURL() };
    }), 'Cut-out\'s canvas is a display surface - no brush layer may ride on the override')
      .toEqual({ manual: false, subtract: false });
    expect(await storeGoes(), 'and opening Cut-out must not rewrite the store').toEqual(AFTER);
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-771: "play/pause never changes what the highlight means" was written in a
 * comment and asserted nowhere. While a mask tool plays, the canvas is hidden and
 * a CSS tint stands in for it - read the tint's own bitmap, in its own mode.
 */
test('gif mask display: PLAYING in the Mask Brush keeps the highlight on what goes', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    // The shared fixture plays ONCE at 50 ms a frame - over in a quarter second,
    // before one sample lands. Loop forever, slowly enough to read a frame.
    await window.evaluate(() => {
      const g = window.__mpi769.store.iGif;
      g.loop = 0;
      g.frames.forEach(f => { f.delay = 30; });
    });
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-frame-strip__thumb'))).toBe(true);

    const openTool = (info) => window.evaluate((name) => {
      document.querySelector(`.mpi-history-tools__btn[data-info="${name}"] button`).click();
    }, info);
    const canvasReady = () => expect.poll(() => window.evaluate(() => {
      const cv = document.querySelector('.mpi-gif-viewer__edit .mpi-canvas');
      return !!cv && cv.activeMode === 'mask';
    }), { timeout: 15000 }).toBe(true);

    const disc = await window.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = 'white'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = 'black'; x.beginPath(); x.arc(32, 32, 18, 0, Math.PI * 2); x.fill();
      return c.toDataURL('image/png');
    });
    await window.evaluate((u) => {
      document.querySelector('.mpi-gif-viewer').setTrackMasks([u, u, u, u, u]);
    }, disc);

    // Cut-out first: it is what pushes the workspace rule (Invert OFF = the
    // highlight is what goes) that the brush then inherits.
    await openTool('Cut-out');
    await canvasReady();
    await openTool('Mask Brush');
    await canvasReady();

    /**
     * Which region is HIGHLIGHTED, off the screen's own pixels: the tint is a CSS
     * mask over the frame, so neither its bitmap nor its classes say what the
     * user sees. The fixture frame is one flat colour and the tint is
     * `--mask-fill` (white), so the highlighted region is simply the LIGHTER one.
     */
    const sharp = require('sharp');
    const playingTint = async () => {
      const at = await window.evaluate(() => {
        const v = document.querySelector('.mpi-gif-viewer');
        // The FRAME's box, not the tint element's: the tint spans the whole stage
        // and only paints inside the letterboxed frame, so a corner of the STAGE
        // is dark letterbox whatever the mask says. The MPI-771 complement used to
        // bleed tint out there, which is the only reason sampling it ever worked.
        const r = document.querySelector('.mpi-gif-viewer__checker').getBoundingClientRect();
        return { idx: v.getFrameIndex(), x: r.left, y: r.top, w: r.width, h: r.height };
      });
      if (!(at.w > 8) || !(at.h > 8)) return { moved: at.idx > 0, highlighted: 'no tint box' };
      const png = await window.screenshot({ clip: { x: at.x, y: at.y, width: at.w, height: at.h } });
      const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
      const luma = (fx, fy) => data[Math.round(info.height * fy) * info.width + Math.round(info.width * fx)];
      const d = luma(0.06, 0.06) - luma(0.5, 0.5);
      return { moved: at.idx > 0, highlighted: d > 40 ? 'background' : d < -40 ? 'disc' : 'neither' };
    };

    await window.evaluate(() => document.querySelector('[data-mount="play"] button').click());
    // `moved`: the frame play STARTS on copies the canvas, every later one is built
    // from the store - so only a frame past 0 proves the store path.
    await expect.poll(playingTint, 'past the first frame, the playing highlight must still be what GOES', { timeout: 10000 })
      .toEqual({ moved: true, highlighted: 'background' });
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-838 — three faults Fabio found checking the MPI-836 output tool.
 *
 * 1. The preview pane's spinner spun for the life of the panel, and the pane
 *    stayed dimmed with it: the code hid `spinner.el` (`.mpi-spinner`, which
 *    carries `display: inline-block`, so the bare attribute loses) instead of
 *    the wrapper — and that wrapper is a full-pane SCRIM, not just a slot.
 * 2. The frame strip's dimmed range only moved on pointerup, because MpiTrimBar
 *    emitted `range-change` there and nothing during the drag. It now emits a
 *    throttled `range-preview`; `range-change` still fires on commit ONLY,
 *    because the video Block persists trim on it.
 * 3. Home / End / I / O / X were unbound here — the GIF bar bound three of the
 *    `video.*` ids and not these five.
 *
 * All three assert the failing direction, so this spec is red on the old code.
 */
test('gif 838: the preview pane clears when idle, the strip follows a handle mid-drag, and Home/End/I/O/X drive the bar', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-frame-strip__thumb'))).toBe(true);
    const last = FRAME_HASHES.length - 1;

    // ── 1. The spinner, and the scrim behind it ─────────────────────────
    // Hold `/gif/preview` open so the busy state can be read while it is
    // genuinely busy, rather than raced against an instant stub.
    await window.evaluate(() => {
      const inner = window.fetch.bind(window);
      window.__gate = { release: null };
      window.fetch = (...args) => {
        if (String(args[0] || '').includes('/gif/preview')) {
          return new Promise((resolve) => { window.__gate.release = () => resolve(inner(...args)); });
        }
        return inner(...args);
      };
    });

    await window.evaluate(() => {
      document.querySelector('.mpi-history-tools__btn[data-info="GIF output"] button').click();
    });
    await window.waitForSelector('.mpi-tool-options-gif-timing__preview');

    // `checkVisibility()`, not `.hidden`: the old code SET `hidden` — on the
    // wrong element — so the attribute alone reads as fixed while the spinner
    // is still on screen and the pane is still dimmed.
    const busy = () => window.evaluate(() => {
      const wrap = document.querySelector('.mpi-tool-options-gif-timing #preview-spinner');
      return {
        scrim: wrap.checkVisibility(),
        spinner: !!wrap.querySelector('.mpi-spinner')?.checkVisibility(),
      };
    });
    expect(await busy(), 'an idle preview pane shows no spinner and no scrim')
      .toEqual({ scrim: false, spinner: false });

    await window.locator('.mpi-tool-options-gif-timing #preview-btn-slot button').click();
    await expect.poll(async () => (await busy()).spinner, 'a running encode must show the spinner').toBe(true);
    expect((await busy()).scrim, 'and the scrim that comes with it').toBe(true);

    await window.evaluate(() => window.__gate.release());
    await expect.poll(async () => (await busy()).scrim, 'both go when the encode lands').toBe(false);
    expect(await busy()).toEqual({ scrim: false, spinner: false });

    // The primitive's own floor: `hidden` on a `.mpi-spinner` must now stick,
    // whichever caller writes it.
    expect(await window.evaluate(() => {
      const s = document.querySelector('.mpi-tool-options-gif-timing #preview-spinner .mpi-spinner');
      s.hidden = true;
      const v = s.checkVisibility();
      s.hidden = false;
      return v;
    }), '`.mpi-spinner[hidden]` must hide the primitive itself').toBe(false);

    // ── 2. The strip follows the handles LIVE ───────────────────────────
    const paint = () => window.evaluate(() => ({
      outside: document.querySelectorAll('.mpi-frame-strip__thumb--outside').length,
      in: document.querySelector('.mpi-frame-strip__thumb--range-in')?.dataset.index,
      out: document.querySelector('.mpi-frame-strip__thumb--range-out')?.dataset.index,
    }));
    expect(await paint()).toEqual({ outside: 0, in: '0', out: String(last) });

    // Count `range-change` too: it must NOT fire while the button is down.
    // MpiTrimBar is shared with the video bar, whose Block PERSISTS on it.
    await window.evaluate(() => {
      window.__commits = 0;
      document.querySelector('.mpi-gif-control-bar .mpi-trim-bar')
        .addEventListener('mpitrimbar:range-change', () => { window.__commits += 1; });
    });

    const box = await window.locator('.mpi-trim-bar__track').boundingBox();
    await window.locator('.mpi-trim-bar__handle--in').hover();
    await window.mouse.down();
    await window.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 8 });

    // Still DOWN. This is the whole fault: before `range-preview` the strip sat
    // undimmed until the handle was released.
    await expect.poll(async () => (await paint()).outside,
      'the strip must dim while the handle is still down').toBeGreaterThan(0);
    const mid = await paint();
    expect(Number(mid.in), 'the in edge follows the handle mid-drag').toBeGreaterThan(0);
    expect(mid.out, 'the out edge does not move with it').toBe(String(last));
    expect(await window.evaluate(() => window.__commits),
      'range-change is a COMMIT — it must not fire mid-drag').toBe(0);

    await window.mouse.up();
    await expect.poll(() => window.evaluate(() => window.__commits),
      'and it must fire exactly once on release').toBe(1);
    expect(await paint(), 'the release lands on what the drag had already painted').toMatchObject({ out: String(last) });

    // ── 3. Home / End / I / O / X ───────────────────────────────────────
    const key = (k) => window.evaluate((kk) =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: kk, bubbles: true })), k);
    const state = () => window.evaluate(() => ({
      frame: Number(document.querySelector('.mpi-gif-control-bar__current').textContent),
      range: document.querySelector('.mpi-gif-control-bar .mpi-trim-bar').getRange(),
    }));

    // X clears first, so the keys below start from a known full range.
    await key('x');
    expect(await state(), 'X resets the range to every frame').toMatchObject({ range: { in: 0, out: last } });

    await key('End');
    expect((await state()).frame, 'End goes to the OUT point').toBe(last);
    await key('Home');
    expect((await state()).frame, 'Home goes to the IN point').toBe(0);

    await key('ArrowRight');
    await key('ArrowRight');
    expect((await state()).frame).toBe(2);
    await key('i');
    expect((await state()).range, 'I snaps IN to the frame on screen').toEqual({ in: 2, out: last });

    await key('End');
    expect((await state()).frame, 'End now lands on the trimmed out point').toBe(last);
    await key('ArrowLeft');
    await key('o');
    expect((await state()).range, 'O snaps OUT to the frame on screen').toEqual({ in: 2, out: last - 1 });

    await key('Home');
    expect((await state()).frame, 'Home now lands on the trimmed in point').toBe(2);

    // The strip is the readout for all of it — the keys go through the same
    // `range-change` the handles do.
    expect(await paint()).toMatchObject({ in: '2', out: String(last - 1) });
    await key('x');
    expect(await paint(), 'X clears the dimming too').toEqual({ outside: 0, in: '0', out: String(last) });
  } finally {
    await closeApp(app);
  }
});

/**
 * MPI-857 — a duplicate carries its source's cut-out mask, and the two copies
 * stay TELLABLE APART.
 *
 * Masks are keyed by frame POSITION, and the strip resolves a position through
 * `_origin` -> `_viewerPos`. A copy that reused its source's `_origin` token
 * collapses both onto one entry of that map, so every mask lookup for the pair
 * answers with the LAST one: the clear then throws the wrong frame's work away
 * while the menu reports success. The copy gets its own (negative) token for
 * exactly that, pointed at the source's viewer position so `order` still carries
 * the mask across. Both halves are asserted here.
 */
test('gif 857: a duplicated frame keeps the mask, and the clear still hits the frame you right-clicked', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);
    await window.evaluate(async () => {
      const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
      navigate(PAGE_GROUP_HISTORY, { groupId: 'gGif' });
    });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-frame-strip__thumb'))).toBe(true);

    // One DISTINCT mask per frame — an unbrushed frame hands its track URL back
    // verbatim (`getFrameMaskURL`), so the string says which mask landed where.
    const masks = await window.evaluate(() => [1, 2, 3, 4, 5].map((w) => {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, w, 8);
      return c.toDataURL('image/png');
    }));
    await window.evaluate((urls) => {
      document.querySelector('.mpi-gif-viewer').setTrackMasks(urls);
    }, masks);
    const maskAt = (idx) => window.evaluate((i) =>
      document.querySelector('.mpi-gif-viewer').getFrameMaskURL(i), idx);

    // Duplicate frame 1.
    await window.locator('.mpi-frame-strip__thumb[data-index="1"]').click({ button: 'right' });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'))).toBe(true);
    await window.locator('.mpi-ctx-menu__item[data-key="duplicate"]').click();
    await expect.poll(() => thumbCount(window)).toBe(masks.length + 1);

    expect(await maskAt(1), 'the source keeps its mask').toBe(masks[1]);
    expect(await maskAt(2), 'the copy is handed the same mask').toBe(masks[1]);
    expect(await maskAt(3), 'the frame the copy pushed along keeps its OWN mask').toBe(masks[2]);

    // Now the collapse: clear the mask on the SOURCE, position 1.
    await window.locator('.mpi-frame-strip__thumb[data-index="1"]').click({ button: 'right' });
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'))).toBe(true);
    expect(await window.evaluate(() =>
      document.querySelector('.mpi-ctx-menu__item[data-key="clear-mask"]').disabled),
    'both of the pair have a mask, so the row must be live').toBe(false);
    await window.locator('.mpi-ctx-menu__item[data-key="clear-mask"]').click();

    expect(await maskAt(1), 'the frame that was right-clicked is the one cleared').toBe(null);
    expect(await maskAt(2), 'the copy must keep its mask').toBe(masks[1]);
  } finally {
    await closeApp(app);
  }
});
