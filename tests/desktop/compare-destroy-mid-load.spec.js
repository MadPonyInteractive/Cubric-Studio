const { test, expect } = require('@playwright/test');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-1143 — a Compare view destroyed while its pair is still loading stops quietly.
 *
 * The bug: `open()` awaited the BEFORE image, `destroy()` (a Flow step left, the History
 * overlay hidden) nulled the canvas meanwhile, and the resumed `open()` dereferenced it:
 * "Cannot read properties of null (reading 'el')", logged as a failed load. Loads that
 * queue ~16 s (MPI-1142) made that window wide enough for Fabio to hit it.
 *
 * The BEFORE image is held back by a route, the view is destroyed while it waits, then
 * the image is released.
 */
test.setTimeout(120000);

test('Compare: destroy during the load ends open() without an error', async ({}, testInfo) => {
    let app, window;
    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(3000);

        const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 60, b: 60 } } })
            .png().toBuffer();
        let release;
        const held = new Promise((r) => { release = r; });
        await window.route('**/mpi1143-before.png', async (route) => {
            await held;
            await route.fulfill({ status: 200, contentType: 'image/png', body: png });
        });
        await window.route('**/mpi1143-after.png', (route) =>
            route.fulfill({ status: 200, contentType: 'image/png', body: png }));

        await window.evaluate(async () => {
            const { MpiCompareView } = await import('/js/components/Compounds/MpiCompareView/MpiCompareView.js');
            const { clientLogger } = await import('/js/services/clientLogger.js');
            window.__mpi1143Errors = [];
            const origError = clientLogger.error.bind(clientLogger);
            clientLogger.error = (...args) => { window.__mpi1143Errors.push(String(args[1]) + ' ' + String(args[2])); origError(...args); };
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px';
            document.body.appendChild(host);
            const view = MpiCompareView.mount(host);
            window.__mpi1143View = view;
            window.__mpi1143Open = view.el.open(
                { filePath: location.origin + '/mpi1143-before.png', name: 'before' },
                { filePath: location.origin + '/mpi1143-after.png', name: 'after' });
        });

        await window.waitForTimeout(500);
        await window.evaluate(() => window.__mpi1143View.el.destroy());
        release();

        const opened = await window.evaluate(() => window.__mpi1143Open);
        const errors = await window.evaluate(() => window.__mpi1143Errors);
        expect(errors, 'a destroyed view must not log a failed load').toEqual([]);
        expect(opened, 'open() reports the pair was not shown').toBe(false);
    } finally {
        await closeApp(app);
    }
});
