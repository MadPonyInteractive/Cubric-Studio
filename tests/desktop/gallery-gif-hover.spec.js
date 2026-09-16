const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-759 — GIF as its own gallery kind: still until hover, hover plays.
 *
 * A GIF card paints the WebP rendition like any image at rest — never the built
 * .gif itself, at any card size — and only an explicit hover mounts the .gif,
 * riding the same promote/demote pair (`_promoteVideo` / `_removeHoverVideo`) a
 * video hover uses. Leaving, or the grid's scroll-out / suspension demote,
 * removes it again. Unlike a video's cheap paused-and-kept-mounted replay, a GIF
 * `<img>` has no paused state, so every demote fully unmounts it.
 *
 * The animated source is a hand-built, sharp-verified 2-frame 1x1 GIF (base64
 * data URI) rather than a made-up path — a 404'd hover overlay would still leave
 * a `src` attribute to assert on (its `error` handler only flags the card, it
 * never removes the element), but a real decodable GIF is what the design
 * actually has to handle and it costs nothing to get right. Built and verified
 * (sharp: pages 2, delay [100,100], loop 0) by the throwaway script this comment
 * names for provenance, not because the test depends on it existing:
 * scratchpad/w759/make_gif.js.
 */
test.setTimeout(90000);

const SMALL = 'flow-scribble';
const LARGE = 'flow-outpaint';
const GIF_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAKAAAALAAAAAABAAEAAAICTAEAOw==';

async function mountGif(window, { level = 4, thumbPathLg = `/comfy_workflows/display/${LARGE}.webp` } = {}) {
  return window.evaluate(async ({ lvl, lg, gifSrc }) => {
    const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
    const { state } = await import('/js/state.js');
    window.__mpi759?.grid?.el?.destroy?.();
    window.__mpi759?.host?.remove();

    const host = document.createElement('div');
    host.id = 'mpi759-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:1600px;height:900px;z-index:0;';
    document.body.appendChild(host);

    const groups = Array.from({ length: 6 }, (_, i) => ({
      id: `mpi759-${i}`,
      type: 'image',
      selectedIndex: 0,
      history: [{
        id: `mpi759-item-${i}`,
        type: 'image',
        // MPI-768's shape: a truthy `gif` field, `type` stays 'image' — the
        // field's inner shape never matters to the kind match, only truthiness.
        gif: { frames: [{ hash: 'a', delay: 10 }, { hash: 'b', delay: 10 }], loop: 0, output: 'mascot.gif' },
        filePath: gifSrc,
        thumbPath: '/comfy_workflows/display/flow-scribble.webp',
        thumbPathLg: lg,
        pixelDimensions: { w: 1920, h: 1080 },
      }],
    }));

    state.gallerySizeLevel = lvl;
    window.__mpi759 = { grid: MpiGalleryGrid.mount(host, { groups }), host };
  }, { lvl: level, lg: thumbPathLg, gifSrc: GIF_SRC });
}

test('a GIF card is still at every slider size — the .gif never mounts from the ladder', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    // The POSTER, not a hover overlay — querySelector returns the first match,
    // and the overlay (when it exists) is appended after it in DOM order.
    const posterSrc = () => window.evaluate(
      () => document.querySelector('#mpi759-host img.mpi-group-card__thumb')?.getAttribute('src') || '');
    const hoverExists = () => window.evaluate(
      () => !!document.querySelector('#mpi759-host .mpi-group-card__thumb--hover-video'));

    await mountGif(window, { level: 4 });
    await expect.poll(posterSrc).toContain(LARGE);
    expect(await hoverExists(), 'no hover overlay before any hover').toBe(false);

    await mountGif(window, { level: 1 });
    await expect.poll(posterSrc).toContain(SMALL);
    expect(await hoverExists()).toBe(false);

    // No large rendition written (a narrow source) — a plain image would fall
    // through to filePath here; a GIF must clamp to the small thumb instead,
    // never its own .gif (the ladder's `allowSource: false` for a gif kind).
    await mountGif(window, { level: 4, thumbPathLg: null });
    await window.waitForTimeout(1500); // let the promote observer's pass settle
    const clampedSrc = await posterSrc();
    expect(clampedSrc).toContain(SMALL);
    expect(clampedSrc, 'the poster <img> must never point at the .gif').not.toContain('data:image/gif');
  } finally {
    await window.evaluate(() => {
      window.__mpi759?.grid?.el?.destroy?.();
      window.__mpi759?.host?.remove();
      delete window.__mpi759;
    }).catch(() => {});
    await closeApp(app);
  }
});

test('hover mounts the .gif; leave and the grid demote unmount it again', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);
    await mountGif(window, { level: 4 });
    await expect.poll(() => window.evaluate(
      () => document.querySelector('#mpi759-host img.mpi-group-card__thumb')?.getAttribute('src') || ''))
      .toContain(LARGE);

    const overlaySrc = () => window.evaluate(
      () => document.querySelector('#mpi759-host img.mpi-group-card__thumb--hover-video')?.getAttribute('src') || '');
    const CARD_SEL = '#mpi759-host .mpi-group-card';

    expect(await overlaySrc()).toBe('');

    // Viewport entry alone must never mount it — the same `cardEl.promoteVideo()`
    // the grid's IntersectionObserver calls on scroll-into-view, with no
    // explicit hover (MPI-759's "still until hover, hover plays").
    await window.evaluate((sel) => document.querySelector(sel).promoteVideo(), CARD_SEL);
    expect(await overlaySrc(), 'viewport entry alone must not mount the .gif').toBe('');

    // A real hover does.
    await window.evaluate(
      (sel) => document.querySelector(sel).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })), CARD_SEL);
    await expect.poll(overlaySrc).toContain('data:image/gif');

    // Leaving demotes back to the still — an <img> has no paused-at-frame-0
    // state to keep mounted for a cheap replay the way a video's overlay does.
    await window.evaluate(
      (sel) => document.querySelector(sel).dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })), CARD_SEL);
    await expect.poll(overlaySrc).toBe('');

    // Scroll-out / suspension demote rides the exact same `demoteVideo` hook the
    // grid's own observers and `_releaseMedia` call — a hovered card must yield
    // to it just as a promoted video does.
    await window.evaluate(
      (sel) => document.querySelector(sel).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })), CARD_SEL);
    await expect.poll(overlaySrc).toContain('data:image/gif');
    await window.evaluate((sel) => document.querySelector(sel).demoteVideo(), CARD_SEL);
    expect(await overlaySrc(), 'the grid demote hook must unmount the .gif overlay').toBe('');
  } finally {
    await window.evaluate(() => {
      window.__mpi759?.grid?.el?.destroy?.();
      window.__mpi759?.host?.remove();
      delete window.__mpi759;
    }).catch(() => {});
    await closeApp(app);
  }
});
