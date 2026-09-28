const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-961 — past the display cap the History canvas and the Prompt preview draw the
 * server's display copy (`<id>.thumb.fit<edge>.webp`), while every coordinate stays in
 * the ORIGINAL's px. A 16K original cost a 2.4-3.6 s decode per canvas mount and a
 * re-decode per preview zoom step, and a 32K never opened.
 *
 * The same 2048^2 image is imported twice: one entry is worked uncapped, then the cap is
 * forced to 1024 and the other entry gets the identical mask stroke, paint stroke, crop
 * and placement. Every output must be byte-equal — they are what dispatch sends, at the
 * original's size — and the image must sit in the same screen box. A site that sized
 * itself off the copy (a manager initialised at 1024, a stack box at the backing size)
 * changes an output or the box, and fails here.
 */
test.setTimeout(240000);

const N = 2048;
const CAP = 1024;

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

async function importStill(window, project, png, filename) {
    const itemId = crypto.randomUUID();
    const groupId = await window.evaluate(async ({ project, itemId, base64, size, filename }) => {
        const { Events } = await import('/js/events.js');
        const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: size, height: size }),
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
    }, { project, itemId, base64: png.toString('base64'), size: N, filename });
    return { itemId, groupId };
}

const sha = (s) => (s ? crypto.createHash('sha256').update(s).digest('hex') : null);

/** Open the entry in History and run the same edits; returns what they produced. */
async function work(window, groupId, backing) {
    await window.evaluate(async (id) => {
        const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
        navigate(PAGE_GROUP_HISTORY, { groupId: id });
    }, groupId);
    await expect(window.locator('.mpi-history-tools')).toBeVisible();
    const rail = (m) => window.evaluate((m) => document.querySelector('.mpi-history-tools').setMode(m), m);
    await rail('maskBrush');
    await window.waitForFunction((b) => {
        const c = document.querySelector('.mpi-canvas-viewer .mpi-canvas');
        return c?.activeMode === 'mask' && c.querySelector('canvas[data-role="base"]')?.width === b;
    }, backing, { timeout: 60000 });
    await window.waitForTimeout(500);

    const layout = await window.evaluate(() => {
        const c = document.querySelector('.mpi-canvas-viewer .mpi-canvas');
        const base = c.querySelector('canvas[data-role="base"]');
        const overlay = c.querySelector('canvas[data-role="overlay"]');
        const stack = c.querySelector('.mpi-canvas__stack');
        const r = stack.getBoundingClientRect();
        return {
            src: c.img.src,
            base: [base.width, base.height, base.style.width],
            overlay: [overlay.width, overlay.height, overlay.style.width],
            stack: stack.style.width,
            box: [r.left, r.top, r.width, r.height].map(Math.round),
        };
    });

    // Real pointer input: InputController maps the cursor through the stack's box, so a
    // box at the backing size would land the strokes on other image px.
    const stroke = async (fy) => {
        const [x, y, w, h] = layout.box;
        await window.mouse.move(x + w * 0.3, y + h * fy);
        await window.mouse.down();
        await window.mouse.move(x + w * 0.7, y + h * (fy + 0.1), { steps: 12 });
        await window.mouse.up();
        await window.waitForTimeout(200);
    };
    await window.evaluate(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas').clearMask());
    await stroke(0.3);
    const mask = await window.evaluate(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas').getMaskDataURL());

    await rail('paint');
    await window.waitForFunction(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas')?.activeMode === 'paint');
    await window.evaluate(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas').clearPaint());
    await stroke(0.6);
    const out = await window.evaluate(async () => {
        const c = document.querySelector('.mpi-canvas-viewer .mpi-canvas');
        const paint = c.getPaintURL();
        const dims = (url) => new Promise((res) => {
            if (!url) return res(null);
            const i = new Image();
            i.onload = () => res([i.naturalWidth, i.naturalHeight]);
            i.src = url;
        });
        // Place (MPI-454): a 300x200 object seeded at the centre, rasterised full-frame.
        const obj = document.createElement('canvas');
        obj.width = 300; obj.height = 200;
        const octx = obj.getContext('2d');
        octx.fillStyle = 'rgb(200,40,40)'; octx.fillRect(0, 0, 300, 200);
        c.setShapeMode('place');
        await c.setPlaceImage(obj.toDataURL('image/png'));
        const place = c.getPlaceURL();
        c.setShapeMode(null);
        return { paint, place, paintDims: await dims(paint), placeDims: await dims(place) };
    });
    // Dims, and the share of the mask the stroke painted: an empty mask matches trivially.
    Object.assign(out, await window.evaluate((u) => new Promise((res) => {
        const i = new Image();
        i.onload = () => {
            const c = document.createElement('canvas');
            c.width = 256; c.height = 256;
            const ctx = c.getContext('2d');
            ctx.drawImage(i, 0, 0, 256, 256);
            const d = ctx.getImageData(0, 0, 256, 256).data;
            let lit = 0;
            for (let k = 0; k < d.length; k += 4) if (d[k] > 127) lit++;
            res({ maskDims: [i.naturalWidth, i.naturalHeight], maskLit: lit / (256 * 256) });
        };
        i.src = u;
    }), mask));

    await rail('crop');
    await window.waitForFunction(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas')?.activeMode === 'crop');
    const crop = await window.evaluate(() => document.querySelector('.mpi-canvas-viewer .mpi-canvas').getCropRect());

    await rail('prompt');
    // The preview sizes its stack once its load finishes; `complete` is true on an <img>
    // with no src yet, and `naturalWidth` is readable before the load event runs.
    await window.waitForFunction(() => document.querySelector('.mpi-masked-preview__stack')?.style.width && !document.querySelector('.mpi-canvas-viewer .mpi-canvas'), null, { timeout: 60000 });
    const preview = await window.evaluate(() => {
        const img = document.querySelector('#base-img');
        const stack = document.querySelector('.mpi-masked-preview__stack');
        return { src: img.src, natural: img.naturalWidth, stack: stack.style.width };
    });

    return {
        layout, preview, crop,
        mask: sha(mask), maskLit: out.maskLit, paint: sha(out.paint), place: sha(out.place),
        dims: { mask: out.maskDims, paint: out.paintDims, place: out.placeDims },
    };
}

test('past the cap the canvas and preview draw the display copy; every output is unchanged', async ({}, testInfo) => {
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
        }, { name: `mpi961-copy-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;

        // A gradient, so the copy is not a flat colour a wrong scale could hide in.
        const raw = Buffer.alloc(N * N * 3);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const i = (y * N + x) * 3;
            raw[i] = x >> 3; raw[i + 1] = y >> 3; raw[i + 2] = (x ^ y) & 255;
        }
        const png = await sharp(raw, { raw: { width: N, height: N, channels: 3 } }).png().toBuffer();
        const a = await importStill(window, project, png, 'e2e-copyA_001.png');
        const b = await importStill(window, project, png, 'e2e-copyB_001.png');

        const uncapped = await work(window, a.groupId, N);

        await window.evaluate(async (cap) => {
            const { setDisplayMaxEdge } = await import('/js/utils/displayImage.js');
            setDisplayMaxEdge(cap);
        }, CAP);
        const capped = await work(window, b.groupId, CAP);

        // The copy is what is drawn — canvas AND preview — and nothing else moved.
        expect(uncapped.layout.src).toContain('e2e-copyA_');
        expect(capped.layout.src).toContain(`${b.itemId}.thumb.fit${CAP}.webp`);
        expect(capped.layout.base).toEqual([CAP, CAP, `${N}px`]);
        expect(capped.layout.overlay).toEqual([CAP, CAP, `${N}px`]);
        expect(capped.layout.stack).toBe(`${N}px`);
        expect(capped.layout.box).toEqual(uncapped.layout.box);
        expect(uncapped.preview.natural).toBe(N);
        expect(capped.preview.src).toContain(`${b.itemId}.thumb.fit${CAP}.webp`);
        expect(capped.preview.natural).toBe(CAP);
        expect(capped.preview.stack).toBe(`${N}px`);
        expect(uncapped.preview.stack).toBe(`${N}px`);

        // Outputs are the original's size and identical, pixel for pixel.
        expect(uncapped.dims).toEqual({ mask: [N, N], paint: [N, N], place: [N, N] });
        expect(capped.dims).toEqual(uncapped.dims);
        expect(uncapped.maskLit).toBeGreaterThan(0.005);
        expect(uncapped.maskLit).toBeLessThan(0.5);
        expect(capped.mask).toBe(uncapped.mask);
        expect(capped.paint).toBe(uncapped.paint);
        expect(capped.place).toBe(uncapped.place);
        expect(capped.crop).toEqual(uncapped.crop);
        expect(uncapped.crop).toMatchObject({ w: N, h: N });
    } finally {
        await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
