const { test, expect } = require('@playwright/test');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-772, rewritten for MPI-836 — GIF output and the trim bar, real end to end.
 *
 * A real project on disk, a real 6-frame animated GIF imported through the
 * real upload route (which extracts its frames eagerly, docs/gif.md), the real
 * GIF workspace, real rail clicks and real `POST /gif/entry` builds. Each Apply
 * adds an entry; its built `.gif` is read back with sharp (pages, per-frame
 * delay in ms = hundredths x10, loop = total plays) and the frame store's file
 * count must never change: these tools rewrite the list, not the frames.
 *
 * What MPI-836 changed, and what this test now pins: the rail had a Timing group
 * (Trim, Speed, Loop count) and NOTHING read the control bar's trim handles —
 * setting a range and opening GIF output rebuilt the whole GIF (Fabio,
 * 2026-09-20). One panel now, and every operation keeps the range, as every video
 * operation already did.
 *
 * The chain (each Apply opens the entry it made):
 * rate 16 fps -> Reverse (stage right-click) -> trim 1..3 + loop 3 -> blank rate
 * keeps the delays -> 16 px transparent -> Resize honours the range too.
 */
test.setTimeout(180000);

const W = 32;
const H = 24;
const COLOURS = [[220, 30, 30], [30, 200, 30], [30, 30, 220], [220, 220, 30], [30, 220, 220], [220, 30, 220]];
const SOURCE_DELAYS = [10, 20, 30, 40, 50, 60]; // hundredths

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

/** One RGBA frame: a solid colour with a fully transparent 4 px left column. */
function frameRaw([r, g, b]) {
    const buf = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = x < 4 ? 0 : 255;
        }
    }
    return buf;
}

async function animatedGif() {
    const pngs = await Promise.all(COLOURS.map(c =>
        sharp(frameRaw(c), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()));
    return sharp(pngs, { join: { animated: true } })
        .gif({ delay: SOURCE_DELAYS.map(d => d * 10), loop: 0 })
        .toBuffer();
}

function absFromUrl(raw) {
    const u = new URL(String(raw), 'http://localhost');
    return decodeURIComponent(u.searchParams.get('path') || '');
}

async function pixel(gifPath, page, x, y) {
    const { data, info } = await sharp(gifPath, { page }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

const isColour = (px, [r, g, b]) => Math.abs(px.r - r) < 40 && Math.abs(px.g - g) < 40 && Math.abs(px.b - b) < 40;

test('GIF output: rate, loop and build settings over the TRIM RANGE, and every operation keeps that range; no new frame files', async ({}, testInfo) => {
    let app, window;
    let projectFolderPath = null;

    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(6000);
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi772-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, folderPath: testInfo.outputPath('projects') });
        projectFolderPath = project.folderPath;
        expect(projectFolderPath, 'the project must land on real disk').toBeTruthy();

        // ── Real import: upload route extracts the frames, media:imported makes the card ──
        const base64 = (await animatedGif()).toString('base64');
        const groupId = await window.evaluate(async ({ project, base64, w, h }) => {
            const { Events } = await import('/js/events.js');
            const itemId = crypto.randomUUID();
            const res = await fetch(
                `/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: 'e2e-anim_001.gif', base64Data: base64, autoSequence: true,
                        itemId, mediaType: 'image', width: w, height: h,
                    }),
                });
            const data = await res.json();
            if (!data.success) throw new Error(`upload failed: ${data.error}`);
            if (!data.gif?.frames?.length) throw new Error('upload did not extract frames');
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('project:group-added never fired')), 15000);
                const unsub = Events.on('project:group-added', ({ group }) => {
                    if (group?.history?.[0]?.id !== itemId) return;
                    clearTimeout(timer);
                    unsub();
                    resolve(group.id);
                });
                Events.emit('media:imported', {
                    url: `/project-file?path=${encodeURIComponent(data.filePath)}`,
                    filename: data.filename, itemId,
                    thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                    proxyPath: null, pixelDimensions: { w, h }, mediaType: 'image', gif: data.gif,
                });
            });
        }, { project, base64, w: W, h: H });

        const framesDir = path.join(projectFolderPath, 'Media', '.gif-frames');
        const storeCount = async () => (await fs.readdir(framesDir)).length;
        const storeBefore = await storeCount();
        expect(storeBefore, 'six unique frames (+ thumbs) extracted at import').toBeGreaterThanOrEqual(6);

        await window.evaluate(async (gid) => {
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: gid });
        }, groupId);
        const thumbs = () => window.evaluate(() => document.querySelectorAll('.mpi-frame-strip__thumb').length);
        await expect.poll(thumbs, { timeout: 15000 }).toBe(6);

        const history = () => window.evaluate(async (gid) => {
            const { state } = await import('/js/state.js');
            const g = state.currentProject.itemGroups.find(x => x.id === gid);
            return g.history.map(i => ({ id: i.id, filePath: i.filePath, gif: i.gif }));
        }, groupId);

        const openTool = async (slot, info, panel = '.mpi-tool-options-gif-timing') => {
            await window.locator(`.mpi-history-tools__slot[data-mode="${slot}"] .mpi-history-tools__btn[data-info="${info}"] button`).click();
            await window.waitForSelector(panel);
        };
        /** Fields in mount order: 0 rate, 1 loop, 2 longest edge, 3 colours. */
        const setNumber = (nth, value, panel = '.mpi-tool-options-gif-timing') =>
            // MpiInput renders a number field as type="text" inputmode="decimal".
            window.locator(`${panel} input[inputmode="decimal"]`).nth(nth).fill(String(value));
        const note = window.locator('.mpi-tool-options-gif-timing #note');
        /** Drag the control bar's handles, the way the trim bar's own API does. */
        const setRange = (a, b) => window.evaluate(([i, o]) =>
            document.querySelector('.mpi-gif-control-bar .mpi-trim-bar').setRange(i, o), [a, b]);

        /**
         * Right-click the GIF stage and choose one item (MPI-771 audit): Reverse
         * left the rail for the shared context menu, which is where the video
         * workspace has always reversed from.
         */
        const stageMenu = async (key) => {
            await window.locator('.mpi-gif-viewer__stage').click({ button: 'right' });
            await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-ctx-menu'))).toBe(true);
            await window.locator(`.mpi-ctx-menu__item[data-key="${key}"]`).click();
        };

        /** Click the panel's Apply, then settle. */
        const apply = async (expectedFrames, panel = '.mpi-tool-options-gif-timing') => {
            const before = (await history()).length;
            await window.locator(`${panel} #actions-slot button`).click();
            return settle(before, expectedFrames);
        };

        /** Wait for the new entry, return it with its built file's metadata. */
        const settle = async (before, expectedFrames) => {
            await expect.poll(async () => (await history()).length, { timeout: 30000 }).toBe(before + 1);
            await expect.poll(thumbs, { timeout: 15000 }).toBe(expectedFrames);
            const entry = (await history()).at(-1);
            const gifPath = absFromUrl(entry.filePath);
            expect(await fs.pathExists(gifPath), 'the built .gif exists').toBe(true);
            const meta = await sharp(gifPath, { animated: true }).metadata();
            return { entry, gifPath, meta };
        };

        // ── The rail has no Timing group any more (MPI-836) ──────────────────
        expect(await window.locator('.mpi-history-tools__slot[data-mode="timing"]').count(),
            'Trim, Speed and Loop count left the rail').toBe(0);

        // ── Frame rate 16 fps -> delay 6 (60 ms) on every frame ──────────────
        await openTool('output', 'GIF output');
        // The source delays differ (10..60), so a blank rate has none to name.
        await expect(note).toContainText('All 6 frames');
        await expect(note).toContainText('each frame keeps its own timing (they differ)');
        await expect(note).toContainText('looping forever');
        await setNumber(0, 16);
        await expect(note).toContainText('16.7 fps');
        let r = await apply(6);
        expect(r.meta.pages).toBe(6);
        expect(r.meta.delay).toEqual([60, 60, 60, 60, 60, 60]);
        expect(r.meta.loop).toBe(0);
        expect(r.entry.gif.frames.map(f => f.delay)).toEqual([6, 6, 6, 6, 6, 6]);
        // Opaque build: the transparent column is flattened onto black.
        expect(await pixel(r.gifPath, 0, 0, 0)).toMatchObject({ r: 0, g: 0, b: 0, a: 255 });
        const speedHashes = r.entry.gif.frames.map(f => f.hash);

        // ── Reverse — from the STAGE's right-click, not the rail (MPI-771) ───
        const beforeReverse = (await history()).length;
        await stageMenu('reverse');
        r = await settle(beforeReverse, 6);
        expect(r.entry.gif.frames.map(f => f.hash)).toEqual([...speedHashes].reverse());
        expect(r.meta.delay).toEqual([60, 60, 60, 60, 60, 60]);
        expect(isColour(await pixel(r.gifPath, 0, 16, 12), COLOURS[5]), 'page 0 is the last source frame').toBe(true);
        expect(isColour(await pixel(r.gifPath, 5, 16, 12), COLOURS[0]), 'page 5 is the first source frame').toBe(true);

        // ── THE BUG (MPI-836): a range set, then Apply — with a loop count ───
        // This exact sequence built all six frames before the fix.
        await openTool('output', 'GIF output');
        await setRange(1, 3);
        await expect(note).toContainText('Frames 1 to 3 (3 of 6; the rest are dimmed on the strip)');
        await expect(note).toContainText('at 16.7 fps', { timeout: 5000 });
        await setNumber(1, 3);
        await expect(note).toContainText('3 plays');
        r = await apply(3);
        expect(r.meta.pages, 'the trimmed range, not the whole GIF').toBe(3);
        expect(r.entry.gif.frames.map(f => f.hash)).toEqual([...speedHashes].reverse().slice(1, 4));
        expect(r.entry.gif.loop).toBe(3);
        expect(r.meta.loop, 'sharp reports total plays').toBe(3);
        // A landed Apply resets the handles to the new (shorter) list, and the
        // panel reads the new entry's own loop count rather than keeping the
        // value that was typed against the old one.
        await expect(note).toContainText('All 3 frames');
        await expect(note).toContainText('3 plays');

        // ── A BLANK rate keeps every frame's own delay ───────────────────────
        // The field is blank on mount on purpose: an Apply about colours must not
        // silently retime the GIF (and a mixed-delay entry has no rate to seed).
        expect(await window.locator('.mpi-tool-options-gif-timing input[inputmode="decimal"]').first().inputValue(),
            'the rate field opens blank').toBe('');

        // ── GIF output: 16 px longest edge, 16 colours, transparent ─────────
        await setNumber(2, 16);
        await setNumber(3, 16);
        const picker = window.locator('.mpi-tool-options-gif-timing .mpi-color-picker');
        await expect(picker, 'the edge colour only matters for a transparent build').toBeHidden();
        // The switch track covers the input, so click the label (a real user click).
        await window.locator('.mpi-tool-options-gif-timing .mpi-checkbox').click();
        expect(await window.locator('.mpi-tool-options-gif-timing .mpi-checkbox__input').isChecked()).toBe(true);
        await expect(picker).toBeVisible();
        r = await apply(3);
        expect(r.entry.gif.output).toEqual({ maxEdge: 16, colours: 16, edgeColour: '#000000' });
        expect(r.meta.width).toBe(16);
        expect(r.meta.pageHeight).toBe(12);
        expect(r.meta.pages).toBe(3);
        expect(r.meta.loop).toBe(3);
        expect(r.meta.delay, 'a blank rate left the delays alone').toEqual([60, 60, 60]);
        expect((await pixel(r.gifPath, 0, 0, 0)).a, 'the transparent column survives').toBe(0);
        expect((await pixel(r.gifPath, 0, 12, 6)).a, 'the colour stays opaque').toBe(255);

        // ── Frames: the list changed four times, the store never did ─────────
        // Rate, reverse, trim+loop and the build settings all rewrite the LIST.
        expect(await storeCount(), 'no operation so far wrote a frame file').toBe(storeBefore);

        // ── ...and EVERY operation keeps the range, not just this panel ──────
        // Resize stands in for crop / cut-out / GIF to Video: they all take their
        // frames from the Block's one `_opFrames()`. Unlike the four above it DOES
        // write frames — that is what makes it the right witness here.
        const transform = '.mpi-tool-options-gif-transform';
        await openTool('transform', 'Resize', transform);
        await setRange(0, 1);
        await setNumber(0, 8, transform);
        r = await apply(2, transform);
        expect(r.meta.pages, 'Resize kept the two frames between the handles').toBe(2);
        expect(r.meta.width).toBe(8);
        // Two frames resized, two written (+ their thumbs) — and only two, because
        // the four frames outside the handles were never resized at all.
        expect(await storeCount(), 'resize wrote exactly the frames it kept').toBe(storeBefore + 4);

        expect((await history()).length).toBe(6);
    } finally {
        if (app) await closeApp(app);
        if (projectFolderPath) await fs.remove(projectFolderPath).catch(() => {});
    }
});
