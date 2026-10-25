const { test, expect } = require('@playwright/test');
const sharp = require('sharp');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-1290 — Compare labels each side with its card's user-set name.
 *
 * The gallery hands the compare surface two history items, and an item never carries
 * the card's `customName`, so two renamed cards compared as two file names. The gallery
 * now passes the names; an unnamed side keeps the item's own label.
 */
test.setTimeout(120000);

test('Compare: card names label the sides, unnamed sides fall back to the item', async ({}, testInfo) => {
    let app, window;
    try {
        ({ app, window } = await launchApp(testInfo));
        await window.waitForTimeout(3000);

        const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 60, g: 120, b: 200 } } })
            .png().toBuffer();
        await window.route('**/mpi1290-*.png', (route) =>
            route.fulfill({ status: 200, contentType: 'image/png', body: png }));

        const labels = await window.evaluate(async () => {
            const { MpiCompareView } = await import('/js/components/Compounds/MpiCompareView/MpiCompareView.js');
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px';
            document.body.appendChild(host);
            const view = MpiCompareView.mount(host);
            const read = () => [...host.querySelectorAll('.mpi-compare-view__label')].map((l) => l.textContent);
            const a = { filePath: location.origin + '/mpi1290-a.png', name: 't2v_001' };
            const b = { filePath: location.origin + '/mpi1290-b.png', name: 't2v_002' };
            await view.el.open(a, b, { a: 'Hero take', b: null });
            const named = read();
            await view.el.open(a, b);
            const unnamed = read();
            view.el.destroy();
            host.remove();
            return { named, unnamed };
        });

        expect(labels.named).toEqual(['Hero take', 't2v_002']);
        expect(labels.unnamed).toEqual(['t2v_001', 't2v_002']);
    } finally {
        await closeApp(app);
    }
});
