const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-532 — the gallery's import overlay must never strand visible.
 *
 * Fabio, 2026-09-18 (twice): inside a project, open the Flow Library, drop a Flow folder
 * on it, go back to the Gallery — "Drop image, video, or audio to import" covers the
 * gallery and nothing dismisses it but leaving the project and coming back.
 *
 * Root cause: `_dragCounter` in MpiGalleryBlock counts dragenter/dragleave on WINDOW and
 * only a `drop` zeroes it — but every drop overlay (this one, the Flow Library's) calls
 * stopPropagation() so the file is handled once, so on the bubble phase that reset never
 * ran for a drop landing ON an overlay. The counter stayed above zero and the next
 * dragleave could not reach zero. The reset is a capture-phase listener now.
 *
 * Both paths below stranded the counter before the fix; each asserts the overlay is gone
 * AND that a later drag still hides on its own (the counter is genuinely back at zero).
 */
test.setTimeout(90000);

const VISIBLE = '.mpi-media-drop-overlay--visible';

async function boot(window, testInfo) {
    await window.evaluate(async () => {
        const { Events } = await import('/js/events.js');
        Events.emit('engine:install-skipped');
        await new Promise(r => setTimeout(r, 300));
    });
    const folderPath = testInfo.outputPath('project');
    fs.mkdirSync(folderPath, { recursive: true });
    const project = { id: 'e2e-drop', name: 'E2E Drop', modelSettings: {}, itemGroups: [] };
    fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));
    await window.evaluate(async (p) => {
        const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([
            import('/js/state.js'), import('/js/router.js'),
        ]);
        state.currentProject = p;
        navigate(PAGE_GALLERY);
        await new Promise(r => setTimeout(r, 1000));
    }, { ...project, folderPath: folderPath.replace(/\\/g, '/') });
}

// The drag helpers have to run in-page: a DragEvent needs a real DataTransfer, which
// Playwright cannot hand across the boundary. Defined per evaluate — an eval'd block's
// declarations do not reach the surrounding function scope.
const HELPERS = (visible) => {
    const drag = (type, target) => {
        const dt = new DataTransfer();
        dt.items.add(new File(['x'], 'dropped', { type: 'image/png' }));
        target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    };
    return { drag, shown: () => !!document.querySelector(visible), sleep: (ms) => new Promise(r => setTimeout(r, ms)) };
};

test('a drop on the Flow Library overlay leaves no stuck gallery overlay', async ({}, testInfo) => {
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);
    try {
        await boot(window, testInfo);
        const r = await window.evaluate(async ({ helpers, visible }) => {
            const { drag, shown, sleep } = new Function(`return (${helpers})`)()(visible);
            const { Events } = await import('/js/events.js');
            const out = {};
            Events.emit('flows:open');
            await sleep(500);
            const libOverlay = document.querySelector('.mpi-project-drop-overlay');
            out.libraryOpen = !!libOverlay;

            // The drag crosses the whole window, so the gallery arms behind the Library.
            drag('dragenter', libOverlay);
            out.armedBehindLibrary = shown();
            drag('drop', libOverlay);          // the Library's overlay stops the bubble here
            await sleep(300);
            out.afterDrop = shown();

            // Back to the gallery: this is the state Fabio could not dismiss.
            Events.emit('ui:close-all-popups');
            document.querySelector('.mpi-overlay__close, #flow-lib-close')?.click();
            await sleep(300);
            out.backOnGallery = shown();

            // And the counter really is back at zero: one more enter/leave pair clears.
            drag('dragenter', document.body);
            out.armsAgain = shown();
            drag('dragleave', document.body);
            await sleep(100);
            out.hidesAgain = !shown();
            return out;
        }, { helpers: HELPERS.toString(), visible: VISIBLE });

        expect(r.libraryOpen).toBe(true);
        expect(r.afterDrop).toBe(false);
        expect(r.backOnGallery).toBe(false);
        expect(r.armsAgain).toBe(true);
        expect(r.hidesAgain).toBe(true);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await closeApp(app);
    }
});

test('a drop on the gallery overlay itself leaves the counter at zero', async ({}, testInfo) => {
    const { app, window, pageErrors } = await launchApp(testInfo);
    try {
        await boot(window, testInfo);
        const r = await window.evaluate(async ({ helpers, visible }) => {
            const { drag, shown, sleep } = new Function(`return (${helpers})`)()(visible);
            const out = {};
            drag('dragenter', document.body);
            out.armed = shown();
            const overlay = document.querySelector('.mpi-media-drop-overlay');
            drag('drop', overlay);             // its own handler hides it and stops the bubble
            await sleep(300);
            out.afterDrop = shown();
            drag('dragenter', document.body);
            out.armsAgain = shown();
            drag('dragleave', document.body);
            await sleep(100);
            out.hidesAgain = !shown();
            return out;
        }, { helpers: HELPERS.toString(), visible: VISIBLE });

        expect(r.armed).toBe(true);
        expect(r.afterDrop).toBe(false);
        expect(r.armsAgain).toBe(true);
        expect(r.hidesAgain).toBe(true);
        expect(pageErrors).toEqual([]);
    } finally {
        await closeApp(app);
    }
});
