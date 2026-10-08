const fs = require('fs');
const sharp = require('sharp');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

/**
 * MPI-856 — the cloud-only user: "Skip the local engine install" on, no Pod, nothing in the
 * engine root. Paid cloud models are for exactly this user, and until 2026-09-30 the app
 * refused them a project. Held down here, through the real UI:
 *
 * - "+ New project" creates and opens a project, and a landing row opens one;
 * - History dims the rail tools that need ComfyUI, with the reason as their label;
 * - an engine start refuses with ONE warning and the `no_engine` code, never the
 *   "ComfyUI failed to start" error dialog;
 * - a Flow never mounts (every Flow is a ComfyUI graph), even through `flow:open`.
 *
 * The engine root is an empty scratch dir, so nothing here can start or touch a real engine.
 */
test.setTimeout(180000);

const REASON = 'Needs the ComfyUI engine, which is not installed. Cloud models still work.';

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

/** Every warning and error the app raises from here on, by message. */
async function recordToasts(window) {
    await window.evaluate(async () => {
        const { Events } = await import('/js/events.js');
        window.__mpi856 = { warn: [], err: [] };
        Events.on('ui:warning', ({ message }) => window.__mpi856.warn.push(message));
        Events.on('ui:error', ({ title, message }) => window.__mpi856.err.push(`${title}: ${message}`));
    });
}
const toasts = (window) => window.evaluate(() => {
    const t = { warn: [...window.__mpi856.warn], err: [...window.__mpi856.err] };
    window.__mpi856.warn = []; window.__mpi856.err = [];
    return t;
});
const page = (window) => window.evaluate(async () => (await import('/js/state.js')).state.currentPage);

test('no engine, no Pod: projects open, engine tools refuse by name, Flows stay shut', async ({}, testInfo) => {
    const userDataDir = testInfo.outputPath('user-data');
    const documentsDir = testInfo.outputPath('documents');
    const engineRoot = testInfo.outputPath('engine');
    for (const d of [userDataDir, documentsDir, engineRoot]) fs.mkdirSync(d, { recursive: true });

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    Object.assign(env, {
        CUBRIC_E2E: '1', CUBRIC_E2E_USER_DATA: userDataDir,
        APP_DOCUMENTS: documentsDir, CUBRIC_ENGINE_ROOT: engineRoot,
    });

    const app = await electron.launch({ args: ['.'], env });
    try {
        const window = await shellWindow(app);
        await clearBootModals(window);

        // The user who chose "Remote only" at first launch.
        const noEngine = await window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            state.runpodConfig = { ...(state.runpodConfig || {}), skipLocalEngine: true };
            return (await import('/js/services/engineGate.js')).hasNoEngine();
        });
        expect(noEngine, 'premise: this instance has no engine').toBe(true);
        await recordToasts(window);

        // 1. Create through the landing page's own button: the gate used to sit here.
        await window.locator('#newProjectBtn button').click();
        await window.locator('.mpi-new-project input').first().fill('No Engine');
        await window.locator('.mpi-new-project__actions button:has-text("Create")').click();
        await expect.poll(() => page(window), { timeout: 30000 }).toBe('gallery');

        // No key yet, so no usable model: the popup points at the DeepInfra key, never at
        // "install one" (impossible here), and opens the Remote panel without leaving.
        const prompt = window.locator('.mpi-ok-cancel', { hasText: 'No models yet' });
        await expect(prompt).toBeVisible({ timeout: 15000 });
        await prompt.locator('button:has-text("Add a DeepInfra key")').click();
        await expect(window.locator('.mpi-remote')).toBeVisible();
        expect(await page(window)).toBe('gallery');

        // MPI-1046: Language Models never offers ComfyUI here. Both rows grey it, and the
        // default ComfyUI pick says it runs on Remote (which runnableBackend already does).
        await expect(window.locator('.mpi-llm-settings--loading')).toHaveCount(0, { timeout: 15000 });
        const toggle = (slot) => window.evaluate((sel) => document.querySelector(sel).click(), `${slot} .mpi-dropdown__trigger`);
        for (const slot of ['#mpiSettingsLlmEnhanceBackendSlot', '#mpiSettingsLlmDescribeBackendSlot']) {
            await toggle(slot);
            const comfy = window.locator('.mpi-dropdown__list.is-open .mpi-dropdown__option[data-value="comfy"]');
            await expect(comfy).toHaveClass(/is-disabled/);
            await expect(comfy).toContainText('Needs the ComfyUI engine');
            await toggle(slot);
        }
        await expect(window.locator('#mpiSettingsLlmDescribeNote')).toContainText('runs on Remote');
        await window.keyboard.press('Escape');

        // 2. Back to the landing page and open it from its row.
        await window.evaluate(async () => {
            const { navigate, PAGE_LANDING } = await import('/js/router.js');
            navigate(PAGE_LANDING);
            (await import('/js/shell/projectUI.js')).loadProjectGrid();
        });
        await window.locator('.mpi-landing__pl-row:not(.mpi-landing__pl-row--loading)', { hasText: 'No Engine' })
            .first().click({ timeout: 30000 });
        await expect.poll(() => page(window), { timeout: 30000 }).toBe('gallery');
        expect(await toasts(window), 'create + open raise nothing').toEqual({ warn: [], err: [] });
        // The same popup on this mount too; dismiss it (Escape hides, no navigation).
        await expect(prompt).toBeVisible({ timeout: 15000 });
        await window.keyboard.press('Escape');
        await expect(prompt).toBeHidden();

        // 3. History on an imported still: the engine tools are dimmed with the reason.
        const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#808080' } }).png().toBuffer();
        const groupId = await window.evaluate(async ({ base64 }) => {
            const { state } = await import('/js/state.js');
            const { Events } = await import('/js/events.js');
            const project = state.currentProject;
            const itemId = crypto.randomUUID();
            const res = await fetch(`/project-media/${project.id}/upload?folderPath=${encodeURIComponent(project.folderPath)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: 'grey.png', base64Data: base64, autoSequence: true, itemId, mediaType: 'image', width: 64, height: 64 }),
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
                    url: `/project-file?path=${encodeURIComponent(data.filePath)}`, filename: data.filename, itemId,
                    thumbPath: data.thumbPath || null, thumbPathLg: data.thumbPathLg || null,
                    proxyPath: null, pixelDimensions: { w: 64, h: 64 }, mediaType: 'image',
                });
            });
        }, { base64: png.toString('base64') });
        await window.evaluate(async (id) => {
            const { navigate, PAGE_GROUP_HISTORY } = await import('/js/router.js');
            navigate(PAGE_GROUP_HISTORY, { groupId: id });
        }, groupId);
        await expect(window.locator('.mpi-history-tools')).toBeVisible();
        await expect.poll(() => window.locator(`.mpi-history-tools__btn[data-info="${REASON}"]`).count(), { timeout: 15000 })
            .toBeGreaterThanOrEqual(1);

        // 4. The one refusal: an engine start warns once, codes `no_engine`, never errors.
        const code = await window.evaluate(async () => {
            const { getEngine } = await import('/js/services/comfyController.js');
            return getEngine(true).ensureServerRunning().then(() => 'started', (e) => e.code);
        });
        expect(code).toBe('no_engine');
        const refusal = await toasts(window);
        expect(refusal.err, 'no "ComfyUI failed to start" dialog').toEqual([]);
        expect(refusal.warn).toHaveLength(1);
        expect(refusal.warn[0]).toContain('Cloud models still work');

        // 5. A Flow never mounts, even past the Library door (Reuse emits flow:open directly).
        await window.evaluate(async () => {
            const { FLOWS } = await import('/js/data/flowsRegistry.js');
            (await import('/js/events.js')).Events.emit('flow:open', { flowId: FLOWS[0].id });
        });
        await window.waitForTimeout(1000);
        expect(await window.locator('.mpi-base-flow').count(), 'no Flow mounted').toBe(0);
        expect((await toasts(window)).warn).toHaveLength(1);

        // 6. Saving a DeepInfra key (a dummy: nothing is sent, the key only has to exist,
        //    in this test's own user-data) makes the cloud models usable with no restart.
        //    A no-engine machine never reaches the disk-check edge, so this is the only way in.
        await window.evaluate(async () => {
            const { navigate, PAGE_GALLERY } = await import('/js/router.js');
            navigate(PAGE_GALLERY);
            const { secretsClient } = await import('/js/core/secretsClient.js');
            await secretsClient.setEndpointKey('deepinfra', 'mpi-856-dummy-key');
        });
        await expect.poll(() => window.evaluate(async () => {
            const { state } = await import('/js/state.js');
            const { getModelById } = await import('/js/data/modelRegistry.js');
            return (state.s_installedModelIds || []).filter(id => getModelById(id)?.provider).length;
        }), { timeout: 15000 }).toBeGreaterThan(0);
    } finally {
        await app.close().catch(() => {});
    }
});
