const fs = require('fs');
const { test, expect, _electron: electron } = require('@playwright/test');
const { shellWindow } = require('./shellWindow');

/**
 * MPI-1070 — a No GPU (download-only) Pod no longer blocks projects. Every run on one
 * already goes local (getEngine, MPI-539), so the project must open, and the prompt
 * box's "Run locally" toggle is locked ON so the pickers, the install check and the
 * lane follow the engine that actually runs. Back home the lock lifts, so the Model
 * Manager reads the Pod's installs again.
 *
 * The Pod is faked in the renderer (remoteEngineClient's mirror); the engine root is an
 * empty scratch dir, so nothing here can start or touch a real engine.
 */
test.setTimeout(180000);

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

/** Fakes the connected Pod: `noGpu` true = the download-only CPU Pod. */
const fakePod = (window, noGpu) => window.evaluate(async (noGpu) => {
    const { remoteEngineClient } = await import('/js/services/remoteEngineClient.js');
    remoteEngineClient.refresh = async function () { this._active = true; this._noGpu = noGpu; };
    remoteEngineClient._active = true;
    remoteEngineClient._noGpu = noGpu;
}, noGpu);

const page = (window) => window.evaluate(async () => (await import('/js/state.js')).state.currentPage);
const override = (window) => window.evaluate(async () => (await import('/js/state.js')).state.engineOverride);
const toggle = (window) => window.locator('.mpi-prompt-box__engine-toggle');

test('No GPU Pod: projects open, Run locally locked on, lifted on the way home', async ({}, testInfo) => {
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
        await fakePod(window, true);
        // A saved DeepInfra key (faked): the cloud models are what mounts a prompt box in
        // this empty profile, and DeepInfra in a project is half of what Fabio wanted.
        await window.evaluate(async () => {
            const { secretsClient } = await import('/js/core/secretsClient.js');
            secretsClient.hasEndpointKey = async () => true;
            await (await import('/js/data/modelRegistry.js')).refreshCloudKey();
        });
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            window.__mpi1070 = { warn: [], checks: [] };
            Events.on('ui:warning', ({ message }) => window.__mpi1070.warn.push(message));
            const realFetch = window.fetch;
            window.fetch = (url, ...rest) => {
                if (String(url).includes('/comfy/models/check')) window.__mpi1070.checks.push(String(url));
                return realFetch(url, ...rest);
            };
        });

        // 1. Create through the landing page's own button: the No GPU gate sat here.
        await window.locator('#newProjectBtn button').click();
        await window.locator('.mpi-new-project input').first().fill('No GPU Pod');
        await window.locator('.mpi-new-project__actions button:has-text("Create")').click();
        await expect.poll(() => page(window), { timeout: 30000 }).toBe('gallery');
        await window.keyboard.press('Escape'); // a "No models yet" popup, if any

        // 2. Locked ON: shown, active, disabled; the override is local, and the install
        //    check went to the LOCAL disk.
        await expect(toggle(window)).toBeVisible({ timeout: 15000 });
        await expect(toggle(window)).toHaveClass(/is-active/);
        await expect(toggle(window)).toBeDisabled();
        await expect.poll(() => override(window)).toBe('local');
        await expect.poll(() => window.evaluate(() => window.__mpi1070.checks.some(u => u.includes('/check-local'))),
            { timeout: 15000 }).toBe(true);

        // 3. Home lifts the lock (the Model Manager there reads the Pod again) ...
        await window.evaluate(async () => {
            const { navigate, PAGE_LANDING } = await import('/js/router.js');
            navigate(PAGE_LANDING);
            (await import('/js/shell/projectUI.js')).loadProjectGrid();
        });
        await expect.poll(() => override(window)).toBe(null);

        // ... and opening a landing row puts it back.
        await window.locator('.mpi-landing__pl-row:not(.mpi-landing__pl-row--loading)', { hasText: 'No GPU Pod' })
            .first().click({ timeout: 30000 });
        await expect.poll(() => page(window), { timeout: 30000 }).toBe('gallery');
        await window.keyboard.press('Escape');
        await expect.poll(() => override(window)).toBe('local');
        await expect(toggle(window)).toBeDisabled();

        // 4. A GPU Pod connected instead: the lock lifts and the toggle is the user's again.
        await fakePod(window, false);
        await window.evaluate(async () => {
            const { Events } = await import('/js/events.js');
            Events.emit('remote:connection', { connected: true, phase: null, by: 'MPI-1070 spec' });
        });
        await expect.poll(() => override(window)).toBe(null);
        await expect(toggle(window)).toBeEnabled();
        await expect(toggle(window)).not.toHaveClass(/is-active/);

        const warn = await window.evaluate(() => window.__mpi1070.warn);
        expect(warn.filter(m => /download-only|no GPU/i.test(m)), 'no No GPU block toast').toEqual([]);
    } finally {
        await app.close();
    }
});
