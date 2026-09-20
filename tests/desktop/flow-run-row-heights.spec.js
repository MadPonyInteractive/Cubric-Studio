const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-822 — Cue and Stop are exactly the same height.
 *
 * They are not the same height by construction and never were: a text `md`
 * MpiButton is 47px (13px line + 14/14 padding + 2 border) and an icon-only `md`
 * is 50px, because `.mpi-btn--md.mpi-ibtn .mpi-icon` is a 20px glyph. Pairing them
 * on one row is what `.mpi-base-flow__run-row` does, and its `align-items: stretch`
 * only ever reached the two mount HOSTS — each button kept its own height inside a
 * stretched block wrapper, so Cue sat 3px short and the pair read as a dented Stop
 * (Fabio, second app pass).
 *
 * Built here rather than navigated to: the classes, the CSS and the two MpiButton
 * variants are the app's real ones, and the run slide needs a flow with satisfied
 * media inputs to reach — which would test the carousel, not the row.
 */
test('the flow run row gives Cue and Stop identical geometry', async ({}, testInfo) => {
    const { app, window } = await launchApp(testInfo);

    try {
        const geom = await window.evaluate(async () => {
            const { MpiButton } = await import('/js/components/Primitives/MpiButton/MpiButton.js');

            // The real markup MpiBaseFlow builds for the run cluster.
            const row = document.createElement('div');
            row.className = 'mpi-base-flow__run-row';
            row.style.cssText = 'position:fixed;top:100px;left:100px;width:236px';
            const runHost = document.createElement('div');
            runHost.className = 'mpi-base-flow__run-host';
            const stopHost = document.createElement('div');
            row.appendChild(runHost);
            row.appendChild(stopHost);
            document.body.appendChild(row);

            const cue = MpiButton.mount(runHost, { text: 'Cue', variant: 'primary', size: 'md' });
            const stop = MpiButton.mount(stopHost, { icon: 'stop', variant: 'secondary', size: 'md' });
            await new Promise(r => setTimeout(r, 300));

            const box = (node) => {
                const r = node.getBoundingClientRect();
                return { h: +r.height.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) };
            };
            const out = { cue: box(cue.el), stop: box(stop.el) };
            row.remove();
            return out;
        });

        // Same height, and sharing both edges — a pair can match in height and still
        // read as broken if one of them floats off the baseline.
        expect(geom.stop.h, 'Stop must be exactly as tall as Cue').toBe(geom.cue.h);
        expect(geom.stop.top, 'Stop must share Cue\'s top edge').toBe(geom.cue.top);
        expect(geom.stop.bottom, 'Stop must share Cue\'s bottom edge').toBe(geom.cue.bottom);
    } finally {
        await closeApp(app);
    }
});
