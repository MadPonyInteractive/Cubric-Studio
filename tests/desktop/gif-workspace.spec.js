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
    await window.locator('.mpi-frame-strip__thumb[data-index="1"]').click({ modifiers: ['Control'] });
    await window.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })));
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
