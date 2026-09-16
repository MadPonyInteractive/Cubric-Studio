const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-769 — per-kind table `{ image, video, gif }` replacing the old
 * `isVideo` viewer ternary + the Compound's `TOOL_LISTS`. No spec covered
 * image/video's own viewer + tool rail + control bar before this card
 * (`.claude` plan MPI-757 phase 2) — this pins that they still open exactly
 * as before, alongside the new gif mode.
 *
 * A GIF card is an ordinary `type: 'image'` sidecar carrying a truthy `gif`
 * field (docs/gif.md) — `kindOfItem()` is what routes it, not `group.type`.
 * `/gif/ensure-frames` is stubbed on `window.fetch` (never `page.route` — it
 * does not see the renderer's own fetch, see
 * ~/.claude/memory/tools/tool_electron_ui_check_fixture_fetch.md) so this
 * spec needs no real project folder or frame files on disk.
 */
test.setTimeout(90000);

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAFElEQVR42mNk+M9QzwAEjGQwACdfA/MhYO3qAAAAAElFTkSuQmCC';

async function setupProject(window) {
  await window.evaluate((imgUrl) => {
    // Stub on window.fetch directly — page.route() never sees the renderer's
    // own fetch (~/.claude/memory/tools/tool_electron_ui_check_fixture_fetch.md).
    // Bind the original to `window` explicitly: calling it through a bare
    // `fetch(url)` reference (as MpiGroupHistoryBlock does) invokes this
    // wrapper with `this === undefined` (ES module strict mode), and the
    // native implementation throws "illegal invocation" without a receiver.
    const orig = window.fetch.bind(window);
    window.fetch = (...args) => {
      const url = String(args[0] || '');
      if (url.includes('/gif/ensure-frames')) {
        const body = { success: true, gif: { frames: [{ hash: 'h1', delay: 10, url: imgUrl, thumbUrl: imgUrl }], loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null } } };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(...args);
    };
  }, TINY_PNG);

  return window.evaluate((imgUrl) => {
    return import('/js/state.js').then(({ state }) => {
      state.currentProject = {
        id: 'pModesTest',
        name: 'Modes Test',
        folderPath: 'C:/tmp/history-modes-test',
        itemGroups: [
          {
            id: 'gImage',
            type: 'image',
            selectedIndex: 0,
            history: [{ id: 'iImage', type: 'image', filePath: imgUrl, displayName: 'img' }],
          },
          {
            id: 'gVideo',
            type: 'video',
            selectedIndex: 0,
            // No filePath: MpiGroupHistoryBlock only calls loadVideo when one
            // is present — this pins the MOUNT/ROUTING under test without
            // needing a real decodable video file.
            history: [{ id: 'iVideo', type: 'video', displayName: 'vid' }],
          },
          {
            id: 'gGif',
            type: 'image',
            selectedIndex: 0,
            history: [{
              id: 'iGif',
              type: 'image',
              filePath: imgUrl,
              displayName: 'mascot',
              gif: { frames: [{ hash: 'h1', delay: 10 }], loop: 0, output: { maxEdge: 1024, colours: 256, edgeColour: null } },
            }],
          },
        ],
      };
    });
  }, TINY_PNG);
}

async function openGroup(window, groupId) {
  await window.evaluate(async (id) => {
    const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
    navigate(PAGE_GROUP_HISTORY, { groupId: id });
  }, groupId);
  await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-group-history-block')))
    .toBe(true);
}

test('image, video and gif groups each mount their own viewer, rail and control bar', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);
  try {
    await setupProject(window);

    // ── Image ──────────────────────────────────────────────────────────
    await openGroup(window, 'gImage');
    let dom = await window.evaluate(() => ({
      canvasViewer: !!document.querySelector('.mpi-canvas-viewer'),
      videoViewer:  !!document.querySelector('.mpi-video-viewer'),
      gifViewer:    !!document.querySelector('.mpi-gif-viewer'),
      videoBar:     !!document.querySelector('.mpi-video-control-bar'),
      gifBar:       !!document.querySelector('.mpi-gif-control-bar'),
      frameStrip:   !!document.querySelector('.mpi-frame-strip'),
      railSlots:    document.querySelectorAll('.mpi-history-tools__slot').length,
    }));
    expect(dom.canvasViewer).toBe(true);
    expect(dom.videoViewer).toBe(false);
    expect(dom.gifViewer).toBe(false);
    expect(dom.videoBar).toBe(false);
    expect(dom.gifBar).toBe(false);
    expect(dom.frameStrip).toBe(false);
    expect(dom.railSlots).toBeGreaterThan(0); // image tool groups (prompt/transform/enhance/...)

    // ── Video ──────────────────────────────────────────────────────────
    await openGroup(window, 'gVideo');
    dom = await window.evaluate(() => ({
      canvasViewer: !!document.querySelector('.mpi-canvas-viewer'),
      videoViewer:  !!document.querySelector('.mpi-video-viewer'),
      gifViewer:    !!document.querySelector('.mpi-gif-viewer'),
      videoBar:     !!document.querySelector('.mpi-video-control-bar'),
      gifBar:       !!document.querySelector('.mpi-gif-control-bar'),
      frameStrip:   !!document.querySelector('.mpi-frame-strip'),
      railSlots:    document.querySelectorAll('.mpi-history-tools__slot').length,
    }));
    expect(dom.canvasViewer).toBe(false);
    expect(dom.videoViewer).toBe(true);
    expect(dom.gifViewer).toBe(false);
    expect(dom.videoBar).toBe(true);
    expect(dom.gifBar).toBe(false);
    expect(dom.frameStrip).toBe(false);
    expect(dom.railSlots).toBeGreaterThan(0); // video tool groups (prompt/transform/enhance/export)

    // ── GIF ────────────────────────────────────────────────────────────
    await openGroup(window, 'gGif');
    await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-gif-viewer'))).toBe(true);
    dom = await window.evaluate(() => ({
      canvasViewer: !!document.querySelector('.mpi-canvas-viewer'),
      videoViewer:  !!document.querySelector('.mpi-video-viewer'),
      gifBar:       !!document.querySelector('.mpi-gif-control-bar'),
      frameStrip:   !!document.querySelector('.mpi-frame-strip'),
      railSlots:    document.querySelectorAll('.mpi-history-tools__slot').length,
      promptBox:    !!document.querySelector('#prompt-box-mount .mpi-prompt-box'),
    }));
    expect(dom.canvasViewer).toBe(false);
    expect(dom.videoViewer).toBe(false);
    expect(dom.gifBar).toBe(true);
    expect(dom.frameStrip).toBe(true);
    // MPI-769 scope: gif's tool list is empty-but-routed — no rail buttons yet.
    expect(dom.railSlots).toBe(0);
    // Plan scope item 6: no model generates a GIF in v1.
    expect(dom.promptBox).toBe(false);
  } finally {
    await closeApp(app);
  }
});
