const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-961 — a pan or wheel-zoom tick moves the view, never repaints the image.
 *
 * MpiCanvas holds the image in two image-sized canvases (base + overlay) and moves
 * them with the stack's CSS transform. Every pan and wheel tick used to run a full
 * `draw()`, repainting both edge to edge: at 16K under GPU load that measured 189-322
 * ms per frame against 13.4 ms for the transform alone, so panning a 16K photo while a
 * video generated ran at 2-6 fps. This spec counts the 2D calls that land on those two
 * canvases during pan, zoom and a brush-size wheel, and pins that the view still moves,
 * the zoomed-out display copy still swaps at its level, and a point-prompt dot — which
 * keeps a constant screen size and so used to be redrawn on the overlay every zoom —
 * is on the screen canvas. A tool switch leaves the unchanged base alone too: at 16K each
 * base repaint blocked the main thread 2.5-3.3 s for identical pixels.
 */
test.setTimeout(180000);

const N = 4096;

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
    expect(await backdrops(), 'the boot modals must be gone').toBe(0);
}

test('pan and wheel ticks never repaint the image-sized canvases', async ({}, testInfo) => {
    let app, window, projectFolderPath = null;
    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi961-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;

        const png = await sharp({ create: { width: N, height: N, channels: 3, background: { r: 120, g: 110, b: 90 } } }).png().toBuffer();
        const itemId = crypto.randomUUID();
        const groupId = await window.evaluate(async ({ project, itemId, base64, size }) => {
            const { Events } = await import('/js/events.js');
            const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: 'e2e-pan_001.png', base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: size, height: size }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(`upload failed: ${data.error}`);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('project:group-added never fired')), 30000);
                const unsub = Events.on('project:group-added', ({ group }) => {
                    if (group?.history?.[0]?.id !== itemId) return;
                    clearTimeout(timer); unsub(); resolve(group.id);
                });
                Events.emit('media:imported', {
                    url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                    filename: data.filename, itemId, thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                    proxyPath: null, pixelDimensions: { w: size, h: size }, mediaType: 'image',
                });
            });
        }, { project, itemId, base64: png.toString('base64'), size: N });

        await window.evaluate(async (id) => {
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: id });
        }, groupId);
        await expect(window.locator('.mpi-history-tools')).toBeVisible();
        await window.evaluate(() => document.querySelector('.mpi-history-tools').setMode('maskBrush'));
        await window.waitForFunction((n) => {
            const c = document.querySelector('.mpi-canvas-viewer .mpi-canvas');
            return c?.activeMode === 'mask' && c.querySelector('canvas[data-role="base"]')?.width === n;
        }, N, { timeout: 60000 });
        await window.waitForTimeout(1000);

        // Count every 2D call that lands on each canvas role. Installed after the load, so
        // only what the gestures below cause is counted.
        await window.evaluate(() => {
            const counts = window.__mpi961 = {};
            const proto = CanvasRenderingContext2D.prototype;
            for (const fn of ['clearRect', 'drawImage', 'fillRect', 'putImageData']) {
                const orig = proto[fn];
                proto[fn] = function (...a) {
                    const role = this.canvas?.dataset?.role || 'other';
                    counts[role] = (counts[role] || 0) + 1;
                    return orig.apply(this, a);
                };
            }
        });
        const counts = () => window.evaluate(() => {
            const c = { ...window.__mpi961 };
            for (const k of Object.keys(window.__mpi961)) delete window.__mpi961[k];
            return { base: c.base || 0, overlay: c.overlay || 0, screen: c['screen-ui'] || 0 };
        });
        const view = () => window.evaluate(() => {
            const c = document.querySelector('.mpi-canvas-viewer .mpi-canvas');
            const q = (role) => c.querySelector(`canvas[data-role="${role}"]`);
            const r = c.getBoundingClientRect();
            return {
                scale: c.scale, dev: c.scale * devicePixelRatio, offsetX: c.offsetX,
                cx: r.left + r.width / 2, cy: r.top + r.height / 2,
                native: q('base').style.visibility, mip: q('base-mip').style.display,
            };
        });
        const frames = (n) => window.evaluate((n) => new Promise((res) => {
            let i = 0;
            const f = () => (++i >= n ? res() : requestAnimationFrame(f));
            requestAnimationFrame(f);
        }), n);

        const v0 = await view();
        expect(v0.dev, 'fit shows the image under half size').toBeLessThan(0.5);
        expect({ native: v0.native, mip: v0.mip }, 'the display copy is up at fit').toEqual({ native: 'hidden', mip: '' });

        // ── Pan (Space + drag, Mask mode's pan gesture).
        await window.keyboard.down('Space');
        await window.mouse.move(v0.cx, v0.cy);
        await window.mouse.down();
        await frames(2);
        await counts();                                    // mousedown's own full draw
        for (let i = 1; i <= 10; i++) {
            await window.mouse.move(v0.cx + i * 12, v0.cy + i * 4);
            await frames(1);
        }
        const pan = await counts();
        const v1 = await view();
        expect(Math.round(v1.offsetX - v0.offsetX), 'the view moved with the drag').toBe(120);
        expect(pan, 'pan ticks repaint only the screen canvas').toEqual({ base: 0, overlay: 0, screen: pan.screen });
        expect(pan.screen).toBeGreaterThan(0);
        await window.mouse.up();
        await frames(2);
        const release = await counts();
        expect(release.base + release.overlay, 'the counter sees a full draw (release)').toBeGreaterThan(0);

        // ── Wheel zoom (Space held): crosses half size, so the display copy must hand over.
        for (let i = 0; i < 8 && (await view()).dev < 0.6; i++) {
            await window.mouse.wheel(0, -300);
            await frames(1);
        }
        const zoom = await counts();
        const v2 = await view();
        expect(v2.dev, 'the wheel zoomed past half size').toBeGreaterThanOrEqual(0.5);
        expect({ native: v2.native, mip: v2.mip }, 'the native canvas is back past half size').toEqual({ native: '', mip: 'none' });
        expect(zoom.base + zoom.overlay, 'wheel ticks repaint neither image-sized canvas').toBe(0);
        await window.keyboard.up('Space');
        await frames(2);
        await counts();

        // ── A bare wheel in Mask mode resizes the brush: only the ring changes.
        await window.mouse.wheel(0, -100);
        await frames(2);
        const brush = await counts();
        expect(brush.base + brush.overlay, 'a brush-size wheel repaints neither image-sized canvas').toBe(0);

        // ── A point-prompt dot keeps its screen size, so it lives on the screen canvas.
        await window.evaluate(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas').setPointsMode(true));
        const v3 = await view();
        await window.mouse.click(v3.cx - 30, v3.cy - 20);
        await frames(2);
        await window.keyboard.down('Space');
        await window.mouse.wheel(0, 300);
        await frames(2);
        await window.keyboard.up('Space');
        await frames(2);
        const dot = await window.evaluate(() => {
            const c = document.querySelector('.mpi-canvas-viewer .mpi-canvas');
            const p = c.mask.points[0];
            const sx = Math.round(c.offsetX + p.x * c.scale);
            const sy = Math.round(c.offsetY + p.y * c.scale);
            const alpha = (role, x, y) => c.querySelector(`canvas[data-role="${role}"]`).getContext('2d').getImageData(x, y, 1, 1).data[3];
            return { points: c.mask.points.length, screen: alpha('screen-ui', sx, sy), overlay: alpha('overlay', Math.round(p.x), Math.round(p.y)) };
        });
        expect(dot, 'the dot is drawn on the screen canvas, not the image-sized overlay').toEqual({ points: 1, screen: 255, overlay: 0 });

        // ── A tool switch changes no base pixel: the base is left alone and keeps its image.
        await counts();
        await window.evaluate(() => document.querySelector('.mpi-history-tools').setMode('paint'));
        await window.waitForFunction(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas')?.activeMode === 'paint');
        await frames(3);
        const sw = await counts();
        expect(sw.base, 'a tool switch does not repaint the unchanged base').toBe(0);
        expect(await window.evaluate((n) => [...document.querySelector('.mpi-canvas-viewer canvas[data-role="base"]')
            .getContext('2d').getImageData(n / 2, n / 2, 1, 1).data], N), 'the base still holds the image').toEqual([120, 110, 90, 255]);
    } finally {
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
