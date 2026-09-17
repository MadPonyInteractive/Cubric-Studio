const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-532 — Flow packages in `<userData>/user_flows/` reach the real Flow Library.
 *
 * WHY THIS NEEDS A REAL APP. The unit test proves the scan, the validator, the install and
 * the registration against stubs; only a booted app proves the join: main.js hands the
 * profile to the server fork as APP_USER_DATA, shell boot awaits the scan before the first
 * sync, and the preview and graph are served under the `/comfy_workflows/` paths every
 * fetch site already uses — through express.static and workflowStatic, which both have to
 * pass the nested path on.
 */
test.setTimeout(90000);

const ROOT = path.join(__dirname, '..', '..');

/** Write one package into `dir`. */
function writePackage(dir, id, title, extra = {}) {
    const { MODELS } = require(path.join(ROOT, 'js/data/modelConstants/models.js'));
    const display = path.join(ROOT, 'comfy_workflows', 'display');
    const still = fs.readdirSync(display).find(f => f.endsWith('.webp'));
    const graph = {
        1: { class_type: 'MpiLoadImageFromPath', inputs: { string: '' }, _meta: { title: 'Input_Image' } },
        2: { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'x' }, _meta: { title: 'Output_Image' } },
    };
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(display, still), path.join(dir, 'preview.webp'));
    fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify(graph));
    fs.writeFileSync(path.join(dir, 'flow.json'), JSON.stringify({
        schema: 'cubric/flow-package/v1', id, version: '1.0.0',
        flow: {
            title, description: 'Seeded by flow-packages.spec.js.', preview: 'preview.webp',
            requiredModels: [MODELS[0].id], mediaType: 'image', type: 'edit', ...extra,
        },
        op: {
            label: `Flow: ${title}`, mediaType: 'image',
            mediaInputs: [{ key: 'image1', mediaType: 'image', title: 'Input_Image', required: true }],
        },
    }));
}

// Two packages seeded before launch: one valid, one naming a dep no app has. The broken
// one must be LISTED, disabled, with its reason — silence reads as a broken app.
test('Flow packages load from user_flows, serve their files, and a broken one says why', async ({}, testInfo) => {
    const flowsDir = path.join(testInfo.outputPath('user-data'), 'user_flows');
    writePackage(path.join(flowsDir, 'spec-flow'), 'spec-flow', 'Spec Package');
    writePackage(path.join(flowsDir, 'spec-broken'), 'spec-broken', 'Spec Broken', { requiredDeps: ['no-such-dep'] });
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);

        const r = await window.evaluate(async () => {
            const { MpiFlowLibrary } = await import('/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
            const { getFlowById, flowAvailability } = await import('/js/data/flowsRegistry.js');
            const { getFilePrefix } = await import('/js/data/commandRegistry.js');
            const { getUniversalWorkflow } = await import('/js/data/modelRegistry.js');

            const out = {};
            const ok = getFlowById('user:spec-flow');
            const off = getFlowById('user:spec-broken');
            out.registered = [!!ok, !!off];
            out.prefix = getFilePrefix('user:spec-flow');
            out.reason = flowAvailability(off).reason || null;

            // The graph through the exact URL commandExecutor builds.
            const wf = await fetch(`/comfy_workflows/${getUniversalWorkflow('user:spec-flow')}`);
            out.graphTitles = wf.ok ? Object.values(await wf.json()).map(n => n._meta.title) : wf.status;

            const lib = MpiFlowLibrary.mount(document.createElement('div'));
            window.__mpi532lib = lib;
            const root = lib.el;
            lib.el.open();
            const tile = (title) => [...root.querySelectorAll('.mpi-tile')].find(t => t.textContent.includes(title));
            out.okChip = tile('Spec Package')?.querySelector('.mpi-tile__chip')?.textContent || null;
            out.offChip = tile('Spec Broken')?.querySelector('.mpi-tile__chip')?.className || null;

            // The preview through the exact src the tile sheet builds.
            const img = tile('Spec Package')?.querySelector('img');
            if (img && !img.complete) await new Promise(res => { img.onload = img.onerror = res; });
            out.previewSrc = img?.getAttribute('src') || null;
            out.previewPixels = img?.naturalWidth || 0;

            tile('Spec Broken').click();
            await new Promise(res => setTimeout(res, 300));
            const panel = root.querySelector('#flow-detail-panel');
            out.drawerOpen = panel.classList.contains('is-open');
            out.drawerText = root.querySelector('#flow-detail-body').textContent.replace(/\s+/g, ' ').trim();
            out.drawerButtons = root.querySelectorAll('#flow-detail-actions .mpi-button, #flow-detail-actions button').length;
            return out;
        });

        expect(r.registered).toEqual([true, true]);
        expect(r.prefix).toBe('flowSpecPackage');
        expect(r.reason).toContain('Needs dependency "no-such-dep"');
        expect(r.graphTitles).toEqual(['Input_Image', 'Output_Image']);
        expect(r.okChip).not.toBeNull();
        expect(r.offChip).toContain('mpi-tile__chip--unavailable');
        expect(r.previewSrc).toBe('comfy_workflows/display/user-flows/spec-flow/preview.webp');
        expect(r.previewPixels).toBeGreaterThan(0);
        expect(r.drawerOpen).toBe(true);
        expect(r.drawerText).toContain("Can't run");
        expect(r.drawerText).toContain('Needs dependency "no-such-dep"');
        expect(r.drawerButtons).toBe(0);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await window.evaluate(() => window.__mpi532lib?.el?.destroy?.()).catch(() => {});
        await closeApp(app);
    }
});

// The drop, end to end through the real overlay, route and registry. A synthetic File has
// no disk path, so `webUtils.getPathForFile` is pointed at a real folder — everything after
// that is the shipped code path. The zip and failure branches are unit-tested
// (tests/user-flows.test.cjs); this proves the wiring.
test('dropping a Flow folder on the Library installs it with no restart; a second drop asks to replace', async ({}, testInfo) => {
    const src = testInfo.outputPath('downloads', 'Dropped Flow v1');
    writePackage(src, 'dropped-flow', 'Dropped Flow');
    const { app, window, pageErrors, consoleErrors } = await launchApp(testInfo);

    try {
        await window.waitForTimeout(6000);

        const r = await window.evaluate(async (srcPath) => {
            window.require('electron').webUtils.getPathForFile = () => srcPath;
            const { MpiFlowLibrary } = await import('/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
            const { getFlowById } = await import('/js/data/flowsRegistry.js');
            const { Events } = await import('/js/events.js');
            const sleep = (ms) => new Promise(res => setTimeout(res, ms));
            const until = async (fn) => { for (let i = 0; i < 50 && !fn(); i++) await sleep(100); return fn(); };

            const toasts = [];
            const offs = ['ui:success', 'ui:warning'].map(t => Events.on(t, (p) => toasts.push([t, p.title])));

            const lib = MpiFlowLibrary.mount(document.createElement('div'));
            window.__mpi532drop = lib;
            const root = lib.el;
            lib.el.open();
            const out = { before: !!getFlowById('user:dropped-flow') };

            const overlay = root.querySelector('.mpi-project-drop-overlay');
            const drag = (type, target) => {
                const dt = new DataTransfer();
                dt.items.add(new File(['x'], 'Dropped Flow v1'));
                target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
            };
            const visible = () => overlay.classList.contains('mpi-project-drop-overlay--visible');

            drag('dragenter', root);
            out.shownOnDrag = visible();
            out.text = overlay.textContent.trim();
            drag('drop', overlay);
            out.hiddenOnDrop = !visible();

            const tile = () => [...root.querySelectorAll('.mpi-tile')].find(t => t.textContent.includes('Dropped Flow'));
            out.tile = !!(await until(tile));
            out.registered = !!getFlowById('user:dropped-flow');
            out.toastsAfterFirst = toasts.slice();

            // Second drop: the id exists → the Replace dialog, then a real replace.
            drag('dragenter', root);
            out.shownOnSecondDrag = visible();
            drag('drop', overlay);
            const dialog = () => [...document.querySelectorAll('.mpi-ok-cancel')]
                .find(d => d.querySelector('#title-slot')?.textContent === 'Replace Flow' && d.isConnected && d.offsetParent);
            const dlg = await until(dialog);
            out.dialogText = dlg?.querySelector('#text-slot')?.textContent || null;
            const replace = dlg && [...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'Replace');
            replace?.click();
            await until(() => toasts.length > out.toastsAfterFirst.length);
            out.toastsAfterReplace = toasts.slice();
            out.tilesNamedDropped = [...root.querySelectorAll('.mpi-tile')].filter(t => t.textContent.includes('Dropped Flow')).length;
            offs.forEach(off => off());
            return out;
        }, src);

        expect(r.before).toBe(false);
        expect(r.shownOnDrag).toBe(true);
        expect(r.text).toBe('Drop a Flow folder or its .zip to add it');
        expect(r.hiddenOnDrop).toBe(true);
        expect(r.tile).toBe(true);
        expect(r.registered).toBe(true);
        expect(r.toastsAfterFirst).toEqual([['ui:success', 'Flow added']]);
        expect(r.shownOnSecondDrag).toBe(true);
        expect(r.dialogText).toContain('Dropped Flow is already installed.');
        expect(r.toastsAfterReplace).toEqual([['ui:success', 'Flow added'], ['ui:success', 'Flow added']]);
        expect(r.tilesNamedDropped).toBe(1);
        expect(fs.existsSync(path.join(testInfo.outputPath('user-data'), 'user_flows', 'dropped-flow', 'flow.json'))).toBe(true);
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    } finally {
        await window.evaluate(() => window.__mpi532drop?.el?.destroy?.()).catch(() => {});
        await closeApp(app);
    }
});
