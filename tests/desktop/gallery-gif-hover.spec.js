const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-759 (reopened) — GIF as its own gallery kind: still until hover, hover plays.
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
 *
 * REOPENED 2026-09-16 — the "hover mounts / leave demotes" test below originally
 * drove the hover with `dispatchEvent(new MouseEvent('mouseenter', {bubbles:true}))`
 * called directly on the card element. That bypasses hit-testing entirely, so it
 * cannot see two real gaps a genuine `locator.hover()` (real cursor, real hit-test)
 * exposes: (1) a fresh Electron profile's 18+/changelog `.mpi-modal-backdrop` sits
 * above the whole window and swallows every real pointer event — `clearBootModals`
 * below, same pattern gallery-audio-waveform.spec.js already uses; (2) the actual
 * ROOT CAUSE — see the third test — `kindOfItem` (js/utils/assetKinds.js) never
 * classified a REAL card as `gif` unless it carried the MPI-768 `gif` field, because
 * its filename-fallback regex tested the WRAPPED `/project-file?path=...` URL
 * (and, once cache-busted by a reload, `&v=<mtime>` after it) instead of the path it
 * wraps. Nothing in the original dispatchEvent-driven test or in
 * tests/asset-kinds.test.cjs's bare `/Media/mascot.gif` fixtures ever built that
 * shape, so the regex's brokenness against a real URL went unseen. A card that
 * `kindOfItem` calls `image` never gets `_ensureVideoHoverBindings()` called on it
 * (MpiGalleryGrid.js `_render()`) — no mouseenter/mouseleave listener is ever bound,
 * so a real hover does nothing, which is exactly Fabio's report. This is the
 * anticipated "extraction failed" shape too (routes/projects.js: a failed
 * `extractFramesFromGif` leaves the import "a plain animated GIF, just without a
 * frames store" — no `gif` field, filename match is the ONLY thing left standing
 * between that card and the plain `image` row.
 */
test.setTimeout(90000);

const SMALL = 'flow-scribble';
const LARGE = 'flow-outpaint';
const GIF_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAKAAAALAAAAAABAAEAAAICTAEAOw==';

// A production `/project-file?path=<abs path>` wrapper, cache-busted the way
// `projectFileUrlBusted` (routes/projects.js) stamps every upload/import sidecar,
// and the shape a reloaded project's item lands back in after the client
// reconciler re-hydrates it from that sidecar (js/managers/projectReconciler.js).
// Deliberately does NOT decode to anything on disk — the point is that
// classification (and so whether a hover overlay ever gets wired at all) must not
// depend on the file actually resolving.
const REAL_GIF_URL = `/project-file?path=${encodeURIComponent('C:\\FakeProject\\Media\\mascot_001.gif')}&v=1758000000000`;

const DEFAULT_GIF_FIELD = { frames: [{ hash: 'a', delay: 10 }, { hash: 'b', delay: 10 }], loop: 0, output: 'mascot.gif' };

async function mountGif(window, { level = 4, thumbPathLg = `/comfy_workflows/display/${LARGE}.webp`, gifSrc = GIF_SRC, gifField = DEFAULT_GIF_FIELD } = {}) {
  return window.evaluate(async ({ lvl, lg, gifSrc, gifField }) => {
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
        // `gifField: null` exercises the filename-fallback branch instead (a
        // legacy import whose frame extraction failed, or one predating MPI-768).
        gif: gifField,
        filePath: gifSrc,
        thumbPath: '/comfy_workflows/display/flow-scribble.webp',
        thumbPathLg: lg,
        pixelDimensions: { w: 1920, h: 1080 },
      }],
    }));

    state.gallerySizeLevel = lvl;
    window.__mpi759 = { grid: MpiGalleryGrid.mount(host, { groups }), host };
  }, { lvl: level, lg: thumbPathLg, gifSrc, gifField });
}

/** Clear the 18+ / changelog boot modals (see gallery-audio-waveform.spec.js) — a
 * fresh CUBRIC_E2E_USER_DATA profile has not acknowledged them, and they sit above
 * everything with pointer-events, which a synthetic dispatchEvent never notices but
 * a real `locator.hover()` correctly refuses to click through. */
async function clearBootModals(window) {
  const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
  const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
  if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 8 && await backdrops() > 0; i++) {
    await window.keyboard.press('Escape');
    await window.waitForTimeout(400);
  }
  expect(await backdrops(), 'the boot modals must be gone before a real hover can reach a card').toBe(0);
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

test('a REAL mouse hover mounts the .gif; leaving and the grid demote unmount it again', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);
    await clearBootModals(window);
    await mountGif(window, { level: 4 });
    await expect.poll(() => window.evaluate(
      () => document.querySelector('#mpi759-host img.mpi-group-card__thumb')?.getAttribute('src') || ''))
      .toContain(LARGE);

    const overlaySrc = () => window.evaluate(
      () => document.querySelector('#mpi759-host img.mpi-group-card__thumb--hover-video')?.getAttribute('src') || '');
    const CARD_SEL = '#mpi759-host .mpi-group-card';

    expect(await overlaySrc()).toBe('');

    // Viewport entry alone must never mount it — the same `cardEl.promoteVideo()`
    // the grid's IntersectionObserver calls on scroll-into-view, with no explicit
    // hover (MPI-759's "still until hover, hover plays"). Deliberately a direct
    // method call, not a hover: this is the NON-hover path.
    await window.evaluate((sel) => document.querySelector(sel).promoteVideo(), CARD_SEL);
    expect(await overlaySrc(), 'viewport entry alone must not mount the .gif').toBe('');

    // A REAL cursor hover does — real hit-testing, not a synthetic dispatchEvent
    // aimed straight at the element (which would never notice a boot modal, an
    // overlapping sibling, or any other real-pointer obstruction).
    await window.mouse.move(2, 2); // park the OS cursor away first
    await window.waitForTimeout(200);
    await window.locator(CARD_SEL).first().hover();
    await expect.poll(overlaySrc).toContain('data:image/gif');

    // Mounted is not SEEN. The overlay is an `<img>` carrying the poster's
    // `mpi-group-card__thumb` class, so the poster's "hide until loaded" rule
    // (MpiGalleryGrid.css) held it at opacity 0 forever while every src check
    // above passed — Fabio's second MPI-759 reopen. Assert the painted outcome.
    await expect.poll(() => window.evaluate(() => {
      const el = document.querySelector('#mpi759-host img.mpi-group-card__thumb--hover-video');
      return el ? getComputedStyle(el).opacity : 'absent';
    }), { message: 'the hovered .gif overlay must actually be visible' }).toBe('1');

    // Leaving demotes back to the still — an <img> has no paused-at-frame-0
    // state to keep mounted for a cheap replay the way a video's overlay does.
    await window.mouse.move(2, 2);
    await expect.poll(overlaySrc).toBe('');

    // Scroll-out / suspension demote rides the exact same `demoteVideo` hook the
    // grid's own observers and `_releaseMedia` call — a hovered card must yield
    // to it just as a promoted video does.
    await window.locator(CARD_SEL).first().hover();
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

test('a real /project-file URL busted by a reload still hovers, even with no gif field', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);
    await clearBootModals(window);
    // No `gif` field (extraction failed, or a legacy import that predates MPI-768)
    // and a real, cache-busted `/project-file?path=...&v=...` filePath — the shape
    // a project reload's reconciler hands back, and the shape the original
    // `/\.gif$/i.test(item.filePath)` fallback never matched (it tested the
    // wrapper's tail, `&v=1758000000000`, not the `.gif` the path it wraps ends
    // in). kindOfItem must still call this a GIF from the filename alone, or the
    // card never gets `_ensureVideoHoverBindings()` wired at all and a real hover
    // does nothing — Fabio's exact report.
    await mountGif(window, { level: 4, gifSrc: REAL_GIF_URL, gifField: null });

    // The corner badge is the cheapest external signal that kindOfItem actually
    // classified this card as `gif` rather than falling through to `image`
    // (`.mpi-group-card__kind[data-kind]`, MpiGalleryGrid.js `_render()`).
    await expect.poll(() => window.evaluate(
      () => document.querySelector('#mpi759-host .mpi-group-card__kind')?.dataset.kind))
      .toBe('gif');

    const CARD_SEL = '#mpi759-host .mpi-group-card';
    const overlayExists = () => window.evaluate(
      () => !!document.querySelector('#mpi759-host .mpi-group-card__thumb--hover-video'));

    expect(await overlayExists(), 'no hover overlay before any hover').toBe(false);

    await window.mouse.move(2, 2);
    await window.waitForTimeout(200);
    await window.locator(CARD_SEL).first().hover();
    // The overlay element must get CREATED (a wrong `image` classification never
    // calls `_ensureVideoHoverBindings`, so no mouseenter listener exists and
    // nothing mounts at all — regardless of whether the fake path 404s).
    await expect.poll(overlayExists, 'a real hover must mount the overlay even though this filePath never resolves').toBe(true);

    const overlaySrc = await window.evaluate(
      () => document.querySelector('#mpi759-host .mpi-group-card__thumb--hover-video')?.getAttribute('src') || '');
    expect(overlaySrc).toBe(REAL_GIF_URL);
  } finally {
    await window.evaluate(() => {
      window.__mpi759?.grid?.el?.destroy?.();
      window.__mpi759?.host?.remove();
      delete window.__mpi759;
    }).catch(() => {});
    await closeApp(app);
  }
});
