const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-958 — the Cue button, not only the gallery card, says a cloud run is still inside
 * its send window. The card's "Sending in N..." is hidden with card info off, and that
 * was the only sign a Stop was still free.
 *
 * Also: holding Cue to arm Loop sweeps an --accent-heat fill across it, and the press
 * state used to paint the whole button the same colour, so the sweep never showed.
 */
test.setTimeout(120000);

async function clearBootModals(window) {
    const backdrops = () => window.evaluate(() => document.querySelectorAll('.mpi-modal-backdrop').length);
    const cont = window.locator('.mpi-modal-backdrop button:has-text("Continue")').first();
    if (await cont.count()) await cont.click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 8 && await backdrops() > 0; i++) {
        await window.keyboard.press('Escape');
        await window.waitForTimeout(400);
    }
    expect(await backdrops()).toBe(0);
}

test('Cue counts down the cloud send window, and its hold fill shows against the press', async ({}, testInfo) => {
    const { app, window } = await launchApp(testInfo);
    try {
        await window.waitForTimeout(6000); // shell boot settles
        await clearBootModals(window);

        const name = `mpi958-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        await window.evaluate(async ({ name, folderPath }) => {
            const [{ createProject, openProject }, { navigate, PAGE_GALLERY }, { state }, { Events }, { MODELS }] = await Promise.all([
                import('/js/services/projectService.js'), import('/js/router.js'), import('/js/state.js'),
                import('/js/events.js'), import('/js/data/modelRegistry.js'),
            ]);
            // The CI runner has no weights, and with none the gallery shows "No models
            // installed" instead of a prompt box. Re-stubbed after every boot model sync
            // (docs/testing-desktop-specs.md, trap 5), as gallery-stack-run.spec.js does.
            const model = MODELS.find(m => m.id === 'klein-4b');
            const stub = () => {
                model.installed = true;
                const ids = state.s_installedModelIds || [];
                if (!ids.includes(model.id)) state.s_installedModelIds = [...ids, model.id];
            };
            stub();
            Events.on('models:checked', stub);
            state.s_selectedModelIdByType = { image: model.id, video: null };
            state.s_lastSelectedMediaType = 'image';
            await openProject(await createProject(name, folderPath));
            navigate(PAGE_GALLERY);
        }, { name, folderPath: testInfo.outputPath('projects') });
        const cue = window.locator('.mpi-prompt-box__cue-btn').first();
        await cue.waitFor({ timeout: 30000 });

        const label = () => cue.locator('.mpi-ibtn__label').textContent();
        const tick = (seconds) => window.evaluate(async (s) => {
            const { Events } = await import('/js/events.js');
            Events.emit('generation:send-countdown', { id: 'mpi958', seconds: s });
        }, seconds);

        // 1. The send window rides on the button, and 0 (sent or stopped) hands it back.
        const idle = await label();
        await tick(3);
        await expect.poll(label).toBe('Sending in 3');
        await tick(1);
        await expect.poll(label).toBe('Sending in 1');
        await tick(0);
        await expect.poll(label).toBe(idle);

        // 2. Mid-hold, the button is not the fill's colour. Leave before release, so the
        //    gesture neither arms Loop nor clicks a real run.
        const box = await cue.boundingBox();
        await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await window.mouse.down();
        await window.waitForTimeout(350);
        const colours = await cue.evaluate((btn) => ({
            button: getComputedStyle(btn).backgroundColor,
            fill: getComputedStyle(btn.querySelector('.mpi-prompt-box__cue-fill')).backgroundColor,
        }));
        await window.screenshot({ path: testInfo.outputPath('cue-mid-hold.png') });
        await window.mouse.move(box.x + box.width / 2, box.y - 200);
        await window.mouse.up();
        expect(colours.button).not.toBe(colours.fill);
        expect(await window.evaluate(async () => (await import('/js/state.js')).state.loopArmed)).toBeFalsy();
    } finally {
        await closeApp(app);
    }
});
