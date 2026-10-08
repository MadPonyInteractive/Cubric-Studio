// MPI-623 — the Scene viewer draws the card's pano and flies through it (plan Phase 3, Viewer).
//
// A fixture scene written to disk the way Convert writes one (manifest + `.scene.pano.png` +
// `.scene.pano_depth.f32` beside it): a 64x32 pano of four colour bands on a sphere of
// radius 5. The colour at the screen centre then says which way the camera looks, so a wrong
// pano->world mapping, a wrong yaw sign or a colour-managed texture all fail here. Then the
// fly keys: W moves forward, A moves left and, on this page only, does NOT toggle Agent mode.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(150000);

const STILL = '/comfy_workflows/display/flow-head-swap.webp';
// Bands by u (0..1 across the equirect): the centre band is what the start pose faces.
const BANDS = [
    { from: 0.375, to: 0.625, rgb: [30, 60, 220] },   // ahead: blue
    { from: 0.625, to: 0.875, rgb: [220, 40, 40] },   // right: red
    { from: 0.125, to: 0.375, rgb: [230, 210, 30] },  // left: yellow
];
const GREEN = [40, 200, 60];                          // behind (wraps the seam)

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

async function writeFixtureScene(metaDir, id) {
    const W = 64, H = 32, px = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        const band = BANDS.find(b => u >= b.from && u < b.to);
        px.set(band ? band.rgb : GREEN, (y * W + x) * 3);
    }
    fs.mkdirSync(metaDir, { recursive: true });
    await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(metaDir, `${id}.scene.pano.png`));
    const depth = new Float32Array(32 * 16).fill(5);
    fs.writeFileSync(path.join(metaDir, `${id}.scene.pano_depth.f32`), Buffer.from(depth.buffer));
    const manifest = { version: 1, pano: { image: 'pano.png', depth: 'pano_depth.f32', w: 32, h: 16, sky: 5 }, layers: [] };
    const file = path.join(metaDir, `${id}.scene.json`);
    fs.writeFileSync(file, JSON.stringify(manifest));
    return `/project-file?path=${encodeURIComponent(file)}`;
}

/** Draw one frame now and read the screen-centre pixel, all in one task. */
function centre(window, pose) {
    return window.evaluate((p) => {
        document.querySelector('.mpi-scene-block').setPose(p);
        const c = document.querySelector('.mpi-scene-canvas');
        const r = c.getRenderer(), gl = r.getContext();
        r.render(c.getScene(), c.getCamera());
        const out = new Uint8Array(4);
        gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
        return [...out];
    }, pose);
}

const getPose = (w) => w.evaluate(() => document.querySelector('.mpi-scene-block').getPose());

async function holdKey(window, key, ms) {
    await window.evaluate(async ({ k, t }) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        await new Promise(r => setTimeout(r, t));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
    }, { k: key, t: ms });
}

test('Scene viewer: the card\'s pano is drawn by direction, and W/A fly without toggling Agent mode', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await window.waitForTimeout(6000);
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('engine:install-skipped');
            await new Promise(r => setTimeout(r, 300));
        });
        await clearBootModals(window);

        const project = await window.evaluate(async ({ name, folderPath }) => {
            const { createProject, openProject } = await import('/js/services/projectService.js');
            const p = await createProject(name, folderPath);
            await openProject(p);
            return p;
        }, { name: `mpi623-viewer-${Date.now()}`, folderPath: testInfo.outputPath('projects') });
        const scenePath = await writeFixtureScene(path.join(project.folderPath, 'Media', '.meta'), 'e2e-pano');

        await window.evaluate(async ({ still, scenePath }) => {
            const { addGroup } = await import('/js/services/projectService.js');
            const at = new Date().toISOString();
            await addGroup({ id: 'e2e-scene', type: 'image', name: 'scene', createdAt: at, selectedIndex: 0, history: [
                { id: 'e2e-pano', type: 'image', filePath: still, thumbPath: still, createdAt: at, pixelDimensions: { w: 4096, h: 2048 }, scenePath },
            ] });
            const { navigate, PAGE_SCENE } = await import('/js/router.js');
            navigate(PAGE_SCENE, { groupId: 'e2e-scene' });
        }, { still: STILL, scenePath });

        await expect.poll(() => window.evaluate(() => document.querySelector('.mpi-scene-canvas')?.getScene?.()?.children.length ?? -1),
            { timeout: 20000 }).toBe(1);

        // ── The direction mapping: centre colour at four yaws ─────────────────────
        const near = (got, rgb) => rgb.every((v, i) => Math.abs(got[i] - v) <= 2) && got[3] === 255;
        const ahead = await centre(window, { yaw: 0 });
        expect(near(ahead, BANDS[0].rgb), `ahead is blue, got ${ahead}`).toBe(true);
        const right = await centre(window, { yaw: Math.PI / 2 });
        expect(near(right, BANDS[1].rgb), `right is red, got ${right}`).toBe(true);
        const left = await centre(window, { yaw: -Math.PI / 2 });
        expect(near(left, BANDS[2].rgb), `left is yellow, got ${left}`).toBe(true);
        const behind = await centre(window, { yaw: Math.PI });
        expect(near(behind, GREEN), `behind is green across the seam, got ${behind}`).toBe(true);

        // ── Fly: W forward, A left, and A is not Agent mode here ──────────────────
        await centre(window, { yaw: 0 });
        const agentBefore = await window.evaluate(async () => (await import('/js/state.js')).state.agentMode);
        await holdKey(window, 'w', 400);
        const afterW = await getPose(window);
        expect(afterW.pos[2], 'W moved forward (+Z at yaw 0)').toBeGreaterThan(0.02);
        expect(Math.abs(afterW.pos[0])).toBeLessThan(1e-6);
        await holdKey(window, 'a', 400);
        const afterA = await getPose(window);
        expect(afterA.pos[0], 'A moved left (-X)').toBeLessThan(-0.02);
        expect(await window.evaluate(async () => (await import('/js/state.js')).state.agentMode), 'A did not toggle Agent mode')
            .toBe(agentBefore);
        // Released: the camera stays put.
        await window.waitForTimeout(300);
        expect((await getPose(window)).pos).toEqual(afterA.pos);

        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});
