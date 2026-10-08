// MPI-623 — the Scene viewer draws the card's scene with hole rule C and flies through it
// (plan Phase 3, Viewer).
//
// A fixture scene written to disk the way Convert writes one (manifest + `.scene.pano.png` +
// `.scene.pano_depth.f32` beside it, plus one fill layer): a 4096x2048 pano of four colour
// bands on a sphere of radius 5, the behind band pulled in to 2.5. The colour at the screen
// centre then says which way the camera looks, so a wrong pano->world mapping, a wrong yaw
// sign or a colour-managed texture all fail here; the step between the bands must read as a
// HOLE (rule C's depth-edge tear) and the layer must win over the pano behind it. The texture
// is that big because rule C calls a texel drawn over 3+ screen px a stretch hole. Then the
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
const GREEN = [40, 200, 60];                          // behind (wraps the seam), nearer
const LAYER = [200, 90, 240];                         // a fill layer at yaw 45 degrees, depth 1
// A picture already taken in the scene: its entry must fly the camera back here.
const SHOT = { pos: [0.1, 0.05, 0.2], yaw: 1, pitch: 0.1, roll: 0.2, mm: 35, aspect: '9:16', fillLine: 'Forest' };

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
    const W = 4096, H = 2048, px = Buffer.alloc(W * H * 3);
    for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W;
        const band = BANDS.find(b => u >= b.from && u < b.to);
        for (let y = 0; y < H; y++) px.set(band ? band.rgb : GREEN, (y * W + x) * 3);
    }
    fs.mkdirSync(metaDir, { recursive: true });
    await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(metaDir, `${id}.scene.pano.png`));
    const DW = 32, DH = 16, depth = new Float32Array(DW * DH);
    for (let i = 0; i < DH; i++) for (let j = 0; j < DW; j++) {
        const u = (j + 0.5) / DW;
        depth[i * DW + j] = u < 0.125 || u >= 0.875 ? 2.5 : 5;
    }
    fs.writeFileSync(path.join(metaDir, `${id}.scene.pano_depth.f32`), Buffer.from(depth.buffer));
    // A 64 px fill seen from the pano camera at yaw 45 degrees (OpenCV w2c, y down), 1 unit out.
    const L = 64, c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
    await sharp(Buffer.alloc(L * L * 3).map((_, k) => LAYER[k % 3]), { raw: { width: L, height: L, channels: 3 } })
        .png().toFile(path.join(metaDir, `${id}.scene.layer0.png`));
    fs.writeFileSync(path.join(metaDir, `${id}.scene.layer0_depth.f32`), Buffer.from(new Float32Array(L * L).fill(1).buffer));
    const layer = { image: 'layer0.png', depth: 'layer0_depth.f32', w: L, h: L, fx: 1000, fy: 1000, cx: L / 2, cy: L / 2,
        w2c: [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1] };
    const manifest = { version: 1, pano: { image: 'pano.png', depth: 'pano_depth.f32', w: DW, h: DH, sky: 5 }, layers: [layer] };
    const file = path.join(metaDir, `${id}.scene.json`);
    fs.writeFileSync(file, JSON.stringify(manifest));
    return `/project-file?path=${encodeURIComponent(file)}`;
}

/** Draw one frame now and read the screen-centre pixel, all in one task. */
function centre(window, pose) {
    return window.evaluate((p) => {
        document.querySelector('.mpi-scene-block').setPose(p);
        const c = document.querySelector('.mpi-scene-canvas');
        const gl = c.getRenderer().getContext();
        c.renderNow();
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

test('Scene viewer: the card\'s scene is drawn by direction with rule C holes and its layer, and W/A fly without toggling Agent mode', async ({}, testInfo) => {
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

        await window.evaluate(async ({ still, scenePath, shot }) => {
            const { addGroup } = await import('/js/services/projectService.js');
            const at = new Date().toISOString();
            await addGroup({ id: 'e2e-scene', type: 'image', name: 'scene', createdAt: at, selectedIndex: 0, history: [
                { id: 'e2e-pano', type: 'image', filePath: still, thumbPath: still, createdAt: at, pixelDimensions: { w: 4096, h: 2048 }, scenePath },
                { id: 'e2e-shot', type: 'image', filePath: still, thumbPath: still, createdAt: at, pixelDimensions: { w: 768, h: 1360 },
                    operation: 'scenePicture', scenePose: shot },
            ] });
            const { navigate, PAGE_SCENE } = await import('/js/router.js');
            navigate(PAGE_SCENE, { groupId: 'e2e-scene' });
        }, { still: STILL, scenePath, shot: SHOT });

        await expect.poll(() => window.evaluate(() => !!document.querySelector('.mpi-scene-block')?.isLoaded?.()),
            { timeout: 30000 }).toBe(true);
        const gpu = await window.evaluate(() => {
            const r = document.querySelector('.mpi-scene-canvas').getRenderer(), gl = r.getContext();
            return { reversed: r.capabilities.reversedDepthBuffer, clip: !!gl.getExtension('EXT_clip_control') };
        });
        console.log(`[scene-viewer] reverse depth: ${gpu.reversed} (EXT_clip_control ${gpu.clip})`);
        // Electron's SwiftShader has EXT_clip_control too, so a false here is the option's NAME
        // (three ^0.186 ignores 0.170's `reverseDepthBuffer` silently), not the machine.
        expect(gpu.reversed, `reversedDepthBuffer took (EXT_clip_control ${gpu.clip})`).toBe(true);

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

        // ── Rule C: the depth step is a hole; the fill layer wins over the pano behind it ──
        const tear = await centre(window, { yaw: 3 * Math.PI / 4 });
        expect(tear[3], `the step between red (5) and green (2.5) is a tear hole, got ${tear}`).toBe(0);
        const layer = await centre(window, { yaw: Math.PI / 4 });
        expect(near(layer, LAYER), `the layer at depth 1 covers the pano at 5, got ${layer}`).toBe(true);

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

        // ── The picture panel ─────────────────────────────────────────────────────
        const panel = window.locator('.mpi-scene-block__panel');
        const frameRatio = () => window.evaluate(() => {
            const r = document.querySelector('.mpi-scene-block__frame').getBoundingClientRect();
            return Math.round(r.width / r.height * 100) / 100;
        });
        await expect(panel.locator('.mpi-scene-block__readout')).toContainText('Height 1.60 m · 24 mm · roll 0°');
        await expect(panel.locator('button:has-text("Take picture")')).toBeEnabled();
        expect(await frameRatio(), 'the frame starts 16:9').toBe(1.78);
        await panel.locator('button:has-text("1:1")').click();
        await expect.poll(frameRatio, { message: '1:1 letterboxes the frame square' }).toBe(1);
        await holdKey(window, 'c', 300);
        expect((await getPose(window)).roll, 'C rolls the camera right').toBeGreaterThan(0.05);
        await expect(panel.locator('.mpi-scene-block__readout')).not.toContainText('roll 0°');
        // A picture's entry flies the camera back to where it was taken, frame and lens too.
        await panel.locator('.mpi-history-list__card').nth(1).click();
        const { aspect: _a, fillLine: _f, ...shotPose } = SHOT;
        await expect.poll(() => getPose(window)).toEqual(shotPose);
        await expect.poll(frameRatio, { message: 'the entry\'s 9:16 frame' }).toBe(0.56);
        await expect(panel.locator('.mpi-dropdown').first()).toContainText('35 mm');

        expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    } finally {
        await closeApp(app);
    }
});
