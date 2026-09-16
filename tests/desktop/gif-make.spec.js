const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-770 — Make GIF, real end to end.
 *
 * No stub anywhere near `POST /gif/make` (`routes/gifMake.js`) — that route IS
 * the thing under test. Everything upstream of it is real too: a real project
 * created on disk through `/create-project` + `projectService.openProject()`,
 * three real still images (different sizes/aspects) landed through the same
 * `/project-media/:id/upload` route + `media:imported` event the app's own
 * drag-drop import uses (`js/services/mediaImportService.js`, already running
 * as an app-lifetime listener — `js/shell.js` starts it at boot), a real
 * ctrl-click multi-select and a real right-click on the actual gallery grid,
 * and a real click on the actual `MpiContextMenu` "Make GIF" row.
 *
 * `uploadMediaFile()` (`js/services/mediaUploadService.js`) is the client's
 * normal import path, but it exists only to turn a `File` into the same
 * `{filename, base64Data|sourcePath, ...}` body this spec posts directly —
 * building a disk-backed `File` inside a Playwright page has no clean seam
 * (see `docs/testing.md` § "Drive the app through its own seams, not the
 * pointer"), so this spec calls the real upload route the same way and then
 * emits the real `media:imported` event, which is the same event
 * `MpiAudioRecorder` emits after its own `uploadMediaFile()` call. Sidecars
 * land under the real `Media/.meta/<uuid>.json` on disk.
 *
 * Selection order IS frame order (docs/gallery-selection.md) — click order
 * here (green, blue, red) is deliberately NOT gallery/creation order (red,
 * green, blue), so a re-sort bug anywhere in the chain would be caught. The
 * first-CLICKED image (green, 48x64) sets the built GIF's canvas size
 * (routes/gifMake.js): the other two frames pad to fit it, and the built
 * `.gif`'s opaque padding is pinned black (`services/gifFrames.js`
 * `buildGif()` flattens an opaque build onto `OPAQUE_BACKGROUND`) — the
 * ghosting-through-transparency bug `docs/gif.md` documents as fixed.
 */
test.setTimeout(180000);

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

/** A tiny solid-colour opaque RGB PNG of a given size. */
async function solidPng(r, g, b, w, h) {
    return sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } })
        .png()
        .toBuffer();
}

/** Absolute path out of a `/project-file?path=...` URL. */
function absFromUrl(raw) {
    const u = new URL(String(raw), 'http://localhost');
    return decodeURIComponent(u.searchParams.get('path') || '');
}

/** Raw pixel at (x,y) from one page of a built multi-frame GIF. */
async function gifPixelAt(gifPath, page, x, y) {
    const { data, info } = await sharp(gifPath, { page }).raw().toBuffer({ resolveWithObject: true });
    const idx = (y * info.width + x) * info.channels;
    return {
        r: data[idx], g: data[idx + 1], b: data[idx + 2],
        a: info.channels >= 4 ? data[idx + 3] : 255,
    };
}

test('Make GIF: real gallery selection -> real /gif/make -> gif workspace -> hover-only card', async ({}, testInfo) => {
    let app, window;
    let projectFolderPath = null;

    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(6000); // shell boot settles
        await clearBootModals(window);

        // ── Real project on disk (POST /create-project + openProject) ───────────
        const projectName = `mpi770-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: projectName, folderPath: os.tmpdir() });
        projectFolderPath = project.folderPath;
        expect(project?.folderPath, 'the project must land on real disk').toBeTruthy();

        // ── Three real still images, different sizes/aspects ────────────────────
        const RED = { r: 226, g: 32, b: 32, w: 64, h: 48, prefix: 'e2e-red' };
        const GREEN = { r: 32, g: 210, b: 32, w: 48, h: 64, prefix: 'e2e-green' };
        const BLUE = { r: 32, g: 32, b: 226, w: 40, h: 40, prefix: 'e2e-blue' };

        /**
         * Uploads through the real `/project-media/:id/upload` route (same
         * body shape `mediaUploadService.uploadMediaFile()` posts), then emits
         * the real `media:imported` event that the app's app-lifetime
         * `mediaImportService` listener turns into a real ItemGroup + a real
         * `addGroup()` (persists project.json, emits `project:group-added`).
         */
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

        // Uploaded (= gallery/creation order) red, green, blue — clicked below
        // in a DIFFERENT order (green, blue, red), so a re-sort bug anywhere
        // in the chain (click handling, the grid's targetIds, the route) would
        // be caught rather than accidentally matching.
        const red = await importStill(RED);
        const green = await importStill(GREEN);
        const blue = await importStill(BLUE);

        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
        });

        const cardSel = (groupId) => `[data-group-id="${groupId}"] .mpi-group-card`;
        for (const g of [red, green, blue]) {
            await window.waitForSelector(cardSel(g.groupId), { timeout: 15000 });
        }

        const menuSel = '.mpi-ctx-menu__item[data-key="make-gif"]';
        const menuDisabled = () => window.evaluate(
            (sel) => document.querySelector(sel)?.disabled, menuSel);

        // ── One card selected -> Make GIF is disabled ────────────────────────────
        await window.locator(cardSel(green.groupId)).click({ modifiers: ['Control'] });
        await window.locator(cardSel(green.groupId)).click({ button: 'right' });
        await window.waitForSelector(menuSel);
        expect(await menuDisabled(), 'Make GIF must be disabled with only one card selected').toBe(true);

        // Ctrl-click blue (NOT Escape — Escape is bound to gallery.selection.exit
        // while a multi-select is active, MpiGalleryGrid.js `_enterSelectionMode`,
        // and would clear the selection this spec is building). This click is
        // itself an "outside click" for the still-open menu, which dismisses it
        // (MpiContextMenu's own outside-click handler) while also toggling blue
        // into the selection — click order so far: green, blue.
        await window.locator(cardSel(blue.groupId)).click({ modifiers: ['Control'] });
        await window.locator(cardSel(red.groupId)).click({ modifiers: ['Control'] });

        // ── Three still images selected, click order green, blue, red ───────────
        await window.locator(cardSel(red.groupId)).click({ button: 'right' });
        await window.waitForSelector(menuSel);
        expect(await menuDisabled(), 'Make GIF must be enabled for 3 selected still images').toBe(false);
        await window.locator(menuSel).click();

        // ── Real POST /gif/make ran; the app navigated to the GIF workspace ──────
        await window.waitForSelector('.mpi-gif-viewer', { timeout: 30000 });
        expect(await window.evaluate(() => !!document.querySelector('#prompt-box-mount .mpi-prompt-box')),
            'a GIF card never mounts the PromptBox').toBe(false);
        await expect.poll(
            () => window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length),
            { timeout: 15000 }
        ).toBe(3);

        const gifInfo = await window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            for (const g of state.currentProject.itemGroups) {
                const item = g.history[g.selectedIndex];
                if (item?.gif) return { groupId: g.id, item };
            }
            return null;
        });
        expect(gifInfo, 'the new GIF card must land in state.currentProject.itemGroups').not.toBeNull();
        expect(gifInfo.item.gif.frames.length).toBe(3);
        // The first-CLICKED image (green, 48x64) sets the canvas size.
        expect(gifInfo.item.pixelDimensions).toEqual({ w: 48, h: 64 });

        // ── The built .gif on disk ────────────────────────────────────────────────
        const builtAbsPath = absFromUrl(gifInfo.item.filePath);
        expect(await fs.pathExists(builtAbsPath), 'the built .gif must exist on disk').toBe(true);

        const meta = await sharp(builtAbsPath, { animated: true }).metadata();
        expect(meta.pages, '3 frames').toBe(3);
        expect(meta.delay, 'each still holds 1 s -> 1000 ms on every frame').toEqual([1000, 1000, 1000]);
        expect(meta.loop, 'loop forever (plan Decision 8)').toBe(0);

        // Centre pixel of each page must follow CLICK order (green, blue, red),
        // not upload/creation order (red, green, blue) and not id order.
        const cx = Math.floor(gifInfo.item.pixelDimensions.w / 2);
        const cy = Math.floor(gifInfo.item.pixelDimensions.h / 2);
        const centres = await Promise.all([0, 1, 2].map((p) => gifPixelAt(builtAbsPath, p, cx, cy)));
        expect(centres[0].g > centres[0].r && centres[0].g > centres[0].b,
            `page 0 should be green, got ${JSON.stringify(centres[0])}`).toBe(true);
        expect(centres[1].b > centres[1].r && centres[1].b > centres[1].g,
            `page 1 should be blue, got ${JSON.stringify(centres[1])}`).toBe(true);
        expect(centres[2].r > centres[2].g && centres[2].r > centres[2].b,
            `page 2 should be red, got ${JSON.stringify(centres[2])}`).toBe(true);

        // Pages 1-2 (blue 40x40, red 64x48) neither matches the 48x64 canvas
        // aspect, so both are padded — the padding must be opaque black, never
        // the previous frame's colour showing through (docs/gif.md § Opaque
        // output; services/gifFrames.js buildGif() flattens onto black).
        for (const p of [1, 2]) {
            const px = await gifPixelAt(builtAbsPath, p, 0, 0);
            expect([px.r, px.g, px.b, px.a], `page ${p} padding must be opaque black`)
                .toEqual([0, 0, 0, 255]);
        }

        // ── Back to the gallery: the GIF card is still until hover (MPI-759) ─────
        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
        });
        const gifCardSel = cardSel(gifInfo.groupId);
        await window.waitForSelector(gifCardSel, { timeout: 15000 });

        const posterSrc = () => window.evaluate(
            (sel) => document.querySelector(`${sel} img.mpi-group-card__thumb`)?.getAttribute('src') || '',
            gifCardSel);
        const hoverSrc = () => window.evaluate(
            (sel) => document.querySelector(`${sel} .mpi-group-card__thumb--hover-video`)?.getAttribute('src') || '',
            gifCardSel);

        const atRest = await posterSrc();
        expect(atRest, 'the poster must be a real thumb, not empty').toContain('project-file');
        expect(atRest, 'the poster must never point at the built .gif').not.toContain('.gif');
        expect(await hoverSrc(), 'no hover overlay before any hover').toBe('');

        await window.evaluate((sel) => document.querySelector(sel)
            .dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })), gifCardSel);
        await expect.poll(hoverSrc, { timeout: 10000 }).toContain('.gif');

        await window.evaluate((sel) => document.querySelector(sel)
            .dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })), gifCardSel);
        await expect.poll(hoverSrc, { timeout: 10000 }).toBe('');
    } finally {
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
