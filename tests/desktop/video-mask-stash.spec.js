const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-1073 — a video mask survives leaving the clip, and Extract hands it to the new clip.
 *
 * MpiVideoViewer mounted on its own; the clips are never decoded (the stash is keyed by
 * URL, nothing here needs a frame). What is proven: a track comes back when its clip is
 * loaded again, another clip does not see it, `carryMasksTo` gives the extracted clip the
 * same URLs from frame 0, and Clear forgets it for good.
 */
test.setTimeout(120000);

test('video mask: survives returning to the clip, carries onto the extract, Clear forgets it', async ({}, testInfo) => {
    let app, window, pageErrors;
    try {
        ({ app, window, pageErrors } = await launchApp(testInfo));
        await window.waitForTimeout(4000);

        const r = await window.evaluate(async () => {
            const { MpiVideoViewer } = await import('/js/components/Organisms/MpiVideoViewer/MpiVideoViewer.js');
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;top:0;left:0;width:400px;height:300px';
            document.body.appendChild(host);
            const v = MpiVideoViewer.mount(host, {});
            const extracts = [];
            v.on('mask-extract', (p) => extracts.push(p));
            const urls = ['/m0.png', '/m1.png', '/m2.png'];
            const out = {};

            v.el.loadVideo('/clip-a.mp4');
            v.el.setVideoMasks({ urls, trimIn: 1, trimOut: 2, fps: 3 });
            v.el.loadVideo('/clip-b.mp4');
            out.otherClip = v.el.hasVideoMasks();
            v.el.loadVideo('/clip-a.mp4');
            out.backOnA = v.el.hasVideoMasks();
            v.el.extractMask({ background: null });

            v.el.carryMasksTo('/clip-c.webm', { fps: 3 });
            v.el.loadVideo('/clip-c.webm');
            out.onExtract = v.el.hasVideoMasks();
            v.el.extractMask({ background: null });

            v.el.clearMask();
            v.el.loadVideo('/clip-a.mp4');
            v.el.loadVideo('/clip-c.webm');
            out.afterClear = v.el.hasVideoMasks();
            v.el.loadVideo('/clip-a.mp4');
            out.aAfterClearOfC = v.el.hasVideoMasks();

            out.extracts = extracts;
            v.destroy?.();
            host.remove();
            return out;
        });

        expect(r.otherClip, 'another clip does not show the track').toBe(false);
        expect(r.backOnA, 'the track is back with its clip').toBe(true);
        expect(r.extracts[0]).toMatchObject({ masks: ['/m0.png', '/m1.png', '/m2.png'], trimIn: 1, trimOut: 2 });
        expect(r.onExtract, 'the extracted clip carries the track').toBe(true);
        expect(r.extracts[1]).toMatchObject({ masks: ['/m0.png', '/m1.png', '/m2.png'], trimIn: 0, trimOut: 1 });
        expect(r.afterClear, 'Clear forgets that clip\'s track').toBe(false);
        expect(r.aAfterClearOfC, 'the source keeps its own').toBe(true);
        expect(pageErrors).toEqual([]);
    } finally {
        if (app) await closeApp(app);
    }
});
